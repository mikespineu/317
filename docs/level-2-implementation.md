# 3.17 — Level 2 implementation plan

Oct 8, 2026 · companion to [`level-2-scenario.md`](./level-2-scenario.md), [`level-2-blender-asset-spec.md`](./level-2-blender-asset-spec.md), [`level-1-implementation.md`](./level-1-implementation.md) and [`game-design-document.md`](./game-design-document.md)

Level 2 is Room 2 of the mansion, the **Library**: free, about 9 minutes on a first play. It is where the UV lamp arrives and invisible ink becomes a puzzle, and where two new ghosts appear: the **Mimic** (a key ghost disguised as a book) and the **Ink Ghost** (visible only under UV). It also plants the clue that sends the player back to the hall. It is done when a new player gets from the hall's open Library door to the open service door in about 9 minutes, on a laptop and on an iPhone 15 Pro in landscape, without reading anything outside the game.

This file is the coding plan. The scenario owns what happens and why; the Blender spec owns sizes, names and export rules; this file owns how the code reads them. Level 0's and Level 1's plans stay the reference for every system reused unchanged; only what is new or different is described here. It was written against the code as of Oct 8 (branch `leftovers`): where the code needs a change before the room can work, §3 says so, with the file.

---

## 1. Scope

**The room in one line:** enter → find the **Mimic** among the table books, photograph it, it drops the **UV lamp** → sweep with UV: a message over the fireplace, **handprints** on four books, the **Ink Ghost** drifting along the stacks → each marked book carries one invisible digit, read top shelf down → pull the loose books off the shelf in stack A, the **hidden panel** is behind → enter 7-2-0-5 → diary page, battery and **Kitchen key** → key opens the service door, the ladder rolls aside.

**In scope**

- **UV lamp as a found item** (`hasUv`): `Q`, the UV touch button and the controls entry stay off until the lamp is picked up.
- **UV writing as data** (`uvText` in the definition): a message, four handprints, four digits, each visible only inside the UV cone, each logging a clue after a short hold.
- **Mimic ghost type:** disguised as one of five fixed objects, twitches, freezes in white light, drops an item.
- **Ink Ghost ghost type:** follows a route along the stacks, visible only in the UV cone, slows in it, scored with the UV beam.
- **Throwable marked books** whose UV ink travels with them; loose cover books whose removal exposes the panel.
- **New interactions:** readable fixture (the ledger), hollow dictionary (a search), hidden panel (a hinged door with a four-digit lock), the service door that pushes the ladder aside.
- **Per-room bounds** for prop physics and ghost wandering (the Library is bigger than anything the code assumes today).
- **Room-complete card:** time, stars, both photos, "secrets 1 of 1" counted for real, and a "lead in the hall" line.
- Guide labels for this room, debug skips, Polish strings.

**Out of scope:** login, Supabase, saving, the journal and paid hints (so star 3 is time only, as in Level 1), the JSON room loader, the mansion map, **the return visit to the hall** (the clock note and the secret Ink Ghost; this room only logs `clue:hall-message` and records a lead), the Kitchen, an inspect mode for books, carrying items and flags between rooms (only the battery crosses, as today).

**Done when**

- [ ] Spawn to open service door in about 9 minutes for a first-time player, 12 at most, with no dead end (cold playtest with two people who have not seen the room)
- [ ] The Mimic's twitch is noticed within a minute; the freeze-and-shoot works on the first try for most players
- [ ] Players sweep with UV rather than stare at one wall; the marked books are found without hint 3
- [ ] Smooth on a mid-range laptop and an iPhone 15 Pro in landscape, in the worst view (UV on, Ink Ghost visible, candle lit, a book in hand)
- [ ] Level 0 and Level 1 play exactly as before (`/play?room=level-0`, `/play?room=entrance-hall`)

---

## 2. What carries over

| System | Library | Change |
| --- | --- | --- |
| Renderer, presets, post-processing, print look | Reused | None |
| Player, input, collision, touch | Reused | Spawn yaw 0 (north) |
| Flashlight, battery, cone, dust | Reused | UV mode is gated by `hasUv` (§3, Step 3) |
| UV reveal shader (`uvMask`, `uvMaskAt`) | Reused | Now drives many small planes and the Ink Ghost, not one painting |
| `PaintingReveal` | Not used here | Left as it is for Level 0 |
| Interaction ray, prompts, item bar, notes | Reused | New types `read`, `moves`, `availableWhen` |
| Padlock UI | Reused | Four wheels already work (wheel count = code length) |
| Prop physics | Extended | Room bounds from the definition; sets a `moved` flag on grab |
| Wisp (brain, material, cloth) | Extended | Ink Ghost is a Wisp variant (route, UV visibility) |
| Key drop (`dropItem.ts`) | Reused | The Mimic drops the UV lamp through the same code |
| Camera and photo scoring | Extended | Per-ghost "can be photographed" and per-ghost light (white or UV) |
| Chain evaluator (`chain.ts`) | Reused | New read-only token `uv:held`; `uv:` handled by id |
| Guide, complete card, debug panel | Extended | See Steps 9, 11, 12 |
| Candle | Reused | One candle on the reading table |
| Mirror, intro, symbol lock, `MirrorOnly_` | Not used | The Library has no mirror and no intro; those components must stay no-ops |
| Audio | Extended | Library room tone, Mimic scrape, pen scratch, page rustle, ladder roll |

---

## 3. What the code does not do yet

Found by reading the code on Oct 8. Each row is fixed in the step named, and none may change how Level 0 or 1 plays.

| # | Gap | Where | Fixed in |
| --- | --- | --- | --- |
| 1 | Prop physics and the default ghost box clamp to a 4 × 5 m room (`wispRoomHalfX/Z` 2.0 / 2.5, `propCeiling` 2.8). In the 6 × 8 × 3.2 m Library a thrown book would hit an invisible wall 1 m short of the real one | `propPhysics.ts:138-150`, `wispBrain.ts:121-129`, `tuning.ts` | Step 1 (`def.bounds`) |
| 2 | UV is gated by `lights.uv !== false` in five places and `toggleMode`; there is no "found it later" state | `store.ts:156`, `Hud.tsx:102`, `touchInput.tsx:200`, `RotatePrompt.tsx:43` | Step 3 (`hasUv`) |
| 3 | `chain.ts` `case 'uv'` ignores the id, so `uv:held` would read as `uv:on` | `chain.ts:40` | Step 3 |
| 4 | Flashlight is assumed to come from a floor pickup in every room; the Library has none and `hasLight` starts false | `store.ts:121` | Step 3 (`startsWithLight`) |
| 5 | The HUD note "Code found. Try the desk drawer." is Level 0's text, shown in any room with a code lock and a clue | `actions.ts:125` | Step 1 (`codeNote`) |
| 6 | UV writing exists only as Level 0's single painting, with its own canvases | `PaintingReveal.tsx` | Step 4 (`uvText`, `UvInk`) |
| 7 | `bindNodes` would put `UVOnly_` planes in the occluders (blocking beams and line-of-sight rays) and does not collect `Path_` empties | `bindNodes.ts:105-137` | Step 1 |
| 8 | A disguised ghost would be scored: `scorePhoto` scores every live ghost wherever it is, and the photo's "lit" part uses the white beam only, so the Ink Ghost would always score 0 for light | `scorePhoto.ts:39,57`, `runtime.ts:75`, `wispBrain.ts:50` | Steps 7-8 |
| 9 | Only the Wisp's dissolve rule exists (`state === 'freeze'` and quality ≥ threshold) | `Wisp.tsx:89-94` | Steps 7-8 (`catchable`) |
| 10 | A solved code lock on a lid drops the lock but does not open the lid (only the symbol lock does) | `actions.ts:367-396` | Step 6 |
| 11 | No way to move scenery and its collider when a door opens (the ladder) | `actions.ts:258-298` | Step 6 (`moves`) |
| 12 | An interactable cannot be "not available yet" (the panel behind the cover books) | `actions.ts:70` | Steps 5-6 (`availableWhen`) |
| 13 | The moon patch assumes a window in a north or south wall: the quad spans X at a fixed Z. The Library window is in the east wall | `Atmosphere.tsx:17-40` | Step 2 |
| 14 | "Secrets 0 of N" is a hard-coded 0; the card has no line for a lead | `en.ts` `complete.secrets`, `CompleteCard.tsx` | Step 9 |
| 15 | `roomTone` knows `'study'` and `'hall'` | `loops.ts:30` | Step 10 |

Content problems found in the other two Level 2 documents (decisions in §12):

- The Blender spec's arched window is 2.8 m tall with its sill at 0.5 m, above the 3.2 m ceiling. The export fixed it (frame top at 2.82 m); the definition uses the glass's size.
- The scenario puts the panel "behind the marked books", but they sit on four stacks. The Blender spec's answer (the panel is in stack A behind four loose cover books) is followed here.

---

## 4. Project structure

New and changed files only.

```
src/game/
  Room.tsx                      # + <UvInk />
  store.ts                      # + hasUv; start state reads startsWithLight / carried kit
  room/
    level2.def.ts               # new: the Library
    rooms.ts                    # + level2
    roomDef.ts                  # + bounds, uvText, mimic/ink fields, availableWhen, moves, read, leads, codeNote
    bindNodes.ts                # + UVOnly_ (no occluder), Path_ empties into spawns
  light/
    UvInk.tsx                   # new: UV planes (message, hands, digits), clue logging
    uvInkArt.ts                 # new: canvas stand-ins for the art (replaced by PNGs)
  ghost/
    Ghosts.tsx                  # wisp | ink -> <Wisp>, mimic -> <Mimic>
    Wisp.tsx                    # ink variant: route, UV visibility, catchable
    wispBrain.ts                # + route follower, `catchable`, light source by ghost kind
    wispMaterial.ts             # + uvOnly option (opacity and glow follow uvMask)
    Mimic.tsx                   # new
    mimicBrain.ts               # new: disguised / twitch / freeze / re-disguise
    mimicMaterial.ts            # new: flat ghost look for Mimic_True with dissolve
  interaction/
    actions.ts                  # read, moves, availableWhen, lid + code lock, codeNote
  props/propPhysics.ts          # bounds from the room; sets flag:moved:<node> on grab
  camera/scorePhoto.ts          # photographable, per-ghost light
  puzzle/chain.ts               # uv:held
  ui/CompleteCard.tsx           # secrets found, leads
  ui/guide.ts                   # unchanged
  audio/                        # new one-shots and loops (Step 10)
src/lib/progress.ts             # + leads, kit
src/i18n/en.ts, pl.ts           # new keys (§10)
public/
  models/level2/level-2.glb     # from blender/export via npm run assets
  models/shared/uv-lamp.glb     # same
  textures/level2/              # uv-message.png, uv-digit-*.png, uv-handprint*.png, spine-*.png (canvas stand-ins first)
```

---

## 5. The Blender ↔ code contract, additions

Everything in the Level 0 and 1 contracts holds. New for Level 2, in the Blender spec's own names:

| Prefix / name | Code behaviour |
| --- | --- |
| `UVOnly_*` | Thin planes. Not occluders, no shadows, never raycast. Material replaced by `UvInk`; drawn only while the UV lamp is lit. Digits and handprints are **children of their marked book** and travel with it |
| `Path_*` | Empties, bound like `Spawn_*` (world position, in the `room.spawns` map); the Ink Ghost's route is the definition's ordered list of them |
| `Prop_MarkedBook_A…D`, `Prop_PanelBook_1…4` | Throwable props (listed in `props`). Axis-aligned, base-centre origin. The physics sizes them from the bounding box, children included, so the UV planes must lie inside the book |
| `Decoy_Book_1…4`, `Decoy_Stool` | Static scenery named by the Mimic's spots. Hidden one at a time (the one the Mimic sits on) |
| `Mimic_Book`, `Mimic_Stool` | The disguise meshes, identical to the decoys. The code places the right one on the chosen spot |
| `Mimic_True` | The Mimic's real shape. Detached and driven by `<Mimic>` like a Wisp mesh |
| `Ink_Ghost` | Detached and driven by `<Wisp>` (Wisp cloth shader, UV visibility) |
| `Interact_Ledger`, `Interact_Hollow_Dictionary`, `Interact_Hidden_Panel`, `Interact_Service_Door` | Interactables of type `read`, `search`, `lid`, `door` |
| `Hidden_Panel_Lock` | Scenery lock mesh of the panel; fades and drops when the code is right |
| `Ladder` + `Collider_Ladder` | Moved together by the service door's `moves` entry |
| `Pickup_UV_Lamp` | Not in the `.glb`: a `model` pickup (`uv-lamp.glb`), placed by the room loader, shown by the Mimic's drop |
| glTF extras | `digit`, `stack`, `shelf` (1 = bottom … 4 = top) on marked books, `solution` on `Hidden_Panel_Lock`, `aside_offset_x` on `Ladder`. The definition is the source of truth; extras are compared against it in dev and a mismatch warns |

**Axes:** Blender (x, y, z) becomes three.js (x, z, −y). North (Blender +Y) is three.js −Z, so yaw 0 looks north at the fireplace and the service door. The room is x ∈ [−3, 3], z ∈ [−4, 4]. Spawn at Blender (0, −3.3) is three.js (0, 1.6, 3.3).

**Converted positions used by the definition** (three.js, metres):

| Thing | Blender (x, y, z) | three.js (x, y, z) |
| --- | --- | --- |
| Reading table centre | 0, 0.4, 0 | 0, 0, −0.4 |
| Mimic spots 1–4 (books, on the table) | (−0.7, 0.4), (−0.25, 0.6), (0.3, 0.25), (0.75, 0.55), z 0.76 | (−0.7, 0.76, −0.4), (−0.25, 0.76, −0.6), (0.3, 0.76, −0.25), (0.75, 0.76, −0.55) |
| Mimic spot 5 (stool seat) | 1.2, −0.6, 0.45 | 1.2, 0.45, 0.6 |
| Arched window, centre | 3.0, 0.4, 1.7 | 3.0, 1.7, −0.4 (east wall) |
| Service door | 1.6, 4.0 | 1.6, 0, −4.0 |
| Ladder, blocking / aside | x 1.6 / 0.7 | x 1.6 / 0.7 (`by: [-0.9, 0, 0]`, from the export) |

Check every converted value against the dev console's bound-node printout in Step 2.

**Pivots the code relies on**

| Node | Pivot | Motion in three.js |
| --- | --- | --- |
| `Interact_Service_Door` | Hinge edge (west), floor | Rotate about Y; the leaf runs along +X when closed. Opens north, into the dark Kitchen vestibule: `openAngleDeg: -95` (the door action negates it, so this is a positive Y rotation). Set the sign by looking, as in Level 1 Step 10 |
| `Interact_Hidden_Panel` | Hinge edge (left), flush with the bay back | Rotate about Y, door swings out toward the player. Sign by looking |
| `Hidden_Panel_Lock` | Front centre | Drops and fades, as `Chest_SymbolLock` does |
| `Ladder` | Rail contact point (top) | Slides along X by `moves.by`, together with `Collider_Ladder` |

**Export check (`blender/export/level-2.glb`, read Oct 8).** 124 nodes, 103 meshes, 175 primitives, 25 materials, 39k triangles (budget 150k), 1.2 MB uncompressed. Every node the definition in §6 names is present except `Pickup_UV_Lamp` (a model pickup, by design, with `uv-lamp.glb` exported beside it) and the `UVOnly_Digit_*_Cover` planes (decision 3, §12). Differences from the Blender spec that the code follows:

| In the export | Code consequence |
| --- | --- |
| `Ladder` extras `aside_offset_x: -0.9` (spec: vector `aside_offset` −1.0); aside position x 0.7 | `moves.by: [-0.9, 0, 0]`. The dev check reads `aside_offset_x` |
| Marked books are 0.30 (X, into the shelf) × 0.38 × 0.148 (Z). Spine face is ±X, planes sit 6 mm off it | Held pose shows the cover (thin axis to the camera), so the spine digit is not readable in the hand: decision 3 stands |
| Digit and handprint planes of one book are 3 mm apart (X 0.153 / 0.156), both 0.12 tall or more | Two UV planes nearly coplanar: give the hand a lower `renderOrder` than the digit so the digit never z-fights under the palm |
| `shelf` is 1 (bottom) to 4 (top): B=1, D=2, A=3, C=4, digits 5-0-2-7 | Top to bottom is C, A, D, B = 7-2-0-5, as the definition says |
| Cover books at Z −2.35 / −2.45 / −2.55 / −2.65, 0.1 thick, in front of the panel (Z −2.67 to −2.33); the lock sits at Z −2.5, between `_2` and `_3` | The `availableWhen` pair `_2` and `_3` is right |
| Panel hinge on the south edge (Z −2.33), leaf along −Z | `openAngleDeg: -100` |
| Service door hinge on the west edge, leaf along +X, in the north wall at Z −4.075 | `openAngleDeg: -95` as planned; check the sign by looking |
| `Collider_Ladder` covers X 1.3–1.9, Z −4.0 to −3.4 | The door (X 1.1–2.1) stays reachable from either side of the ladder, and the interaction ray tests only targets, so it can be aimed at through the ladder |
| `Collider_Wall_S_W` / `_S_E` split around the entry; two vestibules with three colliders each | Nothing to do; the entry has no door collider |
| `Mimic_True` is 0.4 × 0.35 with its origin at the base; `Mimic_Book` / `Mimic_Stool` sit at the spot-3 position in the file | The Mimic moves them onto the chosen spot, base to `Spawn_Mimic_N` |
| Extra props: `Prop_Bust`, `Prop_Inkwell`, `Prop_Papers`, `Prop_Book_Pile`, `Prop_Fallen_Book`, `Mantel_Clock`, `Desk_Lamp` | Scenery unless listed; `Prop_Fallen_Book` is the obvious extra throwable |
| Ink route: 01 (−2, 1.2), 02 (−2, −0.4), 03 (−2, −2.1), 04 (−1.2, −3.0), 05 (2, −2.6), 06 (2, −0.4), 07 (2, 2.1), 08 (−1, 2.0), all at 1.3 m | Leg 04→05 is 3.2 m across open floor in front of the fireplace; a Catmull-Rom loop may overshoot it, so clamp the curve's tension (Step 8). Waypoints are 0.55–0.75 m from the marked books |

---

## 6. Room definition

`level2.def.ts`, checked with `satisfies RoomDef`. Strings are shown in English; every `Localized` has its `pl` next to it in the file.

```ts
export const level2 = {
  id: 'library',
  title: { en: 'The Library', pl: 'Biblioteka' },
  scene: '/models/level2/level-2.glb',
  spawn: 'Spawn_Player',
  spawnYawDeg: 0, // facing north: the fireplace and the service door
  lights: { uv: 'lamp' }, // UV switch off until item:uv-lamp is picked up
  startsWithLight: true, // the flashlight came from the hall; a deep link still has it
  startCharge: 0.5, // overridden by the carried battery when there is one
  parSeconds: 540,
  bounds: { halfX: 3.0, halfZ: 4.0, ceiling: 3.2 },

  atmosphere: {
    window: { x: 3.0, y: 1.67, z: -0.4, w: 1.24, h: 2.18, facing: 'east' }, // the glass in level-2.glb
    moon: [9.0, 6.0, -1.5], // behind the east window; the patch should land near the table's east end
    fogScale: 0.7,
    roomTone: 'library',
  },

  interactables: [
    { node: 'Interact_Ledger', type: 'read', name: { en: 'ledger' }, note: 'ledger' },
    {
      node: 'Interact_Hollow_Dictionary', type: 'search', name: { en: 'dictionary' },
      gives: ['item:battery'], sets: 'flag:dictionary-searched',
      line: { en: 'The pages are cut out. A battery pack inside.' },
    },
    { node: 'Prop_Candle', type: 'candle' },
    {
      node: 'Interact_Hidden_Panel', type: 'lid', name: { en: 'panel' },
      hingeAxis: 'y', openAngleDeg: -100, // hinge on the south edge, leaf along -Z: negative swings it out into the room
      availableWhen: ['flag:moved:Prop_PanelBook_2', 'flag:moved:Prop_PanelBook_3'],
      lock: { type: 'code', code: '7-2-0-5', mesh: 'Hidden_Panel_Lock', sets: 'flag:panel-unlocked' },
      sets: 'flag:panel-open',
    },
    {
      node: 'Interact_Service_Door', type: 'door', requires: 'item:kitchen-key', openAngleDeg: -95,
      moves: [{ node: 'Ladder', by: [-0.9, 0, 0], collider: 'Collider_Ladder' }], // extras: aside_offset_x
    },
  ],

  pickups: [
    { node: 'Pickup_Battery_Desk', item: 'battery' },
    { node: 'Pickup_Battery_Dictionary', item: 'battery', hidden: true }, // given by the search
    { node: 'Pickup_Battery_Panel', item: 'battery', visibleWhen: 'flag:panel-open' },
    { node: 'Pickup_Kitchen_Key', item: 'kitchen-key', visibleWhen: 'flag:panel-open' },
    { node: 'Pickup_Diary_Page', item: 'diary-page', visibleWhen: 'flag:panel-open', note: 'diary' },
    {
      node: 'Pickup_UV_Lamp', item: 'uv-lamp', model: '/models/shared/uv-lamp.glb',
      at: [0, 0.79, -0.4], yawDeg: 0, glow: true, visibleWhen: 'flag:mimic-caught',
    },
  ],

  props: [
    { node: 'Prop_MarkedBook_A', label: { en: 'book' }, throwable: true },
    { node: 'Prop_MarkedBook_B', label: { en: 'book' }, throwable: true },
    { node: 'Prop_MarkedBook_C', label: { en: 'book' }, throwable: true },
    { node: 'Prop_MarkedBook_D', label: { en: 'book' }, throwable: true },
    { node: 'Prop_PanelBook_1', label: { en: 'book' }, throwable: true },
    // …_2, _3, _4 the same, plus any small prop the Blender pass flags as throwable
  ],

  ghosts: [
    {
      id: 'mimic', type: 'mimic', mesh: 'Mimic_True', spawn: 'Spawn_Mimic_1', baseScore: 150, key: true,
      spots: [
        { spawn: 'Spawn_Mimic_1', decoy: 'Decoy_Book_1', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_2', decoy: 'Decoy_Book_2', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_3', decoy: 'Decoy_Book_3', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_4', decoy: 'Decoy_Book_4', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_5', decoy: 'Decoy_Stool', disguise: 'Mimic_Stool' },
      ],
      drops: { pickup: 'Pickup_UV_Lamp', sets: 'flag:mimic-caught' },
    },
    {
      id: 'ink', type: 'ink', mesh: 'Ink_Ghost', spawn: 'Spawn_InkGhost', baseScore: 200,
      route: ['Path_InkGhost_01', /* … */ 'Path_InkGhost_08'], whisper: 'penScratch',
    },
  ],

  uvText: [
    { node: 'UVOnly_Message', art: 'message', gives: 'clue:hall-message',
      text: { en: 'The hall remembers what the clock forgot.' } },
    { node: 'UVOnly_Handprint_A', art: 'hand', gives: 'clue:handprints' }, // …_B, _C, _D (flip: true on some)
    { node: 'UVOnly_Digit_A', art: 'digit', digit: '2', gives: 'clue:library-digit-a' },
    { node: 'UVOnly_Digit_B', art: 'digit', digit: '5', gives: 'clue:library-digit-b' },
    { node: 'UVOnly_Digit_C', art: 'digit', digit: '7', gives: 'clue:library-digit-c' },
    { node: 'UVOnly_Digit_D', art: 'digit', digit: '0', gives: 'clue:library-digit-d' },
    // + the cover copies of the four digits if §12 decision 3 stands (same clues)
  ],

  notes: {
    ledger: {
      title: { en: 'Lending ledger' },
      body: [
        { en: 'The last entry is struck out. Beside it, in a hurry:' },
        { en: 'The reading lamp is kept where the books keep their secrets.' },
        { en: 'Always read the stacks from the top shelf down.' },
      ],
      gives: 'clue:read-top-down',
    },
    diary: {
      title: { en: 'A page from a diary' },
      body: [
        { en: 'He asked me to stop every clock, so the night would not end.' },
        { en: 'I did. Something laughed on the stairs,' },
        { en: 'and then it was always 3:17.' },
      ],
      gives: 'flag:diary-found',
    },
  },

  emergencyPack: { pickup: 'Pickup_Battery_Desk', spawn: 'Spawn_Battery_Emergency' },
  guide: [ /* Step 11 */ ],
  debugSkips: [ /* Step 12 */ ],
  exit: { node: 'Interact_Service_Door', requires: 'item:kitchen-key' },
  complete: {
    eyebrow: { en: '3.17 · the library' },
    title: { en: 'Room complete' },
    line: { en: 'The service door gives. Cold air, and the smell of old iron.' },
    next: { en: 'The Kitchen' },
    stars: true,
  },
  secrets: { total: 1, found: ['flag:diary-found'] },
  leads: [{ when: 'clue:hall-message', text: { en: 'A lead in the hall.' } }],
} satisfies RoomDef
```

Notes on the definition:

- **`lights.uv: 'lamp'`** widens the type to `boolean | 'lamp'`. `false` still means "never" (Level 1), no field means "from the start" (Level 0).
- **`startsWithLight`** is new: Level 0 and 1 leave it out (the flashlight is on their floors).
- **`bounds`** is optional; rooms without it keep `tuning.wispRoomHalfX/Z` and `propCeiling`.
- **`uvText`** entries are bound and validated like interactables, and listed in `requiredNodes` so `mergeStatic` leaves them alone.
- **`availableWhen`** is checked by `promptFor`: until it holds, the node answers with no prompt (§7, gap 12). The panel is gated on the two cover books that stand in front of its centre (`_2` and `_3`); `_1` and `_4` flank it. The Blender pass must place them that way.
- **`moves`** runs when the door opens: `by` is in the parent's space, `collider` is the name of a `Collider_` box in `runtime.colliders`, shifted by the same amount.
- **Diary:** `gives: 'flag:diary-found'` is applied when the note opens, so the secret counts when the page is picked up and shown, not when it is closed.
- The code, the digits and the ledger text are placeholders in the sense of the scenario (any four digits work). Level 2 is free, so the code stays client-side; gated rooms validate on the server.
- Level 1's definition gets `nextRoom: 'library'` in Step 3, so the hall's card offers *Play next level* and carries the battery across.

---

## 7. Game state changes

```ts
interface GameState {
  // …everything from Level 1, plus:
  hasUv: boolean // the UV lamp has been picked up (or the room has UV from the start)
}
```

- `hasUv` starts as `def.lights?.uv === true || def.lights?.uv === undefined`: Level 0 true, Level 1 false, Library false. `addItem('uv-lamp')` sets it, as `addItem('flashlight')` sets `hasLight`; the lamp is not an inventory item and does not appear in the item bar.
- `toggleMode` becomes `if (!hasLight || !hasUv || switching) return`. Everything that tested `lights.uv !== false` reads `hasUv` instead.
- `initialLevelState(def)`: `hasLight` and `lightOn` start true when `def.startsWithLight`.
- **Flags:** `flag:moved:<node>` is set by `grabProp` the first time a prop is picked up. It is a plain flag, so debug skips can give it and `availableWhen` can read it.
- **Ghost runtime:** `GhostRuntime` gets `photographable: boolean` (default true), set by each ghost's component. `WispState` gets `'disguised'`. `liveGhosts()` returns only photographable ones, which is also what the camera scores (§7, gap 8).
- **Tokens:** `uv:held` (read-only, `hasUv`), `uv:on` unchanged, `ghost:mimic:freeze` already works. `chain.ts` `case 'uv'` switches on the id.
- **Carry-over:** unchanged (charge and spares). `hasLight` does not need to cross because the room says `startsWithLight`; `hasUv` does not cross into the Library by design. When Room 3 exists the carried kit grows (`hasUv`); that is a Room 3 task, noted here so it is not forgotten.
- **Progress:** `recordRoom` takes `leads: string[]` (ids from the definition's `leads` whose condition held) and keeps them in `RoomProgress.leads`, so Room 1's return visit can read the hall message later. Nothing reads it yet.

---

## 8. Tuning values

New keys in `tuning.ts` (they appear in the debug panel by themselves). Design values (par time, texts, routes) live in the definition.

| Value | Start | Notes |
| --- | --- | --- |
| `mimicFreezeDelay` | 0.6 s | White light on the disguised object before it freezes |
| `mimicRevealSeconds` | 3 s | True shape shown; `× lit` as the Wisp's freeze is |
| `mimicUnlitDrain` | 4× | The reveal runs out this much faster while the light is off it |
| `mimicPopSeconds` | 0.25 | Disguise out, true shape in (scale pop) |
| `mimicTwitchMin / Max` | 5 / 8 s | Gap between twitches |
| `mimicTwitchSeconds` | 0.45 | Length of one twitch |
| `mimicTwitchShake` | 0.012 m | Positional jitter (the Wisp tremble is 0.003) |
| `mimicTwitchTilt` | 3° | Rocking of the disguise |
| `mimicRedisguiseSeconds` | 0.4 | Gap before it settles on a new spot |
| `mimicPity` | 0.5 s | Added to the reveal after each reveal that ended without a good photo, up to `mimicPityMax` 2 s. Answers the scenario's "too punishing" question without a second route |
| `inkSpeed` | 0.3 m/s | Travel along the route |
| `inkSlow` | 0.25 | Speed factor at full UV exposure |
| `inkDwell` | 1.5 s | Pause at each waypoint (it is handling a book) |
| `inkCatchExposure` | 0.4 | Exposure at which a good photo dissolves it |
| `inkFadeStart / End` | 0.02 / 0.30 | `uvMask` range over which it fades in |
| `inkLight` | 0.25 | Scale of its point light, times its visibility |
| `uvInkHoldSeconds` | 0.6 | Hold on a UV plane before its clue is logged (the painting's is 1.0: here the player sweeps) |

`uvDrainSeconds` (45), `uvDist` (4) and `uvAngleDeg` (16) are Level 0's and stay. If the sweep is too slow in playtest, widen the cone before touching the drain.

---

## 9. Systems, in build order

Each step ends with something playable. Steps 1–3 must not change how Levels 0 and 1 play; replay both after each.

### Step 1 — Engine groundwork (no room needed)

- `roomDef.ts`: `bounds`, `startsWithLight`, `lights.uv: boolean | 'lamp'`, `uvText`, `leads`, `secrets.found`, `GhostDef.type: 'mimic'`, `GhostDef.spots`, `GhostDef.route`, `whisper: 'penScratch'`, `InteractableDef.type: 'read'`, `.note`, `.availableWhen`, `.moves`, `.codeNote`, `atmosphere.window.facing: 'east' | 'west'`, `atmosphere.roomTone: 'library'`.
- `propPhysics.ts` and `wispBrain.ts` read `currentRoom().bounds` and fall back to the tuning values.
- `bindNodes.ts`: `Path_*` empties go in `room.spawns`; `UVOnly_*` meshes are collected into `room.uvOnly`, are not occluders, cast no shadow and get `raycast = () => {}`. `requiredNodes` adds `uvText` nodes, Mimic spots (spawn, decoy, disguise), ink routes and `moves` nodes and colliders.
- `actions.ts` `clueNote()` returns the `codeNote` of the first closed code lock that has one. Level 0's lock gets the old text as its `codeNote` (moved, not changed).
- `Mirror`, `Portraits`, `Intro`, `PaintingReveal` must be no-ops for a definition without their data (they already are for the hall; confirm for a room with no mirror at all).

**Check:** `npm run typecheck` passes; both existing rooms play as before, including throwing a book in Level 0 against the same walls; no module imports `level2.def.ts` except `rooms.ts`.

### Step 2 — Load the Library (blockout)

The blockout `level-2.glb` is exported (Oct 8; see §5, export check).

- Register `level2` in `rooms.ts`; `/play?room=library` loads it.
- `Atmosphere`: for `east` / `west` windows the patch quad spans Z instead of X (the window's width runs along the wall). `moon` as in the definition; adjust until the patch lands near the table's east end, clear of the spawn.
- The room has more small objects than any before: `mergeStatic` must collapse the filler books into about six draws (they are static, share five or six materials, and are not named by the definition). The marked books, panel books, decoys and everything the definition names are kept.

**Check:** the bound-node list matches the Blender spec and §5; walk the whole room: blocked by the stacks, the table, the desk, the armchair, the ladder, the closed service door, the vestibules; the aisle between A and B and the window bay are walkable; draw calls in the worst view under 80 on the phone preset; the moon patch is on the floor and not on the Mimic's table end if that hides the twitch (adjust the moon, not the window).

### Step 3 — The UV lamp as a found item

- Store: `hasUv`, `startsWithLight`, `addItem('uv-lamp')`. `toggleMode`, `Controls` in `Hud.tsx`, `touchInput.tsx` and `RotatePrompt.tsx` read `hasUv`. The touch White/UV button appears when the lamp is taken.
- `chain.ts`: `case 'uv'`: `held` returns `hasUv`, `on` as before.
- `Pickup_UV_Lamp` is a `model` pickup: the loader places it (a plain box if `uv-lamp.glb` is missing, so this works before the asset exists). `visibleWhen: 'flag:mimic-caught'` keeps it out of sight until the Mimic drops it; the Mimic's drop (Step 7) is the same `createDrop` the key Wisp uses. Until Step 7, the debug skip gives the flag and takes the lamp.
- Level 1's definition gets `nextRoom: 'library'`; its card then offers *Play next level*, which already carries the battery.
- The lamp pick-up message: "Picked up: UV lamp"; the guide explains the rest.

**Check:** in the Library, `Q` and the UV touch button do nothing and show nothing before the lamp; after it, both work; Levels 0 and 1 behave as before (UV from the start; never); a deep link to `/play?room=library` has the flashlight on.

### Step 4 — UV ink as data

`light/UvInk.tsx`, mounted in `Room.tsx`; it does nothing for a definition without `uvText`.

- For each entry, the plane's material is replaced by a flat node material: colour violet-white, opacity `texture(art).r × uvMask()`, additive-leaning blend with `depthWrite: false`, `fog: false`, small `renderOrder`. The mesh's `visible` follows "the UV lamp is lit" each frame, so in white light the planes cost nothing.
- **Art** (`uvInkArt.ts`, canvas stand-ins first): `message` is the definition's `text` in loose brush lettering; `hand` is an open five-finger hand with a clear palm (drawn once, `flip: true` mirrors the UVs); `digit` is the entry's `digit`, bold. If `/textures/level2/<name>.png` exists it replaces the canvas, as `mirror-text.png` does.
- **Clue logging:** each frame, for an entry with `gives` not yet held: the plane's world centre is unblocked (`blocked()` from `wispBrain.ts`) and `uvMaskAt(centre) ≥ clueMaskThreshold` for `uvInkHoldSeconds` continuously → `apply(gives)` and the chime. Decays when the condition fails. Planes that are children of a book are tracked by their live world position, so a thrown book still counts.
- The handprints log one shared clue (`clue:handprints`) so "the books that were handled glow" is a single guide condition.

**Check:** with the lamp and UV on, the message over the fireplace, the four handprints and the digits appear inside the cone only, fade at its edge and are invisible in white light; each logs once; a marked book pulled from its shelf and thrown keeps its ink and still logs; FPS is unaffected with UV on and every plane in view.

### Step 5 — Props: marked books and cover books

- `grabProp` sets `flag:moved:<node>` the first time (the sound and held state are unchanged).
- The marked books and cover books are `throwable` props (§6). They start on shelves inside the stacks' collider boxes: grabbing works (the held pose resolves against colliders), and a thrown book bounces off the stack's face like any wall.
- Props use the room's bounds (Step 1), so a book can fly the whole room.
- `availableWhen` on the panel (Step 6) needs `flag:moved:Prop_PanelBook_2` and `_3`.

**Check:** every marked book and cover book can be grabbed from its shelf and thrown anywhere in the room, including the far end and under the ceiling; none is lost behind a collider; Level 0's four books behave as before.

### Step 6 — New interactions

All in `actions.ts`, by `type`, reading the current definition.

| Type / field | Behaviour |
| --- | --- |
| `read` | Prompt "Read the {name}"; `interactWith` opens the note (`openNote`) and the note's `gives` apply; the note is re-readable by interacting again. The ledger is the first use |
| `search` | As Level 1's coat pocket. The dictionary gives one battery pack and sets `flag:dictionary-searched` |
| `lid` with `hingeAxis: 'y'` | The panel door. Same path as the chest lid, about Y |
| code lock on a `lid` | `tryCode` opens the lid itself after the lock falls (as `trySymbols` does); a `drawer` keeps today's behaviour (the player opens it). The lock drops and fades with `dropAndFade`, shared with the symbol lock; the 0.45 m drop of the Level 0 padlock would fall through the shelf |
| `availableWhen` | `promptFor` returns null until every token holds, so the ray ignores the thing; used by the panel |
| `moves` | On open, tween each named node by `by` (and the named `Collider_` box in `runtime.colliders` by the same amount) over `tuning.doorSeconds`, with the door's creak and a ladder-roll sound |

- The panel's contents (`Pickup_Kitchen_Key`, `Pickup_Diary_Page`, `Pickup_Battery_Panel`) show when `flag:panel-open` is set, as the chest key does. Picking up the diary page opens the note and sets `flag:diary-found`; the page can be re-read from the item bar.
- `Interact_Service_Door` is the exit: opening it marks completion and, after `completeDelay`, the card.

**Check:** the ledger reads and re-reads; the dictionary gives one pack, once; the panel gives no prompt until both front books are out, then asks for four digits; the right digits open the door by themselves; wrong digits give no feedback beyond the wheel clicks; the key, page and pack appear; the service door answers "locked" without the key, and with it opens, moves the ladder and its collider, and the card appears.

### Step 7 — The Mimic

`ghost/Mimic.tsx`, `mimicBrain.ts`, `mimicMaterial.ts`. Plain data plus a step function, like the Wisp's brain; the component owns the meshes and is the only writer of its `runtime.ghosts` entry.

**States:** `disguised` → (white light for `mimicFreezeDelay`) → `freeze` (revealed) → `disguised` at a new spot, or `dissolve` → `gone`.

1. **Start.** A random spot is chosen (debug: `?mimic=N`). Its decoy is hidden; the matching disguise mesh is placed on the spot. All other decoys stay visible. `runtime.ghosts` entry: state `disguised`, `photographable: false`.
2. **Twitch.** Every `mimicTwitchMin..Max` seconds, the disguise shakes for `mimicTwitchSeconds` (jitter and tilt) and a scrape plays, louder as the player gets near. This is the only tell: disguise and decoy are the same mesh and material.
3. **Freeze.** While the white beam holds on the disguised object (`beamOn` at the spot's centre) for `mimicFreezeDelay`, the disguise pops out and `Mimic_True` pops in over `mimicPopSeconds`, with the ghost material. State `freeze`, `photographable: true`, timer `mimicRevealSeconds × lit`, draining `mimicUnlitDrain` times faster while the light is off it.
4. **Photo.** `on('photo')`: `ghostId === 'mimic'`, state `freeze`, quality ≥ `photoDissolveQuality` → dissolve (shared dissolve length), then the drop. A shot taken while it is disguised is just a photo (`photographable` is false).
5. **Re-disguise.** If the reveal ends without a good photo, `Mimic_True` pops out, the disguise settles on a different spot after `mimicRedisguiseSeconds`, the decoy that was hidden is shown again, and `mimicPity` is added to the next reveal.
6. **Drop.** On dissolve the UV lamp falls from the dissolve point through `createDrop` (it finds the table top or the floor under it), sets `flag:mimic-caught`, glints. The Mimic's former decoy is shown again, so the table keeps its books.
7. **Flag set from outside** (a debug skip): the Mimic dissolves at once and the drop appears where it is, so the room is consistent.

**Scoring:** `scoreGhost` already needs only `position`, `speed` and the base score; Step 8 adds the two changes it shares with the Ink Ghost.

**Check:** a new player finds the twitching object within a minute; light held on a decoy does nothing; light held on the Mimic freezes it in about 0.6 s and reveals the true shape for about 3 s; a good photo dissolves it and the lamp lands on the table and glints; letting the reveal run out sends it to another spot, never off the table area; the guide label for "Something is wrong with one of the books" appears and goes.

### Step 8 — The Ink Ghost and the photo rules

- **Variant of the Wisp** (`Wisp.tsx`, `wispBrain.ts`): same cloth and dissolve; `mesh: 'Ink_Ghost'`; `GhostDef.route` is the ordered list of `Path_InkGhost_*` positions, a closed loop. In `wander`, the brain follows the loop with a Catmull-Rom curve at `inkSpeed × lerp(1, inkSlow, exposure)`, pausing `inkDwell` at each waypoint. It never flees and never freezes.
- **Light source by ghost kind:** `brain.lit` for a white-light ghost is `beamOn(...)` as today; for an ink ghost it is `uvMaskAt(position)` (0..1, including battery strength and range). Exposure follows it as before.
- **Visibility:** `createWispMaterial({ uvOnly: true })` multiplies opacity and glow by `smoothstep(inkFadeStart, inkFadeEnd, uvMask())`, so it exists only inside the cone. Its point light scales by the same visibility, so an unseen ghost lights nothing.
- **`catchable`:** a brain field the dissolve rule reads instead of `state === 'freeze'`: Wisp → freeze, Mimic → freeze, Ink → `exposure ≥ inkCatchExposure`. `photographable` for the Ink Ghost is the same condition's looser cousin: it can be photographed whenever any UV is on it (`uvMaskAt > 0.05`).
- **Scoring (`scorePhoto.ts`):** `liveGhosts()` returns photographable ghosts only; `scoreGhost` takes `lit` from `beamOn` for white-light ghosts and from `uvMaskAt` for ink ghosts (selected by the definition's `type`). A weaker battery gives a thinner cone and a lower score, as everywhere.
- **Audio:** `penScratch` loop, louder as the player nears; a dissolve uses the existing sound.

**Check:** in white light the Ink Ghost is invisible and unphotographable; in the UV cone it appears, slows and can be photographed; a good photo with UV on it dissolves it and the best photo is kept; a photo in white light of the empty air is just a photo; following it leads to the four marked books; it never leaves the stacks' front; on a low battery the cone is thin and the score is lower.

### Step 9 — Chain, stars and the complete card

| Link | Trigger | Result |
| --- | --- | --- |
| 1 | Room mounts | Flashlight in hand, battery as carried (or 0.5); `Pickup_Battery_Desk` on the desk |
| 2 | Read `Interact_Ledger` | `clue:read-top-down` |
| 3 | Photograph the frozen Mimic | Dissolve; `flag:mimic-caught`; `Pickup_UV_Lamp` falls |
| 4 | Pick up the lamp | `hasUv`; `Q` works |
| 5 | UV on the message and handprints | `clue:hall-message`, `clue:handprints` |
| 6 | UV on each marked book's digit | `clue:library-digit-a…d` |
| 7 | Pull out `Prop_PanelBook_2` and `_3` | `flag:moved:*`; the panel is usable |
| 8 | Enter 7-2-0-5 on `Interact_Hidden_Panel` | `flag:panel-unlocked`, door opens, `flag:panel-open`; key, page and pack appear |
| 9 | Pick up `Pickup_Kitchen_Key` | `item:kitchen-key` |
| 10 | Use `Interact_Service_Door` | Door opens, ladder and its collider move, `completedAt`, the card |

- No link is gated on a clue: a player who guesses the digits or never meets the Ink Ghost can still finish. Clues drive the guide and, later, the journal.
- The optional pieces (dictionary pack, Ink Ghost, diary page) never block the chain.
- **Card:** `CompleteCard` counts `def.secrets.found` tokens that hold ("Secrets 1 of 1" only with the page read; Level 1 passes no `found` and still shows 0) and prints each `def.leads` line whose `when` holds ("A lead in the hall"). Stars: ① door open ② both non-secret ghosts photographed (Mimic and Ink) ③ under `parSeconds` (no hints exist yet). The run is recorded once, with its leads. `complete.secrets` becomes `'Secrets {found} of {total}'`.
- "Next: The Kitchen — coming soon".

**Check:** the chain completes from spawn to open door with no dead end on desktop and touch; the card is right for a full run, for a run that skipped the Ink Ghost, and for a run that never read the diary.

### Step 10 — Atmosphere and audio

**Look**

- Warmer than the hall: cream, teal, plum, walnut, a candle's saffron; the moon patch from the east window falls near the table. UV ink is violet with a hard-edged cone (the shared cone mask; no blur). The look values from Levels 0 and 1 apply.
- The Mimic's true shape and the Ink Ghost use the ghost palette through their own materials; the print post-processing treats them like the Wisp.

**Audio**

- Room tone `'library'`: dry, still, lower than the hall; a clock that is not ticking (no tick loop).
- New one-shots: Mimic scrape (positional volume), Mimic reveal, page rustle (ledger, diary), book pull, panel unlock, ladder roll. Loop: `penScratch` for the Ink Ghost. Existing: UV hum, drawer, rummage, lid creak, key drop, chime.

**Check:** with UV on, the Ink Ghost visible and the candle lit, the frame budget holds on the phone preset; the first view (candle, table, fireplace down the long axis) reads in under two seconds.

### Step 11 — Teaching the room (guide labels)

First step of each phase only, as in Level 1; battery lines keep priority. Conditions use existing tokens plus `uv:held`.

| When | Delay | Label |
| --- | --- | --- |
| Lamp not found | 20 s | "Something is wrong with one of the books." |
| Camera raised, Mimic not frozen, lamp not found | 6 s | "Catch it in your light first, then shoot." |
| Lamp held, UV never on | 3 s | "Press **Q** to switch to UV, then sweep the room." (touch: the UV button) |
| Lamp held, ledger unread | 90 s | "The ledger on the desk may say how to read what you find." |
| Handprints seen, panel closed | 60 s | "Handprints on four books. Each has a digit inside." |
| All four digits found, panel closed | 20 s | "Four digits. Something is hidden behind the books." |
| Panel open, key not taken | 4 s | "A key lies in the panel." |
| Key held, door closed | 10 s | "The service door is at the back, behind the ladder." |

On touch, key names become button names, as in Levels 0 and 1.

**Check:** a player who does nothing gets a nudge at each link, never two labels at once, and never one for a link already done.

### Step 12 — Debug additions

- `debugSkips` for the Library, each applying the earlier ones: *mimic caught* (give `flag:mimic-caught`, take `Pickup_UV_Lamp`), *UV clues* (give the message, handprint and four digit clues), *panel exposed* (give `flag:moved:Prop_PanelBook_2` and `_3`), *panel open* (unlock and use `Interact_Hidden_Panel`, give `flag:panel-open`), *kitchen key* (take it).
- *Ghosts* folder: rows for the Mimic (state, current spot, next twitch) and the Ink Ghost (exposure, route index); *Show Mimic spots* and *Show Ink route* overlays beside the existing ones.
- `?mimic=N` starts the Mimic on spot N.

**Check:** every skip leaves the room in a state the next link can continue from; *Reset level* puts the Mimic, the Ink Ghost, the books, the ladder and `hasUv` back.

---

## 10. Strings

Every line in the scenario is English only. New `en.ts` keys, all filled in `pl.ts`:

- Items (`item.<id>` and `.acc`): `uv-lamp`, `kitchen-key`, `diary-page`. Polish needs the accusative for the pickup prompts and messages.
- Prompts: `prompt.read` ("Read the {name}"), plus the names used by `read`, `search` and `lid` (`ledger`, `dictionary`, `panel`; accusative in Polish).
- Prop label `book` (accusative `książkę`, as Level 0).
- `complete.secrets` with `{found}`; the lead line comes from the definition.
- Guide texts, notes, search line, `complete` text: in the definition, as `Localized`.
- The debug panel stays English.

---

## 11. Milestones, hand-off, budget

| # | Milestone | Steps | Device check |
| --- | --- | --- | --- |
| M1 | Engine groundwork, Levels 0 and 1 unchanged | 1 | Laptop |
| M2 | Walk the Library, draw calls in budget | 2 | Laptop + iPhone |
| M3 | Lamp, UV ink, books | 3–5 | Laptop + iPhone (touch button, grabbing a book) |
| M4 | Interactions, panel, ladder | 6 | Laptop + iPhone |
| M5 | Mimic | 7 | Touch feel of the freeze-and-shoot |
| M6 | Ink Ghost, photo rules | 8 | iPhone performance in UV |
| M7 | Chain complete, card | 9 | Full playthrough on both |
| M8 | Look, sound, guide, debug | 10–12 | Cold playtest with two new players |

**Asset hand-off**

| Code step | Needs from Blender / images | Fallback until then |
| --- | --- | --- |
| 2 | Blockout `level-2.glb` | Done (exported Oct 8) |
| 3 | `uv-lamp.glb` | Done (exported Oct 8) |
| 4 | `UVOnly_*` planes, art PNGs | Canvas-drawn art |
| 5 | Marked and cover books, axis-aligned, planes inside them | Blockout boxes |
| 7 | `Decoy_*`, `Mimic_Book`, `Mimic_Stool`, `Mimic_True` | Done (placeholder `Mimic_True`) |
| 8 | `Ink_Ghost`, `Path_InkGhost_*` | Done (placeholder mesh and material) |
| 10 | Materials pass | Blockout colours |

Every re-export from Blender should load without code changes; `bindNodes` validation names anything missing. Run `npm run assets` after each export (it already routes `level-2*.glb` to `models/level2` and `uv-lamp.glb` to `models/shared`).

**Performance budget** (Level 0's targets; draw calls are the risk, the Library has the hall's floor area and far more small objects)

| Metric | Laptop | iPhone 15 Pro |
| --- | --- | --- |
| Frame rate | 60 fps | 60 fps, never below 45 |
| Draw calls | < 120 | < 80 (filler books merge to about six) |
| Triangles | < 300k | < 150k |
| Shadows | Flashlight only | Flashlight only, 512 map |
| Room `.glb` (compressed) | < 8 MB | same |

Measure with `?debug` in the worst view: UV on, Ink Ghost in view, candle lit, a book in hand, the whole table in frame.

---

## 12. Decisions taken, and open questions

**Decided in this plan** (change any of them here, not in the code):

1. **Panel location:** in stack A, behind four loose cover books; the panel is usable once the two in front (`_2`, `_3`) have been moved. (Scenario said "behind the marked books"; the marked books stay on four stacks for the sweep.)
2. **Starting battery:** on the desk top, not in the drawer (the export has `Desk_Drawer_1/2` as plain scenery).
3. **Digit on the cover too:** a book that lands spine to the wall would hide its digit. Proposed Blender addition: `UVOnly_Digit_*_Cover`, a second plane on the cover, same clue. A held book shows its cover, so the digit is readable in the hand. If rejected, the first-sight clue log is the only safety net.
4. **No inspect mode** for books (scenario §12). The UV digit on the shelf is enough, plus decision 3.
5. **`Q` before the lamp is silent**, as `F`, `Q`, `R` are before the flashlight in Level 0; the guide label explains it. No extra message.
6. **The ledger rule stays on the desk** (plain light), not itself a UV clue. The first sweep already has enough to find.
7. **The Mimic stays the key ghost,** with `mimicPity` as the safety (each failed reveal lasts longer, up to +2 s). If playtests still show players stuck, the fallback is the scenario's alternative (lamp in a drawer, Mimic optional); that is a definition change, not an engine one.
8. **Window:** the export already has a 2.2 m opening (frame top at 2.82 m), under the ceiling; the Blender spec text (2.8 m) is stale.
9. **The diary secret counts when the page is shown,** not when it is closed.
10. **Mimic starts on a random spot** each load; `?mimic=N` fixes it for testing.

**Still open**

- [ ] Who is the Ink Ghost? No code depends on it; the Blender mesh, the hand (left or right) and the diary text should agree before the art pass.
- [ ] Mantel clock: hands stopped at 3:17 would pre-empt the hall clue. Blender-only decision.
- [ ] Top shelf at 2.40 m: the Blender reach check decides. If shelves drop to about 2.0 m, only `uvText` positions and the Blender names change, not the code.
- [ ] Decoys static (as planned) or throwable. If throwable, the Mimic must cope with a missing decoy; this plan assumes static.
- [ ] Should the hall's *Play next level* offer be on by default now that the Library exists, and should `DEFAULT_ROOM` stay Level 0? (Level 1's plan asked the same about the hall.)
- [ ] Kit carry-over (`hasUv`, items, flags) for the return visit and Room 3: where does it live before the mansion state exists?

---

## 13. Writing the code with Claude Code

- This file lives at `docs/level-2-implementation.md`, next to the scenario, the Blender spec and the Level 0 and 1 plans.
- Work one step at a time: "Implement Step 4 from docs/level-2-implementation.md". Each step's **Check** is its acceptance test.
- After every step, play `/play?room=level-0` and `/play?room=entrance-hall` once: Steps 1, 3, 5 and 8 change shared systems (bounds, UV gating, prop physics, scoring).
- Every balance number goes into `tuning.ts`; room design values (par time, texts, routes, spots) go into the definition.
- Run `npm run typecheck` after each step. `noUnusedLocals` is on, so dead code fails it.
- Names the code looks up must be in the definition, or `mergeStatic` removes them. Every new node in §5 is.
- Never name two files in one folder differently only by case (macOS).
