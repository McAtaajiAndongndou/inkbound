**Lane:** shaders (Lethabo), who owns `src/enemies/`. Two lines of wiring in the levels lane (Renda)
**Priority:** SHOULD. Waves stack into one blob, which hides how many enemies there are and makes the fight unreadable
**PRD:** none
**Cost:** S
**Depends on:** #186 moves `ENEMY_BODY` into `src/config.js`. If #187 lands first, do the move here instead, and #186 drops that part

### Context

Renda, playtest, 30 Oct: "a player or enemy can still walk through enemies."

Confirmed in the code. `Enemy.update(dt, playerPos)` moves each enemy toward the player and refuses steps into walls or off ledges (`_stepGround`), but **an enemy never looks at the other enemies**. Every chaser takes the same path to the same point, so a wave of five Chargers converges into one body standing in one spot.

Why it matters:

- **Readability.** The player should be able to count a wave at a glance. Five enemies drawn into one silhouette look like one.
- **Splash and freeze lose their point.** The paint gun's splash (#117) and blue's freeze are rewards for catching a *group*. A stacked group gets hit as one target, so the spacing choice never comes up.
- **References.** Left 4 Dead's common infected and Salmon Run's Lessers jostle and spread into a crescent. That spread is what makes a crowd read as a crowd.

### The design

**Each frame, after every enemy has moved, overlapping pairs are pushed apart.**

| Choice | Value | Why |
|---|---|---|
| Shape | Horizontal circles, radius `enemy.config.bodyRadius ?? ENEMY_BODY.radius` (0.4 m; Big Arm 0.6 m) | The same body #186 makes solid to the player |
| Vertical | Only pairs within `ENEMY_SEPARATION.heightTolerance` (1.2 m) of each other | A crawler on a ledge above a Sprayer isn't touching it |
| Split | Each enemy takes **half** the overlap | Neither wins |
| Immovable | Frozen, pinned, **sleeping**, and Big Arm | The other one takes the full overlap. A frozen enemy is a block of ice, a pinned one is rooted, a sleeping guard holds its post, and a boss doesn't get jostled. Two immovables: skip the pair |
| Skipped | Dead enemies; a crawler on a face (`_climbing`) or falling (`_falling`) | The climb owns its own spacing (see `_wallBlocked`'s comment) |
| Walls and ledges | Every push goes through `_stepGround`. A refused push is **dropped** for this frame (or slid one axis, as the chase does) | Separation must never shove an enemy through cover or off its island. That's the rule that made cover real |
| Exactly on top (dist ≈ 0) | Split along a fixed axis by roster index (lower index goes +x) | Deterministic, so tests are stable |
| Passes | One per frame | Residual overlap settles over the next frames and isn't visible |

**Cost:** pairwise over the live roster. Last Colour's worst case is about 30 enemies, so 435 pair checks, which is cheap. No spatial grid needed.

### Where it runs

A new `separateEnemies(enemies)` in `src/enemies/separation.js`, called **once per frame after the enemy update loop**.

That loop lives in the levels lane, so the wiring is Renda's: one line after the loop in `src/levels/layout-level.js` (around line 177) and one in `src/levels/level-01-mission.js` (around line 1040). The function is lane-clean (it only reads and moves enemies), and the call sites are two lines.

### Config

```js
export const ENEMY_SEPARATION = {
  heightTolerance: 1.2,   // m; pairs further apart vertically don't touch
};
```

Switch `enemy.js` from its local `ENEMY_BODY` to the config export (#186 adds it), and delete the local copy.

### Scope — files you may touch

- `src/enemies/separation.js` (new)
- `src/enemies/enemy.js`: import `ENEMY_BODY` from config; expose whatever `separation.js` needs to tell "movable" from "immovable" (a getter, not reaching into `_pinnedTimer` from outside)
- `src/config.js`: `ENEMY_SEPARATION`
- `tests/enemy-separation.test.js` (new)
- `docs/enemies/algorithms.md`: a short "Bodies" note under the shared substrate

**Not** the levels' call sites: Renda wires those once this lands.

### Out of scope

- **The player against enemies** (#186, core).
- **Flocking or flanking.** This keeps bodies apart; it doesn't plan routes. Spreading out to surround the player is a behaviour question for later.
- **Attack tokens** (audit, Enemies item 2). Separate change.

### Acceptance criteria

- [ ] Two enemies placed at the same point end at least 0.8 m apart after a few frames, deterministically
- [ ] Five Chargers chasing a still player from the same direction end with no pair closer than 0.75 m
- [ ] A frozen enemy doesn't move when another walks into it; the walker is pushed the full overlap
- [ ] A separation push never moves an enemy through a wall panel (an enemy pressed between a wall and another enemy stays on its side of the wall)
- [ ] A separation push never moves an enemy off its floor (two enemies at the edge of an island: neither falls)
- [ ] Dead enemies and crawlers on a face are ignored
- [ ] No allocation per frame
- [ ] `npm test` passes

### Manual check (Renda, after wiring)

1. Outskirts, island C: wake the arena and back away. The enemies should come at you as a spread, not a single column.
2. Freeze one Charger with blue in a doorway: the others pile up behind it instead of walking through. A frozen enemy has become cover, which is a nice side effect.
3. Last Colour, the Core's wave three: count the enemies at a glance. If you can, it works.
