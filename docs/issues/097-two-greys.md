**Lane:** paint (Dikeledi) + core (Ozuko)
**Priority:** SHOULD. Quality plan §3.5, Phase 1
**PRD:** rubric, Gameplay & Experience
**Cost:** M
**Depends on:** loop pass step 5 verdict; changes #74 / ADR-0002

**Gate:** Phase 1 builds wait on the loop pass (`docs/playtests/loop-pass.md`): one change at a time, played against `main`, kept or dropped by Renda. Don't build this until its row there has a **keep**, and it needs a `docs/DECISIONS.md` entry (the plan marks it "decision needed").

### Context

`SURFACE.grey.standSlow` is 0.6, so 7 → 4.2 m/s, which is slower than a Charger, and grey is the whole level at load. The first impression of every level is "this game is slow" (QA: "painting surfaces is too tedious"). Spawn pads were removed on 30 Oct (DECISIONS), so this now hits from the first step.

### Change (plan §3.5, recommended)

- **World grey** (the level at load): slow 0.85.
- **Corp grey** (freshly laid by a Sprayer shot, a Drainer or Big Arm's slam): slow 0.6, and visibly darker and wetter.

The world is a mild drag you want to fix; the enemy's fresh grey is the real threat, and readable as an attack on you. Splatoon only slows you on enemy ink, never on neutral ground.

**Alternative:** one grey at 0.6 plus spawn pads. That's no longer an option: Renda removed the pads.

### Scope — files you may touch

- the paint grid and surface rules in `src/paint/`, `src/core/player.js`, `src/config.js` (`SURFACE`)
- `src/shaders/` only for the darker, wetter look (raise with Lethabo)
- `docs/DECISIONS.md`, and ADR-0002 if it qualifies
- `tests/`

### Acceptance criteria

- [ ] Standing on load-time grey applies the world slow; standing on enemy-laid grey applies the Corp slow.
- [ ] Enemy-laid grey looks different from world grey.
- [ ] Neither grey refills the tank (unchanged).
- [ ] `npm test` passes.

### Manual check

Outskirts: walk the grey start, then step into a Sprayer's fresh grey. The second should feel like a trap; the first just a drag.
