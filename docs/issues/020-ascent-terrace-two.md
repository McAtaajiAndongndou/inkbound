**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** M
**Depends on:** #91, #77 (turrets must have no status procs), M5 for the models

### Context

The economy of the level in one image: **a turret covering the only good place to paint.** The player has to go somewhere exposed to get the paint they need to advance. That is what "no space" means, and this room is where it is felt hardest.

This is also the only intentionally **unrecoverable** room in the level — the one place a player can run dry through their own decisions.

Design: `docs/levels/02-the-ascent.md`, room R4.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — terrace two, its two turret spawns, the cover pocket
- `src/config.js` — turret counts if they live there

### Out of scope — do not touch

- Turret behaviour or its no-proc rule
- The catwalk
- The chain

### Acceptance criteria

- [ ] Two turrets: one overwatching the main floor, one covering the base of the climb face
- [ ] There is exactly one safe pocket, and it is not adjacent to the best painting spot
- [ ] No colour proc affects either turret — verified by playing it, not just by reading issue #77
- [ ] A player who paints in the open runs dry; a player who paints behind cover does not
- [ ] Both turrets are **visible before they fire**

### Manual check

Play it two ways: paint boldly in the open, then paint carefully from the pocket. The first should leave you dry and retreating. If both feel the same, the turrets are not actually covering the paint.

### Design note

If playtesters call this unfair rather than tight, the fix is a **small paintable pocket**, never a weaker turret. The room is supposed to be an economic squeeze; removing the pressure removes the level's identity.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
