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

// Each builder wires its sources into `out` (which starts silent).
const builders: Record<LoopName, (a: Audio, out: GainNode) => void> = {
  // Dark air: low-passed noise that breathes very slowly.
  roomTone(a, out) {
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
}

function volumeOf(name: LoopName) {
  if (name === 'roomTone') return tuning.roomToneVolume
  if (name === 'uvHum') return tuning.uvHumVolume
  return tuning.whisperVolume
}

interface Loop {
  wanted: number // 0 = off; what the caller last asked for
  applied: number // last value sent to the gain node, -1 = never
  out: GainNode | null
}

const loops: Record<LoopName, Loop> = {
  roomTone: { wanted: 0, applied: -1, out: null },
  uvHum: { wanted: 0, applied: -1, out: null },
  wispWhisper: { wanted: 0, applied: -1, out: null },
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
  loop.out.gain.setTargetAtTime(target, a.ctx.currentTime, FADE)
}

export function setLoop(name: LoopName, on: boolean, gain: number) {
  loops[name].wanted = on ? Math.min(1, Math.max(0, gain)) : 0
  const a = audio()
  if (a) apply(a, name)
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
      creak(a, 0, 0.5 + Math.random() * 0.7, gain, 60 + Math.random() * 40)
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
