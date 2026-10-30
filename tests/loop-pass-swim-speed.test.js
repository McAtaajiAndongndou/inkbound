// Loop pass step 4b (quality plan §3.4): swim speed 1.4x -> 1.9x, so swimming
// is how you get places (Splatoon's swim is roughly double the walk).
import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, SUBMERGE } from '../src/config.js';

test('step 4b: swimming is close to double the walk', () => {
  const swim = PLAYER.maxSpeed * SUBMERGE.speedMultiplier;
  assert.ok(SUBMERGE.speedMultiplier >= 1.8 && SUBMERGE.speedMultiplier <= 2, `swim multiplier ${SUBMERGE.speedMultiplier}`);
  assert.ok(swim > PLAYER.maxSpeed * 1.5, `swimming at ${swim.toFixed(1)} m/s should clearly beat walking`);
});
