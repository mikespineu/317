# Level 0 — Blender asset spec

Oct 7, 2026 · @Michał Kręcisz

## Style guide

Level 0 is a small study at night, drawn like a woodblock print (ukiyo-e): real-world sizes so movement feels right, but flat colour, bold simple shapes and ink lines, like a print you are standing inside. This replaces the earlier miniature-diorama direction (Oct 7, 2026).

**Proportions**

- Real-world sizes for anything the player walks around or reaches: doors, desk height, ceiling.
- Details slightly oversized and chunky: thick frames, big knobs and handles, fat book spines, rounded edges.
- Few, large, simple shapes per object. The outline pass draws a line wherever depth bends sharply, so fussy detail and tiny bevels turn into noise. Keep edges crisp and bevels small.

**Materials that sell the print look**

- One flat colour per material, taken from the palette below. No gradients and no baked highlights: the game turns light into a few flat tones and draws the outlines itself.
- Surface character comes from colour choice, not texture: dark walnut wood, cream paper for books and the canvas, dusty teal cloth for the rug and chair seat.
- At most a faint brush or paper grain in the texture. Hatching and ink lines are added by the game, not painted.
- No gloss, except the mirror, the key and the flashlight lens.

**Palette** (defined in `src/styles.css`, and mirrored in the shaders)

- Print colours: ink `#0d0c1f`, indigo `#1b2150`, periwinkle `#8f98dc`, paper `#efe4c6`, vermilion `#c63b2b`, saffron `#e2a63a`, matcha `#5d9a7c`.
- Room surfaces: muted and mid-to-dark, in plum, dusty teal, aged cream and dark walnut, so they sit between the indigo shadow floor and the flashlight highlight.
- Light does the colour work: warm saffron flashlight, cool blue moonlight, violet UV, pale cyan-green ghost.

**How the look is made**

It is a post-processing pass (`renderer/ukiyo.ts`), not baked into the models: ink outlines from the depth buffer, brightness snapped to about six tone steps, shadows lifted to indigo, paper grain over the frame. So the models only need flat colours, clean silhouettes and sensible depth; there is nothing to author for the outlines.

## Room layout

The study is 4.0 × 5.0 m with a 2.8 m ceiling: window and desk on the north wall, door on the south wall, painting and mirror facing each other across the room.

> _Diagram: Level 0 study · top view, to scale — see the live doc._

The painting's UV code opens the desk drawer, and the key inside opens the door. The mirror faces the painting so later rooms can reuse the setup for reversed writing.

## Asset list

Fourteen assets cover Level 0; sizes are starting points in metres (width × depth × height), and each row's status is updated as we go.

| Asset | Separate objects | Approx. size (m) | Origin (pivot) | Used for | Status |
| --- | --- | --- | --- | --- | --- |
| Room shell | Floor, 4 walls, ceiling, skirting, window frame, window glass, door frame | 4.0 × 5.0, 2.8 high | Floor centre at world origin | Walls, moonlight through the window | Blockout |
| Door | Door leaf, handle | 1.0 × 0.06 × 2.2 | On the hinge edge, at floor level | Opens with the key | Blockout |
| Desk | Desk body, drawer, padlock | 1.4 × 0.7 × 0.78 | Body: floor centre; drawer: back centre, slides out | Code lock, holds the key | Blockout |
| Chair | One object | 0.5 × 0.5 × 0.95 | Floor centre | Character, collision | Blockout |
| Bookshelf | Frame, 4 loose books (`Book_1` to `Book_4`, throwable props, origin at each base centre) | 1.0 × 0.35 × 2.0 | Floor centre | Battery pack hiding spot; the books can be grabbed and thrown | Blockout |
| Wall mirror | Frame, mirror surface | 0.7 × 0.05 × 1.1 | Back centre | Reflection test | Blockout |
| Painting | Frame, canvas | 0.8 × 0.05 × 1.0 | Back centre | UV writing with the drawer code | Blockout |
| Rug | One object | 2.0 × 1.4 | Floor centre | Character | Blockout |
| Small props | Two of: candle, inkwell, small clock, lamp | Small | Base centre | Character on the desk and shelf | Blockout |
| Flashlight (held, and on the floor at the start) | Body, lens | 0.25 long | Where the hand grips; lens along Blender +Y | White and UV light; the game also lays the same model on the floor as the starting pickup | Blockout |
| Camera (held) | Body, lens, shutter button | 0.14 × 0.07 × 0.09 | Body centre; lens along Blender +Y | Ghost photos | Blockout |
| Battery pack | One object | 0.1 × 0.03 × 0.06 | Base centre | Pickup | Blockout |
| Key | One object | 0.1 long | Centre | Pickup, opens the door | Blockout |
| Wisp | One smooth bell: a round head (radius 0.13) and a plain drape, open at the hem, no folds or arms. Dense and even (160 segments, about 26k triangles), because the shader bends it | 0.63 tall, 0.47 wide | Centre of the head | Sheet ghost; the arms, folds and cloth movement come from the shader | Blockout |

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
| Names listed in the room definition's `props` | A loose object the player can grab and throw, when `throwable: true` | `Book_1` to `Book_4` |
| Everything else | Static scenery | `Wall_N`, `Bookshelf`, `Rug` |

**Notes on props and the flashlight**

- `Pickup_Flashlight` is not in `level-0.glb`. The room definition (`level0.def.ts`) names `flashlight.glb` and a floor position, and the room loader adds the node under that name. To move it, change the definition; no Blender work.
- `Prop_Candle` is usable without an `Interact_` prefix: the room definition lists it as an interactable of type `candle`. The flame sits on top of the model's bounding box, so keep the wick as the highest point.
- A prop needs no special prefix: `throwable: true` in the definition is what makes it grabbable. Export props axis-aligned (identity rotation on the node), because the game sizes their physics from the bounding box and lays them flat along the smallest axis when they land.

**Export**

- Format: glTF binary (.glb), one file for the room with everything placed, plus one file per held item (flashlight, camera).
- Include: selected objects or the room collection, mesh, materials, custom properties, empties.
- Leave out: cameras and lights; the game sets its own lighting.
- Compression is done in the build step, not in Blender, so the source .glb stays easy to inspect.

## Materials, textures and baking

Keep materials simple enough for an iPhone 15 Pro: the flashlight does the real-time lighting, and everything static gets its soft light baked in.

**Materials**

- Principled BSDF only, using base colour, roughness and an optional normal map. Node tricks that glTF can't export won't reach the game.
- Reuse a small set of shared materials (wood, card, cloth, metal, glass), each a flat palette colour, across objects.
- The painting canvas, mirror surface and Wisp only need a placeholder material; the code replaces it with its own shader.

**Textures**

- 1024 px for large surfaces (walls, floor, desk), 512 px for props. Power-of-two sizes.
- Flat colour first; texture only for a faint brush or paper grain. No photo-real scans; they break the print look.
- The UV writing on the painting is a separate image (white text on black) made in any image editor; the shader shows it only inside the UV cone.

**Baking**

- Static shell and furniture get a second UV map (no overlaps) for a baked lightmap and ambient occlusion.
- Bake only ambient occlusion and a gentle moonlight tone, nothing warm; the flashlight adds warmth in the game. The print look turns soft light into flat steps, so a strong lightmap shows up as banding: keep it subtle, or skip it and rely on the game's lighting.
- Doors, drawers, pickups and held items are not baked, because they move.

## How we work

We block out the whole room first so coding can start on real proportions, then refine one asset at a time; Claude works in Blender through the connected Blender tools, Michał refines and approves.

1. **Blockout (Claude):** room shell, door, desk with drawer, bookshelf, mirror, painting, chair and rug as simple shapes with correct sizes, origins and names; spawn empties. Export the first .glb.
2. **Review (Michał):** walk the room in the game's grey-box build, check scale and layout, adjust.
3. **Hero assets first:** desk with drawer, door, painting, mirror, the four that drive the Level 0 chain. Then the held flashlight and camera.
4. **Props and pickups:** bookshelf and books, chair, rug, small props, battery pack, key, Wisp.
5. **Materials pass:** shared flat print materials applied across the room.
6. **Bake and final export:** second UV maps, lightmap and AO bake, final .glb.

**Working rules**

- One .blend file for the room, with collections: `Room`, `Furniture`, `Interactables`, `Pickups`, `Colliders`, `Spawns`, `Held_Items`.
- Re-export after every change that touches names, origins or sizes, so the game always matches Blender.
- Update the status column in the asset list as each asset moves on.
