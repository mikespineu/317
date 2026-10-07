import { tuning } from '../tuning'

// The one AudioContext. Browsers only let it start from a user gesture, so it
// is created on the first pointer/key/touch event; until then `audio()` is
// null and callers drop their sounds. Module-level on purpose: it outlives
// level resets and remounts.

export interface Audio {
  ctx: AudioContext
  master: GainNode
  noise: AudioBuffer // 2 s of white noise, shared by every noise source
}

let engine: Audio | null = null
const unlockListeners: ((a: Audio) => void)[] = []

function create(): Audio | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  const ctx = new Ctor()

  // A gentle limiter so stacked one-shots never clip.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -14
  limiter.knee.value = 10
  limiter.ratio.value = 8
  limiter.attack.value = 0.004
  limiter.release.value = 0.2
  limiter.connect(ctx.destination)

  const master = ctx.createGain()
  master.gain.value = tuning.masterVolume
  master.connect(limiter)

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  return { ctx, master, noise }
}

function unlock() {
  if (!engine) {
    engine = create()
    if (!engine) {
      removeGestureListeners()
      return
    }
  }
  const a = engine
  // Graphs can be built while suspended; they sound once the context runs.
  for (const fn of unlockListeners.splice(0)) fn(a)
  // iOS only accepts some gestures (touchend, not pointerdown), so keep
  // listening until the context really is running.
  const settle = () => {
    if (a.ctx.state === 'running') removeGestureListeners()
  }
  if (a.ctx.state === 'running') settle()
  else if (!document.hidden) a.ctx.resume().then(settle, () => {})
}

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

function removeGestureListeners() {
  for (const type of GESTURES) window.removeEventListener(type, unlock, true)
}

if (typeof window !== 'undefined') {
  // Capture phase, so a handler that stops propagation cannot starve us.
  for (const type of GESTURES) window.addEventListener(type, unlock, true)

  // Nothing should hum in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (!engine) return
    if (document.hidden) void engine.ctx.suspend()
    else void engine.ctx.resume()
  })
}

// The engine, or null before the first gesture (or without Web Audio).
export function audio(): Audio | null {
  if (!engine) return null
  // Follows the debug panel without a per-frame hook.
  engine.master.gain.value = tuning.masterVolume
  return engine
}

// Runs `fn` once audio is available: immediately if it already is.
export function onUnlock(fn: (a: Audio) => void) {
  if (engine) fn(engine)
  else unlockListeners.push(fn)
}

// ---- building blocks -------------------------------------------------------

const SILENT = 0.0001

// Fast attack, exponential decay: the envelope behind every one-shot.
export function envelope(a: Audio, t0: number, dur: number, peak: number, attack = 0.004) {
  const g = a.ctx.createGain()
  g.gain.setValueAtTime(SILENT, t0)
  g.gain.linearRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(SILENT, t0 + dur)
  return g
}

export interface ToneOpts {
  type?: OscillatorType
  from: number // Hz
  to?: number // Hz, glides over the duration
  at?: number // seconds from now
  dur: number
  gain: number
  attack?: number
  dest?: AudioNode
}

export function tone(a: Audio, o: ToneOpts) {
  const t0 = a.ctx.currentTime + (o.at ?? 0)
  const osc = a.ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.from, t0)
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)
  const env = envelope(a, t0, o.dur, o.gain, o.attack)
  osc.connect(env).connect(o.dest ?? a.master)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

export interface NoiseOpts {
  filter?: BiquadFilterType
  from: number // filter Hz
  to?: number // filter Hz, sweeps over the duration
  q?: number
  at?: number
  dur: number
  gain: number
  attack?: number
  dest?: AudioNode
}

export function noise(a: Audio, o: NoiseOpts) {
  const t0 = a.ctx.currentTime + (o.at ?? 0)
  const src = a.ctx.createBufferSource()
  src.buffer = a.noise
  src.loop = true
  const filter = a.ctx.createBiquadFilter()
  filter.type = o.filter ?? 'bandpass'
  filter.Q.value = o.q ?? 1
  filter.frequency.setValueAtTime(o.from, t0)
  if (o.to !== undefined) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)
  const env = envelope(a, t0, o.dur, o.gain, o.attack)
  src.connect(filter).connect(env).connect(o.dest ?? a.master)
  // A random offset so repeated clicks do not sound identical.
  src.start(t0, Math.random() * 1.5)
  src.stop(t0 + o.dur + 0.05)
}

// A dry wooden groan: a slow sawtooth through a resonant band, pitch wavering.
export function creak(a: Audio, at: number, dur: number, gain: number, base = 78) {
  const t0 = a.ctx.currentTime + at
  const osc = a.ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(base, t0)
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    const f = base * (1 + 0.35 * (i / steps) + (Math.random() - 0.5) * 0.25)
    osc.frequency.linearRampToValueAtTime(f, t0 + (dur * i) / steps)
  }
  const filter = a.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 9
  filter.frequency.setValueAtTime(700, t0)
  filter.frequency.linearRampToValueAtTime(1150, t0 + dur)
  const env = a.ctx.createGain()
  env.gain.setValueAtTime(SILENT, t0)
  env.gain.linearRampToValueAtTime(gain, t0 + dur * 0.3)
  env.gain.linearRampToValueAtTime(gain * 0.6, t0 + dur * 0.7)
  env.gain.exponentialRampToValueAtTime(SILENT, t0 + dur)
  osc.connect(filter).connect(env).connect(a.master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}
