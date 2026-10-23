# The Ascent — Level Two

**Identity:** the loop with *no space*. Vertical, exposed, every splat deliberate.

The player arrives from the forest having learned that paint makes them fast and safe. This level takes away the room to be careless: ledges are narrow, faces are long, and the only way up is a colour you had to choose to spend.

Artefacts referenced: `ADR-0001` (shared tank), `ADR-0002` (grey is enemy paint), `ADR-0003` (all three colours), `GLOSSARY.md`, `docs/enemies/algorithms.md`.

---

## The layout conflict, and how it's resolved

A mountain wants switchbacks. Switchbacks are corridors. Corridors are the one shape this game must not fight in, because retreating to repaint is the core verb and a corridor removes the option.

**Resolution: terraces, not switchbacks.**

| Element | Shape | Contains combat? |
|---|---|---|
| **Terrace** | Wide, open, at least two exits, room to circle | **Yes.** This is where fights happen |
| **Climb** | Short, vertical, single route | **No.** Pure traversal, no enemies |
| **Chain** | Optional fast route with a safe fallback below it | **Yes, lightly** |

So the level alternates **arena → climb → arena**. Fights always happen where the player can retreat; climbs are never ambushed by something they can't escape. That's the pattern the other levels copy.

The **bounce chain** is the third shape and the level's signature: a fast, risky route up a cliff face, with the safe switchback running underneath it. Falling off the chain drops you onto the switchback — it costs time, not the run. That's a loop in three dimensions, and it's how this level gets a shortcut without breaking the arena rule.

---

## Route

```
R0  Landing            y0      safe         hook, look up at the mountain
R1  The First Face     y0      traversal    paint green to climb          [climb]
R2  Terrace One        y5      arena        wall-crawler on your own face [terrace]
R3  Collapsing Catwalk y5      traversal    cross before it drops         [climb]
R4  Terrace Two        y10     arena        turret watches the paint spot [terrace]
R5  The Chain          y10→16  risky        boulder, three red pads       [chain]
R6  The Ledge          y16     arena        charger, nowhere to sidestep  [terrace]
R7  Summit             y16     release      no enemies, sightline         [—]
R8  Supply Lift        y16     transition   descent into Last Colour      [—]
```

---

## Room by room

### R0 — Landing

**Question:** *what am I looking at?*
Flat, wide, no enemies, no trap. The mountain rises ahead. Grey everywhere, and the player is slow because of it — the first thirty seconds should make them want to paint something out of irritation alone.

**Paint budget:** 0. **Exit:** walk to the face.

---

### R1 — The First Face

**Question:** *how do I go up when I can't jump it?*

A 5 m rock face. Too high to jump (1.39 m). One paintable strip runs up the left side; the rest is rock and refuses paint. Green, and only green, gets you up.

This is the level's whole idea, delivered without a word: **vertical routes are painting.**

**Notes**
- The paintable strip should be narrow enough that two splats are enough — this is not a paint-sink.
- If the player paints blue or red on it, nothing happens. That failure is the lesson, so let it happen.
- No enemies. No hazard. Let them experiment.

**Paint budget:** ~3 splats. **Exit:** the top, onto Terrace One.

---

### R2 — Terrace One

**Question:** *will you paint a route something else can use?*

First fight, and the point is uncomfortable by design. The ground is grey. The player paints green on a face to get around — and a **Wall-crawler** uses the same paint to reach them.

| Content | Detail |
|---|---|
| Enemies | Wall-crawler ×1, starting on the far side |
| Terrain | 16 m wide, 12 m deep, two exits, one raised block for cover |
| Trap | none |
| The beat | The green you painted in R1 is still climbable and still on the wall. The crawler takes it |

**Why it works:** the player just learned "green = go up". Here they learn "green = go up *for everyone*". That's the same verb, inverted, with no new mechanic.

**Paint budget:** ~5 splats. **Exit:** the catwalk.

---

### R3 — Collapsing Catwalk

**Question:** *can you cross before it drops?*

A 10 m narrow walkway over the drop, 4 m wide, in three segments. Each segment collapses ~1.2 s after being stood on. The player is the timer.

| Answer | Cost |
|---|---|
| Blue strip → slide across in one go | 1–2 splats, fast, committed |
| Red pad → bounce the whole span | 2 splats, high risk |
| Run it, don't stop | free, but no recovery if they hesitate |

No enemies. This is a pure traversal beat and a breather after R2.

**Readability:** segments visibly crack and sag before they go. No silent collapse.

**Paint budget:** ~2 splats. **Exit:** Terrace Two.

---

### R4 — Terrace Two

**Question:** *can you make paint where you're being watched?*

The turret room, and the level's economics in one image: **a turret covering the only good place to paint.**

| Content | Detail |
|---|---|
| Enemies | Turret ×2 — one overwatching the main floor, one covering the climb face's base |
| Terrain | 18 m wide, two levels, a safe pocket behind a rock on the right |
| Trap | none |

**The trap here is the situation, not a spike.** The player must go somewhere exposed to get the paint they need to advance — the exact pressure "no space" means. And the turret has **no status procs**: no freeze, no pin, no useful knockback. All three colours just do damage. The answer is positioning, not paint.

That's the matrix gap being taught at the moment it's least convenient.

**Paint budget:** ~8 splats, the most expensive room so far, deliberately. **Exit:** the chain, or the switchback beside it.

---

### R5 — The Chain

**Question:** *will you commit?*

The signature room. Three red pads ascending a 6 m cliff face, with no floor between them. Two routes up:

| Route | Risk | Reward |
|---|---|---|
| **The chain** — three red pads | Fall = drop to the switchback | Fast, and you arrive above the turret |
| **The switchback** — the safe path underneath | None, slow | Arrive at the bottom, exposed |

A **rolling boulder** comes down the switchback behind them on entry, so "safe" isn't free either. The chain is how you outrun it.

One **Wall-crawler** accompanies the climb — it can take the cliff faster than the player can chain it, which is the one place the enemy should genuinely frighten them.

**Notes**
- The pads must be tuned to the existing bounce numbers, not invented: 2 m lift and ~4.5 m of travel per pad.
- A missed pad must *always* land on the switchback. Never the void.
- This is the room to playtest most. If it doesn't feel good, the level has no personality.

**Paint budget:** ~6 splats (3 pads, plus aiming misses). **Exit:** The Ledge.

---

### R6 — The Ledge

**Question:** *how do you beat a charger with nowhere to sidestep?*

A 5 m wide shelf with a long drop on both sides. **One Charger.** In the forest you sidestepped one. Here there is nowhere to sidestep to.

| Answer | Cost | Feel |
|---|---|---|
| Blue strip → it slides straight past and over the edge | 1–2 splats | The clean, earned kill |
| Red pad → bounce over it, land behind | 2 splats | Riskier, works |
| Green pin → stop it, then shoot | 1 splat | Safe but slow |

Two **pendulum blades** swing across the shelf on a fixed rhythm, so standing still to line up a pin costs something.

This is the level's **final exam**: a familiar enemy, made new by terrain, solved only with the thing the level taught.

**Paint budget:** ~5 splats. **Exit:** the summit.

---

### R7 — Summit

**Question:** *why are we doing this?*

No enemies. No traps. No paint required.

The player walks out onto an open summit and sees the dead forest behind them and a **grey military base** on the horizon. That's the level's entire story beat, delivered by geometry. The sergeant gets his one line here.

This is the **release** beat. Do not put anything in this room. Its job is to let the last fight land.

---

### R8 — Supply Lift

Cold machinery, a platform, and a descent into the mountain. The transition to Last Colour. No combat, no puzzle — the player boards, the lift goes down, the next level loads.

Cheapest cinematic in the project: the world moves past, nobody has to animate anything.

---

## Paint budget

Total tank for the level: **60** (`AMMO[2]`). Under shared-tank rules, that number is a *pace* setting, not a hard limit, because the player recovers by standing in their own territory.

**The rule this level enforces:**

> No room may require more than **20% of the tank** in unrecoverable spend.

If a room needs more than that, the level is a paint-sink and the player is being punished for the shape of the geometry rather than for a decision.

| Room | Intended spend | Recoverable? |
|---|---|---|
| R1 | 3 splats | Yes — climb face stays painted |
| R2 | 5 | Yes — the terrace floor is large |
| R3 | 2 | Partly — segments fall away |
| R4 | 8 | No — this is the squeeze, by design |
| R5 | 6 | Partly — pads persist, switchback is grey |
| R6 | 5 | Yes — the shelf is paintable |

R4 is the only intentionally unrecoverable room. If the player runs dry anywhere, it should be there — and it should be their own fault for painting in the open.

---

## Traps

| Trap | Room | Answer it must allow |
|---|---|---|
| Collapsing catwalk | R3 | Blue to cross fast, red to skip, or nerve |
| Rolling boulder | R5 | Outrun on the chain, or commit to the switchback |
| Pendulum blades | R6 | Green pin a charger while standing still, at a cost |

Escalation rule for the campaign: the tutorial teaches *that traps exist*, the forest teaches *that traps have colour answers*, and here traps become **the texture of the level** — one per traversal beat.

---

## Fail-forward rules

| Event | Result |
|---|---|
| Falling from a climb | Land on the terrace below. Cost: time |
| Falling off the chain | Land on the switchback. Cost: time |
| Falling off The Ledge | Return to Terrace Two. Cost: time and paint |
| Falling below kill height | Death. Restart the level |
| Dry out (no tank, no territory) | Declared loss, restart |

Nothing in this level should kill except the void and the enemies. A mountain is already intimidating; it doesn't need to be lethal to be hard.

---

## Readability

- The turret must be **visible before it fires** — its telegraph is the only warning, and its counter is positioning, so the player must see it to avoid it.
- The catwalk sags before it falls. The boulder is audible before it's visible.
- Wall-crawlers must read as *moving on a wall*, not as a texture — silhouette matters more here than anywhere.
- Every ledge that can drop the player is wide enough to see the edge.

---

## What to test first

If only two things can be prototyped before the rest is built:

1. **R2** — does inverting the green ("your route is its route") read without a word of text?
2. **R5** — does the chain feel like commitment, or like a coin flip? Tune the pad spacing until a miss is always recoverable and a hit always feels earned.

Everything else in this level is support for those two rooms.
