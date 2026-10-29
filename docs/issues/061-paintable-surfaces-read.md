**Lane:** shaders (Lethabo), with Dikeledi on `paint-surface.js` and the art call from Renda + Moses
**Priority:** MUST
**PRD:** none yet — proposes a new row beside J3/J4: *paintable surfaces readable before the player shoots*
**Cost:** S–M
**Depends on:** nothing

### Context

A wall that refuses paint and a wall that takes it are drawn **identically**. Both are the same grey grid. The only way to find a climb is to shoot the wall and see where the green sticks.

That is now the main readability gap in every level. The Ascent's first room is a 6 m rock face with one 6 m-wide paintable strip; in the built level the strip is invisible until painted (`docs/levels/02-the-ascent.md`, "What building it caught", shows the before/after). Outskirts has the same problem with its two pillars, one paintable and one not. And the Primer has to *teach* the difference, which it cannot do while the difference is invisible.

`PaintSurface` already knows: every surface carries `unpaintable` (`src/paint/paint-surface.js`). The material just never shows it.

### Scope — files you may touch

- `src/shaders/paint-material.js` — draw unpaintable surfaces differently
- `src/paint/paint-surface.js` — **with Dikeledi's agreement**, pass `unpaintable` to the material (a uniform or a define)
- `src/config.js` — any colour or pattern value this introduces

### Out of scope — do not touch

- The paint palette — blue, red and green stay exactly as they are
- Which surfaces are paintable — that is level data (`src/levels/`)
- Danger and telegraph colour, which is #126

### Acceptance criteria

- [ ] From 15 m, a player can point at the paintable strip on the Ascent's first face **before** shooting it
- [ ] The same holds for Outskirts' two pillars: which one climbs is readable at a glance
- [ ] Unpainted surfaces of both kinds still read as **grey** — "grey is Corrupt Corp's" (ADR-0002) survives
- [ ] Painted cells look the same on every paintable surface as they do today
- [ ] No new colour that could be mistaken for a paint colour or for amber (the danger colour)
- [ ] Works under every level's fog and lighting, including the Ascent's mood once #125 lands

### Manual check

Load `/src/levels/viewer.html?level=ascent&shot=eye-R1` and find the two climb strips without shooting. Then do the same at `?level=outskirts&shot=pillars`. If you have to guess, this is not done.

### Design note

Recommended direction (Renda + Moses to decide): **unpaintable rock reads as Corrupt Corp's sealed panels** — a subtle surface pattern (seams, rivets, a tighter or broken grid) while staying grey, and the paintable surface stays the plain open grid it is today. That keeps the fiction (the Corp sealed what it could; you can only reclaim the open ground) and puts the difference in *texture*, not colour. Alternatives: a faint value shift (paintable slightly lighter), or a level-side trim around every strip. The trim is cheaper but has to be hand-placed per strip and per level, forever.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after — e.g. the material differs for `unpaintable` surfaces
- [ ] A row added to `docs/PRD.md` and its status updated
- [ ] No files touched outside the lane, other than the coordinated `paint-surface.js` change
