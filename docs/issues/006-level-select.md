**Lane:** ui (Moses)
**Priority:** MUST
**PRD:** E5
**Cost:** S
**Depends on:** #79 for anything to select — build it against stubs first

### Context

`src/ui/menu.js` carries the TODO *"loadout select, quality setting, level select"*. With four levels, a marker needs to reach any of them without finishing the one before. That is also how the team demos work in progress.

### Scope — files you may touch

- `src/ui/menu.js` — a level list in the pause menu
- `src/ui/style.css` — the list's styling

### Out of scope — do not touch

- `src/main.js` — **shared file.** Coordinate with Ozuko for the one-line hook that swaps levels; do not edit it unilaterally
- Level content
- Progress saving — nothing is persisted except options

### Acceptance criteria

- [ ] All four levels are listed by name: The Primer, Outskirts, The Ascent, Last Colour
- [ ] Selecting one loads it without a page refresh
- [ ] The currently loaded level is visually marked
- [ ] The list closes when the menu closes
- [ ] A level that fails to load does not leave the player in a dead menu

### Manual check

Open the pause menu, pick Last Colour, and confirm you land in it with no console errors. Then pick The Primer and confirm the reverse works.

### Note

The two later levels are stubs today. The menu must still list them — a stub that loads and does nothing is acceptable, a menu that hides them is not, because the marker needs to see the intended shape of the game.

### Definition of done

- [ ] `npm test` green
- [ ] Status column in `docs/PRD.md` updated (E5)
- [ ] No files touched outside the lane
