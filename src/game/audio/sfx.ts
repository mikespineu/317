import { audio, creak, noise, tone } from './engine'
import type { Audio } from './engine'
import { setLoop, stopTickOnBeat } from './loops'

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
  | 'doorSlam'
  | 'keyDrop'
  | 'keyTurn'
  | 'letterUnfold'
  | 'rummage'
  | 'symbolClick'
  | 'chestClunk'
  | 'lidCreak'
  | 'mirrorChime'
  | 'mimicScrape'
  | 'mimicReveal'
  | 'pageRustle'
  | 'bookPull'
  | 'ladderRoll'
  | 'lampOn'

export type LoopName =
  | 'roomTone'
  | 'uvHum'
  | 'wispWhisper'
  | 'wispWhisperKey' // the key Wisp: louder and slightly lower
  | 'clockTick'
  | 'wind'
  | 'penScratch' // the Ink Ghost: a quill, closer as it nears

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

  // ---- the Entrance Hall ----

  // Two heavy leaves meeting a moment apart, the latch, and the hall
  // answering: a low boom that takes its time to die.
  doorSlam(a) {
    noise(a, { filter: 'lowpass', from: 1500, to: 180, dur: 0.32, gain: 0.5, attack: 0.002 })
    thud(a, 0, 72, 0.55, 0.5)
    click(a, 0, 2300, 0.2, 0.02)
    // the second leaf
    noise(a, { filter: 'lowpass', from: 1100, to: 160, at: 0.035, dur: 0.26, gain: 0.34, attack: 0.002 })
    thud(a, 0.035, 90, 0.4, 0.4)
    // latch and ironwork settling
    click(a, 0.09, 1700, 0.12, 0.03)
    click(a, 0.15, 1250, 0.07, 0.03)
    tone(a, { from: 610, at: 0.04, dur: 0.5, gain: 0.02, attack: 0.002 })
    // the room: two returns off the far wall, then the tail
    noise(a, { filter: 'lowpass', from: 620, at: 0.19, dur: 0.3, gain: 0.11, attack: 0.02 })
    noise(a, { filter: 'lowpass', from: 480, at: 0.38, dur: 0.34, gain: 0.055, attack: 0.03 })
    noise(a, { filter: 'bandpass', from: 170, q: 3, at: 0.02, dur: 1.9, gain: 0.13, attack: 0.03 })
    noise(a, { filter: 'lowpass', from: 420, to: 110, at: 0.02, dur: 1.5, gain: 0.12, attack: 0.03 })
    tone(a, { from: 52, to: 40, at: 0.01, dur: 1.4, gain: 0.2, attack: 0.01 })
  },

  // A small brass key on floorboards: it lands, bounces once, and settles.
  keyDrop(a) {
    const hit = (at: number, g: number) => {
      click(a, at, 5200, 0.2 * g, 0.012)
      tone(a, { from: 4100, at, dur: 0.2, gain: 0.05 * g, attack: 0.001 })
      tone(a, { from: 6350, at, dur: 0.13, gain: 0.03 * g, attack: 0.001 })
      tone(a, { from: 2760, at, dur: 0.1, gain: 0.025 * g, attack: 0.001 })
      thud(a, at, 210, 0.12 * g, 0.05) // the board under it
    }
    hit(0, 1)
    hit(0.17, 0.5)
    click(a, 0.27, 4700, 0.05, 0.01)
    click(a, 0.31, 5600, 0.03, 0.01)
  },

  // The key goes in, two wards pass, and the bolt comes back.
  keyTurn(a) {
    noise(a, { filter: 'bandpass', from: 3800, to: 2600, q: 2, dur: 0.08, gain: 0.05, attack: 0.01 })
    click(a, 0.12, 2600, 0.12, 0.012)
    click(a, 0.17, 2300, 0.1, 0.012)
    click(a, 0.28, 1500, 0.2, 0.03)
    thud(a, 0.29, 140, 0.22, 0.11)
    tone(a, { from: 1900, at: 0.28, dur: 0.12, gain: 0.015, attack: 0.002 })
  },

  // Old paper opened along two folds, with the creases cracking.
  letterUnfold(a) {
    noise(a, { filter: 'bandpass', from: 3200, to: 5200, q: 0.8, dur: 0.16, gain: 0.07, attack: 0.03 })
    noise(a, { filter: 'bandpass', from: 4200, to: 2600, q: 0.8, at: 0.14, dur: 0.24, gain: 0.08, attack: 0.05 })
    noise(a, { filter: 'lowpass', from: 500, dur: 0.3, gain: 0.03, attack: 0.05 })
    click(a, 0.05, 5200 + Math.random() * 1500, 0.04, 0.008)
    click(a, 0.19, 5200 + Math.random() * 1500, 0.05, 0.008)
    click(a, 0.27, 5200 + Math.random() * 1500, 0.03, 0.008)
  },

  // A hand in a heavy coat: three passes of cloth, and something small found.
  rummage(a) {
    noise(a, { filter: 'bandpass', from: 700, to: 1100, q: 0.7, dur: 0.3, gain: 0.09, attack: 0.1 })
    noise(a, { filter: 'bandpass', from: 950, to: 600, q: 0.7, at: 0.22, dur: 0.3, gain: 0.09, attack: 0.1 })
    noise(a, { filter: 'bandpass', from: 650, to: 1000, q: 0.7, at: 0.48, dur: 0.32, gain: 0.08, attack: 0.1 })
    noise(a, { filter: 'lowpass', from: 260, dur: 0.8, gain: 0.04, attack: 0.2 })
    thud(a, 0.3, 120, 0.05, 0.08)
    click(a, 0.62, 2200, 0.035, 0.015)
  },

  // A carved wheel dropping into its notch: heavier than the padlock's.
  symbolClick(a) {
    click(a, 0, 1900 + Math.random() * 250, 0.2, 0.022)
    thud(a, 0.004, 230, 0.14, 0.06)
    tone(a, { type: 'triangle', from: 1250, to: 900, dur: 0.04, gain: 0.03, attack: 0.001 })
    click(a, 0.045, 2600, 0.05, 0.01)
  },

  // The chest's lock lets go: iron on oak, a short ring, and it settles.
  chestClunk(a) {
    click(a, 0, 1500, 0.2, 0.03)
    thud(a, 0.01, 105, 0.4, 0.24)
    noise(a, { filter: 'lowpass', from: 500, at: 0.01, dur: 0.16, gain: 0.22, attack: 0.002 })
    tone(a, { from: 620, at: 0.01, dur: 0.5, gain: 0.03, attack: 0.002 })
    tone(a, { from: 931, at: 0.01, dur: 0.35, gain: 0.018, attack: 0.002 })
    thud(a, 0.16, 150, 0.14, 0.1)
    click(a, 0.17, 1100, 0.08, 0.03)
  },

  // Dry hinges under a heavy lid, which comes to rest against its stay.
  lidCreak(a) {
    creak(a, 0, 0.9, 0.06, 64)
    creak(a, 0.15, 0.6, 0.025, 96)
    noise(a, { filter: 'lowpass', from: 260, dur: 0.8, gain: 0.04, attack: 0.25 })
    thud(a, 0.86, 110, 0.09, 0.1)
  },

  // Something small and hard dragged a hand's width over a table, twice.
  mimicScrape(a) {
    noise(a, { filter: 'bandpass', from: 1500, to: 900, q: 1.2, dur: 0.18, gain: 0.1, attack: 0.02 })
    noise(a, { filter: 'bandpass', from: 1300, to: 800, q: 1.2, at: 0.22, dur: 0.15, gain: 0.08, attack: 0.02 })
    thud(a, 0.2, 140, 0.05, 0.05)
  },

  // The disguise gives way: pages riffling, then something wet and low.
  mimicReveal(a) {
    for (let i = 0; i < 7; i++)
      click(a, i * 0.03, 3600 + Math.random() * 1800, 0.07, 0.012)
    noise(a, { filter: 'lowpass', from: 420, to: 160, at: 0.05, dur: 0.5, gain: 0.12, attack: 0.04 })
    tone(a, { from: 120, to: 70, at: 0.05, dur: 0.45, gain: 0.08, attack: 0.02 })
  },

  // A heavy ledger page turned: broad paper, one soft settle.
  pageRustle(a) {
    noise(a, { filter: 'bandpass', from: 2600, to: 4200, q: 0.7, dur: 0.22, gain: 0.07, attack: 0.04 })
    noise(a, { filter: 'bandpass', from: 3800, to: 2400, q: 0.7, at: 0.2, dur: 0.2, gain: 0.05, attack: 0.04 })
    thud(a, 0.3, 160, 0.03, 0.06)
  },

  // A folio slid off its shelf: leather on wood.
  bookPull(a) {
    noise(a, { filter: 'bandpass', from: 700, to: 450, q: 0.9, dur: 0.22, gain: 0.08, attack: 0.04 })
    thud(a, 0.2, 180, 0.07, 0.07)
  },

  // Brass wheels on a rail, a long way: a low roll with a click at the stop.
  ladderRoll(a) {
    noise(a, { filter: 'lowpass', from: 320, to: 220, dur: 1.1, gain: 0.1, attack: 0.15 })
    noise(a, { filter: 'bandpass', from: 2200, q: 3, dur: 1.0, gain: 0.025, attack: 0.2 })
    tone(a, { from: 70, to: 60, dur: 1.0, gain: 0.05, attack: 0.1 })
    click(a, 1.1, 1400, 0.1, 0.03)
    thud(a, 1.1, 120, 0.1, 0.1)
  },

  // Cold glass catches: a short rising shimmer.
  lampOn(a) {
    tone(a, { from: 520, to: 1040, dur: 0.35, gain: 0.04, attack: 0.02 })
    tone(a, { from: 1560, to: 2080, at: 0.05, dur: 0.3, gain: 0.02, attack: 0.02 })
    click(a, 0, 2400, 0.08, 0.02)
  },

  // Glass, not metal: thin partials that swell in rather than strike.
  mirrorChime(a) {
    tone(a, { from: 1568, dur: 1.8, gain: 0.035, attack: 0.03 })
    tone(a, { from: 2349.3, at: 0.06, dur: 1.5, gain: 0.022, attack: 0.03 })
    tone(a, { from: 3136, at: 0.12, dur: 1.1, gain: 0.012, attack: 0.03 })
    tone(a, { from: 4228, at: 0.12, dur: 0.8, gain: 0.006, attack: 0.03 })
    noise(a, { filter: 'bandpass', from: 6000, q: 6, dur: 0.5, gain: 0.01, attack: 0.15 })
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
  // Turns the clock off on its next beat rather than mid-swing: the tick that
  // would have come is the silence. sfx.loop('clockTick', true) starts it again.
  stopTick() {
    stopTickOnBeat()
  },
}
