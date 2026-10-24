**Lane:** levels (Renda)
**Priority:** SHOULD
**PRD:** F2
**Cost:** S
**Depends on:** 029 for the damage volume

### Context

One behaviour, two uses: the collapsing bridge in Outskirts and the collapsing catwalk in the Ascent. A surface that holds you for about a second and then is gone.

Design: `docs/levels/01-outskirts.md` (The Gap crossing) and `docs/levels/02-the-ascent.md` (R3).

### Scope — files you may touch

- `src/levels/` — the collapsing-surface behaviour
- Both level files, for placement only
- `src/config.js` — collapse delay

### Out of scope — do not touch

- The paint surface shader — a collapsing surface still paints normally until it goes
- The boulder or the blades

### Acceptance criteria

- [ ] A collapsing segment starts a timer the first time it is stood on
- [ ] It visibly telegraphs before it goes — sag, crack or sound
- [ ] After collapsing it stops being walkable and stops being paint
- [ ] Falling with a segment drops the player to the surface below, never into a kill
- [ ] Collapsed segments restore on level restart, not mid-run
- [ ] Blue paint still lets the player cross in one slide, and red still lets them bounce the span

### Manual check

Cross the Outskirts bridge at a sprint, then on blue, then by bouncing. All three should work. Then stop in the middle and confirm the retry is short.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
