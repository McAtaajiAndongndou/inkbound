# Outskirts — Level One

**Identity:** the loop with *space* — and the level that teaches **verticality**.

Revised 2026-10-24; rewritten 2026-10-29 (polish pass 1) to match the build. The earlier draft planned a catwalk return loop, a side island, a collapsing bridge and two swinging blades. None of them was built, and they are now parked (see "Cut in polish pass 1"). This document describes the level that ships.

Pass question (polish pass 1): *does the player feel colour change the fight?*

---

## What was wrong with the corridor

| Problem | What fixed it |
|---|---|
| Five enemies, one or two at a time | Ten, in two arenas, with height and a crossfire |
| Jump and bounce only until the end | The Gap (blue + red), the pillars (green, red, green) |
| No traps | The vent in C: a hazard that paint answers |
| No reason to look at the ground | The vent, and the waste either side of C |
| Verticality saved for the last room | Still last. This is the level's honest weakness, see "Known gaps" |

---

## Shape: what the level is made of

### The spine

A → Gap 1 → B → the Gap → C → the Pillars → the Ledge.

It is a **linear mission**, not a loop. The encounter gates make it one: each arena's exit stays shut until the arena is clear, so a return route would lead back into a room you have already won. C's floor is big enough to retreat and repaint inside the fight, which was the job the catwalk was meant to do.

### One question per room

Every room asks exactly one thing and allows more than one answer.

| Room | The one question | Answers |
|---|---|---|
| A | what am I walking into? | look, then commit |
| B | can I fight two things while the ground is contested? | paint blue under the Chargers, go round the deck |
| the Gap | can I commit to one motion? | jump, blue, blue + red |
| C | will I use the hazard, or just avoid it? | paint the vent, go the long way, shove a Charger |
| the Pillars | can I chain three colours under fire? | green up, red across, green up |
| the Ledge | — | release, and the colour you brought back |

### Lanes before elements

A trap can only be interesting if it denies something. So each fight room got **cover and a lane split** first: the deck on B, the block on C. The vent then went into a lane the player wants to use (the short way to C's pocket). Traps come last because they answer a lane — they do not substitute for one.

### Dormant per arena, not per distance

Enemies tick from load and walk toward the player, so without a trigger every arena's fight is already standing at its lip when the player arrives. Each arena spawn carries `wakeOn: 'B' | 'C'` and wakes when the player is inside that island's bounds. There is no aggro radius. The fight starts where it was placed.

### The trap language: paint → weapon

| Room | Hazard | Verb | Why it is here |
|---|---|---|---|
| C | **the vent** — erupts on grey, dead on your paint | *paint is safety* | The game's own idea used as a hazard; the answer costs tank, so it is not free |
| C | **the waste** either side of the arena | *the room is a weapon* | Knock a Charger in; red knockback is already your kit (blocked, see "Known gaps") |

The spike pit lives in the Primer, where it cannot be walked around. The escalation is the campaign's: L1 teaches that paint answers a hazard and that the room can kill for you; L2 spends paint to move; L3 lets the enemy take the room back.

---

## Route

```
Island A     the vantage: spawn, no enemy, no hazard           [floor]
   │ Gap 1 — the commitment
Island B     2 Chargers + deck Sprayer, the deck block         [floor + block]
   │ [gate B]  the Gap — blue run-up, red pad
Island C     2 Chargers, 3 Sprayers, the block, the vent       [floor + block]
   │ [gate C]  the doorway
The Pillars  green climb → red bounce → 2 Sprayers → green climb  [vertical exam]
   │
The Ledge    release, the view back, the decor reveal
```

---

## Room by room

### Island A — the vantage

**Question:** *what am I walking into?*

**No enemies. No hazards. No deck.** A flat, wide approach with a clear sightline to Island B: its deck, the Sprayer standing on it, and the two Chargers on the floor below. The player's job here is to **look and plan**, not to fight.

**Why no enemy (playtest, 24 Oct 2026).** A dormant Charger here was pointless: on a flat rectangle with no cover there is nothing to ambush with, so the player shot it from range.

**Paint budget:** none needed. **Exit:** Gap 1.

---

### Island B — the first real fight

**Question:** *can I fight two things while the ground is contested?*

Two **Chargers** on the floor, one **Sprayer** on a deck. No single colour answers all three, so the player chooses an order.

**Blockout (28 Oct 2026):** one solid deck block at x 5…9, z −6…−2, y **4.6** — unpaintable, above the red-bounce apex (4.33), so it cannot be climbed, bounced onto or camped. It splits the room and the Sprayer stands on it: **elevation belongs to the enemy**. One obstacle per room, or 11.5 m is over-divided. The Chargers start 7–8 m from the landing so the charge has runway and the player has ~1.5 s to read the room.

**Paint budget:** large floor, deliberately — this is where the player learns that running out is survivable if the ground is theirs.

---

### The Gap — momentum

**Slide down blue, launch off red, land.** One continuous motion, and the beat that stops the game being a shooter with paint in it. Do not change it.

---

### Island C — the trap room

**Question:** *will I use the hazard, or just avoid it?*

**Built (28–29 Oct 2026):** C is **30 m wide and 14 m deep**. One **4 × 2 m block at y 3.0**, at x 7…11, z −21…−19, unpaintable: a wall chunk to route around, not a perch. Roster **3 Sprayers (x −8/−5/−2, z −28) + 2 Chargers (z −26)**. The block leaves a pocket behind it that the guns cannot see; the rest of the floor is a crossfire.

**The vent (polish pass 1).** A 3 × 3 m grate at x 11.5…14.5, z −21…−18, filling the **front-right lane** between the block and the waste. That lane is the short way from the landing to the pocket, so reaching the safe spot costs paint:

- **Grey:** it runs a rhythm — rest 2 s, a 0.8 s amber pulse (the tell), then a 1 s column that hurts whoever stands in it (20 damage, once per eruption).
- **Painted** (half the grate or more in any of your colours): it goes dark and stays dead. The grate is an open frame, so you see your own paint through the bars.
- **Contested:** grey over your paint re-arms it.
- **It hurts enemies too**, so a Charger shoved into the column takes the hit.

The other answer is the open left lane, in the Sprayers' crossfire. That is the choice the room asks for. Numbers: `TRAP.vent` in `src/config.js`. Code: `src/levels/paint-vent.js` on `trap-volume.js`.

**The waste.** C is wider than the corridor, so its two side edges and its front edge stand over the toxic waste. Red knockback is meant to put a Charger in it. **It cannot yet:** knockback has no gravity, so a flung enemy holds its height over the waste instead of falling (`_applyKnockback` in `src/enemies/enemy.js`). That is the enemies lane's to fix; see "Known gaps".

**Paint budget:** the tightest room in the level, and the only one where a careless player can run dry.

---

### The Pillars — final exam

Green up the left pillar's side, paint its roof red, bounce to the right pillar, climb the back wall green. Two Sprayers wait on the right pillar, so the bounce lands the player into a fight. Only the left pillar is paintable; the right is reached by the bounce and nothing else.

**Question:** *can I chain three colours under fire?*

---

### The Ledge — release

No enemies. No hazard. A view back across the level, and **the decor reveal**: landing on the Ledge re-reads every prop in the level, and each one within 2.5 m of the player's paint comes back to that colour. During play, a prop only reacts to paint directly under it while the player is near. The reveal is the payoff: the view back shows the trail you painted.

Numbers: `OUTSKIRTS.reveal` in `src/config.js`. Viewer shot: `ledge`.

---

## Enemies: 10

| Where | Enemies |
|---|---|
| A | **none** — the vantage |
| B | 2 Chargers, 1 deck Sprayer |
| C | 2 Chargers, 3 Sprayers |
| Pillars | 2 Sprayers, on the right pillar |

---

## Mood: drained, not dark

Polish pass 1 lifted the sky from navy to a washed overcast and paled the haze (`OUTSKIRTS.mood` in `src/config.js`). The grey has to read as colour taken away, so the player's paint is the most saturated thing on screen. A dark sky read as night instead.

**The waste is muted** from lime to a sickly olive (`OUTSKIRTS.waste`). Lime was the most saturated colour in an unpainted frame and sat close to green paint, so the poison out-shouted the player. Shots: `waste-gap1-before.jpg` / `waste-gap1-after.jpg`.

---

## Cut in polish pass 1

Each is in `BACKLOG.md`'s Parked list with the reason.

- Catwalk return loop
- Optional side island
- Collapsing bridge at B's exit
- Swinging blades in B and on the pillar approach

---

## Known gaps (other lanes)

- **The waste kill** — knockback needs gravity so a flung enemy falls (draft issue 064, a COULD), and the kill needs hit confirmation and a sound (Moses, UI).
- **Jump feel and camera** — Ozuko, core.

---

## Viewer shots

`gap1`, `island-b`, `gap2`, `island-c`, `pillars`, `vent`, `ledge`. Polish pass 1 shots are in `docs/levels/shots/outskirts-polish-1/`.

---

## What to test first

1. **The vent** — did you paint it, or walk around it? If nobody spends paint on it, the paint answer is too expensive.
2. **The waste** — once knockback falls: did anyone knock a Charger in without being told?
3. **The Ledge** — did anyone turn round and look?
