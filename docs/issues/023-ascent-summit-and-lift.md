**Lane:** levels (Renda), with Moses on the title card and the sergeant line
**Priority:** MUST
**PRD:** E3, G2
**Cost:** S
**Depends on:** 022

### Context

The level's release, and the campaign's best free story beat: the player reaches the summit and sees a dead forest behind them and a grey military base on the horizon. No enemies, no paint required, no combat music.

Then a supply lift carries them down into that base — the transition into Last Colour.

Design: `docs/levels/02-the-ascent.md`, rooms R7 and R8.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the summit and the lift
- The extraction trigger, which should fire at the lift rather than at the summit's edge

### Out of scope — do not touch

- The sergeant's dialogue system — that is a UI issue
- The base itself, which is the next level
- The summit's geometry beyond what the sightline needs

### Acceptance criteria

- [ ] The summit has no enemies, no traps and no paint requirement
- [ ] The base is genuinely visible from the summit — verify with a camera, not by assumption
- [ ] The extraction does not fire the instant the player reaches the summit; they get the view first
- [ ] The supply lift is the extraction trigger
- [ ] The transition to Last Colour happens without a page refresh
- [ ] The summit is reachable only after the ledge fight

### Manual check

Stand on the summit and look at the horizon. Can you tell what the last level is from here? If not, the sightline is a geometry bug, not a story bug.

### Design note

**Put nothing else in this room.** Its entire job is to let the last fight land. Every prop you add takes attention away from the horizon.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
