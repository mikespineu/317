# 3.17

A Halloween 3D escape-room browser game: explore a haunted mansion with a flashlight and a camera, solve puzzles, photograph ghosts. Light shows you the house, UV light shows you its secrets, the camera shows you what your eyes can't.

Stack: TanStack Start · three.js / React Three Fiber (WebGPU, WebGL 2 fallback) · Supabase · Vercel · Blender (glTF).

## Status

Playable on desktop and mobile (landscape). Three rooms exist:

| Room | URL | What it is |
| --- | --- | --- |
| Level 0, the study | `/play` | Prototype room: UV code, padlock, mirror word, one Wisp. |
| Level 1, the Entrance Hall | `/play?room=entrance-hall` | Room 1, white light only, about 7 min: key Wisp, mirror-only writing, symbol lock. |
| Level 2, the Library | `/play?room=library` | Room 2, about 9 min: UV lamp, invisible ink, Mimic and Ink Ghost, hidden panel. |

The full game is planned as 10 rooms (1–3 free as guest, 4–10 behind login). Not built yet: login, Supabase backend, saving, journal, leaderboards, mansion map, JSON room loader. Progress (best times, stars, best ghost photos) is kept in localStorage only. English and Polish are supported.

Controls: `WASD` move, mouse look, `E` / click interact (also grab and throw props), `F` light, `Q` white/UV, `R` swap battery, `P` / right mouse photo mode, `Esc` pause. On touch: joystick, drag to look, on-screen buttons.

Look: woodblock print (ukiyo-e at night), built as a post-processing pass.

## Docs

Design and plans live in [`docs/`](docs/). The design document is the source of truth for mechanics and scope.

- [Game Design Document](docs/game-design-document.md): pitch, core loop, rooms, data model, architecture, roadmap.
- Level 0, the study
  - [Blender asset spec](docs/level-0-blender-asset-spec.md)
  - [Implementation plan](docs/level-0-implementation.md)
  - [Status](docs/level-0-status.md): what was built, what is left
- Level 1, the Entrance Hall
  - [Blender asset spec](docs/level-1-blender-asset-spec.md)
  - [Implementation plan](docs/level-1-implementation.md)
- Level 2, the Library
  - [Blender asset spec](docs/level-2-blender-asset-spec.md)
  - [Implementation plan](docs/level-2-implementation.md)
- [`docs/moodboards/`](docs/moodboards/): look references.

[`CLAUDE.md`](CLAUDE.md) describes the code architecture and the Blender-to-game naming contract.

## Development

```sh
npm install
npm run dev              # http://localhost:9000 (fails if the port is taken)
npm run assets           # copy blender/export/*.glb to public/models/ (runs before dev and build)
npm run typecheck
npm run build            # production build (Nitro, Vercel preset)
```

Add `?debug` to a play URL for the debug panel (room switcher, chain skips, tuning, overlays). Copy `.env.example` to `.env` once a Supabase project exists; the rooms run without it.

Blender (needed only to change assets): re-export the `.glb` files with

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b blender/level-0.blend --python blender/scripts/export_level0.py
```

See `CLAUDE.md` for the full asset pipeline.
