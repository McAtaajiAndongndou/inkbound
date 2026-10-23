# PRD — What ships

The single source of truth for **what must be implemented**, **who owns it**, and **whether it is done**.

Design docs explain *why* something works the way it does. This file decides *whether it ships at all*.

---

## Precedence

When two documents disagree:

1. **This PRD wins on scope** — whether a requirement is in or out.
2. **Design docs win on behaviour** — `DESIGN.md`, `ENEMIES.md`, `docs/levels/`, `docs/enemies/algorithms.md`.
3. **ADRs win on decisions** — they record why a choice was made, and they override anything older.

If this file and a design doc contradict on *how* something behaves, the design doc is right and this file is stale. Fix this file.

Status column verified against the code at commit `b3a19b3`. **Re-verify before trusting it** — it will drift.

---

## Definition of submission

The game is submittable when **all of these are true**:

- [ ] Plays end to end from the department server, in Chrome, with the console clean
- [ ] Four levels selectable and completable: Primer, Outskirts, Ascent, Last Colour
- [ ] Restart works without refreshing the page
- [ ] Pause, options and credits reachable in-game
- [ ] Every CC-BY asset is credited
- [ ] `npm test` green
- [ ] `npm run build` → `npm run serve:dist` → played through, not just built

---

## MoSCoW

- **MUST** — the game is not submittable without it
- **SHOULD** — a large quality win; cut only if time forces it
- **COULD** — first things cut

## Cost

- **S** — under a day
- **M** — one to three days
- **L** — a week or more, and risky

---

## A. The loop

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| A1 | **One shared tank** across all colours and all uses | MUST | M | paint | ❌ Not built — ammo is per colour |
| A2 | **Positional refill** — standing in your own paint refills the tank | MUST | S | paint | ❌ Not built — F key |
| A3 | **Pushback when dry** — firing on empty produces a dry click and no shot | MUST | S | paint | ✅ Built |
| A4 | **Grey slows you** and refills nothing, as a live modifier | MUST | S | core | ❌ Not built — `SURFACE.grey.speedScale` is 1.0 |
| A5 | **Dry out** — no tank and no territory ends the run, and the game says so | MUST | S | core | ❌ Not built |
| A6 | **Submerge** — fast refill, hidden, cannot fire | SHOULD | M | core | ❌ Not built |
| A7 | **Partial stealth** — submerging halves detection; firing reveals | SHOULD | M | core | ❌ Not built |
| A8 | **Scorecard** — coverage, time, dry time at level end | SHOULD | S | ui | ❌ Not built |

**Acceptance for A1/A2 together:** a player who paints and stands in their own colour never needs to press a key to refill, and a player who paints and walks away can run out.

---

## B. Paint as territory

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| B1 | **Enemies convert your paint to grey** — the Sprayer fights your territory | SHOULD | M | shaders | ❌ Not built |
| B2 | **Drainer eats painted ground** as it moves | MUST | M | shaders | ⚠️ Flag exists in config, not wired |
| B3 | Coverage is readable in the HUD as territory, not just a number | SHOULD | S | ui | ⚠️ Number exists, reads as debug |

---

## C. Colour roles

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| C1 | **Blue floor** makes enemies slide and lose steering | MUST | — | core | ✅ Built |
| C2 | **Green pin** roots an enemy but it can still attack | MUST | — | core | ✅ Built |
| C3 | **Red knockback** flings an enemy, and impact damages it | MUST | — | core | ✅ Built |
| C4 | **Freeze → crit window** — three blue hits, then a punishing shot | SHOULD | M | paint | ❌ Not built |
| C5 | **Turrets have no status procs** — positioning is the only answer | MUST | S | shaders | ⚠️ Verify — likely procs apply today |

---

## D. Enemies

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| D1 | **Charger recovery** — 1.2 s vulnerable window after a charge | MUST | S | shaders | ❌ Not built |
| D2 | **Sprayer reload** — 1.2 s window, telegraphs before firing | MUST | S | shaders | ⚠️ Cooldown exists, no reload window |
| D3 | **Wall-crawler climbs green paint** faster than grey | MUST | M | shaders | ⚠️ Flag exists, not wired |
| D4 | **Turret** — static, slow track, bursts, flankable | MUST | — | shaders | ✅ Built |
| D5 | **Drainer** — feeding and hunting postures | MUST | M | shaders | ❌ Not built |
| D6 | **Stalker** — fast on your paint, slow on grey | COULD | M | shaders | ❌ Not built |
| D7 | **Big Arm** — wave-three arena boss with three phases | SHOULD | L | shaders | ❌ Not built |
| D8 | **Siphon** — three-phase colour exam, no health bar | SHOULD | M | levels | ❌ Not built |

**Acceptance for D1:** a player can bait a charge, sidestep, and land a full combo before the Charger recovers. If they cannot, the window is too short.

---

## E. Levels

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| E1 | **The Primer** — tutorial, ends with one Charger and a trap | MUST | M | levels | ❌ Not built |
| E2 | **Outskirts** — island-hopping, pillars setpiece, 4 enemies | MUST | M | levels | ⚠️ Geometry exists, traps and pacing missing |
| E3 | **The Ascent** — mountain, terraces and climbs, turrets | MUST | L | levels | ❌ Stub |
| E4 | **Last Colour** — three chambers, waves, Big Arm, Siphon | MUST | L | levels | ❌ Stub |
| E5 | **Level select** — any level reachable from the pause menu | MUST | S | ui | ❌ Not built |
| E6 | Encounter gates — exit sealed until the arena is clear | MUST | — | levels | ✅ Built |
| E7 | Fail forward — a fall costs time, not the run | MUST | S | levels | ⚠️ Partial |

---

## F. Traps

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| F1 | **Spike pit** — telegraphed, damages, does not instantly kill | SHOULD | S | levels | ❌ No trap system |
| F2 | **One paint-solvable trap** — a hazard with a colour answer | SHOULD | S | levels | ❌ Not built |
| F3 | Trap density per level per `docs/levels/` | COULD | S | levels | ❌ Not built |

---

## G. Story and delivery

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| G1 | **Sergeant briefing** — one still in the tutorial | SHOULD | S | ui | ❌ Not built |
| G2 | **One line per level** in a comms bar | SHOULD | S | ui | ❌ Not built |
| G3 | Dialogue skippable and never during combat | MUST (if G1/G2) | S | ui | ❌ Not built |

---

## H. UI and UX

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| H1 | HUD — ammo, colour, standing-on, coverage, health, hitmarker | MUST | — | ui | ✅ Built |
| H2 | Pause, options, restart, credits | MUST | — | ui | ✅ Built |
| H3 | Per-level win and lose screens | MUST | S | ui | ⚠️ Generic text today |
| H4 | Minimap | MUST | — | ui | ✅ Built |
| H5 | Loading screen | MUST | — | ui | ✅ Built |

---

## I. Audio

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| I1 | Fire, splat, hit, kill, win, lose | MUST | — | ui | ✅ Built |
| I2 | Gate opening | SHOULD | S | ui | ❌ Not built |
| I3 | Enemy attack telegraph | MUST | S | ui | ⚠️ Verify |
| I4 | Painting has a sound | SHOULD | S | ui | ❌ Not built |

---

## J. Visual

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| J1 | **Grey-to-colour decor reveal** near painted ground | SHOULD | M | levels | ⚠️ Partial — decor reacts, reveal unconfirmed |
| J2 | Per-level mood — fog, light, palette | MUST | S | levels | ⚠️ Outskirts only |
| J3 | Readability — enemies visible from where you fight | MUST | S | levels | ❌ Not verified |
| J4 | Enemies distinguishable by silhouette and telegraph colour | MUST | S | shaders | ❌ Not verified |

---

## K. Performance and correctness

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| K1 | A painted floor is one mesh, one material, one draw call | MUST | — | shaders | ✅ Built |
| K2 | No per-frame allocation in the render loop | MUST | — | core | ✅ Tested |
| K3 | Levels dispose geometry, materials and uniform textures | MUST | — | levels | ✅ Pattern exists |
| K4 | `npm test` green | MUST | — | all | ✅ 144 passing |

---

## L. Delivery

| ID | Requirement | Pri | Cost | Lane | Status |
|---|---|---|---|---|---|
| L1 | Builds, zips and plays from the department server | MUST | S | ui | ⚠️ Verify before submission |
| L2 | Every CC-BY asset credited in-game | MUST | S | ui | ⚠️ Partial |
| L3 | Relative asset paths, lowercase filenames | MUST | — | all | ✅ |

---

## Out of scope

Not shipping, regardless of how good the idea is. If someone proposes one, point here.

- Jetpack — makes every gap trivial and forces a level rewrite
- Vehicles — removes paint from a paint game
- A hub level — a fifth level's worth of work for no gameplay
- New enemy types beyond the Stalker
- Two-of-three loadout as the default
- Health bars on enemies
- Cutscenes or exposition walls
- Paint combining / a fourth colour

---

## Open questions

| # | Question | Blocks |
|---|---|---|
| 1 | Is **submerge** (A6/A7) in for submission or after? | How much of the loop the player feels |
| 2 | Is **paintstreak** in at all? | UI work, and the climax |
| 3 | Does **Big Arm** ship, or does Last Colour end on the Siphon? | Level 3 scope |
| 4 | Is **J1's decor reveal** actually working, or does it need building? | A `SHOULD` that may be a `MUST` for the story |

---

## How to use this file

- **Picking up work:** take a row with a `MUST`, check the lane matches yours, read the linked design doc, then write the acceptance check first.
- **Cutting scope:** cut from the bottom of MoSCoW, never from `MUST`. If you must cut a `MUST`, change this file in the same commit — a silent cut is how the docs drifted last time.
- **Finishing work:** update the Status column in the same commit that finishes it.
