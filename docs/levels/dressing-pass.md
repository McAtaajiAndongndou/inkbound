# Dressing pass — making the levels look finished

**Lane:** levels (Renda). **Status:** design, 30 Oct 2026. Build follows in its own session.
**Pass question:** *from every room's eye shot, does this look like a place, or like a blockout?*

## What's wrong (the diagnosis)

Looking at every level in the viewer after #194–#199 landed:

- **Last Colour reads as big grey boxes with a grid on every face.** Its props are knee-high, grey on grey, so they disappear. Above head height there is nothing: walls are blank grid up to 14 m, then they stop, with no ceiling and nothing behind them. #197 now starts the sky drained, which makes the first frame greyer still.
- **The Ascent reads as stacked terraces.** The scree and the R5 gantry help, but every face is the same flat grid.
- **The Primer gets away with it.** It's a training course, and chalk lines and lamps are the right dressing for that.
- **Outskirts works**, because the forest breaks up its silhouette. That is the thing the other three are missing.

There are three causes, and the fixes below are aimed at each:

1. **One texture is doing two jobs.** The paint grid is for readability: it says "you can paint this". On every surface at every height, it also says "unfinished". Splatoon keeps its paintable surfaces plain too, but frames them with set pieces you can't paint (railings, containers, signs, billboards) and a busy skyline. Against that frame, the plain surfaces read as *the floor*, not as unfinished.
2. **The dressing rules push all the detail down to knee height.** Props must stay under 1.2 m on an arena floor (a Drainer must be visible at 20 m) and never collide. That rule is right, but it only covers the **arena floor**. Wall faces above 3 m, wall tops, the space overhead and everything outside the walls are all free, and all empty. Call of Duty maps put most of their density exactly there: in the out-of-bounds frame and above eye level, where it can't block a shot.
3. **The story isn't on show.** This is Corrupt Corp's immortality-pill factory, built on drained colour and failed test subjects, and nothing in the levels says so.

## The technique: dress in three layers, never on the floor

| Layer | Where | What it does | Reference |
|---|---|---|---|
| **1 · Skyline** | Outside the walls and above the wall tops | Gives every room a silhouette and says where you are | CoD's out-of-bounds backdrops; the Ascent's base silhouette already does this |
| **2 · Wall breakup** | Wall faces from 3 m up, wall tops, overhead | Kills the graph-paper read without touching the paintable band the player uses | Splatoon's unpaintable trims and railings framing paintable panels |
| **3 · Story clusters** | One per room, at a rest spot, a doorway or a dead corner | Tells the fiction and gives each room a landmark you can name | Half-Life's environmental storytelling; *Gris*' rooms that each have one image |

The arena floor itself is **not** dressed in this pass: the 1.2 m rule and the keep-outs stand.

## Rules (all existing — this pass adds none)

- **No collision**, except props that replace existing cover. Enemies path around walls, so a colliding crate changes the fight.
- **Keep-outs stay tested:** off every paint strip, climb and route point; no prop across a beacon sightline from any room eye (the Last Colour, Ascent and Outskirts sightline tests); clear of the mission intro's camera path (`mission-intro.test.js`).
- **Grey only.** Colour belongs to the player. **Amber means danger** (#126) and **marker white means "here"**: neither is decoration. The Primer's warm tungsten is the rebels' light. Corp **signage** may use the Corp grey-violet (`GATE.field`) as its one accent.
- **Flat-shaded Corp machinery, smooth curves and paint** (#198's split; use `flat()` from `curves.js`).
- **Built-in materials**, so nothing joins the `uLightDir` pass. A custom-shaded prop must be added to it (AGENTS rule 5).
- **Instanced by kind**, so a hundred ribs cost one draw call. **Budget:** at most **+15 draw calls per level**, measured with `renderer.info.render.calls` in the viewer, before and after.
- **Disposed with the level** (rule 6). The ten-reloads tests must pass with the new meshes counted.
- **Every number and colour in `config.js`; positions in the layout files** (`src/levels/layouts/*.js`, or `L1` for Outskirts).
- **Procedural first.** Use the existing prop kit, lathes and cables, plus the MegaKit (CC0, already shipped) for anything natural. **No new downloads in this pass**; see the open decisions.
- **Frame time:** measure with the Last Colour viewer's `viewer.timeRender()` before and after. The pass may cost at most **+1 ms**.

## Level by level

### Last Colour — the Corp facility (biggest job)

**Skyline.** The facility outside: three or four flat-shaded factory blocks and two chimney stacks past the Core's walls, built like the Ascent's base silhouette (dark, unfogged, sunk below the floor so they rise out of the dark). The Siphon's mast stays the tallest thing.

**Wall breakup (all rooms):**
- **Ribs:** vertical steel pilasters every 6 m, from 3 m up to the wall top, as one instanced kind.
- **A cornice at the wall top**, so walls end in a lip instead of a cut edge.
- **High pipe runs and cable trays** along the hangar and Core walls at 9–12 m. The kit's pipes, plus #198's cables.
- **Hangar roof trusses.** A partial roof frame of beams across the hangar at 12 m: you see a ceiling's structure, but not a lid. It must stay clear of the beacon sightlines and the intro camera, which tests already check.

**Story clusters:**
- **R0 Lift Landing:** a stacked delivery of grey pill crates with Corp stencils, waiting at the lift.
- **R1 The Hangar:** a dead **pill production line** along one wall at 4–6 m: a conveyor on legs, hoppers, a capping machine. Out of reach, and it says "factory" at a glance.
- **R2 The Corridor:** a wall-mounted **specimen rack**, glass-fronted tubes with grey silhouettes (failed test subjects), above the walkway.
- **R3 The Core:** the vats from #198, plus **gantry walkways** along the north wall-top between them, and hazard stripes in grey-violet.
- **R4 Big Arm:** a **broken containment cage** with its bars bent out, on the wall above the arena. Big Arm got out of it.
- **R5 The Siphon:** pipes from the Siphon's base into the floor drains, with grey "drain" puddles around them. Decals, not paint: they must never read as player paint.

### The Ascent — a mountain the Corp mined

**Skyline.** The mountain needs a range around it. Two or three distant peaks, flat-shaded lathes or icosahedra scaled huge, dark against the dawn, behind the summit and to the east.

**Wall breakup:**
- The **MegaKit pines and dead trees on the terrace edges and slope bases**. ASSETS.md already recommends this, and `Decor` places them, thinning with height.
- **Rock strata bands** on the big faces: horizontal flat-shaded slabs set into the faces above the climbing line.

**Story clusters:**
- **R0 Trailhead:** a Corp checkpoint shed and a barrier arm, with the haul cables (#198) anchored beside it.
- **R2 Terrace One:** abandoned drill rigs and core-sample crates at the edge.
- **R4 Terrace Two:** a collapsed survey mast lying across the far corner.
- **R7 Summit:** a wind-torn Corp flag, grey with a grey-violet stripe, by the lift tower.

### Outskirts — already the best; finish the frame

**Skyline.** The facility's chimneys on the horizon past the tower: the same silhouette blocks as Last Colour, so the campaign's goal is visible from its first outdoor level.

**Story clusters:**
- **Island A:** a rebel camp corner, with crates, a tarp and a lamp in warm tungsten, the Primer's colour.
- **Island C:** a toppled Corp billboard advertising the immortality pill. It is the fiction's first image, so make it the one landmark you remember.

### The Primer — leave it

Its look is right for a training course. **One addition:** rebel graffiti stencils on the R0 desk wall, in chalk cream (`PRIMER.dressing.chalk`).

## Done when

- **Viewer shots:** every room-eye shot (`static SHOTS` / the layout `rooms`) of Last Colour and the Ascent, before and after, plus Outskirts' spawn and the island C eye. Agree each after-shot reads as a place, not a blockout.
- **Tests:** all existing tests pass. Add one test per level that every new mesh is under `level.root`, instanced where repeated, non-colliding, and outside the keep-outs, and extend the sightline and ten-reloads tests to the new meshes.
- **Budgets met:** +15 draw calls and +1 ms per level at most.
- **Readability:** `tests/paint-readability.test.js` passes, and in the after-shots no prop reads as a paint colour or as amber.

## Order (if time runs short, stop after any step)

1. **Last Colour wall breakup and skyline:** the worst offender and the biggest win.
2. **Last Colour story clusters**, hangar and Core first.
3. **The Ascent: MegaKit trees and the distant range.**
4. **Outskirts: the chimneys and the billboard.**
5. **The Ascent's story clusters and the Primer's stencils.**

## Open decisions for Renda (recommended defaults first)

1. **Downloads.** *Default: none.* Everything above can be procedural, plus the MegaKit we already ship. Alternative: Quaternius' Sci-Fi Essentials or Kenney's Conveyor Kit for the pill line and gantries (both CC0 on their pack pages per ASSETS.md). That looks better, but costs a validation pass per model and needs your OK for each download.
2. **The hangar roof.** *Default: trusses only* (structure, no lid), so the sky and its #197 warm-up stay visible. Alternative: a full roof with skylights, which reads more "indoors" but hides the dynamic sky in R1.
3. **Signage text.** *Default: no words.* Use the Corp's pill icon and stripes only: no font asset, and it reads at any distance. Alternative: canvas-texture slogans ("LIVE FOREVER"), which are funnier but small.

## Build log

The open decisions were built at their defaults: **no downloads**, **trusses only**, **no words** (the pill icon and grey-violet stripes). Renda can still overturn any of them.

The builder is `src/levels/dressing.js`. Each item is a box with a kind, and each kind's colour, shape and look live in `DRESSING.kinds` in `config.js`. Items are instanced by shape and look, with the kind's colour set per instance, so a level's whole dressing costs four to six draw calls. Tests: `tests/dressing.test.js`.

### Last Colour (steps 1 and 2)

- **Wall breakup.** Ribs and cornices are computed from the layout's walls (`wallBreakup`), so they follow when a wall moves. A rib starts 3 m above whatever top sits at its foot, so behind a 5 m gantry it starts at 8 m. High pipes and cable trays run along the hangar and the Core.
- **Trusses.** Full spans sit at z 64, 70 and 76 only. Further north, the R0 and R1 beacon lines and the intro camera cross the hangar at truss height, so the trusses at z 46, 52 and 58 stop 9 m short of the axis. This leaves a slot down the middle, and the landing test checks the beacon from every point on the landing.
- **Skyline.** Five blocks, two plant rooms and two stacks. Every top is under the mast (27 m, tested). The north blocks sit close behind the Core so they clear its 14 m wall from the R3 eye.
- **Clusters:** as the doc lists them, with one change. **R5 has no drain puddles.** A decal on the floor hides the paint underneath it, so the Siphon's pipes end in low elbows (under 1.2 m) instead. The corner pipes are `mount: 'siphon'`: they hug the Siphon, so they hide nothing it does not already hide (tested within 0.6 m).
- **Budget:** +6 draw calls at most (R0/R1 eyes; four to six from other eyes). Frame time is within noise: the worst eye (R2) measured +0.3 ms on best-of-runs, A/B with the dressing hidden and shown in the same session.

### The Ascent (step 3)

- **Trees.** MegaKit pines and dead trees, placed by hand from `ASCENT.dressing.trees` through `Decor` with the new `ASCENT_KINDS` and no scatter. They stand only where nobody fights: the trailhead's rim (|x| ≥ 17), the scree under the catwalk, and the west catch shelf under the ledge. Pines grow low and dead trees grow high, and nothing stands on the summit (tested). There are two models per kind, because every variant costs a draw call per material. The trees' toon materials join the light-direction pass.
- **The range.** Two ridges of overlapping peaks, to the north and the east, inside the sky dome. They are a shade lighter than the base, so the base still reads in front of them from the summit (tested).
- **Strata.** Warm stone bands set into the big faces, starting at least 3 m above the floor at their foot and kept clear of the climb strips.
- **Budget:** +8 draw calls at most, with every tree model loaded. Frame time was +0.4 ms at the R0 eye on best-of-runs and +0.7 ms on the median, measured A/B. The trees are the heavy part.

### Outskirts (step 4)

- **Skyline.** The same blocks and stacks as Last Colour, placed past the tower (z −106 to −175) and wide of the axis, so the beacon is still the thing you look at. Positions are in `L1.dressing`.
- **The billboard.** A 12 × 6 m Corp board with the pill and stripes on it, fallen back on the east forest shelf beside island C, on one held leg and one buckled one. Its pieces are rotated as one thing about the board's foot. A new `decorAvoid` rect keeps the backdrop forest from growing through it. It is out of the walk: nothing sits over a non-shelf floor (tested), and it is across 8 m of lethal lake.
- **Budget:** +5 draw calls, and +0.3 ms at most on best-of-runs.

### The Ascent's story clusters (step 5)

- **R0:** the checkpoint shed stands on stilts off the trailhead's south lip, not on it, because a 2.5 m shed on the floor would break the 1.2 m rule. Beside it are a barrier arm left raised, and concrete anchors at the haul cables' feet (tested).
- **R2:** a drill rig on the scree below Terrace One's east edge, and core-sample crates in Terrace One's corner, kept under 1.2 m.
- **R4:** the survey mast lies across the high deck.
- **R7:** a torn grey flag with a grey-violet stripe stands by the lift tower.
- **A new test rule: thin things.** A post, a leg, a flagpole or a raised arm, where two of its three sizes are 0.3 m or less, cannot hide anything, so it may stand taller than 1.2 m. Tilted items are now checked by their real (world) extent.
- **Budget:** +9 draw calls at most for the whole Ascent pass, and +0.2 to +0.6 ms on best-of-runs, measured A/B.
