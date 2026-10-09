import { DoubleSide, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  atan,
  cameraPosition,
  cos,
  cross,
  faceDirection,
  float,
  length,
  min,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  normalGeometry,
  normalize,
  positionGeometry,
  positionWorld,
  saturate,
  sign,
  sin,
  smoothstep,
  step,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { uvMask } from '../light/uvReveal'
import { tuning } from '../tuning'

type V3 = Node<'vec3'>

// The Wisp mesh is a smooth bell: a round head (centre at the origin) and a
// plain drape hanging to the hem. Everything that makes it a sheet thrown
// over a figure happens here: the raised arms, the folds, an uneven hem,
// flutter, and the cloth trailing behind the head.
export const DRAPE = 0.5 // metres from the head centre down to the hem
// The cloth is stretched tight over the head: nothing moves above this depth
// below the head centre, so the face keeps its shape while the sheet swings.
const TAUT = 0.09

// Step used to find the surface normal after the cloth has been shaped.
const EPS = 0.003

// `uvOnly` is the Ink Ghost: it exists only inside the UV cone, fading in at its edge.
export function createWispMaterial(options: { uvOnly?: boolean } = {}) {
  const uniforms = {
    time: uniform(0), // own clock, so the cloth stops with the game
    exposure: uniform(0),
    dissolve: uniform(0),
    glow: uniform(tuning.wispGlow),
    exposureGlow: uniform(tuning.wispExposureGlow),
    opacity: uniform(tuning.sheetOpacity),
    foldDepth: uniform(tuning.sheetFoldDepth),
    armReach: uniform(tuning.sheetArmReach),
    armLift: uniform(tuning.sheetArmLift),
    press: uniform(tuning.sheetPress),
    flutter: uniform(0), // radial ripple amplitude, grows with speed
    billow: uniform(0), // extra flare of the skirt, + out / - in
    // Where the cloth hangs relative to the head, in the mesh's local space,
    // a third, two thirds and all the way down the drape (see sheetCloth.ts).
    lag1: uniform(new Vector3()),
    lag2: uniform(new Vector3()),
    lag3: uniform(new Vector3()),
  }
  const t = uniforms.time

  // Per-point terms that both the shape and the shading need. The mesh has no
  // UVs, so everything is driven by the undisplaced local position.
  const terms = (q: V3) => {
    // 0 on the head, 1 at the hem.
    const w = saturate(q.y.negate().sub(TAUT).div(DRAPE - TAUT))
    // Angle around the body. Every multiplier of theta below is a whole
    // number, so nothing breaks at the seam where the angle wraps.
    const theta = atan(q.z, q.x)
    // Folds: a few deep pleats, a finer set that drifts slowly, and small
    // wrinkles. Each set leans a different way down the cloth, so the pleats
    // wander instead of running dead straight.
    const fold = cos(theta.mul(7).add(1.3).add(sin(q.y.mul(9)).mul(0.5)))
      .mul(0.55)
      .add(cos(theta.mul(12).add(t.mul(0.35)).add(4.1).sub(q.y.mul(5))).mul(0.3))
      .add(cos(theta.mul(23).add(2.4).add(sin(q.y.mul(17).add(1)).mul(0.9))).mul(0.15))
    // The arms: two narrow lobes, out to the sides (local +X and -X).
    const c = cos(theta)
    const arm = c.mul(c).pow(7)
    return { w, theta, fold, arm }
  }

  // Shapes the plain bell into the sheet.
  const shape = (q: V3) => {
    const { w, theta, fold, arm } = terms(q)
    const w2 = w.mul(w)
    const ripple = sin(theta.mul(3).sub(t.mul(5.5)).add(q.y.mul(11)))
    // The cloth runs out along each arm, then hangs from it, a little slack.
    const sleeve = smoothstep(0.08, 0.4, w).mul(smoothstep(0.4, 1, w).mul(0.3).oneMinus())
    const flare = w
      .pow(1.5)
      .mul(fold.mul(uniforms.foldDepth).mul(arm.mul(0.6).oneMinus()).add(uniforms.billow))
      .add(ripple.mul(w2).mul(uniforms.flutter))
      .add(arm.mul(sleeve).mul(uniforms.armReach))
      .add(1)
    // Draped over a raised arm, everything below it is lifted. The hem is
    // uneven besides, so the bottom edge is not a perfect circle.
    const lift = arm.mul(smoothstep(0.12, 0.42, w)).mul(uniforms.armLift)
    const hem = w2.mul(w).mul(0.035).mul(cos(theta.mul(5).add(2)))
    // The cloth trails the head: a smooth curve through the three lag points.
    const lag = uniforms.lag1
      .mul(smoothstep(0, 0.45, w))
      .add(uniforms.lag2.sub(uniforms.lag1).mul(smoothstep(0.2, 0.8, w)))
      .add(uniforms.lag3.sub(uniforms.lag2).mul(smoothstep(0.55, 1, w)))
    // There is a figure under the sheet. The side that trails streams out
    // freely; the side that leads is pressed against the body and barely
    // moves. Shifting the whole ring instead would carry the back of the
    // skirt through the body and out past the front.
    const drift = vec2(lag.x, lag.z)
    const around = vec2(q.x, q.z).div(length(vec2(q.x, q.z)).add(1e-5))
    const trailing = around.dot(drift.div(length(drift).add(1e-5))).mul(0.5).add(0.5)
    const give = mix(uniforms.press, float(1), smoothstep(0, 1, trailing))
    return vec3(
      q.x.mul(flare).add(lag.x.mul(give)),
      q.y.add(hem).add(lift).add(lag.y),
      q.z.mul(flare).add(lag.z.mul(give)),
    )
  }

  const p = positionGeometry
  const shaped = shape(p)

  // The mesh's own normals describe the plain bell. Shape two neighbours on
  // the surface as well and take the normal of the cloth as it really lies.
  const n = normalGeometry
  const around = normalize(cross(vec3(0, 1, 0), n).add(vec3(1e-4, 0, 0)))
  const along = cross(n, around)
  const shapedNormal = normalize(
    cross(
      shape(p.add(around.mul(EPS))).sub(shaped),
      shape(p.add(along.mul(EPS))).sub(shaped),
    ),
  )
  // On the head nothing was reshaped, so the mesh's own normal is exact (and
  // free of the noise the two-neighbour trick has at the very top).
  const outward = mix(
    n,
    shapedNormal.mul(sign(shapedNormal.dot(n).add(1e-4))),
    smoothstep(0, 0.08, terms(p).w),
  )
  const normal = normalize(modelWorldMatrix.mul(vec4(outward, 0)).xyz)
    .toVarying('vSheetNormal')
    .normalize()
    .mul(faceDirection)

  // Shading: matte white linen under a soft light from above and in front of
  // the ghost. It is self-lit, so it can be found in the dark.
  const { w, fold, arm } = terms(p)
  const view = normalize(cameraPosition.sub(positionWorld))
  const facing = saturate(normal.dot(view))
  const key = normalize(view.add(vec3(0.25, 1.1, 0.15)))
  const lit = normal.dot(key).mul(0.5).add(0.5) // half-Lambert, no hard terminator
  const crease = saturate(fold.negate()).mul(w).mul(arm.oneMinus()).mul(0.5).oneMinus()
  const inside = faceDirection.mul(0.3).add(0.7) // the lining is in shadow
  const rim = facing.oneMinus().pow(3)
  const brightness = uniforms.glow.add(uniforms.exposure.mul(uniforms.exposureGlow))
  const cloth = mix(vec3(0.34, 0.5, 0.5), vec3(0.95, 0.98, 0.95), lit.mul(lit)) // cool shadows
    .mul(crease)
    .mul(inside)
    .add(vec3(0.45, 1.0, 0.8).mul(rim).mul(0.18)) // a breath of ghost green on the edges
    .mul(brightness)

  // Two tall oval eye holes on the front (+Z) of the head, leaning together.
  const eyeAt = (side: number) => {
    const dy = p.y.sub(0.012)
    const dx = p.x.sub(0.043 * side).add(dy.mul(0.22 * side))
    return dx.div(0.024).pow(2).add(dy.div(0.042).pow(2))
  }
  const eye = smoothstep(0.75, 1.0, min(eyeAt(-1), eyeAt(1)))
    .oneMinus()
    .mul(step(0, p.z))

  // Dissolve: a noise threshold sweeps through the cloth, glowing where it cuts.
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
    side: DoubleSide,
    // Cut pixels must not write depth, or the dissolve would hide the room.
    alphaTest: 0.05,
  })
  material.positionNode = shaped
  material.colorNode = mix(cloth, vec3(0.004, 0.006, 0.006), eye).add(
    vec3(0.8, 1.0, 0.9).mul(edge).mul(3),
  )
  // Slightly sheer toward the hem; the eyes are solid dark.
  const sheer = mix(uniforms.opacity, uniforms.opacity.mul(0.7), w.mul(w).mul(w))
  const seen = options.uvOnly ? smoothstep(tuning.inkFadeStart, tuning.inkFadeEnd, uvMask()) : float(1)
  material.opacityNode = alive.mul(mix(sheer, float(1), eye)).mul(seen)
  material.fog = false

  return { material, uniforms }
}

export type WispMaterial = ReturnType<typeof createWispMaterial>
