# Level 1 — Entrance Hall — Blender asset spec

Oct 7, 2026 · @Michał Kręcisz · companion to [`game-design-document.md`](./game-design-document.md) and [`level-0-blender-asset-spec.md`](./level-0-blender-asset-spec.md)

Level 1 is Room 1 of the mansion, the Entrance Hall: the first room every player sees, free, white light only, about **7 minutes** on a first play (10 at most). This file lists everything that has to be made in Blender for it: layout, assets, names, pivots, textures and export. Style, naming rules, materials and export settings are the same as Level 0; only what is new or different is spelled out here.

---

## 1. The room in one page

**Goal:** find the Library key and open the Library door.

**Chain (5 links, ~7 min)**

| # | Link | Teaches | ~Time |
| --- | --- | --- | --- |
| 0 | **Intro:** the front door slams shut behind the player, the clock's ticking stops, darkness | Mood | 0:10 |
| 1 | **Flashlight** on the floor by the front door, half a pack | Light, battery | 0:30 |
| 2 | **Key Wisp:** follow its whisper, light it, photograph it; it drops a **brass key** | Camera | 1:30 |
| 3 | **Writing desk:** the brass key opens its drawer. Inside, a letter: *"This house only tells the truth to the glass."* | Notes, story | 1:00 |
| 4 | **Mirror:** shine the light on the wall behind you while looking into the hall mirror. Writing appears **only in the reflection**: *"Eldest first."* Turn around: the wall is blank | Reflections | 1:30 |
| 5 | **Portraits → chest:** three portraits, each with a birth year on its plaque and a symbol in the painting. Eldest first gives the symbol order; the symbol lock on the chest under the stairs opens; inside is the **Library key**, which opens the Library door | Reading the room, symbol lock | 1:30 |

**Optional:** a battery in a coat pocket, a battery on the console table, a second Wisp on the stair landing (harder photo, needed for the second star).

**Secrets for later (modelled now, used after Room 2):** the grandfather clock with no hands and a smeared note on its glass (reads 3:17 under UV); a spawn point for the secret Ink Ghost.

**Decisions taken:** portraits kept as their own step (option A); stairs are **not climbable** (a broken banister blocks them); hall is **6 × 8 m with a 4 m ceiling**; no raking-light puzzle; the coat-pocket battery is optional, not a chain link.

---

## 2. Style

Same as Level 0: **woodblock print (ukiyo-e at night)**. Flat palette colour per material, bold simple shapes, real-world sizes, slightly chunky details, no gloss except the mirror, keys and metal fittings. The game draws the ink outlines and tone bands in post-processing, so models need clean silhouettes and nothing fussy. See the Level 0 spec for the palette and material rules.

**What's different in a big room**

- More open space means silhouettes matter more: the staircase, the clock and the chandelier should read as clear shapes against the dark.
- The hall's signature object is the **grandfather clock**. Give it the strongest silhouette in the room, opposite the front door so it's the first thing the flashlight finds.
- Wall colour: deep plum wallpaper (flat colour) above dark walnut wainscoting (about 1.0 m high). The east wall behind the portraits stays plain, so the mirror-only writing reads clearly.

---

## 3. Room layout

The hall is **6.0 × 8.0 m, 4.0 m ceiling**. Floor centre at the world origin. Blender +Y is north, +X is east.

```
                         NORTH  (y = +4)
   x=-3 ┌───────────────────────────────────────────┐ x=+3
        │▓▓ landing ▓│ stairs (rising westward) ▓▓▓▓ │ clock  │
        │▓▓ (2.4 m)  │◄═══════════════════════  ▓▓▓▓ │  [GC]  │
        │   [CHEST under stairs]       ╳ broken      │        ├─┐
        │                                banister    │        │ │ LIBRARY
   ┌────┤                                                     │ │ DOOR
   │BRD │                    ( chandelier )                   ├─┘
   │DOOR│                                                     │
   └────┤                                                     │ [P3] 1877  pumpkin
        │                      ┌──────────┐                   │
  MIRROR│▌◄── faces east ───── │   RUG    │ ───────────────►  │ [P2] 1869  moon
 +console                      └──────────┘   "Eldest first"  │   (mirror-only text
        │                                      above P1–P3    │    on this wall)
  DESK  │                                                     │ [P1] 1874  bat
        │                                                     │
        │  [window]       ┌────────┐            [coat rack]   │
        └─────────────────┤ FRONT  ├──────────────────────────┘
                          │ DOOR ⇅ │       ● flashlight on the floor
                         SOUTH (y = -4)    ★ Spawn_Player, facing north
```

| Element | Position (centre, metres) | Facing |
| --- | --- | --- |
| Front door (double) | x 0, y −4.0 | North (into the hall) |
| Window (tall) | x −1.9, y −4.0, sill at 0.6 m | North |
| Spawn_Player | x 0, y −3.2 | North |
| Flashlight on the floor | x 0.4, y −2.9 (set in the room definition, not in Blender) | — |
| Coat rack | x 2.4, y −3.4 | — |
| Writing desk | x −2.55, y −2.4, against the west wall | East |
| Hall mirror + console table | mirror centre x −2.97, y −0.4, z 1.6; console below | East |
| Boarded door (to the dining room) | x −3.0, y 1.8 | East |
| Portraits P1, P2, P3 | x 2.97, y −2.0 / −0.4 / 1.2, centre z 1.8 | West |
| Mirror-only text | x 2.96, y −0.4, z 2.85, above the portraits | West, mirrored (see §5) |
| Library door | x 3.0, y 3.0 | West |
| Grandfather clock | x 2.1, y 3.65, against the north wall | South |
| Staircase | along the north wall, foot at x 1.0, rising west to a landing at x −2.4, y 3.4, 2.4 m high | — |
| Chest by the stairs (in front of the under-stairs panelling, so the player can look into it) | x −1.6, y 2.35 | South |
| Rug | centre, 3.0 × 2.0 | — |
| Chandelier | centre, hanging crooked from the ceiling | — |

**Why this layout:** the clock is the first thing the flashlight finds from the spawn; the mirror (west) faces the portraits (east), so standing on the rug and looking into the mirror shows the portrait wall and the text above it; the chest and the Library door sit at the far end, so the player crosses the whole hall once.

**Mirror check:** from anywhere on the rug, the mirror (0.9 × 1.4 m, centre at z 1.6) has to show the full text above the portraits. Check this in Blender with a camera at eye height (1.6 m) near the rug looking at the mirror before you commit to the heights.

---

## 4. Asset list

Sizes in metres (width × depth × height). Status is updated as we go.

### Room shell and architecture

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Room shell | `Floor`, `Wall_N`, `Wall_E`, `Wall_S`, `Wall_W`, `Ceiling`, `Wainscot` (1.0 m high, all walls), `Skirting`, `Cornice` | 6.0 × 8.0, 4.0 high | Floor centre at world origin | The hall | Blockout |
| Floor | One object; large checkerboard or plank pattern in two flat colours | 6.0 × 8.0 | Floor centre | Readable floor in the beam | Blockout |
| Window | `Window_Frame`, `Window_Glass`, `Window_Curtain_L`, `Window_Curtain_R` | 1.0 × 0.15 × 2.4 | Back centre | Moonlight | Blockout |
| Front door (double) | `Front_Door_Frame`, `Front_Door_L`, `Front_Door_R`, handles | 1.6 × 0.08 × 2.6 total | Each leaf on its outer hinge edge, floor level | Slams shut in the intro, then locked | Blockout |
| Library door | `Library_Door_Frame`, `Interact_Library_Door` (leaf + handle), `Library_Door_Sign` | 1.0 × 0.06 × 2.2 | Leaf: hinge edge at floor level | Exit, opens with the Library key | Blockout |
| Boarded door | `Boarded_Door` (frame, leaf and 3–4 planks in one object) | 1.0 × 0.15 × 2.2 | Floor centre | Shows the house goes on | Blockout |
| Staircase | `Stairs` (treads, risers, stringer), `Landing`, `Landing_Railing`, `Banister`, `Banister_Broken` (snapped post and rail lying across the bottom steps) | 1.2 wide, 3.4 run, landing at 2.4 m | Floor at the stair foot | Blocks the way up; gallery for the optional Wisp | Blockout |
| Under-stairs nook | `Stairs_Underside` (closed triangular panelling, open bay for the chest) | Matches the stairs | — | Frames the chest | Blockout |

### Hero assets (drive the chain)

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Writing desk | `Writing_Desk` (body), `Interact_Writing_Desk_Drawer` (with a visible keyhole) | 1.1 × 0.55 × 0.8 | Body: floor centre; drawer: back centre, slides out | Opens with the brass key | Blockout |
| Letter | `Pickup_Letter` (folded sheet, slightly curled) | 0.2 × 0.15 | Base centre | Readable note; inside the drawer | Blockout |
| Brass key | `Pickup_Brass_Key` | 0.08 long | Centre | Dropped by the key Wisp; placed at `Spawn_Wisp_Key`, the code hides it until the drop | Blockout |
| Hall mirror | `Mirror_Frame` (ornate, chunky), `Mirror_Surface` | 0.9 × 0.06 × 1.4 | Back centre | Reflection; shows the mirror-only text | Blockout |
| Console table | `Console_Table` | 1.0 × 0.35 × 0.85 | Floor centre | Under the mirror; holds a battery | Blockout |
| Mirror-only text | `MirrorOnly_Text` (thin plane with the text image) | 1.8 × 0.35 | Back centre | Visible only in the reflection (§5) | Blockout |
| Portraits ×3 | Per portrait: `Portrait_1_Frame`, `Portrait_1_Canvas`, `Portrait_1_Plaque` (same for 2 and 3) | 0.7 × 0.06 × 0.9 each | Back centre | Birth years + symbols | Blockout |
| Chest | `Chest` (body), `Interact_Chest_Lid`, `Chest_SymbolLock` (three dials) | 0.9 × 0.5 × 0.55 | Body: floor centre; lid: on the back hinge edge | Symbol lock, holds the Library key | Blockout |
| Library key | `Pickup_Library_Key` (larger, ornate, distinct from the brass key) | 0.14 long | Centre | Inside the chest; opens the Library door | Blockout |

### Signature and secrets

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Grandfather clock | `Grandfather_Clock` (case), `Clock_Face` (dial with numerals, **no hands**), `Clock_Pendulum` (still), `Interact_Clock_Glass` (the door glass over the pendulum) | 0.6 × 0.35 × 2.3 | Floor centre | Signature object; the smeared note on its glass reads 3:17 under UV on the return visit | Blockout |
| Clock hand stubs | Part of `Clock_Face`: the bare centre pin only | — | — | Makes "no hands" readable | Blockout |

### Furniture and set dressing

| Asset | Separate objects | Approx. size | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Coat rack | `Coat_Rack`, `Coat_1` (static), `Interact_Coat_Pocket` (the coat with the battery; one object), `Hat` | 0.6 × 0.6 × 1.9 | Floor centre | Optional battery ("search" interaction) | Blockout |
| Chandelier | `Chandelier` (one object, hanging at an angle, unlit candles) | 1.0 Ø × 1.2 drop | Top hook point | Silhouette, mood | Blockout |
| Rug | `Rug` | 3.0 × 2.0 | Floor centre | Marks the centre | Blockout |
| Umbrella stand | `Umbrella_Stand` with 2 umbrellas | 0.3 Ø × 0.9 | Floor centre | Character by the door | Blockout |
| Side chair | `Hall_Chair` | 0.5 × 0.5 × 1.0 | Floor centre | Next to the writing desk | Blockout |
| Small props | 3–4 of: candelabra, vase with dead flowers, stack of letters, a fallen picture frame | Small | Base centre | Character; some can be throwable props | Blockout |

### Pickups and characters reused from Level 0

| Asset | Source | Notes |
| --- | --- | --- |
| Flashlight (held and on the floor) | `flashlight.glb` | Placed by the room definition, no Blender work |
| Camera (held) | `camera.glb` | No change |
| Battery pack | Copy the Level 0 mesh into the room as `Pickup_Battery_Coat` (hidden inside the coat; the code shows it on search) and `Pickup_Battery_Console` (on the console table) | Same mesh, two instances |
| Wisp | Copy the Level 0 Wisp mesh twice: `Wisp_Key`, `Wisp_Gallery` | The shader does the look; both can share one mesh |

### Spawns (empties)

| Name | Where | Used for |
| --- | --- | --- |
| `Spawn_Player` | x 0, y −3.2, facing north | Start |
| `Spawn_Wisp_Key` | Centre of the hall, about 1.4 m up | Key Wisp start; its wander box is the open floor |
| `Spawn_Wisp_Gallery` | Above the landing, about 3.0 m up | Optional Wisp, stays on the landing |
| `Spawn_InkGhost` | Near the clock, about 1.5 m up | Secret Ink Ghost, return visit only |
| `Spawn_Battery_Emergency` | Floor by the front door | Emergency pack if the player runs dry |
| `Spawn_Intro_Look` | On the clock face | Where the camera is nudged during the intro |

### Colliders

| Name | Covers |
| --- | --- |
| `Collider_Wall_N`, `Collider_Wall_E_S`, `Collider_Wall_E_N` (split around the Library door), `Collider_Wall_S`, `Collider_Wall_W` | Walls |
| `Collider_Library_Door` | The closed Library door, removed when it opens |
| `Collider_Front_Door` | The front door, never removed |
| `Collider_Stairs` | The whole staircase footprint plus the broken banister |
| `Collider_Writing_Desk`, `Collider_Console`, `Collider_Chest`, `Collider_Clock`, `Collider_Coat_Rack`, `Collider_Hall_Chair`, `Collider_Umbrella_Stand` | Furniture |
| `Collider_Floor`, `Collider_Ceiling` | Skipped by the player collision, kept for raycasts |

---

## 5. Special objects

### Mirror-only text (`MirrorOnly_Text`)

The central trick of the room: writing that exists **only in the reflection**.

- A thin plane, 5 mm off the east wall, above the portraits, with the text **"Eldest first"** as an image texture.
- The text is **mirrored in the texture** (flipped horizontally), so it reads correctly in the mirror. Seen directly it would read backwards, but the player never sees it directly.
- **New prefix `MirrorOnly_`:** the game puts these objects on a render layer that only the mirror's reflection camera draws. The main camera never draws them. This is a new rule in the Blender ↔ code contract.
- Material: flat vermilion (`#c63b2b`), as if painted with a brush, rough edges in the texture. It's lit by the game like any surface, so in the dark it shows only where the flashlight hits that wall, which is what forces the player to light the wall while looking into the mirror.
- Texture: `mirror-text.png`, 1024 × 256, vermilion brush lettering on transparent (alpha), already flipped.

### Portraits

| Portrait | Plaque | Symbol in the painting | Eldest-first order |
| --- | --- | --- | --- |
| P1 (south) | "1874" | Bat | 2nd |
| P2 (middle) | "1869" | Moon | 1st |
| P3 (north) | "1877" | Pumpkin | 3rd |

Solution: **moon, bat, pumpkin**. The order on the wall (P1–P3) must not match the solution.

- Each canvas is a flat, print-style figure (half-length portrait, simple shapes) with its symbol worked into the painting: a moon brooch, a bat on the shoulder, a pumpkin on a side table. The symbol must be readable from 2 m in the flashlight beam.
- The years are part of the plaque texture (large, clear numerals), not modelled text.
- The three figures can hint at the household and the story (to refine with the story).
- Textures: `portrait-1.png`, `portrait-2.png`, `portrait-3.png` (512 × 640), `plaque-1874.png`, etc. (256 × 64).

### Chest and symbol lock

- `Interact_Chest_Lid` opens on its back hinge (~100°) once the lock is solved.
- `Chest_SymbolLock` is scenery (like `Desk_Padlock` in Level 0): three chunky brass dials on the front, each showing one symbol. The code opens a symbol-lock UI and drops or opens this mesh on success.
- The dial symbols (moon, bat, pumpkin, plus one or two decoys such as a key and an eye) are a small texture atlas, `symbols.png` (512 × 128), shared with the lock UI so the icons match.
- `Pickup_Library_Key` sits inside, on a cloth, visible once the lid opens.

### Grandfather clock

- The tallest, strongest silhouette in the room; the face is pale paper colour so it catches the light from the spawn.
- **No hands:** only a bare centre pin.
- `Interact_Clock_Glass` carries a smudged-note texture (`clock-note.png`, illegible smears) and a hidden UV layer (`clock-note-uv.png`: "3:17" and a symbol, white on black) for the return visit. Both are images, made outside Blender.

### Letter

- `Pickup_Letter` is a small folded sheet in the drawer. The text the player reads is shown by the game's note UI, not modelled; the mesh only needs a paper texture with faint illegible lines.

### Front door (intro)

- Both leaves are modelled **closed** (identity rotation), with pivots on the outer hinges. Each carries a custom property `intro_open_deg` (70 for `Front_Door_L`, −70 for `Front_Door_R`): the rotation about the vertical axis that opens it into the hall. The intro starts them open and slams them shut. `Collider_Front_Door` is always on.

---

## 6. Textures and images to make

| File | Size | Content | Made in |
| --- | --- | --- | --- |
| `mirror-text.png` | 1024 × 256 | "Eldest first", vermilion brush lettering, flipped horizontally, transparent | Image editor |
| `portrait-1.png` … `portrait-3.png` | 512 × 640 | Print-style figures with bat / moon / pumpkin | Image editor or painted |
| `plaque-1874.png`, `plaque-1869.png`, `plaque-1877.png` | 256 × 64 | Years on brass | Image editor |
| `symbols.png` | 512 × 128 | Moon, bat, pumpkin, key, eye; shared with the lock UI | Image editor |
| `clock-note.png` | 256 × 256 | Smeared, illegible note | Image editor |
| `clock-note-uv.png` | 256 × 256 | "3:17" + symbol, white on black (used after Room 2) | Image editor |
| `library-sign.png` | 256 × 64 | "Library" on a small brass plate | Image editor |
| `letter-paper.png` | 256 × 256 | Paper with faint illegible lines | Image editor |

Everything else is flat palette colour, at most with faint grain.

---

## 7. Budget

The hall is about 2.4× the floor area of Level 0, so the budget is tighter per object.

| Metric | Target (iPhone 15 Pro) |
| --- | --- |
| Triangles, whole room | < 150k (Wisps included) |
| Draw calls | < 80: join static scenery that shares a material into one object per material |
| Textures | Shared materials; the images in §6 are the only unique textures |
| Room .glb (compressed) | < 8 MB |

Keep the staircase balusters and chandelier arms simple (low segment counts); the outline pass draws their edges anyway.

---

## 8. Files and export

- `blender/level-1.blend`: the room, with collections `Room`, `Furniture`, `Interactables`, `Pickups`, `MirrorOnly`, `Colliders`, `Spawns`, `Ghosts`.
- `blender/scripts/build_level1.py`: blockout script (same rules as Level 0: it rebuilds from scratch, so don't run it after hand edits).
- `blender/scripts/export_level1.py`: re-export only.
- `blender/scripts/render_level1_previews.py`: preview renders into `blender/renders/level-1/` (plan, cutaway, spawn view, and a Cycles mirror check where `MirrorOnly_` objects are hidden from the camera but seen by reflections). Never saves the .blend.
- Extra objects not in the tables: `Library_Vestibule` (a dark box behind the Library door, with `Collider_Vestibule_*`), `Library_Door_Handle`, `Prop_Candelabra`, `Prop_Vase`, `Prop_Letters`, `Prop_Fallen_Frame`.
- Custom properties carried into the .glb: `Portrait_N_Canvas` and `Portrait_N_Plaque` have `birth_year` (and the canvas `symbol`); `Chest_SymbolLock` has `solution`; `MirrorOnly_Text` has `mirror_only` and `text`.
- `blender/export/level-1.glb` → copied by `npm run assets` to `public/models/level1/`.
- Held items (`flashlight.glb`, `camera.glb`) are reused from Level 0; no new export.
- Same export rules as Level 0: glTF binary, apply transforms, include empties and custom properties, no cameras or lights, compression in the build step.

---

## 9. What the code will need from this (for reference)

Not Blender work, but each of these depends on names above:

- `MirrorOnly_` layer drawn only by the reflector camera (to prove in the Level 0 mirror first).
- Symbol-lock UI (a variant of the padlock UI) using `symbols.png`.
- Note-reading UI for `Pickup_Letter`.
- A ghost that drops an item (`Wisp_Key` → `Pickup_Brass_Key`).
- A "search" interaction (`Interact_Coat_Pocket` → `Pickup_Battery_Coat`).
- Intro: `Front_Door_L/R` swing shut, the clock's tick stops.
- Two Wisps at once, one confined to the landing.
- Room definition `level1.def.ts` in the same shape as Level 0.

---

## 10. How we work

Same flow as Level 0: Claude blocks out in Blender through the connected Blender tools, Michał refines and approves.

1. **Blockout (Claude) — done Oct 7:** shell, doors, stairs, mirror, portraits, desk, chest, clock, colliders and spawns, with correct sizes, origins and names. Export the first `level-1.glb`.
2. **Mirror check — passed in the Cycles preview** (text readable in the mirror from the rug, wall blank when seen directly); still to confirm in the game: camera at eye height on the rug; confirm the mirror shows the full text area above the portraits. Adjust heights before anything else.
3. **Review (Michał):** walk the greybox in the game, check scale and the 7-minute route.
4. **Hero assets:** clock, mirror, portraits, chest, writing desk, Library door.
5. **Architecture:** staircase with the broken banister, front door, window, boarded door.
6. **Set dressing:** coat rack, chandelier, rug, console, small props.
7. **Images:** §6 textures.
8. **Materials pass and final export.**

Update the status column as each asset moves on.

---

## 11. Open questions

- [ ] Floor: checkerboard tiles or wide planks?
- [ ] Chandelier: hanging crooked, or fallen and lying smashed on the floor (a collider in the middle of the hall)?
- [ ] Portrait figures: who are they (ties into the 3:17 story)?
- [ ] Should the landing Wisp be reachable for a good "close" score, or is a long shot the intended challenge?
- [ ] Decoy symbols on the lock dials: two (key, eye) or none?
