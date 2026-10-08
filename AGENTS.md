# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

3.17 is a first-person 3D escape-room game for desktop and mobile (landscape) browsers. The design is specified in three documents that are the source of truth for behaviour, scope and naming; read the relevant section before building a feature:

- `docs/game-design-document.md` — mechanics, rooms, data model, architecture, roadmap.
- `docs/level-0-blender-asset-spec.md` — the Level 0 room: sizes, object names, export rules.
- `docs/level-0-implementation.md` — the Level 0 coding plan: build steps with acceptance checks, room definition, store shape, tuning values.

The current target is **Level 0**, a single prototype study. Login, Supabase, saving, the journal, leaderboards and the data-driven room loader are explicitly out of scope until Level 0 is done.

## Commands

```sh
npm run dev              # dev server on http://localhost:9000 (--strictPort: fails if the port is taken)
npm run assets           # copy blender/export/*.glb to public/models/ (runs before dev and build)
npm run typecheck        # tsc --noEmit
npm run build            # production build (Nitro, Vercel preset)
npm run generate-routes  # regenerate src/routeTree.gen.ts without running the dev server
```

There is no test runner and no linter. `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters` on, so `typecheck` fails on unused code.

Blender (asset pipeline, needs Blender installed locally):

```sh
# Re-export the .glb files from the current .blend (safe, never changes geometry)
/Applications/Blender.app/Contents/MacOS/Blender -b blender/level-0.blend --python blender/scripts/export_level0.py

# Rebuild level-0.blend from scratch. Destroys hand edits; do not run once the .blend has been refined by hand.
/Applications/Blender.app/Contents/MacOS/Blender -b --python blender/scripts/build_level0.py
```

## Architecture

**App shell: TanStack Start (file-based routing, SSR).** Routes live in `src/routes/`; `src/routeTree.gen.ts` is generated and must not be edited. Import from `src` with the `#/` alias.

**The game is client-only.** three.js needs browser APIs, so `src/routes/play.tsx` wraps a `lazy()` import of `src/game/Game.tsx` in `ClientOnly`. Anything importing `three` or `@react-three/*` must stay behind that boundary and never be imported by a route module directly.

**Renderer: WebGPU with WebGL 2 fallback.** `Game.tsx` imports three from `three/webgpu`, calls `extend(THREE)` so R3F's JSX elements resolve to the WebGPU build, and passes an async `gl` factory that creates and `init()`s a `WebGPURenderer`. Consequences:

- Custom shaders are written with TSL / node materials, not GLSL `ShaderMaterial`.
- WebGL-only libraries such as `@react-three/postprocessing` do not work; post-processing has to go through three's own WebGPU pipeline.
- The first frame is delayed while the renderer initialises, so the canvas is black for a moment after load.

**Game state: one zustand store** (`src/game/store.ts`). React components subscribe with selectors; input handlers and `useFrame` loops read and write through `useGame.getState()` to avoid re-renders.

**Rooms are meant to become data.** The design calls for a shared engine that loads a room's `.glb` plus a JSON definition binding behaviour to named nodes. Level 0 logic is hand-written, but should keep the shape of that definition (interactables, ghosts, exit, `requires` / `gives`) so it can move to data later. `src/game/Level0.tsx` mounts one component per system; `RoomScene` loads the exported `.glb` (or a greybox with `?greybox`) and binds nodes by name from `src/game/room/level0.def.ts`. The definition also lists `props` (`throwable: true` makes a prop grabbable and throwable), pickups with a `model` that the loader places (the floor flashlight), and interactables named by the definition rather than an `Interact_` prefix (the candle).

**Blender to game contract.** The game finds objects by name, so names, origins and sizes in the `.blend` are an interface:

- Prefixes: `Interact_` (usable), `Pickup_` (collectable), `Collider_` (invisible collision), `Spawn_` (position empties), plus `Mirror_Surface`. Everything else is static scenery, unless the room definition names it (books, candle). Props must be exported axis-aligned: the physics sizes them from the bounding box.
- 1 unit = 1 m; the floor centre is the world origin; the room is 4 × 5 m with a 2.8 m ceiling; player eye height is about 1.6 m.
- Blender is Z-up with +Y forward; the exporter converts to three.js Y-up.
- `blender/export/` holds one `.glb` for the room and one per held item (`flashlight.glb`, `camera.glb`). Cameras and lights are not exported; the game does its own lighting. Compression belongs in the build step, not in Blender.
- After any change to names, origins or sizes, re-export so the game matches the `.blend`.

**Look and styling.** The look is a woodblock print (ukiyo-e at night), built in post-processing: `src/game/renderer/ukiyo.ts` (ink outlines from depth, tone bands, indigo shadows, paper grain, a brightness lift), chained in `postprocessing.ts` and toggled in the `?debug` panel. UI uses Tailwind v4: the title route uses utilities, and the in-game overlays are plain CSS files next to each component, all using the palette in the `@theme` block of `src/styles.css` and the shared `print-paper` / `print-ink` panels. Overlays are flat: ink outlines, hard offset shadows, stepped animation, no blur or glow. Room assets should be flat palette colours; see the Blender spec.

**macOS file names.** The file system is case-insensitive, so never name two files in one folder differently only by case (`props.ts` and `Props.tsx` made tsc and Vite resolve the wrong one).

**Supabase** helpers exist but are unused: `src/lib/supabase.ts` (browser) and `src/lib/supabase.server.ts` (cookie-based, for use inside server functions only). When the backend work starts, the design requires that gated room content, door solutions and scores are served and validated by server functions, never shipped in the client bundle.

## Game constants worth knowing

These come from the design document and recur across systems:

- Controls: `F` light on/off, `Q` white/UV, `R` swap battery, `E` or click interact (also grabs and throws props and lights the candle), `P` or right mouse toggles photo mode, `Esc` leaves it (the browser drops the pointer lock, so the game pauses too), left click shoots in photo mode. `Tab` inventory and `J` journal are designed but not in Level 0.
- One battery pack powers both lights: 90 s of white light or 45 s of UV. Battery level (full, medium, low, empty) drives beam intensity and reach.
- Colour language: warm saffron flashlight, violet UV, pale cyan-green ghosts, cool blue moonlight.
- The flashlight starts on the floor (`Pickup_Flashlight`). `F`, `Q` and `R` do nothing until it is picked up (`hasLight` in the store).
- UV-only content is revealed only inside the UV cone, not room-wide.

## CI

`.github/workflows/Codex-review.yml` runs an automated Codex review on every pull request, and `Codex.yml` responds to `@Codex` mentions in issues and PR comments. Both exclude `blender/` (path filter and sparse checkout), so binary asset changes are not reviewed.
