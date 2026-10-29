import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT_IDS, SURFACE, PLAYER, PAINT_GUN, AMMO, ENEMY, DEFENCE, CAMERA } from '../src/config.js';

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
  assert.equal(AMMO[1] > AMMO[2], true);
});

test('one enemy class, six configs — not six systems', () => {
  assert.deepEqual(Object.keys(ENEMY).sort(), ['charger', 'drainer', 'sprayer', 'stalker', 'turret', 'wallCrawler']);
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

/**
 * #39 #8 — "I look at the sky or floor too easily".
 *
 * Pinned because the pitch clamp is the whole fix and a stray edit back to a wide
 * range silently undoes it. The bounds are the thing that matters rather than the
 * numbers: the camera's OWN height is `(sin(pitch) + tpvHeight) * distance`, so it
 * goes BELOW the player as pitch goes negative, and past about -0.45 rad the
 * minHeightAboveFeet clamp is all that is holding the shot together.
 */
test('the camera cannot be aimed far past a shooters vertical range (#39 #8)', () => {
  const DEG = 180 / Math.PI;

  assert.ok(CAMERA.pitchMax <= 0.6, `+${(CAMERA.pitchMax * DEG).toFixed(0)} deg of sky is too much`);
  assert.ok(CAMERA.pitchMin >= -0.5, `${(CAMERA.pitchMin * DEG).toFixed(0)} deg down is too much`);
  assert.ok(CAMERA.pitchMax > 0.3, 'the camera still has to be able to look up at the tower');
  assert.ok(CAMERA.pitchMin < -0.3, 'and down at the floor in front of you');

  // and the low shot must not collapse onto the ground: at pitchMin the camera's
  // own offset is already below the player, so this is what keeps it legible.
  const lowest = (Math.sin(CAMERA.pitchMin) + CAMERA.tpvHeight) * CAMERA.tpvDistance;
  assert.ok(CAMERA.minHeightAboveFeet >= 1.0,
    `the camera offset dives to ${lowest.toFixed(2)} m at pitchMin, so a floor-skimming `
    + `clamp of ${CAMERA.minHeightAboveFeet} m is the whole shot`);
});

test('every colour carries the same feel knobs, so the player never special-cases one', () => {
  for (const [name, rules] of Object.entries(SURFACE)) {
    for (const key of ['friction', 'traction', 'speedScale', 'restitution', 'climbable']) {
      assert.ok(key in rules, `SURFACE.${name} is missing ${key}`);
    }
  }
});

test('the three colours feel distinct from grey', () => {
  const { grey, blue, red, green } = SURFACE;
  // blue: slides further, steers worse, goes faster
  assert.ok(blue.friction < grey.friction);
  assert.ok(blue.traction < grey.traction);
  assert.ok(blue.speedScale > grey.speedScale);
  // red: the only bouncy one
  assert.ok(red.restitution > 0 && grey.restitution === 0);
  // green: the only climbable one, and grippier than grey
  assert.ok(green.climbable && !grey.climbable);
  assert.ok(green.friction > grey.friction);
});
