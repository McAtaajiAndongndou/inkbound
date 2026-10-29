# Backlog

Ideas, playtest findings and parked work. **Check triage status before building anything here** — an untriaged idea is not a task.

---

## Now

1. **Jump feel** — coyote time + jump buffering (`src/core/player.js`). Separate bug: occasional floor fall-through (raycast collision gap).
2. **Camera rig** — TPV feels detached, camera can look beneath the character, camera movement doesn't rotate the character (`src/core/camera-rig.js`).
3. **Outskirts layout** — widen island B so the fight is winnable, raise pressure on the third platform, add the encounter gates.
4. **Grey-world aesthetic pass** — the world must read as drained before the player paints it.

## Next

- Enemy build-out per `docs/enemies/algorithms.md` — starting with the Charger's recovery window, which is the cheapest combat improvement in the game.
- Traps: the static spike pit first, then paint-solvable variants.
- Grey-to-colour decor reveal — built for Outskirts (the Ledge, polish pass 1); other levels not yet.
- Models, validated one asset at a time (see `docs/ASSETS.md`).

## Parked

- **Megabonk movement** (slides, momentum super-jump, bunnyhop) — post-beta. Blue paint already approximates slides, and bhop invalidates every jump-distance number in the level plans.
- **Paint combining** (red + blue = teleport paint) — needs a new physics mode, recipe UI and teaching cost, and the Innovation band is already full.
- **Jetpack** — rejected as a base ability: it makes every gap in every level trivial and forces a level-design rewrite. If it ever returns, it is a single-level pickup with a fuel limit.
- **Vehicle level** — rejected: new physics, new camera, new collision and no paint. An on-rails transition gets the same breather for a tenth of the cost.
- **More enemy types** — rejected. Add enemy *questions*, not enemy types.
- **Outskirts catwalk return loop** (polish pass 1) — the encounter gates make the level linear, and C's floor already gives room to retreat and repaint.
- **Outskirts side island** (polish pass 1) — new content, not polish.
- **Outskirts collapsing bridge** (polish pass 1) — new content, not polish; the Gap already owns the "commit to one motion" question.
- **Outskirts swinging blades** in B and on the pillar approach (polish pass 1) — the vent is the trap that uses paint; two features per level is the cap.
- **Primer: a fourth free-play toy (the gap)** — its own design doc says it comes after a playtest (polish pass 1).
- **Primer: a controls list or extra signage** — the design teaches by room, not by text; the doc refuses them (polish pass 1).
- **Outskirts onto `src/levels/mood.js`** — the Primer's shared mood helper repeats Outskirts' sky/fog/fill; fold Outskirts onto it once its polish branch is merged.

---

## Playtest findings (Renda, Level 1)

- **Gap jump unreliable** — needs coyote time and jump buffering.
- **Occasional fall-through of the floor** — raycast collision gap, separate bug from the jump feel.
- **Third-person camera feels detached** — can look beneath the character; movement does not rotate the character.
- **Island B is too small** — the only way past the enemy is to ignore it.
- **Third platform is too easy.**
- **TPV preferred over FPV** for aiming and painting — pending confirmation, and this is the Splatoon-vs-CoD balance decision.

## Viewer findings — 29 Oct 2026 (Ascent blockout)

- **Paintable and unpaintable walls look identical.** The Ascent's First Face is rock with one 3 m paintable strip, and in the viewer's `face` shot the strip cannot be told from the rock. Outskirts has the same problem (left pillar paintable, right pillar not). The player can only find the strip by shooting the whole wall. Belongs to the readability pass (#126, shaders lane) or a level-side marker such as trim around paintable strips. Decide which before the Primer, which has to teach it.

## Playtest findings — 28–29 Oct 2026 (B/C rework)

- **C's block is only cover if the AI collides with it.** Enemies walked through it; walls were player-only. Fixed in `enemy.js` (walls + LOS + knockback), but it needed the fix to have any meaning.
- **Enemies piled up at the arena lip** before the player arrived, so every fight was waiting at the jump. Now dormant until the player enters the island.
- **Enemy ranged attacks did no damage** — `onAttack` was never assigned. Now wired to `player.takeDamage` with `attackDamage` per config.
- **Decor grows through cover.** A 3 m block in a forest had trees inside its footprint. `Decor` now takes keep-out rects; C's block has one.
- **OPEN: B's deck Sprayer drops to the floor when shot.** Not reproduced in simulation (position stays 4.6 through blue hits, death, and edge cases). Two defensive fixes are in (glue-to-floor, foot-width edge probe). Next step is an on-screen `y` readout, not another guess.

## Playtest findings — Outskirts entry island (Renda, 24 Oct 2026)

- **The deck read as climbable but had no point.** Being off the route meant there was no reason to spend paint on it. It also duplicated Island C's right pillar (Sprayers above you; shoot them or knock them off; left pillar for high ground).
- **Island A was clutter.** Deck + pit + Charger inside one short island, all competing at the moment the player has the least footing.
- **The Charger reached the player before they had found their feet.** It moves from load at 5 m/s from ~8 m; distance alone cannot fix that on a 13 m island.
- **The trap did nothing.** It was beside the route, so it was never touched and never used against an enemy.
- **A hidden-then-spawned enemy is a reveal, not opt-in difficulty.** The deck Sprayer did not exist until the player was already on top of it, so there was no decision to make.
- **The deck's 1 m overhang reads as a protruding roof** on a free-standing deck, even though a climb needs at least 0.3 m of it to land. Keep the overhang, frame it as a capital.
