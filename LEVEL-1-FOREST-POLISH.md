# Level 1 — Forest polish (dressing + lighting)

**Status:** steps 1–5 built (15 Oct 2026, on `issue-57-l1-forest`). Step 5 lands 55
trees rather than the 100+ below — see "What step 5 actually landed" at the bottom.
**Written:** 15 Oct 2026 — one day before the beta milestone
**Author:** Renda (levels), with a large Lethabo (shaders) dependency

---

## What actually landed

The goal turned out to be bigger than "trees", and this document was written for
a smaller version of it. Where the plan says **forest**, read **decor**: the whole
environment is grey and comes back to colour when you paint the ground under it.
That is now trees, bushes, rocks, grass, flowers and stumps — 249 props, one
system (`src/levels/decor.js`).

Three of this document's numbers did not survive contact with the level, and all
three are worth knowing before anyone re-reads it:

**1. 249 props, not the 100+ trees the plan asked for.** The rule "every prop
stands on a floor" (step 2, and `tests/level-01-decor.test.js`) is what caps it.
L1's floors are a 16-wide corridor through five islands — there is no ground
outside it, so anything placed out there floats over the void. To get past that
the LEVEL needs more ground, not the decor module. The density knobs are
`step` / `spacing` / `edge` per kind in `KINDS`.

The performance point step 5 was actually making is met regardless: the whole
dressed level costs **21 InstancedMesh draw calls**, against 498 meshes' worth of
geometry if every prop were placed by hand.

**2. Per-tree colour with instancing did not need Lethabo's shader.** This
document says the custom toon shader cannot do `instanceColor` and suggests
asking `shaders/`, or switching to `MeshToonMaterial`. Neither was necessary:
the colour already lives in a shared material, so a prop changes colour by
MOVING to a different `InstancedMesh` that draws the same geometry with a
different material.

**3. The MegaKit itself was NOT used, at first.** Its free download is an itch.io
ZIP behind a CSRF-token POST, which will not download from an automated browser —
two attempts, both 0 bytes. Renda downloaded it by hand, and the level now runs on
**30 of its 68 glTF models**: trees, twisted trees, dead trees, bushes, rocks,
pebbles, grass, flowers, ferns, clover and mushrooms. The earlier Quaternius
models from poly.pizza were the same author and the same style line, but were
**not** the MegaKit, and are gone.

Packed from `.gltf` + `.bin` into texture-free `.glb` by `tools/gltf-to-glb.mjs`
(4.3 MB for 30 models). Every model is normalised to its kind's height, because
the pack's native heights run from 0.1 (a pebble) to 18.9 (a twisted tree) — 189x
apart — and every one has a different pivot.

**4. A real bug fell out of step 3.** `createToonMaterial` defaults `uLightDir`
to `(0.5, 1.0, 0.3)`, which is NOT the sun's vector, and `_lightDirection()`
walked `this.surfaces` only. So the trees added in step 2 were lit from a
different direction than the ground they stand on — the exact thing #57 was
opened to fix. Fixed, and the test was extended to cover the decor palette and
verified to fail without the fix.

**WHAT IT COSTS** (measured, 377 props, 36 live draw calls):

| | before MegaKit | with MegaKit |
|---|---|---|
| props | 249 | 377 |
| live draw calls | 21 | 36 |
| triangles | 213,433 | 554,379 |
| vertices | — | 780,189 |

2.6x the geometry, for a much richer level. The MegaKit's trees are 3-5x the
vertex cost of what they replaced, and its twisted trees are 14-15k vertices
each. Frustum culling is ON and correct (see `_newBucket`), so a corridor view
submits a fraction of that — but **the frame rate has still not been measured on
a real machine**, and that is the number that matters.

`Mushroom_Laetiporus` is deliberately excluded: 1,806 vertices for a 45cm
mushroom is 3,216 triangles per instance, heavier than a whole tree in the
previous set.

**Still not done, and worth being honest about:**

- **Nobody has measured the frame rate.** Step 5 asks for it explicitly and the
  marking cares (DESIGN.md:133). There are draw-call and triangle budgets above,
  but no FPS number from a real machine.
- **The shadow bullet is not just undone, it is currently futile.** `sun.castShadow`
  is on, the player casts a shadow, and the only mesh with `receiveShadow = true`
  is the floor — whose custom shader never samples the shadow map. So a shadow
  map is rendered every frame that nothing can display. Letting props cast shadows
  would add cost and still show nothing until the shaders gain shadow support.
- (Resolved) The step-1 watch-out about `PAINT.grey.hex` being a blue-grey is
  FIXED — see "Cross-lane changes" below. It is now `0x585e54`, the same drained
  family as the decor, and a test asserts it stays there.

---

## Cross-lane changes made for #57 — please review

Four files outside `levels/` were changed to make L1 work. Flagging them together
because `MECHANICS.md:198` asks for a heads-up before editing another lane's file,
and four separate surprises is worse than one list.

| File | Lane | What and why |
|---|---|---|
| `shaders/toon/toon-material.js` | shaders (Lethabo) | **A bug, and it was blocking the whole level.** The vertex shader built its own `mvPosition` and so dropped the `instanceMatrix` multiply that three.js's own `project_vertex` chunk does behind `#ifdef USE_INSTANCING`. Every instance of every `InstancedMesh` rendered at its mesh origin: 377 props stacked on one point, no error, all triangles still counted. **Anyone writing a custom vertex shader in this project needs to know this.** The outline shader had the same latent bug (inert today, enemies are not instanced). |
| `shaders/fog-height.js` | shaders (Lethabo) | `FOG_CEIL` 6 -> 10. The height fog was tuned when L1's props were cones ("gone by y 6"); with a forest the canopy sat above its own fog, so there was mist on the floor and none in the woods. 10 keeps the original intent — the extraction ledge at y 9 is still essentially clear. |
| `shaders/paint-material.js` | shaders (Dikeledi/Lethabo) | **The visible grid is now decoupled from the paint grid.** One visible square is one world metre (`uGridStep`), where it used to be one paint cell: at 4 cells/unit that was a line every 25cm, i.e. 64 lines across a 16m corridor — graph paper, not a readable play space. Line width is divided by the same step so coarsening the grid does not fatten it, and the lines are softer (`0.75` not `0.55`). **Paint resolution is unchanged** — splats behave exactly as before. |
| `config.js` | shared | `PAINT.grey.hex` `0x5a5a66` -> `0x585e54`. That value is the world's ONE dead colour: the ground shader's `uColours[0]` **and the HUD ammo bar in `ui/hud.js`** both read it (so Moses, this one moves the ammo bar from blue-grey to grey-green — deliberate, so the HUD agrees with the floor). The blue-violet read as a different world from the grey-green forest it is standing in. |

The first one is the important one. The other three are tuning, and any of them
is a one-line revert if the owner disagrees.

---

**Still not done:**

- **Nobody has measured the frame rate.** Step 5 asks for it explicitly and the
  marking cares (DESIGN.md:133). There are draw-call and triangle budgets above,
  but no FPS number from a real machine.
- **The shadow bullet is not just undone, it is currently futile.** `sun.castShadow`
  is on, the player casts a shadow, and the only mesh with `receiveShadow = true`
  is the floor — whose custom shader never samples the shadow map. So a shadow
  map is rendered every frame that nothing can display. Letting props cast shadows
  would add cost and still show nothing until the shaders gain shadow support.

---

## Goal

Level 1 is the forest level. Right now it is grey planes and grey boxes.
We want it to **look** like a forest, and to show the world coming back to colour
when the player paints.

Two halves:

1. **Dressing** — trees, rocks, bushes.
2. **Mood** — light colour, fog, sky.

---

## Decide these first — all four now settled

| # | Question | Status |
|---|---|---|
| 1 | Is L1 forest only, or forest **then** a grey military base? | **Still open, and still a design question.** Beta ships forest only. |
| 2 | **Who owns the GLB loader?** | **SETTLED.** `shaders/` owns it: the pipeline is `src/shaders/avatar.js` (characters) plus `game.loadGLB` in `main.js`, which is the one `GLTFLoader`. `src/levels/loader.js` was a stub that threw and was imported by NOTHING, so it is **deleted** — leaving it was an invitation to build the second loader this question existed to prevent. Levels do not import `GLTFLoader`; a level that wants a model takes the optional `game.loadGLB` and falls back to its own geometry when it is absent. |
| 3 | Who owns "grey world becomes colour"? | **Settled in practice.** Lethabo shipped it as #41 (`f6f8755`, grey-world pass + toon colour fix). The forest's paint reaction is the L1 slice of it. |
| 4 | May the level set its own fog and dead-grey colour? | **Yes, and it does** — `Level01._mood()`, `MOOD` at the top of `level-01-mission.js`. `main.js`'s app-wide `Fog(0x0f0f16, 45, 110)` is now the fallback, not the thing L1 uses. Edit `main.js`/`config.js` as normal; say so in chat. |

The old warning — "do not start step 4 or 5 until #2 is settled" — is discharged: all
five steps are built, and no second loader was written.

---

## Two things found in the code

Both were checked in the source, not guessed. Both change the plan.

### 1. The ground lights itself

`paint-material.js:129` gives the paint shader its own light direction:

```js
uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
```

The shader uses `uLightDir`, not the scene lights. So changing the sun in
`main.js` changes the **trees** but not the **ground**.

Fix: set `uLightDir` on every surface from the level, to match the sun.
That is in the levels lane.

### 2. The ground ignores fog

`paint-material.js:96` ends the shader with:

```glsl
gl_FragColor = vec4(colour, 1.0);
```

No fog code, and `createPaintMaterial` does not pass `fog: true`.
So `scene.fog` fogs the trees and the enemies but **not the ground**.

Since the ground is the biggest thing on screen, fog will look broken.
Fix is about 3 lines. That is Lethabo's file.

---

## The 5 steps

| Step | What | Owner | Needs a file download? | Needs another person? |
|---|---|---|---|---|
| 1 | Mood: light + fog | levels (+ shaders for fog) | no | yes, small |
| 2 | Fake trees from simple shapes | levels | no | no |
| 3 | Trees react to paint | levels | no | no |
| 4 | Loader + one real tree | levels, via `game.loadGLB` | yes, 1 file | **no** — loader already existed |
| 5 | Many trees, still fast | levels | yes, 2 packs | **no** — see below |

Steps 1 to 3 needed no downloads. All five are now built; step 4 did not need to
touch `shaders/` after all, because `game.loadGLB` in `main.js` was already the
single loader.

---

## Step 1 — Mood

**Goal:** L1 reads as a forest before any model exists.

**Where:** `src/levels/level-01-mission.js` (own file).
Fog needs `main.js` (shared) and `paint-material.js` (Lethabo).

**Do this:**

1. Add a fill light to `this.root`. Put it in `this.root` so it is removed with the level.
2. Loop over `this.surfaces` and set `material.uniforms.uLightDir.value` to match the
   sun in `main.js` (line 26: position `18, 30, 12`). Now ground and models agree.
3. Set fog from the level: `this.game.scene.fog = new THREE.Fog(...)`.

**Watch out:**

- Fog does not touch the ground until the shader is fixed. See finding 2.
- Dead grey is `PAINT.grey.hex = 0x5a5a66` (`config.js`). That is blue-grey, not forest grey.
- `main.js` sun casts shadows with a shadow camera of only ±30. L1 runs z +18 to −30.

**Done when:** a screenshot reads as a cold grey forest, and the ground and the trees
are lit from the same side.

---

## Step 2 — Fake trees, no downloads

**Goal:** trees in the level with zero risk.

**Where:** a new `_forest()` in the level file.

**Do this:** build a tree from two shapes. `ConeGeometry` for leaves,
`CylinderGeometry` for the trunk. Material from `createToonMaterial(0x5a5a66)`.

**Watch out:**

- Build **one** cone, **one** cylinder, **one** material, and share them.
- Trees do not collide. Keep them out of the play path.

**Done when:** 20 grey trees stand in the level and it still runs smooth.

---

## Step 3 — Trees react to paint

**Goal:** the grey forest wakes up when the player paints near it.

**Where:** `update()` in the level file. Read the ground with `surface-probe.js`
(already `OWNER: E (Levels)`).

**Do this:**

1. Find the floor under a tree with the probe.
2. Read `paintIdAtWorld(point)` → a number 0–3.
3. Turn it into a name with `ID_TO_NAME` (exported by `paint-surface.js`),
   then into a colour with `PAINT[name].hex`.
4. Swap the tree material. Make **4** shared materials up front
   (grey, blue, red, green), then `tree.material = mats[name]`.

**Watch out:**

- Do not allocate a new `Vector3` or `Color` each frame. Reuse one.
  The repo has a test for this: `player.update allocates (almost) nothing per frame`.
- Do not check every tree every frame. Four times a second, near the player only.
- If all trees share one material they all change together. That is why you need 4
  materials and swap between them.

**Done when:** painting the ground turns nearby trees blue, red or green.

---

## Step 4 — One real tree model

**Goal:** one real `.glb` tree in the level.

**Where:** `src/levels/forest.js` `loadModels()`, called from `_forest()` with the
`game.loadGLB` that `main.js` owns. No new loader was needed — see decision #2.

**Do this:** load one tree, place it, replace one fake tree. Keep the fake trees.

**Watch out:**

- **The R race.** Pressing R rebuilds the level. If the model arrives after that, it is
  added to a dead level, leaks, and stays on screen. Add a cancel flag: if the level
  died while loading, drop the result.
- Model files have random sizes and random centre points. Check scale and pivot by hand.
- Finding from closed issue **#48**: a custom `ShaderMaterial` will **not** skin a
  `SkinnedMesh`. Animated models must use three.js's built-in `MeshToonMaterial`.
  This does not matter for trees, but it does for characters.

**Done when:** one real tree stands beside the fake trees at the same size.

---

## Step 5 — Many trees, still fast

**Goal:** a real forest without losing frame rate.

**Where:** `src/levels/forest.js` — `_buildInstances()`. `shaders/` was not needed.

**Do this:** download the Quaternius Stylized Nature MegaKit (CC0).
Files go in `public/assets/`. Use `InstancedMesh`: one model, many copies, one draw call.

**Watch out:**

- Per-tree colour with instancing needs `instanceColor`. The custom toon shader does not
  support it. Either use three.js's own `MeshToonMaterial` for trees, or ask Lethabo.
- Shadows are the other cost. Let only big trees cast shadows.
- Test the frame rate before and after. We are marked on lab PCs (`DESIGN.md:133`).

**Done when:** 100+ trees and the frame rate has not moved.

---

## Related issues

| Issue | State | Note |
|---|---|---|
| **#41** Grey-world aesthetic pass | OPEN | Lethabo. Already lists `level-01-mission.js`. Overlaps this plan. |
| **#48** GLB pipeline spike (one model) | CLOSED | Recorded that custom shaders cannot skin. |
| **#51** PR: GLB spike, Quaternius SWAT soldier | OPEN | Has the loader + one model. Read before writing a second one. |
| **#49** Animated player avatar | OPEN | Blocked by #48. |
| **#50** Animated enemy soldiers | OPEN | Blocked by #48. |
| **#54** Enemies have no activation range | OPEN | Affects L1 spawn behaviour. |
| **#47** Beta QA day | OPEN | Beta milestone. |

---

## Beta reality

The Beta milestone is due **Fri 16 Oct 2026** — the day after this file was written.
16 issues are still open.

`MECHANICS.md:206` says Renda's beta job is:

- widen island B so the Charger fight is winnable
- make Platform 3 pressure the player
- add the encounter gate *(done — #37 and #56)*
- confirm L1 plays start to finish without feeling unfair

Island B and Platform 3 are still open. So this forest plan is mostly **post-beta**,
except Step 1, which is cheap and in-lane.
