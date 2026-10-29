**Lane:** levels (Renda)
**Priority:** SHOULD
**PRD:** G4
**Cost:** S
**Depends on:** nothing (draft 065 consumes it)

### Context

The mission intro moves the camera from the level's goal to the player's spawn view. Each level supplies the **start shot**, and the end shot is the spawn room's existing eye. One straight eased move: no splines, no cuts.

`docs/mission-intro.md`, "The camera, per level".

### Scope — files you may touch

- `src/levels/layouts/ascent.js`, `src/levels/layouts/last-colour.js` — an `intro: { from: { pos, target } }` entry
- `src/levels/level-01-mission.js` — a `static INTRO` with the same shape (Outskirts is not a layout level)
- `src/levels/viewer.html` / `SHOTS` — an `intro-from` viewer shot per level, so the start frame can be checked by eye
- `tests/` — the shot contract

### Out of scope — do not touch

- The camera move, the card, skip or timing — draft 065, ui lane
- The Primer: it has no camera move (its briefing still is its opening)

### Acceptance criteria

- [ ] Outskirts, the Ascent and Last Colour each have an `intro.from` shot
- [ ] Each start shot frames that level's goal: Outskirts from the Ledge looking back at Island A; the Ascent beside the summit lift tower looking down the spiral; Last Colour at the Siphon's beacon looking back up the corridor
- [ ] Every start shot is above the floor and inside the level's bounds (tested)
- [ ] The straight line from start shot to spawn eye passes through no solid (tested), so the camera never clips a wall
- [ ] Each start shot has a viewer shot

### Manual check

Open the level viewer, pick each level's `intro-from` shot, and confirm the goal is in frame and reads as the goal. Then pick the spawn eye shot and imagine five seconds between them. If the move would cross the whole level in a blur, move the start shot closer.

### Design note

**Goal first, you last.** The player learns where they are going before they learn where they are, which is the same job the Ascent's lift tower and Last Colour's beacon already do from the spawn. The intro just shows it up close first.

### Definition of done

- [ ] `npm test` green, with the shot contract tests
- [ ] `docs/levels/` updated per level with its start frame
- [ ] No files touched outside the lane
