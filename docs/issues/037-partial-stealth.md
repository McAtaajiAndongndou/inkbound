**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** A7
**Cost:** M
**Depends on:** 036 (there is nothing to hide with until submerge exists)

### Context

Partial stealth, settled in `docs/DECISIONS.md`: submerging halves detection, enemies lose you when you break line of sight, and they search your last known position. Firing always reveals you.

The restriction is what makes it fair — a player who can stay hidden forever while shooting would break every encounter.

### Scope — files you may touch

- `src/enemies/enemy.js` — the awareness states
- `src/config.js` — detection radii, search duration

### Out of scope — do not touch

- The player's submerge state
- Enemy attack behaviour
- The turret, which tracks regardless of stealth because it is a machine

### Acceptance criteria

- [ ] Detection radius is ~16 m against a standing player and ~7 m against a submerged one
- [ ] Firing sets every enemy that can see the player to alerted for ~3 s, regardless of submerge
- [ ] Breaking line of sight drops an enemy into a search state, walking to the last known position
- [ ] Search gives up after ~6 s and returns to patrol
- [ ] Enemies do not home in on the player's true position while searching
- [ ] The turret ignores stealth entirely

### Manual check

Submerge behind cover, move away, and watch an enemy walk to where you *were*. Then fire a shot and confirm it turns toward you immediately.

### Design note

Being hunted is only frightening if the hunter is fallible. If searching enemies still find you, the state is noise; if they give up instantly, the stealth is pointless. Six seconds is the dial for that.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for A7 updated
- [ ] No files touched outside the lane
