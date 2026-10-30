**Lane:** shaders, Lethabo
**Priority:** P1. Quality plan §11 B10, §8.4 item 7, Phase 0
**PRD:** rubric, Visual
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: a black circle in the Ascent's sky follows the cursor. Not yet diagnosed. It's likely a sky element (a sun or moon disc, or the sky probe, #194) attached to the camera rather than placed in the world.

### Change

Find what draws it and either place it in the world or remove it.

### Scope — files you may touch

- `src/shaders/` (sky probe, any sky disc)
- `tests/`

Not `src/levels/mood.js` without telling Renda (Levels): the dome and its uniforms live there.

### Acceptance criteria

- [ ] Looking around the Ascent's sky, nothing follows the camera.
- [ ] `npm test` passes.

### Manual check

The Ascent: sweep the mouse across the sky at the trailhead and at the summit.
