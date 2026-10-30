// Loop pass step 5 (quality plan §3.5): grey slowed the player to 4.2 m/s,
// slower than a Charger, and grey is the whole level at load, so every level's
// first minute dragged. One grey, milder: 0.6 -> 0.85. (The plan's fuller
// answer, two greys with fresh enemy grey still at 0.6, is #235.)
import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAYER, SURFACE, ENEMY } from '../src/config.js';

test('step 5: grey is a drag you want to fix, not a crawl', () => {
  const onGrey = PLAYER.maxSpeed * SURFACE.grey.standSlow;
  assert.equal(SURFACE.grey.standSlow, 0.85);
  assert.ok(onGrey > ENEMY.charger.speed, `on grey (${onGrey.toFixed(2)} m/s) the player should outpace a Charger (${ENEMY.charger.speed})`);
  assert.ok(SURFACE.grey.standSlow < 1, 'grey must still cost something: painting ahead is still worth it');
});
