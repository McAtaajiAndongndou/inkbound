**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** AN6, AN12
**Cost:** S
**Depends on:** #117 (aiming must mean something before a pose is worth having)

### Context

The player rig has 24 clips and the code uses three. Sitting unused are `HitRecieve`, `HitRecieve_2`, `Gun_Shoot`, `Idle_Gun_Shoot` and `Idle_Gun_Pointing` — free feedback that would cost nothing to wire.

Right now taking damage has no animation, firing has no pose change, and aiming is a FOV change with no body language.

### Scope — files you may touch

- `src/shaders/avatar.js` — the pose states and clip selection
- `src/main.js` — **shared.** Coordinate for the state reads
- `src/config.js` — blend times

### Out of scope — do not touch

- The ADS camera, FOV or sensitivity
- Airborne and climb, which are #82 and #122
- Enemy animation

### Acceptance criteria

- [ ] **Aiming:** the body moves to `Idle_Gun_Pointing` and back cleanly on release
- [ ] **Firing:** `Gun_Shoot` plays as a short upper-body accent, not a full-body replacement
- [ ] **Taking damage:** `HitRecieve` plays once per hit, and does not interrupt a jump or climb state permanently
- [ ] Blends are short enough to track the input
- [ ] The viewmodel gains a small movement bob
- [ ] No clip can leave the avatar stuck in a pose if its state ends early

### Manual check

Fire while walking, aim while standing, and take a hit while running. All three should read without the animation fighting the movement.

### Design note

Firing must **not** cancel locomotion. If shooting stops your legs, the game feels like it is stuttering; an upper-body accent layered over the run is the whole trick.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for AN6 and AN12 updated
- [ ] No files touched outside the lane
