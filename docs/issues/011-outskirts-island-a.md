**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** S
**Depends on:** nothing — the island exists

### Context

The entry beat. The design question is **"is this place safe enough to learn in?"** — so the room stays safe until the player commits, and its one hazard has a job.

Design: `docs/levels/01-outskirts.md`, "Island A — the entry".

**Revised 24 Oct 2026 after playtest:** the raised deck, the Charger and the pit are all cut. The deck had no motive (Gap 1 is a trivial jump), and it duplicated Island C's pillars, which already own the verticality lesson. The Charger was target practice: on a flat 22 m island with no cover there is nothing to fight around, so the player simply shot it from range. The pit could always be walked around, so it taught nothing. The island's job is the **vantage**: see B's deck and its Sprayer, then commit to Gap 1.

### Scope — files you may touch

- `src/levels/level-01-mission.js` — Island A, its spawns, its hazard placement

### Out of scope — do not touch

- Island B and beyond
- Enemy behaviour
- The decor scatter system

### Acceptance criteria

- [ ] **No enemies and no hazards on this island** — it is the vantage (playtest, 24 Oct)
- [ ] Island B's raised deck and its Sprayer are visible from A, across Gap 1
- [ ] At least 6 m of open ground in front of spawn, with nothing in it
- [ ] Falling returns the player to the island, not to death

### Manual check

Stand at spawn and look down the corridor. You should see Island B, its raised deck, and the Sprayer on it, with nothing moving and nothing in your way. The room's job is the plan, not a fight.

### Design note

A hazard off the route is scenery with a damage volume. If the pit can be walked past without touching it, it belongs somewhere else — that is the lesson of the first playtest.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
