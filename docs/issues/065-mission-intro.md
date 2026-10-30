**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** G4
**Cost:** S
**Depends on:** the Figma frame for the title card; draft 066 for the camera shots (build against a placeholder shot until it lands)

### Context

Each mission opens with five seconds of camera over the still-grey level, from the goal back to the player, while a title card types out level, location, day and time, and objective. It's the Call of Duty 4 mission-load card over a Splatoon-style stage pan, and it ends on the player's own view so there is no cut.

`docs/mission-intro.md` (the design) and `docs/DECISIONS.md`, 30 Oct.

### Scope — files you may touch

- `src/ui/` — a `mission-intro.js` timeline (DOM-free, like `CommsTimeline`) plus its overlay, and `intro-lines.js` for the card text
- `src/ui/style.css`
- `src/config.js` — a `MISSION_INTRO` block (move time, fade, type speed, cap)
- `src/main.js` — the wiring: play on a new mission, hand the camera over, start the run clock on handover
- `src/ui/briefing.js` — the Primer's still shows the same title card

### Out of scope — do not touch

- The camera shots themselves — draft 066, levels lane
- Level geometry
- A mission outro — parked, needs its own decision
- Any character, portrait or voice

### Acceptance criteria

- [ ] On a new mission, the camera eases from the level's `intro.from` shot to the spawn view over `MISSION_INTRO.moveTime` (5 s), with no cut at handover
- [ ] The title card types out level, location, day · time and objective, one line after another
- [ ] Never longer than `MISSION_INTRO.cap` (6 s) from load to control
- [ ] A fresh key or click skips: camera snaps to the spawn view, card fades, play starts. The skip also locks the pointer
- [ ] A held key or the click that opened the level does not skip it (reuse `createDismissGate`)
- [ ] Does **not** play on restart (R, or restart from the pause menu)
- [ ] The simulation is paused under it; the scorecard's `run.time` and `run.dryTime` start at handover
- [ ] The comms bar cannot show a line during it
- [ ] Esc opens the pause menu over it; closing the menu resumes it
- [ ] `prefers-reduced-motion`: no camera move, the card shows over the spawn view
- [ ] The Primer plays no camera move; its briefing still shows the Primer's title card
- [ ] Card text is never amber or telegraph yellow; legible at 720p and 1080p
- [ ] A level with no `intro` shot skips the camera move and still shows the card

### Manual check

From the menu, start each level in turn. Watch the camera land on the spawn view with no jump, and read the card. Start again and skip at once with a click: you should be playing, pointer locked, in one click. Die, press R: no intro. Win Outskirts and go to the Ascent: the intro plays. Turn on reduced motion in the OS and repeat one level.

### Design note

**The end shot is the play camera.** If the intro ends anywhere else, handover becomes a cut and the effect is lost. Interpolate toward the camera pose the player camera would have on its first frame, not toward a hard-coded spawn eye.

**The intro is not play time.** If the run clock starts at load, every scorecard is 5 s slower than the run was.

### Definition of done

- [ ] `npm test` green, with tests for the timeline (play, skip, cap, reduced motion), restart not replaying, the run clock starting at handover, and every level having card text
- [ ] PRD status for G4 updated
- [ ] No files touched outside the lane
