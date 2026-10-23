**Lane:** levels (Renda), with Lethabo on the decor shader if it needs one
**Priority:** SHOULD
**PRD:** E2, J1
**Cost:** M
**Depends on:** 015 (the ledge is the top of the pillars)

### Context

The release beat. No enemies, no objective, and the view back across a forest the player has just brought back to colour.

This is where the grey-to-colour reveal pays off: the trees near painted ground lerp out of their drained grey. It is the cheapest storytelling in the project and it is the level's **identity**.

Design: `docs/levels/01-outskirts.md`, beat "The Ledge" and the section "The environment reveal".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — the extraction ledge and the extraction trigger
- `src/levels/decor.js` — the paint reaction radius and speed, if it needs adjusting
- One optional hidden side route

### Out of scope — do not touch

- `src/shaders/paint-material.js` — the ground shader is not the decor shader
- The pillars' geometry
- Enemy behaviour

### Acceptance criteria

- [ ] The ledge has no enemies and no hazard
- [ ] The extraction trigger fires only when the ascent is complete
- [ ] Decor within a radius of painted ground visibly returns to colour, locally and over roughly a second
- [ ] Decor far from any paint stays drained
- [ ] The reveal never applies to the military-base aesthetic — that stays grey by design
- [ ] The hidden route exists, is reachable, and hides nothing the player needs

### Manual check

Paint a patch on Island A early in the run, then look back at it from the ledge. You should be able to tell which parts of the forest you touched from the top of the tower.

### Design note

Local and slow. A global tint change reads as a filter; local recovery reads as life. If it looks like a post-processing effect, the radius is too large.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
