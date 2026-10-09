import { CanvasTexture } from 'three/webgpu'
import type { UvTextDef } from '../room/roomDef'

// Stand-in art for the Library's UV ink, drawn on canvases the same shape as
// the planes in level-2.glb. White on black: only the red channel is read.
// The pictures are upright as seen from the front of each plane (glTF
// convention, so flipY stays off). Replace with PNGs under
// /textures/level2/ when they exist; the plane sizes are in the Blender spec.

// Small seeded generator so the ink looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasOf(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  return { canvas, ctx }
}

const BRUSH = 'italic 700 {px}px "Bradley Hand", "Segoe Print", "Snell Roundhand", "Comic Sans MS", cursive'

// 1.6 x 0.4 m: one loose line of brush lettering, shrunk to fit.
function paintMessage(text: string) {
  const { canvas, ctx } = canvasOf(1024, 256)
  const rand = rng(317)
  let px = 84
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = BRUSH.replace('{px}', String(px))
  while (ctx.measureText(text).width > canvas.width * 0.94 && px > 20) {
    px -= 4
    ctx.font = BRUSH.replace('{px}', String(px))
  }
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 8
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  // Flecks knocked out of the ink, as if it had dried unevenly.
  ctx.shadowBlur = 0
  ctx.fillStyle = '#000'
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.5
    ctx.fillRect(rand() * canvas.width, rand() * canvas.height, 2 + rand() * 5, 1 + rand() * 2)
  }
  ctx.globalAlpha = 1
  return canvas
}

// 0.12 x 0.16 m: an open hand, fingers spread, palm clear. Drawn grey so the
// digit inside the palm (white) stands out against it.
function paintHand() {
  const { canvas, ctx } = canvasOf(192, 256)
  ctx.fillStyle = '#8c8c8c'
  ctx.strokeStyle = '#8c8c8c'
  ctx.lineCap = 'round'
  ctx.shadowColor = '#8c8c8c'
  ctx.shadowBlur = 6
  ctx.lineWidth = 24
  const fingers: [number, number, number, number][] = [
    [62, 122, 46, 44], // little
    [84, 112, 76, 20], // ring
    [108, 110, 110, 14], // middle
    [130, 120, 146, 38], // index
    [150, 168, 182, 128], // thumb
  ]
  for (const [x1, y1, x2, y2] of fingers) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(100, 176, 62, 66, 0, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

// 0.07 x 0.12 m: one bold digit.
function paintDigit(digit: string) {
  const { canvas, ctx } = canvasOf(140, 240)
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 6
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 210px Georgia, "Times New Roman", serif'
  ctx.fillText(digit, canvas.width / 2, canvas.height / 2 + 8)
  return canvas
}

// One texture per distinct picture; the caller disposes it.
export function makeInkTexture(entry: UvTextDef, text: string): CanvasTexture {
  const canvas =
    entry.art === 'message'
      ? paintMessage(text)
      : entry.art === 'hand'
        ? paintHand()
        : paintDigit(entry.digit ?? '?')
  const tex = new CanvasTexture(canvas)
  tex.flipY = false
  tex.anisotropy = 4
  return tex
}
