**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** S
**Depends on:** 014 — it connects Island C back to Island B

### Context

The change that stops Outskirts being a corridor. A catwalk from Island C back to Island B: unpainted, empty, slow, safe.

Its only job is to make **retreat possible**. With no trickle refill, a dry player in Island C otherwise has nowhere to go but a restart — which is a death decided by level geometry rather than by play.

Design: `docs/levels/01-outskirts.md`, "The return loop".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — the catwalk and its connections
- The optional side island and its bounce distance

### Out of scope — do not touch

- The islands themselves
- Enemy behaviour
- The pillars

### Acceptance criteria

- [ ] The catwalk connects Island C to Island B and is walkable in both directions
- [ ] It has no enemies and no traps
- [ ] It is **slower** than the forward route — it is an escape, not a shortcut
- [ ] It is grey, so a player who wants speed must paint it on the way out
- [ ] A dry player in Island C can reach paintable ground by taking it
- [ ] **Optional:** a side island reachable by one hard red bounce from C, with no enemies and a view

### Manual check

Empty your tank in Island C, then try to survive by leaving. If you cannot reach ground you own, the loop is too long or too far. Then check the side island is findable but not signposted.

### Design note

If playtesters never take it, the loop is decoration and the level is still a corridor with extra steps. That is the failure mode to watch for — it is a design bug, not a discoverability problem.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for E2 updated if this is the last Outskirts slice
- [ ] No files touched outside the lane
