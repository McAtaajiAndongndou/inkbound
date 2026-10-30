import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { separateEnemies } from '../src/enemies/separation.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { BLUE_FREEZE, ENEMY, ENEMY_BODY, ENEMY_SEPARATION, PAINT_IDS } from '../src/config.js';

/**
 * #187 — enemies push each other apart. Real enemies (box fallback, no GLB) on
 * real PaintSurface floors, so `nudge` runs the same step rules the chase does.
 */

const FRAME = 1 / 60;
const PAIR = ENEMY_BODY.radius * 2;            // 0.8 m between two soldiers

function makeFloor({ width = 40, depth = 40, x = 0 } = {}) {
  const s = new PaintSurface({ width, height: depth, cells: 2 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.x = x;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

/** A wall panel in the plane x = 0, facing +X. */
function makeWall() {
  const s = new PaintSurface({ width: 20, height: 4, cells: 2 });
  s.mesh.rotation.y = Math.PI / 2;
  s.mesh.position.set(0, 2, 0);
  s.mesh.updateMatrixWorld(true);
  return s;
}

function spawn(x, z, { config = ENEMY.charger, floors, walls = [], parent = new THREE.Group() } = {}) {
  return new Enemy({
    position: new THREE.Vector3(x, 0, z),
    config,
    parent,
    floors,
    walls,
    blockers: [],
  });
}

function flat(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
}

function closestPair(enemies) {
  let min = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) min = Math.min(min, flat(enemies[i], enemies[j]));
  }
  return min;
}

test('the separation tuning lives in config (#187)', () => {
  assert.equal(ENEMY_SEPARATION.heightTolerance, 1.2);
});

test('two enemies at the same point end at least 0.8 m apart, deterministically (#187)', () => {
  const results = [];
  for (let run = 0; run < 2; run++) {
    const floors = [makeFloor()];
    const a = spawn(0, 0, { floors });
    const b = spawn(0, 0, { floors });
    for (let i = 0; i < 5; i++) separateEnemies([a, b]);
    assert.ok(flat(a, b) >= PAIR - 1e-9, `still ${flat(a, b).toFixed(3)} m apart`);
    assert.ok(a.position.x > b.position.x, 'the lower roster index goes +x');
    results.push([a.position.x, a.position.z, b.position.x, b.position.z]);
  }
  assert.deepEqual(results[0], results[1], 'the split must be the same every run');
});

test('five Chargers chasing a still player from one direction spread out (#187)', () => {
  const floors = [makeFloor()];
  const parent = new THREE.Group();
  const pack = [];
  // One direction, staggered 0.1 m sideways as any real spawn is. (A column
  // that is exactly collinear has no sideways component to split along, and
  // one pass a frame leaves it ~0.73 m apart; still five bodies, not one.)
  for (let k = 0; k < 5; k++) pack.push(spawn((k - 2) * 0.1, -10 - k * 0.5, { floors, parent }));
  for (const c of pack) c.wake();
  const player = new THREE.Vector3(0, 0, 0);
  for (let f = 0; f < 600; f++) {
    for (const c of pack) c.update(FRAME, player);
    separateEnemies(pack);
  }
  const min = closestPair(pack);
  assert.ok(min >= 0.75, `two Chargers ended ${min.toFixed(3)} m apart`);
  // ...and they spread sideways into a crescent rather than queueing.
  const xs = pack.map((c) => c.position.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1.0, 'the pack stayed a single column');
});

test('a frozen enemy is not moved; the walker takes the full overlap (#187)', () => {
  const floors = [makeFloor()];
  const ice = spawn(0, 0, { floors });
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) ice.takeColourHit(PAINT_IDS.blue, 0);
  assert.equal(ice.immovable, true, 'the freeze must have taken');
  const walker = spawn(0.5, 0, { floors });
  const iceAt = ice.position.clone();

  separateEnemies([ice, walker]);
  assert.ok(ice.position.distanceTo(iceAt) < 1e-12, 'the block of ice moved');
  assert.ok(Math.abs(walker.position.x - PAIR) < 1e-9, `walker at ${walker.position.x}, want ${PAIR}`);
});

test('pinned, sleeping and Big Arm bodies are immovable; a plain one is not (#187)', () => {
  const floors = [makeFloor()];
  const pinned = spawn(0, 0, { floors });
  pinned.takeColourHit(PAINT_IDS.green, 0);
  assert.equal(pinned.immovable, true, 'pinned');
  const asleep = new Enemy({ position: new THREE.Vector3(), config: ENEMY.charger, parent: new THREE.Group(), floors, sleeping: true });
  assert.equal(asleep.immovable, true, 'sleeping');
  const plain = spawn(0, 0, { floors });
  assert.equal(plain.immovable, false);
  assert.equal(plain.bodyRadius, ENEMY_BODY.radius);
  assert.equal(spawn(0, 0, { floors, config: ENEMY.bigArm }).bodyRadius, ENEMY.bigArm.bodyRadius);

  // Two immovables are left as they are.
  const asleep2 = new Enemy({ position: new THREE.Vector3(0.2, 0, 0), config: ENEMY.charger, parent: new THREE.Group(), floors, sleeping: true });
  separateEnemies([asleep, asleep2]);
  assert.equal(asleep.position.x, 0);
  assert.equal(asleep2.position.x, 0.2);
});

test('a push never moves an enemy through a wall panel (#187)', () => {
  // A leans on the wall's +X face; B overlaps it from the open side.
  const floors = [makeFloor()];
  const walls = [makeWall()];
  const a = spawn(ENEMY_BODY.radius + 0.05, 0, { floors, walls });
  const b = spawn(ENEMY_BODY.radius + 0.35, 0, { floors, walls });
  for (let i = 0; i < 30; i++) {
    separateEnemies([a, b]);
    assert.ok(a.position.x > ENEMY_BODY.radius, `frame ${i}: A was shoved into the wall (x = ${a.position.x})`);
  }
  assert.ok(flat(a, b) >= PAIR - 1e-6, 'B took the push the wall refused A');
});

test('a push never moves an enemy off its floor (#187)', () => {
  // An island x in -5..5; two enemies overlapping at its +X edge.
  const floors = [makeFloor({ width: 10, depth: 10 })];
  const a = spawn(4.9, 0, { floors });
  const b = spawn(4.6, 0, { floors });
  for (let i = 0; i < 30; i++) separateEnemies([a, b]);
  for (const e of [a, b]) {
    assert.ok(e.position.x <= 5 + 1e-9, `an enemy was pushed off the island to x = ${e.position.x}`);
    assert.equal(e.position.y, 0);
  }
});

test('the dead, and crawlers on a face, are ignored; a storey apart does not touch (#187)', () => {
  const floors = [makeFloor()];
  const dead = spawn(0, 0, { floors });
  dead.takeColourHit(PAINT_IDS.blue, 999);
  assert.equal(dead.alive, false);
  const live = spawn(0.1, 0, { floors });
  separateEnemies([dead, live]);
  assert.equal(live.position.x, 0.1, 'a corpse pushed a live enemy');

  const crawler = spawn(0, 0, { floors, config: ENEMY.wallCrawler });
  crawler._climbing = true;                 // stand-in: holding a face
  const other = spawn(0.1, 0, { floors });
  separateEnemies([crawler, other]);
  assert.equal(other.position.x, 0.1, 'a crawler on a face pushed');

  const low = spawn(0, 0, { floors });
  const high = spawn(0.1, 0, { floors });
  high.position.y = 2;
  separateEnemies([low, high]);
  assert.equal(low.position.x, 0);
  assert.equal(high.position.x, 0.1);
});

test('separateEnemies allocates nothing per frame (#187)', async () => {
  const floors = [makeFloor()];
  const walls = [makeWall()];
  const crowd = [];
  for (let k = 0; k < 30; k++) crowd.push(spawn(1 + (k % 6) * 0.3, (Math.floor(k / 6)) * 0.3, { floors, walls }));
  const home = crowd.map((e) => e.position.clone());
  const run = (n) => {
    for (let f = 0; f < n; f++) {
      for (let k = 0; k < crowd.length; k++) crowd[k].position.copy(home[k]);
      separateEnemies(crowd);
    }
  };
  run(2000);

  const session = new Session();
  session.connect();
  await session.post('HeapProfiler.startSampling', { samplingInterval: 256 });
  const FRAMES = 2000;
  run(FRAMES);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();

  let bytes = 0;
  (function walk(node) {
    const url = node.callFrame.url;
    if (url.endsWith('/enemies/separation.js') || url.endsWith('/enemies/enemy.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 24, `separation allocated ${perFrame.toFixed(1)} bytes/frame`);
});
