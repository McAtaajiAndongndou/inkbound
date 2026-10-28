**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** G1
**Cost:** S
**Depends on:** nothing

### Context

The tutorial opens with a single still: the sergeant and the player, with a line underneath. It is the game's only character-art moment and it costs one drawing instead of a portrait system.

`docs/DECISIONS.md` and `docs/levels/00-the-primer.md` (R0).

### Scope — files you may touch

- `src/ui/` — a briefing overlay
- `public/assets/` — the still image
- `src/ui/style.css`

### Out of scope — do not touch

- In-game dialogue — that is issue #112
- Any animated portrait work
- The tutorial's level geometry

### Acceptance criteria

- [ ] Shows one still image with the sergeant's briefing line
- [ ] Dismissable immediately, by click or key
- [ ] Cannot be accidentally skipped by the click that locks the pointer
- [ ] Does not block the pause menu
- [ ] Text is legible at 1080p and at 720p
- [ ] If the image fails to load, the line still displays over a plain panel

### Manual check

Start the game fresh. Read the line, dismiss it, and confirm you land in the first room with the pointer locked. Then reload and try to skip instantly — you should be able to.

### Design note

Two lines of text maximum. The sergeant's job in this still is to say **why you are here**, not to explain the controls — the controls are in the pause menu and the level teaches the rest.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for G1 updated
- [ ] No files touched outside the lane
