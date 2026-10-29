**Lane:** levels (Renda)
**Priority:** SHOULD
**PRD:** D8, C4
**Cost:** M
**Depends on:** #98, and on C4 — phase one needs a working freeze

### Context

The final exam. Not an enemy and not a health bar: a structure dismantled with three colours in sequence. It tests the system the whole game taught and costs no rig, no animation set and no AI.

Design: `docs/levels/03-last-colour.md`, room "Siphon" and `docs/enemies/algorithms.md` (Siphon).

### Scope — files you may touch

- `src/levels/level-03-horde.js` — the siphon structure and its phase transitions
- `src/config.js` — phase requirements

### Out of scope — do not touch

- Big Arm
- The freeze implementation — that is C4
- The core waves

### Acceptance criteria

- [ ] **Phase 1:** intake exposed; blue freeze completes it
- [ ] **Phase 2:** up to three arms thrash; green pin neutralises each
- [ ] **Phase 3:** core exposed; red knocks it into the machine
- [ ] Each phase's target is visually obvious **before** it becomes solvable
- [ ] No phase can be skipped by damage
- [ ] The finale fires the win through `game.onWin()` only after phase three
- [ ] A player who forgets a colour can recover — no phase soft-locks

### Manual check

Play it having used all three colours in the level. Then play it having barely painted anything — it should still be completable, because it tests knowledge rather than ammunition.

### Design note

**Readability over challenge.** If the player has to guess which colour a phase wants, the exam becomes a quiz. The intake glows blue-cold, the arms read as pinnable, the core reads as knockable. Give the tell, then the test.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for D8 updated
- [ ] No files touched outside the lane
