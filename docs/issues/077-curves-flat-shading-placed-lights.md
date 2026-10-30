**Lane:** levels (Renda)
**Priority:** SHOULD
**PRD:** rubric, 3D Effects ("curves, surfaces", "smooth and flat shading", "multiple light sources")
**Cost:** S–M
**Depends on:** #195 (point light pool) for the lights part. The curves and shading parts depend on nothing

### Context

The rubric check on 30 Oct found:

- **no curves or curved surfaces anywhere.** Every level is built from boxes and cylinders; no `Curve`, `TubeGeometry` or `LatheGeometry` appears in `src/`.
- **flat shading used in exactly one place**, so the "smooth versus flat" contrast the rubric asks about can't be pointed at.
- **no point lights** (#195 makes them possible; this issue places them).

All three are set dressing, which makes them a levels job. They also fix a visual complaint from the polish audit: the levels read as stacked boxes.

### The design

**Curves: cables, hoses and pipes, as `TubeGeometry` along a `CatmullRomCurve3`.** One helper, `cable(points, radius, sag)`, in a new `src/levels/curves.js`. It adds a catenary-ish sag between the given points, then sweeps a tube along it.

| Level | Where |
|---|---|
| Ascent | The supply lift's haul cables, from the summit gantry down the mountain. They also point the player at the goal. |
| Last Colour | Hoses from the Siphon to the vats, and cable runs along the hangar roof |
| Outskirts | A sagging power line between the tower and island C |

**Surfaces of revolution: `LatheGeometry`** for Last Colour's vats and the Siphon's tank. One profile of points each, spun round, instead of stacked cylinders.

**Flat versus smooth, on purpose:**

- **Corp's machinery and the Ascent's rock scree:** `flatShading: true`. Hard facets read as cold and manufactured, or as rough rock.
- **Paint and anything alive:** smooth.

This is one material flag per prop, plus a sentence in the level docs so the team can point at it in the demo.

**Placed lights (after #195):** register sources with the pool.

| Light | Colour |
|---|---|
| The vent and the crusher | amber, while armed |
| Beacons and objective markers | marker white |
| The Siphon | sickly grey-violet, pulsing with its drain |
| The Primer's leading lamps | warm |

At most 4 are lit at once, so use them where they mean something.

### Rules

- **Config:** a `CURVES` block (tube segments, radial segments, default sag) and light colours via `DANGER.amber` and `MARKER`. No new colour literals.
- **Draw calls:** merge each level's cables into one geometry where possible. A hangar roof of 20 separate tubes is 20 draw calls.
- **AGENTS rule 5:** tubes use built-in or toon materials. If they use the custom toon material, add them to the level's `uLightDir` pass.
- **AGENTS rule 6:** everything goes under `level.root`.

### Scope — files you may touch

- `src/levels/curves.js` (new)
- the level files and layouts
- `src/config.js`
- `docs/levels/*` (one sentence each on flat versus smooth)
- `tests/`

### Acceptance criteria

- [ ] `cable()` returns a tube whose midpoint sags below the straight line between its ends by the configured amount.
- [ ] The Ascent, Last Colour and Outskirts each contain at least one `TubeGeometry`, and Last Colour at least one `LatheGeometry` (level contract test).
- [ ] Each level's cables are at most 2 draw calls.
- [ ] Ten reloads leak nothing.
- [ ] `npm test` passes.

### Manual check

The Ascent from the trailhead: the haul cables lead your eye up to the gantry. Last Colour: the vats are round, not stacked cylinders, and the Siphon glows.
