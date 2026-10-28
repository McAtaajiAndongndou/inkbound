**Lane:** levels (Renda), with Lethabo on any imported models
**Priority:** MUST
**PRD:** M10
**Cost:** M
**Depends on:** #125 (the level's mood decides what the props are lit by)

### Context

Last Colour has no props at all — no crates, no pipes, no rails, no warning lights. It is an empty grey box, which makes the final level look like a blockout rather than a facility.

`docs/DECISIONS.md` settles the approach: **procedural props plus the ITHappy Military Free pack**, where the pack validates.

### Scope — files you may touch

- `src/levels/level-03-horde.js` — prop placement
- `src/levels/` — a small prop builder if the code needs one
- `public/assets/` — any ITHappy model that passes validation
- `docs/ASSETS.md`, `src/ui/credits.js`

### Out of scope — do not touch

- The Three.js materials for painted surfaces
- The paint shader
- Enemy models

### Acceptance criteria

- [ ] The hangar, corridor and core each read as distinct spaces
- [ ] Props are **procedural first** — crates, pipes, rails, lights built in code, matching the flat toon look
- [ ] Any ITHappy model is validated individually before use, per `docs/ASSETS.md`
- [ ] No prop blocks a required route or a paint surface the level needs
- [ ] Warning lights use the amber danger colour
- [ ] Everything disposes with the level

### Manual check

Stand at the hangar entrance and look into the level. Does it read as a facility rather than a test room? Then check the same from the core.

### Design note

The base should look **built and abandoned**, not decorated. Grey machinery that someone stopped maintaining. Resist adding colour to props — colour belongs to the player, and the contrast is the whole point of the level.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for M10 updated
- [ ] `docs/ASSETS.md` and `credits.js` updated if a pack is used
- [ ] No files touched outside the lane
