# Last Colour — Level Three

**Identity:** the loop *under attack*. Your paint is territory you can lose.

Two levels taught the player that paint is safety. This one takes it back. Everything here is built around one tension: **painting makes you stronger, and the enemy eats your paint.**

Artefacts: `ADR-0002`, `GLOSSARY.md`, `docs/enemies/algorithms.md`.

---

## The anti-snowball

In a wave game, a good wave snowballs: you paint, you get faster, you get more territory, the next wave is easier. That's positive feedback, and left alone it makes a climax trivial.

**The Drainer is the balancing force.** It converts your territory back to grey at 1.5 m²/s while it feeds. So the better you're doing, the more there is to lose — and the arena stays contested instead of becoming yours.

That's the whole level. Every other decision serves it.

---

## Beats

```
Hangar      wave 1 — Drainers only         teach "they eat your ground"
Corridor    turrets + one Charger          tense breather, no waves
Core        waves 2 and 3                  Drainers, Stalkers, Chargers
Big Arm     arena boss                     the floor is taken from you
Siphon      the final exam                 blue, green, red, in order
```

---

## Room by room

### Hangar — wave one

Wide, flat, industrial. Six **Drainers**. Nothing else.

The first wave exists to answer one question honestly: *what happens to the ground I painted?* The player paints a big safe field, watches it get eaten, and repaints. That loop, felt once, is the entire level's lesson.

**Grey here is Corrupt Corp's paint** (`ADR-0002`), so the arena should read as *their* floor being reclaimed rather than empty concrete. The art direction carries the fiction: everything is a colour that belongs to them.

**Question:** *why is my ground disappearing?*

---

### Corridor — the squeeze

No waves. Two **turrets** and one **Charger zombie**.

A quiet, hostile, linear beat after the hangar's chaos. The corridor is where the player who painted well in the hangar is rewarded — a painted corridor is a fast corridor, and an unpainted one is where they die.

Turrets have **no status procs**, so this is positioning only. The green solution here is *pinning the charger* to buy time while you break line of sight on a turret.

**Traps:** a cargo crusher on a fixed rhythm, and one laser grid crossing the corridor.

| Trap | Answer |
|---|---|
| Cargo crusher | Cross in the gap, or blue-slide under it |
| Laser grid | Red bounce over, green climb around — never through |

**Question:** *can I fight without room to repaint?*

---

### Core — waves two and three

The siphon chamber. Circular, multi-level, industrial, with the siphon itself as a structure in the middle.

**Wave two:** eight Drainers, two Charger zombies, and the level's first **Stalker**.

The Stalker is deliberately introduced here and nowhere earlier, because it only means something once the player has spent two levels learning that *wet means safe*. It is fast only on their paint, slow on grey. The escape is to run onto dead ground — giving up their resupply, their speed and their safety to survive.

That inversion is the best single idea in the level. Introduce it on its own: one Stalker, no other new threat, so the player notices *why* it's fast.

**Wave three:** a mix — Drainers eating, Chargers pressuring, turrets overlooking. The player should now be managing three problems with one tank.

**Losing your floor is the fail state.** The player who paints ahead survives; the player who hoards paint dies dry.

**Question:** *can I hold ground and fight at the same time?*

---

### Big Arm — arena boss

Big Arm enters at the end of wave three. It doesn't need new mechanics, it needs to be a **pressure multiplier**:

| Phase | Behaviour | What it forces |
|---|---|---|
| 1 | Slow advance, ground slam, repaints 4 m grey | Fight it *away* from your good ground |
| 2 | Faster, adds a grab, spawns two Drainers | Kill the Drainers or lose the floor you're standing on |
| 3 | Enraged, continuous slam, ignores paint | Everything you have, all at once |

It dies to a committed combo rather than damage-over-time. The exact sequence is still to be designed, but it must use all three colours in order, so the boss is a rehearsal for the siphon.

**The rule:** Big Arm should never be beaten by shooting it a lot. It should be beaten by *understanding it*.

---

### Siphon — the final exam

Not an enemy. A structure. No health bar.

| Phase | State | Answer |
|---|---|---|
| 1 | Intake exposed | Blue — freeze it |
| 2 | Arms thrash | Green — pin up to three at once |
| 3 | Core exposed | Red — knock it into its own machine |

Three colours, in order, no new verb. That's what makes it an exam rather than a boss: it tests the system the game taught and it costs no rig, no animation set and no AI.

**Readability:** each phase must be visually obvious before it's solvable. The intake glows, the arms thrash, the core sits exposed. If the player has to guess, the exam is a quiz.

---

## Enemies

| Enemy | Count | Role in this level |
|---|---|---|
| Drainer | many | The anti-snowball. The star |
| Charger zombie | ~4 | Pressure while the Drainers work |
| Turret | 2–3 | Denies space in the corridor |
| Stalker | 1–2 | Inverts the loop. Introduced in wave two |
| Big Arm | 1 | Arena boss |
| Siphon | 1 | Final exam |

---

## Paint budget

**Contested by design.** Unlike the other levels, this one is allowed to make the tank feel tight — because the player's answer to scarcity is *territory*, and the level is about holding territory.

**The rule that keeps it fair:** for every 30 seconds of combat, the arena must offer at least one paintable pocket the player can reach in under five seconds. If they can't reach colour, they're not being tested, they're being punished.

---

## Fail-forward

| Event | Result |
|---|---|
| Death | Restart the level |
| Dry out | Declared loss, restart |
| Wave cleared | Gate opens, next chamber |

This is the one level where death is a real cost, because it's the one level where the run is meant to be a gauntlet. Every other level is a place; this one is an attempt.

---

## What to test first

1. **Hangar, wave one** — does "my paint is being eaten" read without a word? If the player doesn't repaint unprompted, the Drainers are too quiet or too slow.
2. **The Stalker reveal** — does any player work out that grey is safe from it? That deduction is the level's best moment and it should be discovered, never explained.
