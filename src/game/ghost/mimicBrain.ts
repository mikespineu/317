import { Vector3 } from 'three/webgpu'
import type { Mesh } from 'three/webgpu'
import { tuning } from '../tuning'
import { beamOn } from './wispBrain'
import type { Beam } from './wispBrain'

// The Mimic's behaviour as plain data plus a step function, like the Wisp's
// brain; Mimic.tsx owns the meshes and reads what happened.
//
// It sits as an ordinary object on one of a few fixed spots and twitches now
// and then. White light held on it freezes it and shows its true shape for a
// few seconds; a good photo in that time dissolves it. If the time runs out
// it settles on another spot.

export type MimicState = 'disguised' | 'freeze' | 'dissolve' | 'gone'

export interface MimicBrain {
  state: MimicState
  spot: number // where the disguise is (or last was)
  revealSpot: number // where the true shape stands while it shows
  lit: number // beam strength on it this frame
  litTime: number // seconds continuously lit
  exposure: number // 0..1
  timer: number // seconds of reveal left
  pop: number // 0..1: how far the true shape has come out
  dissolve: number // 0..1
  hideWait: number // seconds before the disguise reappears on its new spot
  twitchIn: number // seconds to the next twitch
  twitchLeft: number // seconds left of the current twitch
  failed: number // reveals that ran out without a good photo
  clock: number
  // One-shot flags for the component to act on and clear.
  onTwitch: boolean
  onReveal: boolean
  onHide: boolean
}

const between = (min: number, max: number) => min + Math.random() * (max - min)

export function createMimicBrain(spots: number, start?: number): MimicBrain {
  const spot = start !== undefined && start >= 0 && start < spots ? start : Math.floor(Math.random() * spots)
  return {
    state: 'disguised',
    spot,
    revealSpot: spot,
    lit: 0,
    litTime: 0,
    exposure: 0,
    timer: 0,
    pop: 0,
    dissolve: 0,
    hideWait: 0,
    twitchIn: between(2, 4), // the first one comes early, so the room says something
    twitchLeft: 0,
    failed: 0,
    clock: 0,
    onTwitch: false,
    onReveal: false,
    onHide: false,
  }
}

// Called when a good enough photo of the revealed Mimic was taken.
export function startMimicDissolve(brain: MimicBrain) {
  if (brain.state === 'dissolve' || brain.state === 'gone') return
  brain.state = 'dissolve'
  brain.dissolve = 0
}

export function isRevealed(brain: MimicBrain) {
  return brain.state === 'freeze' && brain.pop >= 0.6
}

export interface MimicContext {
  beam: Beam
  occluders: Mesh[]
  centres: readonly Vector3[] // the middle of each spot's object, to test the light on
}

export function stepMimic(brain: MimicBrain, dt: number, ctx: MimicContext) {
  if (brain.state === 'gone' || dt <= 0) return
  brain.clock += dt

  const dissolving = brain.state === 'dissolve'
  brain.lit = dissolving ? 0 : beamOn(ctx.centres[brain.spot], ctx.beam, ctx.occluders)
  const rate = brain.lit > 0 ? tuning.wispExposureRise : -tuning.wispExposureDecay
  brain.exposure = Math.min(1, Math.max(0, brain.exposure + rate * dt))

  switch (brain.state) {
    case 'disguised': {
      brain.pop = Math.max(0, brain.pop - dt / Math.max(0.01, tuning.mimicPopSeconds))
      if (brain.hideWait > 0) {
        brain.hideWait -= dt
        break
      }
      brain.twitchIn -= dt
      if (brain.twitchIn <= 0) {
        brain.twitchLeft = tuning.mimicTwitchSeconds
        brain.twitchIn = between(tuning.mimicTwitchMin, tuning.mimicTwitchMax)
        brain.onTwitch = true
      }
      if (brain.twitchLeft > 0) brain.twitchLeft -= dt

      brain.litTime = brain.lit > 0 ? brain.litTime + dt : 0
      if (brain.litTime >= tuning.mimicFreezeDelay) {
        brain.state = 'freeze'
        brain.revealSpot = brain.spot
        // Every reveal that ended without a photo makes the next one a little longer.
        brain.timer = tuning.mimicRevealSeconds + Math.min(tuning.mimicPityMax, brain.failed * tuning.mimicPity)
        brain.litTime = 0
        brain.twitchLeft = 0
        brain.onReveal = true
      }
      break
    }

    case 'freeze': {
      brain.pop = Math.min(1, brain.pop + dt / Math.max(0.01, tuning.mimicPopSeconds))
      brain.timer -= dt * (brain.lit > 0 ? 1 : tuning.mimicUnlitDrain)
      if (brain.timer <= 0) {
        // Out of time: settle on a different spot.
        brain.failed++
        brain.state = 'disguised'
        const count = ctx.centres.length
        if (count > 1) brain.spot = (brain.spot + 1 + Math.floor(Math.random() * (count - 1))) % count
        brain.hideWait = tuning.mimicRedisguiseSeconds
        brain.twitchIn = between(tuning.mimicTwitchMin, tuning.mimicTwitchMax)
        brain.litTime = 0
        brain.onHide = true
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
}
