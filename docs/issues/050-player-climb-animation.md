**Lane:** core (Ozuko), with Lethabo on the clip
**Priority:** SHOULD
**PRD:** AN5
**Cost:** S
**Depends on:** #121

### Context

The player climbs green walls, which is one of the game's best traversal verbs — and while climbing they run their ground animation. It is the most obviously wrong pose in the build after the airborne one.

### Scope — files you may touch

- `src/core/player.js` — expose the climbing state
- `src/main.js` — **shared.** Coordinate for the one state read
- `src/shaders/avatar.js` — the climb state and its clip

### Out of scope — do not touch

- Climb speed, threshold or wall-jump physics
- Airborne states, which are issue #82
- Enemy climbing

### Acceptance criteria

- [ ] The avatar enters a climb state when the player is on a green wall
- [ ] It exits when the player reaches the top, drops off, or wall-jumps
- [ ] Movement direction is reflected — up and down do not look identical if the clip allows it
- [ ] Blending is short enough that the transition does not lag behind the physics
- [ ] If no climb clip exists after #121, a documented fallback is used rather than a T-pose

### Manual check

Climb a pillar face in Outskirts and watch. It should read as climbing, not as running up a wall. Then wall-jump off and confirm the exit is clean.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for AN5 updated
- [ ] No files touched outside the lane, other than the coordinated state read
