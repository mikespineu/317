# Level 0 — Blender asset spec

Oct 7, 2026 · @Michał Kręcisz

## Style guide

Level 0 is a small study at night, built as a miniature diorama: real-world sizes so movement feels right, but materials and details that look hand-made, like a dollhouse room you are standing inside.

**Proportions**

- Real-world sizes for anything the player walks around or reaches: doors, desk height, ceiling.
- Details slightly oversized and chunky: thick frames, big knobs and handles, fat book spines, rounded edges.
- Few, simple shapes per object. Bevels on every visible edge so light catches them.

**Materials that sell the miniature look**

- Painted wood with soft brush texture, slightly uneven colour.
- Card and paper for books, labels and the painting canvas.
- Felt or fabric for the rug and chair seat.
- Clay-like matte surfaces for small props.
- Visible seams where parts meet, as if glued together.
- Almost no gloss, except the mirror, the key and the flashlight lens.

**Palette**

- Base: muted, desaturated colours: deep plum, dusty teal, aged cream, dark walnut.
- Light does the colour work: warm yellow flashlight, cool blue moonlight, violet UV, pale cyan-green ghost.
- Keep surfaces mid-to-dark so the flashlight beam stands out.

## Room layout

The study is 4.0 × 5.0 m with a 2.8 m ceiling: window and desk on the north wall, door on the south wall, painting and mirror facing each other across the room.

> _Diagram: Level 0 study · top view, to scale — see the live doc._

The painting's UV code opens the desk drawer, and the key inside opens the door. The mirror faces the painting so later rooms can reuse the setup for reversed writing.

## Asset list

Fourteen assets cover Level 0; sizes are starting points in metres (width × depth × height), and each row's status is updated as we go.

| Asset | Separate objects | Approx. size (m) | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Room shell | Floor, 4 walls, ceiling, skirting, window frame, window glass, door frame | 4.0 × 5.0, 2.8 high | Floor centre at world origin | Walls, moonlight through the window | Not started |
| Door | Door leaf, handle | 1.0 × 0.06 × 2.2 | On the hinge edge, at floor level | Opens with the key | Not started |
| Desk | Desk body, drawer, padlock | 1.4 × 0.7 × 0.78 | Body: floor centre; drawer: back centre, slides out | Code lock, holds the key | Not started |
| Chair | One object | 0.5 × 0.5 × 0.95 | Floor centre | Character, collision | Not started |
| Bookshelf | Frame, 3–4 loose books | 1.0 × 0.35 × 2.0 | Floor centre | Battery pack hiding spot | Not started |
| Wall mirror | Frame, mirror surface | 0.7 × 0.05 × 1.1 | Back centre | Reflection test | Not started |
| Painting | Frame, canvas | 0.8 × 0.05 × 1.0 | Back centre | UV writing with the drawer code | Not started |
| Rug | One object | 2.0 × 1.4 | Floor centre | Character | Not started |
| Small props | Two of: candle, inkwell, small clock, lamp | Small | Base centre | Character on the desk and shelf | Not started |
| Flashlight (held) | Body, lens | 0.25 long | Where the hand grips; lens along Blender +Y | White and UV light | Not started |
| Camera (held) | Body, lens, shutter button | 0.14 × 0.07 × 0.09 | Body centre; lens along Blender +Y | Ghost photos | Not started |
| Battery pack | One object | 0.1 × 0.03 × 0.06 | Base centre | Pickup | Not started |
| Key | One object | 0.1 long | Centre | Pickup, opens the door | Not started |
| Wisp | One simple mesh, a blob with a tail | About 0.5 tall | Centre of the head | Ghost; its look comes from the shader | Not started |

In Blender, +Y is forward; the glTF exporter turns it into the forward direction three.js uses, so held items point along +Y.

## Naming, scale and export

The code finds objects by name, so names are part of the contract between Blender and the game.

**Scale and units**

- 1 Blender unit = 1 metre. Player eye height is about 1.6 m; check objects against a 1.6 m reference cube.
- Apply all transforms (rotation and scale) before export.
- Set each origin as listed in the asset table; doors and drawers depend on it.

**Names**

| Prefix or name | Meaning | Examples |
| --- | --- | --- |
| `Interact_` | The player can use it | `Interact_Door`, `Interact_Desk_Drawer`, `Interact_Painting_Canvas` |
| `Pickup_` | The player can pick it up | `Pickup_Battery`, `Pickup_Key` |
| `Collider_` | Invisible collision box | `Collider_Desk`, `Collider_Wall_N` |
| `Mirror_Surface` | The reflective plane of the mirror | `Mirror_Surface` |
| `Spawn_` | Empty marking a position | `Spawn_Player`, `Spawn_Wisp` |
| Everything else | Static scenery | `Wall_N`, `Bookshelf`, `Rug` |

**Export**

- Format: glTF binary (.glb), one file for the room with everything placed, plus one file per held item (flashlight, camera).
- Include: selected objects or the room collection, mesh, materials, custom properties, empties.
- Leave out: cameras and lights; the game sets its own lighting.
- Compression is done in the build step, not in Blender, so the source .glb stays easy to inspect.

## Materials, textures and baking

Keep materials simple enough for an iPhone 15 Pro: the flashlight does the real-time lighting, and everything static gets its soft light baked in.

**Materials**

- Principled BSDF only, using base colour, roughness and an optional normal map. Node tricks that glTF can't export won't reach the game.
- Reuse a small set of shared materials (painted wood, card, felt, clay, metal, glass) across objects.
- The painting canvas, mirror surface and Wisp only need a placeholder material; the code replaces it with its own shader.

**Textures**

- 1024 px for large surfaces (walls, floor, desk), 512 px for props. Power-of-two sizes.
- Hand-painted or baked from procedural materials. No photo-real scans; they break the miniature look.
- The UV writing on the painting is a separate image (white text on black) made in any image editor; the shader shows it only inside the UV cone.

**Baking**

- Static shell and furniture get a second UV map (no overlaps) for a baked lightmap and ambient occlusion.
- Bake with soft moonlight from the window and a little ambient fill, nothing warm; the flashlight adds warmth in the game.
- Doors, drawers, pickups and held items are not baked, because they move.

## How we work

We block out the whole room first so coding can start on real proportions, then refine one asset at a time; Claude works in Blender through the connected Blender tools, Michał refines and approves.

1. **Blockout (Claude):** room shell, door, desk with drawer, bookshelf, mirror, painting, chair and rug as simple shapes with correct sizes, origins and names; spawn empties. Export the first .glb.
2. **Review (Michał):** walk the room in the game's grey-box build, check scale and layout, adjust.
3. **Hero assets first:** desk with drawer, door, painting, mirror, the four that drive the Level 0 chain. Then the held flashlight and camera.
4. **Props and pickups:** bookshelf and books, chair, rug, small props, battery pack, key, Wisp.
5. **Materials pass:** shared miniature materials applied across the room.
6. **Bake and final export:** second UV maps, lightmap and AO bake, final .glb.

**Working rules**

- One .blend file for the room, with collections: `Room`, `Furniture`, `Interactables`, `Pickups`, `Colliders`, `Spawns`, `Held_Items`.
- Re-export after every change that touches names, origins or sizes, so the game always matches Blender.
- Update the status column in the asset list as each asset moves on.
