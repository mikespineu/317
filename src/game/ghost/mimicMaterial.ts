import { DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  cameraPosition,
  mix,
  mx_noise_float,
  normalWorld,
  normalize,
  positionGeometry,
  positionWorld,
  saturate,
  smoothstep,
  step,
  uniform,
  vec3,
} from 'three/tsl'
import { tuning } from '../tuning'

// The Mimic's true shape: a rigid book-thing in the ghost palette, self-lit so
// it can be found in the dark, with a rim of ghost green and the same noise
// dissolve as the Wisp's sheet.
export function createMimicMaterial() {
  const uniforms = {
    time: uniform(0),
    exposure: uniform(0),
    dissolve: uniform(0),
    glow: uniform(tuning.wispGlow),
    exposureGlow: uniform(tuning.wispExposureGlow),
  }

  const view = normalize(cameraPosition.sub(positionWorld))
  const facing = saturate(normalWorld.dot(view))
  const rim = facing.oneMinus().pow(3)
  const key = normalize(vec3(0.3, 1.0, 0.4))
  const lit = normalWorld.dot(key).mul(0.5).add(0.5)
  const brightness = uniforms.glow.add(uniforms.exposure.mul(uniforms.exposureGlow)).mul(1.6)
  const body = mix(vec3(0.25, 0.5, 0.46), vec3(0.85, 1.0, 0.92), lit.mul(lit))
    .add(vec3(0.45, 1.0, 0.8).mul(rim).mul(0.35))
    .mul(brightness)

  const p = positionGeometry
  const noise = saturate(
    mx_noise_float(p.mul(9).add(vec3(0, uniforms.time.mul(0.4), 0)))
      .mul(0.9)
      .add(0.5),
  )
  const cut = mix(-0.1, 1.05, uniforms.dissolve)
  const alive = step(cut, noise)
  const edge = smoothstep(cut, cut.add(0.1), noise).oneMinus().mul(step(0.001, uniforms.dissolve))

  const material = new MeshBasicNodeMaterial({ transparent: true, side: DoubleSide, alphaTest: 0.05 })
  material.colorNode = body.add(vec3(0.8, 1.0, 0.9).mul(edge).mul(3))
  material.opacityNode = alive.mul(0.95)
  material.fog = false
  return { material, uniforms }
}

export type MimicMaterial = ReturnType<typeof createMimicMaterial>
