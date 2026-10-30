**Lane:** core (Ozuko)
**Priority:** P1. Quality plan §11 B12, §3.7, Phase 0: **reproduce first**
**PRD:** rubric, Gameplay & Experience
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: "dry out killed me but I swear I could've just recharged my tank by standing on paint." `DRY_OUT` ends the run when the tank is empty and there is no own paint underfoot for 1.0 s.

Two suspects (plan §3.7):
- the paint underfoot had been greyed by a Sprayer or Drainer;
- the player was on red and bouncing, so never "on" paint (polish audit P0-2).

### Change

Phase 0 is **reproduce and diagnose only**: find which case (or another) ends the run while the player believes they're on paint, and write it down. The plan's rework (dry out stops being a death) is a decision for Phase 1, so not this issue.

### Scope — files you may touch

- `tests/` (a failing test that reproduces it)
- notes in this issue

### Acceptance criteria

- [ ] A test, or written steps, that reproduce a dry-out death while the player stands on their own colour, or proof that the death only happens on greyed or bounced paint.
- [ ] The cause is named in this issue.

### Manual check

Empty the tank on red, then on paint a Sprayer has greyed, and watch whether the grace timer runs.
