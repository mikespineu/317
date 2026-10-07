# 3.17 — Game Design Document

Oct 7, 2026 · @Michał Kręcisz

## Overview

3.17 is a 3D escape-room game in the browser: you explore a haunted mansion room by room with a flashlight and a camera, solve puzzles to open the next door, and photograph ghosts for points. It is a portfolio piece, so it has to look striking, run smoothly and actually ship.

**Pitch:** Luigi's Mansion meets an escape room. Light shows you the house, UV light shows you its secrets, and the camera shows you what your eyes can't. The title is the time the clock stopped, the mystery the whole house is built around.

**Design pillars**

1. **Light is the main tool.** What you point your light at changes what you see.
2. **The house is connected.** Rooms keep secrets that can only be unlocked later, so going back is part of the game.
3. **The camera reveals the truth.** Photos are for points, and sometimes they are also the solution.
4. **Small and polished.** Ten hand-crafted rooms rather than many generated ones.

**Scope:** 10 rooms (levels). Rooms 1–3 are free and playable as a guest. Rooms 4–10 require login and a newsletter sign-up.

**Platform:** desktop and mobile browsers. Phones and tablets are played in landscape. Hosted on Vercel; the reference test phone is an iPhone 15 Pro.

| Area | Choice |
| --- | --- |
| App framework | TanStack Start |
| 3D | three.js + React Three Fiber, WebGPU renderer with WebGL fallback |
| Backend | Supabase: Auth, Postgres, Storage |
| Assets | Blender, exported to glTF |
| Newsletter | Emails and consent stored in Supabase, no external provider |

## Core loop

Every room is a self-contained escape room: a chain of clues leads to the key that opens the door to the next room, and photographing its ghosts earns points.

1. **Enter** a dark room. The door behind you stays open, but the next one is locked.
2. **Explore** with the flashlight. Inspect objects, open drawers, read notes.
3. **Follow the clue chain.** Find clues (some only under UV or in a mirror), then use them to unlock drawers, chests and mechanisms.
4. **Find the key** at the end of the chain.
5. **Photograph ghosts** along the way for points.
6. **Open the door** with the key.
7. **Room summary:** score, stars, new photos for the album, secrets still missing.

Around the rooms sits a simple session flow: title screen → mansion map (rooms cleared, locked, secrets left) → room → summary → next room or back to the map.

## Room progression

Every room works like an escape room: a chain of clues ends with a key, and the key opens the door to the next room. Ghost photos give points; the chain is what moves the player forward.

**The pattern**

1. **Find** a clue: in plain sight, under UV, in a mirror, in a photo, or inside an item.
2. **Understand** it: a code, an order, a place or a time.
3. **Unlock** something with it: a padlock, a drawer, a chest or a mechanism.
4. **Get** the next clue or item from it, and repeat.
5. **The last link gives the key,** a unique item per room. Using it on the door opens the next room.

**Rules**

- Every room has exactly one exit key, hidden at the end of its chain.
- Room 1 has a short chain of about five links. Later rooms are longer and can split into two chains that meet, for example two halves of a key.
- Each chain uses the room's new mechanic at least once, such as UV in the Library or photo evidence in the Bathroom.
- A ghost can be one link (a key ghost that drops an item), but at most one per room, so progress never depends on photo skill.
- Clues never need outside knowledge; everything required is in the house.
- The journal hints at the current link only, and each hint costs points.

## Controls

The game is played in first person, on desktop and on phones and tablets held in landscape; in portrait it shows a "rotate your device" screen.

| Action | Desktop | Mobile (landscape) |
| --- | --- | --- |
| Look | Mouse, with pointer lock | Drag on the right half of the screen |
| Move | W A S D | Virtual joystick under the left thumb |
| Interact, pick up | E, or click a highlighted object | Contextual button, or tap the object |
| Grab, throw a prop | E or click on a throwable prop to grab it; E or click again to throw | Interact button or tap, then again to throw |
| Light on / off | F | Light button |
| Switch white / UV light | Q | White / UV button |
| Swap battery | R | Battery button |
| Photo mode on / off, take photo | P or right mouse to toggle, left click to shoot, Esc to leave | Camera button to toggle, shutter button to shoot |
| Inventory | Tab | Bag button |
| Journal and hints | J | Journal button |

**Mobile notes**

- The game does not request fullscreen. In portrait it shows the rotate prompt and pauses.
- Buttons sit within thumb reach on both sides and never cover the centre of the view.
- A light aim assist helps frame ghosts with the camera on touch screens.
- A lighter graphics preset is picked automatically on phones.

## Lights

The player starts in the dark and finds the white flashlight on the floor near the start; the UV lamp is found in Room 2 and changes how every room can be read, including Room 1.

| Light | Found in | Reveals | Effect on ghosts | Power |
| --- | --- | --- | --- | --- |
| White flashlight | Room 1, on the floor near the start | The room itself: objects, normal text, shadows | Most ghosts flinch and freeze briefly, which is the photo window | Shared battery: one pack lasts 90 s |
| UV lamp | Room 2 | Invisible ink, footprints, handprints, hidden symbols, Ink Ghosts | Shy Ghosts don't flee from it; Ink Ghosts become visible | Shared battery: one pack lasts 45 s |

**Rules**

- **The light can be switched on and off.** When it's off, the room is dark, lit only by faint moonlight with indigo shadows and a few glowing objects, and the battery doesn't drain.
- **Until the flashlight is picked up**, F, Q and R do nothing and the battery display and light buttons are hidden. A guide label tells the player to find it on the floor. When the battery is low or dead, the guide tells them to find a battery pack and press R to charge. Once they have had the flashlight for a while without finding the painting's code, it suggests switching to UV with Q and sweeping the walls; while UV is on it says to sweep slowly.
- One light type is active at a time, white or UV. A single key switches between them, with a short switch delay.
- Hidden content is revealed only inside the UV cone, not room-wide. Players have to sweep the light to find it.
- **One battery powers both lights.** A battery pack lasts 90 seconds of white light or 45 seconds of UV, so UV drains twice as fast.
- **Battery level changes the light:**
  - Full: strong, bright beam with long reach.
  - Medium: normal beam.
  - Low: dimmer, shorter beam that flickers now and then.
  - Empty: the light sputters down to a faint glow, enough to move around but not to read clues or catch ghosts.
- **A weaker beam matters:** ghosts freeze for less time, photos score lower on lighting, and the UV cone reveals less.
- **Batteries are found in rooms:** 2–3 packs per room, in drawers and on shelves, sometimes dropped by ghosts. Spares go into the inventory, and swapping one in takes a moment, so it's risky with a ghost nearby.
- If a player still runs completely dry, one emergency pack appears in a fixed spot in the room, so nobody gets stuck in the dark.
- Battery level and spares carry over between rooms and are saved with progress.
- These are starting values; the exact balance is tuned in playtests.

## Camera and photos

The camera does three jobs: it scores ghosts, it solves some puzzles, and it fills the player's ghost album, which is the main reason to log in.

**Photo quality** is scored per shot. Only the best photo of each ghost counts toward the room score.

- **Lit:** the ghost is inside the active light cone; a fuller battery gives a brighter beam and a better score.
- **Framed:** the ghost is near the centre of the frame.
- **Close:** the ghost fills a good share of the frame.
- **Sharp:** the ghost isn't moving fast at the moment of the shot.

**Photos as puzzle tools.** Some clues exist only in photos: a mirror that looks empty shows a word in the photo, a portrait shows a figure behind it. This is the game's signature mechanic and should appear in at least three rooms.

**Ghost album**

- Every counted photo is saved to the player's album, grouped by room and ghost type.
- Logged-in players' photos are stored in Supabase Storage as small JPEGs captured from the canvas.
- Guests keep their photos locally until they sign up, then they are uploaded.

## Ghosts

A new ghost type arrives every room or two, so each room teaches one new way of catching.

| Ghost | First room | Behaviour | How to catch |
| --- | --- | --- | --- |
| Wisp | 1 | Floats slowly around the room | Light it, it freezes, take the photo |
| Ink Ghost | 2 (secret one in 1) | Invisible in white light | Only visible under UV |
| Mimic | 2 | Disguises itself as furniture or a book | Spot the object that twitches, hold the light on it |
| Poltergeist | 3 | Moves fast and throws objects | Wait for it to pause, then shoot |
| Twins | 4 | Always appear as a pair | Both must be in one frame |
| Mirror Ghost | 7 | Exists only in reflections | Photograph its reflection |
| Shy Ghost | 8 | Flees from white light | Track it with UV, switch lights at the right moment |
| Boss | 10 | Uses every behaviour above, in phases | Each phase needs a different technique |

**Default rule:** ghosts are optional and give points. A room can mark one ghost as a **key ghost** when a puzzle needs it, for example the Wisp in Room 1 drops a key once photographed.

## Items, journal and puzzles

Items and clues persist across the whole house, and the journal records every clue automatically, so a player can come back days later and still solve the Room 9 door.

**Inventory**

- A small item bar; selecting an item uses it on whatever the player is looking at.
- **Inspect mode:** rotate an item in 3D. Some items hide markings you only see from one side or under UV.
- **Combine:** drag one item onto another, for example oil can + rusty key.

**Journal**

- Logs every clue found, with a snapshot of where it was found.
- Holds story fragments (diary pages, letters) and links to the ghost album.
- Shows hints for the current room; using one costs points.

**Puzzle types**

| Puzzle | How it works | First room |
| --- | --- | --- |
| Symbol or code lock | Code found in the room, in plain sight or written in a note | 1 |
| Read the room | Order or code worked out from details: dates under portraits, numbers on objects | 1 |
| Reflection | Writing or a clue readable only in a mirror | 1 |
| Invisible ink | Code or path visible only under UV | 2 |
| Item combining | Two items make a working one | 3 |
| Sequence | Order of place settings, piano notes | 4 |
| Shadow puzzle | Rotate an object under the flashlight until its shadow forms a symbol | 6 |
| Photo evidence | Clue that appears only in a photo | 7 |
| Clock | Set the hands to a time found elsewhere | 9 |

## World structure

The mansion is one connected house: rooms open in order, cleared rooms stay open, and a clue hidden in Room 1 is needed in Room 9 to reach the Crypt.

> _Diagram: mansion layout · 10 rooms, 1 return visit, 1 clue thread — see the live doc._

Rooms run in order from the hall to the Crypt; the UV lamp from the Library sends the player back to the hall, and the clock time read there opens the Crypt door in Room 9.

**Moving around**

- Neighbouring rooms connect through real doors. The player walks back through them.
- A mansion map with quick travel unlocks later (open decision: from Room 4), so a trip from Room 9 back to Room 1 isn't tedious.
- Every room keeps its state: opened drawers, picked-up items, solved locks, photographed ghosts.

**The clock thread (Room 1 → Room 2 → Room 1 → Room 9)**

1. **Room 1, first visit (white light only).** A grandfather clock stands in the hall with no hands, and a smeared, unreadable note sits on its glass. The player can't do anything with it yet.
2. **Room 2.** The player finds the UV lamp. A UV-only message in the library says *"The hall remembers what the clock forgot."* The journal logs it as a lead.
3. **Room 1, return visit with UV.** The note shows a time, 3:17, and a symbol. The journal logs the clue. A secret Ink Ghost is also there, so the return pays off right away.
4. **Room 9.** The door to the Crypt needs the tower clock set to 3:17. A player without the clue gets a hint pointing back to the hall. The server checks both the clue and the time.

**Free players and the gate.** Free players can find the clue in Room 1 but can't use it until Room 9, which shows them that the whole house is connected and worth unlocking.

More threads like this can be added as rooms are designed, with at most one or two per room so the journal stays readable.

## Rooms

Ten rooms, each introducing one new mechanic; Room 1 is designed in detail because it is built first, the others are outlines to refine one by one.

| # | Room | Access | New mechanic | Ghosts | Where the key is | Cross-room |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Entrance Hall | Free | Flashlight, camera, battery, reflections | Wisp (key ghost), Wisp; secret Ink Ghost | Chest under the stairs, opened with the portrait symbols | Clock note, readable with UV |
| 2 | Library | Free | UV lamp, invisible ink | Mimic, Ink Ghost | Hidden compartment behind the books marked with UV handprints | Message pointing back to the hall |
| 3 | Kitchen | Free | Item combining | Poltergeist | In the oven, reached by combining items; the door also carries a seal | Sealed door: newsletter gate |
| 4 | Dining Room | Gated | Sequence puzzle | Twins | Sideboard drawer that opens when the place settings are in order | – |
| 5 | Music Room | Gated | Sound-based sequence | To design | Under the piano lid, after playing the ghost's melody | – |
| 6 | Nursery | Gated | Shadow puzzles | To design | Toy box opened by the shadow symbol | – |
| 7 | Bathroom | Gated | Mirror Ghosts, photo evidence | Mirror Ghost | Medicine cabinet; its code shows only in a photo of the mirror | – |
| 8 | Greenhouse | Gated | UV battery management | Shy Ghost | To design | – |
| 9 | Clock Tower | Gated | Clock puzzle | To design | Inside the tower clock, once it is set to 3:17 | Needs the Room 1 clue |
| 10 | Crypt | Gated | Boss fight | Boss | – (final room: escape the house) | Reveals the 3:17 story |

### Room 1: Entrance Hall (detailed)

**Goal:** find the Library key and open the Library door. Everything needed works with the white flashlight.

**Setting:** the front door slams shut behind the player and the power is out. A staircase, a coat rack, a writing desk, three family portraits, a grandfather clock, a large hall mirror, a chest under the stairs with a three-symbol lock, and the locked Library door.

**Puzzle chain**

1. **Flashlight and battery.** The flashlight lies on the floor by the front door, with half a pack. This teaches looking around, switching the light on and off, and watching the battery.
2. **Key ghost.** A Wisp drifts through the hall. Lit, it freezes; photographed, it drops a small brass key. This teaches the camera.
3. **Desk.** The brass key opens the writing desk. Inside is a letter: someone has rearranged the family portraits, and the right order "is written where only the mirror can read it".
4. **Mirror.** Backwards writing on the wall opposite the hall mirror reads, in the reflection, "Eldest first".
5. **Portraits.** Each portrait has a birth year on its frame and a symbol in the painting, for example a moon, a bat and a pumpkin. Eldest first gives the symbol order.
6. **Chest.** The symbols open the lock on the chest under the stairs. Inside is the Library key.
7. **Door.** The Library key opens the Library door.

**Ghosts:** the Wisp (key ghost), one optional Wisp near the staircase, and a secret Ink Ghost visible only after returning with UV.

**Batteries:** the flashlight starts with half a pack, about 45 seconds of light. Two packs are hidden in the hall, one of them in a coat pocket on the coat rack, so the player learns to switch the light off, find packs and swap them in the first room.

**Secrets for later:** the grandfather clock with no hands and the smeared note on its glass, which shows 3:17 under UV.

**Completion:** first clear by opening the door. Full completion also needs the secret Ink Ghost and the clock clue, both only possible after Room 2.

## Story

Something happened to the family at 3:17 one night, and every room holds one fragment of it; the Crypt reveals the whole story and explains the boss. This section is a draft to develop as rooms are built.

- **Told in fragments:** diary pages, letters, photos and UV writing, one or two per room, collected in the journal.
- **The clock as the spine:** the stopped clock in Room 1 asks the question, and the tower clock in Room 9 answers it.
- **The ghosts are the household:** each ghost type can hint at who it was (the twins, the musician, the child in the nursery).
- **No text walls:** a fragment is a few lines at most, readable in seconds.

## Scoring

A room's score comes from ghost photos, a time bonus on the first clear, and a penalty for hints; stars reward completion, not just speed. All values below are starting points to tune in playtests.

| Source | Rule |
| --- | --- |
| Ghost photo | Base points per ghost type × photo quality (lit, framed, close, sharp); best photo per ghost counts |
| Secret ghost | Bonus on top of the photo score |
| Time bonus | First clear only, so returning to a room never hurts the leaderboard |
| Hint | Each hint used costs points |

**Stars per room**

1. Open the door.
2. Photograph every non-secret ghost in the room.
3. No hints used and under the room's par time.

**Secrets** are tracked separately from stars ("2 of 2 secrets found"), because some can only be found after later rooms.

**Leaderboards:** per room (best score) and overall (sum of best room scores), for logged-in players only.

## Accounts, progress and gating

Anyone can play Rooms 1–3 as a guest; login saves progress across devices and unlocks the album and leaderboards; Rooms 4–10 need login plus a newsletter sign-up.

**Guest mode**

- No login needed for Rooms 1–3. Progress, items, clues and photos are kept in localStorage.
- On sign-up, the guest's progress is merged into their account, and photos are uploaded.

**Login:** Supabase Auth with a magic link, GitHub and Google.

**Unlock flow**

1. The player clears Room 3 and reaches the sealed door.
2. They log in, or sign up, if they haven't yet. Login already proves they own the email address.
3. They tick the newsletter consent checkbox, unticked by default, and confirm.
4. A server function saves their email and consent to the database.
5. The sealed door opens and Rooms 4–10 are available right away.

**Enforced on the server, not in the UI**

- Gated room data is never in the client bundle. It is served only when the database says the player is unlocked.
- Door solutions for gated rooms, and the Room 9 clue check, are validated in server functions.

**Consent:** the newsletter checkbox is separate from creating an account. The database records when consent was given and which consent text was shown, and any email sent later must include a way to unsubscribe. Unsubscribing keeps rooms already unlocked. Making content conditional on a sign-up is a grey area under GDPR, so this needs a legal check before launch.

## Data model

Progress is stored as world state, not just "room cleared": items, clues and room state persist, because rooms connect across the house.

| Table | Key columns | Purpose |
| --- | --- | --- |
| profiles | id, nickname, created\_at | One row per user |
| newsletter\_subscribers | user\_id, email, consented\_at, consent\_version, unsubscribed\_at | Newsletter list; having a row unlocks Rooms 4–10 |
| rooms | id, order, is\_free, title | Room catalogue, readable by everyone |
| room\_content | room\_id, data (jsonb) | Interactables, puzzles, ghosts and triggers per room |
| room\_progress | user\_id, room\_id, first\_cleared\_at, best\_score, stars, secrets\_found, state (jsonb) | Per-room result and saved room state |
| player\_items | user\_id, item\_id, found\_in\_room, found\_at, used\_at | Inventory across the house, including spare batteries |
| player\_clues | user\_id, clue\_id, found\_in\_room, found\_at | Clues logged in the journal |
| ghost\_photos | user\_id, ghost\_id, room\_id, photo\_path, quality\_score, taken\_at | Ghost album; photos in Supabase Storage |

**Row Level Security**

- rooms: readable by everyone.
- room\_content: readable when the room is free, or when the player has a row in newsletter\_subscribers.
- newsletter\_subscribers: a player can read their own row; rows are written only by the sign-up server function.
- room\_progress, player\_items, player\_clues, ghost\_photos: each player reads and writes only their own rows.
- Scores and door results are written by server functions, not directly by the client, so they can be validated.
- Leaderboards: a view exposing nickname and best scores only.
- Storage: a player can read and upload only in their own photo folder.

## Technical architecture

Rooms are data, not code: a shared engine (player, lights, camera, inventory, triggers) loads a room's glTF scene plus its JSON definition, so adding a room means modelling it and writing its definition.

**App (TanStack Start)**

- Routes: title screen, mansion map, play a room, ghost album, journal, leaderboards, login.
- Server functions: load room content, save progress, validate door solutions and scores, upload photos.
- Server function: newsletter sign-up, saving the email and consent.
- Supabase client set up for server-side sessions.

**Game engine (React Three Fiber)**

- **Player controller:** first person; pointer-lock mouse look on desktop, a touch joystick and drag-to-look on mobile; collision with the room.
- **Interaction:** a raycast from the view picks the object being looked at; it shows a prompt and runs the object's action.
- **Game state:** a store for inventory, clues, room state and lights; puzzle logic as triggers and conditions read from the room definition.
- **Room loader:** fetches the definition from the server, loads the glTF, binds interactables to named nodes.

**Room definition (sketch)**

```json
{
  "id": "entrance-hall",
  "scene": "rooms/entrance-hall.glb",
  "interactables": [
    { "node": "Desk", "type": "lockable", "requires": "item:brass-key", "gives": ["item:portrait-letter"] },
    { "node": "ClockGlass", "type": "uv-reveal", "gives": ["clue:clock-time"] }
  ],
  "ghosts": [
    { "id": "wisp-1", "type": "wisp", "key": true, "drops": "item:brass-key" },
    { "id": "ink-1", "type": "ink", "secret": true }
  ],
  "exit": { "node": "LibraryDoor", "requires": "item:library-key", "to": "library" }
}
```

**Rendering highlights**

- **Flashlight:** a spotlight with shadows, plus a fake volumetric cone with dust particles inside it. Battery level drives its intensity and reach, with a noise-based flicker when low.
- **UV reveal shader:** UV-reactive materials carry a hidden texture layer, visible only inside the UV lamp's cone (position, direction and angle passed as uniforms).
- **Ghosts:** translucent emissive materials with a noise-based dissolve, driven by how long they stay in the light.
- **Mirrors:** a reflection render target; Mirror Ghosts are drawn only into the reflection.
- **Photos:** render the current view to a small JPEG, then score it from the ghost's position in the frame at the moment of the shot.
- **Renderer:** WebGPU where available, with a WebGL fallback. Quality presets (render resolution, shadows, particles) are picked automatically, with a lighter preset for phones.

**Asset pipeline**

- Rooms and props modelled in Blender, with baked lighting for static surfaces so the real-time budget goes to the flashlights.
- Exported to glTF and compressed (meshes and textures) before shipping.
- Interactables named consistently in Blender so the room definition can find them.
- Target: smooth play on a mid-range laptop.

## Art and audio

The look is spooky-cosy rather than horror: dark rooms, warm light, ghosts that are eerie but charming, so the game suits a portfolio audience.

**Visuals**

- A woodblock-print look (ukiyo-e at night): ink outlines, flat colour in a few tone steps, a limited palette and paper grain. Darkness still does most of the mood work. Details in Level 0 below.
- Colour language: warm yellow for the flashlight, cool violet for UV, pale cyan-green for ghosts.
- Each room has one signature object that sells it at a glance: the grandfather clock, the piano, the cracked mirror.
- UI kept minimal and diegetic where possible: the camera viewfinder, a paper journal.
- Every overlay shares the print style: paper panels for things to read, ink panels for the always-on HUD, vermilion seals for keys and warnings, hard offset shadows, no blur or glow.

**Audio**

- Ambient room loops: creaks, wind, a ticking clock that stops when Room 1 starts.
- Positional ghost sounds, so players can hunt by ear.
- Clear feedback sounds: camera shutter, lock clicks, item pickup, the UV lamp's hum.
- Music kept sparse, with a music-box motif that ties into the story.

## Level 0: prototype room

Level 0 is one small test room, outside the story, used to lock down how the game feels and looks before any real room is designed. It is done when the light, the camera and one ghost feel good on a laptop and on a phone in landscape.

**The room:** a small study at night. A window with moonlight, a desk with a padlocked drawer, a bookshelf, a wall mirror, a painting, a door. Three or four props are enough; placeholders are fine at first. The flashlight starts on the floor ahead of the spawn, the books on the shelf can be grabbed and thrown, and the candle on the desk can be lit and blown out (E or click) for a small warm light that works without the flashlight.

**Goals shown to the player** (title screen and the first "click to play" card): find the way out of the room, and photograph the ghosts to prove they exist.

**Mechanics in scope**

- First-person movement and look, desktop and touch (landscape), with a rotate prompt in portrait.
- Pick up the flashlight from the floor. Then light on/off, white/UV switch, battery drain with the four levels and flicker, battery packs to pick up and swap.
- Interaction: highlight, prompt, pick up, a simple item bar.
- Throwable props: grab a book, carry it, throw it. A prop is marked `throwable: true` in the room definition; books are the first.
- A three-link mini chain: UV writing on the painting shows a code, the code opens the desk drawer, the drawer holds the key, the key opens the door.
- One reflection test in the mirror.
- Camera: raise, shoot, score the photo, show it.
- One Wisp: floats, freezes in light, dissolves when photographed.

**Out of scope:** login, Supabase, saving, journal, leaderboards, the room loader. Logic is hand-written but kept in the shape of the room definition, so it can move to data later.

**Effects to try**

| Effect | What to test |
| --- | --- |
| Flashlight beam | Spotlight with a light-pattern texture, soft shadows, falloff |
| Volumetric cone | Fake cone with dust motes drifting in it |
| Battery states | Intensity and reach per level, flicker when low, sputter when empty |
| UV reveal | Hidden layer visible only inside the UV cone |
| Ghost material | Translucency, edge glow, wobble, dissolve |
| Mirror | Reflection render target, cost on mobile |
| Photo | Flash, short freeze frame, shutter sound, photo card |
| Atmosphere | Moonlight through the window, light fog, darkness when the light is off |
| Post-processing | Bloom, vignette, film grain, colour grade |
| Print look | Ink outlines from depth, flat tone bands, indigo shadow lift, paper grain; brightness lift so the unlit room stays readable |

**Look: woodblock print, ukiyo-e at night (decided Oct 7, 2026; replaces the earlier miniature diorama).** The moodboard was anime cel frames, sumi-e ink manga and ukiyo-e prints. What they share, and what carries the look: uniform ink outlines, flat colour stepped into a few tones instead of smooth shading, a tight palette (ink, indigo, paper cream, a vermilion seal, saffron) and visible paper grain. The night ukiyo-e print (indigo sky, pale moon, warm accents) is the closest match to the room: cool moonlight, warm flashlight, violet UV, pale cyan-green ghost.

It is built in post-processing, not in the materials, so every system that patches materials (UV reveal, highlight, mirror, ghost) keeps working. The chain is: tone mapping, grade, brightness lift, tone bands, indigo shadows, ink outlines, paper grain, vignette. Each step is a toggle in the debug panel and its strength a tuning value. Room assets are flat colours in the palette; see the Blender asset spec. Outside the first-person view the room summary and mansion map can be printed plans rather than dollhouse cutaways; decide when the map is designed.

**Blender assets for Level 0**

Coding starts with grey boxes, so modelling runs in parallel and never blocks it. The full list of models, sizes, names, export rules and status lives in Level 0 — Blender asset spec.

**Done when**

- [ ] Smooth on a mid-range laptop and an iPhone 15 Pro in landscape
- [ ] Finding the code with UV and opening the door feels satisfying
- [ ] Catching the Wisp feels good with mouse and with touch
- [ ] The style is chosen and documented for the real rooms (chosen: woodblock print; values still to settle on device)

## Roadmap

Build Level 0 first to settle mechanics, look and effects, then the shared engine and Room 1, then add rooms one by one; the target for Halloween is Rooms 1–3 plus accounts and the gate.

1. **Setup:** TanStack Start app, R3F scene, Supabase project, deployment.
2. **Core systems:** first-person controller with desktop and touch controls, flashlight, interaction raycast, inventory, journal, camera and photo scoring, room loader from JSON.
3. **Room 1: Entrance Hall** fully playable, white light only.
4. **Accounts and progress:** login, saving world state, guest progress merge, ghost album.
5. **Room 2: Library:** UV lamp, reveal shader, and the return visit to Room 1 (clock note, secret Ink Ghost).
6. **Room 3: Kitchen:** item combining, Poltergeist, the sealed door.
7. **Newsletter gate:** email and consent saved to the database, server-side unlock. **Launch target: October 31.**
8. **Rooms 4–10,** released one at a time; each release doubles as newsletter content.
9. **Finale:** Room 9 clue check and the Crypt boss.

## Open decisions

The core choices are made (first-person view, mobile in landscape, newsletter emails stored in the game's own database); what remains is balance and content.

- [ ] Battery balance: confirm the starting values (90 s per pack, UV twice as fast, 2–3 packs per room) in playtests
- [ ] When the mansion map with quick travel unlocks
- [ ] Story: who the family was and what happened at 3:17
- [ ] Release cadence for Rooms 4–10
- [ ] Legal check of newsletter-gated content under GDPR
