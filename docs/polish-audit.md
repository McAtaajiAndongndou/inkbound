# Polish audit — 30 Oct 2026

A critical pass over the whole game: movement, paint, feedback, traps, enemies and the four levels. Written from the code on `main` (a4bc086) and the level viewer's fixed shots. **Not a playtest:** the automated browser cannot take pointer lock, so nothing here was played by hand. Every claim cites the line or shot it came from. Anything marked *unverified* needs a human run.

Each finding gives the **diagnosis** (feedback, readability, pacing, fairness, friction or reward), the **fix**, the **lane** that owns it, and a **size** (S = under an hour, M = an afternoon, L = more).

---

## The verdict in one paragraph

The systems are good, and in places better than they need to be: the colour physics, the trap language (amber tells, blue slides past), the dormant-until-you-arrive enemies and the Siphon exam are real design. **What's missing is the layer that tells the player any of it happened.** Getting hurt makes no sound. Submerging doesn't sink you. Enemy shots can't be dodged, so their telegraphs are decoration. Half the traps are silent. The controls screen advertises a key that doesn't exist and hides the two that do. A marker plays for ten minutes and sees well-built systems that come across as unfinished. Every item in P0 and P1 below is cheaper than any feature already built.

| Area | Grade | One line |
|---|---|---|
| Colour physics | A− | Distinct, tuned, tested. Red has a hole (no refill). |
| Splatoon feel (submerge, refill) | D | The mechanic exists; the *feeling* doesn't. |
| Hit feedback / juice | D | No hit-stop, no shake, no hurt cue, no pitch variance. |
| Enemy fairness | C− | Good telegraphs, undodgeable shots. |
| Trap design | B+ | One consistent language across four levels. |
| Trap presentation | C | Silent catwalk, crusher, vent; the vent at rest reads as a floor decal. |
| Colour language | C | Red gates, a green "open" light and a yellow goal beacon break the rules the game set itself. |
| Level visuals | B− (Last Colour) → D+ (Primer, Ascent opening) | |
| UI honesty | D | Wrong controls list. |

---

## Your three questions, answered

### 1. Can we sink into our own paint?

**Technically yes, and nobody will ever find out.** Hold Shift on any painted ground (`player.js:409`) and you move 1.4× faster, refill 3× faster, and enemies see you at 7 m instead of 16 m. That is a real Splatoon mechanic. But:

- **The body doesn't sink.** The only change is the camera dropping 0.9 m (`camera-rig.js:87`). `avatar.js` has no submerged state, so in third person you watch an upright soldier jog at 1.4× speed with the camera at their knees.
- **No sound in or out, no ripple, no wake, no colour wash.** Splatoon's swim is about 80% audio-visual: the *splash* on entry, the wake trail, the screen tinting your colour, the bubbling refill hum.
- **It isn't on the controls screen** (`menu.js` lists no Shift).
- **It doesn't work on red.** See P0-2.

**Fix (M, core + shaders):** when `submerged`, squash the avatar to a flat blob in the paint colour (scale y ≈ 0.15, or hide it and show a disc decal), spawn a ring ripple on entry and exit, trail small droplets while moving, play a splash in and a splash out, loop a quiet refill bubble, and tint the screen edge in the ground colour. Add Shift to the controls list. *Why it works:* a state the player can't see doesn't exist for them. Splatoon makes swimming its own **form**, not a speed modifier, and that is why every player learns it in the first minute.

### 2. Could the reload be faster?

The numbers (`config.js` PAINT_GUN, SUBMERGE, AMMO):

| | Rate | Empty → full (100 tank) | Ascent (60 tank) |
|---|---|---|---|
| Standing on paint | 8 /s | **12.5 s** | 7.5 s |
| Submerged | 24 /s | **4.2 s** | 2.5 s |
| Splatoon, swimming (reference) | — | ~3 s | — |

**The submerged number is nearly right. The problem is that the player doesn't know submerge exists, so in practice everyone refills standing, at 12.5 s.** That is the "reload feels slow" feeling. One tank is also only 25 shots (cost 4) at 7 shots per second, so it empties in about 3.5 s of trigger. Splatoon's ratio is the same shape: empty fast, refill fast *in ink form*, refill painfully slowly standing up. The design is right; the tutorial and the feel are missing.

**Recommended default:** `SUBMERGE.refillMultiplier` 3 → 4 (32 /s, 3.1 s full, the Splatoon number), and leave standing refill at 8 so submerging stays *the* way to reload. Add a rising refill tone and a "full" click (Splatoon's tank ding), and make the tank visibly fill. **Alternative:** drop standing refill to 4 /s to force the lesson harder; only do that once the Primer teaches submerge. **Not recommended:** raising standing refill, because that deletes the reason to submerge.

The Primer has no room for submerge. Nine rooms teach move, splat, blue, red, green and the trap, and the game's refill verb is in none of them. **Add it to R2 (The First Splat): paint a pool, then "hold Shift" via the sergeant.** That's levels lane, size S.

### 3. Does grey slow us down?

**Yes, to 0.6×: 7 → 4.2 m/s** (`SURFACE.grey.standSlow`, #74, tested in `grey-slowdown.test.js`). Two critical points:

1. **There is no feedback that it's happening.** No sludge sound, no footstep splash, no HUD cue. The player just feels sluggish and blames the controls. Splatoon's enemy ink has a sticky footstep sound and a visible splash, and it does a little chip damage, so you *know*.
2. **Grey is the whole level at load.** So the player's first minute in every level is spent at 4.2 m/s, which is slower than a Charger (5.0) and barely faster than a Drainer (4.0). That's intended as "you must paint to move", and it's a strong idea. But it makes the *first impression* of every level "this game is slow". Splatoon avoids this by keeping neutral ground neutral: only *enemy* ink slows you.

This is a settled decision (#74), so it is **flagged, not changed**. Recommendation for Renda + the core lane to decide:

- **Default:** keep 0.6, add the feedback (sludge footsteps, a slight desaturation at the screen edge), and make sure every level's spawn has paint on the floor (prepaint, the way the Primer does), so the player's first steps are fast and they *feel* grey as a loss.
- **Alternative:** two greys. The world's grey is 0.85, and grey that an enemy shot or Big Arm's slam has *freshly* laid is 0.6. This needs a decision-ledger entry, because it changes #74.

---

## P0 — broken, unfair or false. Fix before anything else

| # | Finding | Evidence | Diagnosis | Fix | Lane | Size |
|---|---|---|---|---|---|---|
| P0-1 | **Enemy ranged shots can't be dodged.** The hit is applied when the windup ends, unconditionally: no line-of-sight, range or cover check, no projectile. Run behind cover during the amber telegraph and you are still hit. | `main.js:231` wires `onAttack` → `takeDamage`; `enemy.js:2398` calls it with no test. DECISIONS (Big Arm) notes it: "damage the player unconditionally". | **Fairness.** A telegraph whose answer is "take it anyway" teaches players to ignore telegraphs, which is the whole enemy language. | Re-check LOS and range at the moment of the shot. Better: fire a slow, visible projectile (amber, ~25 m/s) that can be dodged and blocked by walls. CoD gets away with hitscan because enemies miss; ours never miss. | Enemies + core | M |
| P0-2 | **Red paint never refills you, never lets you submerge, and never counts toward dry-out.** Standing on red bounces you, so `onGround` is never true, and refill is inside `if (player.onGround)`. | `player.js` restitution branch never sets `onGround`; `main.js:347` | **Rule break.** The design pillar is "standing in your own paint refills you". On a third of your colours it doesn't. | Refill on contact with any player paint (touching red this frame counts). Add a test. | Core | S |
| P0-3 | **The controls screen is wrong.** It lists **F = Refill ammo**, a key that doesn't exist (the design forbids a refill button). It omits **Shift (submerge)** and **Q (paintstreak)**, which are both real. | `menu.js:93`; `input.js` binds no F | **Feedback / trust.** It hides two systems and advertises a third that's banned. A marker will press F. | Replace F with Shift = Submerge (refill fast), and add Q = Paintstreak. | UI | S |
| P0-4 | **Getting hurt has no feedback.** No hurt sound, no screen flash, no damage direction. In first person the avatar flinch is hidden, so there is *nothing*. | No `hurt` in `audio-manager.js` SFX; no hurt cue in `hud.js` | **Feedback.** Health drops without the player knowing why or from where. This is the single most "unpolished" feeling in an action game. | A red-edge vignette pulse (not a paint red: use the danger amber, or a dark desaturated edge), a directional arc toward the source (CoD), a hurt thud, and a tiny camera kick. | UI + core | M |
| P0-5 | **The colour language contradicts itself in three places.** (a) Outskirts' gate drain field is `0xff3b46`, "in PAINT.red's family", and is the biggest red object in the level. (b) An opened gate's light turns *paint green*. (c) The layout levels' goal beacon is `0xffd23f`, a yellow nearly identical to danger amber `0xffe600`, while DECISIONS says "amber means this hurts; white only means here". | `level-01-mission.js:546, 1494`; `layout-builder.js:210` | **Readability.** Red should mean bounce, green should mean climb, and amber should mean hurt. The player is learning wrong lessons from furniture. | Gate field → Corp grey-violet, or desaturated amber because it *does* block you. Open-light → white. Beacon → the cold white floodlight colour (`LAST_COLOUR.props.floodlight`). Move all three into `config.js` (rule 4: the `TOWER` and `GATE` colours currently live in the level file). | Levels | S |

---

## P1 — feel. The difference between "works" and "feels good"

### Juice (none of this exists today: no matches for shake, hit-stop or vignette anywhere in `src/`)

| # | What | Why | Lane | Size |
|---|---|---|---|---|
| P1-1 | **Hit-stop**: 40 ms on a kill, 80 ms on a freeze-shatter, 120 ms on a Big Arm combo step. Freeze `simulate`'s dt, keep rendering. | Makes kills land. The freeze-shatter crit is the game's best combo and currently resolves in a single frame. | Core | S |
| P1-2 | **Screen shake**, as a trauma value with decay (Squirrel Eiserloh's GDC talk): small on red knockback, medium on hurt, large on Big Arm's slam and the crusher's beat when nearby. Never on firing. | The heavy events (slam, crusher, collapse) currently have no weight. | Core (camera rig) | S |
| P1-3 | **Pitch variance on every sound**: ±6% detune per `play()`. | You fire 7 shots a second. Identical synthesized blips at that rate are the main source of ear fatigue. Three lines in `audio-manager.js`. | UI (audio) | S |
| P1-4 | **Death returns colour.** An enemy currently sinks into the floor (`GAIT.deathSink`). Make it burst into a splat of the colour that killed it, painted onto the ground as player paint. | This is the fiction ("colour given back"), the feedback and the loop in one: a kill becomes a refill puddle. Splatoon's splat-on-death is the model. | Enemies + paint | M |
| P1-5 | **Freeze, shatter and pin sounds.** The blue freeze, the critical shatter and the green pin are silent beyond the generic hit. | The combo system is the game's depth, and the player can't hear it working. | UI (audio) | S |
| P1-6 | **Low-ink warning sound** before empty, plus the HUD pulse that already exists. **Tank-full click.** | The player looks at the action, not the HUD bar (Splatoon puts the tank on your back for this reason). | UI | S |

### Sounds that are defined and never played, or never defined

`audio-manager.js` defines `collapse` and `blade`, and **nothing plays either** (the catwalk is silent; blades were cut). Silent today: the **catwalk** collapse, the **vent** eruption, the **crusher**'s beat, **Big Arm**'s slam, the **Siphon**'s phases and win, the **layout levels' gates** (only Outskirts plays `gate`), **submerge**, **refill**, **hurt** and **grey footsteps**. Only the spike pit sets `sound:` on its trap volume.

**Fix:** a one-line `sound:` on each trap (vent, crusher), `audio.play('collapse')` in `catwalk.js`, and new SFX for slam, Siphon, submerge, refill and hurt. Delete `blade`. Levels lane owns the trap call sites (S); UI owns the new SFX (M).

---

## Traps

**The design is the strongest system in the game.** Four traps, one per level, and one language: an amber tell, a hit that never one-shots you, and paint as the answer (blue slides past the pit and the crusher; your paint kills the vent). That's Nintendo-grade consistency; keep it.

**Presentation is where they fall down:**

| Trap | Critique | Fix | Size |
|---|---|---|---|
| **Vent** (Outskirts C) | At rest it's a flat amber outline on the floor, and from the `vent` shot it reads as a **landing pad or a floor marking**, not a machine. The amber is also close to the olive waste beside it, so the two hazards blur. And it's silent. | Give it a raised grate rim, slats and an idle wisp of grey vapour, so it reads as dangerous *between* eruptions. Add an eruption hiss. Consider pushing the waste more olive or brown, so it separates from amber. | S |
| **Spike pit** (Primer R6) | The tell is a 0.07 rad board tilt plus visible spikes. That's good. It sounds when it fires. The best-presented trap. | Only: show blue's solution in the frame of the room before the pit (the doc says R3 teaches it; check the sightline). | — |
| **Crusher** (Last Colour) | It has a rhythm and a lamp tell, but **no sound**, so the beat can't be read without looking, and a beat is an audio idea. The `corridor` viewer caption still describes "the laser grid", which was cut. | A clank on the drop, a hydraulic hiss on the rise, and a tick on each blink of the warning lamp. Fix the caption (`last-colour.js:329`). | S |
| **Catwalk** (Ascent) | The amber flash on the walking surface is good, and the tests are thorough. It falls **silently**: the `collapse` SFX exists and is never called. | `audio.play('collapse')` when a segment starts going, plus a creak when you step on. Shake the camera slightly on a fall nearby. | S |

---

## Enemies — how well they flow

**Good:** telegraphs are amber, swell and whine (`enemy.js:2296`); enemies sleep until you enter their room and are visible while they wait (the "opt-in difficulty" lesson from the B/C playtest); the Charger has a recovery window; the Stalker prefers paint (a lovely question: *do I paint the floor it will chase me on?*); the Drainer eats your territory.

**Critique:**

1. **P0-1 again.** Undodgeable shots undo the telegraph language.
2. **No cap on simultaneous attackers.** No attack-token system was found in `enemy.js`. With 30 enemies in Last Colour, a wave can wind up together and land five shots on the same frame. Doom (2016) and Halo limit attackers to 2–3 at a time, so a crowd feels dangerous without stacking unfair damage. **Fix (M, enemies):** a shared token pool, of size two, that a ranged enemy must take before it starts a windup. *Unverified in play;* check it on the Core's wave three.
3. **`telegraph` plays on every enemy's windup**, globally and at full volume. In a wave of eight, that's a whine wall. Attenuate it by distance, or play it only for enemies within 15 m or on screen.
4. **Death is anticlimactic**: a sink. See P1-4.
5. **The enemy question per colour is clear on paper** (Charger → red off a ledge, Sprayer → blue freeze, Crawler → anything knocks it off the wall), **but the player is never told it.** CoD and Doom teach each enemy with a framed first encounter. The Primer's R7 "One of Theirs" does this for the Charger only. Every other type's first appearance should be one enemy, at a distance, in a room shaped for its answer. That's levels lane: check Outskirts B (Sprayer) and the Ascent trailhead (Crawlers).

---

## Level visuals (from the viewer's fixed shots)

| Level | Shot | Critique | Fix |
|---|---|---|---|
| **Primer** | `spawn` | A corridor of identical riveted panels on every wall, floor and crate. It reads as a debug texture, not a rebel training ground. The chalk lines and crates help, but the room has no focal point. | One hero prop per room (a target board lit warm, the sergeant's crate desk). Vary the panel scale on the floor versus the walls. Light the next doorway warmer than the room you're in (leading light, Half-Life 2). |
| **Ascent** | `spawn` | **The first frame is a flat grey box wall filling the screen.** The mountain reads as stacked boxes. The level's whole identity ("see the goal") is invisible from its first frame. | Turn the spawn camera to face the summit gantry. Break box silhouettes with sloped caps and rock props from the decor kit. The floodlit gantry should be in the first frame. |
| **Outskirts** | `ledge` | The level's payoff shot (look back at your colour, the decor reveal) is **dominated by the red gate field and its bar**, dead centre. | Fade the fields fully once their arena clears (they fade by 1.8/s, so check they reach 0 and hide). Then drop the frames, or lower the bar out of this camera. |
| **Outskirts** | `spawn` | Fog 8–46 m hides island C from spawn. Fine for mood, but there's no landmark pulling you forward. | A tall lit element on the tower, visible through the fog (the Ascent's floodlight trick). |
| **Last Colour** | `spawn` | **The best-looking level.** The amber haze, grey machinery and pale enemies read clearly against the floor. | Keep it as the visual bar the other three are measured against. |

---

## The order to do it in

Ranked by player-visible change per hour, with grading in mind (visuals and interaction bands):

1. **P0-3 controls list** (S, UI). Five minutes, and the most embarrassing item.
2. **P0-5 colour language** (S, levels, *yours*). Gate field, open light, beacon, moved into config.
3. **Trap sounds and stale caption** (S, levels, *yours*). Catwalk, vent, crusher.
4. **P0-2 red refill** (S, core).
5. **P1-3 pitch variance + P1-1 hit-stop + P1-2 shake** (S each, UI/core). The biggest feel jump for the least code.
6. **P0-4 hurt feedback** (M, UI + core).
7. **Submerge made visible + refill ×4 + a Primer lesson** (M, core/shaders + levels).
8. **P0-1 dodgeable shots + attack tokens** (M, enemies). The largest change; it may shift fight difficulty, so replay every arena afterwards.
9. **Death returns colour** (M, enemies + paint).
10. **The Ascent's spawn framing and the Primer's focal points** (S–M, levels, *yours*).

**Your lane today:** items 2, 3, 10 and the Primer's submerge lesson. Everything else becomes an issue for its owner, per AGENTS.md: do not cross lanes.

---

## Found after the audit (same day)

| Finding | Where it's written | Status |
|---|---|---|
| **Green climbs never finish.** The mantle probes behind the player, so it pulls them back down, or does nothing on walls over ~5.6 m. Regression from #157. | `docs/issues/065-mantle-probes-wrong-side.md` (core, Ozuko) | Published, #184 |
| **Enemy shots become pellets** (the design for P0-1): they fly, can be dodged, stop at walls and grey where they land. | `docs/issues/066-enemy-pellets.md` (enemies, Lethabo), plus the `DECISIONS.md` entry | Published, #185 |
| **Bodies pass through enemies.** The player only collides with walls (`checkEnemyContact` only applies damage, never pushes the player out), and enemies never separate from each other, so a wave stacks into one blob. Fix: a player-vs-enemy push-out in core, and a separation step between enemies in the enemies lane. | `docs/issues/067-player-enemy-bodies.md` (core, Ozuko) and `068-enemy-separation.md` (enemies, Lethabo; two wiring lines are yours) | Published, #186 and #187 |
| **Only Outskirts has real environment models.** The Primer, the Ascent and Last Colour are procedural boxes. Last Colour needs military props. | `docs/ASSETS.md`, "Environment candidates" (licences checked, nothing downloaded) | Shortlist |
| **Enemies need a dedicated polish pass** (Renda's playtest). The "Enemies" section above is the starting list; attack tokens, telegraph spam and death feedback are the core of it. | This file | **Not started** |

## What this audit could not check

- **Nothing was played by hand.** The browser automation can't lock the pointer. Fight pacing, how jumps feel and actual difficulty need Renda's run. Use the playtest prompts per level in `polish-pass-1.md`.
- Whether the paint splat *blooms* on impact (the grey-to-colour moment) wasn't seen in motion.
- Frame rate in Last Colour's wave three wasn't measured.
