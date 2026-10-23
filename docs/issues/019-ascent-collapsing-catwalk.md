**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** M
**Depends on:** 018

### Context

The traversal beat, and the level's breath after its first fight. Three walkway segments over a drop. Each collapses about a second after it is stepped on, so the player is the timer.

Design: `docs/levels/02-the-ascent.md`, room R3.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the catwalk and its collapse behaviour
- `tests/` — a test for the collapse sequence if it can run without a renderer

### Out of scope — do not touch

- Terrace one and terrace two
- Enemy behaviour
- The chain

### Acceptance criteria

- [ ] Three segments, each collapsing roughly 1.2 s after being stood on
- [ ] Collapse is telegraphed — the segment visibly sags or cracks before it goes
- [ ] Blue paint lets the player cross in one committed slide
- [ ] Red paint lets the player bounce the whole span
- [ ] Running it without paint is possible but unforgiving
- [ ] Falling returns the player to terrace one, not to death
- [ ] Collapsed segments reset on level restart, not mid-run

### Manual check

Cross three ways: at a sprint, on blue, and by bouncing. All three should work. Then stop halfway and confirm the drop is survivable and the retry is short.

### Design note

The collapse timer is the whole puzzle, so it must be legible from motion alone. A sound plus a visible sag is enough; a countdown number would be worse.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
