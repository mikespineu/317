// The shape of a room definition, shared by every room. Definitions are plain
// objects checked with `satisfies RoomDef`, shaped like the JSON the room
// loader will read later (see the GDD). Tokens: 'item:x', 'flag:x', 'clue:x'.
// Coordinates are three.js world space, in metres.
export type Token = string
export type Vec3 = readonly [number, number, number]

// A numeric padlock ('3-1-7') or a symbol lock (one symbol id per wheel).
export interface CodeLockDef {
  type: 'code'
  code: string
  mesh: string // scenery that drops when the lock opens
  sets: Token
}
export interface SymbolLockDef {
  type: 'symbol'
  code: readonly string[]
  wheels: readonly string[] // the symbols every wheel cycles through
  mesh: string
  sets: Token
}
export type LockDef = CodeLockDef | SymbolLockDef

export type InteractableType =
  | 'drawer'
  | 'door'
  | 'candle'
  | 'uv-reveal'
  | 'search'
  | 'lid'
  | 'locked'
  | 'inspect'

export interface InteractableDef {
  node: string
  type: InteractableType
  enabled?: boolean // false: bound and validated, but does nothing (return-visit content)
  requires?: Token
  sets?: Token
  gives?: readonly Token[]
  line?: string // what a 'locked', 'inspect' or 'search' answers with
  lockedLine?: string // shown when `requires` is not met
  slide?: number // drawer travel
  slideDir?: Vec3 // drawer axis in the node's parent space; default is the node's +Z
  openAngleDeg?: number // door / lid swing, signed
  hingeAxis?: 'x' | 'y' | 'z' // lid hinge; doors always turn about Y
  lock?: LockDef
  // 'candle': wick positions in the node's own space, one flame each. Without
  // it there is a single flame on top of the node's bounding box.
  flames?: readonly Vec3[]
}

export interface PickupDef {
  node: string
  item: string
  // A pickup the room file does not contain: loaded and placed by the room loader.
  model?: string
  at?: Vec3
  yawDeg?: number
  glow?: boolean // a faint warm light so it can be found in the dark
  visibleWhen?: Token
  note?: string // key into `notes`: picking it up opens the note
  hidden?: true // never shown or picked up; given by something else (a search)
}

// Loose scenery that is more than set dressing. `throwable: true` makes a
// prop grabbable and throwable with the prop physics.
export interface PropDef {
  node: string
  label: string
  throwable?: boolean
}

export interface GhostDef {
  id: string
  type: 'wisp' | 'ink'
  mesh: string
  spawn: string
  baseScore: number
  key?: boolean // the ghost the chain depends on
  secret?: boolean // not counted for the stars
  enabled?: boolean
  drops?: { pickup: string; sets: Token } // falls from where the ghost dissolves
  zone?: { min: Vec3; max: Vec3 } // wander box; the room bounds when absent
  whisper?: 'wispWhisper' | 'wispWhisperKey' // which whisper loop it uses
}

export interface NoteDef {
  title: string
  body: readonly string[]
  gives?: Token
}

// A standing instruction. The first step whose conditions hold and whose
// delay (seconds of play since they started to hold) has passed is shown, so
// a later, more specific step goes above the one it replaces. Besides the
// item / flag / clue tokens, conditions may use the read-only ones listed in
// puzzle/chain.ts ('light:held', 'camera:raised', 'picked:Pickup_X', ...).
export interface GuideStep {
  id: string
  when?: Token | readonly Token[] // all must hold
  unless?: Token | readonly Token[] // none may hold
  delay: number
  delayKey?: string // a tuning.ts key that replaces `delay`, so it stays live in the debug panel
  text: string // **X** marks a key cap, *x* is set in italics
  touchText?: string // replaces `text` on touch
}

// One step of the debug panel's "Skip to" list. Every part is skipped when
// it is already done, and they run in this order: `unlock`, `use`, `give`,
// `take`. `unlock` and `use` go through the real actions; `give` then sets
// whatever those left unset (nothing, unless the room has not loaded).
export interface DebugSkip {
  label: string
  unlock?: string // interactable whose lock is opened with its own code
  use?: string // interactable to operate, unless its `sets` already holds
  give?: readonly Token[] // flags and clues only; items come from `take`
  take?: string // Pickup_ node: marked as taken and its item added, once
}

export interface RoomDef {
  id: string
  title: string
  scene: string
  spawn: string
  spawnYawDeg?: number // 0 looks north (-Z)
  lights?: { uv: boolean } // uv: false disables the UV lamp in this room
  startCharge?: number // 0..1; tuning.startCharge when absent
  parSeconds?: number // third star

  intro?: {
    doors: readonly string[] // open angle from userData.intro_open_deg
    look: string // Spawn_ the view eases toward
    slamAfter: number // s
  }

  atmosphere: {
    // The window the moon shines through; `facing` is the wall it is in.
    window: { x: number; y: number; z: number; w: number; h: number; facing: 'north' | 'south' }
    moon: Vec3 // shines toward the origin
    fogScale?: number // multiplies tuning.fogDensity; deeper rooms use less
    roomTone?: 'study' | 'hall' // idle air and creaks (audio/loops.ts); 'study' when absent
  }

  interactables: readonly InteractableDef[]
  pickups: readonly PickupDef[]
  props: readonly PropDef[]
  ghosts: readonly GhostDef[]

  mirror?: {
    node: string
    testWord?: string // a reversed word painted on the facing wall (Level 0's reflection test)
    clue?: { node: string; gives: Token } // mirror-only writing that grants a clue when read
  }

  notes?: Readonly<Record<string, NoteDef>>
  // Running dry with no spares brings this pickup back, at `spawn` when given.
  emergencyPack?: { pickup: string; spawn?: string }

  guide: readonly GuideStep[]
  // Debug panel: each skip applies the earlier ones too (see DebugPanel).
  debugSkips?: readonly DebugSkip[]
  exit: { node: string; requires?: Token }
  complete: { eyebrow: string; title?: string; line: string; next?: string; stars?: boolean }
  secrets?: { total: number; note?: string } // note: why they cannot be found yet
}
