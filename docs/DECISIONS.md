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
