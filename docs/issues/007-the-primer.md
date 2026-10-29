**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E1
**Cost:** M
**Depends on:** #73 and #74 for the room-two beat to land; the geometry can start before them

### Context

The tutorial is the only level whose job is to make the player *want more*. It is a diegetic rebel training course, so the artificial geometry is excused by the fiction, and the sergeant is the tutorial voice.

Full design: `docs/levels/00-the-primer.md`. Read it before laying a single floor — the room order is the design.

### Scope — files you may touch

- `src/levels/level-00-the-primer.js` — new
- `src/levels/` — any shared helper you genuinely need

### Out of scope — do not touch

- `src/main.js` — shared; the level needs registering somewhere. Coordinate rather than editing alone
- The paint shader or player controller
- Dialogue rendering — that is a UI issue

### Acceptance criteria

- [ ] Nine beats in order: Briefing, Move, First Splat, Blue, Red, Green, Trap, One of Theirs, Free Play, Extraction
- [ ] Each room teaches exactly one thing and has no second mechanic in it
- [ ] The Blue room's gap cannot be crossed without blue paint and momentum
- [ ] The Red room's ledge cannot be reached by jumping
- [ ] **The player cannot die anywhere in this level** — the spike pit damages, nothing kills
- [ ] The final Charger is gated, and the gate opens on its death
- [ ] The Free Play room has no objective and no extraction trigger
- [ ] Extraction reports a win through `game.onWin()`
- [ ] `level.dispose()` frees everything — restart the level five times and watch memory

### Manual check

Hand the keyboard to someone who has never played it. Say nothing. If they ask "what do I do" in the first two rooms, the geometry is not asking loudly enough — that is a level bug, not a player bug.

### Design note

The free-play room is the cheapest thing in the project and the one playtesters remember. Resist the urge to put a reward in it.

### Definition of done

- [ ] `npm test` green
- [ ] Status column in `docs/PRD.md` updated (E1)
- [ ] No files touched outside the lane
