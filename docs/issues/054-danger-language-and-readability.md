**Lane:** shaders (Lethabo), with Renda on trap meshes
**Priority:** MUST
**PRD:** J3, J4
**Cost:** S
**Depends on:** #101 for traps to colour

### Context

`enemy.js` already chooses **amber** for telegraphs for a precise reason: amber is not a paint colour, so a warning can never be misread as ground. That decision was never extended to traps, projectiles or death effects, and readability has never been verified anywhere.

With five enemy types, rigid models and a HUD full of colour, the risk is real: a player who cannot tell a Charger from a Sprayer at 20 m cannot play the game.

### Scope — files you may touch

- `src/enemies/enemy.js` — telegraph and hit colouring
- `src/levels/` — trap warning cues
- `src/config.js` — one shared danger colour

### Out of scope — do not touch

- The paint palette — blue, red and green stay exactly as they are
- Enemy silhouettes, which are an asset problem
- The HUD

### Acceptance criteria

- [ ] **One** danger colour, defined once, used by enemies, traps and incoming projectiles
- [ ] Amber is used, never red, green or blue
- [ ] Every enemy is distinguishable by silhouette alone at 20 m, tested with the models in place
- [ ] Every attack telegraphs visibly **and** audibly before it lands
- [ ] A frozen or pinned enemy reads as such from ~10 m
- [ ] Nothing dangerous is the same colour as something helpful

### Manual check

Stand 20 m from a mixed group and name each enemy before it moves. Then let one attack you and confirm you saw it coming. If either fails, this issue is not done.

### Design note

Silhouette is the fix for enemy confusion, not colour — colouring enemies differently would fight the "everything grey is theirs" art direction. If two enemies look alike, change the shape or the scale, never the palette.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for J3 and J4 updated
- [ ] No files touched outside the lane
