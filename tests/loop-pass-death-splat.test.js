// Loop pass step 6 (quality plan §3.1): a kill's splat 1.8 m -> 2.5 m, so it
// is a pool you can dive into, and it stays well bigger than a hit's drip.
import test from 'node:test';
import assert from 'node:assert/strict';

import { DEATH_SPLAT, PAINT_GUN } from '../src/config.js';

test('step 6: a kill leaves a pool, not a puddle', () => {
  assert.equal(DEATH_SPLAT.radius, 2.5);
  assert.ok(DEATH_SPLAT.radius >= 3 * PAINT_GUN.hitDrip, 'a kill must stay the big refill next to a hit drip');
});
