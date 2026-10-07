import { CanvasTexture, Color, MeshStandardNodeMaterial } from 'three/webgpu'
import type { Mesh } from 'three/webgpu'
import { texture, uniform, uv, vec2 } from 'three/tsl'
import { tuning } from '../tuning'

// --- Text orientation on the MirrorOnly_ plane ------------------------------
// The text is drawn the right way round on a 2D canvas and uploaded with
// flipY = false (the glTF convention: uv (0,0) is the image's top-left).
// level-1.glb maps MirrorOnly_Text with u 0..1 along +Z and v 0..1 from the top
// down. The plane is on the east wall facing -X, and for someone facing east
// +Z is to the right, so unflipped the text would read normally on the wall.
// It has to read normally in the mirror on the opposite wall instead, and a
// mirror swaps left and right, so the text goes on the wall reversed:
// FLIP_U = true. If it reads backwards in the mirror, set FLIP_U = false; if
// it is upside down, FLIP_V = true.
const FLIP_U = true
const FLIP_V = false
// ---------------------------------------------------------------------------

// Drawn only by the reflection's camera; see Mirror.tsx.
export const MIRROR_ONLY_LAYER = 7

const VERMILION = 0xc63b2b // --color-vermilion in styles.css
const FALLBACK_TEXT = 'Eldest first'
const TEX_HEIGHT = 200

// Small seeded generator so the brushwork looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// White brush lettering on a clear ground; only the alpha channel is used.
// To be replaced by textures/level1/mirror-text.png when it exists.
function textTexture(text: string, aspect: number) {
  const canvas = document.createElement('canvas')
  canvas.height = TEX_HEIGHT
  canvas.width = Math.min(2048, Math.max(64, Math.round(TEX_HEIGHT * aspect)))
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  const rand = rng(1869)

  ctx.font = `italic 600 ${H * 0.66}px "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, W / 2, H / 2 + 4, W - 40)

  ctx.globalCompositeOperation = 'destination-out'
  // Dry brush: thin streaks along the stroke direction.
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.45
    ctx.fillRect(rand() * W, rand() * H, 30 + rand() * 120, 1 + rand() * 2.5)
  }
  // Faded paint: knock small flecks out of the letters.
  for (let i = 0; i < 1500; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.6
    ctx.beginPath()
    ctx.arc(rand() * W, rand() * H, 0.8 + rand() * 3.2, 0, Math.PI * 2)
    ctx.fill()
  }

  const map = new CanvasTexture(canvas)
  map.flipY = false
  map.anisotropy = 4
  return map
}

function textUv() {
  const u = FLIP_U ? uv().x.oneMinus() : uv().x
  const v = FLIP_V ? uv().y.oneMinus() : uv().y
  return vec2(u, v)
}

// Width over height of a flat mesh: its two largest bounding-box sides.
function planeAspect(mesh: Mesh) {
  mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox!
  const [h, w] = [box.max.x - box.min.x, box.max.z - box.min.z, box.max.y - box.min.y]
    .sort((a, b) => b - a)
    .slice(0, 2)
    .sort((a, b) => a - b)
  return h > 1e-4 ? w / h : 5
}

export interface MirrorText {
  mesh: Mesh
  update(): void
  dispose(): void
}

// Dresses a MirrorOnly_ mesh as painted writing: lit, vermilion, the text as
// its alpha. With no glow it shows only where the flashlight lights the wall.
// The mesh moves to MIRROR_ONLY_LAYER, so only the reflection's camera draws it.
export function dressMirrorText(mesh: Mesh): MirrorText {
  const text = typeof mesh.userData.text === 'string' ? mesh.userData.text : FALLBACK_TEXT
  const map = textTexture(text, planeAspect(mesh))
  const glow = uniform(tuning.mirrorTextGlow)
  const paint = new Color(VERMILION)

  const material = new MeshStandardNodeMaterial()
  material.name = 'MirrorOnly_Text'
  material.color.copy(paint)
  material.roughness = 1
  material.metalness = 0
  material.opacityNode = texture(map, textUv()).a
  material.emissiveNode = uniform(paint).mul(glow)
  material.transparent = true
  material.depthWrite = false
  // The plane sits 5 mm off the wall; keep it clear of it in the reflection,
  // whose oblique near plane costs depth precision.
  material.polygonOffset = true
  material.polygonOffsetFactor = -4
  material.polygonOffsetUnits = -4

  const before = {
    material: mesh.material,
    visible: mesh.visible,
    layers: mesh.layers.mask,
    castShadow: mesh.castShadow,
    receiveShadow: mesh.receiveShadow,
  }
  mesh.material = material
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.layers.set(MIRROR_ONLY_LAYER)
  mesh.visible = true

  return {
    mesh,
    update() {
      glow.value = tuning.mirrorTextGlow
    },
    dispose() {
      mesh.material = before.material
      mesh.visible = before.visible
      mesh.layers.mask = before.layers
      mesh.castShadow = before.castShadow
      mesh.receiveShadow = before.receiveShadow
      material.dispose()
      map.dispose()
    },
  }
}
