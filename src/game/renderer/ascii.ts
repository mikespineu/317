import { Fn, abs, clamp, float, floor, fract, luminance, max, mix, pow, screenSize, screenUV, texture, uniform, vec2, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { tuning } from '../tuning'

// The ASCII look: the picture is cut into character cells, each cell is
// sampled once, ordered-dithered (4x4 Bayer) and drawn as the glyph from a
// brightness ramp whose density matches. Colour is kept, posterised with the
// same dither. Built from a glyph atlas drawn on a canvas at start-up.

const RAMP = ' .:-=+*#%@'
const GLYPH_W = 16
const GLYPH_H = 32
// Strengths live in `tuning` (asciiX keys, in the debug panel's post group).
export const asciiUniforms = {
  cell: uniform(new THREE.Vector2(6, 12)), // device px
  gamma: uniform(tuning.asciiGamma),
  exposure: uniform(tuning.asciiExposure),
  dither: uniform(tuning.asciiDither),
  colorLevels: uniform(tuning.asciiColorLevels),
  background: uniform(tuning.asciiBackground),
  glyphMin: uniform(tuning.asciiGlyphMin),
}

export function syncAscii(pixelRatio: number) {
  const U = asciiUniforms
  U.cell.value.set(tuning.asciiCellWidth * pixelRatio, tuning.asciiCellHeight * pixelRatio)
  U.gamma.value = tuning.asciiGamma
  U.exposure.value = tuning.asciiExposure
  U.dither.value = tuning.asciiDither
  U.colorLevels.value = tuning.asciiColorLevels
  U.background.value = tuning.asciiBackground
  U.glyphMin.value = tuning.asciiGlyphMin
}

export function createGlyphAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = GLYPH_W * RAMP.length
  canvas.height = GLYPH_H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${GLYPH_H * 0.8}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < RAMP.length; i++) {
    ctx.fillText(RAMP[i], GLYPH_W * (i + 0.5), GLYPH_H * 0.55)
  }
  const atlas = new THREE.CanvasTexture(canvas)
  atlas.minFilter = THREE.LinearFilter
  atlas.magFilter = THREE.LinearFilter
  atlas.generateMipmaps = false
  return atlas
}

// 4x4 Bayer threshold in (0, 1) for an integer cell position. A 2x2 matrix is
// 2 * (x xor y) + y; the 4x4 nests one inside another. x xor y on 0/1 values
// is |x - y|.
function bayer4(p: Node<'vec2'>): Node<'float'> {
  const m2 = (q: Node<'vec2'>) => abs(q.x.sub(q.y)).mul(2).add(q.y)
  const fine = vec2(p.x.mod(2), p.y.mod(2))
  const coarse = vec2(floor(p.x.div(2)).mod(2), floor(p.y.div(2)).mod(2))
  return m2(fine).mul(4).add(m2(coarse)).add(0.5).div(16)
}

// `hdr` is sampled at a given uv so every pixel of a cell reads the cell's
// centre; it returns the display-space colour.
export function asciiImage(atlas: THREE.Texture, display: (uv: Node<'vec2'>) => Node<'vec3'>): Node<'vec3'> {
  const levels = float(RAMP.length)
  const glyphs = texture(atlas)
  return Fn(() => {
    const cellSize = asciiUniforms.cell
    const px = screenUV.mul(screenSize)
    const cell = floor(px.div(cellSize))
    const local = fract(px.div(cellSize))
    const centre = cell.add(0.5).mul(cellSize).div(screenSize)

    const U = asciiUniforms
    // Exposure and a gamma below 1 lift the dark end, hue kept.
    const shown = display(centre).mul(U.exposure).clamp(0, 1)
    const raw = luminance(shown).max(1e-4)
    const lum = pow(raw, U.gamma)
    const rgb = shown.mul(lum.div(raw)).clamp(0, 1)
    const threshold = bayer4(cell).sub(0.5).mul(U.dither)

    // Dithered brightness picks the glyph; the same threshold dithers colour
    // down to four levels per channel.
    const dithered = clamp(lum.add(threshold.div(levels.sub(1))), 0, 1)
    const index = floor(dithered.mul(levels.sub(1)).add(0.5))
    const ink = glyphs.sample(vec2(index.add(local.x).div(levels), local.y)).r

    const steps = U.colorLevels.sub(1).max(1)
    const poster = floor(rgb.mul(steps).add(threshold.add(0.5))).div(steps).clamp(0, 1)
    const hue = poster.div(max(max(poster.x, poster.y), max(poster.z, 0.15)))
    const fg = hue.mul(mix(U.glyphMin, 1, dithered))
    const bg = vec3(0.02, 0.025, 0.04).add(poster.mul(U.background))
    return mix(bg, fg, ink)
  })()
}
