# Level 2 — Library — Blender asset spec

Oct 8, 2026 · @Michał Kręcisz · companion to [`level-2-scenario.md`](./level-2-scenario.md), [`level-1-blender-asset-spec.md`](./level-1-blender-asset-spec.md) and [`level-0-blender-asset-spec.md`](./level-0-blender-asset-spec.md)

Level 2 is Room 2 of the mansion, the Library: free, about **9 minutes** on a first play (12 at most). This file lists everything that has to be made in Blender for it: layout, assets, names, pivots, textures and export. Style, naming rules, materials and export settings are the same as Levels 0 and 1; only what is new or different is spelled out here. The scenario is the source of truth for behaviour; names below are proposals in the same style as Level 1.

---

## 1. The room in one page

**Goal:** find the Kitchen key and open the service door at the back of the Library.

**Chain (8 links, ~9 min), with the Blender object each one touches**

| # | Link | Blender objects |
| --- | --- | --- |
| 1 | Enter; a battery on the librarian's desk | `Spawn_Player`, `Pickup_Battery_Desk` |
| 2 | Read the lending ledger (top-shelf-down rule) | `Interact_Ledger` |
| 3 | Find and photograph the Mimic among the table books; it drops the UV lamp | `Reading_Table`, `Decoy_*`, `Mimic_*`, `Spawn_Mimic_1`–`5` |
| 4 | UV sweep: message over the fireplace, handprints on four books, Ink Ghost visible | `UVOnly_Message`, `UVOnly_Handprint_A`–`D`, `Ink_Ghost` |
| 5 | Read the four spine digits, top shelf to bottom | `UVOnly_Digit_A`–`D` on `Prop_MarkedBook_A`–`D` |
| 6 | Pull the books off the shelf; the hidden panel is behind them | `Prop_PanelBook_*`, `Interact_Hidden_Panel` |
| 7 | Enter 7-2-0-5; diary page, battery and Kitchen key inside | `Hidden_Panel_Lock`, `Pickup_Kitchen_Key`, `Pickup_Diary_Page`, `Pickup_Battery_Panel` |
| 8 | Key opens the service door; the ladder rolls aside | `Interact_Service_Door`, `Ladder` |

**Optional:** battery in the hollow dictionary on stack B (search interaction); Ink Ghost photo for the second star; the diary page is the room's one secret.

**Decisions taken in this spec (change them in the open questions, §11):** room is **6.0 × 8.0 m with a 3.2 m ceiling**; four freestanding-look stacks along the side walls (two per wall); the hidden panel sits in a bay of stack A, covered by loose books (§5); the UV lamp is its own held/floor model, not part of the room `.glb`.

---

## 2. Style

Same as Level 1: **woodblock print (ukiyo-e at night)**, flat palette colour per material, bold simple shapes, real-world sizes, slightly chunky details, no gloss. The game draws outlines and tone bands, so models need clean silhouettes.

**What's different in a library**

- **Warmer than the hall.** Paper cream, deep teal and plum book spines, walnut shelving, saffron where the candle reaches, a pale moon patch from the window. Suggested flats: wall `#2f4a4f` (teal), wainscot/shelves `#4a3322` (walnut), spines `#7a2f4e` plum / `#1f5f66` teal / `#c9a24a` ochre / `#e8dcc0` cream, rug `#8c3b2f`. Final values come from the palette in `src/styles.css`.
- **Books are the texture of the room.** Filler books are plain boxes in 5–6 flat spine colours with varied heights and the odd leaning gap. No per-book detail, no text. Only the four marked books and a few hero books carry textures.
- **Four stacks must read as four places** from the entrance: give each a slightly different silhouette (a ladder rail on one, a lower top on another, a clock or bust on top) so the player can say "the one by the window" without a name.
- **The handprints must read as hands.** Large, five fingers, clearly a hand even at 2 m in the UV cone (§5).
- Floor: dark wide planks. Centre rug under the reading table.

---

## 3. Room layout

The Library is **6.0 × 8.0 m, 3.2 m ceiling**. Floor centre at the world origin. Blender +Y is north, +X is east.

```
                         NORTH  (y = +4)
   x=-3 ┌─────────────[ladder rail]───────────────────┐ x=+3
        │▓A▓   ┌─ chimney breast ─┐  ╔═SERVICE DOOR═╗ ▓C▓│
        │▓A▓   │   FIREPLACE      │  ║ ladder (blk) ║ ▓C▓│
        │▓A▓   └──────────────────┘  ╚══════════════╝ ▓C▓│
        │▓A▓   (panel bay in A)                       ▓C▓│
        │                                                  │
        │                  ┌── READING TABLE ──┐         ░░│ ← arched
        │            d1 d2 │  candle  d3  d4   │  d5     ░░│   window
        │                  └───────────────────┘ (stool) ░░│   (east)
        │▓B▓                                          ▓D▓│
        │▓B▓                                          ▓D▓│
        │▓B▓                                          ▓D▓│
        │ ┌ LIBRARIAN'S DESK ┐                        ▓D▓│
        └─┴──────────────────┴────────[ ]────────────────┘
                              SOUTH (y = -4)  ★ Spawn_Player, facing north
                              (open entry door, to the hall)
```

| Element | Position (centre, metres) | Facing |
| --- | --- | --- |
| Entry door (to the hall), modelled open | x 0, y −4.0 | North (into the library) |
| Spawn_Player | x 0, y −3.3 | North |
| Librarian's desk (+ visitor chair on its north side) | x −1.5, y −3.6 | North |
| Stack A (NW, digit 2, hides the panel) | x −2.75, y 2.4, against the west wall | East |
| Stack B (SW, digit 5, hollow dictionary) | x −2.75, y −1.6, against the west wall | East |
| Stack C (NE, digit 7) | x 2.75, y 2.4, against the east wall | West |
| Stack D (SE, digit 0) | x 2.75, y −1.6, against the east wall | West |
| Arched window | x 3.0, y 0.4, sill at 0.5 m, between stacks C and D | West |
| Reading table | x 0, y 0.4 | — |
| Candle on the table | x 0, y 0.45 (see the candle rule in the Level 0 spec) | — |
| Fireplace + chimney breast | x −0.8, y 3.8, against the north wall | South |
| Service door | x 1.6, y 4.0 | South |
| Ladder (blocking position) | x 1.6, y 3.65, on the rail | South |
| Ladder (pushed aside) | x 0.7 (`aside_offset_x` is −0.9) | — |
| Mimic spots 1–4 (table books) | (−0.7, 0.4), (−0.25, 0.6), (0.3, 0.25), (0.75, 0.55), z 0.76 | — |
| Mimic spot 5 (stool) | x 1.2, y −0.6 | — |
| Reading armchair | x −1.4, y 2.2, angled to the fireplace | — |
| Rug | centre on the table, 3.4 × 2.4 | — |

Each stack is **1.8 m long (along the wall) × 0.45 m deep × 2.8 m high**, with four shelves whose tops are at **0.45, 1.10, 1.75, 2.40 m** (bottom to top) and a plinth below. The marked books (§5) sit on a different shelf in each stack. Stack ranges leave the window (y −0.3 to 1.1) and the aisle between A and B (y −0.7 to 1.5) clear, so the player can walk the whole room.

**Reach check:** the top shelf (2.40 m) is above eye height (1.6 m). From the aisle at 1.0 m away, the player must be able to read the top-shelf spine under UV and see the handprint. Check in Blender with a camera at eye height before committing to the shelf heights; lower the stack tops if the top shelf is awkward.

**Why this layout:** from the entrance the first thing the white light finds is the lit table and its candle (the Mimic); the fireplace faces the entrance down the long axis (the message is the first thing a UV sweep finds); the four stacks bracket the room, so following the Ink Ghost's drift or the handprints crosses all of it once; the service door sits at the far end behind the ladder.

---

## 4. Asset list

Sizes in metres (width × depth × height). Status is updated as we go.

### Room shell and architecture

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Room shell | `Floor`, `Wall_N`, `Wall_E`, `Wall_S`, `Wall_W`, `Ceiling`, `Wainscot` (0.9 m, all walls), `Skirting`, `Cornice` | 6.0 × 8.0, 3.2 high | Floor centre at world origin | The Library | Blockout |
| Arched window | `Window_Frame`, `Window_Glass`, `Window_Curtain_L`, `Window_Curtain_R` | 1.4 × 0.15 × 2.8 (round arch on top) | Back centre | The only light, moon patch on the floor | Blockout |
| Entry door | `Entry_Door_Frame`, `Entry_Door` (leaf, modelled **open** at 80° against the wall), handle | 1.0 × 0.06 × 2.2 | Leaf: hinge edge at floor level | The way back to the hall; stays open | Blockout |
| Hall vestibule | `Hall_Vestibule` (dark box behind the entry, like `Library_Vestibule` in Level 1) | 1.2 × 1.0 × 2.4 | Floor centre | Hides the world beyond the door | Blockout |
| Service door | `Service_Door_Frame`, `Interact_Service_Door` (leaf + handle, closed), `Service_Door_Sign` (brass plate) | 1.0 × 0.08 × 2.2 | Leaf: hinge edge at floor level, hinge on the west edge | Exit, opens with the Kitchen key | Blockout |
| Kitchen vestibule | `Kitchen_Vestibule` (dark box behind the service door) | 1.2 × 1.0 × 2.4 | Floor centre | Hides the world beyond the door | Blockout |
| Fireplace | `Fireplace` (surround, hearth, dark firebox with cold ash), `Fireplace_Mantel`, `Chimney_Breast` (projects 0.3 m from the wall, up to the ceiling) | 1.6 × 0.5 × 1.2 (breast 2.2 wide) | Floor centre against the wall | Carries the UV message; character | Blockout |
| Ladder rail | `Ladder_Rail` (brass rail along the north wall at z 2.5, from x 0.4 to 2.95, clear of the chimney breast) | 2.55 long | Wall centre | Ladder travel | Blockout |

### Hero assets (drive the chain)

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Bookstacks ×4 | `Stack_A` … `Stack_D`: carcass, shelves, plinth, and filler books (one object per stack, or one per spine material) | 1.8 × 0.45 × 2.8 | Floor centre against the wall | Fill the room, hold the marked books | Blockout |
| Marked books ×4 | `Prop_MarkedBook_A` … `_D` (see §5; **axis-aligned, base-centre origin**) | 0.14 × 0.30 × 0.38 (a chunky folio) | Base centre | Grabbable, throwable; carry the handprint and digit | Blockout |
| UV digits ×4 | `UVOnly_Digit_A` … `_D` (thin planes, **children of the marked book**) | 0.07 × 0.12 | Plane centre | Invisible in white light | Blockout |
| UV handprints ×4 | `UVOnly_Handprint_A` … `_D` (thin planes, **children of the marked book**) | 0.12 × 0.16 | Plane centre | Invisible in white light | Blockout |
| UV message | `UVOnly_Message` (plane on the chimney breast) | 1.6 × 0.4 | Back centre | "The hall remembers what the clock forgot." | Blockout |
| Reading table | `Reading_Table` | 2.2 × 0.9 × 0.76 | Floor centre | Holds the decoy books and the candle | Blockout |
| Table decoys | `Decoy_Book_1` … `_4` (on the table), `Decoy_Stool` (beside it); one mesh each, **identical to the Mimic's disguises** | Book 0.2 × 0.28 × 0.05; stool 0.4 Ø × 0.45 | Base centre | The five places the Mimic can hide | Blockout |
| Candle | `Prop_Candle` (wick is the highest point) | 0.07 Ø × 0.2 | Base centre | Lit on the table; listed in the definition as a `candle` interactable | Blockout |
| Librarian's desk | `Librarian_Desk` (body), `Desk_Drawer_1`, `Desk_Drawer_2` (decorative fronts, not usable), `Desk_Chair` | 1.4 × 0.7 × 0.8 | Body: floor centre; drawer: back centre | Starting battery and the ledger | Blockout |
| Lending ledger | `Interact_Ledger` (large open book on the desk, last entry visibly struck out) | 0.5 × 0.35 × 0.05 | Base centre | Readable note (the top-shelf-down rule) | Blockout |
| Hollow dictionary | `Interact_Hollow_Dictionary` (a fat dictionary on stack B, third shelf; one object) | 0.2 × 0.3 × 0.4 | Base centre | Search interaction, reveals a battery | Blockout |
| Hidden panel | `Hidden_Panel_Frame` (recess in the back of the stack A bay), `Interact_Hidden_Panel` (hinged door, flush with the bay back), `Hidden_Panel_Lock` (four wheels, like `Chest_SymbolLock`) | 0.4 × 0.2 × 0.35 | Door: hinge edge; lock: front centre | Four-digit lock, holds the key | Blockout |
| Panel cover books | `Prop_PanelBook_1` … `_4` (loose, throwable, axis-aligned, base-centre origin) | 0.10 × 0.22 × 0.45 | Base centre | Hide the panel until pulled out | Blockout |
| Kitchen key | `Pickup_Kitchen_Key` (distinct from the brass and Library keys: heavy, plain iron) | 0.12 long | Centre | Inside the panel | Blockout |
| Diary page | `Pickup_Diary_Page` (folded sheet in the panel cavity) | 0.2 × 0.15 | Base centre | The room's one secret | Blockout |
| Ladder | `Ladder` (rolling library ladder, **modelled in the blocking position**) | 0.55 × 0.4 × 2.5 | Rail contact point (top) | Half-blocks the service door; rolls aside | Blockout |

### Ghosts

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Mimic | `Mimic_Book` and `Mimic_Stool` (the disguise meshes, **identical to `Decoy_Book_*` / `Decoy_Stool`**), `Mimic_True` (the true shape: a book with a ragged mouth of pages and little legs, ~0.4 wide) | Book 0.2 × 0.28 × 0.05; true 0.4 × 0.3 × 0.25 | Base centre | Key ghost; twitch and freeze | Blockout |
| Ink Ghost | `Ink_Ghost` (pale ghost shape with a quill or ink-stained hands; reuses the Wisp mesh until the character decision, §11) | ~0.5 | Centre | Optional ghost, visible only in the UV cone | Blockout |

### Furniture and set dressing

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Reading armchair | `Reading_Armchair` | 0.8 × 0.8 × 1.0 | Floor centre | By the fireplace, character | Blockout |
| Rug | `Rug` | 3.4 × 2.4 | Floor centre | Under the table | Blockout |
| Mantel clock | `Mantel_Clock` (blockout has no hands yet, see §11) | 0.25 × 0.12 × 0.3 | Base centre | "A clock that is not ticking" | Blockout |
| Globe | `Globe` | 0.4 Ø × 0.6 | Floor centre | Silhouette next to a stack | Blockout |
| Bust or statue | `Prop_Bust` (on top of one stack) | 0.3 × 0.3 × 0.4 | Base centre | Makes stack C readable from the entrance | Blockout |
| Desk lamp | `Desk_Lamp` (cold, with a green shade) | 0.25 × 0.25 × 0.4 | Base centre | Desk character | Blockout |
| Small props | 4–5 of: stack of loose papers, inkwell with quill, spectacles, pile of books on the floor, a fallen book (a throwable can be flagged `throwable: true`) | Small | Base centre | Character | Blockout |

### Pickups and reused assets

| Asset | Source | Notes |
| --- | --- | --- |
| Battery pack (×3) | Copy the Level 0 mesh as `Pickup_Battery_Desk` (on the librarian's desk), `Pickup_Battery_Dictionary` (inside the hollow dictionary), `Pickup_Battery_Panel` (in the hidden panel) | Same mesh, three instances; the dictionary and panel packs are shown by the code when searched or opened |
| UV lamp | **New:** `blender/export/uv-lamp.glb` | A small violet-glass lamp or cartridge, 0.18 long, base-centre origin. It is **not in the room `.glb`**: the Mimic's drop places it (like the floor flashlight in Level 0). The held model stays `flashlight.glb`. See §11 |
| Flashlight, camera | `flashlight.glb`, `camera.glb` | No change |

### Spawns and paths (empties)

| Name | Where | Used for |
| --- | --- | --- |
| `Spawn_Player` | x 0, y −3.3, facing north | Start |
| `Spawn_Mimic_1` … `_4` | On the table, at the four decoy books (positions in §3) | Mimic disguise spots (books) |
| `Spawn_Mimic_5` | On the stool seat (x 1.2, y −0.6, z 0.45) | Mimic disguise spot (stool) |
| `Spawn_InkGhost` | By stack B, about 1.3 m up | Ink Ghost start |
| `Path_InkGhost_01` … `_08` | Along the front of the stacks at about 1.3 m: B → A (via the fireplace) → C → D → back to B | The Ink Ghost's slow loop, touching the marked books |
| `Spawn_Battery_Emergency` | Floor by the entry door | Emergency pack if the player runs dry |

The `Path_InkGhost_*` empties should pass within 0.8 m of each marked book, so following the ghost leads to the same four places the handprints do.

### Colliders

| Name | Covers |
| --- | --- |
| `Collider_Wall_N`, `Collider_Wall_E`, `Collider_Wall_S` (split around the entry door), `Collider_Wall_W` | Walls |
| `Collider_Service_Door` | The closed service door, removed when it opens |
| `Collider_Ladder` | The ladder in the blocking position; **moves with `Ladder`** |
| `Collider_Stack_A` … `_D` | The stacks (the shelves themselves are not walkable) |
| `Collider_Reading_Table`, `Collider_Librarian_Desk`, `Collider_Armchair`, `Collider_Fireplace`, `Collider_Globe`, `Collider_Stool` | Furniture |
| `Collider_Vestibule_*` | Boxes around both dark vestibules |
| `Collider_Floor`, `Collider_Ceiling` | Skipped by the player collision, kept for raycasts |

---

## 5. Special objects

### UV-only writing (`UVOnly_*`)

The central trick of the room: ink that exists **only inside the UV cone**.

- **New prefix `UVOnly_`.** Each is a thin plane placed 3 mm off its surface, textured with a white-on-black image (like the painting's UV writing in Level 0). The game's shader reveals it only inside the UV cone, and the room definition lists each one as a `uvText` entry (node, image, clue to log). Without UV they draw nothing.
- **The digits and handprints are children of the marked book.** The books are throwable; the ink must travel with them and stay readable wherever the book lands (scenario §4, dead ends). Keep the child's transform relative to the book, and keep the book itself axis-aligned.
- `UVOnly_Message`: "The hall remembers what the clock forgot." in loose brush-like lettering, centred on the chimney breast above the mantel (z ~2.0, 1.6 × 0.4, facing south).
- `UVOnly_Handprint_A` … `_D`: one open hand, fingers spread, on the spine of the marked book. Use two textures (left and right hand) and flip freely. The digit sits inside the palm.
- `UVOnly_Digit_A` … `_D`: one digit each (A = 2, B = 5, C = 7, D = 0), bold, so it reads at 1.5 m.

### Marked books

| Stack | Object | Shelf (top to bottom) | Shelf top (z) | Digit | White-light spine text |
| --- | --- | --- | --- | --- | --- |
| C (NE) | `Prop_MarkedBook_C` | Top | 2.40 | 7 | *Vol. VII, Marginalia* |
| A (NW) | `Prop_MarkedBook_A` | Second | 1.75 | 2 | *Vol. II, Wills & Deeds* |
| D (SE) | `Prop_MarkedBook_D` | Third | 1.10 | 0 | *Vol. 0, Index* |
| B (SW) | `Prop_MarkedBook_B` | Bottom | 0.45 | 5 | *Vol. V, Household Accounts* |

- A chunky folio, **0.14 × 0.30 × 0.38**, spine out. Its spine is big enough for a 0.07 × 0.12 digit inside a 0.12 × 0.16 handprint, plus the printed title. Props must be exported **axis-aligned**: the physics sizes them from the bounding box.
- Spine colour: a different one per book (plum, teal, ochre, cream), distinct from the fillers around it so the white-light spine text is findable.
- The plain titles are the quiet cross-check from the scenario: the volume numbers match the digits.
- Each book sits in a slight gap in its shelf row (leave 3 cm each side) so it can be pulled out without clipping.

### Hidden panel (in stack A)

- A recess in the **back of the third-shelf bay of stack A** (shelf top 1.10, clear height 0.65, so the panel is about chest height). `Hidden_Panel_Frame` is the recess; `Interact_Hidden_Panel` is a small door hinged on its left edge, flush with the back of the bay.
- `Hidden_Panel_Lock`: four chunky brass wheels with digits 0–9, scenery like `Chest_SymbolLock` in Level 1. The code opens a four-wheel padlock UI and swings the door on success. Custom property `solution` = `7205`.
- The cavity (0.35 × 0.2 × 0.3) holds `Pickup_Kitchen_Key`, `Pickup_Diary_Page` and `Pickup_Battery_Panel`, all hidden by the code until the panel opens.
- **Cover books:** `Prop_PanelBook_1` … `_4` stand in the bay in front of the panel (standing side by side across the panel, so it is hidden until books are pulled out). They are grabbable, throwable props.
- Note: the scenario says the panel is behind "the marked books", but the marked books are on four different stacks, so one panel cannot be behind all of them. See §11.

### Ladder

- `Ladder` is modelled in the **blocking position** (x 1.6), standing against the shelves of the north wall and half-covering the service door. It rides on `Ladder_Rail`.
- Custom property `aside_offset_x` = `-0.9`: how far west the code slides it (and `Collider_Ladder`) when the door opens. Check in Blender that in both positions the door can swing fully open and that the ladder does not clip the fireplace (its edge is at x 0.0).
- It is scenery, not a puzzle: no `Interact_` prefix.

### Mimic

- **Five fixed hiding spots:** four books on the table and the stool. Each spot has a `Decoy_*` object (static scenery, not throwable) and a `Spawn_Mimic_N` empty at the same position. The Mimic is a separate object (`Mimic_Book` / `Mimic_Stool`, identical meshes and materials) which the code puts on one of the spots and hides the decoy there.
- **Disguises must be exact copies** of the decoys, same mesh and material, so the twitch is the only tell. Use one shared mesh datablock per kind.
- `Mimic_True` is the revealed form shown for 3 s when frozen: a book with a jagged mouth of pages and stubby legs, in the ghost palette (pale cyan-green). The shader gives it the ghost look; Blender only needs the shape. Make the silhouette clearly different from a book.
- The books have to be *near* each other and the candle, so a 0.6 s light hold on the twitching one is plausible and the others are easy to rule out.

### Ink Ghost

- The shader fades the ghost by the shared UV mask, so Blender only supplies the shape. Until the character is decided (§11), reuse the Wisp mesh as `Ink_Ghost` with a long sleeve or quill silhouette. The handprints belong to this ghost, so give it visible hands.

### Entry and service doors

- **Entry:** the leaf is modelled **open** (80°) because the way back stays open. No `Collider_Entry_Door`; the frame and vestibule colliders only.
- **Service door:** hinge on the west edge, modelled closed. `Collider_Service_Door` is removed when it opens. Behind the door, `Kitchen_Vestibule` is a dark box so the player sees nothing until Room 3 loads.

### Ledger and diary page

- `Interact_Ledger` is a large open book with a ruled paper texture and a struck-out last entry (a red line across the final row). The text the player reads is shown by the note UI, not modelled.
- `Pickup_Diary_Page` is a folded sheet with the Level 1 paper texture (`letter-paper.png`). The text is in the note UI.

---

## 6. Textures and images to make

| File | Size | Content | Made in |
| --- | --- | --- | --- |
| `uv-message.png` | 1024 × 256 | "The hall remembers what the clock forgot." white brush lettering on black | Image editor |
| `uv-digit-2.png`, `uv-digit-5.png`, `uv-digit-7.png`, `uv-digit-0.png` | 128 × 128 | One bold digit each, white on black | Image editor |
| `uv-handprint.png`, `uv-handprint-flipped.png` | 256 × 256 | Open hand with a clear palm, white on black | Image editor |
| `spine-a.png` … `spine-d.png` | 192 × 512 | Title text for the four marked books (§5), print-style on the flat spine colour | Image editor |
| `ledger-page.png` | 256 × 256 | Ruled lines with faint columns and one struck-out row | Image editor |
| `service-sign.png` | 256 × 64 | "Service" on a small brass plate | Image editor |
| `letter-paper.png` | 256 × 256 | Reused from Level 1 (diary page) | — |

Everything else is flat palette colour, at most with faint grain. The Ink Ghost and Mimic look comes from the shader, not from textures.

---

## 7. Budget

The Library has the same floor area as the hall (48 m²) but far more small objects, so the book count is the budget risk.

| Metric | Target (iPhone 15 Pro) |
| --- | --- |
| Triangles, whole room | < 150k (ghosts included) |
| Draw calls | < 80: join static scenery that shares a material into one object per material (the filler books of all four stacks collapse to ~6 draws) |
| Textures | Shared materials; the images in §6 are the only unique textures |
| Room .glb (compressed) | < 8 MB |

Filler books are plain boxes with no bevel; use 5–6 materials and one merged object per material. Keep the ladder, globe and armchair simple; the outline pass draws their edges anyway.

---

## 8. Files and export

- `blender/level-2.blend`: the room, with collections `Room`, `Furniture`, `Interactables`, `Pickups`, `Props`, `UVOnly`, `Colliders`, `Spawns`, `Ghosts`.
- `blender/scripts/build_level2.py`: blockout script (same rules as Levels 0 and 1: it rebuilds from scratch, so don't run it after hand edits).
- `blender/scripts/export_level2.py`: re-export only.
- `blender/scripts/render_level2_previews.py`: preview renders into `blender/renders/level-2/` (plan, cutaway, spawn view, a UV pass where `UVOnly_` objects are lit by a violet cone). Never saves the .blend.
- `blender/export/level-2.glb` → copied by `npm run assets` to `public/models/level2/`.
- `blender/export/uv-lamp.glb`: the floor pickup. The held models (`flashlight.glb`, `camera.glb`) are reused; no new held export unless §11 says otherwise.
- Custom properties carried into the `.glb`: `Prop_MarkedBook_*` have `digit`, `stack` and `shelf`; `UVOnly_*` have `uv_only` and `text`; `Hidden_Panel_Lock` has `solution`; `Ladder` has `aside_offset_x`.
- Same export rules as before: glTF binary, apply transforms, include empties and custom properties, no cameras or lights, compression in the build step.

---

## 9. What the code will need from this (for reference)

Not Blender work, but each of these depends on names above:

- `UVOnly_` objects drawn only inside the UV cone, listed as `uvText` entries in `level2.def.ts` (generalising the Level 0 painting reveal).
- A `hasUv` flag and `Pickup_UV_Lamp` placed by the Mimic's drop (model `uv-lamp.glb`).
- A Mimic ghost type using `Spawn_Mimic_*`, `Decoy_*`, `Mimic_Book`, `Mimic_Stool`, `Mimic_True`.
- An Ink Ghost ghost type following `Path_InkGhost_*`.
- Four-wheel padlock UI for `Hidden_Panel_Lock`.
- Search interaction for `Interact_Hollow_Dictionary` → `Pickup_Battery_Dictionary`.
- Note UI for `Interact_Ledger` and `Pickup_Diary_Page`.
- Ladder slide using `aside_offset`.
- Children of a prop (the UV digit and handprint) travelling with it when thrown, and being kept by `mergeStatic.ts`.
- Room definition `level2.def.ts` in the same shape as Levels 0 and 1; all names above that code looks up must be listed in it.

---

## 10. How we work

Same flow as Levels 0 and 1: Claude blocks out in Blender through the connected Blender tools, Michał refines and approves.

1. **Blockout (Claude):** shell, doors, stacks, table, desk, fireplace, panel bay, colliders and spawns, with correct sizes, origins and names. Export the first `level-2.glb`.
2. **Reach check:** camera at eye height at the aisle; confirm the top shelf spine and handprint are readable and that the whole route is walkable. Adjust shelf heights first.
3. **Review (Michał):** walk the greybox in the game, check scale and the 9-minute route.
4. **Hero assets:** marked books, UV planes, reading table with decoys, panel bay and lock, fireplace, ladder.
5. **Architecture:** window, doors, vestibules, rail.
6. **Set dressing:** armchair, rug, globe, bust, desk props, filler books.
7. **Ghost meshes:** `Mimic_True`, `Ink_Ghost`.
8. **Images:** §6 textures.
9. **Materials pass and final export** (including `uv-lamp.glb`).

---

## 11. Open questions

- [ ] **Where is the panel?** The scenario says it is behind "the marked books", but they sit on four different stacks. This spec puts the panel in a bay of stack A, covered by four loose `Prop_PanelBook_*`. Alternative: the marked books are all shelved together on one wall (breaks the four-stack search), or the panel is revealed by pulling any one marked book.
- [ ] **Starting battery:** the scenario's link 1 says the pack lies *on* the desk, the item table says in the *drawer*. This spec puts it on the desk top (`Desk_Drawer_*` are decorative). Confirm.
- [ ] **UV lamp model:** a separate floor model `uv-lamp.glb`, with the held model unchanged (UV is a mode of the flashlight)? Or a held attachment on `flashlight.glb` (a hidden `UV_Module` node shown after pickup)?
- [ ] **Who is the Ink Ghost?** Needed before the ghost mesh and the handprints (left or right, size). Reuse the Wisp mesh until decided.
- [ ] **Mantel clock:** hands stopped at 3:17, or no hands like the hall clock? A stopped 3:17 would pre-empt the return-visit clue.
- [ ] **Reach to the top shelf:** keep the top shelf at 2.40 m (stacks 2.8 m), or lower it to about 2.0 m (stacks 2.4 m) if the reach check fails?
- [ ] **Decoys:** static scenery as proposed, or throwable (the Mimic would then have to cope with a missing decoy)?
- [ ] **Inspect mode for the marked books** (scenario §12): if yes, the spine texture needs a second face (cover) and the books need a bigger bounding box.
