**Lane:** core (Ozuko)
**Priority:** MUST. Renda's playtest: submerge is "unusable" and "too jarring"
**PRD:** A6 (submerge)
**Cost:** S
**Depends on:** nothing. Prototyped on `proto/submerge-camera-glide`, cut from `main` (step 1 of `docs/playtests/loop-pass.md`); review it before it goes to `main`

### Context

Submerge (#108) lowers the third-person camera by `SUBMERGE.cameraOffset` and dips the aim point by `SUBMERGE.maxAngle` while Shift is held. `camera-rig.js` applies both as a **hard cut**: one frame the camera is at shoulder height, the next it is near the floor. Letting go cuts back. Renda: *"submerging should be about changing the camera, because right now it happens too jarringly. I do like the indicator letting me know that I am swimming or not."*

Splatoon's camera barely moves when you dive. The squid, the splash and the HUD tell you that you are swimming, and the camera stays calm so you can keep tracking the fight.

### Scope — files you may touch

- `src/core/camera-rig.js` — blend the submerge drop and aim dip in and out instead of switching them
- `src/config.js` — one new number in `SUBMERGE` for the blend speed

### Out of scope — do not touch

- The size of the drop (`cameraOffset`, `maxAngle`) — loop pass step 2 decides that, after this has been played
- The swimming indicator and the avatar squash — Renda likes the indicator
- Position damping for the whole rig (`docs/quality-plan.md` §5) — a separate step, so the two can be judged apart

### Acceptance criteria

- [ ] On the first frame of submerging, the camera has moved only part of the way down
- [ ] Held for a while, the camera ends exactly where it does on `main`, so the only change is the transition
- [ ] Letting go eases back up the same way
- [ ] The blend speed is a number in `config.js`, not in the rig
- [ ] `tests/submerge-camera.test.js` covers all three behaviours

### Manual check

On Outskirts, stand on your own paint and tap Shift, then hold it, then let go. The camera should glide down and up, never jump. Repeat while strafing past a Sprayer: you should be able to keep it on screen throughout.
