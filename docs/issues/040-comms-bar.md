**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** G2, G3
**Cost:** S
**Depends on:** 039 for the visual language

### Context

The sergeant speaks **once per level**, at a fixed beat, in a comms bar — the summit, the descent, entering the base. Roughly four lines in the whole campaign, and it is the difference between "three levels" and "one campaign".

`docs/DECISIONS.md`: comms bar for text, no portrait system, one line per level.

### Scope — files you may touch

- `src/ui/` — the comms bar component
- `src/ui/style.css`
- The wiring that lets a level request a line

### Out of scope — do not touch

- The briefing still
- Level geometry
- Writing the lines themselves — that needs Renda and Moses together

### Acceptance criteria

- [ ] Shows a name plate, one short line, and nothing else
- [ ] Slides in, holds for a readable few seconds, fades out — no click required
- [ ] **Never appears during combat** — only at scripted, safe beats
- [ ] Skippable
- [ ] At most one line is ever on screen
- [ ] A level can trigger a specific line without the UI knowing the level's layout

### Manual check

Play Outskirts to the ledge and the Ascent to the summit. Each should produce one line at a calm moment, and nothing should appear mid-fight.

### Design note

The rule that protects the whole design: **a line must never cost the player health.** If the trigger fires while they are being shot at, the trigger is wrong — not the bar.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for G2 and G3 updated
- [ ] No files touched outside the lane
