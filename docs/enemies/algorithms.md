# Enemy Algorithms

Behaviour specifications for every enemy. This is a **design document**: pseudocode, states and tuning numbers, not implementation. If a number here disagrees with `config.js`, the number here is the intent and the config is out of date.

Governing rule from `ENEMIES.md`: **every enemy is a question, and every attack has three beats** — *Tell*, *Threat*, *Opening*. An enemy with no Opening is a health check, not a fight.

---

## Shared substrate

Everything below inherits this. It exists once, not per enemy.

### Awareness

```
STATE ::= Dormant | Alert | Search

Dormant : patrol, idle
Alert   : has seen the player, is acting on it
Search  : lost the player, walking to the last known position
```

| Rule | Value | Why |
|---|---|---|
| Detection radius, player dry/wet | 16 m | Generous — dry players should be findable |
| Detection radius, player submerged | 7 m | Partial stealth. Halved, not zero |
| Firing reveals | 3 s of Alert regardless of submerge | Firing is the tell that keeps stealth fair |
| Last known position | remembered for 6 s, then Dormant | Searching should feel like being hunted, not omniscient |
| Line of sight | required to gain Alert, not to keep it | Once alerted, they pursue your last position |

### Movement

| Rule | Value | Why |
|---|---|---|
| Refuses a step with no floor | always | Keeps enemies on their island |
| Refuses a step down greater than | 1.0 m | A kerb is fine, a storey is not |
| Knockback bypasses both rules | always | Flinging enemies off ledges is the point |

### Pellets (ranged shots)

Since #185 (DECISIONS 2026-10-30, "Enemy shots are pellets") a ranged enemy's shot is a **pellet that flies**, the way Splatoon's enemy ink does. Who fires them: Sprayer, Wall-crawler, Turret — any enemy whose config has a `shotSpeed`. Melee (Charger, Stalker, Drainer, Big Arm's slam and grab) is unchanged.

| Rule | Value | Why |
|---|---|---|
| Look | dark Corp grey ball, amber rim, short amber trail | Grey alone vanishes against a grey world; amber is the "this hurts" colour |
| Size | radius 0.15 m | Visible at 12 m without hiding the player |
| Speed | 22 m/s (Sprayer, Wall-crawler); 30 m/s (Turret) | See the dodge maths |
| Path | straight, light drop (4 m/s²); the aim compensates | Reads as ink, not a bullet; a standing player is still hit |
| Aim | the player's chest **where they are when it fires** — no leading | Moving is how you dodge |
| Spread | ±1.5° | A burst is three shots, not one |
| Hits the player | touches the capsule (radius `PLAYER.radius` + 0.15, height `PLAYER.height`) → `onAttack` | `onAttack` keeps its meaning: "this attack hit you" |
| Hits a surface | stops; greys `greyRadius` at the impact point | Cover is real |
| Range | expires after `attackRange × 1.5`; a spent pellet greys the floor within 4 m below it, or nothing over a pit | A miss still costs ground |
| Dead shooter | its pellets in the air keep flying | Fair, and what Splatoon does |

**The dodge maths.** A Sprayer at 12 m with a 22 m/s pellet gives **0.55 s** of flight. On your paint (7 m/s) a sidestep covers 3.8 m — an easy dodge. On **grey** (4.2 m/s) it covers 2.3 m, still enough, but only if you react on the wind-up, not on the pellet. At 6 m flight is 0.27 s: close range is where you get hit. **Grey makes you easier to hit**, so painting your ground is also defence, and the Sprayer's 8–12 m band is where dodging is possible but earned. A Turret at 15 m with a 30 m/s pellet gives 0.5 s, after a 0.8 s lock: strafe, or break line of sight.

### Status effects

| Effect | Source | Duration | Does it stop attacks? |
|---|---|---|---|
| Frozen | 3 blue hits in a window | until crit taken | Yes |
| Crit window | frozen state | 2 s | — |
| Pinned | 1 green hit | 3 s | **No** — pinned enemies still attack |
| Sliding | standing on blue floor | while on it | No — removes steering only |

---

## Charger

Melee. Commits to a straight line. The first enemy the player meets.

```
PATROL  -- sees player, LOS, < 18m --> ALERT
ALERT   : plant, windup 0.5s, facing locked at release
ALERT   -- windup complete --> CHARGE
CHARGE  : heading locked, speed 5.0, steering disabled
CHARGE  -- hits wall --> STAGGER (0.4s) --> RECOVER
CHARGE  -- travel > 12m or 2.5s --> RECOVER
RECOVER : stationary, vulnerable, 1.2s      <-- THE OPENING
RECOVER -- sees player --> ALERT
```

| Property | Value |
|---|---|
| Speed, charge | 5.0 m/s |
| Contact damage | 25 |
| Recovery (Opening) | **1.2 s** |
| On blue floor | steering 0, deceleration 0.4 → overshoots past the player |
| Green pin | cancels the charge, roots it. Pinned Charger is harmless (no ranged attack) |
| Freeze | stops it, frost shell, normal crit window |

**Why the opening matters:** without `RECOVER`, the fight is "sidestep or take 25". With it, the fight is *bait → dodge → punish*, which is a skill curve. This is the single cheapest combat improvement in the game.

**Edge behaviour:** a Charger will not walk off a ledge on its own, but `RECOVER` does not save it from knockback. Red-flinging one off a cliff is a valid, rewarded kill.

---

## Sprayer

Ranged. Fights your *paint*, not just your health.

```
PATROL   -- distance to player in [8, 12] --> STRAFE
STRAFE   : lateral movement, direction flips every 1.5-2.5s
STRAFE   -- distance < 8  --> RETREAT
STRAFE   -- distance > 12 --> ADVANCE
STRAFE   -- LOS and cooldown ready --> AIM
AIM      : plant, 0.6s telegraph
AIM      -- complete --> FIRE (burst of 3 pellets, 22 m/s)
FIRE     -- burst done --> RELOAD 1.2s       <-- THE OPENING
PINNED   : can be rooted and STILL FIRES (rule 1 of ENEMIES.md)
```

| Property | Value |
|---|---|
| Preferred range | 8–12 m |
| Grey splat radius per shot | 1.5 m |
| Reload (Opening) | **1.2 s** |

**Fires pellets** (see *Pellets* above): each one can be sidestepped or blocked by cover, and a burst at 12 m is dodgeable on paint, barely on grey.

**Grey paint:** each pellet converts floor from your colour to grey where it lands — on a hit, under your feet; on a miss, wherever it comes down — — the same operation as your gun, in reverse. This is the tug-of-war (`ADR-0002`). The Sprayer is therefore a **territory enemy** disguised as a ranged enemy: killing it is how you stop losing ground.

**Green pin does not defuse it.** That's deliberate — pinning a shooter that can still shoot teaches the player that control is not the same as safety.

---

## Wall-crawler

The flanker. Turns your own traversal paint into its ladder.

```
PATROL   -- player within 15m, LOS --> CLIMB toward player
CLIMB    : moves along surfaces, speed 3.5 (grey) / 5.0 (green)
CLIMB    -- within drop range of player AND above them --> DROP
DROP     : falls onto player position, contact damage 10
DROP     -- landed --> PATROL
CLIMB    : CANNOT shoot while climbing      <-- THE OPENING
GROUND   : in range, fires one wound-up pellet (22 m/s), like the Sprayer's
```

| Property | Value |
|---|---|
| Ground speed | 3.0 m/s |
| Climb speed, grey | 3.5 m/s |
| Climb speed, **on green paint** | 5.0 m/s |
| Behaviour on green | prefers green paths to grey ones |

**The design point:** your route is its route. Painting green to climb is always a decision with a cost, because a Wall-crawler on the same face becomes faster than you.

| Counter | Effect |
|---|---|
| Green pin | roots it; **mid-climb it falls** |
| Red knockback | knocks it off the wall — buys time, it must re-climb |
| Blue freeze | stops it mid-climb, it falls, normal crit window |
| Position | climbing is the Opening — shoot it on the wall |

---

## Turret

Static. Denies space. The deliberate **matrix gap**.

```
IDLE     -- player within 15m --> TRACK
TRACK    : rotates toward player at max 60 deg/s
TRACK    -- aim within 3 deg and cooldown ready --> LOCK
LOCK     : 0.8s telegraph (barrel settles)
LOCK     -- complete --> FIRE (burst of 4 pellets, 30 m/s)
FIRE     -- complete --> COOLDOWN 1.5s      <-- THE OPENING
```

| Property | Value |
|---|---|
| Movement | none |
| Track rate | 60 deg/s — slow enough that strafing beats it |
| Pellets | 30 m/s; ignore stealth; **grey nothing** |
| Cooldown (Opening) | **1.5 s** |
| Status procs | **none. No freeze, no pin, no knockback.** |

**Why no procs.** With all three colours always available, an enemy that any colour can freeze is just a normal enemy. The turret is the one thing paint does not solve — you either break line of sight and flank it, or you eat the burst. That empty cell in the matrix is the lesson (`ENEMIES.md`).

Damage from all three colours is equal and unremarkable. There is nothing to *engineer* here, and that's the point: not every problem is a paint problem.

---

## Drainer

Territory eater. Weak, fast, numerous. The signature enemy of Last Colour.

```
FEED      : slow crawl, converts paint under it to grey at 1.5 m²/s
FEED      -- player within 8m --> RISE (0.5s)
RISE      --> HUNT
HUNT      : upright shamble, speed 4.0, contact damage 5
HUNT      -- player beyond 14m --> FEED
```

| Property | Value |
|---|---|
| HP | 20 — dies to almost anything |
| Threat | not to health. To **resupply** |

**Why it exists:** it is the anti-snowball. In a wave that goes well, your territory grows and you get faster and better armed. The Drainer takes that back, so a long fight doesn't become a free win.

Catching them **feeding** is the craft: interrupt the drain before they rise into a swarm.

---

## Stalker

The loop inversion. Last Colour only.

```
LURK   : idles inside the player's territory if any exists
LURK   -- player within 20m --> HUNT
HUNT   : moves toward player at speed scale by surface
HUNT   -- within 2m --> LUNGE
LUNGE  : 0.4s telegraph, then commit
LUNGE  -- miss --> RECOVER 0.8s            <-- THE OPENING
```

| Property | Value |
|---|---|
| Speed on **your paint** | 6.0 m/s — faster than you |
| Speed on **grey** | 2.0 m/s — slower than you |
| Visibility | always visible. No hiding |
| Status procs | all normal |

**The inversion:** every other enemy punishes you for being dry. The Stalker punishes you for being *wet*. Because it is fast only on your colour, the escape is to run onto grey — leaving your resupply, your speed and your safety. That is the only enemy in the game that makes you give up your own ground to survive.

It is deliberately **not** hidden. An enemy that is both faster than you and invisible in the one place you're meant to feel safe is not tension, it's unfairness.

---

## Big Arm — arena boss

Last Colour, wave three.

| Phase | Behaviour | Player answer |
|---|---|---|
| 1 | Slow advance, ground slam (1.0s telegraph), repaints 4 m radius grey | Keep territory behind it |
| 2 | Adds a grab, faster advance, spawns 2 Drainers | Kill the Drainers or lose the floor |
| 3 | Enraged, continuous slam, ignores paint | Everything you have |

Dies to a **committed combo**, not to damage-over-time: **blue freeze (3 hits) → green pin (while frozen) → red knockdown (while pinned)**, landed once per phase; the third kills it. A missed window resets the chain. Built in `src/enemies/boss.js`, tuning in `ENEMY.bigArm` (DECISIONS 30 Oct).

---

## Siphon — the final exam

Not an enemy. A structure. No HP bar.

```
Phase 1 : intake exposed   -> blue freeze the intake
Phase 2 : arms thrash      -> green pin the arms, <= 3 at once
Phase 3 : core exposed     -> red knock the core into its own machine
```

Each phase is a colour, in sequence, with no new verb introduced. That's what makes it a final exam rather than a boss: it tests the system the whole game taught, and it needs no rig, no animation set and no AI.

---

## Tuning summary

| Enemy | HP | Speed | Tell | Opening | Threat |
|---|---|---|---|---|---|
| Charger | 30 | 5.0 | 0.5 s | 1.2 s recovery | 25 contact |
| Sprayer | 40 | 2.5 | 0.6 s | 1.2 s reload | burst of 3 |
| Wall-crawler | 45 | 3.0 / 5.0 on green | 0.4 s drop | while climbing | 10 contact |
| Turret | 70 | 0 | 0.8 s | 1.5 s cooldown | burst of 4 |
| Drainer | 20 | 4.0 | 0.5 s rise | while feeding | 5 contact |
| Stalker | 25 | 6.0 on paint / 2.0 grey | 0.4 s | 0.8 s recovery | lunge |

**The one number to protect:** every enemy must have an Opening at least as long as the player's time-to-kill. If the Opening is shorter than the kill, the enemy is unpunishable and the fight becomes attrition.
