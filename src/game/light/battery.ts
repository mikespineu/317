import { MathUtils } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { level0 } from '../room/level0.def'
import { runtime } from '../runtime'
import { levelOf, useGame } from '../store'
import type { LightMode } from '../store'
import { tuning } from '../tuning'

// What the flashlight should look like this frame.
export interface BeamState {
  lit: boolean
  mode: LightMode
  strength: number // 0..1, 0 when off
  intensity: number // candela
  distance: number // metres
  angle: number // half-angle, radians
}

const state: BeamState = {
  lit: false,
  mode: 'white',
  strength: 0,
  intensity: 0,
  distance: tuning.whiteDistFull,
  angle: MathUtils.degToRad(tuning.whiteAngleDeg),
}

// Local timers; none of this needs to be seen by other systems.
let clock = 0
let emptyFor = 0 // seconds since the pack ran dry, drives the sputter
let dryFor = 0 // seconds dry with no spares, drives the emergency pack
let emergencyGiven = false
let dipLeft = 0
let tickIn = 0
let humOn = false

const batteryPickup = level0.pickups.find((p) => p.item === 'battery')?.node

// Cheap smooth noise in 0..1 from a few detuned sines.
function noise(t: number) {
  return 0.5 + 0.25 * Math.sin(t) + 0.15 * Math.sin(t * 2.31 + 1.7) + 0.1 * Math.sin(t * 5.13 + 0.4)
}

// Advances the battery by dt and returns the beam for this frame. Pass
// `frozen` while the game is paused or a UI has the lock: nothing drains and
// no timer moves, but the light keeps its current look.
export function updateBattery(dt: number, frozen: boolean): BeamState {
  const store = useGame.getState()
  const { lightOn, lightMode, switching, swapping, spares } = store
  const battery = runtime.battery
  const lit = lightOn && !switching && !swapping
  const step = frozen ? 0 : dt
  clock += step

  if (lit && battery.charge > 0) {
    const seconds = lightMode === 'white' ? tuning.whiteDrainSeconds : tuning.uvDrainSeconds
    battery.charge = Math.max(0, battery.charge - step / seconds)
  }

  const level = levelOf(battery.charge)
  if (level !== store.batteryLevel) store.setBatteryLevel(level)

  // strength: 1.0 on a full pack, easing down to lowStrength as it dies
  const k = MathUtils.clamp(battery.charge / tuning.levelFull, 0, 1)
  let strength = MathUtils.lerp(tuning.lowStrength, 1, Math.pow(k, 1 / tuning.strengthCurve))

  if (level === 'low' && lit) {
    strength *= 1 - tuning.flickerDepth * noise(clock * tuning.flickerRate)
    // occasional hard dips
    if (dipLeft > 0) dipLeft -= step
    else if (Math.random() < tuning.flickerDipChance * step) dipLeft = tuning.flickerDipSeconds
    if (dipLeft > 0) strength *= tuning.flickerDipStrength

    tickIn -= step
    if (tickIn <= 0) {
      sfx.play('lowTick')
      tickIn = tuning.lowTickSeconds
    }
  } else {
    dipLeft = 0
    tickIn = Math.min(tickIn, tuning.lowTickSeconds * 0.4)
  }

  if (level === 'empty') {
    // sputter: stutter down from the last low strength to a faint steady glow
    if (lit) emptyFor += step
    const fade = MathUtils.clamp(emptyFor / tuning.sputterSeconds, 0, 1)
    const stutter = fade < 1 ? 0.35 + 0.65 * noise(clock * tuning.flickerRate * 2.2) : 1
    strength = MathUtils.lerp(tuning.lowStrength * stutter, tuning.emptyGlow, fade)

    // Level 0 stand-in for the GDD's emergency pack: the pickup comes back.
    if (spares === 0 && !swapping) {
      dryFor += step
      if (!emergencyGiven && dryFor >= tuning.emergencyPackSeconds) {
        emergencyGiven = true
        if (batteryPickup && store.pickedUp[batteryPickup]) store.setPickedUp(batteryPickup, false)
      }
    } else {
      dryFor = 0
    }
  } else {
    emptyFor = 0
    dryFor = 0
    emergencyGiven = false
  }

  const uv = lightMode === 'uv'
  const hum = lit && uv && !store.paused
  if (hum !== humOn) {
    humOn = hum
    sfx.loop('uvHum', hum)
  }

  state.lit = lit
  state.mode = lightMode
  state.strength = lit ? strength : 0
  state.intensity = lit ? (uv ? tuning.uvIntensity : tuning.whiteIntensity) * strength : 0
  state.distance = uv
    ? tuning.uvDist
    : MathUtils.lerp(tuning.whiteDistLow, tuning.whiteDistFull, strength)
  state.angle = MathUtils.degToRad(uv ? tuning.uvAngleDeg : tuning.whiteAngleDeg)
  return state
}

// Click, switch and swap sounds follow the store, so every input path
// (keyboard, touch buttons) gets them. Returns the unsubscribe.
export function bindLightSounds() {
  return useGame.subscribe((s, prev) => {
    if (s.lightOn !== prev.lightOn) sfx.play('lightClick')
    if (s.switching && !prev.switching) sfx.play('modeSwitch')
    if (s.swapping && !prev.swapping) sfx.play('swapClunk')
  })
}

// Stops the hum when the flashlight unmounts.
export function stopLightSounds() {
  if (humOn) sfx.loop('uvHum', false)
  humOn = false
}
