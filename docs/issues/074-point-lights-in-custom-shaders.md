**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** rubric, 3D Effects ("multiple light sources")
**Cost:** M
**Depends on:** nothing. #198 (levels) places the lights

### Context

The game has directional, hemisphere and ambient lights only. There are **no point or spot lights**, and adding a `THREE.PointLight` today would do almost nothing. AGENTS rule 5 says why: "Custom shaders do not read scene lights." The paint, toon and outline materials, which cover nearly every surface, compute their own lighting from one `uLightDir`. A point light would light only the few built-in materials, such as the crusher head and the GLB models.

Meanwhile the game is full of things that should *emit* light: amber telegraphs, the vent, the crusher, beacons, the Siphon, and the gate fields. Doom (2016) and Splatoon both use small coloured local lights as gameplay information. A Charger lit amber from inside its wind-up reads at a glance in a dark room.

### The design

**A fixed pool of four point lights that every custom shader reads, plus the same four as real `THREE.PointLight`s so built-in materials match.**

- `src/shaders/point-lights.js` (new) exports a `PointLightPool`. Anything registers a light source with `add({ position, colour, intensity, range, flicker? })` and gets a handle back. Each frame, `update(camera)` picks the **four nearest active sources to the camera** and writes them into:
  - shared uniforms: `uPointPos[4]`, `uPointColour[4]`, `uPointRange[4]`
  - four persistent `THREE.PointLight`s with `castShadow: false`
- **The light count never changes.** Unused slots get intensity 0. Three.js recompiles every built-in material whenever the number of lights in the scene changes, which would stutter mid-fight.
- The paint and toon fragment shaders add `Σ colour × max(dot(n, L), 0) × attenuation`, with a smooth falloff to zero at `range`. Shared GLSL lives in one chunk, the way `fog-height.js` shares fog.
- **Telegraph light.** In `src/enemies/enemy.js`, each enemy's wind-up registers an amber source at its chest for the duration of the tell, with intensity following the tell's swell. This is the one enemy-lane hook.

### Rules

- **Config:** a `POINT_LIGHTS` block with `slots: 4`, falloff exponent, `telegraphIntensity`, `telegraphRange`.
- **Allocation:** nothing allocated per frame. Sorting reuses one array.
- **Dispose:** the pool's lights are removed and the uniforms reset when the level unloads.
- **Danger language** (#126): amber light means danger, and only telegraphs and traps use it.

### Scope — files you may touch

- `src/shaders/point-lights.js` (new)
- `src/shaders/paint-material.js` and `src/shaders/toon/toon-material.js` (the outline needs nothing)
- `src/enemies/enemy.js` (the telegraph source)
- `src/config.js`
- `tests/`

### Acceptance criteria

- [ ] With six sources registered, exactly the four nearest the camera are written to the uniforms.
- [ ] Scene light count is constant across registering and removing sources: a test counts `scene` lights before and after.
- [ ] A paint fragment at distance 0 from a source with range 5 gets its full contribution, and 0 at distance ≥ 5 (JS port of the falloff).
- [ ] An enemy's wind-up registers a source and releases it when the tell ends or the enemy dies.
- [ ] No allocation per frame (`player-alloc` style test on `update`).
- [ ] `npm test` passes.

### Manual check

The Primer's R7 Charger in the dark corner: the floor around it glows amber during the wind-up. Last Colour's Core wave: only the two enemies holding attack tokens light up, which also shows who is about to shoot.

### What to say in the demo

"Our materials do their own lighting, so we pass the four nearest point lights in as uniform arrays and sum them in the fragment shader. The light count is fixed, so Three.js never recompiles mid-fight."
