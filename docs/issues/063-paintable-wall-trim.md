**Lane:** levels (Renda), **blocked on** shaders (Lethabo) agreeing the approach
**Priority:** SHOULD
**PRD:** same gap as #157 (draft 061) — paintable surfaces readable before the player shoots
**Cost:** S
**Depends on:** a yes/no from Lethabo on #157 and #126

### Context

Polish pass 1 (`docs/levels/polish-pass-1.md`, item 0) proposes solving #157 from the levels lane instead of the shader: a thin frame around every paintable strip, built in `src/levels/level-kit.js`. It needs no change to `PaintSurface` or the paint shader.

Two answers to one problem would be worse than either, so this waits on one question to Lethabo: **is a level-side trim the readability answer, or is the shaders lane solving it in `paint-material.js`?** If the shader solves it, close this issue.

### Scope — files you may touch

- `src/levels/level-kit.js` — the trim, built beside each paintable face
- `src/levels/*` — each level's light-direction pass and dispose
- `src/config.js` — the trim's colour and width

### Acceptance criteria

- [ ] A test shows every paint strip in all four levels has a trim, and no non-paintable wall has one
- [ ] The trim is not a paint colour and not amber (the danger colour)
- [ ] The trim joins each level's light-direction pass (AGENTS rule 5) and the dispose contract (rule 6); the "ten reloads leak nothing" test still passes

### Manual check

`/src/levels/viewer.html?level=outskirts&shot=pillars` and `?level=ascent&shot=eye-R1`: point at the climbable strip from 20 m before shooting it.
