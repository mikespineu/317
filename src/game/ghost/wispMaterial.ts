import { AdditiveBlending, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  float,
  mix,
  mx_noise_float,
  normalView,
  positionGeometry,
  positionViewDirection,
  saturate,
  sin,
  smoothstep,
  step,
  uniform,
  vec3,
} from 'three/tsl'
import { tuning } from '../tuning'

// The Wisp mesh: head centre at the origin, tail hanging down to TAIL_Y.
const HEAD_Y = 0.15
const TAIL_Y = -0.35

export function createWispMaterial() {
  const uniforms = {
    time: uniform(0), // own clock, so the wobble stops with the game
    exposure: uniform(0),
    dissolve: uniform(0),
    glow: uniform(tuning.wispGlow),
    exposureGlow: uniform(tuning.wispExposureGlow),
  }
  const t = uniforms.time

  // The mesh has no UVs, so everything is driven by the undisplaced local position.
  const p = positionGeometry
  // 0 at the head, 1 at the tip of the tail.
  const tail = saturate(float(HEAD_Y).sub(p.y).div(HEAD_Y - TAIL_Y))
  const sway = tail.mul(tail)

  // Wobble: a slow whole-body breath plus a travelling wave that grows down the tail.
  const waveX = sin(t.mul(2.1).add(p.y.mul(9)))
    .mul(0.07)
    .mul(sway)
    .add(sin(t.mul(1.3).add(p.y.mul(5)).add(1.7)).mul(0.012))
  const waveZ = sin(t.mul(1.7).add(p.y.mul(8)).add(0.9))
    .mul(0.06)
    .mul(sway)
  const breath = sin(t.mul(2.6)).mul(0.03).add(1)

  // Rim glow where the surface turns away from the eye, soft core where it faces it.
  const facing = saturate(normalView.dot(positionViewDirection).abs())
  const rim = facing.oneMinus().pow(2)
  const core = facing.pow(3)

  const base = vec3(0.5, 1.0, 0.8) // pale cyan-green
  const brightness = uniforms.glow.add(uniforms.exposure.mul(uniforms.exposureGlow))
  const body = mix(base, vec3(0.9, 1.0, 0.95), core.mul(0.6))
    .mul(rim.mul(1.3).add(core.mul(0.55)).add(0.12))
    .mul(mix(1, 0.45, tail)) // the tail trails off
    .mul(brightness)

  // Dissolve: a noise threshold sweeps through the body, glowing where it cuts.
  const noise = saturate(
    mx_noise_float(p.mul(11).add(vec3(0, t.mul(0.4), 0)))
      .mul(0.9)
      .add(0.5),
  )
  const cut = mix(-0.1, 1.05, uniforms.dissolve)
  const alive = step(cut, noise)
  const edge = smoothstep(cut, cut.add(0.1), noise).oneMinus().mul(step(0.001, uniforms.dissolve))

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  material.positionNode = vec3(p.x.mul(breath).add(waveX), p.y, p.z.mul(breath).add(waveZ))
  material.colorNode = body.add(vec3(0.8, 1.0, 0.9).mul(edge).mul(3))
  material.opacityNode = alive
  material.fog = false

  return { material, uniforms }
}

export type WispMaterial = ReturnType<typeof createWispMaterial>
