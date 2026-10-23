**Lane:** levels (Renda), with Lethabo on the boss behaviour
**Priority:** SHOULD
**PRD:** D7
**Cost:** L
**Depends on:** 026, M8 for the model

### Context

The arena boss. Its job is not to be a health sponge — it is to be a **pressure multiplier** on the wave that just happened. It takes the floor away, so the fight is about territory rather than damage.

Design: `docs/levels/03-last-colour.md`, room "Big Arm" and `docs/enemies/algorithms.md` (Big Arm).

### Scope — files you may touch

- `src/levels/level-03-horde.js` — the boss encounter and its spawn conditions
- `src/enemies/` — **coordinate with Lethabo**; the phases belong in the enemy layer
- `src/config.js` — phase thresholds and timings

### Out of scope — do not touch

- Ordinary enemy behaviour
- The Siphon
- The hangar and corridor

### Acceptance criteria

- [ ] Enters at the end of wave three
- [ ] **Phase 1:** slow advance, telegraphed ground slam, converts ground to grey in a radius
- [ ] **Phase 2:** faster, a grab attack, spawns two Drainers
- [ ] **Phase 3:** enraged, continuous slam, ignores paint
- [ ] Dies to a committed colour combo, not to accumulated damage
- [ ] The combo uses all three colours in order
- [ ] Every attack telegraphs well enough to be dodged on the second attempt

### Manual check

Fight it with a fully painted arena, then with a bare one. Both should be winnable; the bare one should be much harder. If painting does not change the fight, Big Arm is not doing its job.

### Design note

If time is short, this is the cut — but then the Siphon has to carry the finale alone, and the PRD row changes in the same commit.

**The rule:** Big Arm must never be beaten by shooting it a lot. It should be beaten by understanding it.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for D7 updated
- [ ] No files touched outside the lane
