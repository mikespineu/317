import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SpotLight,
  Vector3,
} from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { quality } from '../renderer/quality'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { bindLightSounds, stopLightSounds, updateBattery } from './battery'
import { Dust } from './Dust'
import { VolumetricCone } from './VolumetricCone'
import { beamColors, syncBeamUniforms } from './uvReveal'

const HELD_MODEL = '/models/level0/flashlight.glb'
const FORWARD = new Vector3(0, 0, -1)
const aimDir = new Vector3()

// Beam pattern projected through SpotLight.map: a hot centre, a soft body and
// a faint ring near the rim, like a real reflector. Values are light
// multipliers, so the texture is left as linear data.
function makeCookie() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grey = (v: number) => `rgb(${v}, ${v}, ${v})`
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, grey(255))
  g.addColorStop(0.18, grey(235))
  g.addColorStop(0.42, grey(140))
  g.addColorStop(0.68, grey(84))
  g.addColorStop(0.8, grey(118)) // the ring
  g.addColorStop(0.88, grey(60))
  g.addColorStop(1, grey(0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  // no mips: the lookup is discontinuous at the cone edge and would smear
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  return texture
}

// Held items are near the lens, so they must not shadow the room.
function noShadows(root: Object3D) {
  root.traverse((node) => {
    node.castShadow = false
    node.receiveShadow = false
    node.raycast = () => {}
  })
}

function buildRig() {
  // `aim` sits at the lens and looks down the beam; the light, its target and
  // the volumetric cone all hang off it.
  const aim = new Group()
  aim.name = 'Flashlight_Aim'

  const cookie = makeCookie()
  const light = new SpotLight(beamColors.white, 0)
  light.name = 'Flashlight_Light'
  light.map = cookie
  // Kept on for good and switched off through intensity: toggling castShadow
  // or visibility would rebuild every lit material and hitch.
  light.castShadow = true
  light.shadow.mapSize.set(quality.shadowMap, quality.shadowMap)
  light.shadow.camera.near = 0.05
  light.target.position.set(0, 0, -1)
  aim.add(light, light.target)

  const held = new Group()
  held.name = 'Flashlight_Held'

  return { aim, light, held, cookie }
}

function fallbackModel() {
  const geometry = new BoxGeometry(0.07, 0.07, 0.25).translate(0, 0, -0.045)
  return new Mesh(geometry, new MeshStandardMaterial({ color: '#2a2530', roughness: 0.8 }))
}

// The flashlight: spotlight with a cookie, the model in the player's hand,
// the battery, the visible cone and the dust it lights. Writes runtime.beam
// and the shared beam uniforms every frame.
export function Flashlight() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const rig = useMemo(buildRig, [])

  // Children of the camera only render if the camera is in the scene graph.
  useEffect(() => {
    const adopted = camera.parent === null
    if (adopted) scene.add(camera)
    camera.add(rig.aim, rig.held)
    return () => {
      camera.remove(rig.aim, rig.held)
      if (adopted && camera.parent === scene) scene.remove(camera)
    }
  }, [camera, scene, rig])

  useEffect(() => {
    let alive = true
    const show = (model: Object3D) => {
      if (!alive) return
      noShadows(model)
      rig.held.add(model)
    }
    new GLTFLoader().loadAsync(HELD_MODEL).then(
      (gltf) => show(gltf.scene),
      (error) => {
        console.warn(`[light] could not load ${HELD_MODEL}, using a box`, error)
        show(fallbackModel())
      },
    )
    return () => {
      alive = false
      rig.held.clear()
    }
  }, [rig])

  useEffect(() => {
    const unbind = bindLightSounds()
    return () => {
      unbind()
      stopLightSounds()
      rig.light.dispose()
      rig.cookie.dispose()
      runtime.beam.strength = 0
      syncBeamUniforms()
    }
  }, [rig])

  useFrame((state, delta) => {
    const store = useGame.getState()
    const frozen = store.paused || store.uiLock !== null
    const beam = updateBattery(Math.min(delta, tuning.maxFrameDt), frozen)
    const { aim, light, held } = rig

    // Aim from the right hand at a point on the view axis, so the beam still
    // lands where the player looks while shadows fall off to the side.
    aim.position.set(tuning.lightOffsetX, tuning.lightOffsetY, tuning.lightOffsetZ)
    aimDir.set(0, 0, -tuning.lightConvergeDist).sub(aim.position).normalize()
    aim.quaternion.setFromUnitVectors(FORWARD, aimDir)

    const sway = Math.sin(state.clock.elapsedTime * 1.3) * tuning.heldBob
    held.position.set(tuning.heldX, tuning.heldY + sway, tuning.heldZ)
    held.quaternion.copy(aim.quaternion)
    held.scale.setScalar(tuning.heldScale)

    light.color.copy(beamColors[beam.mode])
    light.intensity = beam.intensity
    light.distance = beam.distance
    light.angle = beam.angle
    light.penumbra = tuning.lightPenumbra
    light.decay = tuning.lightDecay
    light.shadow.bias = tuning.shadowBias
    light.shadow.normalBias = tuning.shadowNormalBias

    // The player controller has already moved the camera this frame.
    camera.updateMatrixWorld()
    const out = runtime.beam
    out.origin.setFromMatrixPosition(aim.matrixWorld)
    out.dir.setFromMatrixColumn(aim.matrixWorld, 2).negate().normalize()
    out.cos = Math.cos(beam.angle)
    out.range = beam.distance
    out.strength = beam.strength
    out.mode = beam.mode
    syncBeamUniforms()
  })

  return (
    <>
      <VolumetricCone parent={rig.aim} />
      <Dust />
    </>
  )
}
