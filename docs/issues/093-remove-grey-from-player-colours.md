**Lane:** paint (Dikeledi)
**Priority:** P1. Quality plan §3.6, Phase 0 (Paint)
**PRD:** rubric, Gameplay & Experience; fiction
**Cost:** S
**Depends on:** nothing

### Context

Renda's call (quality plan §3.6): grey is Corrupt Corp's paint. Letting the player fire it muddies the fiction ("colour is the rebels' weapon") and the readability (grey would mean both "theirs" and "mine").

### Change

Remove grey from the player's colour cycle (scroll and number keys). Enemies and the world keep grey. Add a one-line entry in `docs/DECISIONS.md` (the plan marks it "decision needed").

### Scope — files you may touch

- `src/paint/paint-gun.js` (the colour cycle), `src/config.js` if the cycle lives there
- `src/ui/hud.js` only if the colour picker lists grey (raise with Moses)
- `docs/DECISIONS.md` (append)
- `tests/`

### Acceptance criteria

- [ ] The player cannot select or fire grey by any input.
- [ ] Blue, red and green behave as before; ammo is unchanged.
- [ ] `npm test` passes.

### Manual check

Cycle every colour with the scroll wheel and 1–4: grey never comes up.
