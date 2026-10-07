# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

3.17 is a first-person 3D escape-room game for desktop and mobile (landscape) browsers. The design is specified in two documents that are the source of truth for behaviour, scope and naming; read the relevant section before building a feature:

- `docs/game-design-document.md` — mechanics, rooms, data model, architecture, roadmap.
- `docs/level-0-blender-asset-spec.md` — the Level 0 room: sizes, object names, export rules.
- `docs/level-0-implementation.md` — the Level 0 coding plan: build steps with acceptance checks, room definition, store shape, tuning values.

The current target is **Level 0**, a single prototype study. Login, Supabase, saving, the journal, leaderboards and the data-driven room loader are explicitly out of scope until Level 0 is done.

## Commands

```sh
npm run dev              # dev server on http://localhost:8000 (--strictPort: fails if the port is taken)
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

**Rooms are meant to become data.** The design calls for a shared engine that loads a room's `.glb` plus a JSON definition binding behaviour to named nodes. Level 0 logic is hand-written, but should keep the shape of that definition (interactables, ghosts, exit, `requires` / `gives`) so it can move to data later. `src/game/Level0.tsx` is still placeholder box geometry and does not load the exported `.glb` yet.

**Blender to game contract.** The game finds objects by name, so names, origins and sizes in the `.blend` are an interface:

- Prefixes: `Interact_` (usable), `Pickup_` (collectable), `Collider_` (invisible collision), `Spawn_` (position empties), plus `Mirror_Surface`. Everything else is static scenery.
- 1 unit = 1 m; the floor centre is the world origin; the room is 4 × 5 m with a 2.8 m ceiling; player eye height is about 1.6 m.
- Blender is Z-up with +Y forward; the exporter converts to three.js Y-up.
- `blender/export/` holds one `.glb` for the room and one per held item (`flashlight.glb`, `camera.glb`). Cameras and lights are not exported; the game does its own lighting. Compression belongs in the build step, not in Blender.
- After any change to names, origins or sizes, re-export so the game matches the `.blend`.

**Supabase** helpers exist but are unused: `src/lib/supabase.ts` (browser) and `src/lib/supabase.server.ts` (cookie-based, for use inside server functions only). When the backend work starts, the design requires that gated room content, door solutions and scores are served and validated by server functions, never shipped in the client bundle.

## Game constants worth knowing

These come from the design document and recur across systems:

- Controls: `F` light on/off, `Q` white/UV, `R` swap battery, `E` interact, `Tab` inventory, `J` journal, right mouse raises the camera, left click shoots.
- One battery pack powers both lights: 90 s of white light or 45 s of UV. Battery level (full, medium, low, empty) drives beam intensity and reach.
- Colour language: warm yellow flashlight, violet UV, pale cyan-green ghosts, cool blue moonlight.
- UV-only content is revealed only inside the UV cone, not room-wide.

## CI

`.github/workflows/claude-code-review.yml` runs an automated Claude review on every pull request, and `claude.yml` responds to `@claude` mentions in issues and PR comments. Both exclude `blender/` (path filter and sparse checkout), so binary asset changes are not reviewed.
