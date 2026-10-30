**Lane:** shaders (Lethabo), `src/shaders/avatar.js`
**Priority:** SHOULD. Quality plan §6.3 A7 (and A8 if #234 ships); QA: "the shift animation is very janky"
**PRD:** A6 (submerge); rubric, Visual
**Cost:** S
**Depends on:** nothing. #231 (the camera glide) is done as a prototype and kept by Renda

### Context

Renda's loop-pass QA, 30 Oct: the submerge **camera** now glides and works ("you can keep it"), but **"the animation still needs work"**. The body's dive into the paint is the other half of the move.

Today (`avatar.js` swim pass, `SWIM` in config) the body squashes toward 15% height and 130% width (`SWIM.squash`, `SWIM.spread`) at `SWIM.rate` 16/s, a paint blob appears where it went in, and rings ripple. It reads as a pancake, not a dive.

### Change (plan §6.3 A7)

Replace the pancake squash with a quick **dive** into the paint blob (~0.12 s): the body tips forward and drops into the blob, rather than flattening in place. Reverse it on the way out. Keep the blob, the ripples and the swimming indicator (Renda likes the indicator).

If the pop-out jump (#234) ships, A8: use the player's `Roll` clip for the pop-out.

All timings go in `SWIM` in `src/config.js`.

### Scope — files you may touch

- `src/shaders/avatar.js` (the swim pass), `src/config.js` (`SWIM`)
- `tests/`

Not `src/core/camera-rig.js`: the camera half is #231.

### Acceptance criteria

- [ ] Going under plays a dive (forward tip and drop) lasting `SWIM`'s configured time, not a uniform squash.
- [ ] Coming up reverses it.
- [ ] The blob, the ripples and the swimming indicator still show.
- [ ] `npm test` passes.

### Manual check

Outskirts in third person: tap Shift on your paint several times, then hold it and swim. Going in and coming out should read as a dive, not a pancake.
