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

## Shape: what the level is made of

The level's job is **space** — room to retreat, room to repaint, and height as a
paint decision. That only works if the level is a *loop* rather than a line, and if
every fight happens in a room with lanes worth holding.

### The spine and the loop

Main route: A → Gap 1 → B → the Gap → C → the Pillars → Ledge.

Return route: a catwalk from C back to B — unpainted, empty, slow, safe. It exists
so the player can retreat and repaint, which is the game's core verb and the thing a
corridor forbids. Without it, an empty tank in C is a death sentence decided by
geometry.

### One question per room

Every room asks exactly one thing and allows more than one answer. If a room has
three mechanics it has none: the player leaves with an impression of noise instead of
a lesson.

| Room | The one question | Answers |
|---|---|---|
| A | what am I walking into? | look, then commit |
| B | can I fight two things while the ground is contested? | paint, take height, use the bridge |
| the Gap | can I commit to one motion? | jump, blue, blue + red |
| C | will I use the hazard, or just avoid it? | time the blade, paint the vent, shove a Charger |
| the Pillars | safe route or clever route? | time the blade, or paint around it |
| the Ledge | — | release |

### Lanes before elements

A trap can only be interesting if it denies something. So before any hazard goes in,
each fight room gets **cover and a high/low split**: a raised deck on B, the pillars
and the waste edge on C. The blade in B needs a centre lane to deny; the vent in C
needs a floor lane the player wants to keep. Traps come last because they answer a
lane — they do not substitute for one.

### Verticality is opt-in difficulty

Enemies on upper decks only aggro when the player climbs to them. The ground route
stays gentle, so Outskirts remains the softest level and the tutorial's successor.
The high route is faster, more dangerous and gives better sightlines. That is the
replay hook, and it means more enemies do not make the level hostile.

The mechanical form of this is a **dormant enemy**: visible, inert, woken by a level
trigger (see `INTEGRATION.md`). Hidden-then-spawned is a reveal, not a choice.

### The trap language: rhythm → paint → weapon

Outskirts teaches three different questions, in order. A static spike pit teaches
none of them: it is the same verb as a gap ("jump it"), it can be walked around, and
it has no tell. The spike pit therefore lives in the Primer's corridor, where it
cannot be avoided — and Outskirts gets hazards with a job.

| Room | Trap | Verb | Why it is here |
|---|---|---|---|
| B | **swinging blade** on a fixed rhythm, across the middle of the fight | *watch the room* | The first trap must be dodgeable and in combat, so it creates movement instead of a detour |
| C | **paint-solvable vent** — erupts on grey, dead on your paint | *paint is safety* | The game's own idea used as a hazard; the answer costs tank, so it is not free |
| C | **the waste edge** | *the room is a weapon* | Knock a Charger in; red knockback is already your kit |

The escalation is the campaign's: L1 teaches that a room has a rhythm, then that
paint answers it, then that the room can kill for you. L2 spends paint to move; L3
lets the enemy take the room back.

---

## Route

```
Island A   the vantage: spawn, no enemy, no hazard          [floor]
   │ gap 1 — the commitment
Island B   2 chargers + deck sprayer, blade, collapsing bridge  [floor + deck]
   │ the Gap — blue slope, red pad
Island C   2 chargers, 2 sprayers, vent, waste edge         [floor + deck]
   │ catwalk (return loop, C → B)
   │
The Pillars  green climb → red bounce → fight → climb        [vertical exam]
   │
Ledge        release, view, deco reveal
```

---

## Room by room

### Island A — the vantage

**Question:** *what am I walking into?*

**No enemies. No hazards. No deck.** A flat, wide approach with a clear sightline to
Island B: its raised deck, the Sprayer standing on it, and the two Chargers on the
floor below. The player's job here is to **look and plan**, not to fight.

That is why the level opens here. Outskirts' first fight is the first time the player
is outnumbered *and* outflanked by height; arriving with a mental picture of the room
is what makes that fight fair instead of a mugging. The gap is the commitment —
everything before it is yours, everything after it is the fight.

**Why no enemy here (playtest, 24 Oct 2026).** A dormant Charger was placed on this
island and it was pointless: on a flat 22 m rectangle with no cover there is nothing
to ambush with, so the player simply shot it from range. The problem was never the
enemy — the room has no geometry to make a fight. Removing it makes the room's real
job legible.

**Why no pit here.** A pit on an island this wide can always be walked around, so it
costs nothing and teaches nothing; it read as a gap to jump, which the level already
has. The spike pit belongs in the Primer's corridor, where it cannot be avoided.

**Paint budget:** none needed. **Exit:** Gap 1.

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

## Enemies: 5 → 9

| Island | Enemies |
|---|---|
| A | **none** — the vantage |
| B | 2 Chargers, 1 deck Sprayer |
| C | 2 Chargers, 2 Sprayers (one elevated) |
| Pillars | 2 Sprayers |

The extra enemies are mostly **above** the player. That is deliberate: it adds combat
without making the floor route harder. Island A carries none, so the first fight is
the first thing after the commitment (Gap 1), not something to shoot from spawn.

---

## Traps

| Trap | Where | Answer |
|---|---|---|
| Swinging blade | Island B, across the middle of the fight | Time it, or hold a lane |
| Paint-solvable vent | Island C, on a floor lane | Paint it and it goes dormant |
| Swinging blade + green route | Pillar approach | The trap-language lesson |
| The waste edge | Island C | Not a trap — a **weapon** |
| Collapsing bridge | Island B exit | Blue to cross in one slide |

The spike pit is **not on this list**: it belongs to the Primer's corridor, where it
cannot be walked around. See "The trap language" above.

---

## Constraints that come with this

- **Paint budget.** More enemies and traps both spend paint, and there is no trickle. Every island needs enough paintable ground that a dry player is one splat from recovery.
- **Readability.** Nine enemies means the player must be able to tell them apart at 20 m. See issue 054.
- **Tests.** `tests/level-01-decor.test.js` asserts every tree stands on a floor. Moving an island breaks it; adding a deck does not.

---

## What to test first

**0. The blockout, with no enemies and no traps.** Walk the route for two minutes.
Question: *does the shape make me want to move, retreat and repaint?* If the answer is
no, no trap or enemy will save the level — that is the mistake this revision exists
to correct. Details come after the shape is proven.

1. **Island C** — does any player discover knockback-into-the-waste without being told?
2. **The return loop** — does anyone use it? If nobody ever retreats, the loop is decoration and the level is still a corridor with extra steps.
3. **Island B's blade** — does it create movement, or is it a detour? If the player can stand still and shoot through the cycle, the blade is not denying a lane.
4. **Island C's vent** — does anyone choose to paint it, or does everyone just walk the safe lane? If nobody spends paint on it, the paint answer is too expensive.
