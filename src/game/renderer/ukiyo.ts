import { Fn, cameraFar, cameraNear, float, floor, fract, fwidth, luminance, mix, mx_fractal_noise_float, perspectiveDepthToViewZ, pow, screenSize, screenUV, smoothstep, uniform, vec2, vec3 } from 'three/tsl'
import type { Node, TextureNode } from 'three/webgpu'
import { tuning } from '../tuning'

// Woodblock-print look, built from TSL pieces that postprocessing.ts chains
// together. Everything here works on the display-space image except the ink
// edges, which read the scene pass depth.

// Ink and shadow colours, display space.
const INK = vec3(0.035, 0.03, 0.075)
const INDIGO = vec3(0.11, 0.13, 0.3)
const PAPER = vec3(1.0, 0.95, 0.82)

export const ukiyoUniforms = {
  inkWidth: uniform(1),
  inkThreshold: uniform(tuning.inkThreshold),
  inkStrength: uniform(tuning.inkStrength),
  nightGamma: uniform(tuning.nightGamma),
  bands: uniform(tuning.bandCount),
  bandStrength: uniform(tuning.bandStrength),
  indigoLift: uniform(tuning.indigoLift),
  paperStrength: uniform(tuning.paperStrength),
}

// 1 on an ink line, 0 elsewhere. 1/viewZ is linear across a flat surface in
// screen space, so its second difference is ~0 on walls and floors and jumps
// at silhouettes and creases; dividing by the centre value keeps the test the
// same near and far.
export function inkEdge(depth: TextureNode): Node<'float'> {
  const px = vec2(1).div(screenSize).mul(ukiyoUniforms.inkWidth)
  const invZ = (offset: Node<'vec2'>) =>
    float(1).div(perspectiveDepthToViewZ(depth.sample(screenUV.add(offset.mul(px))), cameraNear, cameraFar).negate())

  return Fn(() => {
    const c = invZ(vec2(0, 0))
    const l = invZ(vec2(-1, 0))
    const r = invZ(vec2(1, 0))
    const u = invZ(vec2(0, 1))
    const d = invZ(vec2(0, -1))
    const laplacian = l.add(r).add(u).add(d).sub(c.mul(4)).abs().div(c)
    const t = ukiyoUniforms.inkThreshold
    return smoothstep(t, t.mul(2), laplacian).mul(ukiyoUniforms.inkStrength)
  })()
}

// Brightens the dark end of the image without moving white: a gamma below 1
// on brightness, hue kept. Runs before the bands, which would otherwise snap
// everything under half a band to black.
export function nightLift(rgb: Node<'vec3'>): Node<'vec3'> {
  const lum = luminance(rgb).max(1e-4)
  return rgb.mul(pow(lum, ukiyoUniforms.nightGamma).div(lum))
}

// Shadows lift to indigo instead of black, so ink lines read against them.
export function indigoShadows(rgb: Node<'vec3'>): Node<'vec3'> {
  const lum = luminance(rgb).clamp(0, 1)
  return mix(rgb, mix(INDIGO, rgb, smoothstep(0, 0.5, lum)), ukiyoUniforms.indigoLift)
}

// Snaps brightness to a few flat tones, keeping hue. The step edges are
// anti-aliased with the screen-space derivative of the band value.
export function toneBands(rgb: Node<'vec3'>): Node<'vec3'> {
  const lum = luminance(rgb).max(1e-4)
  const band = lum.mul(ukiyoUniforms.bands)
  const w = fwidth(band).mul(0.75).max(0.02)
  const stepped = floor(band).add(smoothstep(float(0.5).sub(w), float(0.5).add(w), fract(band))).div(ukiyoUniforms.bands)
  return mix(rgb, rgb.mul(stepped.div(lum)), ukiyoUniforms.bandStrength)
}

// Paper fibres, fixed to the screen like the sheet a print is pulled on.
// Darkens a little and warms the highlights.
export function paperGrain(rgb: Node<'vec3'>): Node<'vec3'> {
  const aspect = screenSize.x.div(screenSize.y)
  const coarse = mx_fractal_noise_float(vec3(screenUV.mul(vec2(aspect, 1)).mul(vec2(90, 220)), 0), 3, 2, 0.5)
  const fine = mx_fractal_noise_float(vec3(screenUV.mul(vec2(aspect, 1)).mul(vec2(500, 700)), 3), 2, 2, 0.5)
  const fibre = coarse.mul(0.6).add(fine.mul(0.4)).mul(0.5).add(0.5)
  const lum = luminance(rgb).clamp(0, 1)
  const warm = mix(rgb, rgb.mul(PAPER), smoothstep(0.3, 0.9, lum).mul(0.5))
  return warm.mul(float(1).sub(fibre.mul(ukiyoUniforms.paperStrength)))
}

export function syncUkiyo(pixelRatio: number) {
  ukiyoUniforms.inkWidth.value = tuning.inkWidth * pixelRatio
  ukiyoUniforms.inkThreshold.value = tuning.inkThreshold
  ukiyoUniforms.inkStrength.value = tuning.inkStrength
  ukiyoUniforms.nightGamma.value = tuning.nightGamma
  ukiyoUniforms.bands.value = tuning.bandCount
  ukiyoUniforms.bandStrength.value = tuning.bandStrength
  ukiyoUniforms.indigoLift.value = tuning.indigoLift
  ukiyoUniforms.paperStrength.value = tuning.paperStrength
}

export const inkColor = INK
