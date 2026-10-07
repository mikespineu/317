import { Raycaster, Vector3 } from 'three/webgpu'
import type { Mesh } from 'three/webgpu'
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

export function createBrain(spawn: Vector3): WispBrain {
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
    phase: [0.3, 2.1, 4.4, 1.2, 5.6, 3.3, 0.9, 2.7, 4.9],
  }
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

function clampInside(v: Vector3) {
  const halfX = tuning.wispRoomHalfX - tuning.wispMargin
  const halfZ = tuning.wispRoomHalfZ - tuning.wispMargin
  v.x = Math.min(halfX, Math.max(-halfX, v.x))
  v.z = Math.min(halfZ, Math.max(-halfZ, v.z))
  v.y = Math.min(tuning.wispMaxY, Math.max(tuning.wispMinY, v.y))
  return v
}

export function stepBrain(brain: WispBrain, dt: number, ctx: BrainContext) {
  if (brain.state === 'gone' || dt <= 0) return
  brain.clock += dt
  _prev.copy(brain.position)
  brain.offset.set(0, 0, 0)

  const dissolving = brain.state === 'dissolve'
  brain.lit = dissolving ? 0 : beamOn(brain.position, ctx.beam, ctx.occluders)
  const rate = brain.lit > 0 ? tuning.wispExposureRise : -tuning.wispExposureDecay
  brain.exposure = Math.min(1, Math.max(0, brain.exposure + rate * dt))

  switch (brain.state) {
    case 'wander': {
      // The path is a point drifting around the inner box; the Wisp trails it
      // at a capped speed so it also glides back calmly after fleeing.
      brain.path += dt * tuning.wispWanderSpeed
      const halfX = tuning.wispRoomHalfX - tuning.wispMargin
      const halfZ = tuning.wispRoomHalfZ - tuning.wispMargin
      const midY = (tuning.wispMinY + tuning.wispMaxY) / 2
      const halfY = (tuning.wispMaxY - tuning.wispMinY) / 2
      _target.set(
        noise(brain.path, brain.phase, 0) * halfX,
        midY +
          noise(brain.path * 0.7, brain.phase, 3) * (halfY - tuning.wispBob) +
          Math.sin(brain.clock * 1.7) * tuning.wispBob,
        noise(brain.path * 0.9, brain.phase, 6) * halfZ,
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
      // Fast at first, easing off as the timer runs out.
      const ease = Math.min(1, (brain.timer / Math.max(0.01, tuning.wispFleeSeconds)) * 2)
      brain.position.addScaledVector(brain.fleeDir, tuning.wispFleeSpeed * ease * dt)
      clampInside(brain.position)
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
