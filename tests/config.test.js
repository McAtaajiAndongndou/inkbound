import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT_IDS, SURFACE, PLAYER, PAINT_GUN, AMMO, ENEMY, DEFENCE } from '../src/config.js';

test('paint ids are the indices written into the paint texture (do not reorder)', () => {
  assert.equal(PAINT_IDS.grey, 0);
  assert.equal(PAINT_IDS.blue, 1);
  assert.equal(PAINT_IDS.red, 2);
  assert.equal(PAINT_IDS.green, 3);
});

test('colour -> physics is the whole game: friction / restitution / climbable', () => {
  assert.equal(SURFACE.grey.climbable, false);
  assert.equal(SURFACE.blue.friction, 0.4);     // ice
  assert.equal(SURFACE.red.restitution > 0, true); // bounce
  assert.equal(SURFACE.green.climbable, true);   // grip + climb
});

test('ammo tanks are ordered by level pressure (L1 plentiful, L2 starved)', () => {
  assert.equal(AMMO[1].tank > AMMO[2].tank, true);
});

test('one enemy class, five configs — not five systems', () => {
  assert.deepEqual(Object.keys(ENEMY).sort(), ['charger', 'drainer', 'sprayer', 'turret', 'wallCrawler']);
  assert.equal(ENEMY.charger.canShoot, false);
  assert.equal(ENEMY.wallCrawler.climbsGreen, true);
  assert.equal(ENEMY.turret.canMove, false);
  assert.equal(ENEMY.drainer.drainsPaint, true);
});

test('difficulty = new rules, not bigger health bars', () => {
  assert.equal(DEFENCE[1].requiredColour, null);
  assert.equal(DEFENCE[2].requiredColour, 'red');
  assert.deepEqual(DEFENCE[3].combo, ['blue', 'red']);
});

test('red is a launcher in L1 (platform y≈4 needs it)', () => {
  assert.equal(PLAYER.minBounce, 15);            // trampoline launch (~4.3m)
  assert.equal(SURFACE.red.restitution, 0.9);
});

test('config still exposes the numbers the level tuning depends on', () => {
  assert.equal(typeof PLAYER.minBounce, 'number');
  assert.equal(typeof PLAYER.gravity, 'number');
  assert.equal(typeof PAINT_GUN.radius, 'number');
});
