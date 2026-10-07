import { Fn, cameraFar, cameraNear, float, floor, fract, fwidth, luminance, mix, mx_fractal_noise_float, perspectiveDepthToViewZ, pow, screenSize, screenUV, sin, smoothstep, uniform, vec2, vec3 } from 'three/tsl'
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
  inkWobble: uniform(tuning.inkWobble),
  inkPressure: uniform(tuning.inkPressure),
  inkCrease: uniform(tuning.inkCrease),
  inkNear: uniform(tuning.inkNear),
  pixelRatio: uniform(1),
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
//
// The line is drawn by hand rather than ruled: it wanders a little off the
// true edge (wobble), swells and thins along its length like a pen pressed
// harder and lighter (pressure), is heavier on things close to the eye, and
// creases inside a shape are thinner and fainter than its outline, breaking
// where the pen lifts.
export function inkEdge(depth: TextureNode): Node<'float'> {
  const U = ukiyoUniforms
  const texel = vec2(1).div(screenSize)
  const invZAt = (uv: Node<'vec2'>) =>
    float(1).div(perspectiveDepthToViewZ(depth.sample(uv), cameraNear, cameraFar).negate())

  return Fn(() => {
    // Screen position in CSS px, so the hand looks the same at any pixel ratio.
    const p = screenUV.mul(screenSize).div(U.pixelRatio)
    // Cheap smooth noise from nested sines: a slow drift for the wobble and
    // the pressure, no texture and no hash.
    const drift = vec2(
      sin(p.y.mul(0.071).add(sin(p.x.mul(0.043)).mul(2.1))),
      sin(p.x.mul(0.063).add(sin(p.y.mul(0.037)).mul(2.3)).add(1.7)),
    )
    const pressure = sin(p.x.mul(0.021).add(p.y.mul(0.027)).add(drift.x.mul(1.3))).mul(0.5).add(0.5)

    const centre = screenUV.add(drift.mul(U.inkWobble).mul(U.pixelRatio).mul(texel))
    const c = invZAt(centre)
    // Nearer than about a metre the line is at its heaviest; by 6 m it is a hairline.
    const near = smoothstep(1 / 6, 1, c)
    const weight = float(1)
      .add(pressure.sub(0.5).mul(2).mul(U.inkPressure))
      .mul(mix(float(1).sub(U.inkNear.mul(0.5)), float(1).add(U.inkNear), near))
    const px = texel.mul(U.inkWidth).mul(weight.max(0.35))
    const tap = (x: number, y: number) => invZAt(centre.add(vec2(x, y).mul(px)))

    const laplacian = tap(-1, 0).add(tap(1, 0)).add(tap(0, 1)).add(tap(0, -1)).sub(c.mul(4)).abs().div(c)
    const t = U.inkThreshold
    const line = smoothstep(t, t.mul(2), laplacian)
    // A depth jump (an outline) is many times the threshold; a crease is just over it.
    const outline = smoothstep(t.mul(4), t.mul(12), laplacian)
    // The pen lifts on creases where the pressure is lowest.
    const lifted = smoothstep(0.12, 0.3, pressure)
    const crease = U.inkCrease.mul(lifted)
    return line.mul(mix(crease, 1, outline)).mul(U.inkStrength)
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
  ukiyoUniforms.inkWobble.value = tuning.inkWobble
  ukiyoUniforms.inkPressure.value = tuning.inkPressure
  ukiyoUniforms.inkCrease.value = tuning.inkCrease
  ukiyoUniforms.inkNear.value = tuning.inkNear
  ukiyoUniforms.pixelRatio.value = pixelRatio
  ukiyoUniforms.nightGamma.value = tuning.nightGamma
  ukiyoUniforms.bands.value = tuning.bandCount
  ukiyoUniforms.bandStrength.value = tuning.bandStrength
  ukiyoUniforms.indigoLift.value = tuning.indigoLift
  ukiyoUniforms.paperStrength.value = tuning.paperStrength
}

export const inkColor = INK
