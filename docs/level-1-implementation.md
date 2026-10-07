# 3.17 — Level 1 implementation plan

Oct 7, 2026 · companion to [`game-design-document.md`](./game-design-document.md), [`level-1-blender-asset-spec.md`](./level-1-blender-asset-spec.md) and [`level-0-implementation.md`](./level-0-implementation.md)

Level 1 is Room 1 of the mansion, the **Entrance Hall**: the first real room, free, white light only, about 7 minutes on a first play. It reuses every Level 0 system and adds what the hall needs: an intro, a chain of five links, a ghost that drops a key, writing that exists only in the mirror, a symbol lock, two Wisps at once and a proper room-complete card. It is done when a new player gets from the slammed front door to the open Library door in about 7 minutes, on a laptop and on an iPhone 15 Pro in landscape, without reading anything outside the game.

This file is the coding plan. The Blender spec owns sizes, names and export rules; this file owns how the code reads them. Level 0's plan stays the reference for every system that is reused unchanged; this file only describes what is new or different.

---

## 1. Scope

**The room in one line:** intro (door slams) → flashlight → photograph the key Wisp, it drops a brass key → brass key opens the writing desk, letter inside → the mirror shows "Eldest first" above the portraits → portraits give moon, bat, pumpkin → symbol lock on the chest → Library key → Library door.

**In scope**

- **Engine made room-agnostic:** any room definition can be played; Level 0 keeps working unchanged.
- Loading `level-1.glb`, its colliders, spawns and the new `MirrorOnly_` prefix.
- **Intro:** the front doors slam, the clock's ticking stops, darkness; about 3 s, skippable.
- **White light only:** no UV lamp in this room (the UV switch, its hint and its touch button are off).
- **Several ghosts at once:** the key Wisp and the gallery Wisp, each with its own wander zone.
- **A ghost that drops an item:** the key Wisp drops `Pickup_Brass_Key` when it dissolves.
- **New interactable types:** drawer on any axis with a key requirement, a readable note, a searchable coat pocket, a hinged chest lid, locked doors that only answer with a line, an inspectable portrait plaque.
- **Mirror-only content:** objects drawn only into the mirror's reflection.
- **Symbol lock UI:** three wheels of symbols for the chest.
- **Room-complete card:** time, stars, best photos, "secrets 0 of 2".
- Guide labels that teach this room's steps without a tutorial.
- Debug additions: room switcher, chain skips for Level 1, ghost monitors, a mirror-only toggle.

**Out of scope:** login, Supabase, saving, the journal and paid hints, leaderboards, the JSON room loader (definitions stay TypeScript), the mansion map, the return visit with UV (the clock note and the secret Ink Ghost), the Library itself. The return-visit content is listed in the definition as disabled entries, so nothing has to be renamed later.

**Done when**

- [ ] Spawn to open Library door in about 7 minutes for a first-time player, 10 at most, with no dead ends (playtest with at least two people who have not seen the room)
- [ ] The mirror moment works: players notice the text in the reflection, and turning round to a blank wall reads as a surprise, not a bug
- [ ] Smooth on a mid-range laptop and an iPhone 15 Pro in landscape, in the worst view (light on, mirror in view, both Wisps visible)
- [ ] Level 0 still plays exactly as before (`/play?room=level-0`)

---

## 2. What carries over from Level 0

| System | Level 1 | Change |
| --- | --- | --- |
| Renderer, quality presets, post-processing, print look | Reused | None; values settled in Level 0 apply |
| Player controller, desktop and touch input, collision | Reused | Spawn yaw from the definition |
| Flashlight, battery, cone, dust | Reused | `lights.uv: false` disables UV in this room |
| UV reveal (`uvMask`) | Not used in Room 1 | Kept for the return visit |
| Interaction ray, highlight, prompts, item bar | Reused | New action types (§8, Step 6) |
| Padlock UI | Pattern reused | `SymbolLockUI` is a sibling, not a rewrite |
| Chain evaluator (`chain.ts`) | Reused as is | New tokens only |
| Prop physics | Reused | No throwables required; small props can opt in |
| Candle | Reused | Optional on the candelabra |
| Mirror (TSL reflector) | Extended | Mirror-only layer; the Level 0 test word becomes Level 0 data |
| Wisp (brain, material, cloth) | Extended | Several instances, per-ghost zone, item drop |
| Camera, photo scoring, photo card | Extended | Scores the best ghost in frame, not `ghosts[0]` |
| Atmosphere (moon, fog, window patch) | Extended | Window and moon position from the definition |
| HUD, guide labels, complete card | Extended | Guide steps and card text from the definition |
| Debug panel | Extended | Room switcher, per-room skips, ghost list |
| Audio | Extended | Clock tick, door slam, hall room tone |

---

## 3. Project structure

New and changed files only.

```
src/game/
  Game.tsx                       # mounts <Room def={…} key={epoch} /> instead of <Level0 />
  Room.tsx                       # was Level0.tsx: generic scene composition for any definition
  room/
    rooms.ts                     # registry: { 'level-0': level0, 'entrance-hall': level1 }, picks from ?room=
    roomDef.ts                   # RoomDef types shared by every definition (no longer typeof level0)
    RoomContext.tsx              # useRoomDef(); systems read the current definition from here
    level0.def.ts                # gains mirror.testWord, atmosphere, guide, complete card text
    level1.def.ts                # new: the Entrance Hall
    mergeStatic.ts               # new: merge static scenery per material after binding (draw calls)
  intro/
    Intro.tsx                    # door slam sequence, input lock, skip
  ghost/
    Ghosts.tsx                   # one <Wisp> per ghost in the definition
    Wisp.tsx                     # takes a ghost def; writes runtime.ghosts[id]
    dropItem.ts                  # key Wisp → Pickup_Brass_Key falls to the floor
  interaction/
    actions.ts                   # reads useRoomDef(); new types: note, search, lid, locked, inspect
  puzzle/
    SymbolLockUI.tsx             # three symbol wheels
    symbols.ts                   # icon set (moon, bat, pumpkin, key, eye) as SVG paths
    NoteUI.tsx                   # letter overlay on paper
  mirror/
    Mirror.tsx                   # + mirror-only layer, + test word only if the definition has one
    mirrorClue.ts                # logs the clue when the mirror-only text is seen lit
  ui/
    CompleteCard.tsx             # moved out of Hud.tsx; time, stars, photos, secrets
    guide.ts                     # guide steps from the definition, evaluated against the store
scripts/
  copy-assets.mjs                # copies by prefix: level-0*.glb → models/level0, level-1*.glb → models/level1, held items → models/shared
public/
  models/shared/flashlight.glb, camera.glb
  models/level1/level-1.glb
  textures/level1/                # mirror-text.png, portraits, plaques, symbols (later; canvas stand-ins first)
```

---

## 4. The Blender ↔ code contract, additions

Everything in Level 0's contract still holds. New for Level 1:

| Prefix / name | Code behaviour |
| --- | --- |
| `MirrorOnly_*` | Hidden in the main view and in shadow maps; shown only while the mirror's reflection renders (Step 7) |
| Ghost meshes named in the definition (`Wisp_Key`, `Wisp_Gallery`) | Detached and driven by `<Wisp>` as in Level 0; both share one mesh in the .glb |
| Scenery named by a definition entry (`Front_Door_L`, `Portrait_N_Plaque`, `Boarded_Door`) | Bound as interactables without the `Interact_` prefix, as the candle already is |
| `Chest_SymbolLock` | Scenery like `Desk_Padlock`: drops when the lock opens |
| glTF extras | Arrive as `userData`: `intro_open_deg` on the front doors, `birth_year` / `symbol` on the portraits, `solution` on the lock (the definition stays the source of truth; extras are checked against it in dev) |

**Axes, once more for this room:** Blender (x, y, z) becomes three.js (x, z, −y). The hall's north (Blender +Y) is three.js −Z, so a yaw of 0 looks north at the stairs and the clock. Spawn at Blender (0, −3.2) is three.js (0, 1.6, 3.2).

**Pivots the code relies on**

| Node | Pivot | Motion in three.js |
| --- | --- | --- |
| `Front_Door_L` / `_R` | Outer hinge, floor | Rotate about Y; open = `userData.intro_open_deg`, closed = 0 |
| `Interact_Library_Door` | South hinge, floor; leaf along −Z | Rotate about Y, away from the hall (sign set in Step 10) |
| `Interact_Writing_Desk_Drawer` | Back centre | Slide along +X |
| `Interact_Chest_Lid` | Back hinge edge | Rotate about X, front edge up (negative angle) |
| `Chest_SymbolLock` | Plate centre | Drops to the floor and fades |

**Nodes in `blender/export/level-1.glb`** (from the build script's printout):

```
Interactables  Front_Door_L  Front_Door_R  Interact_Library_Door  Library_Door_Handle
               Interact_Writing_Desk_Drawer  Interact_Chest_Lid  Chest_SymbolLock
               Interact_Clock_Glass  Interact_Coat_Pocket  Mirror_Surface
Pickups        Pickup_Brass_Key  Pickup_Letter  Pickup_Library_Key
               Pickup_Battery_Console  Pickup_Battery_Coat
MirrorOnly     MirrorOnly_Text
Ghosts         Wisp_Key  Wisp_Gallery
Spawns         Spawn_Player  Spawn_Wisp_Key  Spawn_Wisp_Gallery  Spawn_InkGhost
               Spawn_Battery_Emergency  Spawn_Intro_Look
Colliders      Collider_Wall_N/S/W  Collider_Wall_E_S  Collider_Wall_E_N  Collider_Front_Door
               Collider_Library_Door  Collider_Vestibule_Back/S/N  Collider_Stairs  Collider_Clock
               Collider_Console  Collider_Writing_Desk  Collider_Hall_Chair  Collider_Chest
               Collider_Coat_Rack  Collider_Umbrella_Stand  Collider_Floor  Collider_Ceiling
Scenery        Portrait_1..3_Frame/_Canvas/_Plaque  Grandfather_Clock  Clock_Face  Clock_Pendulum
               Stairs  Landing  Banister  Banister_Broken  Chandelier  … (static)
```

---

## 5. Room definition

`roomDef.ts` holds the types; each definition is a plain object checked against them (`satisfies RoomDef`), no longer `typeof level0`. Coordinates in the definition are three.js world space.

```ts
// game/room/level1.def.ts
export const level1 = {
  id: 'entrance-hall',
  title: 'The Entrance Hall',
  scene: '/models/level1/level-1.glb',
  spawn: 'Spawn_Player',
  spawnYawDeg: 0, // facing north: the stairs and the clock
  lights: { uv: false }, // the UV lamp is found in Room 2
  startCharge: 0.5,
  parSeconds: 480,

  intro: {
    doors: ['Front_Door_L', 'Front_Door_R'], // open angle from userData.intro_open_deg
    look: 'Spawn_Intro_Look',
    slamAfter: 1.4, // s
  },

  atmosphere: {
    window: { x: -1.9, y: 1.8, z: 4.0, w: 0.84, h: 2.24, facing: 'south' },
    moon: [-3.5, 6.0, 9.0], // behind the south window, shining in toward the hall
  },

  interactables: [
    { node: 'Front_Door_L', type: 'locked', line: "It won't budge. Something is holding it shut." },
    { node: 'Front_Door_R', type: 'locked', line: "It won't budge. Something is holding it shut." },
    { node: 'Boarded_Door', type: 'locked', line: 'Boarded up from this side. Not yet.' },
    {
      node: 'Interact_Writing_Desk_Drawer',
      type: 'drawer',
      slide: 0.32,
      slideDir: [1, 0, 0],
      requires: 'item:brass-key',
      lockedLine: 'Locked. A small brass keyhole.',
      sets: 'flag:desk-open',
    },
    { node: 'Interact_Coat_Pocket', type: 'search', gives: ['item:battery'], line: 'A battery pack, in the coat pocket.' },
    { node: 'Portrait_1_Plaque', type: 'inspect', line: 'A brass plaque: 1874.' },
    { node: 'Portrait_2_Plaque', type: 'inspect', line: 'A brass plaque: 1869.' },
    { node: 'Portrait_3_Plaque', type: 'inspect', line: 'A brass plaque: 1877.' },
    {
      node: 'Interact_Chest_Lid',
      type: 'lid',
      hingeAxis: 'x',
      openAngleDeg: -100,
      lock: {
        type: 'symbol',
        code: ['moon', 'bat', 'pumpkin'],
        wheels: ['moon', 'bat', 'pumpkin', 'key', 'eye'],
        mesh: 'Chest_SymbolLock',
        sets: 'flag:chest-unlocked',
      },
      sets: 'flag:chest-open',
    },
    { node: 'Interact_Library_Door', type: 'door', requires: 'item:library-key', openAngleDeg: -95 },
    // Return visit (Room 2 gives the UV lamp). Present now so names never change.
    { node: 'Interact_Clock_Glass', type: 'uv-reveal', gives: ['clue:clock-time'], enabled: false,
      line: 'A note behind the glass, smeared past reading.' },
  ],

  pickups: [
    { node: 'Pickup_Flashlight', item: 'flashlight', model: '/models/shared/flashlight.glb',
      at: [0.4, 0.042, 2.9], yawDeg: 20, glow: true },
    { node: 'Pickup_Brass_Key', item: 'brass-key', visibleWhen: 'flag:brass-key-dropped' },
    { node: 'Pickup_Letter', item: 'letter', visibleWhen: 'flag:desk-open', note: 'letter' },
    { node: 'Pickup_Library_Key', item: 'library-key', visibleWhen: 'flag:chest-open' },
    { node: 'Pickup_Battery_Console', item: 'battery' },
    { node: 'Pickup_Battery_Coat', item: 'battery', hidden: true }, // given by the search, never shown
  ],

  props: [],

  ghosts: [
    { id: 'wisp-key', type: 'wisp', mesh: 'Wisp_Key', spawn: 'Spawn_Wisp_Key', baseScore: 100,
      key: true, drops: { pickup: 'Pickup_Brass_Key', sets: 'flag:brass-key-dropped' },
      zone: { min: [-1.8, 1.0, -2.2], max: [1.8, 2.0, 2.4] } }, // open floor, below the chandelier
    { id: 'wisp-gallery', type: 'wisp', mesh: 'Wisp_Gallery', spawn: 'Spawn_Wisp_Gallery', baseScore: 150,
      zone: { min: [-2.8, 2.7, -3.9], max: [-1.7, 3.4, -2.9] } }, // above the landing
    // { id: 'ink-1', type: 'ink', spawn: 'Spawn_InkGhost', secret: true, enabled: false },
  ],

  mirror: { node: 'Mirror_Surface', clue: { node: 'MirrorOnly_Text', gives: 'clue:eldest-first' } },

  notes: {
    letter: {
      title: 'A letter, unsigned',
      body: [
        'Whoever moved the portraits, put them back.',
        'The order is not yours to choose.',
        'This house only tells the truth to the glass.',
      ],
      gives: 'clue:letter',
    },
  },

  guide: [ /* see Step 12 */ ],
  exit: { node: 'Interact_Library_Door', requires: 'item:library-key' },
  complete: { eyebrow: '3.17 · the entrance hall', line: 'The Library door gives. Paper and dust.', next: 'The Library' },
  secrets: { total: 2 }, // the clock note and the Ink Ghost, both after Room 2
} satisfies RoomDef
```

- Every coordinate above is converted from the Blender spec; check each against the dev console's bound-node printout in Step 2.
- `enabled: false` entries are bound and validated but do nothing, so the return visit only flips flags.
- The symbol code is client-side. Room 1 is free, so that is fine; gated rooms will validate on the server as the GDD requires.

---

## 6. Game state changes (zustand)

```ts
type UiLock = 'padlock' | 'symbol-lock' | 'note' | 'intro' | 'photo' | 'complete' | null

interface GameState {
  // …everything from Level 0, plus:
  roomId: string                 // which definition is mounted
  startedAt: number | null       // performance.now() when the intro ends; for the time and par star
  completedAt: number | null
  notesRead: string[]            // note ids, so the letter can be re-read from the item bar
  openNote: string | null        // the note shown by NoteUI
}
```

- `initialLevelState()` takes the definition: `startCharge`, `lights` and the starting flags come from it, so *Reset level* works per room.
- `runtime.wisp` becomes `runtime.ghosts: Map<string, GhostRuntime>` (same fields per ghost: object, position, speed, state, exposure). The camera, scoring and debug panel loop over it. Each entry has one writer, its own `<Wisp>`.
- The rule from Level 0 holds: per-frame values in `runtime` and uniforms, events in the store.

---

## 7. Tuning values

New keys in `tuning.ts` (they appear in the debug panel by themselves). Room-specific values that are design, not balance (par time, start charge) live in the definition.

| Value | Start | Notes |
| --- | --- | --- |
| Intro: doors open hold | 1.4 s | From the definition's `slamAfter` |
| Intro: slam duration | 0.22 s, ease-in | Then a 0.15 s camera shake |
| Intro: input lock | 2.6 s total | Any key or tap skips to the end |
| Key Wisp drop | key falls from the dissolve point at 4 m/s², rests 2 cm above the floor, glints | |
| Ghost zone margin | 0.2 m | Wander path stays this far inside each zone |
| Search time | 0.8 s | Coat pocket rummage, interrupted by moving away |
| Lid open | 0.9 s, ease-out | |
| Symbol lock drop | 0.5 s | |
| Mirror clue: dwell | 1.0 s | Text lit and in the reflection, continuously |
| Mirror clue: min light on text | 0.35 beam strength | |
| Mirror-only text glow | 0 | The text is lit only by the flashlight; raise only if playtests need it |
| Guide delays | see Step 12 | |
| Par time | 480 s (definition) | Third star |
| Gallery Wisp freeze | same as Level 0 | It is far away, so `close` scores low by design |

---

## 8. Systems, in build order

Each step ends with something playable. Step 1 must not change how Level 0 plays.

### Step 1 — Make the engine room-agnostic

Today eleven modules import `level0.def.ts` directly (`Level0`, `RoomScene`, `bindNodes`, `actions`, `PlayerController`, `Wisp`, `CameraMode`, `PaintingReveal`, `Candle`, `battery`, `DebugPanel`), held-item URLs point at `/models/level0/`, and `Atmosphere` and `Mirror` hard-code Level 0 geometry.

- `roomDef.ts`: a `RoomDef` type with every field used by either room, optional where only one room uses it. Both definitions `satisfies RoomDef`.
- `rooms.ts`: a registry and `?room=` URL flag (`level-0` default until Level 1 is done, then `entrance-hall`). The title screen gets a second button later.
- `RoomContext.tsx`: `<RoomProvider def>` plus `useRoomDef()`. Modules that run outside React (actions, battery) read it through a `currentRoom()` getter set by `Room.tsx` on mount.
- `Level0.tsx` → `Room.tsx`, keyed on `epoch` as before; the store's `resetLevel` takes the room's definition.
- `Atmosphere`: window rectangle and moon position from `def.atmosphere`.
- `Mirror`: the reversed "AWAKE" word only when `def.mirror.testWord` is set (it is, for Level 0).
- `copy-assets.mjs`: per-level folders plus `models/shared/` for the held items; Level 0's definition and the held-item URLs move with it.
- `runtime.ghosts` replaces `runtime.wisp` (one entry in Level 0).

**Check:** `/play?room=level-0` plays exactly as before, chain, Wisp, photo, debug skips included; `npm run typecheck` passes; no module imports a specific definition except `rooms.ts`.

### Step 2 — Load the hall

- Add `level1.def.ts` with only `scene`, `spawn`, `spawnYawDeg`, `mirror` and `exit` first; the rest fills in step by step.
- `bindNodes`: collect `MirrorOnly_*` into `room.mirrorOnly: Mesh[]`; bind definition-named scenery as interactables; skip `enabled: false` behaviour but still validate names.
- `PlayerController`: spawn yaw from the definition.
- **Static merge (`mergeStatic.ts`):** after binding, merge every static scenery mesh that shares a material into one mesh per material (skip interactables, pickups, ghosts, the mirror, mirror-only and anything named by the definition). The hall has well over a hundred static parts; without this it cannot meet the phone's 80 draw calls, and the mirror doubles whatever is left. Apply it to Level 0 too.
- Atmosphere: moonlight through the tall south window, the floor patch projected from it.

**Check:** `/play?room=entrance-hall&debug` loads the hall at the right scale; the bound-node list matches §4; walk the whole hall: blocked by the stairs, the clock, the desk, the closed Library door and the front doors; draw calls in the worst view under 80 on the phone preset.

### Step 3 — Intro

`intro/Intro.tsx`, mounted when `def.intro` exists.

1. On mount: set `uiLock: 'intro'`, open the front doors to their `intro_open_deg`, play the clock tick loop and a faint wind through the open doors.
2. After `slamAfter`: tween both doors to 0 in 0.22 s (ease-in), door slam sound, a short camera shake, the tick stops on the next beat, wind cuts out.
3. A brief dip to near-black (0.3 s), then release `uiLock`, set `startedAt`, show the first guide.

- During the intro the camera eases its look toward `Spawn_Intro_Look` (the clock face) by a few degrees, never more; the player keeps control of look on desktop once pointer lock is taken.
- Any key, click or tap skips to step 3.
- *Reset level* replays the intro; the debug panel has *Skip intro*.

**Check:** the slam lands on desktop and phone (sound plays on iOS after the first tap); skipping works; the front doors stay shut and their collider is solid.

### Step 4 — White light only

- `lights.uv: false` makes `toggleMode` inert, hides the White/UV touch button, removes Q from the controls list and turns off the UV hint guide.
- Battery: start charge 0.5 from the definition; `Pickup_Battery_Console` in plain sight; the coat pocket gives the second pack; the emergency pack respawns at `Spawn_Battery_Emergency` (replaces Level 0's "respawn the first pickup" stand-in, now driven by a spawn name in the definition).

**Check:** Q does nothing and shows nothing; running dry with no spares brings the emergency pack by the front door after 10 s.

### Step 5 — Two Wisps and the key drop

- `Ghosts.tsx` mounts one `<Wisp ghost={def}>` per ghost; `Wisp` keeps its brain, material and cloth, and writes `runtime.ghosts.get(id)`.
- **Zones:** the wander path is clamped to the ghost's `zone` box (minus the margin) instead of the room bounds. The gallery Wisp stays above the landing, out of reach, so its photo is a long shot; the key Wisp drifts over the open floor and never behind the stairs.
- **Photo scoring:** score every visible ghost, keep the one with the highest quality; the `photo` event carries its id. A shot with both in frame counts for the better one only (the Twins in Room 4 will change that rule).
- **Drop (`dropItem.ts`):** when a ghost with `drops` dissolves, move its pickup node to the dissolve point, show it, fall to the floor under it (a simple tween with a small bounce), then a slow glint (emissive pulse) until picked up. Set the `drops.sets` flag so the pickup becomes usable.
- **Audio:** each Wisp has its own positional whisper; the key Wisp is louder and slightly lower, so players hunt it first.

**Check:** both Wisps float at once and stay in their zones; photographing either scores it; the key Wisp's dissolve drops the brass key where it was, and the key can be picked up from the floor; the gallery Wisp never drops anything.

### Step 6 — New interactions

All in `actions.ts`, chosen by `type`, reading the current definition.

| Type | Behaviour |
| --- | --- |
| `drawer` | As Level 0, plus `slideDir` and `requires` (an item, consumed on first open); without the item, the prompt says `lockedLine` |
| `note` (on a pickup) | Picking up adds the item and opens `NoteUI` with the note's text; it applies `gives`; the item in the bar re-opens it |
| `search` | Hold-style action: `searchTime` with a rummage sound; moving out of reach cancels; applies `gives`; then the prompt disappears |
| `lid` | Like a door, rotating about the given hinge axis; with a `lock`, opens the lock UI first |
| `locked` | Prompt "Try", answers with `line` as a short message; no state |
| `inspect` | Prompt "Look", shows `line`; for the plaques, so the years are readable on a phone even when the texture is small |

- `NoteUI.tsx`: a `print-paper` card with the title and three lines; Esc, E, tap or the close button dismisses it; pointer lock released and restored as with the padlock.
- The letter's text is the definition's `notes.letter`.

**Check:** with the brass key the drawer opens and the letter is readable; without it the drawer says it is locked; the coat search gives a spare pack once; the front doors and the boarded door answer and do nothing else; the plaques show their years.

### Step 7 — Mirror-only content

The central trick of the room: writing that exists only in the reflection.

- `bindNodes` collects `MirrorOnly_*`. `Mirror.tsx` sets each to `visible = false` and `castShadow = false`.
- The reflection's `updateBefore` is already wrapped (for `mirrorUpdateEvery`). The wrapper now sets the mirror-only meshes visible, calls the original update, and hides them again. The main view and the flashlight's shadow pass never see them; the reflection always does.
- If a later three.js release lets the reflector's virtual camera use its own layer mask, switch to a dedicated layer (`MIRROR_ONLY_LAYER`) instead: main camera with the layer off, virtual camera with it on. Same result, no visibility toggling.
- Material: a lit `MeshStandardNodeMaterial` with the text as an alpha map, vermilion, no emissive. It is visible in the reflection only where the flashlight lights the wall, so the player has to aim the light behind them while looking into the mirror.
- Texture: generated on a canvas at first (brush-style serif, flipped horizontally, flecks knocked out as in Level 0's word), replaced by `mirror-text.png` when it exists.
- **Clue (`mirrorClue.ts`):** each frame, when (a) the mirror is in the view frustum, (b) the text's reflected position (the text centre mirrored through the mirror plane) is in the view and not blocked, and (c) the white beam lights the text centre with at least the minimum strength (`beamOn` from `wispBrain.ts`), accumulate dwell time; after `mirrorClueDwell` apply `clue:eldest-first` and play a soft chime. Decays when any condition fails.

**Check:** from the rug, with the light on the east wall, "Eldest first" reads correctly in the mirror; looking straight at the east wall shows a bare wall, lit or not; the text casts no shadow; the clue logs once; FPS on the phone stays within budget with the mirror in view.

### Step 8 — Symbol lock

- `SymbolLockUI.tsx` follows `PadlockUI`: three wheels, arrow keys or swipe, the same `print-paper` panel and stepped animation, but each wheel shows icons from `symbols.ts` (moon, bat, pumpkin, key, eye as SVG paths) instead of digits.
- The lock opens itself as soon as the wheels match `code`, with a heavy click; `Chest_SymbolLock` drops and fades; `sets` applies.
- The same icon set is used for the lock's dials in the scene later (`symbols.png` in the Blender spec), so the two always match.

**Check:** the right order opens the chest from the UI on desktop and on touch; a wrong order gives no feedback beyond the wheel clicks; the lock UI releases and restores pointer lock.

### Step 9 — The Level 1 chain

| Link | Trigger | Result |
| --- | --- | --- |
| 0 | Room mounts | Intro: doors slam, `startedAt` set |
| 1 | Pick up `Pickup_Flashlight` | `hasLight`, light on |
| 2 | Photograph the frozen `Wisp_Key` (quality ≥ threshold) | Dissolve; `flag:brass-key-dropped`; `Pickup_Brass_Key` falls |
| 3 | Pick up `Pickup_Brass_Key` | `item:brass-key` |
| 4 | Use `Interact_Writing_Desk_Drawer` | Key consumed, drawer slides out; `flag:desk-open`; `Pickup_Letter` visible |
| 5 | Pick up `Pickup_Letter` | `item:letter`, `NoteUI`, `clue:letter` |
| 6 | Light the east wall while looking into the mirror | `clue:eldest-first` |
| 7 | Read the plaques and the portraits' symbols | (no state; the player works out moon, bat, pumpkin) |
| 8 | Use `Interact_Chest_Lid`, enter the symbols | `Chest_SymbolLock` drops, `flag:chest-unlocked`, lid opens, `flag:chest-open` |
| 9 | Pick up `Pickup_Library_Key` | `item:library-key` |
| 10 | Use `Interact_Library_Door` | Door opens, collider removed, `completedAt`, complete card |

- No link is gated on a clue: a player who guesses the symbols can open the chest early. Clues only drive the guide and, later, the journal.
- The optional pieces (coat battery, console battery, gallery Wisp) never block the chain.

**Check:** the chain completes from spawn to open door with no dead ends, on desktop and touch; *Skip to N* in the debug panel reaches each link.

### Step 10 — Library door and the room-complete card

- The Library door swings away from the hall into the dark vestibule (pick the sign of `openAngleDeg` so it never sweeps the player); creak; `Collider_Library_Door` is removed with it.
- `CompleteCard.tsx` (moved out of `Hud.tsx`), text from `def.complete`:
  - time, from `startedAt` to `completedAt`
  - stars: ① door open ② both non-secret Wisps photographed ③ under `parSeconds` (no hints exist yet, so time only)
  - the best photo of each ghost, with its score
  - "Secrets 0 of 2", unlabelled (a teaser for the return visit)
  - "Next: The Library — coming soon" and a *Play again* button
- Level 0 gets the same card with its own text and no stars.

**Check:** the card shows correct time, stars and photos for a full run and for a fast run that skipped the gallery Wisp.

### Step 11 — Atmosphere and audio

**Lighting**

- Moonlight through the tall south window, the floor patch projected onto the hall floor toward the rug; no other light at the start.
- The chandelier hangs dark; its silhouette against the moonlit ceiling is part of the first view.
- Fog density lower than in the study (the hall is deeper); check that the far end (clock, stairs) still reads with the flashlight.
- The print look and post-processing values from Level 0 apply unchanged; the hall should look like the same print series.

**Audio**

- Clock tick loop until the slam, then silence where it was.
- Door slam, wind before it.
- Room tone: larger and more hollow than the study (lower, longer creaks).
- Two Wisp whispers, the key Wisp's louder.
- New one-shots: drawer key turn, letter unfold, coat rummage, symbol wheel click, chest lock clunk, lid creak, mirror chime.

**Check:** with everything on, the first view (stairs, clock, moonlit floor) reads in under two seconds, and the frame budget holds.

### Step 12 — Teaching the room (guide labels)

The definition lists guide steps; `guide.ts` shows the first one whose condition holds and whose delay has passed. Battery warnings keep priority, as in Level 0.

| When | Delay | Label |
| --- | --- | --- |
| No flashlight | 0 s | "Too dark to see. Find the flashlight on the floor." (Level 0's) |
| Flashlight, key Wisp not photographed | 25 s | "Something is whispering. Press **P** to raise the camera." |
| Camera raised, Wisp not frozen | 6 s | "Catch it in your light first, then shoot." |
| Brass key on the floor, not picked up | 5 s | "It dropped something." |
| Brass key held, desk closed | 30 s | "A small brass key. Which lock is small enough?" |
| Letter read, mirror clue not found | 60 s | "*…tells the truth to the glass.* Look into the mirror." |
| Same, 60 s later | 120 s | "Shine your light behind you while you look into the mirror." |
| Mirror clue found, chest still locked | 90 s | "Eldest first. Each portrait has a year on its plaque." |
| Library key held, door closed | 10 s | "The Library door is by the clock." |

On touch, key names are replaced by the button names, as Level 0 does.

**Check:** a player who does nothing gets a nudge at each link, never two labels at once, and never a label for a link they have already done.

### Step 13 — Debug additions

- **Room switcher** in the *Renderer* folder: reload with `?room=` changed, keeping `?debug`.
- **Level** folder, per room: *Skip intro*, and *Skip to* buttons generated from a `debugSkips` list in the definition (Level 1: flashlight, brass key, desk open, mirror clue, chest open, library key). Each skip calls the real actions, as Level 0's do.
- **Ghosts** folder: one monitor row per ghost (state, exposure, position), replacing the single *Wisp* folder.
- **Overlays:** *Show mirror-only in main view* (to place and size the text), *Show ghost zones* (wireframe boxes), and the existing colliders and beam.

**Check:** every skip leaves the room in a state the next link can continue from; *Reset level* replays the intro and puts both Wisps back.

---

## 9. Milestones

| # | Milestone | Steps | Device check |
| --- | --- | --- | --- |
| M1 | Engine room-agnostic, Level 0 unchanged | 1 | Laptop |
| M2 | Walk the hall, draw calls in budget | 2 | Laptop + iPhone |
| M3 | Intro and white-light rules | 3–4 | Laptop + iPhone (audio unlock) |
| M4 | Two Wisps, key drop | 5 | Touch feel on iPhone |
| M5 | Desk, letter, coat, plaques | 6 | Laptop + iPhone |
| M6 | Mirror-only text and clue | 7 | iPhone performance with the mirror in view |
| M7 | Chain complete with symbol lock and complete card | 8–10 | Full playthrough on both |
| M8 | Look, sound and guide pass | 11–13 | Cold playtest with two new players |

Each milestone ends with a Vercel preview deploy and a short phone playtest, as in Level 0.

---

## 10. Asset hand-off points

| Code step | Needs from Blender / images | Fallback until then |
| --- | --- | --- |
| 2 | Blockout `level-1.glb` with names, pivots, colliders, spawns | Done (exported Oct 7) |
| 2 | Static scenery sharing materials (for the merge) | Blockout materials already shared |
| 5 | `Wisp_Key`, `Wisp_Gallery`, `Pickup_Brass_Key` | Done (blockout) |
| 6 | Drawer (back-centre pivot), letter, coat pocket, plaques | Done (blockout) |
| 6 | Plaque textures with the years | `inspect` lines carry the years |
| 7 | `Mirror_Surface`, `MirrorOnly_Text` plane; `mirror-text.png` | Canvas-generated text |
| 8 | Chest lid (hinge pivot), `Chest_SymbolLock`; `symbols.png` | SVG icons in the UI, blank dials in the scene |
| 9 | Portrait paintings with readable symbols | Flat canvases plus a big symbol drawn on a canvas texture |
| 11 | Materials pass, chandelier and stair silhouettes final | Blockout colours |

Every re-export from Blender should load without code changes; `bindNodes` validation names anything missing.

---

## 11. Writing the code with Claude Code

- This file lives at `docs/level-1-implementation.md`, next to the GDD, the Level 1 Blender spec and the Level 0 plan.
- Work one step at a time: "Implement Step 5 from docs/level-1-implementation.md". Each step's **Check** is its acceptance test.
- After every step, play Level 0 once (`/play?room=level-0`): Step 1 makes the systems shared, so a Level 1 change can break Level 0.
- Every balance number goes into `tuning.ts`; room design values (par time, start charge, texts) go into the definition.
- Run `npm run typecheck` after each step.
- Before Step 7, check the current three.js `ReflectorNode` source: whether its virtual camera can take a layer mask decides between the layer approach and the visibility toggle.

---

## 12. Performance budget

Same targets as Level 0. The hall is about 2.4× the study's floor area with many more parts, so draw calls are the risk, not triangles.

| Metric | Laptop target | iPhone 15 Pro target | Hall, blockout, before the merge |
| --- | --- | --- | --- |
| Frame rate | 60 fps | 60 fps, never below 45 | — |
| Draw calls | < 120 | < 80 | Well over 100 (many small multi-material objects); the mirror doubles it in view |
| Triangles | < 300k | < 150k | ~70k (the two Wisps share a 26k-triangle mesh) |
| Real-time shadows | Flashlight only | Flashlight only, 512 map | — |
| Room .glb (compressed) | < 8 MB | same | 1.1 MB uncompressed |

Measure with `?debug` in the worst view: from the rug facing the mirror, light on, both Wisps in view.

---

## 13. Open questions for Level 1

- [ ] Intro: does the player see the doors slam (spawn facing south, then turn), or hear it behind them (facing north, as planned)?
- [ ] Should the key Wisp avoid the mirror's corner, so the two big moments don't happen in the same spot?
- [ ] Gallery Wisp: is an out-of-reach long shot fun, or should it come down to the stair foot now and then?
- [ ] Letter text: is "tells the truth to the glass" enough, or does it need the mirror named?
- [ ] Symbol lock: two decoy symbols (key, eye) or none?
- [ ] Should the chest require `clue:eldest-first` (no guessing), or stay open to a lucky guess?
- [ ] Complete card: does "Secrets 0 of 2" tease the return visit well, or confuse a player who can't find them yet?
- [ ] Default room on `/play` once Level 1 is done: the hall, with Level 0 kept behind `?room=level-0`?
