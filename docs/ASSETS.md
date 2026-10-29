# Assets

The pipeline decisions and the shopping list. **Attribution is legally required for CC-BY** — log every download here the moment it lands, then reflect it in `src/ui/credits.js`.

---

## Pipeline rules

- **One asset family per category.** Mixed families are unified by the art direction, not by hope.
- **Validate before mass download.** Load ONE GLB and confirm the paint shader colours a `SkinnedMesh`, and that the file size and draw cost are acceptable. If that spike fails, fall back to well-shaded boxes — behaviour work continues regardless.
- **Style unification trick:** the lore excuses the mix. Everything colourless (enemies, the military base) is forced through the same flat grey toon treatment; colour belongs to the vibrant Quaternius family.
- **Custom models are cut first if behind.** `DESIGN.md` is explicit: a well-shaded box beats a badly-imported model.
- **Paint pellets are built in code** — a stretched sphere plus a trail. Do not download them.

### Spike result — the wall-crawler (#114)

The one-GLB validation, run on the hardest case in the shopping list: Quaternius
"Zombie half", a different rig, a different scale and a crawl clip set. Measured
rather than eyeballed — `tests/wall-crawler-spike.test.js` opens the shipped file
and re-measures it on every `npm test`, so these numbers cannot rot silently.

| Measurement | Value | Verdict |
|---|---|---|
| File size | 268 KB downloaded, **256 KB** after the texture strip | fine |
| Draw calls | **1** (one skinned mesh, 4 774 triangles) | better than the soldiers' 16 |
| Rig | 1 SkinnedMesh, 12 bones — the **first skinned mesh in the project**; the soldiers are ten rigid parts with no skin at all | new territory, and it works |
| Clips | 9: Idle, Crawl, Run, Walk, Jump, Jump_Idle, Jump_Land, HitReact, Death — **no attack clip** | usable; `Jump` stands in |
| Clip names | prefixed `CharacterArmature\|`, not `Armature\|` | **broke the loader**, fixed in `findClip` |
| Authored height | 0.928 m standing, scaled to 1.6 m | normalised by `fitModelToHeight` |
| Feet during `Crawl` | 5 cm **below** the bind-pose floor (`Run` kicks 12 cm below it) | **would have crawled through the ground**, fixed by measuring the clip |

Five more models at roughly this cost: about **256 KB and 1 draw call each**, so
the whole enemy roster adds ~1.3 MB and five draw calls — against 16 draw calls
for a single soldier today. Size and cost are not the constraint.

**Two things the soldiers never exposed**, because they are rigid parts in a
standing pose and this file is not:

1. **A skinned mesh's bounding box describes its bind pose, not its clips.** The
   crawl plants hands and knees 5 cm under the soles of the pose it is measured
   in. `sampledMinY` now applies the bone matrices and the fit is told where the
   floor really is. Residual cost, recorded honestly: one offset for all clips
   leaves `Idle` hovering ~5 cm. A per-clip offset removes it and is the first
   thing to add if the hover reads badly on screen.
2. **The fake gait only exists because the soldiers cannot animate their legs.**
   This model has hips and legs, so the bob would double the clip's own motion
   and the lean would tip a crawling model forward off its hands. `_gait` now
   switches itself off for any model with a skeleton.

**GO for M5–M8**, on three conditions: one draw call and ~256 KB per model is
affordable; the loader now tolerates any rig prefix, so a new pack needs no code
change; and the floor must be measured per model, never assumed from the bind
pose. **NO-GO on one thing:** no clip in this pack reads as an attack, so an
enemy whose attack has to LOOK like one (Big Arm's slam, M8) needs a borrowed
clip or animation work. Budget that before promising M8.


### The rest of the family (#116)

Three of the four remaining enemies, same pack, same rig, same
`CharacterArmature|` clip prefix, so `findClip` needed no new code. Measured by
`tests/enemy-models.test.js`, which re-opens all three files on every `npm test`:

| Model | File | Bind height | Lowest clip | Fitted to |
|---|---|---|---|---|
| Drainer | `zombie-drainer.glb`, 912 KB | 1.194 m | `Crawl` -0.055 | 1.6 m |
| Charger zombie | `zombie-charger.glb`, 639 KB | 1.517 m | `Walk` -0.106 | 1.6 m |
| Big Arm | `zombie-big-arm.glb`, 598 KB | 1.464 m | `Walk` -0.079 | **2.4 m** |

Two findings worth keeping:

1. **Big Arm's bind pose floats 18 cm above its own origin** (`min.y +0.176`).
   Every other model in the project sits at ~0. Fitting it from the bounding box
   alone, the way the soldiers are fitted, would sink it through the floor by
   exactly that much. It is the clearest case yet for "the floor comes from the
   clip, not the bind pose".
2. **Big Arm is not a scaled-up soldier.** At the shared 1.6 m it is 1.85 m wide
   and 1.6 m tall: wide, short, and nothing anyone reads as a boss from 30 m. It
   gets its own height (2.4 m) and ends up with roughly 2.8 m of arm and
   shoulder. That is the M8 design note turned into arithmetic.

The clip sets also differ from the wall-crawler's in a way that matters: this
pack **does** have attacks (`Punch`, `Run_Attack`), so the Drainer, the Charger
zombie and the boss each animate their own hit instead of borrowing `Jump`.


## Player

| Asset | Source | Licence |
|---|---|---|
| Girl soldier | https://poly.pizza/m/oAArCNHjFB (Quaternius) | **CC-BY** |
| Guy soldier | https://poly.pizza/m/Btfn3G5Xv4 (Quaternius) | CC0 |
| Gun viewmodel — **Sci-Fi Gun Pack** | https://poly.pizza/bundle/Scifi-Gun-Pack-rBroUbKkqM (Quaternius) | CC0 |

The Sci-Fi Gun Pack **replaced** the Kenney Blaster Kit, so that all player-side assets stay in one family.

## Enemies

| Asset | Source | Licence |
|---|---|---|
| Soldier, no gun — Charger | https://poly.pizza/m/p0wFrzSVLS (KolosStudios) | **CC-BY** |
| Soldier, with gun — Sprayer | https://poly.pizza/m/XT8jgwSesV (KolosStudios) | **CC-BY** |
| Zombie 1 — Charger zombie | https://poly.pizza/m/22K0aSZkHV (Quaternius) | **CC-BY** — **downloaded** as `assets/zombie-charger.glb` |
| Zombie 2 — Drainer | https://poly.pizza/m/VlXjG0N8Eg (Quaternius) | CC0 — **downloaded** as `assets/zombie-drainer.glb` |
| Zombie 3 — Big Arm boss | https://poly.pizza/m/KaVJET0WHx (Quaternius) | **CC-BY** — **downloaded** as `assets/zombie-big-arm.glb` |
| Zombie 4, "Zombie half" — Wall-crawler | https://poly.pizza/m/Htcsn9OrXJ (Quaternius) | **CC-BY** — **downloaded** as `assets/wall-crawler.glb`, spike result under Pipeline rules |
| Turret Gun | https://poly.pizza/m/ekTQhbJId7 and https://poly.pizza/m/hThPXDCbwl (Quaternius) | CC0 |
| **Stalker — not yet sourced** | Needs a creature model. Added after this file was written, so no asset was ever chosen | — |

## Environment

| Asset | Source | Licence |
|---|---|---|
| Forest — Stylized Nature MegaKit | https://quaternius.com/packs/stylizednaturemegakit.html (Quaternius) | CC0 |
| Military base — Military Free | https://ithappystudios.com/free/military-free/ (ITHappy Studios) | **Check the pack page before shipping** |

## Animation

| Asset | Source | Notes |
|---|---|---|
| Universal Animation Library | https://quaternius.com/packs/universalanimationlibrary.html (Quaternius) | **Downloaded**, CC0, 43 clips. Not a shared rig, see below |

Only attach clips that are actually driven by a state — idle, locomotion, attack, hit, death. An unused clip is a download and a load cost for nothing.

### Clip audit — Universal Animation Library (#121)

Measured off `UAL1_Standard.glb` from the Standard zip: 43 clips, 65 bones, 7.3 MB.
The `_RM` variant was rejected because its root motion fights `player.js`, which owns
the player's position.

| Wanted | In the pack | Notes |
|---|---|---|
| Jump | `Jump_Start` 1.33 s, `Jump_Loop` 2.50 s | shipped as `assets/player-jump.clips.json` |
| Land | `Jump_Land` 1.27 s | shipped |
| Fall | **none** | hold `Jump_Loop`; there is no airborne loop in the pack |
| Climb | **none** | #122 needs a documented fallback, not a T-pose |

Two things a later reader will trip over:

1. **The rigs do not match**, contrary to this table's old note. The player is 62 bones
   named `Root, Hips, Abdomen, WristL`; the library is 65 named `root, pelvis,
   spine_01, hand_l`. The clips were retargeted bone by bone and baked onto the player
   rig offline, so the game ships plain `AnimationClip`s and does no bone maths at
   runtime. 61 of 62 bones map; the player's `Chest` has no counterpart.
2. **The leap lives in a translation track.** A rotation-only retarget leaves the body
   in place while the legs extend, so the feet pass 17 cm below the floor during
   `Jump_Start`. Physics owns the jump arc, so the fix is the state machine's, not the
   clip's.

Sizes: 471 KB raw, 79 KB gzipped, three clips.

---

## Attribution

Required in `src/ui/credits.js`, which is reachable from the in-game menu. Attribution example:

> Character models by Quaternius (CC0 / CC-BY).
