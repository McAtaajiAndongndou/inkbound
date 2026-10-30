**Lane:** ui (Moses)
**Priority:** P1. Quality plan §13 Phase 0 (UI), §9.1
**PRD:** rubric, Gameplay & Experience
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: "Q is never taught", and submerge (Shift) is the move the loop is built around. The plan's Phase 0 UI work includes a check that the controls screen shows both correctly.

### Change

Check the controls list in the menu: Shift says "Submerge in your paint (refill fast)", and Q says "Paintstreak (when full)" and that the gauge must be full. Fix wording or ordering so the two loop verbs are near the top.

### Scope — files you may touch

- `src/ui/menu.js`
- `tests/`

### Acceptance criteria

- [ ] The controls screen lists Shift and Q with what they do and when.
- [ ] `npm test` passes.

### Manual check

Open the menu and read the controls cold, as a new player.
