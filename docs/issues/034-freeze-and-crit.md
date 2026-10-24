**Lane:** paint (Dikeledi), with Lethabo on the visual
**Priority:** SHOULD
**PRD:** C4
**Cost:** M
**Depends on:** nothing — but issue 028 is blocked on this

### Context

Blue is currently a slow. `ENEMIES.md` specifies the real payoff: three blue hits build a freeze, the frozen enemy shows a frost shell, and the next hit **crits for roughly triple damage**. It is the game's only buildup-then-proc, borrowed from frostbite and stagger mechanics.

It is also the second reason ADS exists — zooming in for the crit.

Design: `ENEMIES.md` ("Buildup-then-proc"), `docs/enemies/algorithms.md` (status effects).

### Scope — files you may touch

- `src/enemies/enemy.js` — buildup state on the enemy
- `src/paint/` — where a hit is applied
- `src/config.js` — buildup threshold, freeze duration, crit multiplier
- `src/shaders/` — **coordinate with Lethabo** for the frost shell

### Out of scope — do not touch

- Other colours' effects
- The turret, which explicitly has no procs (issue 005)
- Enemy HP values

### Acceptance criteria

- [ ] Three blue hits inside a window freeze the enemy
- [ ] Buildup decays if the player stops hitting, so it is a combo rather than a slow accumulation
- [ ] A frozen enemy cannot act, and is visibly frosted
- [ ] The next hit of **any** colour deals roughly 3× damage
- [ ] The freeze ends after the crit or after a short timeout, whichever comes first
- [ ] Freeze is refused on the turret
- [ ] Buildup and the frost shell read clearly from ~10 m

### Manual check

Freeze a Sprayer from range with ADS. It should frost over at a distance you can see, then die to one more shot. Then try the same on a turret and confirm nothing frosts.

### Design note

Tune the threshold against HP so it stays a **reward, not a skip button** — `ENEMIES.md` suggests roughly `HP / 3` hits. If it kills everything in two shots, the other colours stop mattering.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for C4 updated
- [ ] No files touched outside the lane
