import { currentRoom } from '../room/rooms'
import { tuning } from '../tuning'
import { audio, creak, onUnlock } from './engine'
import type { Audio } from './engine'
import type { LoopName } from './sfx'

// Loops are built on first use and then left running behind a gain node, so
// turning one on/off or fading it is a single parameter change.

const FADE = 0.12 // seconds, time constant of every loop gain change

function lfo(a: Audio, hz: number, depth: number, target: AudioParam) {
  const osc = a.ctx.createOscillator()
  osc.frequency.value = hz
  const amount = a.ctx.createGain()
  amount.gain.value = depth
  osc.connect(amount).connect(target)
  osc.start()
}

function noiseSource(a: Audio) {
  const src = a.ctx.createBufferSource()
  src.buffer = a.noise
  src.loop = true
  src.start(0, Math.random())
  return src
}

// The mounted room's tone; 'study' when the definition does not say.
function inHall() {
  return currentRoom().atmosphere.roomTone === 'hall'
}

// A bigger, emptier volume than the study: the air sits lower, and there is
// a standing note under it, the way a stairwell hums.
function hallTone(a: Audio, out: GainNode) {
  const lp = a.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 120
  lp.Q.value = 0.4
  const body = a.ctx.createGain()
  body.gain.value = 0.26
  lfo(a, 0.05, 0.07, body.gain)
  noiseSource(a).connect(lp).connect(body).connect(out)
  const hollow = a.ctx.createBiquadFilter()
  hollow.type = 'bandpass'
  hollow.frequency.value = 96
  hollow.Q.value = 5
  const drone = a.ctx.createGain()
  drone.gain.value = 0.09
  lfo(a, 0.031, 0.04, drone.gain)
  noiseSource(a).connect(hollow).connect(drone).connect(out)
  // The trace of air, lower than the study's and wider.
  const bp = a.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 400
  bp.Q.value = 0.5
  const air = a.ctx.createGain()
  air.gain.value = 0.012
  noiseSource(a).connect(bp).connect(air).connect(out)
}

// The clock is a two-second sample, tick then tock, rendered once: an
// escapement is a sharp click, the pallet landing just after it, and the case
// answering. Beats fall on TICK_LEAD + n seconds from the loop's start.
const TICK_LEAD = 0.25 // s of silence first, so the loop's fade-in never clips a beat
let tickEpoch = 0 // context time of the first beat; 0 until the loop is built

function renderBeat(data: Float32Array, rate: number, at: number, pitch: number) {
  const start = Math.floor(at * rate)
  const length = Math.floor(0.16 * rate)
  const drop = 0.018 // s, the pallet lands after the tooth releases
  for (let i = 0; i < length; i++) {
    const t = i / rate
    let v = (Math.random() * 2 - 1) * Math.exp(-t / 0.0022) * 0.55
    v += Math.sin(2 * Math.PI * 2300 * pitch * t) * Math.exp(-t / 0.011) * 0.5
    v += Math.sin(2 * Math.PI * 410 * pitch * t) * Math.exp(-t / 0.032) * 0.3 // the case
    if (t > drop) {
      const u = t - drop
      v += (Math.random() * 2 - 1) * Math.exp(-u / 0.0018) * 0.25
      v += Math.sin(2 * Math.PI * 1650 * pitch * u) * Math.exp(-u / 0.009) * 0.22
    }
    data[start + i] += v
  }
}

// Each builder wires its sources into `out` (which starts silent).
const builders: Record<LoopName, (a: Audio, out: GainNode) => void> = {
  // Dark air: low-passed noise that breathes very slowly.
  roomTone(a, out) {
    if (inHall()) return hallTone(a, out)
    const lp = a.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 170
    lp.Q.value = 0.4
    const body = a.ctx.createGain()
    body.gain.value = 0.22
    lfo(a, 0.07, 0.06, body.gain)
    noiseSource(a).connect(lp).connect(body).connect(out)
    // A trace of air higher up, so it is audible on phone speakers too.
    const bp = a.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 520
    bp.Q.value = 0.6
    const air = a.ctx.createGain()
    air.gain.value = 0.012
    noiseSource(a).connect(bp).connect(air).connect(out)
  },

  // Tube ballast: mains-ish buzz with a slight flutter.
  uvHum(a, out) {
    const lp = a.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const body = a.ctx.createGain()
    body.gain.value = 0.08
    lfo(a, 9, 0.012, body.gain)
    const saw = a.ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = 120
    const sine = a.ctx.createOscillator()
    sine.frequency.value = 240.7 // slightly off, for a slow beat
    const sineGain = a.ctx.createGain()
    sineGain.gain.value = 0.6
    saw.connect(lp)
    sine.connect(sineGain).connect(lp)
    lp.connect(body).connect(out)
    saw.start()
    sine.start()
  },

  // Breath without words: two wandering bands of noise.
  wispWhisper(a, out) {
    const src = noiseSource(a)
    const body = a.ctx.createGain()
    body.gain.value = 0.16
    lfo(a, 0.7, 0.07, body.gain)
    lfo(a, 0.23, 0.05, body.gain)
    const low = a.ctx.createBiquadFilter()
    low.type = 'bandpass'
    low.frequency.value = 1700
    low.Q.value = 2.2
    lfo(a, 0.31, 650, low.frequency)
    const high = a.ctx.createBiquadFilter()
    high.type = 'bandpass'
    high.frequency.value = 3400
    high.Q.value = 3
    lfo(a, 0.19, 900, high.frequency)
    const highGain = a.ctx.createGain()
    highGain.gain.value = 0.5
    src.connect(low).connect(body)
    src.connect(high).connect(highGain).connect(body)
    body.connect(out)
  },

  // The key Wisp: the same breath a little lower, with a chest under it.
  wispWhisperKey(a, out) {
    const src = noiseSource(a)
    const body = a.ctx.createGain()
    body.gain.value = 0.16
    lfo(a, 0.6, 0.07, body.gain)
    lfo(a, 0.21, 0.05, body.gain)
    const low = a.ctx.createBiquadFilter()
    low.type = 'bandpass'
    low.frequency.value = 1350
    low.Q.value = 2.2
    lfo(a, 0.29, 520, low.frequency)
    const high = a.ctx.createBiquadFilter()
    high.type = 'bandpass'
    high.frequency.value = 2800
    high.Q.value = 3
    lfo(a, 0.17, 750, high.frequency)
    const highGain = a.ctx.createGain()
    highGain.gain.value = 0.5
    const chest = a.ctx.createBiquadFilter()
    chest.type = 'bandpass'
    chest.frequency.value = 640
    chest.Q.value = 1.4
    lfo(a, 0.13, 180, chest.frequency)
    const chestGain = a.ctx.createGain()
    chestGain.gain.value = 0.55
    src.connect(low).connect(body)
    src.connect(high).connect(highGain).connect(body)
    src.connect(chest).connect(chestGain).connect(body)
    body.connect(out)
  },

  // A long-case clock at one beat a second, the tock a third lower.
  clockTick(a, out) {
    const rate = a.ctx.sampleRate
    const buffer = a.ctx.createBuffer(1, rate * 2, rate)
    const data = buffer.getChannelData(0)
    renderBeat(data, rate, TICK_LEAD, 1)
    renderBeat(data, rate, TICK_LEAD + 1, 0.8)
    const src = a.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const body = a.ctx.createGain()
    body.gain.value = 0.3
    src.connect(body).connect(out)
    const t0 = a.ctx.currentTime
    src.start(t0)
    tickEpoch = t0 + TICK_LEAD
  },

  // Night air through an open doorway: a low push that swells and drops,
  // and a thin whistle where it finds the gap.
  wind(a, out) {
    const bp = a.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 380
    bp.Q.value = 0.7
    lfo(a, 0.11, 150, bp.frequency)
    const body = a.ctx.createGain()
    body.gain.value = 0.2
    lfo(a, 0.17, 0.09, body.gain)
    lfo(a, 0.05, 0.06, body.gain)
    noiseSource(a).connect(bp).connect(body).connect(out)
    const lp = a.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 140
    const low = a.ctx.createGain()
    low.gain.value = 0.22
    noiseSource(a).connect(lp).connect(low).connect(out)
    const gap = a.ctx.createBiquadFilter()
    gap.type = 'bandpass'
    gap.frequency.value = 1150
    gap.Q.value = 9
    lfo(a, 0.07, 260, gap.frequency)
    const whistle = a.ctx.createGain()
    whistle.gain.value = 0.025
    lfo(a, 0.23, 0.02, whistle.gain)
    noiseSource(a).connect(gap).connect(whistle).connect(out)
  },
}

function volumeOf(name: LoopName) {
  if (name === 'roomTone') return tuning.roomToneVolume
  if (name === 'uvHum') return tuning.uvHumVolume
  if (name === 'clockTick') return tuning.clockTickVolume
  if (name === 'wind') return tuning.windVolume
  if (name === 'wispWhisperKey') return tuning.whisperVolume * tuning.keyWhisperBoost
  return tuning.whisperVolume
}

interface Loop {
  wanted: number // 0 = off; what the caller last asked for
  applied: number // last value sent to the gain node, -1 = never
  out: GainNode | null
  timed?: boolean // a stop is scheduled ahead on the gain (stopTickOnBeat)
}

const loops: Record<LoopName, Loop> = {
  roomTone: { wanted: 0, applied: -1, out: null },
  uvHum: { wanted: 0, applied: -1, out: null },
  wispWhisper: { wanted: 0, applied: -1, out: null },
  wispWhisperKey: { wanted: 0, applied: -1, out: null },
  clockTick: { wanted: 0, applied: -1, out: null },
  wind: { wanted: 0, applied: -1, out: null },
}

function apply(a: Audio, name: LoopName) {
  const loop = loops[name]
  const target = loop.wanted * volumeOf(name)
  // Callers set gains every frame; skip the ones that would not be heard.
  if (Math.abs(target - loop.applied) < 0.004 && (target > 0 || loop.applied === 0)) return
  if (!loop.out) {
    if (target === 0) return // never started, nothing to stop
    loop.out = a.ctx.createGain()
    loop.out.gain.value = 0
    loop.out.connect(a.master)
    builders[name](a, loop.out)
  }
  loop.applied = target
  if (loop.timed) {
    // A stop still waiting for its beat would silence the loop again.
    loop.out.gain.cancelScheduledValues(a.ctx.currentTime)
    loop.timed = false
  }
  loop.out.gain.setTargetAtTime(target, a.ctx.currentTime, FADE)
}

export function setLoop(name: LoopName, on: boolean, gain: number) {
  loops[name].wanted = on ? Math.min(1, Math.max(0, gain)) : 0
  const a = audio()
  if (a) apply(a, name)
}

// Stops the clock on its next beat: what has already sounded rings out, and
// the beat that would have followed never comes. Until then nothing changes.
export function stopTickOnBeat() {
  const loop = loops.clockTick
  loop.wanted = 0
  const a = audio()
  if (!a) return
  if (!loop.out || a.ctx.state !== 'running') return apply(a, 'clockTick')
  const now = a.ctx.currentTime
  const beat = tickEpoch + Math.ceil(now - tickEpoch)
  loop.applied = 0
  loop.timed = true
  loop.out.gain.setTargetAtTime(0, Math.max(now, beat - 0.02), 0.005)
}

// The room settles now and then. Only while its tone is playing and the tab
// is visible, so nothing queues up in the background.
function scheduleCreak(a: Audio) {
  const span = Math.max(0, tuning.creakMaxSeconds - tuning.creakMinSeconds)
  const wait = tuning.creakMinSeconds + Math.random() * span
  window.setTimeout(() => {
    if (loops.roomTone.wanted > 0 && !document.hidden && a.ctx.state === 'running') {
      audio()
      const gain = 0.02 * tuning.roomToneVolume * (0.6 + Math.random() * 0.8)
      // The hall's timber is bigger and further off: lower, and it takes longer.
      if (inHall()) creak(a, 0, 1.0 + Math.random() * 1.2, gain * 1.2, 38 + Math.random() * 24, 0.6)
      else creak(a, 0, 0.5 + Math.random() * 0.7, gain, 60 + Math.random() * 40)
    }
    scheduleCreak(a)
  }, wait * 1000)
}

if (typeof window !== 'undefined') {
  // Loops requested before the first gesture start here, and the room tone
  // starts regardless: the room is never perfectly silent.
  onUnlock((a) => {
    if (loops.roomTone.wanted === 0) loops.roomTone.wanted = 1
    for (const name of Object.keys(loops) as LoopName[]) apply(a, name)
    scheduleCreak(a)
  })
}
