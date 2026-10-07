# 3.17 — Level 0 status

Oct 7, 2026 · companion to [`level-0-implementation.md`](./level-0-implementation.md) (the plan) and [`level-0-blender-asset-spec.md`](./level-0-blender-asset-spec.md) (the room)

Level 0 is playable from spawn to the open door, and every step of the plan has code behind it. It is not done: none of the four "done when" boxes in the plan can be ticked yet, because they are about feel and performance on real devices, and that has not been tested. This note records what exists, how it fits together, what is left, and where the level could be better than it is.

---

## 1. What was built

All 13 steps of the plan, in PR #5 (`level-0-implementation`).

| Step | What exists |
| --- | --- |
| 1 Renderer, quality | WebGPU with WebGL 2 fallback, desktop / phone presets, rotate prompt, fullscreen on first tap |
| 2 Room loading | `.glb` loaded and bound by node name, greybox fallback, `npm run assets` |
| 3 Player | Pointer lock + WASD, touch joystick and drag-to-look, circle-vs-box collision |
| 4 Flashlight, battery | Spotlight with cookie and shadows, one pack for both lights, four levels, flicker, sputter, swap, emergency pack |
| 5 Cone, dust | Additive beam cone, dust motes lit only inside the beam |
| 6 Interaction | Centre ray, highlight, prompt, pickups, item bar |
| 7 UV reveal | Hidden code on the painting, visible only inside the UV cone |
| 8 Chain | UV code → padlock → drawer → key → door → "Level complete" |
| 9 Mirror | TSL reflector, reversed word "AWAKE" that reads only in the mirror |
| 10 Wisp | Wander, freeze in white light, flee, dissolve when photographed |
| 11 Camera | Raise, shoot, score from scene data, photo card, best photo kept |
| 12 Atmosphere | Moonlight, fog, bloom, vignette, grain, grade, procedural audio |
| 13 Debug | leva panel behind `?debug`, stats, collider and beam overlays |

Added after the first playtest:

- An always-on controls list in the bottom-left corner (desktop).
- A second battery pack in plain sight on the desk (`Pickup_Battery_Desk`); the first one is hidden behind the books on the shelf.
- The camera is a toggle on right mouse, because hold-right-then-left-click cannot be done on a trackpad.

---

## 2. How it works

### The three places state lives

| Where | Holds | Rule |
| --- | --- | --- |
| `store.ts` (zustand) | Things that change on an event: light on/off and mode, battery level, spares, items, flags, clues, focus, open UI, photos | React subscribes with selectors; a change here may re-render |
| `runtime.ts` (plain object) | Things that change every frame: input deltas, player position, live battery charge, beam, Wisp, colliders | Never triggers a render; each block has one writer |
| `events.ts` | One-shot intents: `interact`, `shoot`, `photo` | Not state; fire and forget |

`tuning.ts` holds every balance number in one mutable object, so the debug panel can change values while the game runs.

### One component per system

`Level0.tsx` mounts one component for each system. They never import each other; they talk only through the store, `runtime` and events. That is what allowed the systems to be written in parallel, and it is what will let a room be swapped without touching them.

```
Game.tsx        canvas + DOM overlays (HUD, padlock, photo card, touch buttons, debug panel)
└─ Level0.tsx   keyed on store.epoch, so "reset level" remounts everything
   ├─ Atmosphere, PostFx
   └─ RoomScene          loads the .glb, binds nodes, provides useRoom()
      ├─ PlayerController
      ├─ Flashlight (+ cone, dust), PaintingReveal
      ├─ Interaction
      ├─ Mirror, Wisp, CameraMode
      └─ DebugScene
```

### The room is data

`room/level0.def.ts` describes the room in the shape the later JSON loader will read: interactables with a `type`, `requires` / `sets` / `gives` tokens (`item:key`, `flag:drawer-open`, `clue:drawer-code`), pickups, ghosts, mirror, exit. `bindNodes.ts` finds the matching nodes in the `.glb` by name prefix and throws in dev if one is missing. `puzzle/chain.ts` evaluates the tokens against the store; `interaction/actions.ts` picks behaviour by `type`, not by node name.

Adding the desk battery showed the shape works: one object in Blender, one line in the definition, no new game code.

### A frame

1. Input modules write move and look deltas into `runtime.input`.
2. `PlayerController` consumes them, resolves collision, writes `runtime.player`.
3. `Flashlight` runs the battery, writes `runtime.beam` and the shared UV uniforms.
4. The Wisp, the interaction ray and the painting's clue check read those.
5. `PostFx` renders (priority 1). Photo capture runs right after (priority 2).

Nothing advances while `paused` is true or a UI (`padlock`, `photo`, `complete`) is open.

### Shaders

All custom materials are TSL node materials, so one code path runs on WebGPU and WebGL 2. `light/uvReveal.ts` exports the beam uniforms and a reusable `uvMask()`; later rooms can use it for footprints or ink ghosts.

### URL flags

`?debug` panel and overlays · `?webgl` force the fallback · `?greybox` skip the `.glb` · `?quality=phone|desktop` force a preset.

---

## 3. Known gaps

Verified so far only by typecheck, build, and a scripted playthrough in a hidden Chrome tab on WebGPU. That proves the logic, not the feel.

**Not tested at all**

- Frame rate on any device. The one number available: 117 draw calls and 10k triangles in the worst view, against a budget of 120 and 300k on the laptop and **80** draw calls on the iPhone. The phone budget is already exceeded on paper.
- Touch controls, the iPhone, safe areas, fullscreen.
- Audio (levels, iOS unlock).
- Pointer lock with a real mouse, including re-lock after the padlock and the photo card close.

**Suspected bugs**

- Photo capture: one captured image came back near-black. The hidden tab returns stale canvas frames, so this may be a test artefact. Check first on a visible screen, on both backends.
- The open drawer slides into the volume of the chair's backrest. This is the Blender layout, not code.

**Rough edges seen in the playthrough**

- The starting charge of 0.5 gives about 15 seconds of white light before the "low" level, and "low" is close to dark.
- The beam cone reads as a wedge coming from the lower right rather than a cone.
- The reversed word glows clearly with no light on it, so it is noticed before the mirror is.
- Scenery does not block the interaction ray: the shelf battery can be picked up through the books.

---

## 4. What Level 0 needs to be marked done

These map to the plan's four "done when" boxes and its open questions (§13).

**A. Performance on devices** — *"Smooth on a mid-range laptop and an iPhone 15 Pro"*

- [ ] Measure FPS with `?debug` in the worst view (light on, mirror in view, Wisp visible, bloom on) on the laptop and the phone.
- [ ] Bring draw calls under 80 on the phone: merge static scenery, or instance repeated props.
- [ ] Decide WebGPU vs WebGL 2 on the iPhone by measuring both (`?webgl`).
- [ ] Decide the mirror cost: full rate, every other frame (`mirrorUpdateEvery`), or lower resolution.
- [ ] Add the asset build step: gltf-transform with meshopt (and KTX2 once there are textures).

**B. The chain feels satisfying** — *"Finding the code with UV and opening the door"*

- [ ] Play it cold with a real mouse and on touch; fix whatever blocks or confuses.
- [ ] Tune battery start charge, thresholds, and the low-level brightness.
- [ ] Decide the highlight style: emissive lift or outline.
- [ ] Move the chair or shorten the drawer slide so they do not intersect.

**C. The Wisp feels good to catch** — *"with mouse and with touch"*

- [ ] Confirm photo capture works on a visible screen, both backends.
- [ ] Tune freeze length, flee speed and the dissolve threshold.
- [ ] Test touch aim assist on the phone.
- [ ] Confirm the camera toggle is right, or go back to hold with a keyboard alternative.

**D. The style is chosen and documented** — *"for the real rooms"*

- [ ] Materials pass in Blender: the room is still flat blockout colours.
- [ ] Bake the lightmap and ambient occlusion, and load it in the game.
- [ ] Settle grain, grade, fog and bloom values, then write them down as the style reference for Room 1.

**E. Housekeeping**

- [ ] Vercel preview deploy and a phone playtest, as the plan asks at each milestone.
- [ ] `CLAUDE.md` says port 8000; `package.json` says 9000.
- [ ] `CLAUDE.md` still describes `Level0.tsx` as placeholder boxes and Tailwind as absent.

A, B and C are mostly tuning and can be done in a day or two with the debug panel. D is the large one and depends on Blender work.

---

## 5. Where it could be better

The level works, but it works like a checklist: each mechanic appears once, in isolation, and nothing pushes back. Ideas, strongest first.

**1. Make the battery matter.** Right now the light running out is an inconvenience, and the desk pack removes even that. The design's tension comes from choosing between white light (see, freeze ghosts) and UV (find clues, twice the drain). Put the player in that choice: start lower, hide the code so it takes a real sweep to find, and let the Wisp show up while UV is on.

**2. Connect the Wisp to the chain.** The ghost is a side activity; the door opens without ever looking at it. One link is enough: the Wisp drifts in front of the painting and blocks the UV reveal until it is photographed, or dissolving it drops the padlock's last digit.

**3. Make the mirror part of the puzzle.** The reversed word is a tech test the player has no reason to read. Mirror-write the code's digit order, or put the UV writing where it can only be seen in the reflection. The room was laid out for this: the mirror faces the painting.

**4. Give the room a first impression.** It is a dark box with a cone of light. The cheapest large gains are the materials pass and baked moonlight (D above), then a visible moon patch on the floor, a readable silhouette for the desk and window from spawn, and a cone that looks like a cone.

**5. Reward the photo.** A score of 99 appears on a card and then nothing happens. Show the photo on the "Level complete" card with a grade, and make a good shot feel different from a poor one: sound, a slower dissolve, the card's wording.

**6. Sound that tells the player things.** The Wisp's whisper already scales with distance. Add direction (stereo pan), a rising tone as the freeze timer runs out, and a distinct sound when UV passes over hidden ink, so the player can search by ear.

**7. Teach without the list.** The controls list in the corner is a patch. The first seconds could teach instead: the light starts off ("F"), the battery prompt appears when the first pack is found, the camera prompt when the Wisp is first seen.

Ideas 1 to 3 change the definition and a little code, not the engine, and they would turn four separate demos into one puzzle. That is probably the "something better".
