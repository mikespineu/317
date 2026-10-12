# 3.17 — Level 2 scenario: the Library

Oct 8, 2026 · companion to [`game-design-document.md`](./game-design-document.md), [`level-1-implementation.md`](./level-1-implementation.md) and [`level-1-blender-asset-spec.md`](./level-1-blender-asset-spec.md)

Level 2 is Room 2 of the mansion, the **Library**: free, about 9 minutes on a first play. It is the room where the **UV lamp** arrives and invisible ink becomes a puzzle, and where two new ghosts appear: the **Mimic** (disguised as an object) and the **Ink Ghost** (visible only under UV). It also plants the clue that sends the player back to the hall.

This is the scenario: what happens, in what order, what the player learns, and what the room must contain. It is not the coding plan or the Blender spec; those follow once the scenario is agreed (§10 lists what they will have to cover). Names in backticks are proposals, in the same style as Level 1, so the spec can adopt them.

---

## 1. The room in one line

Enter → the **Mimic** hides among the reading-table books, photograph it and it drops the **UV lamp** → sweep the room: a message above the fireplace points back to the hall, and **handprints** glow on four books → the books' spines carry **invisible digits**, read top shelf to bottom → the code opens the **hidden panel** behind them → the **Kitchen key** → the service door.

**Goal shown to the player:** find the key to the Kitchen and open the service door at the back of the Library.

**What the room teaches, in order:** the Mimic's twitch and the light-freeze (a new ghost, but the same camera skill as the Wisp) → switching to UV and sweeping instead of looking → following a trail → reading a code that exists only under UV → paying for UV with the battery.

**Tone:** quieter than the hall. Dust, paper, a moon through a tall window. The Ink Ghost is the first ghost that feels like someone who lived here.

---

## 2. Setting and layout

The reading room of the house, entered from the hall through the door the player opened in Level 1. A long room with four stacks, a reading table in the middle, the librarian's desk near the entrance, a dead fireplace on the far wall, and a service door at the back, behind a rolling ladder.

| | |
| --- | --- |
| Size | 6.0 × 8.0 m, 3.2 m ceiling (taller than the study and the hall: shelves go up) |
| Entry | South wall, the hall's Library door. The player spawns just inside, facing north |
| Exit | North wall, `Interact_Service_Door`, locked, needs `item:kitchen-key`; beyond it the Kitchen (Room 3) |
| Light | A tall arched window on the east wall: cool moon, a patch on the floor. No other light |
| Props that already exist as mechanics | Candle (lit on the reading table), throwable books, a battery pack to find, the UV switch (after step 2) |

```
                         N (service door)
        ┌────────────────[ ]────────────────────┐
        │  ▓▓  stack A      fireplace     stack C ▓▓ │
        │  ▓▓   (marked)    + mantel      (marked)▓▓ │ ← arched window (E)
  W     │                                        │
        │  ▓▓  stack B   [ reading table ]  stack D ▓▓ │
        │  ▓▓   (marked)   4 books, candle   (marked)▓▓│
        │      ladder ═══                        │
        │            [ librarian's desk ]        │
        └───────────────[ ]──────────────────────┘
                         S (from the hall)
```

Four stacks, each holding **one marked book** (§5). The ladder rolls on a rail along the north wall and half-blocks the service door; it can be pushed aside, which is only scenery work (no puzzle).

---

## 3. Items, flags and clues

| Id | What | Where |
| --- | --- | --- |
| `item:uv-lamp` | The UV lamp. Picking it up sets `hasUv`; `Q` does nothing before that | Dropped by the Mimic |
| `item:kitchen-key` | Opens the service door | Inside the hidden panel |
| `item:battery` ×3 | Battery packs | Librarian's desk drawer; hollow dictionary on stack B; inside the hidden panel |
| `clue:hall-message` | "The hall remembers what the clock forgot." | UV writing over the fireplace; the journal logs it as a lead, and it enables the clock note back in the hall |
| `clue:library-code` | The four digits | The UV spines, one `clue:library-digit-N` each |
| `clue:read-top-down` | "Always read the stacks from the top shelf down." | The lending ledger on the librarian's desk |
| `flag:mimic-caught` | The Mimic was photographed | Gives `item:uv-lamp` |
| `flag:panel-open` | The hidden panel is open | Shows the key |
| `flag:diary-found` | The secret diary page was read | Counts as the room's one secret |

The hidden-panel code is a placeholder, **7-2-0-5**; any four digits work, the point is that it is read from four books.

---

## 4. The chain

Eight links. Links 1 to 3 use only the white light; 4 to 8 need the UV lamp.

| # | Player does | Teaches | Unlocks |
| --- | --- | --- | --- |
| 1 | Enters. The light carries over from the hall, battery as it was. A pack lies on the librarian's desk, so nobody starts the room dry | The battery carries over; the room is bigger and quieter | The room |
| 2 | Reads the **lending ledger** on the desk. The last entry is struck out, with a note: *"The reading lamp is kept where the books keep their secrets. Always read the stacks from the top shelf down."* Logs `clue:read-top-down` | Reading the room; a plain-light clue for later | The lead |
| 3 | **Finds the Mimic.** Four books lie on the reading table; one twitches every few seconds. Hold the white light on it: it freezes, shows its true shape, and the photo dissolves it. It drops the **UV lamp** | The Mimic; the same freeze-and-shoot as the Wisp, with a new "spot the odd one" step | `item:uv-lamp`, `Q` works |
| 4 | **Switches to UV and sweeps.** Above the fireplace: *"The hall remembers what the clock forgot."* Handprints glow on four books, one per stack. The Ink Ghost becomes visible, drifting along the stacks | UV is for searching, not seeing; sweep, don't stare; UV drains twice as fast | `clue:hall-message`; the four marked books |
| 5 | **Reads the marked books.** Each spine has one UV digit inside the handprint. Top shelf to bottom gives the order | Invisible ink as a code; following the ledger's rule | The four digits |
| 6 | **Pulls the marked books out** (they are grabbable and throwable props). Behind them: a **hidden panel** with a four-digit lock | Using the books; the compartment is behind the clue | `Interact_Hidden_Panel` |
| 7 | **Enters 7-2-0-5.** The panel opens: a diary page, a battery pack and the **Kitchen key** | The padlock UI again, now with a code the player assembled | `item:kitchen-key` |
| 8 | **Uses the key on the service door.** The ladder is pushed aside; the door opens | Completion | Room complete |

**Optional, off the chain**

- **The Ink Ghost** (§6): photograph it under UV for the second star.
- **The diary page** (a story fragment) in the hidden panel: reading it is the room's secret. It is inside the panel anyway, so a player who opens the panel finds it; a player who only wants the key may not stop to read it.
- **The hall message** is a lead rather than a secret. It is logged for the journal, and it is what makes Room 1's clock note readable on the return visit (§8).

### Dead ends and safety

- **A thrown marked book** can land somewhere awkward. Its UV digit stays readable wherever it lands, and each digit is logged to the clue list the first time the UV beam hits it, so the code is never lost.
- **The Mimic gets away.** If the light leaves it, it re-disguises as one of five fixed objects (the four books, a stool). It cannot leave the table area, so it can always be found again.
- **UV battery.** About 60 to 90 seconds of UV sweeping completes the room. With three packs in the room and the carry-over, a player who does not waste UV is never stranded; the emergency pack rule still applies.
- **UV before the lamp.** Before the lamp, `Q` does nothing, as `F`, `Q` and `R` do nothing before the flashlight in Level 0. Whether it should say something is an open question (§12).

---

## 5. The marked books

One book on each stack carries a handprint and one invisible digit.

| Stack | Shelf (top to bottom) | Digit | Spine text in white light |
| --- | --- | --- | --- |
| C (NE) | Top | 7 | *Vol. VII, Marginalia* |
| A (NW) | Second | 2 | *Vol. II, Wills & Deeds* |
| D (SE) | Third | 0 | *Vol. 0, Index* (the odd one out) |
| B (SW) | Bottom | 5 | *Vol. V, Household Accounts* |

Top shelf to bottom reads **7-2-0-5**. The plain spines are a quiet cross-check: the volume numbers match the digits, so a player who finds three digits can guess the fourth. The handprints are the Ink Ghost's: it handled these four books. Following its drift along the stacks leads to the same four places, so a player who watches the ghost finds the books too.

---

## 6. The ghosts

| | **Mimic** | **Ink Ghost** |
| --- | --- | --- |
| Role | Key ghost: drops the UV lamp | Optional, scores; the one the handprints belong to |
| Visible | Always, but as an ordinary object | Only inside the UV cone; invisible in white light |
| Behaviour | Sits disguised; **twitches** (a small shake and a faint scrape) every 5 to 8 s. In white light for 0.6 s it freezes and shows its true shape for 3 s. If the light leaves it, it re-disguises, possibly as a different object | Drifts slowly along the stacks, touching books. Slows when UV hits it. Does not flee |
| How to catch | Spot the object that twitches, hold the light on it, shoot while frozen | Sweep UV until it appears, keep it in the cone, shoot |
| Base score | 150 | 200 |
| Photo "lit" | White beam | UV beam. A weaker battery gives a thinner cone and a lower score, as everywhere |
| Secret | No | No (the secret one is in the hall, see §8) |

The Mimic is the room's key ghost, which the design allows at most once per room. A player who cannot manage the photo is not stuck forever: the Mimic stays on the table, and the lamp is the only thing it guards, so the room can always be finished with patience.

---

## 7. Hints

Each link has up to three hints in the journal; each used hint costs points. The in-game **guide label** stays for the first step of each phase only, as in Level 1.

| Link | Hint 1 | Hint 2 | Hint 3 |
| --- | --- | --- | --- |
| 2 → 3 | "The ledger mentions a lamp." | "Something on the reading table is not a book." | "Hold the light on the book that moves." |
| 4 | "The lamp shows more than the light does." | "Sweep it slowly across the shelves and the fireplace." | "The books that were handled glow." |
| 5 | "Read the digits in the order the ledger says." | "Top shelf first." | "7, 2, 0, 5." |
| 6 | "Something is hidden behind the marked books." | "Take them off the shelf." | "A panel in the wall, with four digits." |

The guide label's own lines, in order: *"Something is wrong with one of the books."* (until the Mimic is caught), *"Press Q to switch to UV, then sweep the room."* (once the lamp is held), and the battery lines from Level 0 when the light is low.

---

## 8. Cross-room: the clock thread

This room is the second step of the clock thread (hall → library → hall → crypt).

1. The UV message over the fireplace, *"The hall remembers what the clock forgot."*, is logged as `clue:hall-message`.
2. Setting it enables, in Room 1's definition, the entries Level 1 left disabled: the clock note under UV (3:17 and a symbol), and the spawn of the secret Ink Ghost near the clock.
3. The Library's complete card shows **"secrets 1 of 1"** only if the diary page was read, and adds **"a lead in the hall"** whenever the message was seen. The hall's own card changes from "secrets 0 of 2" to count the two it can now give.
4. Going back is not forced. The door between rooms stays open (cleared rooms stay open).

The diary page is the story fragment for this room: a few lines, readable in seconds.

> *"He asked me to stop every clock, so the night would not end. I did. Something laughed on the stairs, and then it was always 3:17."*

---

## 9. Scoring, stars and time

| | |
| --- | --- |
| Par time | 9:00 |
| Ghosts | Mimic 150, Ink Ghost 200, each × photo quality |
| Star 1 | Open the service door |
| Star 2 | Photograph both the Mimic and the Ink Ghost |
| Star 3 | No hints used, and under 9:00 |
| Secrets | 1 (the diary page) |

All numbers are starting points for the first playtests.

---

## 10. Look, sound and what the build will need

**Look.** Woodblock print, as everywhere. The Library is warmer than the hall: paper cream, deep teal and plum book spines in flat colour, saffron where the candle reaches, a pale moon patch. **UV ink glows violet**, with a flat, hard-edged cone so the sweep reads as a print effect. The handprints are drawn as hands, not smudges, so they read at a glance.

**Sound.** Page rustle, a dry creak, a faint scrape when the Mimic twitches, and for the Ink Ghost a quiet pen-scratch that grows as it nears. The UV hum already exists. Room tone: a low, still hall of paper, with a clock that is not ticking.

**What the build will need, beyond what exists today** (proposals for the coding plan and the Blender spec):

- **A UV lamp item and a `hasUv` flag**, like `hasLight`, so `Q` is inert before the lamp is held and the UV touch button is hidden. In Level 1 this switch is off for the whole room (`lights.uv: false`); here it starts off and turns on at pickup.
- **A Mimic ghost type:** a disguised mesh with a twitch, a freeze that reuses the Wisp's light-hold timer, and a `drops` entry. The room definition needs a list of disguise spots.
- **An Ink Ghost ghost type:** the Wisp's brain and cloth, with its material faded by the shared UV mask so it is visible only inside the UV cone, plus a per-ghost wander path along the stacks.
- **UV text as data:** generalise the painting's reveal into definition entries (`uvText`: node, image, clue to log), used for the message, the four spine digits and the handprints.
- **Four marked books as throwable props**, and a hidden panel (`Interact_Hidden_Panel`) whose lock UI is the existing padlock with four wheels.
- **A ledger and a diary page as readable notes**, the Level 1 note overlay.
- **A rolling ladder** as a scenery push (or just two states: blocking and aside).
- **Room loading and carry-over:** reaching `/play?room=library` from the hall with the battery, spares, items and flags intact. Level 1's loader takes a room from the URL; the carry-over is not built yet (the mansion state and the journal are out of scope until after the levels).
- **Strings in both languages.** Every line in this document is English only; Polish goes in `pl.ts`, with the accusative forms for the new item and prop names (`uv-lamp`, `kitchen-key`, the books).

Blender names to reserve now: `Interact_Service_Door`, `Interact_Hidden_Panel`, `Interact_Ledger`, `Pickup_Kitchen_Key`, `Pickup_UV_Lamp` (placed by the Mimic's drop, not in the `.glb`), `Prop_MarkedBook_A` to `_D` (axis-aligned, base-centre origin), `Spawn_Player`, `Spawn_Mimic_1` to `_5`, `Spawn_InkGhost`, `Collider_*`.

---

## 11. Playtest checks

- [ ] A first-time player reaches the open service door in about 9 minutes, 12 at most, with no dead end.
- [ ] The Mimic's twitch is noticed within a minute. If not, lengthen its shake or move it closer to the door.
- [ ] Players sweep with UV rather than staring at one wall. If most hold still, widen the cone or add a trail.
- [ ] The marked books are found without hint 3 by most players. If not, make the handprints larger.
- [ ] The hall message is noticed and understood as "go back": ask players where they think it points.
- [ ] Battery: nobody is stranded before the panel; at least one player swaps a pack during a UV sweep.
- [ ] The room is smooth on a mid-range laptop and an iPhone 15 Pro in landscape, in the worst view (UV on, Ink Ghost visible, candle lit).

---

## 12. Open questions

- [ ] Is the Mimic as the key ghost too punishing for a player who finds ghost photos hard? Alternative: the lamp sits in a drawer and the Mimic is optional, which breaks the "UV arrives through a ghost" beat.
- [ ] Should the ledger's rule ("read from the top shelf down") be on the desk, or itself a UV clue, to make the first sweep matter more?
- [ ] One diary page per room is the plan; is a four-line fragment readable enough on a phone?
- [ ] Should pressing `Q` before the lamp say something ("no UV light yet"), or stay silent?
- [ ] Do the books need an inspect mode (rotate to read the spine), or is a UV digit visible from the shelf enough?
- [ ] Who is the Ink Ghost? The hall's portraits are the family; the stacks hint at the librarian. Decide before the Blender spec so the handprints and the diary agree.
