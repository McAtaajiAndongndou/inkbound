**Lane:** core (Ozuko)
**Priority:** MUST
**PRD:** A5
**Cost:** S
**Depends on:** #73 (shared tank), #74 (grey slows)

### Context

With no trickle refill, a player can reach a state where the tank is empty and they own no ground at all. That is the real loss state — but left alone it is a **soft lock**: the player stands there able to do nothing and unsure whether they lost or just need to try harder.

`GLOSSARY.md` calls this **Dry out**. The rule: the game declares it rather than leaving the player in it.

### Scope — files you may touch

- `src/core/player.js` — detect the state
- `src/main.js` — report the loss
- `src/ui/hud.js` — **with Moses's agreement**; make the empty state loud

### Out of scope — do not touch

- Checkpoints or respawns — death restarts the level (`docs/DECISIONS.md`)
- Enemy behaviour

### Acceptance criteria

- [ ] Dry out is detected when the tank is zero **and** no surface cell is owned by the player
- [ ] A dry player standing **on** their own paint is not in a dry out — they are refilling
- [ ] The loss is reported through the same path as a death, so the existing end screen handles it
- [ ] The HUD's empty-tank warning is unmissable before the state is reached (colour, motion, or sound)

### Manual check

Empty the tank on grey ground with nothing painted. The run should end and say so — not sit there. Then repeat, but with paint under your feet: you should recover instead.

### Design note

The warning matters more than the detection. A player who understands they are about to lose will retreat; a player who finds out by losing will blame the game. The sergeant is the intended diegetic explanation — coordinate wording with the dialogue issue.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (A5)
- [ ] No files touched outside the lane
