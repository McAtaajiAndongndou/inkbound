**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2, J1
**Cost:** M
**Depends on:** 015, 013 (the bounce numbers the pillars reuse), 031 for the approach blade

### Context

The level's **final exam** and its **release**, in one slice.

The pillars are the only geometry in the game that reads as unmistakably Inkbound: green up a pillar side, paint its roof red, bounce across, climb again. Then the ledge above, with no enemies and a view back across a forest you have brought back to colour.

Design: `docs/levels/01-outskirts.md`, "The Pillars" and "The Ledge". The arithmetic in `L1.ascent` is load-bearing — read those comments before moving any number.

### Scope — files you may touch

- `src/levels/level-01-mission.js` — `L1.ascent`, `_ascent()`, `_pillar()`, the extraction ledge
- The two Sprayer spawns on the second pillar deck

### Out of scope — do not touch

- `PLAYER.minBounce` or `SURFACE.red` — the level must fit the physics, not the reverse
- The return loop
- The decor system's internals

### Acceptance criteria

- [ ] Green on a pillar face is climbable; the other faces refuse paint
- [ ] The first pillar's roof can be painted red and bounced from
- [ ] The second pillar is higher, so jumping cannot substitute for the bounce
- [ ] A missed bounce lands on the vestibule floor, never in the void
- [ ] Two Sprayers wait on the second deck, so the bounce lands into a fight
- [ ] **A swinging blade on the approach, with a green route around it** — the trap-language lesson
- [ ] The ledge has no enemies, no hazard, and shows the decor reveal
- [ ] Extraction fires only when the ascent is complete

### Manual check

Do the ascent, deliberately miss a bounce to confirm it is survivable, then take the green route past the blade and confirm it is genuinely easier than timing it.

### Design note

Render the pit then the release **in the same pass** — the ledge is what makes the climb feel like an achievement rather than an exhaustion. Do not end the level on the last jump.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for E2 and J1 updated
- [ ] No files touched outside the lane
