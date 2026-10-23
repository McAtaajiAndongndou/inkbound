# The Primer — Tutorial

**Identity:** a rebel training course that is honestly a training course. Success is not "the player finished it" — it's "the player wants more."

The sergeant briefs the player, the course proves them ready, and the fiction excuses the artificial geometry. Every obstacle is diegetic: the rebels built it.

Artefacts: `ADR-0001`, `ADR-0002`, `ADR-0003`, `GLOSSARY.md`, `docs/enemies/algorithms.md`.

---

## Delivery

| Element | Choice |
|---|---|
| Sergeant | One briefing still at the start, then comms-bar lines |
| Player model | Appears in the same still |
| Text | Never more than two lines on screen, never during action |
| Skip | Always available. A tutorial you can't skip is a tutorial people resent |

**Grey slows from room one** (`ADR-0002`). The player spends the first thirty seconds sluggish, and the first splat is relief. That contrast is the lesson, and it only works if it's felt before it's explained.

---

## Beats

```
R0  Briefing        still + line, no gameplay
R1  Move            walk, look, jump a low wall
R2  The First Splat the moment the game earns its name
R3  Blue            a gap too wide to jump
R4  Red             a ledge too high to jump
R5  Green           a wall with no alternative
R6  The Trap        one spike pit, telegraphed, survivable
R7  One of Theirs   a Charger, gated
R8  Free Play       no objective, just movement
R9  Extraction      hand-off to Outskirts
```

Total run: ~4 minutes for a first-timer, ~90 seconds once they know it.

---

## Room by room

### R0 — Briefing

A still: the sergeant and the player, comms bar underneath.

> **SERGEANT:** "The world ran out of colour. We kept what was left. Prove you can carry it."

Nothing else. No controls list — controls go in the pause menu, not on screen.

---

### R1 — Move

Open flat pad, one low wall to jump. No paint, no enemies, no lesson beyond "these are your legs".

**Question:** *can I move?*
**Deliberately boring.** It should take eight seconds.

---

### R2 — The First Splat

A grey wall directly ahead, and the only exit is to walk through the paint.

The player fires and colour blooms into a world that has been grey for two rooms. This is the game's title moment and it needs sound, a slow-in, and a beat of silence after.

> **SERGEANT:** "That's colour. It changes what you can do, not just what you see."

**Question:** *what does the gun do?*
**Design note:** the first splat must be on a *wall*, not the floor. A wall makes the colour stay in view while the player walks past it.

---

### R3 — Blue

A gap of 8 m. Too wide for a jump (4.6 m) and too wide for a blue jump (7.3 m) — but there's a blue strip leading to the edge, and momentum carries the rest.

**Question:** *what if the ground was slippery?*
The only failure is falling in, which returns them to the room start. No death.

---

### R4 — Red

A ledge 3 m up. A jump reaches 1.39 m. There is a red pad at the base.

**Question:** *what if the ground pushed back?*
Height, not distance, is what makes this unsolvable any other way — same rule the forest uses later.

---

### R5 — Green

A wall, no alternative route. Green face, climb it.

**Question:** *what if the wall wanted to be climbed?*

---

### R6 — The Trap

A spike pit across the corridor, with a visible sagging floor and a creak before it spikes. Deliberately survivable: it damages, it doesn't kill.

The player can also paint blue and slide over it — but they don't need to. The lesson is only **"traps exist"**.

**Question:** *is this place dangerous?*

---

### R7 — One of Theirs

A gate, one **Charger** behind it, and a wide floor.

> **SERGEANT:** "One of theirs. It won't stop. Make the ground stop it instead."

The player has been taught blue, red and green in isolation. This is the first time they choose. All three answers work:

| Answer | What they see |
|---|---|
| Blue | It slides past them and hits the wall |
| Red | It gets flung across the room |
| Green | It stops dead |

The gate opens when it dies. **The tutorial never tells them which colour is correct** — because three are.

**Question:** *which colour is this?*

---

### R8 — Free Play

The gate opens onto a small arena: ramps, a red pad, a blue strip, a gap. **No enemies, no objective, no extraction trigger.**

This room exists so the player can be bad at the game safely for thirty seconds, discover the bounce on their own, and leave the tutorial having *enjoyed* something rather than having *completed* something.

It is the cheapest room in the project and the one playtesters will remember.

---

### R9 — Extraction

The sergeant meets them at the pad.

> **SERGEANT:** "You're ready. Outskirts — go."

Cut to Outskirts.

---

## What the tutorial refuses to do

| Refusal | Why |
|---|---|
| No on-screen control list | It lives in the pause menu. The world can teach the keys |
| No "press 1 to switch colour" prompt | The HUD already shows the swatches and the "standing on" readout |
| No unskippable cutscene | First-time players replay tutorials in front of markers |
| No death | Only the pit hurts, and it doesn't kill. Nothing here should frighten |
| No explanation of wet/dry | They'll feel it in R2 without a caption |

---

## What to test first

1. **R2** — do they fire at the wall, or do they get lost? If they don't fire within ten seconds, the wall isn't asking loudly enough.
2. **R8** — do they stay in free play longer than they stayed in any teaching room? If yes, the design is working and the other levels should lean into it.
