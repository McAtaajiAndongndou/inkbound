**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** M
**Depends on:** 010 for the jump readability, 013 for the bounce numbers

### Context

The setpiece. Green up a pillar's side, paint its roof red, bounce across the gap, climb again. This is the only geometry in the game that reads as unmistakably Inkbound, and it is the level's **final exam**.

Design: `docs/levels/01-outskirts.md`, beat "The Pillars". The layout constants already exist in `L1.ascent` with detailed arithmetic — read the comments before changing a number.

### Scope — files you may touch

- `src/levels/level-01-mission.js` — `L1.ascent`, `_ascent()`, `_pillar()`
- The two Sprayer spawns on the second pillar's deck

### Out of scope — do not touch

- `PLAYER.minBounce` or `SURFACE.red` — the arithmetic in the file depends on them
- The decor system
- Island C

### Acceptance criteria

- [ ] Green on a pillar face is climbable; the other two faces are not paintable
- [ ] The first pillar's roof can be painted red and bounced from
- [ ] The second pillar is 2 m higher, so jumping cannot substitute for the bounce
- [ ] A missed bounce lands on the vestibule floor, never in the void
- [ ] Two Sprayers wait on the second pillar's deck, so the bounce lands into a fight
- [ ] **One swinging blade on the approach, with a green route around it** — this is the trap-language lesson
- [ ] The final climb to extraction cannot be skipped

### Manual check

Do the ascent without dying. Then deliberately miss the bounce and confirm you fall to the floor rather than dying. Then take the green route past the blade and confirm it is genuinely easier than timing it.

### Design note

The swinging blade exists to prove that traps have **colour answers**, not just timings. If a playtester never notices the green route, the blade is decoration and the level has lost its lesson — that is a real bug, not a tuning issue.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
