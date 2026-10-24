**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** D2
**Cost:** S
**Depends on:** 004 (the same three-beat pattern, same file)

### Context

The Sprayer has an attack cooldown but no **opening**. `docs/enemies/algorithms.md` specifies a 1.2 s reload after each burst, during which it cannot fire — that is the window that makes it punishable rather than merely survivable.

The Sprayer is also the enemy that eats your territory, so the reload is the moment you can safely step onto grey to repaint.

### Scope — files you may touch

- `src/enemies/enemy.js` — the reload state
- `src/config.js` — reload duration and the burst size it follows

### Out of scope — do not touch

- The Charger's recovery, which is issue 004
- Grey conversion — that is issue 035
- Pinning, which already works and does not stop it firing

### Acceptance criteria

- [ ] A burst is followed by ~1.2 s where it cannot fire
- [ ] The reload is visible or audible — a tell the player can learn
- [ ] Green pin still roots it **and** it still fires; pinning is control, not safety
- [ ] The reload does not reset when the player breaks line of sight
- [ ] A player can bait a burst, use the reload to repaint, and be back in cover before it fires again
- [ ] `tests/enemy-opening.test.js` covers the reload window

### Manual check

Stand where a Sprayer can see you and count the gaps between bursts. You should be able to paint a patch in one gap. If you cannot, the window is too short to be useful.

### Design note

The reload is what makes territory recoverable. If the window is shorter than the time it takes to paint one splat and get back to cover, the Drainer and the Sprayer together become a death spiral.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for D2 updated
- [ ] No files touched outside the lane
