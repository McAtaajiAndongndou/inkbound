**Lane:** core (Ozuko); occluder fade with shaders (Lethabo)
**Priority:** P1. Quality plan §11 B11, §5, Phase 0 (damping)
**PRD:** rubric, Interaction
**Cost:** M
**Depends on:** nothing

### Context

QA, 30 Oct: "the camera doesn't see through objects", "it still doesn't feel fluid", and foliage hides enemies. `src/core/camera-rig.js` has **no position smoothing and no camera collision**. A camera welded to the player transmits every step and landing straight to the screen, and walls and trees sit between you and your character.

### Change (plan §5)

| What | Detail |
|---|---|
| **Position damping** (Phase 0) | Follow with a short critically damped spring (~0.06 s). **No rotation damping**: aim stays 1:1 with the mouse |
| **Camera collision** | Sphere-cast from the shoulder pivot to the camera; pull in to the hit, ease back out over ~0.2 s |
| **Occluder fade** | Foliage and small props between camera and player dither-fade to ~30% (Shaders: the dither material; Core: detection) |
| **FOV** | 70 → 78 in third person; +8° while submerged and moving |

All numbers go in `CAMERA` in `src/config.js`.

### Scope — files you may touch

- `src/core/camera-rig.js`, `src/config.js` (`CAMERA`)
- `tests/`

### Acceptance criteria

- [ ] The camera position eases toward its target; the aim direction does not lag the mouse.
- [ ] With a wall between the shoulder and the camera, the camera is pulled in front of the wall.
- [ ] `npm test` passes, including `tests/primer-spawn-facing.test.js` (the first frame must not start behind a wall).

### Manual check

Outskirts: run and jump across island A, then back into the forest edge. The camera moves smoothly and never shows the inside of a wall.
