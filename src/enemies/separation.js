import { ENEMY_SEPARATION } from "../config.js";

/**
 * Enemies push each other apart (#187).
 *
 * Every chaser takes the same path to the same point, so without this a wave
 * of five Chargers converges into one body: the player cannot count it, and
 * splash and freeze lose the group they exist to reward. Left 4 Dead's common
 * infected and Salmon Run's Lessers jostle into a crescent; that spread is what
 * makes a crowd read as a crowd.
 *
 * Called ONCE per frame by the level, after every enemy has moved. One pass:
 * residual overlap settles over the next frames and is not visible.
 *
 * - Bodies are horizontal circles of `enemy.bodyRadius` (0.4 m; Big Arm 0.6).
 * - Only pairs within `ENEMY_SEPARATION.heightTolerance` vertically touch.
 * - Each takes half the overlap. An immovable one (frozen, pinned, sleeping,
 *   Big Arm) takes none and the other takes it all; two immovables are skipped.
 * - Skipped: the dead, and a crawler on a face or falling off one (the climb
 *   owns its own spacing).
 * - Every push goes through `enemy.nudge`, which refuses walls, ledges and
 *   drops exactly as a step does. A refused push is dropped for the frame.
 * - Exactly on top: split along x, the lower roster index going +x, so the
 *   result is deterministic.
 *
 * Pairwise over the roster: Last Colour's worst case is about 30 enemies, 435
 * checks — cheap, no grid. Scalars only: nothing is allocated.
 */
export function separateEnemies(enemies) {
  const n = enemies.length;
  for (let i = 0; i < n; i++) {
    const a = enemies[i];
    if (!touchable(a)) continue;
    for (let j = i + 1; j < n; j++) {
      const b = enemies[j];
      if (!touchable(b)) continue;
      if (Math.abs(a.position.y - b.position.y) > ENEMY_SEPARATION.heightTolerance) continue;

      const aFixed = a.immovable;
      const bFixed = b.immovable;
      if (aFixed && bFixed) continue;

      const reach = a.bodyRadius + b.bodyRadius;
      let nx = a.position.x - b.position.x;
      let nz = a.position.z - b.position.z;
      const d2 = nx * nx + nz * nz;
      if (d2 >= reach * reach) continue;

      const d = Math.sqrt(d2);
      if (d > 1e-6) {
        nx /= d;
        nz /= d;
      } else {
        nx = 1;           // a (the lower index) goes +x, b goes -x
        nz = 0;
      }
      const overlap = reach - d;

      if (aFixed) {
        b.nudge(-nx * overlap, -nz * overlap);
      } else if (bFixed) {
        a.nudge(nx * overlap, nz * overlap);
      } else {
        const half = overlap * 0.5;
        a.nudge(nx * half, nz * half);
        b.nudge(-nx * half, -nz * half);
      }
    }
  }
}

function touchable(e) {
  return e.alive !== false && e.position && e.climbing !== true && e.falling !== true;
}
