**Lane:** shaders, Lethabo
**Priority:** P1. Quality plan §11 B9, §6.3 A10, Phase 0
**PRD:** rubric, Visual
**Cost:** S
**Depends on:** nothing

### Context

QA, 30 Oct: a frozen enemy looks flat (2D) inside its frost shell. The freeze is the blue combo's payoff, so it has to read well. Not yet diagnosed. Suspects: the shell's depth write or sort order against the body, or the refraction pass (#196) sampling a flat copy of the scene.

### Change

Diagnose, then fix, so the frozen enemy keeps its 3D shape and shading inside the shell.

### Scope — files you may touch

- `src/shaders/frost/` and the shell setup in `src/enemies/enemy.js`
- `tests/`

### Acceptance criteria

- [ ] A frozen enemy, seen from several angles, shows its 3D body through the shell.
- [ ] The shell's refraction still reads as ice.
- [ ] `npm test` passes.

### Manual check

Freeze a Charger with three blue hits and orbit it in third person.
