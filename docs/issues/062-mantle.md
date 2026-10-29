**Lane:** core (Ozuko), with Moses reviewing; Lethabo on any clip
**Priority:** COULD — quality of life, not required (Renda, 29 Oct). The 0.3 m lips work; this only makes them unnecessary
**PRD:** none yet — proposes a new movement row: *climbs end by pulling the player onto the top*
**Cost:** M
**Depends on:** nothing. Coordinates with #122 (player climb animation), which owns the pose

### Context

A green climb has no ending. The wall test runs at chest height, so the climber loses the wall with their feet about 0.85 m short of the top, and the only way off is a jump that pushes **away** from the face (`src/core/player.js`, the `wallJumpPush` in the jump branch). The player lands back on whatever sticks out past the wall.

So every climbable top in every level needs a **lip** — a floor that overhangs the face toward the climber, or the climb fails. Outskirts' pillars had 2.5 m lips ("floors stretching out of them"), cut to 1 m; the Ascent uses the measured minimum, 0.3 m. Every one of them is a visual compromise forced by the physics, and the levels lane's tests enforce it (`tests/ascent-layout.test.js`, "tops out onto one that overhangs it").

Every climbing game ends a climb by pulling the player **onto** the top — Zelda's ledge pull-up, Assassin's Creed, Uncharted. That is the missing move.

### Scope — files you may touch

- `src/core/player.js` — detect the top of a climb and move the player onto it
- `src/config.js` — the mantle's numbers
- `src/main.js` — **shared**, only if the avatar needs a state read for #122

### Out of scope — do not touch

- Climb speed, climb threshold, wall-jump behaviour away from the top
- Which walls are climbable (green paint decides; that stays)
- Enemy climbing (`src/enemies/`)
- Level geometry — the levels lane removes the lips after this lands

### Acceptance criteria

- [ ] Climbing a green face to its top, while pushing into it, ends **standing on the top surface**, with no jump needed
- [ ] It works on a top that is **flush** with the face (no lip)
- [ ] It does not fire when there is no floor at the top, or the space above it is blocked
- [ ] It does not fire mid-wall — only within reach of the top edge
- [ ] Jumping off a wall before the top still works exactly as today
- [ ] Mantle height and duration live in `src/config.js` (recommended starting point: lift onto the surface ~0.6 m in from the edge, over ~0.25 s)
- [ ] Outskirts and the Ascent are still completable with their current lips (nothing regresses before the levels lane removes them)

### Manual check

In Outskirts, green-climb the left pillar and keep pushing forward at the top: you should end up standing on it without pressing jump. Then remove the `'+z'` lip from `rest-ledge` in `src/levels/layouts/ascent.js`, climb the Ascent's first face, and confirm you still end on the ledge (put the lip back after). Finally, jump off halfway up a wall and confirm nothing changed.

### Design note

Green stays the gate: a mantle replaces only the last ~0.85 m of a climb, so it makes climbing **smoother, not easier** — the paint cost is unchanged. Automatic, not a button: the player is already pushing into the wall, and a second input at the top is the clumsy moment this removes. After it lands, the levels lane sets every layout `lip` to 0 and relaxes the top-out test to "a climbable wall has a floor at its top".

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after — a climber on a flush-topped face ends on top
- [ ] A row added to `docs/PRD.md` and its status updated
- [ ] No files touched outside the lane, other than a coordinated `main.js` state read if #122 needs one
