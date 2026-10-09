import { CatmullRomCurve3, Raycaster, Vector3 } from 'three/webgpu'
import type { Mesh } from 'three/webgpu'
import { uvMaskAt } from '../light/uvReveal'
import type { GhostDef } from '../room/roomDef'
import { currentRoom } from '../room/rooms'
import type { WispState } from '../runtime'
import type { LightMode } from '../store'
import { tuning } from '../tuning'

// The Wisp's behaviour as plain data plus a step function; no React, no scene
// graph. Wisp.tsx owns the mesh and copies the results across each frame.

export interface Beam {
  origin: Vector3
  dir: Vector3
  cos: number
  range: number
  strength: number
  mode: LightMode
}

export interface WispBrain {
  state: WispState
  position: Vector3 // logical centre; what the camera scores
  offset: Vector3 // tremble on top of it, for display only
  speed: number // m/s
  exposure: number // 0..1
  dissolve: number // 0..1 while dissolving
  lit: number // beam strength on the Wisp this frame, 0 when unlit
  litTime: number // seconds continuously in the white beam
  timer: number // seconds left in freeze / flee
  fleeDir: Vector3
  path: number // position along the wander path
  clock: number // seconds simulated
  phase: number[] // per-Wisp offsets so two Wisps would not move alike
  zone: GhostDef['zone'] | null // wander box from the definition; null = the room
  // The Ink Ghost follows a closed route instead of wandering a box, is seen
  // and slowed by the UV lamp instead of the white light, and never flees.
  route: { curve: CatmullRomCurve3; points: Vector3[]; t: number; dwell: number } | null
}

export interface BrainContext {
  beam: Beam
  player: Vector3
  occluders: Mesh[]
}

const _to = new Vector3()
const _prev = new Vector3()
const _target = new Vector3()
const _raycaster = new Raycaster()

// Strength of the white beam on a point: 0 outside the cone, out of range,
// in UV mode, with the light off, or when scenery is in the way.
export function beamOn(point: Vector3, beam: Beam, occluders: Mesh[]): number {
  if (beam.mode !== 'white' || beam.strength <= 0) return 0
  _to.subVectors(point, beam.origin)
  const dist = _to.length()
  if (dist > beam.range) return 0
  if (dist > 1e-4) {
    _to.divideScalar(dist)
    if (_to.dot(beam.dir) < beam.cos) return 0
  }
  return blocked(beam.origin, point, occluders) ? 0 : beam.strength
}

// Line of sight between two points against the room's solid scenery.
export function blocked(from: Vector3, to: Vector3, occluders: Mesh[]): boolean {
  _to.subVectors(to, from)
  const dist = _to.length()
  if (dist < 0.1) return false
  _raycaster.set(from, _to.divideScalar(dist))
  _raycaster.near = 0
  _raycaster.far = dist - 0.05
  return _raycaster.intersectObjects(occluders, false).length > 0
}

// `seed` shifts the noise so Wisps sharing a room do not drift in step; 0
// leaves the path as it always was.
export function createBrain(
  spawn: Vector3,
  zone: GhostDef['zone'] | null = null,
  seed = 0,
  route: readonly Vector3[] | null = null,
): WispBrain {
  return {
    state: 'wander',
    position: spawn.clone(),
    offset: new Vector3(),
    speed: 0,
    exposure: 0,
    dissolve: 0,
    lit: 0,
    litTime: 0,
    timer: 0,
    fleeDir: new Vector3(1, 0, 0),
    path: 0,
    clock: 0,
    phase: [0.3, 2.1, 4.4, 1.2, 5.6, 3.3, 0.9, 2.7, 4.9].map(
      (p, i) => p + seed * (1.7 + i * 0.61),
    ),
    zone,
    route:
      route && route.length > 2
        ? {
            points: route.map((p) => p.clone()),
            curve: new CatmullRomCurve3(route.map((p) => p.clone()), true, 'centripetal'),
            t: 0,
            dwell: 0,
          }
        : null,
  }
}

// Whether a good photograph taken now would dissolve it.
export function isCatchable(brain: WispBrain) {
  if (brain.route) return brain.state === 'wander' && brain.exposure >= tuning.inkCatchExposure
  return brain.state === 'freeze'
}

// A closed loop through the waypoints at a steady pace, resting at each one
// (it is handling a book). UV slows it. Parameter t runs 0..1 around the loop
// with waypoint i at i/n, so the pace is set per segment from its length.
function followRoute(brain: WispBrain, route: NonNullable<WispBrain['route']>, dt: number) {
  const n = route.points.length
  if (route.dwell > 0) {
    route.dwell -= dt
    return
  }
  const i = Math.floor(route.t * n) % n
  const length = Math.max(0.1, route.points[i].distanceTo(route.points[(i + 1) % n]))
  const speed = tuning.inkSpeed * (1 - (1 - tuning.inkSlow) * brain.exposure)
  route.t += (speed * dt) / (length * n)
  if (route.t >= 1) route.t -= 1
  if (Math.floor(route.t * n) !== i) {
    // Reached the next waypoint: stop on it.
    route.t = ((i + 1) % n) / n
    route.dwell = tuning.inkDwell
  }
  route.curve.getPoint(route.t, brain.position)
  brain.position.y += Math.sin(brain.clock * 1.3) * tuning.wispBob
}

// Called by Wisp.tsx when a good enough photo of the frozen Wisp was taken.
export function startDissolve(brain: WispBrain) {
  if (brain.state === 'dissolve' || brain.state === 'gone') return
  brain.state = 'dissolve'
  brain.dissolve = 0
  brain.speed = 0
}

// Three sines at unrelated rates: smooth, never repeats in a play session.
function noise(t: number, p: number[], i: number) {
  return (
    (Math.sin(t + p[i]) + 0.7 * Math.sin(t * 0.618 + p[i + 1]) + 0.5 * Math.sin(t * 0.283 + p[i + 2])) /
    2.2
  )
}

// The box the Wisp keeps to, as a centre and half-sizes: its zone shrunk by
// the margin, or the room when the definition gives none. Read every step so
// the tuning stays live. A zone smaller than the margin collapses to a point.
const _box = { cx: 0, cy: 0, cz: 0, hx: 0, hy: 0, hz: 0 }

function innerBox(brain: WispBrain) {
  const zone = brain.zone
  if (!zone) {
    const bounds = currentRoom().bounds
    _box.cx = _box.cz = 0
    _box.hx = (bounds?.halfX ?? tuning.wispRoomHalfX) - tuning.wispMargin
    _box.hz = (bounds?.halfZ ?? tuning.wispRoomHalfZ) - tuning.wispMargin
    _box.cy = (tuning.wispMinY + tuning.wispMaxY) / 2
    _box.hy = (tuning.wispMaxY - tuning.wispMinY) / 2
    return _box
  }
  const { min, max } = zone
  const m = tuning.ghostZoneMargin
  _box.cx = (min[0] + max[0]) / 2
  _box.cy = (min[1] + max[1]) / 2
  _box.cz = (min[2] + max[2]) / 2
  _box.hx = Math.max(0, Math.abs(max[0] - min[0]) / 2 - m)
  _box.hy = Math.max(0, Math.abs(max[1] - min[1]) / 2 - m)
  _box.hz = Math.max(0, Math.abs(max[2] - min[2]) / 2 - m)
  return _box
}

// Keeps `v` in the box. An axis that started outside (`from`) may come back
// in but is not snapped there, so a Wisp caught outside its zone does not jump.
function clampInside(v: Vector3, from: Vector3, box: typeof _box) {
  v.x = Math.min(Math.max(box.cx + box.hx, from.x), Math.max(Math.min(box.cx - box.hx, from.x), v.x))
  v.y = Math.min(Math.max(box.cy + box.hy, from.y), Math.max(Math.min(box.cy - box.hy, from.y), v.y))
  v.z = Math.min(Math.max(box.cz + box.hz, from.z), Math.max(Math.min(box.cz - box.hz, from.z), v.z))
  return v
}

export function stepBrain(brain: WispBrain, dt: number, ctx: BrainContext) {
  if (brain.state === 'gone' || dt <= 0) return
  brain.clock += dt
  _prev.copy(brain.position)
  brain.offset.set(0, 0, 0)

  const dissolving = brain.state === 'dissolve'
  brain.lit = dissolving
    ? 0
    : brain.route
      ? blocked(ctx.beam.origin, brain.position, ctx.occluders)
        ? 0
        : uvMaskAt(brain.position)
      : beamOn(brain.position, ctx.beam, ctx.occluders)
  const seen = brain.route ? tuning.inkFadeStart : 0
  const rate = brain.lit > seen ? tuning.wispExposureRise : -tuning.wispExposureDecay
  brain.exposure = Math.min(1, Math.max(0, brain.exposure + rate * dt))

  switch (brain.state) {
    case 'wander': {
      if (brain.route) {
        followRoute(brain, brain.route, dt)
        break
      }
      // The path is a point drifting around the inner box; the Wisp trails it
      // at a capped speed so it also glides back calmly after fleeing.
      brain.path += dt * tuning.wispWanderSpeed
      const box = innerBox(brain)
      // In a low zone the bob gives way first, so the path never leaves the box.
      const bob = Math.min(tuning.wispBob, box.hy)
      _target.set(
        box.cx + noise(brain.path, brain.phase, 0) * box.hx,
        box.cy +
          noise(brain.path * 0.7, brain.phase, 3) * (box.hy - bob) +
          Math.sin(brain.clock * 1.7) * bob,
        box.cz + noise(brain.path * 0.9, brain.phase, 6) * box.hz,
      )
      _to.subVectors(_target, brain.position)
      const dist = _to.length()
      if (dist > 1e-5) {
        const step = Math.min(dist, Math.min(dist * tuning.wispFollow, tuning.wispMaxDrift) * dt)
        brain.position.addScaledVector(_to, step / dist)
      }

      brain.litTime = brain.lit > 0 ? brain.litTime + dt : 0
      if (brain.litTime >= tuning.wispFreezeDelay) {
        brain.state = 'freeze'
        brain.timer = tuning.wispFreezeSeconds * brain.lit
        brain.litTime = 0
      }
      break
    }

    case 'freeze': {
      const k = tuning.wispTremble
      const t = brain.clock
      brain.offset.set(Math.sin(t * 43) * k, Math.sin(t * 57 + 1.3) * k * 0.6, Math.sin(t * 49 + 2.1) * k)
      brain.timer -= dt
      if (brain.timer <= 0) {
        brain.state = 'flee'
        brain.timer = tuning.wispFleeSeconds
        brain.fleeDir.subVectors(brain.position, ctx.player).setY(0)
        if (brain.fleeDir.lengthSq() < 1e-4) brain.fleeDir.set(1, 0, 0)
        brain.fleeDir.normalize()
      }
      break
    }

    case 'flee': {
      // A short push off, fast in the middle, easing off as the timer runs
      // out. Without the push the head snaps to full speed in one frame.
      const total = Math.max(0.01, tuning.wispFleeSeconds)
      const push = Math.min(1, (total - brain.timer) / tuning.wispFleePush)
      const ease = Math.min(1, (brain.timer / total) * 2) * push * push * (3 - 2 * push)
      brain.position.addScaledVector(brain.fleeDir, tuning.wispFleeSpeed * ease * dt)
      clampInside(brain.position, _prev, innerBox(brain))
      brain.timer -= dt
      if (brain.timer <= 0) {
        brain.state = 'wander'
        brain.litTime = 0
      }
      break
    }

    case 'dissolve': {
      brain.dissolve += dt / Math.max(0.01, tuning.wispDissolveSeconds)
      if (brain.dissolve >= 1) {
        brain.dissolve = 1
        brain.state = 'gone'
      }
      break
    }
  }

  brain.speed = brain.position.distanceTo(_prev) / dt
}
