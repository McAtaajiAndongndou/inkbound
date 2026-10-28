**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E4
**Cost:** M
**Depends on:** #96, #80, and the Stalker itself (D6)

### Context

The arena. A circular, multi-level chamber with the siphon as a structure in the middle, and two waves that escalate. The anti-snowball is at its sharpest here: the better you play, the more territory you have to lose.

Design: `docs/levels/03-last-colour.md`, room "Core".

### Scope — files you may touch

- `src/levels/level-03-horde.js` — the chamber, the wave table and the wave pacing
- The gated exits between waves

### Out of scope — do not touch

- Drainer, Charger zombie or Stalker behaviour
- Big Arm, which is a separate issue
- The Siphon

### Acceptance criteria

- [ ] **Wave two:** eight Drainers, two Charger zombies, and one Stalker — and no other new enemy type
- [ ] **Wave three:** a mixed wave of Drainers, Chargers and turret pressure
- [ ] The Stalker is introduced with enough space that the player can see it moving faster on their own paint than on grey
- [ ] The chamber has at least two elevations, so knockback has somewhere to send things
- [ ] A gated exit between waves, so a wave cannot be run past
- [ ] Dying or drying out restarts the level, not the wave

### Manual check

Reach wave two with a large painted field. Watch the Stalker move. If you cannot tell it is faster in your paint than on grey, the reveal is spoiled and the room needs more contrast or more space.

### Design note

The Stalker's whole meaning depends on the player having spent two levels learning that **wet means safe**. Do not soften it by making it slow everywhere — its point is the inversion. What must be readable is *why* it is fast, not that it is fast.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
