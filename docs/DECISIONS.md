# Decision Ledger

Append-only. Every settled design decision goes here, dated, with the reasoning intact.

The three decisions that were **hard to reverse, surprising, and the result of a real trade-off** have their own ADR in `docs/adr/` — this ledger points at them rather than repeating them.

If a decision here contradicts the code, the decision wins and the code is a bug. If two entries here contradict each other, the **later** entry wins and the earlier one should be struck through, not deleted.

---

## 2026-10-06 — enemy and combat rules

- **ADS:** right-click aims — third-person zooms toward first-person, tighter spread, ~50% move speed, lower sensitivity. **V** still toggles free first-person. ADS borrows FPV; it is not a separate mechanic.
- **Cast per level:** L1 = KolosStudios soldiers (Charger melee, Sprayer ranged). L2 = wall-crawler + turret. L3 = zombies + Big Arm.
- **Two playable characters:** cosmetic only, no gameplay divergence, shared animations.
- **Story delivery:** environmental, no text walls. *(Superseded 2026-10-23: the sergeant now speaks.)*
- **Megabonk movement** (slides, super-jump, bunnyhop): deferred post-beta. Blue ramps already slide, which is the cheap version.
- **New or combined colours:** three for beta. A single scripted combo may appear on the final boss.
- **Enemy rules** — green pin removes movement but not threat; red knockback damages on impact; every attack telegraphs; no bullet friendly fire but bodies collide; one class, five configs.
- **Colour roles** — see `ENEMIES.md` and `GLOSSARY.md` for the canonical table.

## 2026-10-23 — the loop, the world, the campaign

- **One shared tank** across all three colours and all uses, refilled by being in your own paint. No refill button, no trickle. → `ADR-0001`
- **Grey is enemy paint.** Both sides paint; enemy fire converts your territory to theirs. → `ADR-0002`
- **All three colours available in normal play**; 2-of-3 is the unlockable hard mode. → `ADR-0003`
- **Wet state is hybrid:** standing on your paint refills slowly and you can still fire; submerging refills fast, moves faster and hides you, but you cannot fire.
- **Partial stealth:** submerging halves detection radius and enemies search your last known position. Firing always reveals you.
- **Grey slows you** and refills nothing. The penalty is live (applies while standing on it), not an accumulated debuff.
- **Dry out is a real loss state.** No tank and no territory ends the run. The game must declare it rather than leave the player stuck.
- **Death restarts the level.** Falls are fail-forward; death is not.
- **Equal paint cost** per shot across all colours. Differentiated cost is a tuning lever, not a pillar.
- **Instant colour switching.** The tank charges for it; input latency would not.
- **Turrets have no status procs** — no freeze, no pin, no useful knockback. Positioning is the only answer.
- **Armour shells are cut.** They existed to serve the 2-of-3 loadout.
- **The Stalker** is the one new enemy: fast on your paint, slow on grey, always visible, normal procs apply.
- **Boss sequence:** Big Arm is the wave-three arena boss; the Siphon is the level-ending colour exam.
- **Sergeant:** one briefing still in the tutorial, then one line per level. Comms bar for text, no portrait system.
- **Level linking:** diegetic where one exists (the supply lift, L2→L3), title cards elsewhere. No hub.
- **Scorecard:** coverage, time, and dry time.
- **Level names:** The Primer, Outskirts, The Ascent, Last Colour.
- **Paintstreak meter** is built last. If the loop feels complete without it, it is gravy.
- **Scope posture:** design the full loop, tag every element cheap / medium / expensive, and let the deadline pick the cut list rather than the design.

## 2026-10-24 — gaps the issue drafts exposed

- **Traps are authored meshes, not a subsystem.** Each level builds its hazard as a plain mesh plus one shared damage-volume helper. No trap base class, no config table, no triggering system. Three hazards are three small behaviours, and each level owns its own.
- **A crit is triple damage.** A frozen enemy takes roughly 3× from the next hit. Not an instant kill — the freeze is a setup reward, not a skip button, and HP stays meaningful.
- **Only the Sprayer, Big Arm and Drainer paint grey.** Turret fire leaves ground alone, so an enemy the player cannot paint back never creates a dead zone. Enemy grey is visually identical to dead ground — territory is legible by *who last touched it*, not by a tint.
- **The scorecard is three numbers.** Coverage, time, dry time. No letter rank, no saved bests. It can grow later; it must not block anything now.

### What the asset files actually contain

Inspected the GLB animation tables rather than trusting the docs. Two facts change several requirements:

- **The player model is fully rigged and generous.** `soldier-swat.glb` has 62 joints, a complete humanoid skeleton, and **24 clips** — including `Death`, `HitRecieve`, `Gun_Shoot`, `Idle_Gun_Pointing`, `Walk`, four directional runs, `Roll`, `Interact`, kicks and punches. But it has **no jump, fall, land or climb clip**.
- **The enemy models have no skeleton at all.** Both `soldier-charger.glb` and `soldier-sprayer.glb` report **0 joints**. Their five clips (`Rifle@Aim`, `@AimShoot`, `@Reload`, `@Run.001`, `@Shoot`) animate nothing that deforms the mesh. Their motion is the procedural bob-and-lean in `enemy.js`, not animation.

Consequences: enemy walk cycles, melee attacks and death reactions **cannot come from clips** with the current assets. Player jump, fall, land and climb **must be procedural**, borrowed, or sourced from a new pack.

### Settled after that inspection

- **Hipfire splashes.** A shot damages every enemy inside the splat radius, so ADS is precision and crits while hipfire is coverage and clumps. The tradeoff is real rather than cosmetic.
- **Enemies stay rigid.** Procedural motion is the accepted answer — bob, lean, squash, recoil, a death topple. Rigged enemy models are rejected as a re-import with unknown clip coverage.
- **Missing player clips come from the Universal Animation Library**, which is already listed in `docs/ASSETS.md` and shares the rig family.
- **`pistol.glb` is authoritative.** The Sci-Fi Gun Pack is dropped from the design; the docs claiming it replaced Kenney's blaster were wrong.
- **One playable character.** The second character is cut.
- **Mood:** the Ascent is cold dawn, Last Colour is sickly amber interior.
- **Amber is the only danger colour** — enemy telegraphs, traps and incoming fire all use it, because it is not a paint colour.
- **Territory is read from the minimap**, with the HUD number relabelled from coverage to territory and tinted with the player's colour.
- **Base props are procedural plus the ITHappy pack** — blockout geometry and code-built crates and pipes, with the downloaded pack filling in detail where it validates.
- **A minimal killfeed ships**, naming the enemy and the colour that killed it.

### Open questions closed

- **Submerge and partial stealth ship**, and both are upgraded to MUST. Without them, wet collapses into "stand still to reload" and the loop keeps its resource but loses its decision.
- **Paintstreak is in**, as a COULD, built last.
- **The decor reveal is already implemented** — `decor.js` carries the full per-colour palette, the instanced buckets and the delayed reveal. `J1` was marked partial in error.
- **The Stalker needs a sourced model.** It is the only enemy in the roster with no asset chosen, because it was invented after `docs/ASSETS.md` was written.

## 2026-10-24 — after the first Outskirts playtest

- **Island A has no raised deck.** It was built, played and cut the same day. It had no motive (Gap 1 is a trivial jump, so a shortcut bought nothing) and it duplicated Island C's pillars, which already own the verticality lesson. The spawn island stays flat: a safe pocket, one hazard, one dormant Charger.
- **Enemies can be dormant.** A dormant enemy is visible and inert until the level wakes it; being hit wakes it, and it is not a contact hazard. Hiding an enemy until a trigger is NOT the same thing — that is a reveal, and it removes the player's decision. The pattern is issue #54's missing aggro range, solved per level instead.
- **A hazard must be on the path or have a use.** A trap that can be walked around without cost is scenery with a damage volume: it costs draw calls and attention and buys nothing. The Island A pit now sits on the line to the Charger, so both the player and the charging enemy cross it.

## 2026-10-29 — levels lane: blockout every level first

- **All four levels are blocked out end to end before any of them is polished.** Then traps → mood → props → tuning run as passes across all four. This reverses the levels roadmap's earlier "build one level to done" order, whose reason was that the loop did not exist yet. It does now: the shared tank and positional refill (#73) and grey slows you (#74) are closed, and every enemy model has landed (#114–#116). The campaign arc (learning → rationing → drowning) can only be judged once all four levels exist.
- **Blockout done means:** every room is at its spec'd size and height, enemy spawns are placed by `type`, the extraction is reachable, there is no void under any climb, the contract tests pass, and every beat has a viewer shot. No mood, props or traps.
- **Levels share one kit** (`src/levels/level-kit.js`): platform, face, rock, pillar, block, extraction zone, shading aim, enemy spawn. These were Level01's private helpers, moved unchanged. Outskirts' surface fingerprint is identical before and after.
- **A level change is checked by eye, not by assertion.** The level viewer (`src/levels/viewer.html`) gives each beat a named shot, and a fix is not called done without a before/after shot or a test that failed first.

## 2026-10-29 — The Ascent, design v2

- **The Ascent is a spiral round one peak**, replacing v1's stacked rooms (`docs/levels/02-the-ascent.md`). 447 m of route, 40 m of climb, 13 enemies, about 6 minutes for a first-timer (fight times estimated until a timed playthrough).
- **A level's layout is data** (`src/levels/layouts/ascent.js`). The design doc's plan, sections, pacing chart and 3D massing model are generated from it, and the level is built from it by `src/levels/layout-builder.js`, which makes no layout decisions. Change the data, never the drawings.
- **Every wall is rock unless the data names it a climb strip.** A paintable wall is always a design decision, never a builder default.
- **Catch floors belong to no room.** A fall puts you out of the fight, so an enemy knocked onto a catch floor counts as gone (this fixed a soft-lock where the ledge never cleared).
- **Open decisions, all at the recommended default (Renda):** a vista balcony on catwalk rest pillar 1 (out of turret reach) as R3's breather; scaffold posts on the chain pads; wave 2 waits dormant and visible on the trailhead; leg 1's north edge stays a real drop; time a playthrough before adding content.
- **No mantle.** Every climb keeps a 0.3 m lip (the measured minimum) instead of 1 m.

## 2026-10-29 — Last Colour, design v2

- **Last Colour is one north–south axis**: lift landing, hangar, corridor, the Core, with the Siphon closing the view and a beacon at 27 m visible over the hangar wall from the landing (`docs/levels/03-last-colour.md`). 30 enemies built; Big Arm's bay is built, Big Arm is not (#99).
- **High ground is the only safe paint.** No enemy in this level climbs, so every raised platform is a pocket nothing can eat; every arena floor point is within a 5 s walk of a climb to one (tested). Wave three's balcony turrets take that safety away.
- **Every level that is data is a `LayoutLevel`** (`src/levels/layout-level.js`): the Ascent and Last Colour share wake rules, gates and the win. Rules may now wait: `cleared:R3.2+8` latches when met and fires after the delay; a gate pulses while its rule counts down.
- **Decisions, all at the recommended default (Renda):** two breaths (wave three waits 8 s, Big Arm's gate warns for 12 s); the Core does not lock behind you; wave three stands visible behind wave two; Big Arm's bay is built before Big Arm; the win is a placeholder (the Siphon's intake, Core clear) until #100.
- **The design tools are shared** (`docs/levels/massing/`): `massing.html?layout=<id>` and `render-diagrams.mjs <id>` work for any layout in `src/levels/layouts/index.js`.

## 2026-10-29 — The Primer, design v2

- **The Primer is one course, one verb per room, on one axis**, climbing 0 → 3 → 8 m (`docs/levels/00-the-primer.md`), built from `src/levels/layouts/primer.js` as a `LayoutLevel`. All four levels now exist; `stub-level.js` is deleted.
- **The blue gap is 6.5 m, not 8 m.** Measured with the player's own physics, a blue run-up clears 8.14 m, so 8 m cleared by 14 cm. The room is tested by simulation: grey fails, blue succeeds, and blue still succeeds jumping a metre early.
- **Doorways between lessons** (R1→R2, R3→R4, R6→R7), so each room isolates one idea.
- **Blue and red examples are pre-painted at load; green is not**, so the third lesson is the first you paint yourself. Paint at load is a layout feature (`prepaint`), applied by `LayoutLevel`.
- **Nothing in the Primer kills** (#79): every wall beats its floor plus a bounce, and the blue pit is enclosed with stairs out (both tested).
- **The default start level stays Outskirts** until the Primer's sergeant (#111/#112) and trap (#101) land.

## 2026-10-29 — Outskirts, polish pass 1

- **Outskirts is a linear mission, not a loop.** The encounter gates already made it one; the planned catwalk return loop, side island, collapsing bridge and both swinging blades are cut to `BACKLOG.md` Parked. `docs/levels/01-outskirts.md` now describes the build.
- **The vent is Outskirts' one trap** (`src/levels/paint-vent.js`, on `TrapVolume`): erupts on grey with an amber tell, dead while half its grate is player paint, re-armed by grey, and hurts enemies as well as the player. Numbers in `TRAP.vent`.
- **The decor reveal runs once, on the Ledge** (`Decor.reveal`): every prop within `OUTSKIRTS.reveal.radius` of player paint takes that colour, and a revealed prop is not turned back to grey by the moment-to-moment reaction.
- **Mood: drained, not dark.** Outskirts' sky, haze and fill moved to `OUTSKIRTS.mood` in config and were lifted from navy to a washed overcast.
- **Finding for the enemies lane:** red knockback has no gravity, so a Charger knocked off C's edge hovers over the waste instead of falling. The waste kill does not work until it does.

## 2026-10-29 — The Primer, polish pass 1

- **The spike pit is built (#101).** `TrapVolume` gained an optional `spare`: a hit never takes a target's `health` below it. The Primer's pit spares 1 health, so it can hurt and cannot kill (#79). A target with no `health` field (enemies use `hp`) still takes full damage.
- **Blue is the pit's answer, and only blue.** A target standing on blue paint is not hit. Same idea as Outskirts' vent ("paint is safety"), narrowed to the colour the room before taught.
- **The tell is visual only:** sagging amber edge boards, a see-through recess and visible spikes. The floor does not really dip: the player has no step-up, so a real 0.3 m sag would be a wall.
- **The Primer has a mood** (`PRIMER.mood`), from a shared `src/levels/mood.js`. Outskirts still uses its own copy (parked).
- **Dressing is layout data** (`kind: 'crate' | 'board'` solids, `markings`), so the layout tests can prove it blocks nothing. Lane markings are chalk, never paint.
- **Cut to Parked:** a fourth free-play toy, and any controls list or extra signage.

## 2026-10-29 — Last Colour, polish pass 1

- **The cargo crusher is built; the laser grid is cut** (BACKLOG Parked). The crusher runs a fixed rhythm with an amber lamp as its tell, and **blue on the floor slides under it**, the same rule as the Primer's spike pit, so blue means "slide past the hazard" everywhere. Numbers in `LAST_COLOUR.crusher`.
- **Props are layout data, built procedurally, grey only, instanced and without collision** (`prop-kit.js`). Amber is the one colour, and it means warning: the lamps over the bay gates blink while a wave's breath counts down.
- **Mood numbers live in `LAST_COLOUR.mood`**; `src/levels/mood.js` is shared with the Primer (#177); the two copies were identical at merge.

## 2026-10-30 — The Ascent, polish pass 1

- **The collapsing catwalk is the Ascent's one trap (#102)** (`src/levels/catwalk.js`). A segment falls `ASCENT.catwalk.delay` (0.9 s) after you first step on it, **whether or not you are still on it**: a run at full speed always makes it, a stop to shoot never does, and turning back means stepping onto something already going. It reforms after 5 s and never into the player, so the scree-return climb always leads to a crossing. The tell is the campaign's amber: the segment shakes and flashes amber **on its walking surface** (the slab's edge alone was out of sight from on top; the viewer caught it).
- **Rolling boulders (#104) and pendulum blades (#103) are Parked**: the catwalk is the trap the level's question needs, and two features per level is the cap.
- **The chain landmark is a Corp gantry with cold-white floodlights at 44 m** plus a lit bollard on each pad. Floodlights are white, not amber: **amber means "this hurts"; white only means "here"**. 40 m was tried first and the leg 2→3 stair hid a light from R5's entrance (tested).
- **The base on the summit horizon is an unfogged dark silhouette**, sunk to −120 m so it rises out of the dark band instead of floating on the pale horizon. Its stack is the Siphon: the next level's goal, seen first from here.
- **Cold dawn mood** (`ASCENT.mood`): far fog (30–170 m) because this level is about seeing the goal; the sun is not moved (the scene light is core's), so the dawn is the sky and the fill.

## 2026-10-30 — The Siphon is in (#100)

- **Renda: build the Siphon**, rather than the cheap stand-in ending. Big Arm (#99) stays a cut candidate and its bay stays shut; the exam begins when the Core is clear.
- **Every phase is reveal → open → solved.** For 2 s a target shows the colour it wants and refuses paint (the tell before the test); it does not exist before its phase (stowed below the world), so nothing can be done out of order or painted in advance.
- **A plate is solved by the share of it in the right colour** (≥ 0.5 of a 4 × 4 sample grid), the vent's rule. Damage does nothing; a wrong colour is only paint to shoot over, so no phase soft-locks.
- **The leak:** each phase spills a pool of its colour at the Siphon's foot. It is a refill (player paint) and a second tell, so the exam tests knowledge, not ammunition.
- **The win moved from the intake volume to the Siphon** (`LayoutLevel.scriptedWin`). The volume stays as the objective marker.
- **Parked:** arms that deal contact damage — it would punish standing still to aim, which is the one thing the exam asks for. Add it only if a playtest finds phase two too easy.

## 2026-10-30 — Big Arm is in (#99)

- **Renda: build Big Arm**, dying to **three combos, one per phase** (blue freeze → green pin → red knockdown), over the alternative of one combo with timed phases. Built in `src/enemies/boss.js` from the levels lane **with Lethabo's agreement** (#99 gives the boss behaviour to the enemy layer).
- **Damage does not kill it.** `ENEMY.bigArm.hp` counts combos left; plain hits, traps and falls do nothing. Every step of the combo is an effect every enemy already has, so the boss teaches no new verb. A missed window breaks the chain (the frost melts, the shackles snap).
- **The one exception to "one enemy class, many configs":** Big Arm is a subclass of `Enemy`, because its hit rules (a combo, not hp) cannot be a config. `tests/config.test.js` now names it, so any other new class or type still fails the test and needs an entry here.
- **The slam hits only inside its radius.** `main.js` wires `onAttack` to damage the player unconditionally (right for a shot), so the boss checks its own reach before calling it. **The slam greys floor at its own height only:** the 5 m balconies are out of reach, so raised paint stays safe paint.
- **Its two Drainers exist from load**, dormant at the back of the bay, because the paint gun takes its target list once. A `summon` wake rule nothing satisfies keeps them asleep until phase 2 (or a hit).
- **Big Arm and its Drainers are the Core's waves 4 and 5** (room R3), so "the Core is clear", which the Siphon waits for, includes them without a new rule.

## 2026-10-30 — Enemy shots are pellets (draft 066)

- **Renda: ranged enemies fire visible pellets, the Splatoon way.** This replaces "the shot lands when the wind-up ends", under which `onAttack` damaged the player unconditionally (noted under Big Arm above). A shot that could not be dodged or blocked made the telegraph a warning without a choice, and made the Turret's spec ("strafe, or break line of sight") false.
- **A pellet is dark Corp grey with an amber rim and trail**, flies at 22 m/s (Sprayer, Wall-crawler) or 30 m/s (Turret), is aimed where the player stands when it fires (no leading), stops at the first surface, and greys the ground where it lands. A miss still costs ground.
- **Grey makes you easier to hit.** On grey (4.2 m/s) a sidestep only just clears a 12 m shot; on paint (7 m/s) it clears it easily. Painting is defence.
- **`onAttack` keeps its meaning:** "this enemy's attack hit the player". For a ranged enemy it now fires on pellet contact. `main.js` does not change.
- **Melee is unchanged:** Charger, Stalker, Drainer, Big Arm.
