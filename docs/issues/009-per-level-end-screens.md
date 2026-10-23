**Lane:** ui (Moses)
**Priority:** MUST
**PRD:** H3
**Cost:** S
**Depends on:** nothing

### Context

The end screen currently says **EXTRACTED** or **DOWN**, whichever level you are in. With four levels and two failure modes — dying and drying out — that is not enough information. A marker playing level three should be told they finished level three.

### Scope — files you may touch

- `src/ui/hud.js` — the end screens
- `src/ui/style.css`

### Out of scope — do not touch

- `src/main.js` — **shared.** The level identity has to reach the HUD; coordinate with Ozuko for that one call
- The scorecard — that is a separate `SHOULD` (A8)

### Acceptance criteria

- [ ] The win screen names the level: `PRIMER COMPLETE`, `OUTSKIRTS CLEARED`, `ASCENT CLEARED`, `CORE BREACHED`
- [ ] The lose screen distinguishes **dying** from **drying out**
- [ ] Both screens tell the player how to restart without refreshing
- [ ] Restart actually clears both screens

### Manual check

Complete level one, confirm the title. Then die on level two, confirm the death wording. Then dry out on level two, confirm the different wording.

### Definition of done

- [ ] `npm test` green
- [ ] Status column in `docs/PRD.md` updated (H3)
- [ ] No files touched outside the lane
