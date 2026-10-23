**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** S
**Depends on:** 010 if possible — a charger fight reads much better once airborne animation exists

### Context

The first fight, and the first time the player chooses a colour. One Charger on a wide open floor, with no cover. Sidestepping works. Painting blue works. Only one of those is interesting.

Design: `docs/levels/01-outskirts.md`, beat "Island B — first blood".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — `L1.islands.B` and its spawn entry
- `src/config.js` — enemy counts only if they live there

### Out of scope — do not touch

- The Charger's behaviour — that is issue 004
- Island C's two-enemy fight
- The pillars

### Acceptance criteria

- [ ] Exactly one Charger spawns on Island B
- [ ] The floor is wide enough that a sidestep is possible — at least 14 m of open width
- [ ] No cover, so the fight is won with movement or paint rather than hiding
- [ ] Painting blue on the charge line makes the Charger slide past
- [ ] Clear the island and the gate to the Gap opens

### Manual check

Fight it twice: once sidestepping, once with blue on its line. Both should work. The blue version should feel clever rather than required.

### Design note

The blue you paint here is also the Gap's run-up. That reuse is what makes the island feel designed instead of decorated — leave room for the patch where the player will naturally put it.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
