**Lane:** core (Ozuko)
**Priority:** MUST
**PRD:** A4
**Cost:** S
**Depends on:** unrelated to #1, but read it first — both touch the economy

### Context

Grey is Corrupt Corp's paint, not empty ground (`docs/adr/0002-grey-is-enemy-paint.md`). It should read as *their* territory: it slows you and refills nothing, so colour is the only way to move properly.

Right now `SURFACE.grey` is `speedScale: 1.0` — identical to any other neutral surface. There is no penalty for being dry.

### Scope — files you may touch

- `src/config.js` — give grey a `speedScale` below 1.0
- `src/core/player.js` — apply it as a **live modifier**

### Out of scope — do not touch

- Refill behaviour — that is issue 001
- The dying/dry-out state — that is issue 003
- `src/paint/**`

### The trap in this issue

`config.js` documents `speedScale` as **sticky**: *"You keep it after you leave, and a lower one never takes it away."* Under that rule grey's penalty would evaporate the moment the player touched blue once, and the feature would silently do nothing.

Grey must therefore be applied **while standing on it**, not accumulated. Everything else about the current rule stays.

### Acceptance criteria

- [ ] Standing on grey is measurably slower than standing on your own colour
- [ ] Stepping off grey restores speed immediately
- [ ] Touching blue first does **not** cancel the grey penalty (this is the existing-rule regression)
- [ ] `tests/grey-slowdown.test.js` covers all three

### Manual check

Run across a blue patch, step onto grey, and confirm you slow down rather than carrying the boost. Then confirm the reverse: stepping back on blue speeds you up again.

### Definition of done

- [ ] `npm test` green — the 144 existing tests must stay green, especially the `speedScale` ones
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (A4)
- [ ] No files touched outside the lane
