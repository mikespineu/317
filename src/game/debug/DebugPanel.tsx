import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Leva, button, buttonGroup, folder, monitor, useControls } from 'leva'
import { interactWith, lockCode, tryCode } from '../interaction/actions'
import { postSettings } from '../renderer/postprocessing'
import { quality } from '../renderer/quality'
import { level0 } from '../room/level0.def'
import { runtime } from '../runtime'
import { levelOf, useGame } from '../store'
import { tuning } from '../tuning'
import { debugState } from './debugState'
import './debug-panel.css'

// The leva debug panel (?debug). It lives in its own React root so that key
// presses inside it can be stopped before they reach the game's document
// listeners, and so that nothing in here can re-render the game.

type Schema = Parameters<typeof folder>[0]
type SchemaItem = Schema[string]
type Bag = Record<string, unknown>
type SetFn = (values: Bag) => void

const MONITOR_MS = 250
const narrow = window.matchMedia('(pointer: coarse)').matches

// ---- level -----------------------------------------------------------------

// The drawer and its lock, found by shape rather than by name.
const drawer = level0.interactables.find((i) => 'lock' in i)

const flag = (id: string) => !!useGame.getState().flags[id]

// The Level 0 chain, in order. Skipping to a step applies the earlier ones
// too. Steps 2 and 3 go through the interaction system's own actions, so the
// padlock drops and the drawer slides as if the player had done it; the flag
// is set directly only when that did nothing (room not loaded yet).
const CHAIN: [label: string, run: () => void][] = [
  ['Skip to 1: clue found', () => useGame.getState().addClue('drawer-code')],
  [
    'Skip to 2: drawer unlocked',
    () => {
      if (flag('drawer-unlocked')) return
      if (drawer) tryCode(drawer.node, lockCode(drawer.node))
      if (!flag('drawer-unlocked')) useGame.getState().setFlag('drawer-unlocked')
    },
  ],
  [
    'Skip to 3: drawer open',
    () => {
      if (flag('drawer-open')) return
      if (drawer) interactWith(drawer.node)
      if (!flag('drawer-open')) useGame.getState().setFlag('drawer-open')
    },
  ],
  [
    'Skip to 4: key in inventory',
    () => {
      const s = useGame.getState()
      if (s.pickedUp.Pickup_Key) return // never hand out a second key
      s.addItem('key')
      s.setPickedUp('Pickup_Key', true)
    },
  ],
]

function skipTo(step: number) {
  for (let i = 0; i <= step; i++) CHAIN[i][1]()
}

function chainSummary() {
  const s = useGame.getState()
  const mark = (on: boolean) => (on ? '+' : '-')
  return [
    `clue ${mark(s.clues.includes('drawer-code'))}`,
    `unlocked ${mark(!!s.flags['drawer-unlocked'])}`,
    `open ${mark(!!s.flags['drawer-open'])}`,
    `key ${s.items.key ?? 0}`,
  ].join('  ')
}

// ---- battery ---------------------------------------------------------------

// The live charge is runtime.battery.charge; the store only follows its level.
function setCharge(charge: number) {
  runtime.battery.charge = charge
  useGame.getState().setBatteryLevel(levelOf(charge))
}

// ---- renderer --------------------------------------------------------------

// Reloads with the query changed. ?debug is always kept, or the panel that
// was just clicked would be gone after the reload.
function reloadWith(change: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href)
  change(url.searchParams)
  url.searchParams.set('debug', '')
  window.location.assign(url)
}

const query = new URLSearchParams(window.location.search)

function flagButton(flag: string, onLabel: string, offLabel: string): Schema {
  const active = query.has(flag)
  return {
    [active ? offLabel : onLabel]: button(() =>
      reloadWith((p) => (active ? p.delete(flag) : p.set(flag, ''))),
    ),
  }
}

// ---- toggles (post effects, overlays) --------------------------------------

// One checkbox per boolean key of a mutable settings object, written straight
// back into it; the readers poll these objects every frame.
function toggles(target: object): Schema {
  const bag = target as Bag
  const schema: Schema = {}
  for (const key of Object.keys(bag)) {
    if (typeof bag[key] !== 'boolean') continue
    schema[key] = {
      value: bag[key] as boolean,
      onChange: (v: boolean) => {
        bag[key] = v
      },
    }
  }
  return schema
}

// ---- tuning ----------------------------------------------------------------

const tuningBag = tuning as unknown as Bag
// Captured before anything can edit them: "Reset tuning" goes back to these.
const tuningDefaults: Bag = { ...tuningBag }

// First match wins, so the specific prefixes come before the broad ones
// (uvDrainSeconds is battery, not beam; uvHumVolume is audio).
const GROUPS: [name: string, match: RegExp][] = [
  ['wisp', /^(wisp|ghost)/],
  ['camera', /^(photo|camera|aimAssist|shutter)/],
  ['mirror', /^mirror/],
  ['post', /^(bloom|vignette|grain|grade)/],
  ['audio', /(Volume|Gain)$|^(creak|audio|master)/],
  ['atmosphere', /^(moon|ambient|fog|background)/],
  ['battery', /Drain|Charge|^(level|swap|emergency|modeSwitch|lowTick|battery)/],
  ['player', /^(eye|player|walk|pitch|joystick|tap|maxFrame|touch|mouse|look)|Sensitivity$/],
  ['interaction', /^(reach|drawer|door|padlock|message|complete|highlight|interact|pickup)/],
  [
    'light',
    /^(white|uv|light|shadow|held|flicker|sputter|emptyGlow|lowStrength|strengthCurve|cone|dust|reveal|clue|beam)/,
  ],
]

function groupOf(key: string) {
  return GROUPS.find(([, match]) => match.test(key))?.[0] ?? 'other'
}

const UNIT = /(Opacity|Frac|Fraction|Chance|Deadzone|Quality|Tint|Volume|Charge)$|^level|Weight/
const SIGNED = /(Offset|Bias)|[a-z][XYZ]$/
const WHOLE = /(Every|Count|Px|Ms|Width|Height|Size)$/

interface Range {
  scale: number // the panel shows value * scale
  min: number
  max: number
  step: number
}

// A range and step from nothing but the key name and its default. Leva shows
// at most two decimals and commits the shown text on blur, so tiny defaults
// (mouse sensitivity, shadow bias) are edited in thousandths instead.
function rangeOf(key: string, def: number): Range {
  const abs = Math.abs(def)
  const scale = abs > 0 && abs < 0.1 ? 1000 : 1
  const shown = abs * scale
  const whole = Number.isInteger(def) && (WHOLE.test(key) || shown >= 100)
  const step = whole ? 1 : shown < 10 ? 0.01 : 0.1

  if (def === 0) return { scale, min: -1, max: 1, step }
  if (key.endsWith('Deg'))
    return { scale, min: 0, max: abs <= 90 ? 90 : 360, step: Number.isInteger(def) ? 1 : 0.1 }

  let max = +(shown * 4).toPrecision(2)
  if (scale === 1 && abs <= 1 && UNIT.test(key)) max = 1
  if (def < 0 || SIGNED.test(key)) return { scale, min: -max, max, step }
  return { scale, min: whole && /Every$/.test(key) ? 1 : 0, max, step }
}

const ranges = new Map<string, Range>()

// What leva holds for a key, given the real tuning value.
function toPanel(key: string, value: unknown) {
  const range = ranges.get(key)
  return range ? +((value as number) * range.scale).toPrecision(12) : value
}

function tuningItem(key: string): SchemaItem | null {
  const def = tuningDefaults[key]
  const write = (v: unknown) => {
    tuningBag[key] = v
  }
  if (typeof def === 'boolean') return { value: tuningBag[key] as boolean, onChange: write }
  // Colours are neither numeric nor boolean, but they are tuning all the same.
  if (typeof def === 'string')
    return /^#[0-9a-f]{6}$/i.test(def) ? { value: tuningBag[key] as string, onChange: write } : null
  if (typeof def !== 'number' || !Number.isFinite(def)) return null

  const range = rangeOf(key, def)
  ranges.set(key, range)
  const { scale, min, max, step } = range
  return {
    value: toPanel(key, tuningBag[key]) as number,
    min,
    max,
    step,
    label: scale === 1 ? key : `${key} e-3`,
    onChange: (v: number) => {
      tuningBag[key] = scale === 1 ? v : v / scale
    },
  }
}

// Built from whatever keys tuning.ts has, so new keys show up by themselves.
function tuningFolders(): { schema: Schema; keys: string[] } {
  const groups = new Map<string, Schema>()
  const keys: string[] = []
  for (const key of Object.keys(tuningBag)) {
    const item = tuningItem(key)
    if (!item) continue
    keys.push(key)
    const name = groupOf(key)
    if (!groups.has(name)) groups.set(name, {})
    groups.get(name)![key] = item
  }
  // Folders in the order of GROUPS, 'other' last.
  const order = [...GROUPS.map(([name]) => name), 'other']
  const schema: Schema = {}
  for (const name of order) {
    const group = groups.get(name)
    if (group) schema[name] = folder(group, { collapsed: true })
  }
  return { schema, keys }
}

function copyTuning(keys: string[]) {
  const json = JSON.stringify(Object.fromEntries(keys.map((k) => [k, tuningBag[k]])), null, 2)
  const fallback = () => console.info(`[debug] clipboard unavailable, tuning:\n${json}`)
  // navigator.clipboard is missing on plain http (the phone on the LAN).
  if (!navigator.clipboard?.writeText) return fallback()
  navigator.clipboard.writeText(json).then(() => console.info('[debug] tuning copied'), fallback)
}

// ---- panel -----------------------------------------------------------------

const closed = { collapsed: true }

function Controls() {
  useControls(
    'Level',
    () => ({
      'Reset level': button(() => useGame.getState().resetLevel()),
      'Reload page': button(() => window.location.reload()),
      'Complete level': button(() => useGame.getState().setUiLock('complete')),
      // (Reset level undoes it.)
      ...Object.fromEntries(CHAIN.map(([label], i) => [label, button(() => skipTo(i))])),
      chain: monitor(chainSummary, { interval: MONITOR_MS }),
    }),
    closed,
  )

  useControls(
    'Battery / light',
    () => ({
      'Fill battery': button(() => setCharge(1)),
      // Just under the medium threshold, so the low flicker starts at once.
      'Drain to low': button(() => setCharge(Math.max(0.01, tuning.levelMedium - 0.02))),
      'Empty battery': button(() => setCharge(0)),
      'Add spare pack': button(() => useGame.getState().addItem('battery')),
      charge: monitor(
        () => {
          const s = useGame.getState()
          return `${(runtime.battery.charge * 100).toFixed(1)}% ${s.batteryLevel}, ${s.spares} spare`
        },
        { interval: MONITOR_MS },
      ),
      light: monitor(
        () => {
          const s = useGame.getState()
          return `${s.lightOn ? 'on' : 'off'} ${s.lightMode}, beam ${runtime.beam.strength.toFixed(2)}`
        },
        { interval: MONITOR_MS },
      ),
    }),
    closed,
  )

  useControls(
    'Player',
    () => ({
      position: monitor(
        () => {
          const p = runtime.player.position
          return `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`
        },
        { interval: MONITOR_MS },
      ),
      'yaw / pitch': monitor(
        () => {
          const deg = (rad: number) => ((rad * 180) / Math.PI).toFixed(0)
          return `${deg(runtime.player.yaw)} / ${deg(runtime.player.pitch)} deg`
        },
        { interval: MONITOR_MS },
      ),
    }),
    closed,
  )

  useControls(
    'Wisp',
    () => ({
      state: monitor(() => runtime.wisp.state, { interval: MONITOR_MS }),
      exposure: monitor(() => runtime.wisp.exposure.toFixed(2), { interval: MONITOR_MS }),
    }),
    closed,
  )

  useControls(
    'Renderer',
    () => ({
      backend: monitor(() => useGame.getState().backend ?? 'starting', { interval: 1000 }),
      preset: { value: quality.name as string, editable: false },
      ...flagButton('webgl', 'Reload with ?webgl (force WebGL 2)', 'Reload without ?webgl'),
      ...flagButton('greybox', 'Reload with ?greybox', 'Reload without ?greybox'),
      'reload quality': buttonGroup({
        label: '?quality=',
        opts: {
          auto: () => reloadWith((p) => p.delete('quality')),
          phone: () => reloadWith((p) => p.set('quality', 'phone')),
          desktop: () => reloadWith((p) => p.set('quality', 'desktop')),
        },
      }),
    }),
    closed,
  )

  useControls('Post effects', () => toggles(postSettings), closed)
  useControls('Overlays', () => toggles(debugState), closed)

  const setTuning = useRef<SetFn | null>(null)
  const [, set] = useControls(
    'Tuning',
    () => {
      const { schema, keys } = tuningFolders()
      return {
        'Reset tuning': button(() => {
          const values: Bag = {}
          for (const key of keys) {
            tuningBag[key] = tuningDefaults[key]
            values[key] = toPanel(key, tuningDefaults[key])
          }
          setTuning.current?.(values)
        }),
        'Copy tuning JSON': button(() => copyTuning(keys)),
        ...schema,
      }
    },
    closed,
  )
  setTuning.current = set as unknown as SetFn

  return null
}

function Panel() {
  return (
    <>
      <Leva
        collapsed
        titleBar={{ title: 'debug', filter: true, drag: true }}
        theme={{
          sizes: narrow
            ? { rootWidth: '250px', controlWidth: '110px' }
            : { rootWidth: '340px', controlWidth: '150px' },
        }}
      />
      <Controls />
    </>
  )
}

const MODIFIERS = new Set(['Shift', 'Alt', 'Control', 'Meta'])

// Mounted by Game.tsx only when DEBUG is true.
export function DebugPanel() {
  useEffect(() => {
    const host = document.createElement('div')
    host.className = 'debug-panel-host'
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(<Panel />)

    // React's own listeners sit on the host and were added first, so leva
    // still gets the key; the game's listeners on document never see it.
    // Modifiers pass, leva tracks Shift / Alt on window for its step size.
    const stopKey = (e: KeyboardEvent) => {
      if (!MODIFIERS.has(e.key)) e.stopPropagation()
    }
    host.addEventListener('keydown', stopKey)

    return () => {
      host.removeEventListener('keydown', stopKey)
      // Not during React's own commit.
      setTimeout(() => {
        root.unmount()
        host.remove()
      }, 0)
    }
  }, [])

  return null
}
