**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** H6
**Cost:** S
**Depends on:** 009 for the existing end-of-run messaging

### Context

The rubric's Polish line names *"hitmarkers, killfeed"*. Hitmarkers exist and work; there is no killfeed anywhere in the build. It is a small, visible item on a marking sheet.

It also does teaching work for free: naming the colour that killed an enemy tells the player which colour answers which enemy, without a tutorial line.

### Scope — files you may touch

- `src/ui/hud.js` — the feed
- `src/ui/style.css`
- `src/main.js` — **shared.** Coordinate for the kill event payload

### Out of scope — do not touch

- The hitmarker, which works
- The scorecard
- Enemy behaviour

### Acceptance criteria

- [ ] A line appears when an enemy dies, naming it and the colour responsible: `SPRAYER — FLUNG`
- [ ] The line is tinted with the colour that killed it
- [ ] It fades on its own — no interaction
- [ ] **Repeated kills coalesce** — eight Drainers become `DRAINER ×5`, not eight lines
- [ ] At most three lines are ever visible
- [ ] It never overlaps the ammo, health or colour swatches

### Manual check

Kill a Charger with red knockback and confirm the line says something truthful about *how*, not just that it died. Then clear a wave of Drainers and confirm the feed does not fill the screen.

### Design note

In Last Colour there are dozens of Drainers. A feed that prints one line per death will cover the screen exactly when the player most needs to see the arena — **coalescing is a requirement, not a nicety.**

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for H6 updated
- [ ] No files touched outside the lane, other than the coordinated event
