# Inkbound — Enemy Spec

Team-facing companion to `DESIGN.md`. This is the agreed roster: what each enemy
*is for*, what it does, how the player is meant to answer it, and which model
plays it. If a behaviour here disagrees with code, the spec is the plan — raise
it in the group chat, don't silently change one side.

---

## The one rule

**Every enemy is a question. Every colour is a differently-shaped answer.**

We do **not** use health bars. An enemy's "health" is how many colour procs it
survives — killing well means *engineering* the death (freeze him, fling him off
a ledge), not holding the trigger. This is the Innovation-band idea
(`DESIGN.md` — "combo weaknesses instead of health bars").

Each level's cast teaches **one new idea** about that rule:
Level 1 → colour roles vs **moving targets**. Level 2 → vs **terrain**.
Level 3 → vs **your territory**.

---

## Colour roles (the two channels)

One verb, two channels.

- **Painted floor = ambient / positional.** Passive, strategic, painted ahead of time.
- **Painted enemy = active round.** Applied by a direct hit, timed, tactical.

| Colour | On the floor | On a direct enemy hit | Role |
|---|---|---|---|
| **Blue** | Ice — enemies slide, can't steer | Slow → builds up → **freeze → crit window** | Damage setup |
| **Red** | Bounce pads | **Knockback explosion** (fling into walls, ledges, other enemies) | Displacement |
| **Green** | Climbable | **Hard pin** — immediate root, no buildup | Control |

**Buildup-then-proc:** blue is the only colour that builds. Three blue hits in a
window → frozen (obvious white/frost shell) → next shot crits. Tune as roughly
`hits ≈ enemy HP / 3` so it is a reward, not a skip button.

Freeze is also the reason **ADS exists**: zoom in for the frozen headshot.

---

## Settled behaviour rules

These apply to every enemy unless a section says otherwise:

1. **Green pin removes movement, not threat.** A pinned enemy is stationary but
   can still attack (a pinned Sprayer keeps spraying).
2. **Red knockback damages on impact.** Slamming an enemy into wall geometry
   hurts it — environmental kills are rewarded.
3. **Every attack telegraphs.** Windup flash + sound before every melee/ranged
   attack. Readability is what makes difficulty feel *fair*.
4. **No bullet friendly fire.** Enemy bullets don't hurt other enemies, but
   flung bodies **do** collide — clumping enemies pays off.
5. **One class, five configs** stays for beta. Personality = numbers + one
   gimmick + one animation, not a new skeleton.
6. **Telegraph from distance.** Effects must read from ~10 m (frost shell, pin
   stakes). The L1 Charger teaches paint-as-weapon without any tutorial text.

---

## Roster

### Level 1 — Base guards · "colour roles vs moving targets"

**Charger** — the melee one.
- **Model:** soldier, **no gun** — KolosStudios Soldier
  https://poly.pizza/m/p0wFrzSVLS (CC-BY)
- **Behaviour:** patrols; on detection does a windup shout/flash, then a
  **committed straight-line charge**. Fast during the charge, cannot steer.
- **Why it exists:** the tutorial that isn't one. Paint the floor **blue** on his
  charge line and he slides straight past you (`DESIGN.md`). His straight lines
  are both his strength and his weakness.
- **Counters:** green stops a charge mid-way; red flings him; blue floor makes
  him overshoot.
- **Animation:** idle / walk / windup / charge / hit / die.

**Sprayer** — the ranged one.
- **Model:** soldier, **with gun** — KolosStudios Soldier
  https://poly.pizza/m/XT8jgwSesV (CC-BY)
- **Behaviour:** keeps ~8–10 m, strafes slowly, fires **grey bursts that strip
  the player's painted territory** (he fights your paint, not just your HP).
- **Counters:** green pins him — but he *still fires* (rule 1); blue freeze → ADS
  crit; red knocks him off a ledge if he's near one.
- **Animation:** idle / walk / aim / fire / hit / die.

---

### Level 2 — Verticality + statics · "colour roles vs terrain"

**Wall-crawler** — the flanker.
- **Model:** zombie 4, "Zombie half" https://poly.pizza/m/Htcsn9OrXJ (CC-BY)
- **Behaviour:** climbs any surface — **including your green paint**. Drops from
  ledges and ceilings to flank. Teaches: *your tool is also their tool.*
- **Counters:** red knocks it off a wall (it must re-climb — time bought); blue
  freeze mid-climb → it falls + crit window; green pin makes it an easy target.
- **Animation:** crawl / climb / drop / attack / hit / die.

**Turret** — the route problem.
- **Model:** Quaternius Turret Gun
  https://poly.pizza/m/ekTQhbJId7 and
  https://poly.pizza/m/hThPXDCbwl (both CC0)
- **Behaviour:** static, tracks the player, burst-fires down a corridor. You go
  around it, not through it.
- **Deliberate matrix gap — no status procs at all.** Freeze, pin and knockback
  do nothing to it; all three colours simply do damage. Teaches: *not every
  problem is a paint problem* — the empty cell is the lesson.
- **Counter:** break line of sight and flank it. Positioning, not paint.
- **Animation:** idle / track / fire / hit / destroy.

---

### Level 3 — The horde · "colour roles vs your territory"

**Drainer** — the territory eater.
- **Model:** zombie 2 https://poly.pizza/m/VlXjG0N8Eg (**CC0**)
- **Behaviour:** weak, fast, **dozens**. **Eats painted ground** — your territory
  shrinks while you fight.
- **The drain, as built (#80)** — `src/enemies/enemy.js` `_updateFeeding`, the
  numbers in `ENEMY.drainer`:
  - **Reach** `drainRadius` **1.6 m**. A cell outside it is a cell it is not
    touching; the hole grows outward from the body, nearest cell first.
  - **Rate** `drainRate` **16 painted cells per second**. At 4 cells/m
    (`PAINT_GRID.level1Cells`) that is **1 m² of painted ground per second**,
    which is roughly one paint splat (`PAINT_GUN.radius` 1.4 → ~6 m²) every six
    seconds. **This is the difficulty dial for the whole final level — retune it
    last, once the waves exist, and change this line with it.**
  - **Interrupt** `huntRadius` **8 m**: the player this close and it stands up to
    hunt, and the drain stops. `resumeRadius` **14 m**: it only lies back down to
    feed past that. The 6 m gap is deliberate hysteresis — one threshold would
    flip the posture every other frame on the boundary.
  - A dead Drainer stops eating where it stood; it does not finish the patch.
- **Two postures (uses both animation sets):**
  - **Feeding** — crawling, nibbling painted ground, low threat.
  - **Hunting** — rises to stand and shambles after you.
  Craft: catch them *feeding* to interrupt the drain, or they rise into a swarm.
- **Counters:** any colour hurts it; red knockback into clusters pays off most
  (bodies collide — rule 4).
- **Animation:** crawl (feed) / rise / walk (hunt) / attack / hit / die.

**Charger zombie** — the melee runner.
- **Model:** zombie 1 https://poly.pizza/m/22K0aSZkHV (CC-BY)
- **Behaviour:** tankier and dumber than the drainer. Straight-lines at you to
  pressure while the drainers eat your ground.
- **Counters:** same as the L1 Charger, but it doesn't stop for the windup as
  long — pressure, not precision.
- **Animation:** idle / walk / charge / hit / die.

**Boss — "Big arm"** — the combo showcase.
- **Model:** zombie 3, "Big arm" https://poly.pizza/m/KaVJET0WHx (CC-BY)
- **Role:** the **wave-three arena boss**, not the finale. High HP pool,
  **repaints the arena grey** (takes your territory), spawns waves, and dies to
  one colour combo — blue freeze → green pin → red knockdown — landed once per phase, three times (`src/enemies/boss.js`).
- **Then the level still has to end:** after Big Arm falls, the **Siphon** is the
  final exam — a structure dismantled with blue, green and red in sequence. No
  health bar, no rig and no new animation set.
- **Note:** the model is literally a big-armed creature — its silhouette reads
  "boss" from across the arena, which is exactly what you want.
- **Special attacks:** TBD (own design session).
- **Animation:** idle / walk / slam / roar / hit / die.

---

## Implementation notes

**Pipeline spike first.** Before attaching four models: load **one** GLB, confirm
the paint shader (`src/shaders/`) colours a **SkinnedMesh**, and that a
crawl/prone clip doesn't break the root/capsule. If the spike fails, fall back
to well-shaded boxes (`DESIGN.md` cut-first clause) — behaviour work continues
regardless.

**Lane ownership.**
- Behaviour code → mechanics trio (led by `shaders/`, with paint + core feeding in).
- Model attachment + GLB/animation pipeline → `shaders/` owner.
- Spawn placement, counts, arena shape, tuning → `levels/` (Renda).

**Animations needed per enemy:** idle, locomotion, attack (+telegraph), hit,
death. Only attach clips that are actually driven by state.

---

## Credits (attribution is legally required for CC-BY)

Log every download the moment it lands, then fill `src/ui/credits.js`.

| Asset | Author | License |
|---|---|---|
| Girl soldier (player) https://poly.pizza/m/oAArCNHjFB | Quaternius | **CC-BY** |
| SWAT / guy soldier (player) https://poly.pizza/m/Btfn3G5Xv4 | Quaternius | CC0 |
| KolosStudios Soldier ×2 (L1) | KolosStudios | **CC-BY** |
| Zombie 1 — charger zombie | Quaternius | **CC-BY** |
| Zombie 2 — drainer | Quaternius | CC0 |
| Zombie 3 — "Big arm" boss | Quaternius | **CC-BY** |
| Zombie 4 — "Zombie half" wall-crawler | Quaternius | **CC-BY** |
| Turret Gun ×2 https://poly.pizza/m/ekTQhbJId7 · https://poly.pizza/m/hThPXDCbwl | Quaternius | CC0 |
| Sci-Fi Gun Pack (player gun) https://poly.pizza/bundle/Scifi-Gun-Pack-rBroUbKkqM | Quaternius | CC0 |
| Stylized Nature MegaKit (forest) | Quaternius | CC0 |
| Military Free (base props) https://ithappystudios.com/free/military-free/ | ITHappy Studios | Check pack page before shipping |

Attribution example: `Character models by Quaternius (CC0 / CC-BY)`.
