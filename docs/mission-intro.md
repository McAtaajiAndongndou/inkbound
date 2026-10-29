# Mission intro — design

**Status:** agreed by Renda and Moses, 30 Oct 2026 (`docs/DECISIONS.md`). **Built 30 Oct** (`src/ui/mission-intro.js`, `src/ui/intro-lines.js`, `tests/mission-intro.test.js`), straight from this doc without the Figma step or tracker issues, at the team's call.
**PRD:** G4 · **Issues:** draft 065 (ui), draft 066 (levels)

---

## In one line

Each mission opens with **five seconds of camera over the grey level, from the goal back to the player**, while a title card types out where you are and what you are there to do. Any key skips it. Then you are playing.

## Why this, and not a cutscene

The project ruled out cutscenes (characters we cannot animate, exposition nobody reads). A mission intro keeps what made that rule right and gets the thing cutscenes are actually for: **a sense of place and a goal before the first step.**

| What we wanted from a cutscene | How the intro gets it, without one |
|---|---|
| "This is a campaign, not four test maps" | A consistent title card: level, location, day and time, objective |
| Show the stakes | The camera shows the level **grey**, before you have painted any of it. The colour you bring is the story (README pillar 3) |
| Show the goal | The camera **starts on the goal** (the extraction, the lift tower, the Siphon's beacon) and ends on you |
| Hype | Typewriter text with a radio blip per line, a slow push-in, then control lands in your hands mid-motion |

**What it never does:** show a character, play dialogue, explain controls, or run longer than 6 seconds.

### Shipped games to point at

- **Call of Duty 4 / Modern Warfare** mission loads: a satellite view zooms down onto the squad while the location, time and mission name type out. The card text here is a direct reference.
- **Splatoon 2 and 3** match starts: a camera pan over the stage before the countdown, so you know the map shape before you move. That's the camera half.
- **Halo: Combat Evolved** level starts: the camera ends **at the player's eyes**, so the intro hands over control with no cut. That's why our path ends on the spawn eye.

---

## How it plays

```
load level ──► [ MISSION INTRO  ≤6 s ] ──► (Primer only: briefing still) ──► play
                 camera: goal → spawn eye
                 card types out, line by line
                 any fresh key / click skips
```

1. **0.0 s:** the level has loaded and is frozen (`simulate()` paused, as under the menu). The camera sits at the intro's **start shot**, framing the goal.
2. **0.0 – 5.0 s:** the camera eases (ease-in-out) along a straight line to the **end shot**, which is the player's spawn view. The card types out at the same time.
3. **5.0 s:** the card fades over 0.4 s and control is handed over. Because the end shot is the play camera, there is **no cut**.
4. **Skip, at any time:** the camera snaps to the end shot, the card fades, and play begins. The skip input also locks the pointer, so it takes one click to be playing.

### When it plays

| Situation | Intro? | Why |
|---|---|---|
| Level chosen from the menu / level select | **Yes** | It's a new mission |
| Next level after a win | **Yes** | The same |
| Restart after death or dry-out (R) | **No** | CoD never replays a mission intro on a checkpoint retry. Getting back in fast is the respect |
| Restart from the pause menu | **No** | The same |

### The title card

Bottom-left, four lines, typed at 40 characters a second with a 0.15 s pause between lines and a soft radio blip per line:

```
OUTSKIRTS                         ← level name, large
The drained forest                ← location
Day 3 · 06:10                     ← day and time, small, monospace
Cross the islands. Get out alive. ← objective, one line
```

- **Colour:** off-white text on a dark, slightly transparent band. **Never amber** (amber means danger, `TRAP.amber`) and never telegraph yellow. Figma may give the level name one accent; a paint colour is the obvious choice.
- **Legible at 720p and 1080p**, same bar as the briefing still.
- **Reduced motion** (`prefers-reduced-motion`): no camera move. Hold the end shot and show the card.

### Card text: draft, for Renda and Moses to rewrite

| Level | Location | Day · time | Objective |
|---|---|---|---|
| The Primer | Rebel training yard | Day 1 · 05:40 | Learn the colours. |
| Outskirts | The drained forest | Day 3 · 06:10 | Cross the islands. Get out alive. |
| The Ascent | The mountain road | Day 4 · 14:20 | Climb to the supply lift. |
| Last Colour | Corrupt Corp base | Day 4 · 23:50 | Find the Siphon. Shut it down. |

Rule for the rewrite: **the objective is one sentence and names a place you can see in the intro.** The times should agree with each level's mood (#125). If Last Colour's amber mood does not read as night, change its time, not the mood.

---

## The camera, per level

The rule is **goal first, you last.** The start shot frames the level's goal and the end shot is the spawn view. One straight eased move, with no splines and no cuts.

**The start shot faces the way the player faces at spawn.** It frames the goal *from the player's side*, so the move is a pull-back to the player's shoulder. A start shot that looks back at the player would make the camera swing 180° halfway (found while building it; tested).

| Level | Start shot: frames… | End shot | What the player learns |
|---|---|---|---|
| **The Primer** | — no camera move (see below) | — | — |
| **Outskirts** | Over Island C, on the pillars and the Ledge | Island A spawn eye | The islands go one way; the Sprayer's deck on B is the first threat |
| **The Ascent** | In front of the **lift tower on the summit** and its beacon | R0 Trailhead eye | Where the top is, and that the route winds round the peak |
| **Last Colour** | Up the corridor, on the **Siphon and its beacon** | R0 Lift Landing eye | The whole axis in one move, the same "whole level in one frame" the landing was designed for |

**The Primer has no camera move.** Its opening is the sergeant's briefing still (#111), and the first room is meant to be moving inside 8 seconds. Stacking a 5-second intro in front of that would undo it. Instead the **briefing still shows the same title card**, so all four levels open with the same card and the Primer adds no extra screen.

The shots are Renda's to tune; they live in `src/ui/intro-lines.js` beside the card text, so tuning one touches no level file. The end shot is not data: it is the play camera's own pose on the first frame, which is what makes the handover cut-free. A test builds each level, puts the real camera rig behind a real player at spawn, and checks the straight line from the start shot to it passes through no solid and faces the play camera's way.

---

## Rules that protect the rest of the game

- **The intro is not play time.** The scorecard's `run.time` and `run.dryTime` start when control is handed over, not at load (#110).
- **Nothing moves under it.** The simulation is paused exactly as it is under the menu: enemies, traps, the tank and the dry-out timer all wait.
- **Comms waits.** The comms bar (#112) cannot show a line during the intro.
- **The pause menu still opens.** Esc during the intro opens the menu, and closing the menu resumes the intro where it was.
- **The level is grey in the intro** because nothing has been painted yet. The Primer's pre-painted strips are fine; they are part of the level.
- **Every number lives in `src/config.js`** under `MISSION_INTRO` (move time, fade, type speed, cap). The shots and card text live in `src/ui/intro-lines.js`. The intro runs on real time, not the game's clamped step, so a slow machine still gets control inside the cap.

---

## Who builds what

| Lane | Owner | Piece |
|---|---|---|
| Levels | Renda | Tunes the start shots in `src/ui/intro-lines.js`; the path test says if one clips a wall |
| UI | Moses | The title card, the timeline (play, skip, fade, reduced motion), card text in `src/ui/intro-lines.js` (built) |
| Core | Ozuko | Nothing new. The intro reuses the menu's pause. Check that the camera handover doesn't fight the player camera's follow |

---

## Parked, deliberately

- **A mission outro.** On a win, the camera pulls back over the level as **you painted it**, the grey-to-colour payoff, like Splatoon's end-of-match map reveal. It's the strongest visual moment the game could have for the marking bands, so it's the first thing to do if the intro lands early. It needs its own decision entry.
- **Voice.** No voice acting. A radio blip per line only.
- **Spline cameras or several shots per level.** One move is easy to get right, and Renda can tune it alone.

## Open questions for Renda (defaults already chosen)

1. **Card text:** use the draft above, rewritten together with Moses? *Default: yes, before the UI issue is closed.*
2. **Outskirts start shot:** from the Ledge looking back, or from above Island B? *Default: the Ledge, because it previews the reveal you earn there.*
3. **Should the intro also play on "next level" after a win?** *Default: yes.*
