**Lane:** core (Ozuko)
**Priority:** SHOULD. Quality plan §3.7, Phase 1; changes PRD A5
**PRD:** rubric, Gameplay & Experience
**Cost:** S–M
**Depends on:** #226 (reproduce the dry-out death) first

**Gate:** Phase 1 builds wait on the loop pass (`docs/playtests/loop-pass.md`): one change at a time, played against `main`, kept or dropped by Renda. Don't build this until its row there has a **keep**, and it needs a `docs/DECISIONS.md` entry (the plan marks it "decision needed").

### Context

`DRY_OUT`: an empty tank and no own paint underfoot for 1.0 s ends the run. QA: "dry out killed me but I swear I could've just recharged my tank by standing on paint." A loss the player believes was unfair is worse than no loss. CoD never ends your run for running out of ammo.

### Change (plan §3.7, recommended)

Dry out stops being a death. When it triggers, the gun dribbles a weak shot of the selected colour, the tank refills at 1/s wherever you stand, the screen edge greys, and the sergeant says one line ("You're dry — find your colour!", a new comms line for Moses). The run never deadlocks; being dry is a punishing state, not a game over.

**Alternative:** keep it a loss, but raise `graceTime` 1 s → 3 s, with a visible countdown and an arrow to the nearest owned paint.

### Scope — files you may touch

- `src/core/` (the dry-out state), `src/config.js` (`DRY_OUT`)
- `tests/`

The grey screen edge and the line are UI (Moses): raise them as their own issue when this is decided.

### Acceptance criteria

- [ ] An empty tank off paint no longer ends the run; it enters the dry state described above.
- [ ] Standing on own paint in the dry state refills normally and leaves it.
- [ ] `npm test` passes, with the old dry-out-death tests updated to the new rule.

### Manual check

Empty the tank in the middle of grey and keep playing: the run continues, weaker, until you find your colour.
