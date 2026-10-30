**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** rubric, 3D Effects ("refractions")
**Cost:** M
**Depends on:** nothing

### Context

The rubric lists refraction by name, and the game has none. The obvious candidate is already in the game: **blue's frost shell** (`src/shaders/frost/frost-material.js`), a see-through ice bubble around a frozen enemy. Today it's an additive rim with Fresnel, crack bands and a pulse. You can see through it, but nothing behind it bends.

Ice that bends what's behind it reads as solid ice instantly, the way Zelda: Breath of the Wild's Cryonis blocks or Hitman's glass do. It also makes the freeze, which sets up the game's best combo (freeze then shatter), the most visually distinct state in the game.

### The design

**Screen-space refraction, rendered only while a frost shell is on screen.**

1. **Scene copy.** When at least one frozen enemy is visible, render the scene **without the frost shells** (they sit on their own layer) into a half-resolution `WebGLRenderTarget` before the main pass. With no frozen enemy on screen, skip this entirely, so the effect costs nothing.
2. **Refraction.** The frost fragment shader samples that target at `screenUV + n.xy × FROST.refractStrength × (1 − fresnel)`. The view-space normal bends the image most where you look straight through the shell, and the existing Fresnel rim takes over at the edges.
3. **Tint and facets.** Mix the refracted image with the blue `uColour`. Add the existing crack bands to the offset as well as the brightness, so the facets kink the image.

Built-in alternative, if the custom pass proves too slow on lab hardware: switch the shell to `MeshPhysicalMaterial` with `transmission` and `ior: 1.31` (ice). That still ticks refraction under 3D Effects, but it loses the shader-band credit and the crack facets, so try the custom pass first.

### Rules

- **Config:** a `FROST` block with `refractStrength`, `sceneScale: 0.5`, `tint`.
- **Dispose:** the render target is disposed with the level, and resized when the window resizes.
- **Performance:** measure frame time in Last Colour with three frozen enemies on screen and report it in the PR. If it costs more than 2 ms, drop `sceneScale` to 0.33.

### Scope — files you may touch

- `src/shaders/frost/frost-material.js`
- `src/shaders/frost/frost-pass.js` (new: owns the target and the "anything frozen on screen?" check)
- `src/config.js`
- `tests/`

The one call per frame, in `main.js`, is core. Ask Ozuko for the line: `frostPass.render(renderer, scene, camera)` before the main render.

### Acceptance criteria

- [ ] No frozen enemy on screen: the pass renders nothing (a counting stub renderer sees zero calls).
- [ ] One frozen enemy on screen: exactly one extra render at the configured scale.
- [ ] The shell's material has `uSceneTex` and `uResolution`, and compiles.
- [ ] The target is disposed on level unload and resized on window resize.
- [ ] `npm test` passes.

### Manual check

Freeze a Charger in front of a painted wall: the paint stripes visibly bend through the ice. Walk round it: the bend shifts with the angle.

### What to say in the demo

"The ice is a refraction shader: we render the scene once without the ice into a texture, then the ice samples it offset by its own normal. It's only rendered while something is frozen on screen."
