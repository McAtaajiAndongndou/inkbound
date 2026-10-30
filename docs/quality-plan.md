# Quality plan — 30 Oct 2026

**Status: draft for discussion (Renda).** Nothing here is decided until it reaches `docs/DECISIONS.md`. Every "Decision needed" line is a ledger entry waiting to be written.

**Sources:** Renda's QA pass of all four levels (30 Oct), `docs/polish-audit.md`, `docs/PRD.md`, and the tuning in `src/config.js` as it stands on `main` (28c1302). Numbers quoted below are read from config, not estimated, unless marked *estimate*.

**What this is:** the plan for turning Inkbound from "works" into "something we would play". It covers the loop, combat, camera, animation, feedback, atmosphere, audio, each level, UI, bugs and process, then puts it in an order.

---

## 1. The verdict

### What is working, and must be protected

- **Outskirts.** "Very fun and high velocity." It is the proof the game can be fun, and the reference every other level is measured against for *feel* (Last Colour stays the reference for *look*, per the polish audit).
- **Sprayer pellets.** Dodgeable shots "added a nice layer of complexity". Threats you can see and dodge are where the combat already works.
- **Crawler ambushes.** "A nice touch." Surprise from routes you made yourself is a strong idea.
- **The panning mission intro** and level goal reveal.
- **The trap language and the colour physics** — the systems are well built. The problem is how they meet the player.

### What is not working

From the QA, the moments Renda enjoyed were all about **moving**. The moments he hated were all about **stopping or losing control**: standing to refill, painting the floor before you can fight, sliding out of control on blue, red throwing you around, Shift diving the camera into the floor, being hit with no idea from where.

> **"Beating the level isn't trivial, it offers a challenge, but honestly it's not that fun."**

That sentence is the brief for this plan. A game can be hard, readable and well built and still not be fun, when its core action is rationed and every system taxes the player.

### The two rules this plan follows

1. **Never make the player stop.** Every refill, every movement tool and every attack answer should be something you do *while moving*. Splatoon's swim is a reload you do while travelling; CoD's reload is short and cancellable for the same reason.
2. **Every action pays you back.** Shooting paints. Painting moves you. Killing refills you. Doom (2016) built its whole loop on this: enemies are resources, so aggression is how you survive.

---

## 2. What "high quality" means for us — the bar

These are tests, not aspirations. A level is not polished until it passes all of them with a fresh playtester (not someone on the team).

| Test | Pass when | How we measure |
|---|---|---|
| **The 10-second test** | A player who has never seen the game shoots, paints and moves within 10 s of control, without reading anything | Watch, stopwatch |
| **Trigger time** | Over half of every fight is spent shooting or moving, not waiting for the tank | Proposed new metric next to dry time (§12) |
| **Readable death** | After every death, the player can say what killed them and what they should have done | Ask after each death |
| **Readable threat** | Every attack is preceded by a tell the player can see *or* hear | Checklist per enemy (§4) |
| **The look-back** | At the end of a level, the player turns round and the world is visibly theirs | Screenshot at extraction |
| **Sense of place** | The player can say in one word where they are (forest, mountain, base) | Ask after the level |
| **Wanting another go** | After finishing a level, the player wants to replay it or move on immediately | Ask; watch whether they reach for the menu |

Marking note: the marker plays for roughly ten minutes. **The Primer and the first half of Outskirts are the game the marker sees.** They get polished first and hardest.

---

## 3. Mechanics — the loop

This is the largest section because it is the root cause. Animation and atmosphere make a good loop shine; they cannot rescue a bad one.

### 3.1 The tank economy

**Now (`PAINT_GUN`, `SUBMERGE`, `AMMO`):**

| | Value | Consequence |
|---|---|---|
| Tank | 100 (Ascent 60, Last Colour 80) | |
| Cost per shot | 4 | 25 shots per tank (Ascent 15) |
| Fire delay | 0.14 s | ~7 shots/s, so **the tank empties in ~3.5 s of trigger** (Ascent ~2 s) |
| Splat radius | 1.4 m | Painting a room costs roughly a whole tank (*estimate*) |
| Standing refill | 8/s | 12.5 s empty → full |
| Submerged refill | 32/s | 3.1 s empty → full |
| Burn vs standing refill | 28/s out, 8/s in | **Each second of firing costs ~3.5 s of standing still** |

**The problem:** the core verb — painting — is the scarcest thing in the game. The polish audit's reasoning (keep standing refill slow so submerge is *the* reload) is sound, and I'm revising my earlier suggestion of raising standing refill to 15/s because of it. The real failures are that a shot costs too much and that submerge (§3.4) is unusable, so in practice everyone refills standing up.

**Change (recommended):**

| Number | Now | Proposed | Why |
|---|---|---|---|
| `PAINT_GUN.cost` (hip) | 4 | **2** | ~50 shots, ~7 s of trigger. Splatoon's main weapons fire for well over 10 s |
| Standing refill | 8/s | **8/s** (unchanged) | Keeps submerge as the fast reload |
| Submerged refill | 32/s | **40/s** | A full tank in 2.5 s: a dive is a reload |
| `DEATH_SPLAT.radius` | 1.8 m | **2.5 m** | A kill leaves a pool you can actually dive into |
| `AMMO.ascent` | 60 | **80** | Starve the Ascent of *space* (its pressure in `GLOSSARY.md`), not of the trigger |

**Alternative:** keep cost 4 but double the hip-fire splat radius, so each shot buys more ground. This keeps the "every shot matters" tension but makes painting less of a chore. Weaker on fight feel, because you still empty the tank in 3.5 s.

**Risk:** if the tank never matters, grey loses its stakes. The answer is that territory still matters through speed, dodging (the pellet maths in `ENEMY_SHOT` already says painting is defence) and the Sprayers/Drainers taking it away. The playtest in §12 checks this.

**Lane:** config (shared), Paint (Dikeledi) owns the gun. **Decision needed:** a ledger entry for the new economy.

### 3.2 Hip-fire paints, ADS kills

**Now:** the only difference between the modes is spread (`hipSpread: 0.025`, `adsSpread: 0.005`). Splat size, cost and damage are identical. **Renda saw no difference in painting, because there is none.**

**Why it matters:** Splatoon splits painting and fighting across weapon classes (Rollers and Splattershots paint; Chargers kill). We have one gun, so the two firing modes have to *be* two weapons. This also gives the player a real decision every second: "do I build ground or win this duel?"

**Change (recommended):** split `PAINT_GUN` into a `hip` and an `ads` block in config.

| | Hip-fire — the painter | ADS — the duellist |
|---|---|---|
| Pattern | Cone of 3 droplets per shot | One stream |
| Spread | 0.06 rad | 0.004 rad |
| Splat radius | 1.8 m per droplet (overlapping) | 0.7 m |
| Range | 18 m | 30 m |
| Cost | 2 | 3 |
| Damage | 5 per droplet (up to 15 point-blank) | 14 |
| Freeze build-up | Counts as one hit per shot | Counts as one hit per shot |
| Move speed | Full | 0.5× (`adsSpeedMultiplier`, unchanged) |

Read: hip-fire paints a wide road cheaply and works close up (shotgun-ish, so it doesn't feel useless in a scrap). ADS is tight, long, expensive, and is where the freeze-shatter crit lives (`BLUE_FREEZE.criticalMultiplier: 3`).

TTK check (*arithmetic*, before tuning): Sprayer 40 hp. ADS: 3 hits ≈ 0.42 s. Hip at mid range (one droplet in three lands): ~8 shots ≈ 1.1 s. Point-blank hip: 3 shots. So ADS is clearly the duelling tool, and hip still finishes a Charger that reaches you.

**Alternative:** keep a single pattern and vary only splat radius and damage by mode. Half the code, and most of the feel.

**Lane:** Paint (Dikeledi) for `paint-gun.js`; the numbers in config. **Decision needed:** yes.

### 3.3 Floor colours: traps for them, tools for you

**Now (`SURFACE`):**
- **Blue:** traction 0.5, friction 0.4, sticky 1.6× speed boost. You lose steering in the middle of a fight.
- **Red:** restitution 0.9, `minBounce: 15`. **Standing on red launches you 4.33 m every time.** You cannot stand on red to refill. (The polish audit's P0-2 red-refill fix makes touching red count, but you still cannot *stay* on it.)
- **Green:** grip and climb. Fine.

**The problem:** paint that is meant to resupply you also takes control of your body, so players stop painting the floor with blue and red. Then they have nothing to refill on, and they dry out. Splatoon's ink never changes your physics except your swim speed.

**Change (recommended): floor colours act fully on enemies and on demand for the player.**

| Colour | On enemies (unchanged) | For the player — standing / walking | For the player — on demand |
|---|---|---|---|
| **Blue** | Slides them, Chargers overshoot | **Safe.** Mild glide (traction 0.85), refills | **Submerged in blue = the fast lane** (2.2× instead of 1.9×). Pop out with a jump for a long slide-jump |
| **Red** | Knockback, bounce | **Safe.** Standing does nothing, refills | **Press jump on red = super-jump** (the 4.33 m launch) |
| **Green** | Pin | Safe, refills | Climb walls (unchanged) |

This keeps every colour as a distinct movement tool and the Innovation-band claim ("colour changes physics, not appearance") intact, but no colour ever takes control away from the player without a button press.

**Alternative:** keep floor effects automatic, but only on surfaces the level marks as special (blue lanes, red pads), with the player's own painted floor always neutral. Simpler for the player, but it breaks "you paint the world and the world changes", which is the pitch.

**Cost and risk:** every jump number in the level docs (the Primer's 6.5 m blue gap, measured against an 8.14 m blue run-up) was measured against the current physics. They must be re-measured. The existing level-contract tests will catch the breaks, which is what they are for. This is the riskiest change in the plan, so it goes on the feel branch first (§12).

**Lane:** Core (Ozuko) for `player.js`; Paint (Dikeledi) for `surface-rules.js`; Levels (Renda) for re-measuring. **Decision needed:** yes, it changes settled behaviour.

### 3.4 Submerge: the move the game is built around

**Now (`SUBMERGE`, `SWIM`):** Shift submerges. Speed 1.4× (9.8 m/s), refill 32/s, camera drops 0.9 m and **tilts down by 1.1 rad (63°)**. The body squashes to 15% height and 130% width.

**The problem:** the moment you press Shift to dodge, you are staring at the floor and lose sight of the turret you were dodging. QA: "shifting currently is just unusable"; "the shift animation is very janky". In Splatoon, swimming *is* the dodge, the reposition and the reload at once, and it is why the game feels fluid.

**Change (recommended):**

| Number | Now | Proposed | Why |
|---|---|---|---|
| `SUBMERGE.maxAngle` | 1.1 rad | **0.1** | You must see the fight while submerged |
| `SUBMERGE.cameraOffset` | 0.9 m | **0.35 m** | Enough to read as "in", not enough to lose the horizon |
| `SUBMERGE.speedMultiplier` | 1.4 | **1.9** (2.2 in blue) | A clear reward; Splatoon's swim is roughly double walk |
| `SUBMERGE.refillMultiplier` | 4 | **5** | See §3.1 |
| FOV while submerged and moving | 70 | **+8°** | A speed cue; every fast-movement game does this |
| **Pop-out jump** (new) | — | Jumping out of submerge adds ~25% jump height and keeps your speed | The Splatoon rhythm: shoot → dive → move → pop out → shoot |
| **Submerge on a wall** (green only) | — | Climb faster while submerged in green | Splatoon's wall-swim; makes green a fast route, not just a gate |

And the body: replace the pancake squash with a quick dive (0.12 s) into a paint blob, plus the existing ripples (`SWIM`). See §6.

**Lane:** Core (camera, movement), Shaders (`avatar.js` for the body). **Decision needed:** pop-out jump and wall-submerge are new verbs, so yes.

### 3.5 Grey

**Now:** `SURFACE.grey.standSlow: 0.6`, so 7 → 4.2 m/s, which is slower than a Charger. Grey is the whole level at load.

**The problem:** the first impression of every level is "this game is slow". The polish audit flagged this; the QA confirms it ("painting surfaces is too tedious").

**Change (recommended): two greys** — the polish audit's alternative.
- **World grey** (the level at load): 0.85.
- **Corp grey** (freshly laid by a Sprayer shot, a Drainer or Big Arm's slam): 0.6, and visibly darker and wetter.

The world is a mild drag you want to fix. The enemy's fresh grey is the real threat, and it is *readable* as an attack on you. Splatoon only slows you on enemy ink, never on neutral ground.

**Alternative:** keep one grey at 0.6, and pre-paint a starter pool at every spawn so the first steps are fast. Cheaper, but the first minute still drags.

**Lane:** Paint + Core. **Decision needed:** yes, it changes #74 / ADR-0002.

### 3.6 Shooting grey — scrapped

Renda's call. Grey is Corp's paint; letting the player fire it muddies the fiction ("colour is the rebels' weapon") and the readability (grey would mean "theirs" and "mine"). Remove grey from the player's colour cycle.

**Lane:** Paint. **Decision needed:** a one-line ledger entry.

### 3.7 Dry out

**Now (`DRY_OUT`):** tank empty and no own paint underfoot for 1.0 s ends the run.

**The QA:** "dry out killed me but I swear I could've just recharged my tank by standing on paint."

**Diagnosis:** two possibilities, and both need checking: (a) the paint under him had been greyed by a Sprayer or Drainer, so it no longer counted; (b) he was on red and bouncing, so never "on" paint (P0-2). Either way, **a loss the player believes was unfair is worse than no loss.** CoD never ends your run for running out of ammo.

**Change (recommended):** dry out stops being a death. When it triggers, the gun dribbles a weak shot of your selected colour at 1 tank/s refill wherever you stand, the screen edge greys, and the sergeant says one line ("You're dry — find your colour!"). The run never deadlocks, and being dry is a punishing state, not a game over. With the economy in §3.1 it should almost never happen.

**Alternative:** keep it as a loss, but raise `graceTime` 1 s → 3 s with a visible countdown and an arrow to the nearest owned paint.

**Lane:** Core. **Decision needed:** yes, it changes PRD A5.

### 3.8 Q — the Paintstreak

**Now (`PAINTSTREAK`):** a gauge that fills from new ground, kills and variety (~90–120 s of play). Spending it drops a 6 m splat at your feet and stuns everything in it for 2.5 s. **No damage.**

**The problem:** players are trained by CoD killstreaks and every hero-shooter ultimate to expect an ult to *do something violent*. A stun with no damage reads as a dud ("q doesn't do damage? why?"). It is also never taught (QA: "it should teach the player q").

**Change (recommended): Q applies the active channel of your selected colour to everything in the zone.**

| Colour held | Effect | The payoff |
|---|---|---|
| **Blue** | Everything in the zone freezes instantly | A crowd-wide crit window: the damage comes from your ADS follow-up |
| **Green** | Everything is pinned | Free time to reposition, repaint, or line up headshots |
| **Red** | Knockback blast with damage (25) | Throw enemies off ledges or into traps |

Plus the 6 m splat as now. This ties Q to colour, rewards the colour choice, and teaches the combo system by doing it for you. Against Big Arm, cap it at **one free combo step per phase** so it doesn't trivialise the fight.

**Alternative:** flat damage (30) plus the current stun. Simpler and more CoD, but Q becomes "the big button" and stops being about colour.

**Teaching:** the Primer gets a Q room (§9.1). The HUD gauge pulses and the sergeant speaks the first time it fills ("Gauge is full — Q to spend it!").

**Lane:** Paint (`paintstreak.js`), UI for the gauge and prompt. **Decision needed:** yes.

### 3.9 Mastery: why you would play it again

Indie games that stick have a skill ceiling the player can feel themselves climbing. Ours already has the pieces; they just aren't connected:

- **The freeze-shatter** (3 blue hits → ADS crit) is the game's best combo. Make it louder and more common: Chargers and Sprayers should both be worth freezing.
- **Movement tech:** pop-out jumps, blue slide-jumps, red super-jump off a pool you just painted, wall-submerge up green. Each one is cheap once §3.3 and §3.4 exist, and expert players chain them.
- **A results rank (COULD):** coverage, dry time and time already get scored. Turn them into a letter (S/A/B/C) on the extraction screen. Devil May Cry, Hi-Fi Rush and Neon White show what a rank does for replays. Cost S if the scoring exists.

---

## 4. Combat and enemies

### 4.1 The readability rules every enemy must pass

1. **A tell before every attack**, visible *and* audible (amber, swell, whine — the existing language).
2. **A reaction to every hit:** a flinch, a stagger or a colour flash. Today hit reaction is an emissive tint only (PRD AN10, ⚠️).
3. **A readable death:** a death clip or topple, then the paint burst (`DEATH_SPLAT` exists).
4. **A framed first appearance:** the first time the player meets an enemy type, it is alone, at a distance, in a room shaped for its answer (polish audit, enemies §5).
5. **An opening:** the punishable gap after it commits (`GLOSSARY.md`).

### 4.2 Per enemy

| Enemy | QA said | Diagnosis | Change | Lane |
|---|---|---|---|---|
| **Charger** | "Just kind of jumps towards me" | Its model is a rifle soldier with no charge or melee clip; the windup was removed because it planted the charger (comment in `ENEMY.charger`) | **Swap to the zombie charger model** (`zombie-charger.glb`, already loaded, has `Idle_Attack` + `Run_Attack`). Add a 0.4 s crouch windup that does *not* zero its momentum (a lean back, then commit). Fits the fiction better too: chargers are failed trial subjects | Levels (model choice via `config.model`), Enemies (windup) |
| **Sprayer** | Pellets were a good addition | Working | Keep. Add a hit flinch (it has no hit clip; use the procedural lean, like `RELOAD_LEAN`) | Enemies |
| **Wall-crawler** | Ambushes are good; no climbing animation; one shot me through the floor | No climb clip; pellets or line of sight apparently pass through floors from below | Orient the body to the wall normal while climbing and play `Crawl`. **Fix the through-floor shot** (P0). More of them in Ascent's first encounter, from several sides | Enemies, Levels (placement) |
| **Turret** | "Doesn't have a model?" | PRD M5 ❌ | Any rigid model, a barrel that turns to track you (the turn is its tell), recoil per shot | Shaders (model), Levels (placement) |
| **Drainer** | Not seen in QA | No level spawns it (PRD M6) | Spawn in Last Colour (see §9.4) | Levels |
| **Stalker** | Not seen | No model (PRD M14) | Either source a model or cut it. **Decision needed** | Shaders |
| **Big Arm** | Too tanky, needs a health bar and ranged attack, wants more than one | See §4.3 | See §4.3 | Enemies, UI, Levels |

### 4.3 Big Arm

**What's actually happening:** plain hits do nothing by design (`DECISIONS.md`: "damage does not kill it"). It dies to **blue freeze (3 hits) → green pin (while frozen) → red knockdown (while pinned)**, three times. Renda "couldn't find the combo, not even a hint at it" — so the fight isn't tanky, it's *untaught*, and it gave no feedback that shooting it was doing nothing.

**Change:**

1. **Teach it before the boss.** The Primer gets a combo dummy (§9.1). Outskirts and the Ascent each have at least one moment where a Charger in its recovery window invites the full combo (PRD D1 already wants a full combo inside the Charger's window).
2. **Tell during the fight.** The sergeant at the start: *"Freeze it. Pin it. Knock it flat."* A boss bar with **three segments, one per combo left** (this keeps PRD's "no health bars on enemies" honest: the bar counts combos, not HP). Under it, **three colour pips** — blue, green, red — that light up as each step lands and drain when the chain breaks.
3. **Show that plain hits don't work.** A non-combo hit sparks off with a dull clang, not the normal hit sound. Players learn "damage isn't the answer" in two seconds instead of two minutes.
4. **Poses for each step**, from clips it already has: the clip paused for the freeze, `Jump_Land` held low for the pin, `Death` played partway for the knockdown, then reversed to stand back up (§6).
5. **A ranged attack:** a grey shockwave along the floor from the slam (it already greys a 4 m radius). Jump it, or out-range it from the balconies. It fits its job ("repaints the ground grey").
6. **Adds:** all enemy types appear across the fight, staggered by phase (QA: "there should be all the enemy types in this level"). Phase 1 Chargers, phase 2 Sprayers + Drainers (the doc already calls 2 Drainers), phase 3 Crawlers on the balconies' green routes.
7. **Check the windows can actually be hit.** `critWindow` 2.0 s for green after the freeze, `pinFor` 3.0 s for red. That includes switching colour. Someone on the team must land the full combo three times in a row before playtesters see it; if they can't, the windows are too short.

**Pushback on "more than one Big Arm":** two copies make a weaker set piece than one boss with escalating adds, and two bosses doubles the combo-tracking load on the player. Recommend **one Big Arm** with adds. If the fight still feels thin after the changes above, a smaller mid-boss in the Ascent is the better place for a second big enemy.

### 4.4 Damage direction

The hurt arc exists (`FEEDBACK.hurtArcFade`, CoD's indicator) — but QA still said "I get shot but I don't know where from". The arc is horizontal, so a shot from *below* (the crawler through the floor) or above has no useful direction. Fix the through-floor bug first; then give the arc a vertical cue (a chevron above or below the crosshair when the source is more than ~30° off the horizon).

**Lane:** UI.

---

## 5. Camera and controls

**QA:** "The camera doesn't see through objects"; "I'm not in love with the camera, it still doesn't feel fluid"; foliage makes "dodging and running around annoying because I lose track of the enemies"; Primer starts facing a wall; Last Colour spawns the camera behind a wall (BACKLOG).

**Diagnosis from the code:** `src/core/camera-rig.js` has **no position smoothing and no camera collision** (no damping or lerp found; BACKLOG confirms "the rig has no camera collision at all"). A camera welded to the player transmits every step, landing and collision snap straight to the screen, which reads as stiff. And with no collision, walls and trees sit between you and your character.

**Change:**

| What | Detail | Lane |
|---|---|---|
| **Position damping** | Follow the player with a short critically-damped spring (~0.06 s). **No rotation damping**: aim must stay 1:1 with the mouse | Core |
| **Camera collision** | Sphere-cast from the shoulder pivot to the camera; pull in to the hit point, ease back out over ~0.2 s | Core |
| **Occluder fade** | Foliage and small props between camera and player dither-fade to ~30% (screen-door transparency, so no sorting problems). Large walls use collision instead | Shaders (dither material), Core (detection) |
| **FOV** | 70 → 78 in TPV; +8° while submerged and moving | Core |
| **Spawn framing** | Every level's spawn faces its goal or the first lesson, never a wall (Primer, Ascent, Last Colour) | Levels |
| **Shoulder swap (COULD)** | One key swaps the camera shoulder for corners | Core |

---

## 6. Animation

### 6.1 Principles

- **Gameplay first, realism second.** An animation's job is to tell the player something: it's about to attack, it was hit, it's frozen, it's dead. Anything that doesn't carry information can stay procedural.
- **Anticipation is a tell.** Every attack gets a windup pose (crouch, arm back, lean) before it commits.
- **Reactions sell hits.** Shooting something that doesn't flinch feels like shooting cardboard. This is half of why combat "feels off".
- **Reuse before you source.** Most of what we need is already in the files.

### 6.2 What the files have

| Model | Skinned? | Clips | Played today |
|---|---|---|---|
| `soldier-charger.glb` / `soldier-sprayer.glb` | **No** (rigid parts) | Aim, AimShoot, Reload, Run, Shoot | Aim (idle), Run, Shoot/AimShoot |
| `wall-crawler.glb` | Yes | Crawl, Death, HitReact, Idle, Jump, Jump_Idle, Jump_Land, Run, Walk | Idle, Crawl, Jump |
| `zombie-drainer.glb` | Yes | Crawl, Death, HitReact, Idle_Attack, Punch, Walk, … | Idle, Walk, Punch, Crawl |
| `zombie-charger.glb` | Yes | **Idle_Attack, Run_Attack**, Death, HitReact, … | **Nothing — not spawned** |
| `zombie-big-arm.glb` | Yes | Death, HitReact, Punch, Jump_Land, Run_Attack, … | Idle, Walk, Punch |
| `soldier-swat.glb` (player) | Yes | 24 clips incl. **Roll**, Death, HitRecieve, Run_Shoot, Idle_Gun_Pointing | Most, via `avatar.js` |

**`HitReact` and `Death` exist on four enemy models, and no enemy ever plays them.**

### 6.3 The work, ranked by feel per hour

| # | What | How | Lane | Size |
|---|---|---|---|---|
| A1 | **Hit reactions on every enemy** | Zombies: `HitReact` layered over locomotion (additive or a 0.2 s override). Soldiers: a 0.1 s backward lean plus a colour flash, the same technique as `RELOAD_LEAN` | Enemies | S |
| A2 | **Charger → zombie charger** | `Idle_Attack` as the windup tell, `Run_Attack` as the charge | Levels + Enemies | S |
| A3 | **Freeze by pausing the clip** | Set the mixer's time scale to 0 while frozen, so it freezes mid-stride. Today it snaps to idle, which reads as calm, not frozen | Enemies | S |
| A4 | **Death clips before the sink** | Zombies play `Death`, then sink and burst. Soldiers get a procedural topple | Enemies | S |
| A5 | **Big Arm's combo poses** | Paused (freeze), `Jump_Land` held (pin), `Death` partway then reversed (knockdown and get-up) | Enemies | S–M |
| A6 | **Crawler on walls** | Turn the body to the wall normal, play `Crawl` | Enemies | S |
| A7 | **Submerge dive** | Replace the pancake squash with a 0.12 s dive into the blob; reverse on pop-out | Shaders | S |
| A8 | **Pop-out and dodge** | Use the player's `Roll` for a pop-out dodge, if the pop-out jump (§3.4) ships | Shaders | S |
| A9 | **Turret** | Procedural: track, recoil, a spin-up before a burst | Shaders | S |
| A10 | **Frozen enemies turn 2D in the frost shell** | Bug — investigate the frost shell's depth or billboard handling | Shaders | S |
| A11 | **Catwalk fall looks wrong** | Bug — check the fallen slab's rotation and gravity (`ASCENT.catwalk`) | Levels | S |

### 6.4 Sourcing missing clips

- **Same artist first:** the zombie rigs use the `CharacterArmature|` naming of the Quaternius packs, so more clips from the same artist share the skeleton. Validate one file before downloading more (`docs/ASSETS.md`).
- **Mixamo** has the most variety, but it needs an Adobe account (Renda signs up himself), and retargeting onto these rigs is fiddly — PRD lists "realistic retargeting between asset families" as out of scope. Use it only if a specific clip is missing and nothing else works.
- **Rigid soldiers stay procedural.** They have no skin, so no clip will deform them.

---

## 7. Feedback and juice

A lot of the juice from the polish audit is **already built**: hit-stop (`HIT_STOP`), trauma screen shake (`SHAKE`), pitch variance, the hurt vignette and arc (`FEEDBACK`), grey footsteps, the submerge tint, death splats, refill bubbles. QA still found the game lacking, which means the problem is mostly the loop (§3) and missing reactions (§6), not missing juice. What's left:

| What | Why | Lane | Size |
|---|---|---|---|
| **Hitmarker variants:** a hitmarker exists (`src/ui/hud.js`); add a distinct marker and sound for crits and for "immune" hits on Big Arm, and check the base one reads at speed | The most important shooter feedback there is, and the crit is the game's best moment | UI | S |
| **Kill confirm:** a short X-marker and a sound distinct from the hit | CoD's kill confirm is why kills feel like kills | UI | S |
| **Splat bloom:** the paint splat swells and settles over ~0.15 s instead of appearing | The grey-to-colour moment is the game's signature visual; it should be the best-feeling thing in it. The polish audit could not check this in motion | Shaders | S |
| **Tank on the gun:** the viewmodel or the player's back shows the tank level | Splatoon puts the tank on your back because you never look at the HUD in a fight | Paint / Shaders | M |
| **Vertical hurt cue** | §4.4 | UI | S |
| **Trap warnings in voice** | The sergeant warns *before* the trap, not after (QA) | UI + Levels | S |

---

## 8. Atmosphere

**QA:** "All the levels need more atmosphere." Outskirts had no skyline or 3D effects; the Ascent "doesn't feel like I'm scaling a mountain"; Last Colour "feels underdecorated with lacking mood".

### 8.1 What "atmosphere" is made of

Each level gets the same seven layers. If a layer is missing, the level feels thin even when the others are good.

1. **Sky and skyline** — what is on the horizon.
2. **Depth** — fog and atmospheric perspective: distant things get lighter and bluer.
3. **Light** — direction, colour, and one hero light per space.
4. **Moving air** — particles: dust, spores, snow, ash, steam.
5. **Sound bed** — ambient audio that is not music.
6. **Set dressing** — props that tell you what happened here.
7. **The payoff** — how the space changes when you paint it.

### 8.2 The cross-level idea: follow the pipe

**Environmental storytelling (recommended, M):** the Corp siphons colour out of the world. Show it. A **siphon pipeline** runs through every level — out of the Outskirts forest, up the mountain, into the base — carrying a faint glow of drained colour toward Last Colour. You follow the pipe across the campaign. It gives the levels a journey, makes the fiction visible without a word of dialogue, and pays off when you destroy the Siphon at the end. Half-Life 2's Combine towers and BioShock's ads do this job.

Along with it, **Corp propaganda:** billboards for the immortality pills. QA spotted "a billboard to the right of the level, is that meant to be there?" — if that's a prop, make it *read*: lit, branded with a Corp pill ad, flickering. Then it stops being a mystery and starts being storytelling.

### 8.3 Per level

| Layer | Primer | Outskirts | Ascent | Last Colour |
|---|---|---|---|---|
| **One-word identity** | Camp | Forest | Mountain | Factory |
| **Skyline** | The rebel camp outside the course walls: tents, a radio mast, warm lights | Treeline silhouettes in 3 layers; the Corp tower and the pipe on the horizon | Layered ridges, each lighter and bluer; the summit base visible from the trailhead | Smokestacks, gantries, searchlight beams sweeping the sky |
| **Depth** | Dust haze (exists) | Ground fog in the hollows between islands | Cloud layer **below** you that you climb out of; long view down | Amber haze (exists), steam |
| **Light** | Warm tungsten lamps (exist), the next door lit warmer (leading light) | Dappled light; a warm shaft on each island's goal | Cold dawn turning warmer as you climb — the sun rises with your progress | Cold floodlights against amber; red alarm strobes in wave 3 |
| **Moving air** | Dust motes in lamp light | Drifting spores that pick up your colours as territory grows | **Wind-driven snow streaks, stronger with altitude** | Ash, sparks from machinery, steam vents |
| **Sound bed** | Distant camp chatter, radio static | Insects and wind; **birdsong returns as you paint** | Wind howl rising with height; creaking cables | Machine hum, alarms, distant PA announcements from the Corp |
| **Set dressing** | Targets, crates, chalk (exist); rebel banners, a scoreboard | Megakit forest (exists); the pipe; abandoned rebel gear | Rock props breaking the box silhouettes; trees thinning with altitude; climbing ropes; the pipe on pylons | Pill vats, test chambers with zombies behind glass, conveyor belts of pills, siphon tanks |
| **Payoff** | Lamps brighten as each room is passed | Decor reveal (exists) | The sky warms (dynamic sky exists); snow turns to colour flecks | The facility's grey lifts when the Siphon falls (exists); the searchlights die |

### 8.4 The Ascent's mountain problem, specifically

What makes a climb *feel* like a climb (Journey, Celeste's Summit, Uncharted's mountain chapters):

1. **See the summit from the start**, and keep seeing it. The lift beacon at 76 m is the right idea; the spawn must face it (§5).
2. **Look down.** Put viewpoints at every ledge where the drop and the path you've climbed are visible.
3. **The air changes with height:** fog thins, wind rises, snow appears, light warms.
4. **The trees thin out** as you climb, then stop.
5. **Silhouettes are rock, not boxes:** sloped caps, rock props from the decor kit, scree at the base of every face.
6. **Distant ridges as layered cards with atmospheric perspective**, not flat grey shapes. QA: "Oh the grey shapes are meant to be mountains in the distance? Took me a while to get the idea but the execution sucks."
7. **Remove the black circle that follows the cursor.** Likely a sky element (a sun or moon disc, or the sky probe) attached to the camera rather than placed in the world. *Not yet diagnosed* — Shaders lane.

### 8.5 Foliage and combat

Tall grass and bushes on combat floors hide enemies (QA). Two fixes: the occluder fade (§5), and a **keep-out on combat floors** for anything taller than knee height (`Decor` already supports keep-out rects). Tall foliage belongs at the edges, framing the arena.

### 8.6 Lanes

Skyline cards, particles, set dressing, mood numbers: **Levels (Renda)**. Sky shader bugs, dither fade, particle shader if needed: **Shaders (Lethabo)**. Sound beds: **UI/audio (Moses)**.

---

## 9. Levels

### 9.1 The Primer — rebuilt around teaching by doing

**QA:** the sergeant doesn't walk you through anything; paint is pre-laid for you; the trap dialogue comes late and doesn't warn; Q is never taught; you start facing a wall.

This overrides Decision 3 in `docs/levels/00-the-primer.md` ("blue and red pre-painted, green not"). **Nothing is pre-painted that solves a lesson.** A room may hold a demo patch the sergeant points at, but the player paints the solution.

The rule for every room: **one verb, the sergeant speaks on entry, the door opens when you've done it.** Half-Life 2's opening, Portal's test chambers and CoD 4's training course all work this way.

| Room | Verb | Sergeant (on entry, UK spelling) | Door opens when | New? |
|---|---|---|---|---|
| R0 | — | Briefing still (exists) | Skipped | |
| R1 | **Look and move** (WASD, mouse, jump) | "Legs work? Good. Over the wall." | Over the 1 m wall | Spawn faces the room |
| R2 | **Hip-fire paints** | "That's colour. Paint the floor — go on." | 20% of the floor painted | No pre-paint |
| R3 | **Refill and submerge** | "Tank's low. Stand in your colour — or hold Shift and dive in." | Tank refilled from submerge | **New room** |
| R4 | **Blue** | "Ice. Paint a run-up and slide the gap." | Gap crossed | Player paints the strip |
| R5 | **Red** | "Red pushes back. Paint the pad and jump on it." | Ledge reached | Player paints the pad |
| R6 | **Green** | "Green grips. Paint the wall and climb." | Top reached | (exists) |
| R7 | **The trap** | "Watch the boards — that floor bites. Blue slides over it." (**before** the pit) | Across | Line moved earlier |
| R8 | **ADS and the freeze** | "Aim — right mouse. Three blue hits freezes them. Then finish it." | Dummy frozen and shattered | **New room** |
| R9 | **The combo** | "Freeze. Pin with green. Knock it flat with red." | Combo landed on a dummy | **New room** (teaches Big Arm) |
| R10 | **One of Theirs** | "One of theirs. Make the ground stop it." (exists) | Charger dead | Zombie charger |
| R11 | **Q** | The gauge is topped up on entry. "Gauge is full. Q — and pick your colour first." | Q spent on a group of dummies | **New room** |
| R12 | Free play | (exists) | — | |
| R13 | Extraction | "You're ready. Outskirts — go." | | |

**Pacing check:** the current estimate is ~2 min 40 s. Four new rooms add roughly 1 min 30 s (*estimate*). Over four minutes is too long for a tutorial a marker sits through, so the new rooms are **small** (one dummy, one wall), and R12 free play is optional.

**Also:** fix the sergeant's line timing (QA: "One of theirs" fires while you're at the trap), and fix the trap damaging you mid-jump (§11).

**Lane:** Levels; sergeant lines and timing hooks with UI. **Decision needed:** overriding Decision 3, and the new rooms.

### 9.2 Outskirts

The level works. Don't break it.

| Item | Change |
|---|---|
| Pre-placed green paint | Remove anything that solves a climb. Keep one small **starter pool** at spawn so the first steps are fast |
| Island C's pillar does nothing | Cover only matters if something punishes open ground. Put a Sprayer or turret whose line of fire the pillar actually blocks |
| Island C's trap (vent) does nothing | **Traps hurt enemies too.** Place the vent on the Charger's line, so baiting a charge into it is the clever play. Every trap in the game should be usable against enemies (Doom and Hitman both make environmental kills the expert move) |
| No skyline | §8.3 |
| Foliage hides enemies | §8.5 |
| The billboard | Identify it. If it's a prop, make it a Corp pill ad (§8.2); if it's stray, remove it |

### 9.3 The Ascent

| Item | Change |
|---|---|
| Two spawn enemies stand still | Bug: probably dormant until a trigger the player never enters, or idle turrets. Either wake them or remove them |
| First encounter | More crawlers ambushing from several sides, from green routes the player painted (QA's idea, recommended) |
| Crawler shooting through the floor | P0 bug (§11) |
| Turret has no model | §4.2 |
| Mood | §8.4, the biggest atmosphere job in the game |
| Tank starved at 60 | 80 (§3.1). The level's pressure is *no space*: narrow ledges, no retreat, threats above and below |
| "Not fun" | The Ascent is where the loop problems hurt most: the smallest tank, the most traps, the longest climbs. Re-playtest it *after* the feel branch before redesigning anything |

### 9.4 Last Colour

| Item | Change |
|---|---|
| After the trap and turrets, "I don't know what's meant to happen next" | A **wave indicator** (wave 1/3, enemies left), and the sergeant calling each wave. A visible objective marker at all times |
| All enemy types | Spread across Big Arm's phases (§4.3) |
| Big Arm | §4.3 |
| Red is useless for refill | Fixed by §3.3 |
| Under-decorated | §8.3; the pill factory dressing is the identity |
| The Siphon | Unplayed in QA. Playtest after Big Arm is beatable |

---

## 10. Audio and music

### 10.1 Music

**Now:** the music is **synthesised in code** (`src/audio/music.js`, `MUSIC` config, #199): a Corp drone of two detuned saws, a colour arpeggio that loops one 8-note pattern, and combat drums, all adaptive to territory and combat. Default volume 0.6.

**QA:** "obnoxious and annoying"; Renda kept it muted all through the Ascent.

**Diagnosis:** the colour layer plays the same 8-note arpeggio continuously, at the second-highest gain (0.18), and it gets *louder* the more you paint — so the better you play, the more of the annoying part you hear. Raw saw waves are harsh. And the adaptive idea is good, but the synth can't sound like a soundtrack.

**Change (recommended): recorded music, kept adaptive.**
- Per level, two recorded loops in the same key and tempo: **explore** and **combat**. Crossfade between them using the combat state the synth already tracks (`combatFadeIn`, `combatHold`).
- Keep the synthesised **stingers** (clear, death, win) — those are short and work.
- Drop the drone and the arpeggio. Let the *ambient sound beds* (§8.3) carry "the world comes back as you paint" instead (birdsong returning is a much nicer version of that idea).
- Default music volume 0.6 → **0.35**.
- **Sources:** Incompetech (Kevin MacLeod, CC-BY), OpenGameArt (filter CC0/CC-BY), Pixabay Music, free packs on itch.io. Every CC-BY track goes into `docs/ASSETS.md` and the in-game credits (PRD L2). One track validated in the build before downloading more.

**Alternative:** keep the synth but retune it — a sparser pattern that only plays on territory changes, softer waveforms, lower gain. Cheaper, but unlikely to clear Renda's bar.

**Lane:** UI/audio (Moses). **Decision needed:** yes, it replaces #199's music.

### 10.2 Sound effects still missing

From the polish audit's list, check what's still silent (catwalk collapse, vent, crusher, Big Arm slam, Siphon phases). Add the Big Arm "immune clang" (§4.3) and the hitmarker (§7).

---

## 11. Bugs from the QA, by lane

| # | Bug | Severity | Lane |
|---|---|---|---|
| B1 | Wall-crawler shoots the player through the floor | **P0** — unfair damage | Enemies (Lethabo) |
| B2 | Sergeant dialogue stays on screen after pause → level select; the next level pans with the old text up | P1 | UI (Moses) |
| B3 | Spike pit damages a player who jumps over it | **P0** — breaks the trap's rule | Levels (Renda): the trap volume is too tall |
| B4 | Primer spawn faces a wall | P1 | Levels |
| B5 | "One of theirs" line fires at the trap | P1 | Levels (trigger placement) + UI |
| B6 | Ascent spawn enemies stand still | P1 | Levels |
| B7 | Catwalk walkway's fall animation looks wrong | P2 | Levels |
| B8 | Turret has no model | P1 | Shaders |
| B9 | Frozen enemies turn 2D inside the frost shell | P1 | Shaders |
| B10 | Black circle in the Ascent sky follows the cursor | P1 | Shaders |
| B11 | Camera clips through walls and foliage | P1 | Core + Shaders (§5) |
| B12 | Dry out triggers while the player believes they're on paint | P1 — reproduce first | Core |
| B13 | Unknown billboard in Outskirts | P2 | Levels (identify) |
| B14 | Spelling is not UK/SA English throughout | P2 | Everyone; add the rule to `AGENTS.md` |
| B15 | No wave indicator in Last Colour | P1 | UI + Levels |

---

## 12. Process: how we find out we're right

### 12.1 The feel branch

Most of §3 is numbers in config. Before anyone writes a decision entry, **put the config-only changes on one branch** (`feel/loop-v2`) and play it:

- §3.1 economy (cost, refill, death splat, Ascent tank)
- §3.4 submerge numbers (angle, offset, speed, refill)
- §3.2 hip/ADS spread only (the split needs code; spread alone is a first taste)
- §3.5 world grey 0.85 (if it's a single number in config; if it needs two greys, that waits)

Play Outskirts and the Ascent on `main`, then on the branch, back to back. If the branch is clearly better, the code changes (§3.2 full split, §3.3 floor colours, §3.4 pop-out) are worth building.

### 12.2 Playtests with fresh eyes

Renda's gut is the instrument, but he knows the game now. From here on, every milestone gets **at least two playtesters who have never played it**:

- **Don't explain anything.** Watch. Note where they stop, where they look confused, where they die.
- **After each death, ask:** "What killed you? What should you have done?" (the readable-death test).
- **After each level, ask:** "Where were you? Would you play another level?" (sense of place, wanting another go).
- **Record:** time per Primer room, deaths and their causes, dry time, trigger time.

### 12.3 Trigger time (new metric, proposed)

Alongside dry time: the percentage of combat time the player spends firing or moving faster than walking speed. Target over 50%. If it's under that, the loop is still stopping the player. Cost S (Core).

---

## 13. The order

Ordered by what unblocks the most, and what the marker sees first. Each phase lists what every lane does, so nobody is idle.

### Phase 0 — Fix what's broken (1–2 days, all lanes in parallel)

| Lane | Work |
|---|---|
| Levels | B3 trap jump, B4 spawn facing, B5 line timing, B6 idle enemies, B13 billboard |
| UI | B2 dialogue bug, UK/SA spelling pass, controls screen check (Shift, Q) |
| Core | B12 reproduce dry out; camera position damping (§5) |
| Paint | Remove grey from the player's colours (§3.6) |
| Shaders | B9 frost 2D, B10 sky circle |
| Enemies | B1 crawler through floor |

### Phase 1 — The loop (the feel branch, ~1 week)

1. Feel branch with config-only changes (§12.1). **Gate: playtest. Don't move on until trigger time is up and Renda would play it.**
2. Then build: hip/ADS split (Paint), floor colours on demand (Core + Paint), pop-out jump and submerge camera (Core), two greys (Paint + Core), dry out rework (Core).
3. Levels re-measures every jump (Primer gap first) against the new physics and fixes the tests.

### Phase 2 — Combat readability (~1 week, overlaps Phase 1's build)

- Enemies: hit reactions, death clips, freeze-by-pause, Charger windup, crawler wall orientation (§6.3 A1–A6).
- Levels: Charger → zombie charger, turrets placed with models.
- UI: hitmarker and kill confirm, vertical hurt cue, Big Arm combo bar and pips, wave indicator.
- Paint: Q rework (§3.8).
- Enemies + UI: Big Arm overhaul (§4.3).

### Phase 3 — Levels (~1 week)

- Primer rebuild (§9.1) — highest priority in this phase; it's the marker's first minutes.
- Outskirts fixes (§9.2), Ascent fixes (§9.3), Last Colour waves and adds (§9.4).

### Phase 4 — Atmosphere (~1 week, can start in Phase 3 for anything not blocked)

- Skylines, particles, light, set dressing per §8.3; the Ascent first (it's the weakest), Primer second (it's seen first).
- The pipe and propaganda (§8.2).
- Occluder fade, foliage keep-outs.
- Music replacement and ambient beds (§10).

### Phase 5 — Polish and replay

- Splat bloom, tank on the gun, results rank, remaining sounds.
- Full playtest of all four levels with fresh players; fix what they find.

**Timing:** these are *estimates* for a five-person team working in parallel. They need checking against the submission deadline (open question below). If time is short, cut from the bottom: Phase 5 first, then Phase 4's pipe and particles. **Never cut Phase 1** — it's the thing that decides whether anyone wants to play.

---

## 14. Decisions needed (for `docs/DECISIONS.md`)

| # | Decision | Recommendation | Changes |
|---|---|---|---|
| D1 | New tank economy | §3.1 numbers | `PAINT_GUN`, `SUBMERGE`, `AMMO`, `DEATH_SPLAT` |
| D2 | Hip-fire paints, ADS kills | Full split, §3.2 | `PAINT_GUN` |
| D3 | Floor colours on demand for the player | §3.3 | `SURFACE`, every jump measurement |
| D4 | Submerge camera, speed, pop-out jump, wall-submerge | §3.4 | `SUBMERGE`, new verbs |
| D5 | Two greys | World 0.85, Corp 0.6 | #74 / ADR-0002 |
| D6 | No grey for the player | Remove | Colour cycle |
| D7 | Dry out is not a death | Weak dribble + 1/s trickle | PRD A5 |
| D8 | Q applies the colour's active channel | §3.8 | `PAINTSTREAK` |
| D9 | Charger uses the zombie model | Yes | Level configs |
| D10 | Big Arm: combo bar, pips, ranged shockwave, adds, one boss | §4.3 | Boss design, PRD "no health bars" stays honest |
| D11 | Primer: nothing pre-painted, four new rooms | §9.1 | Primer Decision 3 |
| D12 | Recorded adaptive music replaces the synth | §10.1 | #199 |
| D13 | Traps hurt enemies | Yes | Trap volumes |
| D14 | UK/SA spelling is a project rule | Yes | `AGENTS.md` |
| D15 | Stalker: source or cut | Open | PRD M14 |

---

## 15. Open questions for Renda

1. **When is the submission deadline?** Phase timing depends on it.
2. **Who are the fresh playtesters?** Two people outside the team, ideally one who plays a lot of shooters and one who doesn't.
3. **Q:** colour channels (recommended) or flat damage?
4. **Grey:** two greys (recommended) or one grey plus starter pools?
5. **Dry out:** keep it as a loss with a longer grace, or remove it as a loss (recommended)?
6. **Stalker:** source a model, or cut it?
7. **Is the Outskirts billboard yours** (a placed prop) or a stray?
8. **Is the plan's scope right?** Anything here you'd cut, or anything you felt in QA that this doesn't cover?

---

## 16. Not doing

To protect the plan from creep, these stay out (consistent with the PRD's out-of-scope list):

- **More than one Big Arm** (§4.3).
- **New enemy types** beyond the existing roster (AGENTS rule 7). New enemy *questions* through placement, adds and traps instead.
- **A jetpack, vehicles, a hub, paint combining, a fourth colour.**
- **Mocap or retargeting between asset families.**
- **Health bars on regular enemies.** Big Arm's bar counts combos.
