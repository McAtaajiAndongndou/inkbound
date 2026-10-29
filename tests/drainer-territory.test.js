import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PaintSurface } from '../src/paint/paint-surface.js';
import { Enemy } from '../src/enemies/enemy.js';
import { ENEMY, PAINT_IDS, SURFACE } from '../src/config.js';

/**
 * #80 — the Drainer eats paint.
 *
 * The Drainer is the anti-snowball of the whole game: paint is positive feedback
 * (paint, move faster, get better armed, own the arena), and this is the one
 * enemy that takes it back. Before this file `drainsPaint: true` was a flag
 * nothing read, so every test in here was failing on main for the boring reason
 * that the code did not exist yet.
 *
 * Two halves, tested separately because they live in different modules:
 *   - the GRID: `PaintSurface.drain()` converts cells to grey, nearest first
 *   - the BEHAVIOUR: when a Drainer feeds, when it stands up, and that killing
 *     it stops the shrinking where it stood
 */

/** Lay a surface flat on the XZ plane so world points meet a real floor. */
function makeSurface({ width = 40, height = 40, cells = 4, unpaintable = false } = {}) {
  const s = new PaintSurface({ width, height, cells, unpaintable });
  s.isFloor = true;
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  return s;
}

/** How many cells are painted. The grid's own truth, not a cached number. */
function painted(surface) {
  const { cols, rows, data } = surface.map;
  let n = 0;
  for (let i = 0; i < cols * rows; i++) if (data[i * 4] !== PAINT_IDS.grey) n++;
  return n;
}

function makeDrainer(surface, at = new THREE.Vector3(0, 0, 0)) {
  return new Enemy({
    position: at.clone(),
    config: ENEMY.drainer,
    parent: new THREE.Group(),
    floors: [surface],
  });
}

/** Run the real update loop, `frames` of 60 Hz. */
function run(enemy, frames, playerPos) {
  for (let i = 0; i < frames; i++) enemy.update(1 / 60, playerPos);
}

/** A player position `d` metres from the enemy, whatever it does in between. */
function apart(enemy, d) {
  return new THREE.Vector3(enemy.position.x + d, enemy.position.y, enemy.position.z);
}

// --- the grid: PaintSurface.drain() -----------------------------------------

test('drain turns painted cells grey and eats no more than it was given', () => {
  const s = makeSurface();
  const centre = new THREE.Vector3(0, 0, 0);
  s.splat(centre, 'blue', 4);
  const before = painted(s);

  assert.equal(s.drain(centre, 1.6, 10), 10);
  assert.equal(painted(s), before - 10);
  assert.equal(s.paintIdAtWorld(centre), PAINT_IDS.grey);
});

test('a drain eats from the inside out, not from the edge of the patch', () => {
  // The manual check is "watch the patch shrink from the enemy outward", so the
  // ORDER is a gameplay rule: the cells nearest the eater go first, and no cell
  // further out is touched while a nearer one is still standing.
  const s = makeSurface();
  const centre = new THREE.Vector3(0, 0, 0);
  s.splat(centre, 'green', 6);

  const cell = s.worldToCell(centre);
  const centreCol = cell.col;
  const centreRow = cell.row;
  const snapshot = Uint8Array.from(s.map.data);

  s.drain(centre, 1.6, 40);

  const { cols, rows, data } = s.map;
  const eaten = [];
  let nearestSurvivor = Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4;
      if (snapshot[i] === PAINT_IDS.grey) continue;         // was empty already
      const ring = Math.max(Math.abs(col - centreCol), Math.abs(row - centreRow));
      if (data[i] === PAINT_IDS.grey) eaten.push(ring);
      else nearestSurvivor = Math.min(nearestSurvivor, ring);
    }
  }

  assert.equal(eaten.length, 40);
  const furthestEaten = Math.max(...eaten);
  assert.ok(nearestSurvivor >= furthestEaten,
    `a cell ${nearestSurvivor} rings out survived while one ${furthestEaten} rings out was `
    + 'eaten — the hole is not growing outward from the enemy');
  assert.ok(furthestEaten <= 3, `40 cells should come from the near rings, got ${furthestEaten}`);
});

test('a drain never reaches outside its own radius', () => {
  const s = makeSurface();
  const centre = new THREE.Vector3(0, 0, 0);
  s.splat(centre, 'red', 8);

  // Eat everything it can reach: 1.6 m is 6.4 cells at 4 cells/m.
  const eaten = s.drain(centre, 1.6, 100000);
  assert.ok(eaten > 0);

  assert.equal(s.paintIdAtWorld(new THREE.Vector3(0.5, 0, 0)), PAINT_IDS.grey);
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(1.75, 0, 0)), PAINT_IDS.red,
    'a cell outside the drain radius is a cell it is not touching');
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(0, 0, 6)), PAINT_IDS.red);

  // and a second drain from the same spot finds nothing left to eat
  assert.equal(s.drain(centre, 1.6, 100000), 0);
});

test('drain refuses an unpaintable surface and the edge of the world', () => {
  const gate = makeSurface({ width: 10, height: 10, unpaintable: true });
  assert.equal(gate.drain(new THREE.Vector3(0, 0, 0), 1.6, 100), 0);

  const s = makeSurface();
  s.splat(new THREE.Vector3(0, 0, 0), 'blue', 6);
  const before = painted(s);
  assert.equal(s.drain(new THREE.Vector3(500, 0, 500), 1.6, 100), 0, 'off the surface');
  assert.equal(painted(s), before);

  const grey = makeSurface();
  assert.equal(grey.drain(new THREE.Vector3(0, 0, 0), 1.6, 100), 0, 'nothing painted, nothing eaten');
});

test('the grid tells the GPU to redraw after a drain', () => {
  const s = makeSurface();
  s.splat(new THREE.Vector3(0, 0, 0), 'blue', 3);
  const version = s.map.texture.version;

  assert.ok(s.drain(new THREE.Vector3(0, 0, 0), 1.6, 5) > 0);
  assert.ok(s.map.texture.version > version,
    'a grey write that never reaches the texture is invisible — 0.75 of this shader is the map');
});

test('a player repaint and a drain share one grid without corrupting it', () => {
  const s = makeSurface();
  const centre = new THREE.Vector3(0, 0, 0);

  s.splat(centre, 'blue', 4);
  assert.ok(s.drain(centre, 1.6, 500) > 0);
  assert.equal(s.paintIdAtWorld(centre), PAINT_IDS.grey);

  // the player takes the ground back ...
  s.splat(centre, 'red', 1.4);
  assert.equal(s.paintIdAtWorld(centre), PAINT_IDS.red);
  assert.equal(s.surfaceAtWorld(centre), SURFACE.red);

  // ... and the drain takes it back again. One array, last writer wins: there is
  // no snapshot to go stale, which is the whole reason this cannot corrupt.
  assert.ok(s.drain(centre, 1.6, 500) > 0);
  assert.equal(s.paintIdAtWorld(centre), PAINT_IDS.grey);

  assert.equal(s.map.data.length, s.map.cols * s.map.rows * 4);
  assert.equal(s.map.data instanceof Uint8Array, true);
});

// --- the behaviour: when a Drainer feeds -------------------------------

test('a feeding Drainer eats the grid under it at the configured rate', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 5);
  const before = painted(s);

  const far = apart(drainer, 25);
  assert.equal(drainer.feeding, true, 'a Drainer starts face down in the paint');

  run(drainer, 180, far);            // 3 s

  const eaten = before - painted(s);
  const expected = ENEMY.drainer.drainRate * 3;   // 48 cells = 3 m² at 4 cells/m
  assert.ok(eaten >= expected - 2 && eaten <= expected,
    `${eaten} cells in 3 s is not the configured ${expected} (drainRate ${ENEMY.drainer.drainRate}/s)`);

  // where it stands is eaten first...
  assert.equal(s.paintIdAtWorld(drainer.position), PAINT_IDS.grey);
  // ...and the rest of the patch is untouched, because it is not touching it
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(drainer.position.x, 0, drainer.position.z + 3)),
    PAINT_IDS.blue, 'the drain has to stay inside drainRadius');
});

test('a feeding Drainer holds its position instead of chasing', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 2);
  const start = drainer.position.clone();

  run(drainer, 120, apart(drainer, 25));

  assert.ok(drainer.position.distanceTo(start) < 1e-9,
    `it walked ${drainer.position.distanceTo(start)} m while feeding — catching it feeding is the counterplay`);
  assert.ok(drainer._vel.length() < 1e-9);
});

test('the feed stops inside huntRadius and only resumes past resumeRadius', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 8);

  run(drainer, 30, apart(drainer, 25));
  assert.equal(drainer.feeding, true);

  // the player closes to 5 m
  run(drainer, 2, apart(drainer, 5));
  assert.equal(drainer.feeding, false, 'inside 8 m it must stand up');

  const frozen = painted(s);
  run(drainer, 60, apart(drainer, 5));
  assert.equal(painted(s), frozen, 'a hunting Drainer must not still be eating');

  // 12 m is inside the hysteresis band: still up, still not eating
  run(drainer, 60, apart(drainer, 12));
  assert.equal(drainer.feeding, false, '13 m is not far enough to lie back down');
  assert.equal(painted(s), frozen);

  // past 14 m it goes back down
  run(drainer, 60, apart(drainer, 16));
  assert.equal(drainer.feeding, true, 'past 14 m it returns to feeding');
  assert.ok(painted(s) < frozen, 'and it eats again');
});

test('a Drainer already feeding ignores the player at 12 m', () => {
  // The same band, seen from the other side: standing up needs 8 m, so a player
  // who approaches to 12 m must NOT interrupt the feed. One threshold in place
  // of two would fail one of these two tests.
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 6);
  const before = painted(s);

  run(drainer, 60, apart(drainer, 12));

  assert.equal(drainer.feeding, true);
  assert.ok(painted(s) < before, 'it should still be eating at 12 m');
});

test('killing a Drainer stops the shrinking where it stood', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 3);
  const before = painted(s);

  // It has to be MID-MEAL when it dies, or "it stopped" is a test of nothing.
  run(drainer, 60, apart(drainer, 25));
  const atDeath = painted(s);
  assert.ok(atDeath < before, 'the Drainer never started eating, so it cannot have stopped');

  // still food out at the edge of its reach that it had not got to yet
  const lastBite = new THREE.Vector3(drainer.position.x + 1.2, 0, drainer.position.z);
  assert.equal(s.paintIdAtWorld(lastBite), PAINT_IDS.blue);

  drainer.takeColourHit(PAINT_IDS.blue, 999);
  assert.equal(drainer.alive, false);

  run(drainer, 180, apart(drainer, 25));

  assert.equal(painted(s), atDeath, 'a dead Drainer keeps eating');
  assert.equal(s.paintIdAtWorld(lastBite), PAINT_IDS.blue,
    'the shrinking stops where it stood — it does not finish the patch from beyond the grave');
});

test('the feeding posture folds down, and hunting stands it back up', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(drainer.position, 'blue', 2);

  // Every Node test runs without a GLB, so the gait has no model to pose. A
  // stand-in with the two fields `_gait` writes is enough to pin the posture.
  drainer._model = { position: { y: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  drainer._feetOffset = 0;

  drainer.update(1 / 60, apart(drainer, 25));
  const feedingLean = drainer._model.rotation.x;
  const feedingY = drainer._model.position.y;

  drainer.update(1 / 60, apart(drainer, 5));
  assert.equal(drainer.feeding, false);
  assert.ok(feedingLean > 0.3, `a feeding Drainer should fold forward, lean was ${feedingLean}`);
  assert.ok(drainer._model.rotation.x < feedingLean, 'it must visibly stand up');
  assert.ok(drainer._model.position.y > feedingY, 'and rise out of the crouch');
});

// --- scope: nothing else eats, and nothing eats without ground -------------

test('only the Drainer has a drain configured', () => {
  const { drainer } = ENEMY;
  assert.ok(drainer.drainRadius > 0);
  assert.ok(drainer.drainRate > 0);
  assert.ok(drainer.huntRadius < drainer.resumeRadius,
    'equal thresholds would flip the posture every frame on the boundary');

  for (const [name, cfg] of Object.entries(ENEMY)) {
    if (name === 'drainer') continue;
    assert.equal(cfg.drainsPaint, false, `${name} must not eat painted ground`);
    assert.equal('drainRadius' in cfg, false, `${name} should not carry drain tuning`);
  }
});

test('a non-drainer enemy on painted ground eats nothing', () => {
  const s = makeSurface();
  const sprayer = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY.sprayer,
    parent: new THREE.Group(),
    floors: [s],
  });
  s.splat(sprayer.position, 'blue', 4);
  const before = painted(s);

  assert.equal(sprayer.feeding, false, 'the flag is what gates the behaviour, not the name');
  run(sprayer, 120, apart(sprayer, 25));
  assert.equal(painted(s), before);
});

test('a Drainer with no floor under it holds rather than throwing', () => {
  const s = makeSurface();
  const drainer = makeDrainer(s);
  s.splat(new THREE.Vector3(0, 0, 0), 'blue', 4);
  const before = painted(s);

  // It eats on the floor that IS there, so the half below means something.
  run(drainer, 30, apart(drainer, 25));
  const eatenOnFloor = painted(s);
  assert.ok(eatenOnFloor < before, 'the floor half of this test has to actually eat');

  drainer.position.set(0, 0, 500);        // parked in the void

  assert.doesNotThrow(() => run(drainer, 60, apart(drainer, 25)));
  assert.equal(painted(s), eatenOnFloor, 'it ate a surface it is not standing on');
  assert.ok(Number.isFinite(drainer.position.y));

  // a non-Vector3 player argument must not produce NaN distance either
  assert.doesNotThrow(() => run(drainer, 5, { position: null }));
});
