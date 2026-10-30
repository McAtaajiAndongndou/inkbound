**Lane:** levels (Renda)
**Priority:** SHOULD. Cheap, and it ticks a named technique on the theme's key moment
**PRD:** rubric, 3D Effects ("static and dynamic skyboxes"); Gameplay & Experience (theme)
**Cost:** S
**Depends on:** nothing. If 073 has landed, also call its `SkyProbe.refresh()`

### Context

The rubric lists "static and dynamic skyboxes". Every level has a sky dome (`skyDome` in `src/levels/mood.js`): three bands of vertex colours on a `MeshBasicMaterial`, fixed at load. That's a static sky, and the game has no dynamic one.

The theme gives a dynamic sky an obvious job. **Corp has drained the colour out of the world, and you put it back.** At present the ground changes and the sky doesn't, so the payoff stops at your feet. Splatoon's Octo Expansion and Gris both change the whole world's palette as the player progresses, and in Gris that palette change *is* the progression.

### The design

**Each level's sky starts Corp grey and warms toward the level's own mood as its territory grows.**

- **The two skies.** Each mood block gains a `drained` sky (`horizon`, `zenith`, `void`, all near `PAINT.grey`) next to its existing colours, which become the `restored` sky.
- **The driver.** The dome becomes a small `ShaderMaterial` with `uHorizon`, `uZenith` and `uVoid`, plus a `uBand` attribute replacing the per-vertex colours. Each frame, those three uniforms are lerped from drained to restored by `k = smoothstep(SKY.from, SKY.to, coverage)`.
  - `coverage` is the level's territory: the mean of `surface.coverage()` over its surfaces, recomputed `SKY.scansPerSecond` (2) times a second, not every frame.
  - `k` eases toward its target at `SKY.rate`, so a big paint burst makes the sky roll over the next second instead of snapping.
- **Fog follows the horizon.** That's mood.js's one load-bearing rule. `scene.fog.color` is lerped with `uHorizon`, or the haze becomes a grey band across a coloured sky.
- **Last Colour's Siphon.** While the Siphon drains, `k` is forced down toward 0, so the sky greys as you lose. When it's destroyed, `k` snaps to 1 over `SKY.finale` seconds. That's the level's payoff shot, and the trailer's.
- **The Primer** keeps a static sky. It's indoors, and the contrast shows the dynamic sky is a deliberate choice.

### Rules

- **Config:** a `SKY` block with `from: 0.05`, `to: 0.5`, `rate`, `scansPerSecond: 2` and `finale: 2.5`, plus a `drained` palette in each level's mood.
- **AGENTS rule 5:** the dome is unlit and needs no `uLightDir`. Keep `fog: false` and `depthWrite: false`.
- **AGENTS rule 6:** the material and geometry dispose with `level.root`, as today.
- If 073 is in, call `level.skyProbe.refresh()` when `k` has moved by more than 0.02 since the last refresh. Never every frame.

### Scope — files you may touch

- `src/levels/mood.js`
- `src/levels/level-01-mission.js` (Outskirts has its own copy of the mood code)
- the level files that call `applyMood`
- `src/levels/layouts/last-colour.js` and `src/levels/layout-level.js` (the Siphon hook)
- `src/config.js`
- `tests/`

### Acceptance criteria

- [ ] At coverage 0, the dome's uniforms equal the drained palette; at coverage ≥ `SKY.to`, the restored one.
- [ ] `scene.fog.color` equals `uHorizon` every frame the sky moves.
- [ ] Coverage is scanned at most `SKY.scansPerSecond` times a second (counting stub).
- [ ] The Siphon pulls the sky toward drained while it drains, and its destruction restores the sky within `SKY.finale` seconds.
- [ ] Ten reloads leak nothing.
- [ ] `npm test` passes.

### Manual check

Outskirts from spawn: the sky is grey. Paint island A and look up: it's warming. Last Colour: let the Siphon drain and watch the sky grey; then destroy it.

### What to say in the demo

"The sky is a shader whose colours are driven by game state: how much of the level you've painted. The fog colour follows the horizon so the two never separate."
