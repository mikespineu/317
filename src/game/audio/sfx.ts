import { audio, creak, noise, tone } from './engine'
import type { Audio } from './engine'
import { setLoop } from './loops'

// Sound effects. Call sites exist across the game; this is the only module
// that touches Web Audio. Everything is synthesised, there are no audio files.
export type SfxName =
  | 'lightClick'
  | 'modeSwitch'
  | 'swapClunk'
  | 'lowTick'
  | 'chime'
  | 'pickup'
  | 'candleLight'
  | 'candleOut'
  | 'propGrab'
  | 'propThrow'
  | 'propHit'
  | 'locked'
  | 'wheelClick'
  | 'padlockOpen'
  | 'drawerSlide'
  | 'doorCreak'
  | 'shutter'
  | 'wispDissolve'

export type LoopName = 'roomTone' | 'uvHum' | 'wispWhisper'

// A short filtered-noise tick: the basis of every switch and latch here.
function click(a: Audio, at: number, hz: number, gain: number, dur = 0.018) {
  noise(a, { filter: 'bandpass', from: hz, q: 1.4, at, dur, gain, attack: 0.001 })
}

function thud(a: Audio, at: number, hz: number, gain: number, dur = 0.14) {
  tone(a, { from: hz, to: hz * 0.5, at, dur, gain, attack: 0.003 })
}

const voices: Record<SfxName, (a: Audio) => void> = {
  lightClick(a) {
    click(a, 0, 2600, 0.22)
    tone(a, { type: 'triangle', from: 1500, to: 900, dur: 0.03, gain: 0.05, attack: 0.001 })
  },

  // The slider passes a detent: two clicks, the second lower.
  modeSwitch(a) {
    click(a, 0, 3200, 0.16)
    click(a, 0.07, 2100, 0.2)
  },

  // Old pack out, new pack home.
  swapClunk(a) {
    click(a, 0, 1400, 0.16, 0.03)
    thud(a, 0.02, 150, 0.2, 0.1)
    noise(a, { filter: 'lowpass', from: 700, at: 0.2, dur: 0.09, gain: 0.22, attack: 0.002 })
    thud(a, 0.2, 110, 0.3, 0.18)
    click(a, 0.24, 2400, 0.1)
  },

  lowTick(a) {
    tone(a, { type: 'square', from: 1150, dur: 0.035, gain: 0.03, attack: 0.001 })
    click(a, 0, 4200, 0.04, 0.01)
  },

  // Three soft partials, the fifth arriving a moment late.
  chime(a) {
    tone(a, { from: 880, dur: 1.4, gain: 0.07, attack: 0.01 })
    tone(a, { from: 1318.5, at: 0.09, dur: 1.2, gain: 0.05, attack: 0.01 })
    tone(a, { from: 1760, at: 0.09, dur: 0.8, gain: 0.02, attack: 0.01 })
  },

  pickup(a) {
    tone(a, { type: 'triangle', from: 620, dur: 0.11, gain: 0.09 })
    tone(a, { type: 'triangle', from: 930, at: 0.07, dur: 0.16, gain: 0.08 })
    click(a, 0, 1800, 0.06, 0.02)
  },

  // A match strike and the wick catching.
  candleLight(a) {
    noise(a, { filter: 'bandpass', from: 2800, to: 1800, q: 1.1, dur: 0.1, gain: 0.1, attack: 0.005 })
    noise(a, { filter: 'lowpass', from: 500, at: 0.08, dur: 0.3, gain: 0.07, attack: 0.06 })
    tone(a, { type: 'triangle', from: 220, to: 330, at: 0.08, dur: 0.12, gain: 0.015, attack: 0.03 })
  },

  // A short breath, and the flame gone.
  candleOut(a) {
    noise(a, { filter: 'bandpass', from: 1100, to: 350, q: 0.9, dur: 0.28, gain: 0.09, attack: 0.03 })
  },

  // Cardboard and paper taken off a shelf.
  propGrab(a) {
    noise(a, { filter: 'bandpass', from: 1700, to: 1100, q: 1.2, dur: 0.07, gain: 0.07, attack: 0.01 })
    thud(a, 0.03, 190, 0.07, 0.06)
  },

  // Air moved past the ear.
  propThrow(a) {
    noise(a, { filter: 'bandpass', from: 500, to: 2600, q: 1.6, dur: 0.16, gain: 0.08, attack: 0.04 })
  },

  // A flat knock, different each time.
  propHit(a) {
    thud(a, 0, 150 + Math.random() * 70, 0.17, 0.09)
    click(a, 0, 1100 + Math.random() * 500, 0.09, 0.02)
  },

  // A handle that gives a little and stops.
  locked(a) {
    click(a, 0, 1300, 0.2, 0.03)
    click(a, 0.07, 1000, 0.16, 0.03)
    click(a, 0.15, 1200, 0.12, 0.03)
    thud(a, 0.01, 95, 0.2, 0.12)
  },

  wheelClick(a) {
    click(a, 0, 3400 + Math.random() * 500, 0.12, 0.012)
    tone(a, { from: 2300, dur: 0.02, gain: 0.02, attack: 0.001 })
  },

  // Shackle springs: a click, a small metallic ring, then the drop.
  padlockOpen(a) {
    click(a, 0, 2800, 0.22, 0.02)
    tone(a, { from: 2140, at: 0.01, dur: 0.35, gain: 0.03, attack: 0.002 })
    tone(a, { from: 3210, at: 0.01, dur: 0.22, gain: 0.018, attack: 0.002 })
    thud(a, 0.09, 180, 0.2, 0.1)
    click(a, 0.1, 1500, 0.14, 0.03)
  },

  // Wood on wood, ending against the stop.
  drawerSlide(a) {
    noise(a, { filter: 'bandpass', from: 380, to: 620, q: 0.9, dur: 0.5, gain: 0.16, attack: 0.12 })
    noise(a, { filter: 'bandpass', from: 1500, to: 1900, q: 2, dur: 0.45, gain: 0.03, attack: 0.1 })
    thud(a, 0.46, 120, 0.22, 0.12)
    click(a, 0.47, 900, 0.1, 0.03)
  },

  doorCreak(a) {
    click(a, 0, 1700, 0.16, 0.025) // the latch
    creak(a, 0.05, 1.15, 0.07, 72)
    creak(a, 0.3, 0.8, 0.03, 108)
    noise(a, { filter: 'lowpass', from: 300, at: 0.1, dur: 1.0, gain: 0.05, attack: 0.3 })
  },

  // Leaf shutter: open, a breath of mechanism, closed.
  shutter(a) {
    click(a, 0, 3000, 0.24, 0.014)
    noise(a, { filter: 'highpass', from: 1800, at: 0.01, dur: 0.06, gain: 0.06, attack: 0.005 })
    click(a, 0.065, 2300, 0.2, 0.02)
    thud(a, 0.065, 240, 0.06, 0.05)
  },

  // Breath drawn upward and gone.
  wispDissolve(a) {
    noise(a, { filter: 'bandpass', from: 700, to: 4200, q: 2.5, dur: 1.1, gain: 0.14, attack: 0.15 })
    tone(a, { from: 520, to: 1560, dur: 1.0, gain: 0.025, attack: 0.2 })
    tone(a, { from: 783, to: 2349, at: 0.05, dur: 0.9, gain: 0.012, attack: 0.2 })
  },
}

export const sfx = {
  // Dropped until the first user gesture has unlocked audio.
  play(name: SfxName) {
    const a = audio()
    if (!a || a.ctx.state !== 'running') return
    voices[name](a)
  },
  // Starts or stops a loop; `gain` (0..1) lets callers fade it, e.g. by distance.
  // Safe to call every frame. A loop requested before unlock starts once
  // audio is available.
  loop(name: LoopName, on: boolean, gain = 1) {
    setLoop(name, on, gain)
  },
}
