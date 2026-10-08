import { useEffect } from 'react'
import { CanvasTexture, MeshStandardNodeMaterial, SRGBColorSpace } from 'three/webgpu'
import type { Material, Mesh, Object3D } from 'three/webgpu'
import { texture, uv, vec2 } from 'three/tsl'
import { SYMBOL_BOX, SYMBOLS } from '../puzzle/symbols'
import { useRoomDef } from './RoomContext'
import { useRoom } from './RoomScene'
import type { BoundRoom } from './bindNodes'
import type { RoomDef } from './roomDef'

// --- Picture orientation on the canvas plane ------------------------------
// The stand-ins are drawn upright on 2D canvases and uploaded with
// flipY = false (the glTF convention: uv (0,0) is the image's top-left).
// level-1.glb maps each Portrait_N_Canvas with u 0..1 along +Z and v 0..1 from
// the top down. The canvases hang on the east wall facing -X, and for someone
// facing east +Z is to the right, so the picture is already upright and the
// right way round: no flips. If a symbol shows mirrored (the crescent should
// open to the right) or upside down, fix it here.
const FLIP_U = false
const FLIP_V = false
// ---------------------------------------------------------------------------

const CANVAS_NODE = /^Portrait_(\d+)_Canvas$/
const TEX_W = 384
const TEX_H = 526 // same aspect as the 0.54 x 0.74 m canvas

// Ground and sitter per portrait, all from the room's muted night palette.
const GROUNDS = [
  { ground: '#2c3a52', shade: '#161c30', sitter: '#1b2138' }, // indigo
  { ground: '#4a3340', shade: '#21151f', sitter: '#2a1a26' }, // plum
  { ground: '#3a4a3c', shade: '#18201b', sitter: '#1f2a22' }, // moss
]
const INK = '#0d0c1f'
const PAPER = '#efe4c6'

// Small seeded generator so a portrait looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A stand-in until the paintings exist: a dim period portrait (ground, the
// sitter as a dark bust) with the sitter's symbol printed large across it,
// big enough to read from the far side of the hall under the flashlight.
function paintPortrait(index: number, symbol: string) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!
  const W = TEX_W
  const H = TEX_H
  const rand = rng(1869 + index * 31)
  const tone = GROUNDS[(index - 1 + GROUNDS.length * 8) % GROUNDS.length]

  ctx.fillStyle = tone.ground
  ctx.fillRect(0, 0, W, H)

  // the sitter: head and shoulders, barely darker than the ground
  ctx.fillStyle = tone.sitter
  ctx.beginPath()
  ctx.ellipse(W * 0.5, H * 0.3, W * 0.17, H * 0.15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(W * 0.06, H)
  ctx.bezierCurveTo(W * 0.1, H * 0.56, W * 0.34, H * 0.52, W * 0.42, H * 0.42)
  ctx.lineTo(W * 0.58, H * 0.42)
  ctx.bezierCurveTo(W * 0.66, H * 0.52, W * 0.9, H * 0.56, W * 0.94, H)
  ctx.fill()

  // brush strokes: short dabs, lighter and darker
  for (let i = 0; i < 500; i++) {
    const x = rand() * W
    const y = rand() * H
    const len = 8 + rand() * 22
    const angle = (rand() - 0.5) * 0.9
    ctx.strokeStyle =
      rand() > 0.5
        ? `rgba(220, 210, 180, ${0.02 + rand() * 0.04})`
        : `rgba(10, 8, 16, ${0.03 + rand() * 0.07})`
    ctx.lineWidth = 2 + rand() * 4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }

  // aged varnish: darker toward the edges
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.7)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, tone.shade)
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  // the symbol, printed like a seal: paper colour with a hard ink offset
  const size = W * 0.8
  const scale = size / SYMBOL_BOX
  const shape = new Path2D(SYMBOLS[symbol].path)
  ctx.translate((W - size) / 2, H * 0.56 - size / 2)
  ctx.scale(scale, scale)
  ctx.save()
  ctx.translate(0.7, 0.7)
  ctx.fillStyle = INK
  ctx.fill(shape, 'evenodd')
  ctx.restore()
  ctx.fillStyle = PAPER
  ctx.fill(shape, 'evenodd')

  const map = new CanvasTexture(canvas)
  map.flipY = false
  map.colorSpace = SRGBColorSpace
  map.anisotropy = 4
  return map
}

function pictureUv() {
  const u = FLIP_U ? uv().x.oneMinus() : uv().x
  const v = FLIP_V ? uv().y.oneMinus() : uv().y
  return vec2(u, v)
}

function firstMesh(node: Object3D) {
  let found: Mesh | null = null
  node.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh
  })
  return found as Mesh | null
}

interface Sitter {
  index: number
  node: Object3D
  symbol: string
  year: number | null
}

function sitters(room: BoundRoom): Sitter[] {
  const found: Sitter[] = []
  for (const [name, node] of room.nodes) {
    const match = CANVAS_NODE.exec(name)
    const symbol = node.userData.symbol
    if (!match || typeof symbol !== 'string') continue
    const year = typeof node.userData.birth_year === 'number' ? node.userData.birth_year : null
    found.push({ index: Number(match[1]), node, symbol, year })
  }
  return found.sort((a, b) => a.index - b.index)
}

// The definition is the source of truth; the .glb's extras are only checked
// against it: each plaque's year, and eldest first giving the lock's code.
function checkAgainstDef(found: Sitter[], def: RoomDef) {
  for (const s of found) {
    const plaque = def.interactables.find((i) => i.node === `Portrait_${s.index}_Plaque`)
    const year = Number(/\b(\d{4})\b/.exec(plaque?.line?.en ?? '')?.[1])
    if (s.year === null || year !== s.year)
      console.warn(
        `[portraits] Portrait_${s.index}: birth_year ${s.year} in the .glb, ` +
          `"${plaque?.line?.en ?? 'no plaque line'}" in the definition`,
      )
  }
  const lock = def.interactables.flatMap((i) => (i.lock?.type === 'symbol' ? [i.lock] : []))[0]
  if (!lock) return
  const eldestFirst = [...found].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((s) => s.symbol)
  if (eldestFirst.join() !== lock.code.join())
    console.warn(
      `[portraits] eldest first reads ${eldestFirst.join(', ')}, ` +
        `but the lock's code is ${lock.code.join(', ')}`,
    )
}

// Paints a stand-in on every Portrait_N_Canvas that carries a symbol in its
// glTF extras. Renders nothing, and does nothing in rooms without portraits.
export function Portraits() {
  const room = useRoom()
  const def = useRoomDef()

  useEffect(() => {
    const found = sitters(room)
    if (found.length === 0) return
    if (import.meta.env.DEV) checkAgainstDef(found, def)

    const undo: (() => void)[] = []
    for (const s of found) {
      const mesh = firstMesh(s.node)
      if (!mesh) continue
      if (!SYMBOLS[s.symbol]) {
        if (import.meta.env.DEV) console.warn(`[portraits] unknown symbol "${s.symbol}" on ${s.node.name}`)
        continue
      }
      const map = paintPortrait(s.index, s.symbol)
      const material = new MeshStandardNodeMaterial()
      material.name = `Portrait_${s.index}_StandIn`
      material.roughness = 0.9
      material.metalness = 0
      material.colorNode = texture(map, pictureUv()).rgb

      const original: Material | Material[] = mesh.material
      mesh.material = material
      undo.push(() => {
        mesh.material = original
        material.dispose()
        map.dispose()
      })
    }
    return () => undo.forEach((fn) => fn())
  }, [room, def])

  return null
}
