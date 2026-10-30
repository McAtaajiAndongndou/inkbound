**Lane:** ui (Moses) for the text pass; everyone for their own files
**Priority:** P2. Quality plan §11 B14
**PRD:** rubric, polish
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: spelling isn't UK/SA English throughout (color/colour, gray/grey, center/centre, …).

### Change

1. A pass over **player-facing text** (HUD, menus, comms lines, credits, the briefing) to UK/SA spelling.
2. Add the rule to `AGENTS.md`: "Player-facing text and docs use UK/SA English." Code identifiers may stay as they are (`Color` in three.js is not ours to rename).

### Scope — files you may touch

- `src/ui/` (all player-facing strings)
- `AGENTS.md` (one line, with the group's agreement)

### Acceptance criteria

- [ ] No US spellings in player-facing strings (`grep` for color, gray, center, behavior, favorite in `src/ui/`).
- [ ] `AGENTS.md` states the rule.
- [ ] `npm test` passes.

### Manual check

Read the menus, HUD and every comms line in one playthrough of the Primer.
