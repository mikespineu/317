# 3.17 — Level 0 implementation plan

Oct 7, 2026 · companion to [`game-design-document.md`](./game-design-document.md) and [`level-0-blender-asset-spec.md`](./level-0-blender-asset-spec.md)

Level 0 is one small study at night, outside the story, built to lock down how the game feels and looks: light, battery, UV reveal, mirror, camera and one Wisp. It is done when the light, the camera and one ghost feel good on a mid-range laptop and on an iPhone 15 Pro in landscape.

This file is the coding plan. The Blender spec owns sizes, names and export rules; this file owns how the code reads them.

---

## 1. Scope

**In scope**

- First-person movement and look: desktop (pointer lock + WASD) and touch (joystick + drag), landscape only, rotate prompt in portrait.
- Flashlight: starts on the floor and is picked up first. Then on/off, white/UV switch, shared battery with four levels, flicker, sputter, pickup packs, swap.
- Interaction: centre raycast, highlight, prompt, pick up, item bar.
- Mini chain: UV code on the painting → padlock on the desk drawer → key in the drawer → door.
- Mirror reflection test.
- Camera: raise, shoot, score, show a photo card.
- One Wisp: floats, freezes in light, dissolves when photographed.
- Throwable props: the books can be grabbed and thrown.
- Atmosphere and post-processing, including the woodblock-print look (decided Oct 7, 2026; see the GDD).
- Debug panel and performance overlay.

**Out of scope:** login, Supabase, saving, journal, leaderboards, the JSON room loader. Logic is hand-written but shaped like the room definition so it can move to data later.

**Done when**

- [ ] Smooth on a mid-range laptop and an iPhone 15 Pro in landscape (targets in §12)
- [ ] Finding the code with UV and opening the door feels satisfying
- [ ] Catching the Wisp feels good with mouse and with touch
- [ ] The style is chosen and documented for the real rooms (chosen: woodblock print; values still to settle on device)

---

## 2. Stack

| Area | Choice | Notes |
| --- | --- | --- |
| App | TanStack Start | The game runs on the existing client-only `/play` route |
| 3D | three.js + React Three Fiber v9 + drei | |
| Renderer | `WebGPURenderer` from `three/webgpu` | Same renderer falls back to WebGL 2 (`forceWebGL`) |
| Shaders | TSL (`three/tsl`) node materials | Works on both backends; plain `ShaderMaterial` does not run on `WebGPURenderer` |
| Post-processing | three's `PostProcessing` + TSL nodes (bloom, ink outlines, tone bands, paper grain) | The pmndrs `postprocessing` library targets `WebGLRenderer` only |
| State | zustand | One store, plain objects, easy to serialise later |
| Collision | Hand-written circle-vs-box on the XZ plane for the player; a small sphere-vs-box step for thrown props | Floor is flat; `Collider_` boxes from the .glb are enough. No physics engine |
| Debug | leva panel, own stats readout from `renderer.info` | Only with `?debug` in the URL; works in dev and production builds, phone included |
| Assets | `.glb` from Blender, compressed in the build step | gltf-transform: meshopt + KTX2 later |

**Key decision:** pick WebGPU + TSL now, before writing any shader. Every custom material in this plan (UV reveal, ghost, volumetric cone) is a node material, so it runs on both backends with one code path.

---

## 3. Project structure

```
src/
  routes/
    play.tsx                     # exists: ClientOnly + lazy(Game)
  game/
    Game.tsx                     # exists: Canvas, WebGPU renderer, extend(THREE)
    Level0.tsx                   # scene composition
    renderer/
      createRenderer.ts          # WebGPU with WebGL fallback, quality presets
      postprocessing.ts          # bloom, vignette, grain, colour grade, print look
      ukiyo.ts                   # ink outlines, tone bands, indigo shadows, paper grain (TSL)
      quality.ts                 # preset detection (desktop / phone)
    room/
      level0.def.ts              # hand-written room definition (JSON-shaped)
      RoomScene.tsx              # loads room .glb, binds named nodes
      bindNodes.ts               # Interact_/Pickup_/Collider_/Spawn_/Mirror_ parsing
      greybox.ts                 # temporary boxes with the same names
    player/
      PlayerController.tsx       # movement, look, collision
      desktopInput.ts            # pointer lock, keys
      touchInput.tsx             # joystick + drag-to-look + buttons
      collision.ts               # circle vs AABB on XZ
    light/
      Flashlight.tsx             # spotlight, cookie texture, shadows
      VolumetricCone.tsx         # fake cone + dust
      battery.ts                 # drain, levels, flicker, swap
      uvReveal.ts                # shared TSL uniforms + reveal node
    interaction/
      useInteractionRay.ts       # centre raycast, focus target
      Highlight.tsx
      actions.ts                 # what each interactable does
    props/
      Props.tsx                  # runs prop physics each frame
      propPhysics.ts             # grab, carry, throw, settle: sphere vs collider boxes
    puzzle/
      PadlockUI.tsx
      chain.ts                   # flags and conditions for the Level 0 chain
    ghost/
      Wisp.tsx
      wispMaterial.ts            # translucency, rim, wobble, dissolve (TSL)
      wispBrain.ts               # wander, freeze, flee, dissolve state machine
    camera/
      CameraMode.tsx             # raise/lower, viewfinder
      capturePhoto.ts            # JPEG from the canvas
      scorePhoto.ts              # lit, framed, close, sharp
    mirror/
      Mirror.tsx                 # TSL reflector on Mirror_Surface
    ui/
      Hud.tsx                    # battery, item bar, prompt, guide label, crosshair
      PhotoCard.tsx
      RotatePrompt.tsx
    audio/
      sfx.ts
    store.ts                     # exists: zustand game store
    tuning.ts                    # every balance number in one place
blender/export/                  # exists: source .glb files from export_level0.py
  level-0.glb
  flashlight.glb
  camera.glb
public/                          # to create: what the browser loads
  models/level0/*.glb            # copied (later: compressed) from blender/export/
  textures/level0/flashlight-cookie.png
  textures/level0/painting-uv.png  # white text on black
```

`blender/export/` stays the source of truth. A small `npm run assets` script copies the .glb files into `public/models/level0/` (and later runs gltf-transform on them), so the game never loads straight from the Blender folder.

---

## 4. The Blender ↔ code contract

The code finds everything by object name. Names are the contract; if a name changes in Blender, the code breaks loudly (see `bindNodes` below), not silently.

| Prefix / name | Code behaviour |
| --- | --- |
| `Interact_*` | Raycastable; gets a highlight and a prompt; action looked up by name in `actions.ts` |
| `Pickup_*` | Raycastable; on use, hidden in the scene and added to the inventory |
| Names listed in the definition's `props` (`Book_*`) | Raycastable when `throwable: true`; grab, carry and throw with `props/propPhysics.ts` |
| `Collider_*` | Hidden (`visible = false`), turned into an XZ AABB for the player, never rendered or raycast |
| `Mirror_Surface` | Material replaced by the reflector |
| `Spawn_*` | Empties; positions only (`Spawn_Player`, `Spawn_Wisp`, and later `Spawn_Wisp_Path_*`) |
| Everything else | Static scenery; receives the baked lightmap later |

Nodes in the current `blender/export/level-0.glb`:

```
Interact_Door              Interact_Desk_Drawer       Interact_Painting_Canvas
Pickup_Battery             Pickup_Key                 Mirror_Surface
Spawn_Player               Spawn_Wisp                 Wisp
Collider_Wall_N            Collider_Wall_E            Collider_Wall_W
Collider_Wall_S_E          Collider_Wall_S_W          Collider_Door
Collider_Desk              Collider_Bookshelf         Collider_Chair
Collider_Floor             Collider_Ceiling
Book_1 .. Book_4 (props)    Desk_Padlock (scenery)
+ walls, furniture, props
```

Notes on these:

- The padlock is scenery (`Desk_Padlock`), not an interactable. Using the locked drawer opens the padlock UI; on the right code the `Desk_Padlock` mesh drops and the drawer unlocks. No rename needed.
- The south wall is split around the door (`Collider_Wall_S_E` / `_S_W`); the gap is filled by `Collider_Door` until the door opens.
- `Collider_Floor` and `Collider_Ceiling` are skipped by the XZ player collision (they would cover the whole room); they can still be used by raycasts later.
- `Wisp` is the ghost mesh. The code takes it out of the room scene and drives it from `Spawn_Wisp`.
- `Pickup_Flashlight` is not in the .glb. A pickup with a `model` in the definition is loaded and placed by `RoomScene` (`addModelPickups`) before binding, so it binds like any other. If the model fails to load it becomes a box.
- An interactable can also be named by the definition instead of an `Interact_` prefix (`Prop_Candle`, type `candle`); `bindNodes` binds both. `light/Candle.tsx` draws the flame (a pinched sphere in an additive node material, bright enough for bloom) and a warm point light that flickers, faded in and out by the `candle-lit` flag. The light stays in the scene and is switched through intensity, because toggling visibility rebuilds lit materials.
- Props are bound by the names in the definition, not by prefix. They must be exported axis-aligned: the physics sizes them from the bounding box.

**bindNodes.ts**

- Traverse the loaded scene once, sort nodes into maps by prefix.
- Validate against the room definition: every node the definition references must exist. In dev, missing nodes throw with a list of what was expected and what was found.
- Apply pivots as they come from Blender. Door hinge, drawer back-centre and held-item grip points are set there, so the code only rotates or translates the node.

**Axes:** Blender +Y forward becomes three.js −Z after glTF export. Held items (flashlight, camera) are parented to the camera with no extra rotation if the Blender spec was followed.

**Greybox first:** `greybox.ts` builds boxes with the same names and sizes as the Blender spec (room 4.0 × 5.0 × 2.8 m, desk 1.4 × 0.7 × 0.78 m, door 1.0 × 0.06 × 2.2 m, …). `RoomScene` uses the .glb when it exists and the greybox otherwise, so coding never waits for modelling.

---

## 5. Room definition (hand-written, JSON-shaped)

```ts
// game/room/level0.def.ts
export const level0 = {
  id: 'level-0',
  scene: '/models/level0/level-0.glb',
  spawn: 'Spawn_Player',
  interactables: [
    { node: 'Interact_Painting_Canvas', type: 'uv-reveal', gives: ['clue:drawer-code'] },
    {
      node: 'Interact_Desk_Drawer',
      type: 'drawer',
      slide: 0.35,
      lock: { type: 'code', code: '3-1-7', mesh: 'Desk_Padlock', sets: 'flag:drawer-unlocked' },
      sets: 'flag:drawer-open',
    },
    { node: 'Interact_Door', type: 'door', requires: 'item:key', openAngleDeg: 95 },
  ],
  pickups: [
    {
      node: 'Pickup_Flashlight',
      item: 'flashlight',
      model: '/models/level0/flashlight.glb', // not in level-0.glb: placed by the loader
      at: [0.35, 0.042, 1.15],
      yawDeg: 35,
      glow: true,
    },
    { node: 'Pickup_Battery', item: 'battery' },
    { node: 'Pickup_Key', item: 'key', visibleWhen: 'flag:drawer-open' },
  ],
  props: [{ node: 'Book_1', label: 'book', throwable: true } /* , Book_2..Book_4 */],
  // in interactables: { node: 'Prop_Candle', type: 'candle' }  (lit and blown out with E)
  ghosts: [{ id: 'wisp-1', type: 'wisp', mesh: 'Wisp', spawn: 'Spawn_Wisp', baseScore: 100 }],
  mirror: { node: 'Mirror_Surface' },
  exit: { node: 'Interact_Door', requires: 'item:key' },
} as const
```

The code value is a placeholder; any short code works. `props` lists loose objects; `throwable: true` makes one grabbable and throwable, without it the entry is only a name. The flashlight is not an inventory item: picking it up sets `hasLight` and lights it. The shape mirrors the GDD's room definition so the later JSON loader is a swap, not a rewrite.

---

## 6. Game state (zustand)

```ts
type LightMode = 'white' | 'uv'
type BatteryLevel = 'full' | 'medium' | 'low' | 'empty'

interface GameState {
  // light
  hasLight: boolean           // the flashlight has been picked up; F/Q/R are inert until then
  lightOn: boolean            // starts false
  lightMode: LightMode
  switching: boolean          // short delay while swapping modes
  charge: number              // 0..1, current pack
  spares: number              // spare packs in the inventory
  swapping: boolean           // swap in progress, light is off

  // items, flags, clues
  items: Record<string, number>
  flags: Record<string, boolean>
  clues: string[]

  // interaction
  focus: string | null        // node name under the crosshair
  held: string | null         // prop in the player's hands
  uiLock: 'padlock' | 'photo' | null

  // camera
  cameraRaised: boolean
  photos: { ghostId: string; score: number; url: string }[]

  // actions
  toggleLight(): void
  toggleMode(): void
  swapBattery(): void
  addItem(id: string): void
  setFlag(id: string): void
  addPhoto(p: GameState['photos'][number]): void
}
```

**Rule:** per-frame values (beam intensity, Wisp position, flicker) live in refs and TSL uniforms, never in React state. The store changes only on events (button pressed, item picked up, level crossed), so React re-renders stay rare.

---

## 7. Tuning values

All balance numbers in `tuning.ts`, exposed in the leva debug panel (`?debug`, Step 13) so they can be tuned live while playing.

| Value | Start | Source |
| --- | --- | --- |
| White light drain | 1 pack / 90 s | GDD |
| UV drain | 1 pack / 45 s | GDD |
| Starting charge (Level 0) | 0.5 | Mirrors Room 1 |
| Level thresholds | full ≥ 0.66, medium ≥ 0.33, low > 0, empty = 0 | To tune |
| Mode switch delay | 0.25 s | |
| Battery swap time | 1.2 s, light off meanwhile | |
| Eye height | 1.6 m | Blender spec |
| Player radius | 0.25 m | |
| Walk speed | 1.6 m/s, no run in Level 0 | |
| Interaction reach | 2.0 m | |
| White beam | angle 22°, distance 9 m (full) → 4 m (low) | |
| UV beam | angle 16°, distance 4 m | Narrower, so sweeping matters |
| Wisp freeze | after 0.4 s in the beam, frozen for 3 s × beam strength | |
| Photo cooldown | 0.8 s | |
| Moon / ambient light | 0.4 / 0.12 | Raised from 0.22 / 0.04 once the tone bands made the unlit room black |
| Print look | ink width 1.2 px, threshold 0.012, strength 0.9; 6 bands at 0.7; night gamma 0.6; indigo lift 0.85; paper 0.14 | To tune on device |
| Prop throw | 6.5 m/s + 0.9 m/s lift, spin 9 rad/s; held 0.75 m ahead | To tune |

---

## 8. Systems, in build order

Each step ends with something playable. Steps 1–3 need only the greybox.

### Step 1 — App, renderer, quality

- Already in place: `/play` route, `ClientOnly` + `lazy`, `Game.tsx` with an async `WebGPURenderer`. This step extends it rather than starting over.
- Renderer: WebGPU when `navigator.gpu` exists, otherwise the same `WebGPURenderer` with `forceWebGL: true`. Log which backend runs in the debug panel. Move the renderer setup into `renderer/createRenderer.ts` so the quality preset can feed it.

```tsx
import * as THREE from 'three/webgpu'
import { Canvas, extend } from '@react-three/fiber'

extend(THREE as any)

<Canvas
  shadows
  dpr={quality.dpr}
  gl={async (props) => {
    const renderer = new THREE.WebGPURenderer({
      ...(props as any),
      antialias: quality.msaa,
      forceWebGL: !('gpu' in navigator),
    })
    await renderer.init()
    return renderer
  }}
>
```

- Quality presets in `quality.ts`, picked automatically:

| | Desktop | Phone |
| --- | --- | --- |
| DPR cap | 2 | 1.5 |
| Flashlight shadow map | 1024 | 512 |
| Mirror resolution | 0.5 × screen | 0.35 × screen |
| Dust particles | 400 | 150 |
| Bloom | on | on, half resolution |
| Film grain | on | off |

- **Orientation:** portrait shows `RotatePrompt` and pauses the game. Use `matchMedia('(orientation: portrait)')`.
- **Fullscreen:** not requested. It was built first (first tap, plus an Android landscape lock) and removed on Oct 7, 2026 at the owner's request. The rotate prompt, `viewport-fit=cover` and safe-area insets for the buttons cover phones. A web app manifest with `"display": "fullscreen"` remains an option for home-screen launches.

**Check:** a lit greybox room renders on desktop and on the iPhone; the debug panel shows the backend and FPS.

### Step 2 — Room loading and binding

- Add the `assets` copy script, then `RoomScene` loads `/models/level0/level-0.glb` with drei's `useGLTF`, or builds the greybox. `Level0.tsx` swaps its placeholder boxes for `RoomScene`.
- `bindNodes` produces `{ interactables, pickups, colliders, spawns, mirror }`, validated against `level0.def.ts`.
- Colliders become `{ minX, maxX, minZ, maxZ }` in world space and are hidden.

**Check:** the room appears at the right scale; a 1.6 m reference cube next to the desk looks right; the dev console lists all bound nodes.

### Step 3 — Player controller

**Desktop**

- drei `PointerLockControls`; click on the canvas to lock, Esc to release (and pause).
- WASD relative to camera yaw, normalised so diagonals aren't faster.

**Touch**

- Left half: virtual joystick (appears where the thumb lands, radius ~60 px).
- Right half: drag to look, sensitivity in tuning, pitch clamped to ±80°.
- Buttons on the right edge within thumb reach: Interact, Light, White/UV, Camera, Shutter (only while raised), Battery. Never in the centre of the view.
- Use pointer events with `touch-action: none` on the canvas; track each pointer id separately so moving and looking work at once.

**Collision** (`collision.ts`)

- Player is a circle (radius 0.25 m) on the XZ plane.
- For each collider AABB, push the circle out along the shortest axis. Resolve X and Z separately so the player slides along walls.
- The door collider is removed when the door opens.

**Check:** walk the whole room on both devices, slide along walls, can't pass through the desk or the closed door.

### Step 4 — Flashlight and battery

**Flashlight.tsx**

- A `SpotLight` and its target, both parented to the camera, slightly offset to the right hand so shadows read.
- Cookie texture (`spotLight.map`) for the beam pattern: a soft hot centre with a faint ring.
- `castShadow` on the flashlight only; nothing else casts real-time shadows.
- Held flashlight model parented to the camera, lens along forward. Hidden until the flashlight is picked up: it starts on the floor as `Pickup_Flashlight`, with a faint warm point light so it can be found.
- Colour: warm yellow (white mode), violet (UV mode). UV mode lights the room only weakly; its job is the reveal.

**battery.ts** (runs in `useFrame`)

```
if lightOn and not swapping:
    charge -= dt / (mode === 'white' ? 90 : 45)
level = full | medium | low | empty from thresholds
strength = curve(charge)              // 1.0 full → ~0.35 low
if low: strength *= flicker(t)        // noise, occasional dips
if empty: strength = sputter(t)       // fades to a faint 0.08 glow
spotLight.intensity = base * strength
spotLight.distance  = lerp(lowDist, fullDist, strength)
uvUniforms.power    = mode === 'uv' ? strength : 0
```

- Store updates only when `level` changes, not every frame.
- `swapBattery`: if spares > 0, light off for the swap time, then `charge = 1`, `spares -= 1`.
- Emergency pack: if charge is 0 and no spares for 10 s, `Pickup_Battery` respawns at its spawn (Level 0 stand-in for the GDD rule).
- Keys: F light, Q mode, R swap. All three, and the battery HUD and touch light buttons, are inactive until the flashlight is picked up.

**HUD:** a small battery icon with the level and the spare count; it flashes when low. A guide label near the top tells the player to find the flashlight at the start, and when the battery is low or dead to find a pack and press R (or tap the battery button on touch). Until the painting's code is found it also hints at the UV light: after `uvHintDelay` (20 s) it says to press Q for UV and sweep the walls, and while UV is on it says to sweep slowly. Battery warnings take priority.

**Check:** the light visibly changes through all four levels; switching off stops the drain; swapping works and is risky in timing.

### Step 5 — Volumetric cone and dust

- A cone mesh parented to the flashlight, open-ended, additive blending, `depthWrite: false`.
- TSL material: opacity fades along the cone's length and toward its edges (fresnel-like using the view direction against the normal), multiplied by beam strength. Soft particles: fade where the cone meets geometry using the depth texture, if the cost is fine on the phone.
- Dust: `Points` in the room volume, drifting slowly with noise; brightness comes from whether each point is inside the beam (same cone test as the UV reveal), so dust only shows in the light.

**Check:** the beam reads as a cone in the dark; dust drifts in the light; nothing visible when the light is off.

### Step 6 — Interaction

- `useInteractionRay`: each frame, raycast from the screen centre against `Interact_` and `Pickup_` nodes only (keep a flat array, don't raycast the whole scene). Reach 2 m.
- Focus change → store `focus` → HUD prompt ("E — Open drawer" / tap button label).
- Highlight: lift emissive slightly on the focused node's material clone, or a simple outline pass if it reads better in the dark. Decide in playtest.
- On desktop, E or left click; on touch, the Interact button or tapping the object (raycast from the tap point).
- `actions.ts` maps node names to actions using the room definition: `code-lock` opens the padlock UI, `drawer` slides, `door` rotates, `Pickup_*` adds an item.
- Item bar: bottom-centre on desktop, bottom-left above the joystick on touch. Selecting an item uses it on the focused object (key on door).
- Props: a throwable prop is a ray target like a pickup. E or click grabs it into the lower right of the view; while held, nothing else can be used and the next E or click throws it. Because books are targets, they now block the ray to the battery behind them. Physics (`propPhysics.ts`): a sphere against the collider boxes (which carry Y extents), floor, ceiling and room walls, 120 Hz substeps, bounce and slide damping, then a settle step that lays the prop flat along its smallest axis. No prop-to-prop, prop-to-player or prop-to-Wisp collision.

**Check:** every interactable highlights, prompts and responds; the key can be picked up and used on the door.

### Step 7 — UV reveal

The core mechanic. The painting canvas carries a hidden layer that is visible only inside the UV cone.

- Shared TSL uniforms, updated each frame by the flashlight: `uvPos`, `uvDir`, `uvCos` (cosine of the half-angle), `uvRange`, `uvPower`.
- `uvRevealNode(hiddenTexture)` returns a mask; any material can use it, so later rooms reuse it for footprints, handprints and Ink Ghosts.

```ts
import { uniform, positionWorld, texture, smoothstep, dot, normalize, length, mix, vec3 } from 'three/tsl'

export const uvPos = uniform(new THREE.Vector3())
export const uvDir = uniform(new THREE.Vector3(0, 0, -1))
export const uvCos = uniform(Math.cos(THREE.MathUtils.degToRad(16)))
export const uvRange = uniform(4)
export const uvPower = uniform(0)

export function uvMask() {
  const toFrag = positionWorld.sub(uvPos)
  const inCone = smoothstep(uvCos, uvCos.add(0.04), dot(normalize(toFrag), uvDir))
  const falloff = length(toFrag).div(uvRange).oneMinus().clamp()
  return inCone.mul(falloff).mul(uvPower)
}

// painting canvas
const base = texture(paintingTex)
const hidden = texture(paintingUvTex).r            // white text on black
const glow = vec3(0.75, 0.55, 1.0)                 // violet-white ink
const reveal = hidden.mul(uvMask())
material.colorNode = mix(base.rgb, glow, reveal)
material.emissiveNode = glow.mul(reveal).mul(1.5)
```

- Only the canvas reveals, and only inside the cone: the player has to sweep the lamp.
- When the mask over the code area stays above a threshold for ~1 s, log `clue:drawer-code` (later: the journal entry) and play a soft chime.

**Check:** the code appears only where the UV cone touches it, fades with distance and with a weaker battery, and is invisible in white light.

### Step 8 — The Level 0 chain

| Link | Trigger | Result |
| --- | --- | --- |
| 1 | UV on `Interact_Painting_Canvas` | `clue:drawer-code` |
| 2 | Use the locked `Interact_Desk_Drawer`, enter the code | `flag:drawer-unlocked`, `Desk_Padlock` drops |
| 3 | Use `Interact_Desk_Drawer` again | Drawer slides out 0.35 m (its pivot is at the back centre); `flag:drawer-open`; `Pickup_Key` becomes reachable |
| 4 | Pick up `Pickup_Key` | `item:key` |
| 5 | Use key on `Interact_Door` | Door rotates ~95° on its hinge pivot; door collider removed; "Level complete" card |

- `PadlockUI`: three number wheels, swipe or arrow keys, works with touch. Pointer lock is released while open and restored after.
- Animations: short eased tweens in `useFrame` (drawer 0.5 s, door 1.2 s with a creak). No animation library needed.
- `chain.ts` holds conditions as data (`requires`, `sets`, `gives`) evaluated against the store, so the same evaluator later runs room JSON.

**Check:** the chain is completable from spawn to open door with no dead ends, on desktop and on touch.

### Step 9 — Mirror

- Replace `Mirror_Surface`'s material with three's TSL reflector (`reflector()` from `three/tsl`) at the preset resolution.
- Skip updating the reflection when the mirror is outside the view frustum or behind the camera.
- Slight tint and roughness-free surface; a thin dark edge on the frame hides seams.
- Reflection test: a short reversed word on the wall behind the player is readable only in the mirror. It isn't part of the chain; it proves the setup for Room 1.
- Measure the cost on the iPhone with the mirror in view. If it's too heavy, drop to a lower resolution or update the reflection every other frame.

**Check:** the reversed word reads correctly in the mirror; FPS on the phone stays within budget with the mirror in view.

### Step 10 — The Wisp

**wispBrain.ts** — a small state machine:

| State | Behaviour | Exit |
| --- | --- | --- |
| `wander` | Drifts along a smooth noise path inside the room bounds, bobbing gently; avoids colliders by staying in an inner box | In white beam for 0.4 s → `freeze` |
| `freeze` | Stops, trembles slightly; duration 3 s × beam strength | Timer ends → `flee`; photographed → `dissolve` |
| `flee` | Moves away from the player quickly for 1.5 s, then back to `wander` | Timer |
| `dissolve` | Dissolves over 1 s, drops nothing in Level 0 | Removed |

- Beam test: the same cone test as UV (position, direction, half-angle, range), done on the CPU for the Wisp's centre; also a raycast from the light to the Wisp so walls block it.
- `exposure` accumulates while lit and decays when not; drives freeze and the material's brightness.

**wispMaterial.ts** (TSL, `MeshBasicNodeMaterial`, transparent, additive or alpha):

- Pale cyan-green, rim glow from view angle (fresnel), soft inner core.
- Vertex wobble from noise over time; the tail sways more than the head.
- Dissolve: noise threshold rising from 0 to 1, with a bright edge where it cuts.
- Brightness rises with exposure so the player sees the freeze coming.
- A faint point light or just bloom so it reads in the dark when the flashlight is off.

**Check:** the Wisp is findable in the dark, freezes when lit, flees if ignored, and dissolves when photographed.

### Step 11 — Camera and photo scoring

**CameraMode.tsx**

- Raise: P or right mouse (toggle; hold is still a tuning option) / Camera button. Esc leaves photo mode: the browser consumes the key and drops the pointer lock, so the game lowers the camera when the lock is lost with no modal open (a pause follows, since the lock is gone). The held camera model moves up, the FOV narrows a little (zoom 1.2×), a viewfinder overlay appears (corners, centre mark, battery of the flashlight still visible).
- Shoot: left click / Shutter button, 0.8 s cooldown. A white flash overlay (150 ms), a shutter sound, a brief freeze frame, then the photo card slides in.
- Touch aim assist: while raised, if the Wisp is within ~8% of screen width of the centre, gently pull the view toward it.

**scorePhoto.ts** — computed from scene data at the moment of the shot, not from pixels:

```ts
// visible: in frustum and not blocked (raycast from camera to ghost centre)
if (!visible) return null

const lit    = inBeam ? beamStrength : 0                        // 0..1
const framed = 1 - clamp(ndcDistanceFromCentre / 0.7, 0, 1)     // 0..1
const close  = clamp(screenHeightFraction / 0.4, 0, 1)          // fills 40% → 1
const sharp  = 1 - clamp(ghostSpeed / 1.5, 0, 1)                // m/s

const quality = 0.35 * lit + 0.25 * framed + 0.2 * close + 0.2 * sharp
return Math.round(baseScore * quality)
```

- A shot of an unlit ghost still counts but scores low; a shot with no visible ghost is just a photo.
- Photographing a frozen Wisp with quality above a threshold (start: 0.5) triggers `dissolve`.
- Only the best photo per ghost is kept.

**capturePhoto.ts**

- After the next rendered frame, draw the canvas into a small 2D canvas (e.g. 512 px wide) and export a JPEG blob with `toBlob('image/jpeg', 0.8)`; show it with an object URL.
- Capture in the same frame as the render (in an after-render callback). If the backend returns a blank image, render the view once into a render target and read it back instead. Test both backends; this is a known trouble spot.
- Photos stay in memory for Level 0; Supabase Storage comes later.

**PhotoCard.tsx:** the image, the four sub-scores as small bars, the total, and "best" if it beats the previous one.

**Check:** a good, lit, centred shot of a frozen Wisp scores clearly higher than a rushed one; the photo card shows what improved the score.

### Step 12 — Atmosphere, post-processing, audio

**Lighting**

- Moonlight: a cool blue directional light through the window, no shadows (baked later), low intensity.
- Ambient: low and indigo-tinted (0.12, with the moon at 0.4), so the room is dark but readable with the flashlight off, plus a few faint glows (Wisp, moonlit floor patch). The first pass (0.04 / 0.22) read as black once the tone bands were added.
- Light fog (exponential, dark blue-grey) for depth in the beam.

**Post-processing** (three `PostProcessing`, TSL)

- Bloom: catches the Wisp, the UV ink and the lens.
- Vignette, subtle film grain (desktop), a slight colour grade toward plum shadows and warm highlights.
- The print look (`ukiyo.ts`): a brightness lift (`nightGamma`) so the dark end is not crushed, brightness snapped to flat tone bands, shadows lifted to indigo, depth-based ink outlines, paper grain. The outlines use the second difference of 1/viewZ, which is zero across flat surfaces and jumps at silhouettes and creases.
- Each effect toggles in leva so the look can be compared on device.

**Audio** (Web Audio, started on the first user gesture)

- Room tone loop, a creak or two.
- Light click, UV hum while UV is on, low-battery tick, swap clunk.
- Padlock wheel clicks, drawer slide, door creak.
- Positional Wisp whisper (drei `PositionalAudio`).
- Shutter.

**Check:** with everything on, the room reads as a woodblock print (outlines, flat tones, paper) and still meets the frame budget.

### Step 13 — Debug tools

All debug tools are off unless the URL has `?debug` (`DEBUG` in `debug.ts`). The flag works the same in dev and in production builds, so the tools can be used on the phone. Without it nothing below is mounted.

**URL flags**

| Flag | Effect |
| --- | --- |
| `?debug` | Mounts the debug panel (`debug/DebugPanel.tsx`) and the overlays and stats (`debug/DebugScene.tsx`) |
| `?webgl` | Forces the WebGL 2 backend, to compare both on one device |
| `?greybox` | Uses the greybox room instead of the `.glb` |
| `?quality=phone` / `?quality=desktop` | Overrides the detected quality preset |

Flags combine (`/play?debug&webgl&quality=phone`). The panel's reload buttons change one flag and always keep `?debug`.

**Debug panel** (leva)

- Top right, collapsed by default, draggable, with a filter box. Narrower on coarse-pointer devices so it covers as little of a landscape phone as possible; the body scrolls.
- It runs in its own React root on `document.body`, outside `.game`. Key presses inside the panel are stopped before they reach the game's listeners, so typing a value never toggles the flashlight or moves the player. Clicking it never takes pointer lock.
- Monitors poll `runtime` and the store with a getter every 250 ms; controls write straight into the mutable objects. Nothing in the panel re-renders the game.

Folders (all collapsed at first):

- **Level**
  - *Reset level*: `resetLevel()`. Store level state and `runtime` go back to their starting values and `epoch` is bumped; `Level0` is keyed on `epoch`, so the whole scene remounts (room, player, Wisp, drawer, door, pickups). Tuning, post-effect and overlay toggles are kept, so a changed balance value can be tried from the start.
  - *Reload page*: the hard reset. Everything goes back to the values in the code, tuning included.
  - *Complete level*: sets the `complete` UI lock, to see the end screen.
  - *Skip to 1–4*: clue found, drawer unlocked, drawer open, key in inventory. Each step also applies the earlier ones. Steps 2 and 3 call the interaction system's own actions (`tryCode`, `interactWith`), so the padlock drops and the drawer slides; step 4 gives the key and marks `Pickup_Key` as taken.
  - A monitor of the chain state (clue, flags, key).
- **Battery / light**: *Fill battery*, *Drain to low* (just under `levelMedium`), *Empty battery*, *Add spare pack*; monitors of charge, level, spares, light state and beam strength. The live charge is `runtime.battery.charge`; the buttons write it and set the store's `batteryLevel` to match.
- **Player**: monitors of position and yaw / pitch from `runtime.player`. There is no teleport; *Reset level* puts the player back on the spawn.
- **Wisp**: monitors of `runtime.wisp.state` and `exposure`.
- **Renderer**: the backend in use and the quality preset (read-only), and buttons that reload with `?webgl`, `?greybox` or `?quality=` changed. These are read once at load, so they cannot change without a reload.
- **Post effects**: one checkbox per key of `postSettings` (bloom, vignette, grain, grade). The pipeline rebuilds its output on the next frame.
- **Overlays**: one checkbox per key of `debugState` (`showStats`, `showColliders`, `showBeam`).
- **Tuning**: every numeric, boolean and colour key of `tuning`, generated from the object, so a new key in `tuning.ts` appears by itself. Keys are grouped into sub-folders by name (wisp, camera, mirror, post, audio, atmosphere, battery, player, interaction, light, other). Ranges and steps are derived from each default: 0 to about 4× the default, `…Deg` keys 0–90, fractions such as opacities and volumes 0–1, offsets and biases symmetric around 0. Defaults below 0.1 are edited in thousandths (label ends in `e-3`), because leva shows two decimals at most. Changes are written into `tuning` at once; systems read it every frame.
  - *Reset tuning*: back to the defaults captured at load.
  - *Copy tuning JSON*: the current values to the clipboard (to the console where the clipboard is unavailable, e.g. plain http on the LAN), for pasting back into `tuning.ts`.

**Overlays and stats** (`DebugScene`, inside the canvas)

- Stats readout at the top centre, refreshed four times a second: FPS, frame time, worst frame, draw calls, triangles, render passes, backend, preset and drawing-buffer size, from `renderer.info`.
- Collider boxes: the XZ boxes in `runtime.colliders` as wireframes (the door's box disappears when the door opens).
- Beam cone: a wireframe of `runtime.beam` (origin, direction, half-angle, range), yellow for white light and violet for UV.

**Check:** `/play` shows no debug UI; `/play?debug` shows the panel and the stats on desktop and on the iPhone. Typing in a tuning field does not trigger game keys. Changing `walkSpeed` or `bloomStrength` takes effect at once and survives *Reset level*; *Reset level* puts the player on the spawn with the drawer shut and the Wisp back. *Skip to 4* followed by the door completes the level. The *Renderer* buttons reload with the flag changed and the panel still there.

---

## 9. Milestones

| # | Milestone | Steps | Device check |
| --- | --- | --- | --- |
| M1 | Walk the greybox | 1–3 | Laptop + iPhone |
| M2 | Light and battery feel | 4–5 | Laptop + iPhone |
| M3 | Chain playable (UV → padlock → drawer → key → door) | 6–8 | Laptop + iPhone |
| M4 | Mirror and Wisp | 9–10 | iPhone performance |
| M5 | Camera and scoring | 11 | Touch feel on iPhone |
| M6 | Look pass with Blender assets | 12–13 + real .glb | Style decision |

Each milestone ends with a deploy to a Vercel preview and a short playtest on the phone.

---

## 10. Asset hand-off points

| Code step | Needs from Blender | Fallback until then |
| --- | --- | --- |
| 2–3 | Blockout `level-0.glb` with names, sizes, colliders, spawns | Done (exported) |
| 7 | Painting canvas with its UVs; `painting-uv.png` | Plane with a test texture |
| 8 | Desk with drawer (back-centre pivot), padlock, door (hinge pivot), key | Greybox boxes with the same pivots |
| 9 | `Mirror_Surface` plane | Plane |
| 10 | Wisp mesh (blob with a tail) | Done (`Wisp` in `level-0.glb`) |
| 4 | Held flashlight `.glb` | Done (`flashlight.glb`) |
| 11 | Held camera `.glb` | Done (`camera.glb`) |
| 12 | Materials pass and baked lightmap | Flat colours |

Every re-export from Blender should load without code changes; if names or pivots change, `bindNodes` validation says what's missing.

---

## 11. Writing the code with Claude Code

- This file lives at `docs/level-0-implementation.md`, next to the GDD and the Blender spec.
- Work one step at a time: "Implement Step 4 from docs/level-0-implementation.md". Each step's **Check** line is its acceptance test.
- Every balance number goes into `tuning.ts`, never inline. It then shows up in the debug panel (`/play?debug`) without further work.
- Run `npm run typecheck` after each step (unused code fails it).
- Before a step that writes a shader, check the current three.js TSL docs and examples, since the node API still moves between releases.

---

## 12. Performance budget

| Metric | Laptop target | iPhone 15 Pro target |
| --- | --- | --- |
| Frame rate | 60 fps | 60 fps, never below 45 |
| Draw calls | < 120 | < 80 |
| Triangles | < 300k | < 150k |
| Real-time shadows | Flashlight only | Flashlight only, 512 map |
| Texture memory | < 128 MB | < 64 MB |
| Room .glb (compressed) | < 8 MB | same |

Measure with the debug overlay in the worst view: flashlight on, mirror in view, Wisp visible, bloom on.

---

## 13. Open questions for Level 0

- [ ] Camera raise: hold right mouse or toggle?
- [ ] Highlight style: emissive lift or outline?
- [ ] WebGPU vs WebGL on the iPhone: which backend is faster for this scene in practice?
- [ ] Mirror cost on the phone: full rate, half rate, or lower resolution?
- [ ] Wisp freeze length and flee speed: fun or frustrating?
- [ ] Battery thresholds and the flicker: readable warning or annoying?
- [ ] The final look: the woodblock print is chosen. Open: outline density (`inkThreshold`), overall brightness (`nightGamma`, ambient) and the number of tone bands, checked on the laptop and the phone.
