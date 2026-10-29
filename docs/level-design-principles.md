# Level design principles — the rubric for sketches

**Why this file exists.** The sketch gate is only worth having if it scores a sketch
against something better than my taste. This is that something: principles with
sources, each turned into a check a sketch must answer before it is allowed near the
engine.

**How to use it.** A sketch is not done until it answers the checks in "The rubric".
A sketch that fails "dominant strategy" or "foothold" is rejected on paper — that is
the whole point.

**Sourcing note.** Verified 28 Oct 2026 by fetching the sources directly. The web
search integration returned nothing, so these are direct reads, not summaries of
summaries. The Portal commentary is Valve's own words (first-party). The Level Design
Book is a modern practitioner text (secondary, but it quotes primary sources and links
them).

---

## Sources

| Source | What it is | Where |
|---|---|---|
| **Portal developer commentary** | Valve's in-game commentary text, per chamber. First-party. | https://theportalwiki.com/wiki/Portal_developer_commentary |
| **The Level Design Book — Layout** | Layouts, parti, bubble diagrams, floor plans, markup | https://book.leveldesignbook.com/process/layout |
| **The Level Design Book — Encounter** | Footholds, combat story, enemy palette, arena | https://book.leveldesignbook.com/process/combat/encounter |
| **The Level Design Book — Pacing** | Beats, teach-test-twist, intensity, pile of beats | https://book.leveldesignbook.com/process/preproduction/pacing |
| **The Level Design Book — Blockout / Playtesting** | Blockout, metrics, playtest method | https://book.leveldesignbook.com/process/blockout · /playtesting |

Also available but not used here: `/process/combat/cover`, `/process/combat/balance`,
`/process/layout/flow/verticality`, `/process/blockout/metrics`.

---

## 1. Plan the experience, then the space

Before a floor plan, define a **player experience goal** — "what should the player
learn, feel, or do" — then the **pacing beats** that produce it. Layout drawings come
after.

> "It is difficult to design something without any purpose. […] So before drawing a
> layout, define at least one player experience goal. What should the player learn,
> feel, or do, in this level?" — Level Design Book, *Layout*

**Inkbound:** the docs already have this in the "Question" line per room. That is the
right shape; the sketch must start with it.

**Check:** does the sketch name the room's experience goal in one sentence, and is it
a *player* goal rather than a design intention ("teach the pit" is not a player goal;
"I should look at the ground before I walk" is).

## 2. A sketch is not a level — and cannot prove one works

This is the most important correction to my earlier pitch.

> "A layout drawing cannot tell you if your level works; only a blockout and playtest
> can begin answering that question. A layout is NOT a level, the player never plays
> your drawing." — Level Design Book, *Layout*

So the gate's claim must be narrow: **it filters structural errors, it does not
predict fun.** All three of this week's failures (deck, pit, charger) were structural:
no motive, no denial, no geometry. Those are visible on a map. "Is it fun to climb?"
is not.

**Check:** does the sketch name the two-minute in-engine test that would prove it
wrong? If the sketch's claim cannot fail, it is decoration.

## 3. Give the player a foothold

An encounter needs the player to survey before committing. The book names three
methods; the third is exactly what we decided for Island A:

> "Begin the encounter with unaware yet unattackable enemies, observable from a vista
> (high vantage point) but separated by an unbreakable window or long distance out of
> attack range. The player can collect information, form a plan, and begin the fight
> when they wish." — Level Design Book, *Encounter* (method 3)

And the failure mode we hit exactly:

> "If you don't help the player understand the layout, then the player will just fight
> unimaginatively from the doorway without committing." — same page

**Inkbound:** Island A is a **vista with a one-way entrance** (the Gap): B's deck and
its Sprayer are visible and out of range, the player plans, then commits. That is a
named, established pattern — not an invention. Keep it.

**Check:** where does the player stand to survey, what can they see from there, and
what is unattackable *by design*?

## 4. Teach one thing at a time, then gate it

Valve's commentary is unusually explicit about the method:

> "We spend a huge portion of the game introducing a series of gameplay tools, then
> layering these tools into increasingly difficult puzzles. This layering starts here,
> where we train the button/box mechanic before introducing the more complicated
> concept of portals." — Robin Walker, Portal commentary, Test Chamber 00

> "We introduced a mandatory pause in the action — what we call a gate — to help ensure
> that players stop and notice the portal gun making a blue portal." — Jason Brashill,
> Test Chamber 02

> "Since this puzzle was meant to illustrate the relationship between boxes and
> buttons, that solution, while clever, was a failure, so we added the glass barrier to
> prevent it." — Chet Faliszek, Test Chamber 04

> "Playtesting revealed that this puzzle introduced too many new concepts at once,
> which ended up frustrating a lot of playtesters. In response, we inserted two test
> chambers before this one to make the […] training more gradual." — Chris Chin,
> Test Chamber 08

**Inkbound:** "one question per room" is the same rule, and the gate is the same
device. The third quote is the trap to watch: if a room's purpose is to teach X and the
player can solve it with Y, the room **failed**, even though the solution was clever.

**Check:** name the single concept. Then name the clever bypass. If the bypass skips
the lesson, the room needs geometry that closes it — not a note saying it's fine.

## 5. Enemy palette discipline

The book gives a usable scale by **enemy types in one encounter**, not enemies:

| Types | Function |
|---|---|
| 1 | tutorial / rest |
| 2 | "regular" — the two types interact |
| 3 | complex — hard to read |
| 4 | brawl — only if two factions fight each other |
| 5+ | slaughter — chaotic, players ignore most of it |

**Inkbound:** B's design (2 Chargers + deck Sprayer) = **2 types**. C's (2 Chargers +
2 Sprayers) = **2 types**. Both are "regular", which is correct for the level's job.
Four *enemies* is fine; four *types* would not be.

**Check:** count types, not heads. More than 2 needs a written reason.

## 6. Readability beats detail

Valve repeatedly solved confusion with contrast and focus, not extra detail:

> "Unnecessary objects scattered all over the place distracted players to the point
> where it actually interfered with the portal training process. So we simplified the
> art style to favor clean, focused test chambers." — Nick Maggiore, Test Chamber 05

> "We created visual hot spots within the rooms to guide players' attention. The design
> is essentially a balance between round objects and sharp objects." — Paul Graham,
> Test Chamber 09

> "Whose visual noise and reflectivity make it easy to identify at a distance."
> — Randy Lundeen, Test Chamber 06 (on non-portal surfaces)

> "Without some serious prompting, players will rarely look up." — Jeep Barnett, Escape
> Part 2

**Inkbound:** grey vs colour is the readability system, and amber is the danger
colour. Both are already decisions in `DECISIONS.md`. A sketch that adds visual variety
without a readability job is a cost.

**Check:** from the entrance, without moving, can the player identify (a) the threat,
(b) the route, (c) the thing they can paint? If "look up" matters, what makes them?

## 7. Pacing: teach → test → twist, and alternate intensity

> "**Teach, test, twist** is a common 3-beat pattern… Teach: teach the player about a
> game activity. Test: test whether the player can repeat and recognise the activity.
> Twist: twist the frame of the activity; with less prompting, can the player recall
> it?" — Level Design Book, *Pacing*

> "Start slow and quiet… Alternate highs and lows… After high-intensity boss fights,
> cutscenes and low-intensity areas feel like rewards." — same page

> "Fatigue set in if we didn't break up the more complicated, deliberately paced
> puzzles with problems that required the player to perform a much simpler task under
> time pressure." — Garret Rickey, Portal commentary, Escape Part 2

**Inkbound:** the campaign already runs A (quiet) → B (fight) → Gap (traversal) → C
(pressure) → Pillars (exam) → Ledge (release). The trap curriculum is teach (Primer) →
test (B blade) → twist (C vent).

**Check:** what is the intensity *immediately before* and *after* this room? A room
that is high on both sides has no contrast; one that is low on both sides is a rest and
must be short.

## 8. Traps: deny something, or be usable — **inference, not citation**

I could not find a primary source on trap design specifically. This one is derived
from the encounter and pacing principles above plus our own playtest, and should be
treated as the weakest entry here:

- A trap that can be walked around is **not denying** anything (no lane).
- A trap on a cycle is a **timing** problem; a trap that changes with paint is an
  **agency** problem; a trap enemies can be pushed into is a **tool**.
- Portal's time-pressure note is the closest support: simple decisions under time
  pressure feel climactic; complex ones under time pressure overwhelm.

**Check:** what does this trap deny, on what cycle, and what can the player *do* about
it? "It hurts if you touch it" is not an answer.

---

## The rubric — what every sketch must answer

1. **Experience goal** — one sentence, from the player's side.
2. **The question** — one sentence, answerable with a verb the game already has.
3. **Map** — top-down, to scale, labelled; a second sketch for height if it matters.
4. **Numbers** — lanes, heights, distances; **each cited** against `config.js` or a test.
5. **Foothold** — where the player surveys, what they see, what is unattackable.
6. **Dominant strategy** — what a lazy player does. If the answer is "ignore the room",
   the sketch fails.
7. **Enemy palette** — types, not heads.
8. **Pacing** — intensity on entry and on exit.
9. **Failure condition + falsification** — the two-minute test that would prove it wrong.
10. **Deliberately undecided** — what this sketch does *not* settle, so the agent cannot
    silently fill a gap.

## Corrections this research forced

| My earlier claim | What the sources say |
|---|---|
| "2–3 sketches is enough" | The book advises **5–10 parti thumbnails** and **≥3 bubble diagrams**. Cheap options, not fewer. |
| "Sketches will raise design quality" | **A drawing cannot tell you if the level works.** Sketches filter structural errors; only a blockout and playtest answer the rest. Say that out loud or the gate will be oversold. |
| Island A's vantage was my idea | It is **"a vista with a one-way entrance"**, a named pattern for boss/climax encounters. Decided correctly, for a documented reason. |
| "Add traps for danger" | A trap must **deny a lane** or be **usable**. Otherwise it is a hole with a damage box — exactly what we built and cut. |
