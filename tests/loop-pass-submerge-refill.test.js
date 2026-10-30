// Loop pass step 4a (quality plan §3.1): submerged refill 32/s -> 40/s, so a
// dive is a reload. Standing refill is unchanged, so submerge stays the fast way.
import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT_GUN, SUBMERGE } from '../src/config.js';

test('step 4a: a dive refills a full tank in about 2.5 s; standing still takes 12.5 s', () => {
  const dive = 100 / (PAINT_GUN.refillRate * SUBMERGE.refillMultiplier);
  const stand = 100 / PAINT_GUN.refillRate;
  assert.ok(dive >= 2.3 && dive <= 2.7, `a dive refills in ${dive.toFixed(2)} s`);
  assert.equal(PAINT_GUN.refillRate, 8, 'standing refill is not part of this step');
  assert.ok(stand / dive >= 5, 'submerge must be at least five times faster than standing');
});
