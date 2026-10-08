import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  CanvasTexture,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu'
import { max, mix, reflector, smoothstep, uniform, uv, vec3 } from 'three/tsl'
import { debugState } from '../debug/debugState'
import { quality } from '../renderer/quality'
import { useRoomDef } from '../room/RoomContext'
import { useRoom } from '../room/RoomScene'
import type { BoundRoom } from '../room/bindNodes'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { createMirrorClue } from './mirrorClue'
import type { MirrorClue } from './mirrorClue'
import { tr } from '#/i18n'
import { dressMirrorText, MIRROR_ONLY_LAYER } from './mirrorText'
import type { MirrorText } from './mirrorText'

// The reflection test: a word painted backwards on the wall facing the
// mirror, when the definition has one (mirror.testWord).
const WORD_Y = 2.34 // above the painting, still in the mirror's view from mid-room
const WORD_WIDTH = 0.62
const WORD_HEIGHT = 0.2
const WORD_FALLBACK_DIST = 3.95 // mirror to the opposite wall if the ray finds nothing

const Z_AXIS = new Vector3(0, 0, 1)

interface MirrorParts {
  tint: { value: number }
  word: MeshStandardNodeMaterial | null
  texts: MirrorText[]
  clue: MirrorClue | null
}

// Centre and facing of the mirror plane in the mesh's local space. The
// reflector assumes a plane facing +Z; Mirror_Surface faces +X, so the
// normal is read from the geometry instead of assumed.
function mirrorPlane(mesh: Mesh) {
  const geometry = mesh.geometry
  geometry.computeBoundingBox()
  const centre = geometry.boundingBox!.getCenter(new Vector3())
  const normal = new Vector3(1, 0, 0)
  const normals = geometry.getAttribute('normal')
  if (normals) normal.fromBufferAttribute(normals, 0).normalize()

  // A mirror on a wall faces into the room; flip a normal that points out.
  mesh.updateWorldMatrix(true, false)
  const worldCentre = centre.clone().applyMatrix4(mesh.matrixWorld)
  const worldNormal = normal.clone().transformDirection(mesh.matrixWorld)
  const inward = new Vector3(-worldCentre.x, 0, -worldCentre.z)
  if (inward.lengthSq() > 0.01 && worldNormal.dot(inward) < 0) {
    normal.negate()
    worldNormal.negate()
  }
  return { centre, normal, worldCentre, worldNormal }
}

function wordTexture(word: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  // Drawn mirrored, so it reads the right way round only in the reflection.
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.font = '600 118px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#d8cfb6'
  ctx.fillText(word, canvas.width / 2, canvas.height / 2 + 6, canvas.width - 24)
  // Faded paint: knock small flecks out of the letters.
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.25 + Math.random() * 0.6
    const r = 1 + Math.random() * 4
    ctx.beginPath()
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function buildWord(room: BoundRoom, text: string, worldCentre: Vector3, worldNormal: Vector3) {
  // Find the facing wall along the mirror's normal, at the word's height.
  const from = worldCentre.clone().addScaledVector(worldNormal, 0.1)
  from.y = WORD_Y
  const hit = new Raycaster(from, worldNormal, 0, 20).intersectObjects(room.occluders, false)[0]
  const dist = hit ? hit.distance : WORD_FALLBACK_DIST
  const position = from.clone().addScaledVector(worldNormal, dist - 0.006)

  const map = wordTexture(text)
  const material = new MeshStandardNodeMaterial({
    map,
    emissiveMap: map,
    emissive: 0xffffff,
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new Mesh(new PlaneGeometry(WORD_WIDTH, WORD_HEIGHT), material)
  mesh.name = 'Mirror_TestWord'
  mesh.position.copy(position)
  mesh.quaternion.setFromUnitVectors(Z_AXIS, worldNormal.clone().negate())
  return { mesh, material, map }
}

// Swaps Mirror_Surface's material for a planar reflection of the room, and
// dresses the room's MirrorOnly_ meshes so that only the reflection shows them.
export function Mirror() {
  const room = useRoom()
  const def = useRoomDef().mirror
  const testWord = def?.testWord
  const clueDef = def?.clue
  const mainCamera = useThree((s) => s.camera)
  const parts = useRef<MirrorParts | null>(null)

  useEffect(() => {
    const mesh = room.mirror
    if (!mesh) return
    const { centre, normal, worldCentre, worldNormal } = mirrorPlane(mesh)

    // bounces: false also makes the reflection update once per frame instead
    // of once per render call.
    const reflection = reflector({ resolutionScale: quality.mirrorScale, bounces: false })
    reflection.target.position.copy(centre)
    reflection.target.quaternion.setFromUnitVectors(Z_AXIS, normal)
    mesh.add(reflection.target)

    // The node only updates when the mirror is drawn, so a mirror outside the
    // frustum costs nothing, and three skips it when it faces away. This adds
    // the option of refreshing it every Nth frame.
    const base = reflection.reflector
    const update = base.updateBefore.bind(base)
    let tick = 0
    base.updateBefore = (frame) => {
      const every = Math.max(1, Math.round(tuning.mirrorUpdateEvery))
      if (tick++ % every !== 0 && base.hasOutput) return undefined
      // Mirror-only content: the reflector keeps one virtual camera per view
      // camera (a clone, made on first use and never given new layers), so it
      // can carry a layer the view camera lacks. No visibility toggling, and a
      // skipped refresh above just keeps the last reflection, text included.
      if (frame.camera) base.getVirtualCamera(frame.camera).layers.enable(MIRROR_ONLY_LAYER)
      return update(frame)
    }

    // On their own layer the main view never draws them; castShadow = false
    // keeps them out of the flashlight's shadow pass, whose camera borrows the
    // layers of whichever camera is rendering.
    const texts = room.mirrorOnly.map((m) =>
      dressMirrorText(m, clueDef?.text && m.name === clueDef.node ? tr(clueDef.text) : undefined),
    )
    const clueText = clueDef && room.mirrorOnly.find((m) => m.name === clueDef.node)
    const clue =
      clueDef && clueText
        ? createMirrorClue(mesh, { worldCentre, worldNormal }, clueText, clueDef.gives, room.occluders)
        : null

    const tint = uniform(tuning.mirrorTint)
    const cool = vec3(tint, mix(tint, 1, 0.5), 1)
    let color = reflection.rgb.mul(cool)
    if (mesh.geometry.getAttribute('uv')) {
      // A thin dark edge where the glass meets the frame hides seams.
      const d = uv().sub(0.5).abs().mul(2)
      color = color.mul(mix(1, 0.25, smoothstep(0.95, 1, max(d.x, d.y))))
    }
    const material = new MeshBasicNodeMaterial()
    material.colorNode = color
    material.fog = false // the reflected scene is already fogged

    const original = mesh.material
    mesh.material = material
    mesh.castShadow = false
    mesh.receiveShadow = false

    const word = testWord ? buildWord(room, tr(testWord), worldCentre, worldNormal) : null
    if (word) room.scene.add(word.mesh)
    parts.current = { tint, word: word?.material ?? null, texts, clue }

    return () => {
      parts.current = null
      mesh.material = original
      mesh.remove(reflection.target)
      reflection.dispose()
      material.dispose()
      for (const text of texts) text.dispose()
      mainCamera.layers.disable(MIRROR_ONLY_LAYER)
      if (word) {
        word.mesh.removeFromParent()
        word.mesh.geometry.dispose()
        word.material.dispose()
        word.map.dispose()
      }
    }
  }, [room, testWord, clueDef, mainCamera])

  useFrame(({ camera }, delta) => {
    const p = parts.current
    if (!p) return
    p.tint.value = tuning.mirrorTint
    for (const text of p.texts) text.update()
    // Debug: also draw the mirror-only meshes in the main view, to place them.
    if (p.texts.length > 0) {
      if (debugState.mirrorOnlyInMainView) camera.layers.enable(MIRROR_ONLY_LAYER)
      else camera.layers.disable(MIRROR_ONLY_LAYER)
    }
    const store = useGame.getState()
    if (p.clue && !store.paused && store.uiLock === null) p.clue.step(Math.min(delta, 0.1), camera)
    if (p.word) {
      p.word.emissiveIntensity = tuning.mirrorWordGlow
      p.word.opacity = tuning.mirrorWordOpacity
    }
  })

  return null
}
