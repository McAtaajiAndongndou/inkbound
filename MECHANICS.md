# Inkbound — Mechanics & Direction

**Working agreement from the design session.** This is what the team agreed to
build and *why*. It sits alongside `DESIGN.md` (the full vision) and `ENEMIES.md`
(the roster spec). If reality and this doc disagree, raise it in the group chat
and update the doc — don't let two versions of the game exist.

> **In one sentence:** grey world → shoot paint → colour changes how things move
> → fight enemies who are stealing the world's colour across three missions.

---

## The four pillars

1. **Paint = physics, not decoration.** Blue/red/green change friction,
   restitution and climbability — on floors *and* enemies. This is our
   Innovation-band answer. If it ever becomes "shooter where bullets are
   colourful," we lose the marks.
2. **One verb, two genres.** Splatoon's joy of covering the world × Call of
   Duty's competent shooting. Puzzling and fighting are the *same action*.
3. **Three pressures, three levels.** Same rules every level; the relationship
   to your paint changes (abundance → scarcity → siege).
4. **Readability over realism.** Lab hardware is what we're marked on, so style
   choices are performance choices. Effects must be legible from ~10 m.

---

## Core mechanic — colour roles (v2)

One verb, **two channels**:

- **Painted floor = ambient / positional** — passive, strategic, painted ahead.
- **Painted enemy = active round** — applied by a direct hit, timed, tactical.

| Colour | On the floor | On a direct enemy hit | Role |
|---|---|---|---|
| **Blue** | Ice — enemies slide, can't steer | Slow → builds → **freeze → crit window** | Damage setup |
| **Red** | Bounce pads | **Knockback explosion** (into walls/ledges/enemies) | Displacement |
| **Green** | Climbable | **Hard pin** — instant root, no buildup | Control |

**Buildup-then-proc:** blue is the only building colour. Three hits in a window →
frozen (obvious frost shell) → next shot crits. Freeze is the reason **ADS
exists** (zoom for the frozen headshot). Tune as `hits ≈ HP / 3`.

**We use no health bars.** An enemy's health is how many procs it survives.
Killing well = engineering the death.

### Build tiers (ship in this order)

- **Tier 1 — shot reactions + juice (beta).** Blue slows, red knocks back, green
  pins, plus hit flash, hitmarker and sound. *No juice = "nothing interesting
  happens", even when the systems work.*
- **Tier 2 — buildup.** Freeze → crit; enemies on blue floors slide with no
  steering (the L1 Charger teaching moment).
- **Tier 3 — paintstreak meter.** Coverage + kills fill a meter; spend it for a
  mortar, a splat grenade, or ~5 s of unlimited paint. Pure dopamine loop.

---

## Camera & controls

- **TPV is the default.** Third-person is our Splatoon side.
- **Right-click = ADS.** The camera zooms toward FPV, spread tightens, move speed
  ~50%, sensitivity drops. Commit to the shot, lose your dodge.
- **V** still toggles free FPV. FPV isn't a separate mechanic — ADS borrows it.
- Existing controls stay (WASD, Space, mouse, 1/2/3 colours, R restart).

---

## Enemies

Full roster, models, behaviours, counters and credits are in **`ENEMIES.md`**.
The headline rules:

- Each enemy is a **question**; each colour is an answer.
- Every attack **telegraphs** (windup flash + sound) — readability = fair difficulty.
- **Green pin removes movement, not threat.** Pinned enemies still attack.
- **Red knockback damages on wall impact.** Environmental kills rewarded.
- No bullet friendly fire, but flung bodies collide.
- One class, five configs for beta. Personality = numbers + one gimmick.

---

## Levels — three pressures

| Level | Pressure | Player relationship to paint | Cast |
|---|---|---|---|
| **L1 — Mission** | Learning | Effectively unlimited; refill everywhere | Soldier Charger + Sprayer |
| **L2 — Ascent** | Rationing | Scarce — green to climb *or* green to pin, not both | Wall-crawler + Turret |
| **L3 — Siege** | Drowning | Enemies eat the ground you stand on | Drainers + Charger zombies + boss |

**L1 layout work (now):** widen island B so the fight is winnable, raise Platform 3
pressure (telegraphs, not just more HP), and add a **checkpoint/arena gate** —
doors lock until the room is cleared ("encounter gating", the Doom/CoD pattern).

---

## Art direction

- **Colour = life = Quaternius family.** The player, their gun, the forest, and
  everything you paint are vibrant.
- **Grey = consumed = everything else.** Enemies and the military base are forced
  through one flat grey toon treatment. The lore *is* the art rule: enemies are
  colourless because colour was taken from them.
- Level 1 journey: **forest → military base.** Grey dead world restored as you fight.

**Why this matters:** it lets us mix asset families without the "asset flip" look —
one flat grey pass unifies KolosStudios soldiers, ITHappy base props and Quaternius
zombies into a single visual class. Validate the GLB pipeline (paint shader on a
SkinnedMesh) with **one** model before downloading the rest.

---

## Story

> **One-liner (menu):** *The immortal stole the world's colour to buy their endless
> lives. You have the last paint gun. Give it back.*

- The super-rich cheat death with immortality pills fuelled by siphoning the
  world's colour and joy.
- Our futuristic paint gun puts colour back — starving "Corrupt Corp" of fuel.
- **Zombies = failed immortality trials**, controlled by Corrupt Corp as base
  foot soldiers. (They consume colour — which is exactly the Drainer behaviour.)

**Delivery rule:** environmental + the one menu line. No text walls, no cutscenes.

---

## Scope & roadmap

**Three weeks to the graded beta. Cut early, not late.**

| Horizon | Goal | Contents |
|---|---|---|
| **H0 — Feel (now)** | Game stops fighting the player | Coyote time + jump buffering, camera rig fix, L1 layout beats |
| **H1 — Beta (graded)** | L1 complete start→finish, hosted | Grey-world aesthetic, 1–2 animated GLB models, ammo/reload, ADS, damage/death, restart, credits, **deployed early** |
| **H2 — Final** | Full three-level experience | L2 + L3, loadout, paintstreaks (Tier 3), boss, minimap, trailer, sound |

**Must exist for beta:** paint changes surface physics · one explainable custom
shader · L1 playable end-to-end · hosted & playable from the server · restart
without refresh.

**Cut first if behind:** paintstreaks · custom Blender models (well-shaded box >
bad model) · boss phase 3 · L3 wave count. **Don't build:** networking ·
pathfinding · procedural generation.

**Deferred by decision:** Megabonk-style movement (slides, super-jump, bunnyhop) —
post-beta. Variety for now comes from level geometry and colour puzzles; blue-painted
ramps already slide.

---

## Team lanes

| Person | Lane | Owns |
|---|---|---|
| **Renda** | `levels/` | Level design, encounter placement, playtest issue log, this doc's level sections |
| **Moses** | `ui/` | Menu, HUD, credits, **trailer (10%)** — start collecting footage week one |
| **Ozuko** | `core/` | Movement feel, camera rig, damage/death, crit/reaction code |
| **Dikeledi** | `paint/` | Paint application, ammo economy, hit application on enemies |
| **Lethabo** | `shaders/` | Shaders, grey-world look, **enemies**, GLB/animation pipeline |

**Shared files:** `main.js`, `config.js` — say so in chat before editing.

---

## Open decisions (not settled yet)

1. **Loadout.** `DESIGN.md` says pick 2 of 3 colours before a level; Renda argues
   all three should always be available. Mechanics note: `DESIGN.md`'s L2
   "green to climb *or* green to pin" tension is an **ammo** problem, not an
   access problem. **Recommendation (pending team vote):** all 3 colours always,
   scarcity via the tank, plus a light pre-level "starting ammo split" so the
   replay/loadout claim and CoD flavour survive without softlock risk.
2. **Boss special attacks** — own design session.
3. **L2/L3 build timing** — H2, unless the alpha mentor says otherwise.
4. **Movement overhaul** — formally post-beta.

---

*Update this file when a decision changes. Local-only notes live in `AGENTS.md`
(gitignored); this file is the shared source of truth.*
