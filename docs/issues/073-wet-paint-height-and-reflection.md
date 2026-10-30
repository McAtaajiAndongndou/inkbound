**Lane:** shaders (Lethabo). Design: Renda
**Priority:** MUST. It closes the largest named gap in the 15% 3D Effects band
**PRD:** rubric, 3D Effects ("textures used for more than colour (bump maps, height maps)", "reflections")
**Cost:** M
**Depends on:** nothing. #197 (dynamic sky) calls `refresh()` on the probe this adds

### Context

The brief's A band for 3D Effects reads: "Multiple advanced effects (lighting, shadows, reflections, skybox, etc.) … Application of textures for enhanced 3D effects (bump map, height map, etc.)". A rubric check against the code on 30 Oct found:

- **no bump, normal or height map anywhere**
- **no reflection of any kind**

Both gaps sit on the one surface the markers will look at hardest. The paint shader (`src/shaders/paint-material.js`) lights every surface with a flat `0.35 + 0.65 × diffuse`. Fresh paint and dead grey have exactly the same sheen; only the colour differs.

Splatoon's ink is the reference: it **stands proud of the surface, glistens, and catches the sky**. That's what makes it read as wet liquid rather than a decal.

### The design

**The paint map is already a height map. Use it as one.**

1. **Height.** In the fragment shader, sample the paint map's painted mask (`id > 0`) on a 3 × 3 neighbourhood with bilinear weights. That gives a smooth 0..1 "thickness" `h` that is 1 inside a blob and falls off at the edges. Add a low-amplitude value noise (`PAINT_WET.noiseScale`) so the top of a blob isn't flat.
2. **Normal.** Take finite differences of `h` in uv (`dh/du`, `dh/dv`), scaled by `PAINT_WET.bumpStrength`, and tilt the surface normal by them. Painted blobs now have edges that slope, so light catches their rims. This is a **height map → normal**, exactly the technique the rubric names.
3. **Gloss.** A Blinn-Phong specular from `uLightDir` with the perturbed normal, **on painted cells only**. Grey stays matte: Corp grey is dead and dry, colour is alive and wet. The contrast is the point.
4. **Reflection.** A `samplerCube uEnvMap` holding the level's sky, sampled at `reflect(-viewDir, n)`. Weight it by a Schlick Fresnel term (`PAINT_WET.fresnelPower`), so paint mirrors the sky at grazing angles and shows its colour head-on. Painted cells only.
5. **Drying.** Optional, if cheap: if the paint map grows an "age" channel, gloss fades from 1 to `PAINT_WET.dryGloss` over `PAINT_WET.dryTime`. If it doesn't exist, skip it. Fresh vs dried paint is a later polish.

**The environment map: `SkyProbe`.** A new `src/shaders/sky-probe.js` holds a `THREE.CubeCamera` (`PAINT_WET.envSize`, 64 or 128 px), which renders **only the level's `atmosphere` group**, on its own layer. It renders once at load, then only when something calls `refresh()`. One probe per level, shared by every paint material through one uniform. It renders the sky dome only, so its cost is trivial.

### Rules

- **AGENTS rule 5:** the paint material keeps its own `uLightDir`. The specular reads the same vector, so it's already lit from the right side.
- **AGENTS rule 6:** the probe's render target is disposed with the level.
- **Config:** every number goes in a `PAINT_WET` block: `bumpStrength`, `noiseScale`, `shininess`, `specular`, `fresnelPower`, `reflectStrength`, `envSize`, plus the optional `dryTime` and `dryGloss`.
- **Readability rule:** colour must stay readable. Reflection is capped by `reflectStrength` (start at 0.35), so blue never reads as sky grey. Check `tests/paint-readability.test.js` still passes.

### Scope — files you may touch

- `src/shaders/paint-material.js`
- `src/shaders/sky-probe.js` (new)
- `src/config.js` (`PAINT_WET`)
- `src/shaders/index.js` (export)
- `tests/`

**Not** the levels. Each level needs one line to create the probe after `applyMood`. Renda adds that, and the issue body lists the call.

### Acceptance criteria

- [ ] The paint material has uniforms `uEnvMap` and `uWet`, and the shader compiles: a test builds the material and checks the uniforms are present.
- [ ] A painted cell's specular is non-zero facing the light; a grey cell's is zero. A pure-function test of the GLSL maths ported to JS is fine.
- [ ] `SkyProbe` renders once on construction and again only on `refresh()`. Test with a counting stub renderer.
- [ ] Ten level reloads leak nothing (the existing leak test still passes, now including the probe's target).
- [ ] `paint-readability` tests pass.
- [ ] `npm test` passes.

### Manual check (Renda)

1. Outskirts, island A. Paint a strip and walk alongside it at a low angle: the paint mirrors the sky; head-on it's its own colour.
2. Turn so the sun is behind the strip: the rims of the blobs catch light, and the grey around them doesn't.
3. Last Colour: blue still reads as blue under the amber haze.

### What to say in the demo

"Our paint map is a texture, so it's also a height map. The fragment shader takes its gradient to bend the normal, then uses that normal for a specular and an environment-map reflection of the sky, with a Fresnel weight. Grey stays matte on purpose: Corp's world is dry."
