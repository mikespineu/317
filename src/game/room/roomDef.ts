// The shape of a room definition, shared by every room. Definitions are plain
// objects checked with `satisfies RoomDef`, shaped like the JSON the room
// loader will read later (see the GDD). Tokens: 'item:x', 'flag:x', 'clue:x'.
// Coordinates are three.js world space, in metres. Anything the player reads
// is a Localized: one string per language.
import type { Localized } from '#/i18n'

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
  | 'read'

export interface InteractableDef {
  node: string
  type: InteractableType
  // What 'lid' and 'search' prompts call it ("Open the chest lid"), in the
  // accusative where the language has one. Default: the node name, in English.
  name?: Localized
  enabled?: boolean // false: bound and validated, but does nothing (return-visit content)
  requires?: Token
  sets?: Token
  gives?: readonly Token[]
  line?: Localized // what a 'locked', 'inspect' or 'search' answers with
  lockedLine?: Localized // shown when `requires` is not met
  slide?: number // drawer travel
  slideDir?: Vec3 // drawer axis in the node's parent space; default is the node's +Z
  openAngleDeg?: number // door / lid swing, signed
  hingeAxis?: 'x' | 'y' | 'z' // lid hinge; doors always turn about Y
  note?: string // 'read': key into `notes`, opened when the node is used
  // Not usable (no prompt, not aimed at) until every token holds: the panel
  // behind the books that have not been moved yet.
  availableWhen?: Token | readonly Token[]
  // Scenery that moves when a door opens (a ladder), with its Collider_ box.
  // `by` is in the node's parent space.
  moves?: readonly { node: string; by: Vec3; collider?: string }[]
  codeNote?: Localized // HUD note once a clue is known and this lock is still shut
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
  label: Localized // follows "Grab" / "Throw": accusative where the language has one
  throwable?: boolean
}

// One place the Mimic can sit: its marker, the scenery it replaces while it
// is there, and the identical mesh that stands in for it.
export interface MimicSpot {
  spawn: string
  decoy: string
  disguise: string
}

// Ink that exists only inside the UV cone. Planes are placed just off a
// surface in Blender; the art is drawn by `art` (or read from a PNG).
export interface UvTextDef {
  node: string
  art: 'message' | 'hand' | 'digit'
  text?: Localized // 'message'
  digit?: string // 'digit'
  flip?: boolean // 'hand': mirror the picture
  gives?: Token // clue logged once the ink has been lit for a moment
}

export interface GhostDef {
  id: string
  type: 'wisp' | 'ink' | 'mimic'
  mesh: string
  spawn: string
  baseScore: number
  key?: boolean // the ghost the chain depends on
  secret?: boolean // not counted for the stars
  enabled?: boolean
  drops?: { pickup: string; sets: Token } // falls from where the ghost dissolves
  zone?: { min: Vec3; max: Vec3 } // wander box; the room bounds when absent
  whisper?: 'wispWhisper' | 'wispWhisperKey' | 'penScratch' // which loop it uses
  spots?: readonly MimicSpot[] // 'mimic': where it can sit; `spawn` is the first
  route?: readonly string[] // 'ink': Path_ empties, a closed loop
}

export interface NoteDef {
  title: Localized
  body: readonly Localized[]
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
  text: Localized // **X** marks a key cap, *x* is set in italics
  touchText?: Localized // replaces `text` on touch
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
  title: Localized
  scene: string
  spawn: string
  spawnYawDeg?: number // 0 looks north (-Z)
  // uv: false disables the UV lamp in this room, 'lamp' until item:uv-lamp is picked up
  lights?: { uv: boolean | 'lamp' }
  startsWithLight?: boolean // the flashlight is already in hand (it came from the previous room)
  // Interior half-sizes and ceiling, for prop physics and wandering ghosts.
  // Without it the study's numbers from tuning.ts apply.
  bounds?: { halfX: number; halfZ: number; ceiling: number }
  startCharge?: number // 0..1; tuning.startCharge when absent
  parSeconds?: number // third star

  intro?: {
    doors: readonly string[] // open angle from userData.intro_open_deg
    look: string // Spawn_ the view eases toward
    slamAfter: number // s
  }

  atmosphere: {
    // The window the moon shines through; `facing` is the wall it is in.
    window: { x: number; y: number; z: number; w: number; h: number; facing: 'north' | 'south' | 'east' | 'west' }
    moon: Vec3 // shines toward the origin
    fogScale?: number // multiplies tuning.fogDensity; deeper rooms use less
    roomTone?: 'study' | 'hall' | 'library' // idle air and creaks (audio/loops.ts); 'study' when absent
  }

  interactables: readonly InteractableDef[]
  pickups: readonly PickupDef[]
  props: readonly PropDef[]
  ghosts: readonly GhostDef[]

  mirror?: {
    node: string
    testWord?: Localized // a reversed word painted on the facing wall (Level 0's reflection test)
    // Mirror-only writing that grants a clue when read. `text` is what is painted;
    // without it the node's own userData.text is used.
    clue?: { node: string; text?: Localized; gives: Token }
  }

  uvText?: readonly UvTextDef[]
  notes?: Readonly<Record<string, NoteDef>>
  // Running dry with no spares brings this pickup back, at `spawn` when given.
  emergencyPack?: { pickup: string; spawn?: string }

  guide: readonly GuideStep[]
  // Debug panel: each skip applies the earlier ones too (see DebugPanel).
  debugSkips?: readonly DebugSkip[]
  exit: { node: string; requires?: Token }
  nextRoom?: string // id of the room the complete card offers to play next
  complete: {
    eyebrow: Localized
    title?: Localized
    line: Localized
    next?: Localized
    stars?: boolean
  }
  // total: how many there are; found: a token each, counted when it holds;
  // note: why they cannot be found yet
  secrets?: { total: number; found?: readonly Token[]; note?: Localized }
  // Hints on the complete card at other rooms, shown when `when` holds.
  leads?: readonly { when: Token; text: Localized }[]
}
