# Outskirts — Level One

**Identity:** the loop with *space* — and the level that teaches **verticality**.

Revised 2026-10-24. The first draft of this level was a straight line with five enemies and one vertical room at the end. It was a hallway with arenas, no retreat and no route choice. This version fixes that.

---

## What was wrong with the corridor

| Problem | Consequence |
|---|---|
| Straight A → B → C → pillars | No retreat, so no repainting under pressure |
| Five enemies | One or two at a time; never from an angle |
| Jump and bounce only until the end | Traversal identical to the tutorial |
| No traps | No reason to look at the ground |
| Verticality saved for the last room | The level's best idea arrives last |

---

## The three structural changes

### 1. A second level on every island

Each island gets a raised deck reachable by **green climb** or **red bounce**. Enemies stand on them. Height is not a ladder — it is a paint decision.

### 2. A return loop

A catwalk from Island C back to Island B: unpainted, empty, slow, safe.

It exists so the player can **retreat and repaint**, which is the game's core verb and the thing a corridor forbids. Without it, an empty tank in Island C is a death sentence decided by geometry.

### 3. Traps in rooms with enemies

A trap alone is a timing test. A trap inside a fight is a **tool**: red-knock a charger into the pit, or lose the paint lane the trap denies.

---

## The rule that makes this work: verticality is opt-in difficulty

**Enemies on upper decks only aggro when the player climbs to them.**

The ground route stays gentle, so Outskirts remains the softest level and the tutorial's successor. The high route is faster, more dangerous and gives better sightlines. That is the replay hook, and it means more enemies do not make the level hostile.

---

## Route

```
Island A   spawn, 1 charger, spike pit, deck sprayer        [floor]
   │ gap
Island B   2 chargers + deck sprayer, collapsing bridge     [floor + deck]
   │ the Gap — blue slope, red pad
Island C   2 chargers, 2 sprayers, blade, waste edge        [floor + deck]
   │ catwalk (return loop, C → B)
   │
The Pillars  green climb → red bounce → fight → climb        [vertical exam]
   │
Ledge        release, view, deco reveal
```

---

## Room by room

### Island A — the entry

**Question:** *is this place safe enough to learn in?*

One Charger. One spike pit, visible before it can hurt anyone. One **Sprayer on a deck above** that ignores the player unless they climb.

The deck is the level's first lesson about verticality and it costs nothing: climb up, the sprayer wakes up, and you learn that height means enemies.

**Paint budget:** generous. **Exit:** the gap.

---

### Island B — the first real fight

**Question:** *can I fight two things while the ground is contested?*

Two **Chargers** on the floor, one **Sprayer** on a deck. No single colour answers all three, so the player chooses an order.

Exit: the Gap, via a **collapsing bridge**. Blue crosses it in one slide; running it works and feels reckless.

**Paint budget:** large floor, deliberately — this is where the player learns that running out is survivable if the ground is theirs.

---

### The Gap — momentum

Unchanged from the original design, and it should stay unchanged. **Slide down blue, launch off red, land.** One continuous motion, and the beat that stops the game being a shooter with paint in it.

A missed jump lands on Island B. Never the void.

---

### Island C — the trap room

**Question:** *will I use the hazard, or just avoid it?*

Two **Chargers** and two **Sprayers**, one of them elevated. A **swinging blade** between two cover blocks, on a fixed rhythm. And the island's back edge overhangs the **waste**.

That last detail is the point. Red knockback can put a Charger into the chasm, so the room rewards the player who understands their kit. It needs a distinct sound and hit confirmation — players will chase this once they find it.

The blade denies the middle of the room on a rhythm, so the safe route costs time and the fast route costs position.

**Paint budget:** the tightest room in the level, and the only one where a careless player can run dry.

---

### The return loop

A catwalk from C back to B. No enemies. No paint. Longer than the way you came.

It is not a shortcut — it is a **way out**. Its whole job is to make retreat possible, so a dry player has somewhere to go that is not a restart.

---

### The optional side island

One hard red bounce from Island C's edge. No enemies, no reward beyond a view of the forest you have painted and a shortcut back to B.

It exists so the level has something to find. Its cost is one bounce distance and one platform.

---

### The Pillars — final exam

Green up a pillar's side, paint its roof red, bounce to the second pillar, climb again. Two Sprayers wait on the deck, so the bounce lands the player into a fight.

Add one **swinging blade on the approach, with a green route around it.** That single room teaches the whole trap language: you can *time* a trap or you can *paint* your way past it.

**Question:** *will you take the safe route or the clever one?*

---

### The Ledge — release

No enemies. No hazard. A view back across the forest, and the decor reveal paying off — the trees near your paint have come back to colour.

---

## Enemies: 5 → 11

| Island | Enemies |
|---|---|
| A | 1 Charger, 1 deck Sprayer (opt-in) |
| B | 2 Chargers, 1 deck Sprayer |
| C | 2 Chargers, 2 Sprayers (one elevated) |
| Pillars | 2 Sprayers |

The six extra enemies are mostly **above** the player. That is deliberate: it adds combat without making the floor route harder.

---

## Traps

| Trap | Where | Answer |
|---|---|---|
| Spike pit | Island A | Visible; teaches that traps exist |
| Collapsing bridge | Island B exit | Blue to cross in one slide |
| Swinging blade | Island C, between cover | Time it, or route around |
| Swinging blade + green route | Pillar approach | The trap-language lesson |
| The waste edge | Island C | Not a trap — a **weapon** |

---

## Constraints that come with this

- **Paint budget.** More enemies and traps both spend paint, and there is no trickle. Every island needs enough paintable ground that a dry player is one splat from recovery.
- **Readability.** Eleven enemies means the player must be able to tell them apart at 20 m. See issue 054.
- **Tests.** `tests/level-01-decor.test.js` asserts every tree stands on a floor. Moving an island breaks it; adding a deck does not.

---

## What to test first

1. **Island C** — does any player discover knockback-into-the-waste without being told?
2. **The return loop** — does anyone use it? If nobody ever retreats, the loop is decoration and the level is still a corridor with extra steps.
