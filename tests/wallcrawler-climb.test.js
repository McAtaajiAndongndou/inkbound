import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { CLIMB, ENEMY, PAINT_IDS } from '../src/config.js';

/**
 * #115 — the wall-crawler climbs, and green is the fast lane.
 *
 * `ENEMY.wallCrawler.climbsGreen` shipped as a flag with nothing behind it. What
 * these tests fix in place, in the issue's own words:
 *
 *   - it climbs vertical faces, grey ones included
 *   - green is FASTER than grey (5.0 against 3.5, per algorithms.md)
 *   - it prefers a green face when both are in reach
 *   - it cannot shoot while climbing — that is its opening
 *   - a green pin mid-climb drops it
 *   - a red hit knocks it off the wall
 *
 * Everything drives `Enemy.update()` directly: no models, no browser. Climbing is
 * decided from positions and a plane, which is all this needs.
 */

/** The frame step every test uses — 60 fps, so a second is sixty calls. */
const DT = 1 / 60;

/** A flat walkable surface, big enough to never be the point. */
function makeFloor({ size = 80, y = 0 } = {}) {
  const s = new PaintSurface({ width: size, height: size, cells: 2 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(0, y, 0);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

/**
 * One upright face. The plane's front is local +Z, so an unrotated surface at
 * `z` faces a crawler standing at larger z — the same convention `_face()` uses
 * in level 1 and `makeWall` uses in the stealth tests.
 */
function makeFace({ z = 0, height = 12, width = 20, paint = null } = {}) {
  const s = new PaintSurface({ width, height, cells: 2 });
  s.mesh.position.set(0, height / 2, z);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = false;
  if (paint) {
    // Grid coordinates are local to the plane, so a world point on the face is
    // enough — the surface does the conversion itself.
    s.splat(new THREE.Vector3(0, height / 2, z), paint, height);
  }
  return s;
}

/**
 * A crawler one metre in front of a face, on a floor, with the face handed to it
 * as a blocker — which is exactly how a level gives it walls.
 */
function makeCrawler({ at = [0, 0, 1], faces = [makeFace()] } = {}) {
  const floor = makeFloor();
  const enemy = new Enemy({
    position: new THREE.Vector3(...at),
    config: ENEMY.wallCrawler,
    parent: new THREE.Group(),
    floors: [floor],
    blockers: faces,
  });
  return { enemy, faces, floor };
}

/** The player standing on a ledge above the crawler, on the face's own plane. */
const ABOVE = new THREE.Vector3(0, 6, 1);

function run(enemy, frames, player = ABOVE) {
  for (let i = 0; i < frames; i++) enemy.update(DT, player);
}

test('it climbs a bare grey face', () => {
  const { enemy } = makeCrawler();
  const start = enemy.position.y;

  run(enemy, 30);

  assert.equal(enemy.climbing, true, 'should be holding the face');
  assert.ok(
    enemy.position.y > start + 0.5,
    `should be up the face by now (y=${enemy.position.y.toFixed(2)})`,
  );
});

test('green is the fast lane: it climbs a painted face faster than bare rock', () => {
  const bare = makeCrawler({ faces: [makeFace()] }).enemy;
  const painted = makeCrawler({ faces: [makeFace({ paint: 'green' })] }).enemy;

  run(bare, 30);
  run(painted, 30);

  assert.equal(bare.climbing, true);
  assert.equal(painted.climbing, true);
  assert.ok(
    painted.position.y > bare.position.y + 0.4,
    `green should be visibly quicker (green=${painted.position.y.toFixed(2)}, `
    + `grey=${bare.position.y.toFixed(2)})`,
  );
});

test('it prefers a green face over a nearer grey one', () => {
  // The grey face is CLOSER, so "nearest wins" and "green wins" give different
  // answers — which is the only way this test can tell them apart.
  const grey = makeFace({ z: 0 });
  const green = makeFace({ z: -0.5, paint: 'green' });
  const { enemy } = makeCrawler({ faces: [grey, green] });

  run(enemy, 30);

  // Green's 5.0 m/s over half a second is 2.5 m; grey's 3.5 m/s is 1.75 m.
  assert.ok(
    enemy.position.y > 2.1,
    `should have taken the green route (y=${enemy.position.y.toFixed(2)})`,
  );
});

test('it cannot shoot while it is on the wall', () => {
  const { enemy } = makeCrawler();

  // The player is well inside the crawler's 12 m attackRange, so the only thing
  // that can keep the windup from starting is the climb itself.
  for (let i = 0; i < 60; i++) {
    enemy.update(DT, ABOVE);
    assert.equal(enemy.telegraphing, false, `wound up mid-climb on frame ${i}`);
  }

  assert.equal(enemy.climbing, true);
});

test('a green pin halfway up drops it off the wall', () => {
  const { enemy } = makeCrawler();
  run(enemy, 20);

  assert.equal(enemy.climbing, true);
  const mid = enemy.position.y;
  assert.ok(mid > 0.5, `should be off the ground before the pin (y=${mid.toFixed(2)})`);

  enemy.takeColourHit(PAINT_IDS.green, 1);

  assert.equal(enemy.climbing, false, 'the pin should have taken it off the wall');

  run(enemy, 60);

  assert.equal(enemy.climbing, false, 'a pinned crawler does not re-grab the face');
  assert.ok(
    enemy.position.y < mid - 0.3,
    `should have fallen (was ${mid.toFixed(2)}, now ${enemy.position.y.toFixed(2)})`,
  );
});

test('a red hit knocks it off the wall', () => {
  const { enemy } = makeCrawler();
  run(enemy, 20);
  assert.equal(enemy.climbing, true);

  // Fired from behind the wall, so the impulse points away from the face.
  enemy.takeColourHit(PAINT_IDS.red, 1, new THREE.Vector3(0, 1, -4));

  assert.equal(enemy.climbing, false, 'red should knock it off');

  run(enemy, 40);
  assert.equal(enemy.climbing, false);
});

test('on the same floor it walks instead of climbing', () => {
  const { enemy } = makeCrawler();
  const start = new THREE.Vector3().copy(enemy.position);

  // The player is on the ground 13 m away: inside the 16 m detection radius, but
  // just OUTSIDE the 12 m attackRange — a windup plants the enemy, so a closer
  // player would freeze it in place and this test would be measuring the wrong
  // thing.
  run(enemy, 30, new THREE.Vector3(0, 0, 14));

  assert.equal(enemy.climbing, false, 'climbing is for another level, not for distance');
  assert.ok(
    enemy.position.z > start.z + 0.3,
    `it should have walked at the player (z=${enemy.position.z.toFixed(2)})`,
  );
});

test('a face too far to reach is not grabbed', () => {
  const { enemy } = makeCrawler({ faces: [makeFace({ z: -2 })] });

  run(enemy, 10);

  assert.equal(enemy.climbing, false, `reach is ${CLIMB.reach} m and the face is 3 m away`);
});