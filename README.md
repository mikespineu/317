# 3.17

A Halloween 3D escape-room browser game: explore a haunted mansion with a flashlight and a camera, solve puzzles, photograph ghosts.

Stack: TanStack Start · three.js / React Three Fiber · Supabase · Vercel · Blender (glTF).

## Docs

- [Game Design Document](docs/game-design-document.md)
- [Level 0 — Blender asset spec](docs/level-0-blender-asset-spec.md)

## Development

```sh
npm install
npm run dev        # http://localhost:8000
npm run typecheck
npm run build
```

Copy `.env.example` to `.env` once a Supabase project exists; Level 0 runs without it.
