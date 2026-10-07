import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu'
import type { Object3D, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { sfx } from '../audio/sfx'
import { emit, on } from '../events'
import { useRoomDef } from '../room/RoomContext'
import { useRoom } from '../room/RoomScene'
import { liveGhosts, runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { flash } from './cameraFx'
import { capturePhoto } from './capturePhoto'
import { scorePhoto } from './scorePhoto'
import type { PhotoScore } from './scorePhoto'

const MODEL_URL = '/models/shared/camera.glb'
// Held pose in camera space: low in the view, as if lifted towards the eye.
const HELD_X = 0
const HELD_Z = -0.3
const HELD_Y_RAISED = -0.135
const HELD_Y_LOWERED = -0.42
const HELD_TILT = -0.12 // radians, the back leans towards the eye
const HELD_GLOW = 0.1 // emissive, so the model reads as a silhouette in the dark

const _ndc = new Vector3()
const _v = new Vector3()

function fallbackModel(): Object3D {
  const body = new Mesh(
    new BoxGeometry(0.14, 0.105, 0.07),
    new MeshStandardMaterial({ color: 0x2b2630, roughness: 0.7 }),
  )
  body.name = 'Camera_Body'
  return body
}

function prepare(model: Object3D) {
  model.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    const material = (mesh.material as MeshStandardMaterial).clone()
    if (material.emissive && material.color) {
      material.emissive.copy(material.color)
      material.emissiveIntensity = HELD_GLOW
    }
    mesh.material = material
  })
}

// Photo object URLs that nothing shows any more are released.
const urls = new Set<string>()
function releaseUnused() {
  const { photos, lastShot } = useGame.getState()
  for (const url of urls) {
    if (url === lastShot?.url || photos.some((p) => p.url === url)) continue
    URL.revokeObjectURL(url)
    urls.delete(url)
  }
}

export function CameraMode() {
  const room = useRoom()
  const camera = useThree((s) => s.camera) as unknown as PerspectiveCamera
  const scene = useThree((s) => s.scene) as unknown as Scene
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer

  const holder = useRef<Group | null>(null)
  const raise = useRef(0) // 0 lowered .. 1 raised
  const baseFov = useRef(camera.fov)
  const lastShotAt = useRef(-Infinity)
  const busy = useRef(false) // from the shutter until the card is up
  const def = useRoomDef()
  const pending = useRef<{ result: PhotoScore | null } | null>(null)

  // The held model, parented to the view camera.
  useEffect(() => {
    // Children of the camera only render when the camera is in the scene.
    // Left in place on unmount: the flashlight relies on it too.
    if (!camera.parent) scene.add(camera)
    const group = new Group()
    group.name = 'Held_Camera'
    group.position.set(HELD_X, HELD_Y_LOWERED, HELD_Z)
    group.rotation.x = HELD_TILT
    group.visible = false
    camera.add(group)
    holder.current = group

    let alive = true
    const adopt = (model: Object3D) => {
      if (!alive) return
      prepare(model)
      group.add(model)
    }
    new GLTFLoader().loadAsync(MODEL_URL).then(
      (gltf) => adopt(gltf.scene),
      (error) => {
        console.warn(`[camera] could not load ${MODEL_URL}, using a box`, error)
        adopt(fallbackModel())
      },
    )

    const fov = baseFov.current
    return () => {
      alive = false
      holder.current = null
      group.removeFromParent()
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [camera, scene])

  // Shutter.
  useEffect(
    () =>
      on('shoot', () => {
        const game = useGame.getState()
        if (!game.cameraRaised || game.paused || game.uiLock || busy.current) return
        const now = performance.now()
        if (now - lastShotAt.current < tuning.photoCooldown * 1000) return
        lastShotAt.current = now
        busy.current = true

        sfx.play('shutter')
        flash(tuning.photoCooldown)
        // Scored now, from the scene as the player saw it; the image is taken
        // from the next rendered frame, without the held model in it.
        pending.current = {
          result: scorePhoto(camera, def.ghosts, room.occluders),
        }
        if (holder.current) holder.current.visible = false
      }),
    [camera, room, def],
  )

  useFrame((_, delta) => {
    const game = useGame.getState()
    const dt = Math.min(delta, tuning.maxFrameDt)

    // Raise / lower, with the zoom following the same ease.
    const goal = game.cameraRaised ? 1 : 0
    const step = dt / Math.max(0.01, tuning.cameraRaiseSeconds)
    raise.current += Math.min(step, Math.max(-step, goal - raise.current))
    const k = raise.current
    const ease = k * k * (3 - 2 * k)

    const group = holder.current
    if (group) {
      group.position.y = HELD_Y_LOWERED + (HELD_Y_RAISED - HELD_Y_LOWERED) * ease
      group.visible = k > 0 && pending.current === null
    }

    const halfTan = Math.tan((baseFov.current * Math.PI) / 360)
    const zoom = 1 + (Math.max(1, tuning.cameraZoom) - 1) * ease
    const fov = (Math.atan(halfTan / zoom) * 360) / Math.PI
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Touch aim assist: ease the view onto a Wisp that is already near the
    // centre. Look deltas are in screen terms (+X turns right, +Y looks down).
    if (game.touch && game.cameraRaised && !game.paused && !game.uiLock) {
      // The ghost nearest the centre of the view.
      let best = tuning.aimAssistRadius
      let found = false
      for (const ghost of liveGhosts()) {
        _v.copy(ghost.position).project(camera)
        if (_v.z <= -1 || _v.z >= 1) continue
        // Distance from the centre as a fraction of the screen width.
        const offset = Math.hypot(_v.x / 2, _v.y / 2 / Math.max(0.01, camera.aspect))
        if (offset >= best) continue
        best = offset
        found = true
        _ndc.copy(_v)
      }
      if (found) {
        const tanV = Math.tan((camera.fov * Math.PI) / 360)
        const yawError = Math.atan(_ndc.x * tanV * camera.aspect)
        const pitchError = Math.atan(_ndc.y * tanV)
        const pull = Math.min(1, tuning.aimAssistStrength * dt)
        runtime.input.lookDX += yawError * pull
        runtime.input.lookDY -= pitchError * pull
      }
    }
  })

  // Runs after PostFx has rendered the frame (priority 1).
  useFrame(() => {
    const shot = pending.current
    if (!shot) return
    pending.current = null
    const { result } = shot

    capturePhoto({ renderer, scene, camera })
      .catch((error) => {
        console.warn('[camera] photo capture failed', error)
        return ''
      })
      .then((url) => {
        if (url) urls.add(url)
        const game = useGame.getState()
        game.addShot({
          url,
          ghostId: result ? result.ghostId : null,
          score: result ? result.score : null,
          parts: result ? result.parts : null,
        })
        releaseUnused()
        emit('photo', {
          ghostId: result ? result.ghostId : null,
          quality: result ? result.quality : null,
        })
        // The lock freezes the game on the shot; the card slides in over it.
        if (!useGame.getState().uiLock) game.setUiLock('photo')
        busy.current = false
      })
  }, 2)

  return null
}
