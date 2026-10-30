**Lane:** ui (Moses)
**Priority:** P1. Quality plan §11 B2, Phase 0
**PRD:** rubric, Gameplay & Experience
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: the sergeant's dialogue stays on screen after pause → level select, and the next level's intro pans with the old text still up.

### Change

Loading a level (any route: level select, restart, next level) clears the comms bar, including a line that is mid-show or waiting for calm. `comms.reset()` is already called in `main.js` when a level loads, so check whether the level-select path skips it, or whether the bar's DOM keeps its last text after reset.

### Scope — files you may touch

- `src/ui/comms.js`, `src/ui/menu.js`
- `tests/`

### Acceptance criteria

- [ ] After pause → level select → another level, no comms text is visible during that level's intro.
- [ ] The same after restart (R) and after "next level".
- [ ] `npm test` passes.

### Manual check

Primer: trigger "That's colour…", pause at once, pick Outskirts. The intro pans with an empty comms bar.
