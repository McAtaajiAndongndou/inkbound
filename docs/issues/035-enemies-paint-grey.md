**Lane:** shaders (Lethabo), with Dikeledi on the paint write
**Priority:** SHOULD
**PRD:** B1
**Cost:** M
**Depends on:** 008 shares the machinery

### Context

`ADR-0002` makes grey a **faction colour**, not the absence of colour: enemies convert your territory back to theirs using the same operation your gun uses in reverse. That is what makes combat a fight over ground instead of a fight over health.

Issue 008 wires this for the Drainer at melee range. This issue adds the two that do it at range.

### Scope — files you may touch

- `src/enemies/enemy.js` — grey conversion on attack impact
- `src/paint/paint-surface.js` — **coordinate with Dikeledi**
- `src/config.js` — splat radius and rate

### Out of scope — do not touch

- The Drainer, which is issue 008
- Turret fire — turrets deliberately leave ground alone
- The shader's rendering of grey

### Acceptance criteria

- [ ] Sprayer shots convert painted cells to grey in a ~1.5 m radius on impact
- [ ] Big Arm's slam converts a wider radius
- [ ] Conversion never passes through walls or floors
- [ ] The player can repaint converted ground immediately
- [ ] **Only the Sprayer, Big Arm and Drainer ever paint grey** — nothing else does
- [ ] Enemy grey is visually identical to dead ground, with no tint to distinguish it

### Manual check

Paint a field, stand where a Sprayer can see you, and let it shoot. Ground near the impacts should go grey. Then paint it back and confirm both directions work in the same area.

### Design note

Identical, not tinted. Territory is legible by **who last touched it**, and tinting enemy grey would break the one-colour, one-side fiction. If playtesters cannot tell whose ground is whose, the fix is the HUD or the mist, not the paint.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for B1 updated
- [ ] No files touched outside the lane
