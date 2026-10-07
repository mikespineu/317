import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Box3,
  CanvasTexture,
  MeshStandardNodeMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu'
import type { Mesh, Object3D } from 'three/webgpu'
import { materialEmissive, mix, texture, uniform, uv, vec2, vec3 } from 'three/tsl'
import { sfx } from '../audio/sfx'
import { useRoom } from '../room/RoomScene'
import { level0 } from '../room/level0.def'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { uvMask, uvMaskAt } from './uvReveal'

// --- Picture orientation on the canvas plane ------------------------------
// The textures are drawn upright on 2D canvases and uploaded with
// flipY = false (the glTF convention: uv (0,0) is the image's top-left).
// level-0.glb maps u 0..1 left to right and v 0..1 top to bottom as seen from
// inside the room, so all three are off. If the picture shows mirrored, upside
// down or on its side, fix it here. The ?greybox plane uses three's own
// PlaneGeometry UVs (v up) and needs FLIP_V = true.
const FLIP_U = false
const FLIP_V = false
const ROTATE_QUARTER_TURNS: 0 | 1 | 2 | 3 = 0
// ---------------------------------------------------------------------------

const TEX_W = 512
const TEX_H = 668 // same aspect as the 0.66 x 0.86 m canvas

const reveal = level0.interactables.find((i) => i.type === 'uv-reveal')
const code = level0.interactables.flatMap((i) => ('lock' in i ? [i.lock.code] : []))[0] ?? ''

// Small seeded generator so the painting looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  return { canvas, ctx: canvas.getContext('2d')! }
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean) {
  const tex = new CanvasTexture(canvas)
  tex.flipY = false
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// The visible picture: a night landscape with a lit window, in the room's
// muted teal / plum / cream palette, roughed up with short brush strokes.
function paintBase() {
  const { canvas, ctx } = makeCanvas()
  const rand = rng(317)
  const W = TEX_W
  const H = TEX_H

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7)
  sky.addColorStop(0, '#16262b')
  sky.addColorStop(0.6, '#2f4a4b')
  sky.addColorStop(1, '#6b6452')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // moon and its haze
  const mx = W * 0.7
  const my = H * 0.2
  const haze = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.38)
  haze.addColorStop(0, 'rgba(226, 216, 180, 0.55)')
  haze.addColorStop(0.15, 'rgba(200, 196, 168, 0.22)')
  haze.addColorStop(1, 'rgba(200, 196, 168, 0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#e4dcbd'
  ctx.beginPath()
  ctx.arc(mx, my, W * 0.055, 0, Math.PI * 2)
  ctx.fill()

  // three ranges of hills, darker toward the front
  const hills = [
    { y: 0.52, amp: 0.05, color: '#3c3a4a' },
    { y: 0.62, amp: 0.06, color: '#2e2636' },
    { y: 0.76, amp: 0.04, color: '#1c1a22' },
  ]
  for (const hill of hills) {
    const a = rand() * 6
    const b = rand() * 6
    ctx.fillStyle = hill.color
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let x = 0; x <= W; x += 8) {
      const k = x / W
      const y = hill.y + hill.amp * (Math.sin(k * 5 + a) * 0.7 + Math.sin(k * 11 + b) * 0.3)
      ctx.lineTo(x, y * H)
    }
    ctx.lineTo(W, H)
    ctx.fill()
  }

  // a house on the middle ridge with one lit window
  const hx = W * 0.27
  const hy = H * 0.6
  ctx.fillStyle = '#17141c'
  ctx.fillRect(hx, hy, W * 0.16, H * 0.085)
  ctx.beginPath()
  ctx.moveTo(hx - W * 0.015, hy)
  ctx.lineTo(hx + W * 0.08, hy - H * 0.05)
  ctx.lineTo(hx + W * 0.175, hy)
  ctx.fill()
  ctx.fillRect(hx + W * 0.115, hy - H * 0.06, W * 0.02, H * 0.045)
  const wx = hx + W * 0.05
  const wy = hy + H * 0.03
  const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, W * 0.09)
  glow.addColorStop(0, 'rgba(226, 178, 96, 0.5)')
  glow.addColorStop(1, 'rgba(226, 178, 96, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(wx - W * 0.1, wy - W * 0.1, W * 0.2, W * 0.2)
  ctx.fillStyle = '#e0b468'
  ctx.fillRect(wx - W * 0.014, wy - H * 0.014, W * 0.028, H * 0.028)

  // a bare tree on the right
  ctx.strokeStyle = '#121016'
  ctx.lineCap = 'round'
  const branch = (x: number, y: number, angle: number, len: number, width: number) => {
    if (len < 8) return
    const x2 = x + Math.cos(angle) * len
    const y2 = y + Math.sin(angle) * len
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    branch(x2, y2, angle - 0.3 - rand() * 0.4, len * 0.72, width * 0.65)
    branch(x2, y2, angle + 0.25 + rand() * 0.4, len * 0.68, width * 0.65)
  }
  branch(W * 0.82, H * 0.86, -Math.PI / 2 - 0.08, H * 0.13, 9)

  // brush strokes: short, mostly horizontal dabs, lighter and darker
  for (let i = 0; i < 1400; i++) {
    const x = rand() * W
    const y = rand() * H
    const len = 10 + rand() * 26
    const angle = (rand() - 0.5) * 0.7
    const light = rand() > 0.5
    ctx.strokeStyle = light
      ? `rgba(220, 210, 180, ${0.02 + rand() * 0.05})`
      : `rgba(10, 8, 16, ${0.03 + rand() * 0.07})`
    ctx.lineWidth = 2 + rand() * 4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }

  // aged varnish: darker toward the edges
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.72)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(8, 6, 4, 0.6)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  return toTexture(canvas, true)
}

// The hidden layer: the drawer code as big hand-drawn digits, white on black.
// Only the red channel is read.
function paintHidden(digits: string[]) {
  const { canvas, ctx } = makeCanvas()
  const rand = rng(713)
  const W = TEX_W
  const H = TEX_H
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineCap = 'round'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 10 // soft ink edge
  const size = Math.min(H * 0.34, (W * 0.95) / Math.max(digits.length, 1))
  ctx.font = `italic 700 ${size}px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive`

  digits.forEach((digit, i) => {
    const x = (W * (i + 0.5)) / digits.length + (rand() - 0.5) * W * 0.03
    const y = H * 0.5 + (rand() - 0.5) * H * 0.07
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((rand() - 0.5) * 0.3)
    ctx.fillText(digit, 0, 0)
    ctx.restore()
  })

  // a shaky underline, as if finger-painted
  ctx.lineWidth = 7
  ctx.beginPath()
  for (let k = 0; k <= 12; k++) {
    const x = W * (0.14 + (0.72 * k) / 12)
    const y = H * 0.5 + size * 0.62 + (rand() - 0.5) * 9
    if (k === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  return toTexture(canvas, false)
}

function pictureUv() {
  let u = uv().x
  let v = uv().y
  for (let i = 0; i < ROTATE_QUARTER_TURNS; i++) [u, v] = [v, u.oneMinus()]
  if (FLIP_U) u = u.oneMinus()
  if (FLIP_V) v = v.oneMinus()
  return vec2(u, v)
}

function firstMesh(node: Object3D | undefined) {
  let found: Mesh | null = null
  node?.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh
  })
  return found as Mesh | null
}

// Swaps the painting's material for one with a hidden layer that shows only
// inside the UV cone, and logs the clue once the player has held the lamp on
// it for a moment.
export function PaintingReveal() {
  const room = useRoom()
  const centre = useRef<Vector3 | null>(null)
  const held = useRef(0)
  const glowBoost = useRef(uniform(tuning.revealGlow))

  useEffect(() => {
    const mesh = reveal ? firstMesh(room.nodes.get(reveal.node)) : null
    if (!mesh) return

    const baseTex = paintBase()
    const hiddenTex = paintHidden(code.split('-'))
    const at = pictureUv()

    const ink = vec3(0.75, 0.55, 1.0) // violet-white
    const amount = texture(hiddenTex, at).r.mul(uvMask()).clamp()

    const material = new MeshStandardNodeMaterial()
    material.name = 'Painting_Reveal'
    material.roughness = 0.9
    material.metalness = 0
    material.colorNode = mix(texture(baseTex, at).rgb, ink, amount)
    // materialEmissive keeps the plain `emissive` colour working, so the
    // interaction highlight can still tint this mesh.
    material.emissiveNode = materialEmissive.add(ink.mul(amount).mul(glowBoost.current))

    const original = mesh.material
    mesh.material = material
    mesh.updateWorldMatrix(true, false)
    mesh.geometry.computeBoundingBox()
    centre.current = (mesh.geometry.boundingBox ?? new Box3())
      .getCenter(new Vector3())
      .applyMatrix4(mesh.matrixWorld)

    return () => {
      mesh.material = original
      centre.current = null
      material.dispose()
      baseTex.dispose()
      hiddenTex.dispose()
    }
  }, [room])

  useFrame((_, delta) => {
    glowBoost.current.value = tuning.revealGlow
    const store = useGame.getState()
    const clue = reveal?.gives[0].replace(/^clue:/, '')
    if (!centre.current || !clue || store.clues.includes(clue)) return
    if (store.paused || store.uiLock !== null) return

    // Same cone test as the shader, at the middle of the code.
    if (uvMaskAt(centre.current) < tuning.clueMaskThreshold) {
      held.current = 0
      return
    }
    held.current += delta
    if (held.current >= tuning.clueHoldSeconds) {
      store.addClue(clue)
      sfx.play('chime')
    }
  })

  return null
}
