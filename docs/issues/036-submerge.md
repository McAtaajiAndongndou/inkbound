**Lane:** core (Ozuko)
**Priority:** SHOULD
**PRD:** A6
**Cost:** M
**Depends on:** 001 (the tank and the refill rule)

### Context

The safe half of the loop. Standing on your paint refills slowly and you can still fire. **Submerging** is the commitment: faster movement, fast refill, harder to detect — and you cannot shoot.

That trade is what makes paint a decision rather than a resource. `docs/DECISIONS.md` settles the hybrid: both exist.

### Scope — files you may touch

- `src/core/player.js` — the submerged state
- `src/core/input.js` — the submerge input
- `src/core/camera-rig.js` — the lower camera while submerged, if it needs one
- `src/config.js` — speed multiplier, refill rates, camera offset

### Out of scope — do not touch

- Enemy detection — that is issue 037
- The paint shader's appearance of you when submerged
- The gun viewmodel

### Acceptance criteria

- [ ] Submerging is a **deliberate input**, not automatic on entering paint
- [ ] While submerged: movement is faster, refill is fast, and firing is impossible
- [ ] Releasing the input restores normal movement and firing immediately
- [ ] The camera lowers enough to read as "in" the paint, not hovering over it
- [ ] Submerging on grey does nothing — the state requires your own paint underfoot
- [ ] The player cannot get stuck submerged on a surface that stops being theirs mid-frame

### Manual check

Stand on a painted patch and submerge. You should cross the patch noticeably faster than walking, and pressing fire should do nothing. Release and you can shoot again.

### Design note

Two rules that matter: submerge must be **instant in and out** (no timer), and it must never be the default state — a player who is submerged by accident will think the gun is broken.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for A6 updated
- [ ] No files touched outside the lane
