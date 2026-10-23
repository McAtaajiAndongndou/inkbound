# Outskirts — Level One

**Identity:** the loop with *space*. Open, playful, forgiving.

The player has just been taught that colour does something. This level is where they discover that colour does things *to the world*, and that they can choose which thing. Nothing here should kill them for trying.

Artefacts: `GLOSSARY.md`, `docs/enemies/algorithms.md`, `docs/levels/02-the-ascent.md` (for the trap escalation rule).

---

## Beats

```
Island A     open, nothing attacks       let them breathe and trust the level
Island B     one Charger, open floor     teach blue
The Gap      blue slope + red pad        momentum, the flow moment
Island C     Charger + Sprayer together  two answers at once
The Pillars  green climb, red bounce     the setpiece
Ledge        quiet, view back            release
```

The existing island layout is sound and should not be rebuilt. What it needs is **rhythm**, not new geometry.

---

## Room by room

### Island A — the open

Spawn, a gap to jump, foliage. **No enemies.**

The only job of this beat is to let the player run. Movement is the game's best feature and the first thirty seconds should be pure play. Put one trap here — a visible spike pit at the edge of the route — so the rule "this place is dangerous" arrives before the fights do.

**Question:** *do I want to move?*

---

### Island B — first blood

One **Charger**, wide open floor, no cover.

> You sidestep or you paint. Both work. Only one of them is interesting.

Blue on its charge line is the intended answer, and it's also the Gap's run-up — the paint you lay here is the paint you need in twenty seconds. That reuse is what makes the island feel designed rather than decorated.

**Question:** *what if the floor moved with the enemy?*

---

### The Gap — momentum

The signature movement beat. A long gap, approached down a blue slope, with a red pad at the far side.

Blue to build speed, red to convert it into height. One continuous motion: **slide → launch → land.** This is the moment the game stops being a shooter with paint in it.

**Notes**
- A missed jump must drop the player onto Island B again, not into the void.
- The slope must be long enough to reach top speed before the edge, or the beat reads as a coin flip.

**Question:** *can I keep my speed?*

---

### Island C — two at once

**One Charger and one Sprayer**, in the open, together.

This is the level's first *combination*: the Charger demands movement, the Sprayer punishes movement in the open. The player must deal with one while the other is a threat, and there is no single colour that solves both.

**Question:** *what do I do when the answer is two answers?*

---

### The Pillars — setpiece

Green up a pillar's side, paint its roof red, bounce across to the second pillar, then climb again. Two shooters wait on the second pillar's deck, so the bounce lands the player *into* a fight.

This already exists in the level and it should be protected. It is the only geometry in the game that reads as Inkbound and nothing else.

**Add here:** one **swinging blade** on the approach, whose real purpose is to prove that traps have colour answers — you can *climb past it* on a green face instead of timing it. That single room teaches the whole trap language.

**Question:** *will you take the safe route or the clever one?*

---

### The Ledge — release

Top of the pillars, no enemies, a clear view back across the forest the player just painted.

The trees and foliage near their paint have *come back to colour* — this is where the grey-to-colour reveal pays off. Nothing to fight, nothing to collect.

---

## Enemies

| Enemy | Count | Where | The question |
|---|---|---|---|
| Charger | 2 | Islands B and C | Position |
| Sprayer | 2 | Island C, pillar deck | Your paint |

Four enemies for the whole level. The forest is not a gauntlet; it's a playground with teeth.

---

## Traps

| Trap | Where | The colour answer |
|---|---|---|
| Spike pit | Island A edge | None needed — it's the "traps exist" beat |
| Collapsing bridge | The Gap crossing | Red bounce before it drops |
| Swinging blade | Pillar approach | Green — climb around it |

---

## The environment reveal

As paint spreads, decor within a radius lerps from dead grey to its vibrant colour.

This is the cheapest storytelling in the project and it is the level's *identity*. The forest is where the player sees the world responding to them, which is why the military base later has to be grey on purpose.

**Rule:** the reveal must be local (near the paint) and slow (a second or two). A global tint change reads as a filter; local recovery reads as life.

---

## Signature moment

**Red-knock a Charger into the toxic waste.**

It needs its own sound and a distinct hit confirmation. Players will discover it once and then do it deliberately for the rest of the game — that discovery is the moment Outskirts becomes *theirs*.

Place one Charger deliberately near an edge in Island C to make it discoverable rather than lucky.

---

## Replay hook

One hidden side route: a harder jump, no enemies, a small cosmetic payoff. It costs a few platforms and it tells the player there might be more than they saw.

---

## Fail-forward

| Event | Result |
|---|---|
| Miss the Gap | Land on Island B, keep the run |
| Miss a bounce | Land on the floor below the pillars |
| Fall in waste | Return to the island edge, lose paint |
| Dry out | Declared loss |

Nothing in this level should end a run except drying out.

---

## Paint budget

Generous. This is the level that teaches, so the tank should feel like it refills faster than the player can spend it. If a player runs dry on Outskirts, the pacing is wrong — not the player.

**Recovery rule:** every island has enough paintable surface that a player who is dry is never more than a splat from recovery.

---

## What to test first

1. **The Gap** — does slide → launch → land read as one motion, or as three separate panics?
2. **The Pillars' swinging blade** — does any player discover the green route without being told? If nobody ever does, the trap is decoration rather than a lesson.
