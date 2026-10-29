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
| **Tutorial — The Primer** | None | Generous; the first splat is relief from grey | One Charger, one trap |
| **L1 — Outskirts** | Learning | Generous — a dry player is one splat from recovery | Soldier Charger + Sprayer |
| **L2 — The Ascent** | No space | Tight — green to climb *or* green to pin, not both | Wall-crawler + Turret |
| **L3 — Last Colour** | Drowning | Contested — enemies convert your ground back to grey | Drainers + Charger zombies + Big Arm + Siphon |

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

## Story & lore

> **One-liner (menu):** *The immortal stole the world's colour to buy their endless
> lives. You have the last paint gun. Give it back.*

**The world.** Earth, some decades from now. A corporation (working name **Corrupt
Corp**) found the secret to immortality. The pills don't run on chemistry — they
run on **colour**: vibrancy, warmth, joy, the thing that makes a forest green and
a face human. Colour can be *siphoned*, and the Corp has been draining the planet
to keep its founders breathing.

That is the whole reason the world is grey. It isn't a style choice first — it's
the story made visible. Every drained thing is flat and monochrome; everything
still holding colour blazes.

**The player.** You carry one of the last **paint guns** — a future weapon that
doesn't destroy, it *restores*. Colour you put back into the world can't be
siphoned in time, so painting isn't just traversal: it starves the machine that
keeps Corrupt Corp immortal. The enemy isn't a boss you shoot; it's a fuel supply
you cut off.

**Why the enemies are grey and why they fight you.** Corrupt Corp's forces are
colourless for two different reasons. **Soldiers** (the charger and sprayer) are
Corp enforcers — the immortals' private security, defending the fuel; they gave
up, or were stripped of, their own colour in exchange for corporate service.
**Zombies** are the **failed immortality trials**: people who took the pill and
didn't survive the siphon, kept as disposable foot soldiers. Their bodies still
*crave* colour — which is why they eat the ground you paint. Their hunger is the
mechanic's lore: they are literally trying to take back what was meant to save
them.

**The boss.** "Big arm" is the prototype that worked *too well* — the first
subject to hold stolen colour in a body. It can siphon on a scale, which is why
it repaints the arena grey around you. The thesis statement: the thing that stole
the world is made of the world.

**Level arc.** The colour comes back as you push deeper:
- **Tutorial — The Primer.** A rebel training course, with nothing at stake.
  Teaches that colour changes physics.
- **L1 — Outskirts.** Forest edge, open islands, room to retreat. Teaches that
  colour changes the world.
- **L2 — The Ascent.** Upward through the Corp's infrastructure. Paint is scarce
  and there is nowhere to retreat to.
- **L3 — Last Colour.** The base, the horde and the source. Enemies convert your
  colour back to grey; the world you painted is your safety net.

**Delivery rule:** environment first — drained grey against restored colour tells
the story without a word. The sergeant carries the only spoken lines: a briefing
still in the tutorial, then one line per level. No cutscenes, no exposition walls.

---

## Scope & roadmap

**Three weeks to the graded beta. Cut early, not late.**

| Horizon | Goal | Contents |
|---|---|---|
| **H0 — Feel (now)** | Game stops fighting the player | Coyote time + jump buffering, camera rig fix, L1 layout beats |
| **H1 — Beta (graded)** | L1 complete start→finish, hosted | Grey-world aesthetic, 1–2 animated GLB models, ammo/reload, ADS, damage/death, restart, credits, **deployed early** |
| **H2 — Final** | Full three-level experience | L2 + L3, paintstreaks (Tier 3), boss, minimap, trailer, sound |

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

## What each lane ships for beta

Plain English, so everyone knows what "done" looks like for their lane this week.

- **Renda — `levels/`.** The playground and the difficulty. You build the *space
  the fight happens in*, then playtest until it's fun. This week: widen island B
  so the Charger fight is winnable, make Platform 3 pressure the player, add the
  encounter gate (a door that won't open until the room is clear), and confirm L1
  plays start to finish without feeling unfair.
- **Moses — `ui/`.** Everything the player reads, hears and clicks. You turn
  invisible systems into feedback: hitmarkers ("that shot landed"), sounds for
  shooting, painting, hits and telegraphs, the credits list, the menu — plus the
  10% trailer. This week: hitmarker, SFX, credits, hosting decision, footage.
- **Ozuko — `core/`.** How the character *feels* to control. You own the body and
  the eyes. This week: jump fixes (coyote time = a few frames of grace after
  walking off a ledge; jump buffering = remembering a press made just before
  landing), the camera rig fix (it drifts, can look under the character and
  doesn't face the movement direction), and ADS.
- **Dikeledi — `paint/`.** The core mechanic itself. You own the paint: when it
  lands, what it costs, and proving colour *changes physics*. Most of it is
  built; this week is a regression pass showing blue/red/green each do their job
  on the built build.
- **Lethabo — `shaders/`.** The look and the enemies. You own "grey world becomes
  colour" and enemy feedback. This week: the grey-world aesthetic pass (one flat
  grey treatment so mixed asset families look deliberate), attack telegraphs
  (a windup flash + sound *before* every attack), and shot-reaction visuals.

---

## Open decisions (not settled yet)

1. **Loadout — settled (Oct 2026).** The player always has all 3 colours.
   Scarcity comes from the per-colour ammo tank, not from gating access.
   Loadouts are cut; replay variety comes from ammo economy and the three level
   pressures.
2. **Boss special attacks** — own design session.
3. **L2/L3 build timing** — H2, unless the alpha mentor says otherwise.
4. **Movement overhaul** — formally post-beta.

---

*Update this file when a decision changes. Local-only notes live in `AGENTS.md`
(gitignored); this file is the shared source of truth.*
