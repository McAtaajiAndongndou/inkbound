**Lane:** shaders (Lethabo)
**Priority:** COULD
**PRD:** D6
**Cost:** M
**Depends on:** 042 for the model; behaviour can run on the box fallback

### Context

The one new enemy, and the only one that attacks the loop from the other side. Every other enemy punishes you for being **dry**. The Stalker punishes you for being **wet**: it is fast on your paint and slow on grey, so the escape is to give up your own territory.

It is deliberately **not** hidden. An enemy that is both faster than you and invisible in the one place you feel safe is unfairness, not tension.

### Scope — files you may touch

- `src/enemies/enemy.js` — the surface-dependent speed
- `src/config.js` — both speeds, lunge timing and recovery

### Out of scope — do not touch

- The Drainer, whose niche is eating territory
- Big Arm
- The stealth system — the Stalker ignores it because it is always visible

### Acceptance criteria

- [ ] ~6.0 m/s on the player's paint, ~2.0 m/s on grey
- [ ] It prefers to travel inside the player's territory
- [ ] It is always visible — no hiding, no fade
- [ ] Normal colour procs apply: freeze, pin and knockback all work
- [ ] A 0.4 s lunge telegraph followed by commitment, with a ~0.8 s recovery on a miss
- [ ] Introduced only in Last Colour's core, after two levels of "wet means safe"
- [ ] `tests/stalker-speed.test.js` covers the surface-dependent speed

### Manual check

Paint a field and let it hunt you inside the field — it should close fast. Step onto grey and walk: it should visibly slow and you should be able to leave. If grey does not feel like an escape, the speed ratio is wrong.

### Design note

The player must be able to **deduce** the rule, never be told it. If they never work out that grey is safe from it, the enemy is a random fast thing rather than the best idea in the level.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for D6 updated
- [ ] No files touched outside the lane
