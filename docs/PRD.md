# PRD — What ships

The single source of truth for **what must be implemented**, **who owns it**, and **whether it is done**.

Design docs explain _why_ something works the way it does. This file decides _whether it ships at all_.

---

## Precedence

When two documents disagree:

1. **This PRD wins on scope** — whether a requirement is in or out.
2. **Design docs win on behaviour** — `DESIGN.md`, `ENEMIES.md`, `docs/levels/`, `docs/enemies/algorithms.md`.
3. **ADRs win on decisions** — they record why a choice was made, and they override anything older.

If this file and a design doc contradict on _how_ something behaves, the design doc is right and this file is stale. Fix this file.

A1/A2 re-verified against the implementation at commit `af8862b`.
Other PRD statuses have not been re-verified.

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

| ID  | Requirement                                                               | Pri    | Cost | Lane    | Status                                                     |
| --- | ------------------------------------------------------------------------- | ------ | ---- | ------- | ---------------------------------------------------------- |
| A1  | **One shared tank** across all colours and all uses                       | MUST   | M    | paint   | ✅ Built — all colours share one ammo reserve              |
| A2  | **Positional refill** — standing in your own paint refills the tank       | MUST   | S    | paint   | ✅ Built — automatic refill while grounded on player paint |
| A3  | **Pushback when dry** — firing on empty produces a dry click and no shot  | MUST   | S    | paint   | ✅ Built                                                   |
| A4  | **Grey slows you** and refills nothing, as a live modifier                | MUST   | S    | core    | ✅ Built — `SURFACE.grey.standSlow` (0.6), applied live in `player.js` |
| A5  | **Dry out** — no tank and no territory ends the run, and the game says so | MUST   | S    | core    | ❌ Not built                                               |
| A6  | **Submerge** — fast refill, hidden, cannot fire                           | MUST   | M    | core    | ❌ Not built                                               |
| A7  | **Partial stealth** — submerging halves detection; firing reveals         | MUST   | M    | shaders | ⚠️ Partial (#109) — awareness states, 16 m/7 m radii, last-known-position search and the turret exemption are built and tested; not yet wired to submerge or fire |
| A8  | **Scorecard** — coverage, time, dry time at level end                     | SHOULD | S    | ui      | ❌ Not built                                               |

**Acceptance for A1/A2 together:** a player who paints and stands in their own colour never needs to press a key to refill, and a player who paints and walks away can run out.

---

## B. Paint as territory

| ID  | Requirement                                                                | Pri    | Cost | Lane    | Status                              |
| --- | -------------------------------------------------------------------------- | ------ | ---- | ------- | ----------------------------------- |
| B1  | **Enemies convert your paint to grey** — the Sprayer fights your territory | SHOULD | M    | shaders | ❌ Not built                        |
| B2  | **Drainer eats painted ground** as it moves                                | MUST   | M    | shaders | ⚠️ Flag exists in config, not wired |
| B3  | Coverage is readable in the HUD as territory, not just a number            | SHOULD | S    | ui      | ⚠️ Number exists, reads as debug    |

---

## C. Colour roles

| ID  | Requirement                                                                                                                                                             | Pri    | Cost | Lane    | Status                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- | ------- | ----------------------------------------------------------------------------------------------------- |
| C1  | **Blue floor** makes enemies slide and lose steering                                                                                                                    | MUST   | —    | core    | ✅ Built                                                                                              |
| C2  | **Green pin** roots an enemy but it can still attack                                                                                                                    | MUST   | —    | core    | ✅ Built                                                                                              |
| C3  | **Red knockback** flings an enemy, and impact damages it                                                                                                                | MUST   | —    | core    | ✅ Built                                                                                              |
| C4  | **Freeze → crit window** — three blue hits, then a punishing shot                                                                                                       | SHOULD | M    | paint   | ✅ Built — 3 blue hits freeze for 2 s, next hit crits ×3, turrets excluded, frost shell shows buildup |
| C5  | **Turrets have no status procs** — positioning is the only answer                                                                                                       | MUST   | S    | shaders | ⚠️ Verify — likely procs apply today                                                                  |
| C6  | **ADS is a real tradeoff** — right mouse tightens spread and enables crits at reduced movement speed; hipfire paints a wider area and splashes every enemy in the splat | MUST   | S    | core    | ⚠️ Spread and M2 exist; crit payoff missing (C4), splash missing                                      |
| C7  | **Paintstreak meter** — coverage and kills fill a gauge, spent on a splat that claims a zone and stuns everything inside                                                | COULD  | M    | ui      | ❌ Not built. Build last of everything                                                                |

---

## D. Enemies

| ID  | Requirement                                                   | Pri    | Cost | Lane    | Status                               |
| --- | ------------------------------------------------------------- | ------ | ---- | ------- | ------------------------------------ |
| D1  | **Charger recovery** — 1.2 s vulnerable window after a charge | MUST   | S    | shaders | ❌ Not built                         |
| D2  | **Sprayer reload** — 1.2 s window, telegraphs before firing   | MUST   | S    | shaders | ⚠️ Cooldown exists, no reload window |
| D3  | **Wall-crawler climbs green paint** faster than grey          | MUST   | M    | shaders | ⚠️ Built (#115): 3.5 m/s on grey, 5.0 on green, cannot shoot on the wall |
| D4  | **Turret** — static, slow track, bursts, flankable            | MUST   | —    | shaders | ✅ Built                             |
| D5  | **Drainer** — feeding and hunting postures                    | MUST   | M    | shaders | ❌ Not built                         |
| D6  | **Stalker** — fast on your paint, slow on grey                | COULD  | M    | shaders | ❌ Not built                         |
| D7  | **Big Arm** — wave-three arena boss with three phases         | SHOULD | L    | shaders | ❌ Not built                         |
| D8  | **Siphon** — three-phase colour exam, no health bar           | SHOULD | M    | levels  | ❌ Not built                         |

**Acceptance for D1:** a player can bait a charge, sidestep, and land a full combo before the Charger recovers. If they cannot, the window is too short.

---

## E. Levels

| ID  | Requirement                                                 | Pri  | Cost | Lane   | Status                                       |
| --- | ----------------------------------------------------------- | ---- | ---- | ------ | -------------------------------------------- |
| E1  | **The Primer** — tutorial, ends with one Charger and a trap | MUST | M    | levels | ❌ Not built                                 |
| E2  | **Outskirts** — island-hopping, pillars setpiece, 4 enemies | MUST | M    | levels | ⚠️ Geometry exists, traps and pacing missing |
| E3  | **The Ascent** — mountain, terraces and climbs, turrets     | MUST | L    | levels | ❌ Stub                                      |
| E4  | **Last Colour** — three chambers, waves, Big Arm, Siphon    | MUST | L    | levels | ❌ Stub                                      |
| E5  | **Level select** — any level reachable from the pause menu  | MUST | S    | ui     | ✅ Built (#78) — pause-menu list, fed by the one registry        |
| E6  | Encounter gates — exit sealed until the arena is clear      | MUST | —    | levels | ✅ Built                                     |
| E7  | Fail forward — a fall costs time, not the run               | MUST | S    | levels | ⚠️ Partial                                   |

---

## F. Traps

| ID  | Requirement                                                   | Pri    | Cost | Lane   | Status                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------- | ------ | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Spike pit** — telegraphed, damages, does not instantly kill | SHOULD | S    | levels | ⚠️ Helper built and tested (`trap-volume.js`), **no hazard placed**: the pit belongs to the Primer's corridor (E1), where it cannot be walked around. Outskirts' traps are the B blade, the C vent and the waste edge |
| F2  | **One paint-solvable trap** — a hazard with a colour answer   | SHOULD | S    | levels | ❌ Not built                                                                                                                                                                                                          |
| F3  | Trap density per level per `docs/levels/`                     | COULD  | S    | levels | ❌ Not built                                                                                                                                                                                                          |

---

## G. Story and delivery

| ID  | Requirement                                       | Pri             | Cost | Lane | Status       |
| --- | ------------------------------------------------- | --------------- | ---- | ---- | ------------ |
| G1  | **Sergeant briefing** — one still in the tutorial | SHOULD          | S    | ui   | ❌ Not built |
| G2  | **One line per level** in a comms bar             | SHOULD          | S    | ui   | ❌ Not built |
| G3  | Dialogue skippable and never during combat        | MUST (if G1/G2) | S    | ui   | ❌ Not built |

---

## H. UI and UX

| ID  | Requirement                                                                       | Pri    | Cost | Lane | Status                |
| --- | --------------------------------------------------------------------------------- | ------ | ---- | ---- | --------------------- |
| H1  | HUD — ammo, colour, standing-on, coverage, health, hitmarker                      | MUST   | —    | ui   | ✅ Built              |
| H2  | Pause, options, restart, credits                                                  | MUST   | —    | ui   | ✅ Built              |
| H3  | Per-level win and lose screens                                                    | MUST   | S    | ui   | ⚠️ Generic text today |
| H4  | Minimap                                                                           | MUST   | —    | ui   | ✅ Built              |
| H5  | Loading screen                                                                    | MUST   | —    | ui   | ✅ Built              |
| H6  | **Killfeed** — a line when an enemy dies, naming it and the colour that killed it | SHOULD | S    | ui   | ❌ Not built          |

---

## I. Audio

| ID  | Requirement                       | Pri    | Cost | Lane | Status       |
| --- | --------------------------------- | ------ | ---- | ---- | ------------ |
| I1  | Fire, splat, hit, kill, win, lose | MUST   | —    | ui   | ✅ Built     |
| I2  | Gate opening                      | SHOULD | S    | ui   | ❌ Not built |
| I3  | Enemy attack telegraph            | MUST   | S    | ui   | ⚠️ Verify    |
| I4  | Painting has a sound              | SHOULD | S    | ui   | ❌ Not built |

---

## J. Visual

| ID  | Requirement                                                | Pri    | Cost | Lane    | Status                                                                           |
| --- | ---------------------------------------------------------- | ------ | ---- | ------- | -------------------------------------------------------------------------------- |
| J1  | **Grey-to-colour decor reveal** near painted ground        | SHOULD | M    | levels  | ✅ Built in `decor.js` — palette, instanced buckets and delayed reveal all exist |
| J2  | Per-level mood — fog, light, palette                       | MUST   | S    | levels  | ⚠️ Outskirts only                                                                |
| J3  | Readability — enemies visible from where you fight         | MUST   | S    | levels  | ❌ Not verified                                                                  |
| J4  | Enemies distinguishable by silhouette and telegraph colour | MUST   | S    | shaders | ❌ Not verified                                                                  |

---

## K. Performance and correctness

| ID  | Requirement                                              | Pri  | Cost | Lane    | Status            |
| --- | -------------------------------------------------------- | ---- | ---- | ------- | ----------------- |
| K1  | A painted floor is one mesh, one material, one draw call | MUST | —    | shaders | ✅ Built          |
| K2  | No per-frame allocation in the render loop               | MUST | —    | core    | ✅ Tested         |
| K3  | Levels dispose geometry, materials and uniform textures  | MUST | —    | levels  | ✅ Pattern exists |
| K4  | `npm test` green                                         | MUST | —    | all     | ✅ 175 passing    |

---

## L. Delivery

| ID  | Requirement                                       | Pri  | Cost | Lane | Status                      |
| --- | ------------------------------------------------- | ---- | ---- | ---- | --------------------------- |
| L1  | Builds, zips and plays from the department server | MUST | S    | ui   | ⚠️ Verify before submission |
| L2  | Every CC-BY asset credited in-game                | MUST | S    | ui   | ⚠️ Partial                  |
| L3  | Relative asset paths, lowercase filenames         | MUST | —    | all  | ✅                          |

---

## M. Models

| ID  | Requirement                                | Pri     | Cost | Lane    | Status                                           |
| --- | ------------------------------------------ | ------- | ---- | ------- | ------------------------------------------------ |
| M1  | Player character, one, animated            | MUST    | —    | shaders | ✅ `soldier-swat.glb`                            |
| M2  | Second playable character                  | **Cut** | —    | —       | ⛔ Cut — one character ships                     |
| M3  | Charger and Sprayer models                 | MUST    | —    | shaders | ✅ Built                                         |
| M4  | Wall-crawler model                         | MUST    | S    | shaders | ✅ Validated and spawned in level 1 (#114). Climb behaviour is #115's |
| M5  | Turret models                              | MUST    | S    | shaders | ❌ Missing                                       |
| M6  | Drainer model                              | MUST    | S    | shaders | ❌ Missing                                       |
| M7  | Charger zombie model                       | SHOULD  | S    | shaders | ❌ Missing                                       |
| M8  | Big Arm model                              | SHOULD  | S    | shaders | ❌ Missing                                       |
| M9  | Gun viewmodel                              | MUST    | —    | paint   | ✅ `pistol.glb`                                  |
| M10 | Military base props                        | MUST    | M    | levels  | ❌ Nothing exists for Last Colour                |
| M11 | Forest props                               | MUST    | —    | levels  | ✅ 32 megakit GLBs                               |
| M12 | Every CC-BY asset credited in-game         | MUST    | S    | ui      | ⚠️ Partial                                       |
| M13 | One GLB validated before any bulk download | MUST    | —    | shaders | ⚠️ Validated on the soldiers and the wall-crawler (#114); turrets unproven |
| M14 | Stalker model — **no asset sourced yet**   | SHOULD  | S    | shaders | ❌ Missing. The only enemy with no asset chosen  |

**Missing models are the largest single visual risk.** The forest is dressed; every enemy after the first level and the entire final level are not. `docs/ASSETS.md` has the pipeline rule for this: validate one, never bulk.

## N. Animation

The player ships **five clips** and the code wires **two states**. This is why the game reads as unfinished the moment you jump.

| ID   | Requirement                            | Pri    | Cost | Lane           | Status                                      |
| ---- | -------------------------------------- | ------ | ---- | -------------- | ------------------------------------------- |
| AN1  | Player idle and run                    | MUST   | —    | shaders        | ✅ Built                                    |
| AN2  | Player armed idle and run              | MUST   | —    | shaders        | ✅ Built                                    |
| AN3  | Player death                           | MUST   | —    | shaders        | ✅ Built                                    |
| AN4  | **Player airborne — jump, fall, land** | MUST   | S    | shaders + core | 🟡 Clips ready (#121): jump start, loop and land drive the player rig. The pack has no fall clip; the state machine that plays them is #82 |
| AN5  | Player climb                           | SHOULD | S    | shaders        | ❌ Not built, and the animation library has no climb clip (#121), so #122 ships a documented fallback |
| AN6  | Player ADS pose or transition          | SHOULD | S    | shaders        | ⚠️ Built (#124): `Idle_Gun_Pointing` on aim, `Gun_Shoot` standing / `Run_Shoot` moving, `HitRecieve` per hit. The armed idle used to BE the aim pose, which is why aiming had no body language |
| AN7  | Enemy walk cycle                       | SHOULD | M    | shaders        | ⚠️ Faked bob — the GLBs have no leg bones   |
| AN8  | Enemy melee attack                     | MUST   | S    | shaders        | ❌ The Charger is animated with rifle clips |
| AN9  | Enemy death                            | MUST   | S    | shaders        | ❌ No clip exists in the files              |
| AN10 | Enemy hit reaction                     | MUST   | —    | shaders        | ⚠️ Emissive tint only                       |
| AN11 | Gun recoil                             | MUST   | —    | paint          | ✅ Built                                    |
| AN12 | Gun movement bob                       | COULD  | S    | paint          | ⚠️ Built in main.js (#124) rather than `paint/`, to stay inside that issue's file list: the first-person gun sways with speed |

**Acceptance for AN4:** the player's animation must change when they leave the ground and again when they land, driven by the same ground state the physics already tracks. No new physics, only a new state read.

**Acceptance for AN9:** a killed enemy plays a death reaction before being removed. If no clip exists in the source files, this becomes a rigged fall or a scaled collapse — decided once and applied to every enemy.

---

## Out of scope

Not shipping, regardless of how good the idea is. If someone proposes one, point here.

- Jetpack — makes every gap trivial and forces a level rewrite
- Vehicles — removes paint from a paint game
- A hub level — a fifth level's worth of work for no gameplay
- New enemy types beyond the Stalker
- A second playable character — cut; one character ships
- Two-of-three loadout as the default
- Health bars on enemies
- Cutscenes or exposition walls
- Paint combining / a fourth colour
- Mocap, IK, or facial animation — the rigs do not support it and nothing needs it
- Realistic humanoid retargeting between asset families
- Bulk asset downloads — one validated GLB at a time, per `docs/ASSETS.md`

---

## Open questions

**None.** All seven were closed on 2026-10-24, and the reasoning is in `docs/DECISIONS.md`.

| #   | Question                        | Answer                                                                |
| --- | ------------------------------- | --------------------------------------------------------------------- |
| 1   | Is submerge (A6/A7) in?         | **In**, and upgraded to MUST                                          |
| 2   | Is paintstreak in?              | **In**, as C7, built last                                             |
| 3   | Big Arm or Siphon?              | **Both**, in sequence — Big Arm is wave three, the Siphon is the exam |
| 4   | Is J1's decor reveal built?     | **Yes**, fully — it was marked partial in error                       |
| 5   | Does the second character ship? | **Cut** — one character                                               |
| 6   | Do enemy walk cycles ship?      | **Procedural motion only** — the enemy GLBs have zero joints          |
| 7   | Which gun model?                | **`pistol.glb`**                                                      |

---

## How to use this file

- **Picking up work:** take a row with a `MUST`, check the lane matches yours, read the linked design doc, then write the acceptance check first.
- **Cutting scope:** cut from the bottom of MoSCoW, never from `MUST`. If you must cut a `MUST`, change this file in the same commit — a silent cut is how the docs drifted last time.
- **Finishing work:** update the Status column in the same commit that finishes it.
