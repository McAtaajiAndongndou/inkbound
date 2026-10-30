**Lane:** core (Ozuko) for `player.js`; paint (Dikeledi) for the surface rules; levels (Renda) re-measures jumps
**Priority:** SHOULD. Quality plan §3.3, Phase 1: the riskiest change in the plan
**PRD:** rubric, Gameplay & Experience
**Cost:** M
**Depends on:** loop pass verdicts; it changes settled behaviour

**Gate:** Phase 1 builds wait on the loop pass (`docs/playtests/loop-pass.md`): one change at a time, played against `main`, kept or dropped by Renda. Don't build this until its row there has a **keep**, and it needs a `docs/DECISIONS.md` entry (the plan marks it "decision needed").

### Context

Paint meant to resupply you also takes control of your body: blue slides you (traction 0.5) and **standing on red launches you 4.33 m every time**, so you can't stand on it to refill. Players stop painting the floor blue and red, then have nothing to refill on, and dry out. Splatoon's ink never changes your physics except swim speed.

### Change (plan §3.3, recommended)

| Colour | On enemies (unchanged) | Player: standing / walking | Player: on demand |
|---|---|---|---|
| Blue | Slides them | **Safe.** Mild glide (traction 0.85), refills | Submerged in blue = the fast lane (2.2×). Pop out with a jump for a long slide-jump |
| Red | Knockback, bounce | **Safe.** Standing does nothing, refills | **Press jump on red = super-jump** (the 4.33 m launch) |
| Green | Pin | Safe, refills | Climb walls (unchanged) |

No colour takes control away from the player without a button press, and "colour changes physics" stays true.

**Alternative:** keep effects automatic, but only on level-marked surfaces (blue lanes, red pads).

**Risk:** every level jump was measured against today's physics (the Primer's 6.5 m blue gap, its 8.14 m run-up). Levels must re-measure after this lands; the level-contract tests will flag the breaks.

### Scope — files you may touch

- `src/core/player.js`, the surface rules in `src/paint/`, `src/config.js` (`SURFACE`)
- `tests/` (Levels fixes its own level-contract tests after)

### Acceptance criteria

- [ ] Standing or walking on red does not launch the player; jump on red does.
- [ ] Walking on blue keeps steering (traction from config); submerged in blue is faster than in other colours.
- [ ] Enemies react to blue, red and green exactly as before.
- [ ] `npm test` passes, except level-contract jump tests, which Levels re-measures in a follow-up.

### Manual check

Outskirts: stand on a red pool and refill without bouncing; press jump on it to launch. Strafe on blue in a fight.
