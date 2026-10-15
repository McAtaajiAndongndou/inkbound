# Level 1 — Forest polish (dressing + lighting)

**Status:** plan, not started
**Written:** 15 Oct 2026 — one day before the beta milestone
**Author:** Renda (levels), with a large Lethabo (shaders) dependency

---

## Goal

Level 1 is the forest level. Right now it is grey planes and grey boxes.
We want it to **look** like a forest, and to show the world coming back to colour
when the player paints.

Two halves:

1. **Dressing** — trees, rocks, bushes.
2. **Mood** — light colour, fog, sky.

---

## Decide these first

These are open. They change the plan.

| # | Question | Why it matters |
|---|---|---|
| 1 | Is L1 forest only, or forest **then** a grey military base? | `MECHANICS.md:105` and `:151` say forest into a grey military base. Renda says forest only for now. |
| 2 | **Who owns the GLB loader?** | `MECHANICS.md:196` gives the GLB/animation pipeline to **Lethabo**. But `src/levels/loader.js` says `OWNER: E (Levels)` and is still a stub that throws. Also PR **#51** (open) already has a loader + one Quaternius soldier. |
| 3 | Who owns "grey world becomes colour"? | `MECHANICS.md:224` gives it to **Lethabo**. Issue **#41** is open for it and already lists `level-01-mission.js`. |
| 4 | May the level set its own fog and dead-grey colour? | `main.js` and `config.js` are **shared files**. `MECHANICS.md:198` says say so in chat before editing. |

Do not start step 4 or 5 until #2 is settled. Otherwise two people build one loader.

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
| 4 | Loader + one real tree | **unresolved** | yes, 1 file | yes |
| 5 | Many trees, still fast | levels + shaders | yes, full kit | yes |

Steps 1 to 3 need no downloads. Step 1 is the only one that could ship before beta.

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

**Where:** unresolved — see decision #2. Read PR **#51** before writing anything.

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

**Where:** level file + possibly `shaders/` (Lethabo).

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
