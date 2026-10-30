// #220 (QA B1): a Wall-crawler shot the player through the floor. Floors are
// one-sided planes facing up, and three.js raycasts honour that, so a ray from
// BELOW passed through. Pellets now stop at a floor's underside, and a
// climber's sight line is blocked by floors (tested two-sided).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY } from '../src/config.js';

const FRAME = 1 / 60;

/** A floor at height `y`, centred on (x, z), facing up. */
function floor({ y = 0, x = 0, z = 0, w = 40, d = 40 } = {}) {
  const s = new PaintSurface({ width: w, height: d, cells: 2 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(x, y, z);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

// The ground, and a deck 4 m up spanning z 5..15 — the player stands on it.
function scene(config, at) {
  const ground = floor();
  const deck = floor({ y: 4, z: 10, w: 10, d: 10 });
  const enemy = new Enemy({
    position: at,
    config,
    parent: new THREE.Group(),
    floors: [ground, deck],
    surfaces: [ground, deck],
    blockers: [],
  });
  if (enemy._shots) enemy._shots.random = () => 0.5;
  return { enemy, ground, deck };
}

test('#220: a crawler directly under the deck cannot see the player standing on it', () => {
  const { enemy } = scene(ENEMY.wallCrawler, new THREE.Vector3(0, 0, 10));
  assert.equal(enemy._canSee(new THREE.Vector3(0, 4, 10)), false);
});

test('#220: a crawler with a clear line still sees the player', () => {
  const { enemy } = scene(ENEMY.wallCrawler, new THREE.Vector3(0, 0, 10));
  assert.equal(enemy._canSee(new THREE.Vector3(0, 0, 22)), true, 'same ground, past the deck');
  assert.equal(enemy._canSee(new THREE.Vector3(0, 4, 6)) || enemy._canSee(new THREE.Vector3(0, 4, 14)), false,
    'anywhere on the deck above it stays hidden');
});

test('#220: a pellet from below the deck stops at its underside — no hit, and no grey on top', () => {
  // A Sprayer (not a climber: its sight ignores floors, as tuned) off the deck's
  // end, shooting up at a player standing on it. The shot line crosses the deck
  // 2.6 m short of the player.
  const { enemy, deck } = scene(ENEMY.sprayer, new THREE.Vector3(0, 0, 2));
  const player = new THREE.Vector3(0, 4, 12);
  deck.splat(player, 'blue', 6);
  const before = deck.map.data.slice();
  let hits = 0;
  enemy.onAttack = () => hits++;
  enemy.wake?.();
  for (let i = 0; i < 60 * 6; i++) enemy.update(FRAME, player);
  assert.ok(enemy._shots.fired ?? true);
  assert.equal(hits, 0, 'the deck stopped every pellet');
  assert.deepEqual(deck.map.data, before, 'nothing greyed the deck from beneath');
});

test('#220: with no deck in the way, the same shot still lands', () => {
  const ground = floor();
  const enemy = new Enemy({
    position: new THREE.Vector3(0, 0, 2), config: ENEMY.sprayer, parent: new THREE.Group(),
    floors: [ground], surfaces: [ground], blockers: [],
  });
  enemy._shots.random = () => 0.5;
  let hits = 0;
  enemy.onAttack = () => hits++;
  for (let i = 0; i < 60 * 6; i++) enemy.update(FRAME, new THREE.Vector3(0, 0, 12));
  assert.ok(hits > 0, 'the shooter is live: the deck is what stopped it above');
});
