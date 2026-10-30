import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy, PLAYER_SIGNAL, resetPlayerSignal } from '../src/enemies/enemy.js';
import { EnemyShots, segmentToAxis } from '../src/enemies/enemy-shots.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, ENEMY_SHOT, PAINT_IDS, PLAYER } from '../src/config.js';

/**
 * #185 — ranged enemies fire pellets (DECISIONS 2026-10-30 "Enemy shots are
 * pellets"). A pellet flies, can be dodged, is stopped by walls and greys where
 * it lands. `onAttack` fires when one TOUCHES the player — main.js wires that to
 * `takeDamage`, so "onAttack calls" here are "hits the player took".
 *
 * No browser and no GLB: the enemy falls back to its box, and the pellets fly
 * against real PaintSurface meshes.
 */

const FRAME = 1 / 60;

function makeFloor() {
  const s = new PaintSurface({ width: 40, height: 40, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  s.splat(new THREE.Vector3(0, 0, 0), 'blue', 30);   // all of it: grey is observable
  return s;
}

/** An upright wall at z = `z`, facing -Z (toward a shooter at negative z... or
 *  at the origin, with the player beyond it). */
function makeWall(z) {
  const s = new PaintSurface({ width: 20, height: 4, cells: 4 });
  s.mesh.rotation.y = Math.PI;
  s.mesh.position.set(0, 2, z);
  s.mesh.updateMatrixWorld(true);
  s.splat(new THREE.Vector3(0, 1.1, z), 'blue', 3);
  return s;
}

/** A shooter at the origin and a player `dist` m down +Z, on painted ground. */
function scenario({ config = ENEMY.sprayer, dist = 10, walls = [] } = {}) {
  const floor = makeFloor();
  const parent = new THREE.Group();
  const enemy = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config,
    parent,
    floors: [floor],
    surfaces: [floor, ...walls],
    blockers: [],   // the sight line is not under test: the pellet is
  });
  enemy._shots.random = () => 0.5;   // no spread: these tests are about the flight
  const player = new THREE.Vector3(0, 0, dist);
  const hits = [];
  enemy.onAttack = (e) => hits.push(e.config.attackDamage);
  return { floor, enemy, player, hits, pool: enemy._shots, parent };
}

function run(enemy, player, frames) {
  for (let i = 0; i < frames; i++) enemy.update(FRAME, player);
}

/** Step until a pellet is in the air. Returns the frame count, or -1. */
function untilFired(enemy, player, max = 200) {
  for (let i = 1; i <= max; i++) {
    enemy.update(FRAME, player);
    if (enemy._shots.activeCount > 0) return i;
  }
  return -1;
}

function greyCount(surface) {
  let n = 0;
  const { data } = surface.map;
  for (let i = 0; i < data.length; i += 4) if (data[i] === PAINT_IDS.grey) n++;
  return n;
}

test('ranged enemies carry a shot speed; melee enemies do not (#185)', () => {
  assert.equal(ENEMY.sprayer.shotSpeed, 22);
  assert.equal(ENEMY.wallCrawler.shotSpeed, 22);
  assert.equal(ENEMY.turret.shotSpeed, 30);
  for (const type of ['charger', 'drainer', 'bigArm']) {
    assert.equal(ENEMY[type].shotSpeed, undefined, `${type} is melee: no pellets`);
  }
  assert.equal(ENEMY_SHOT.radius, 0.15);
  assert.equal(ENEMY_SHOT.rangeFactor, 1.5);
});

test("a Sprayer's burst at a standing player 10 m away lands, once per pellet (#185)", () => {
  const { enemy, player, hits } = scenario();
  run(enemy, player, Math.ceil((ENEMY.sprayer.windup + 1.0) / FRAME));
  assert.equal(hits.length, ENEMY.sprayer.burst,
    `a standing player should take every pellet of the burst, took ${hits.length}`);
  assert.ok(hits.every((d) => d === ENEMY.sprayer.attackDamage));
});

test('the damage arrives on contact, after the flight — not when the wind-up ends (#185)', () => {
  const { enemy, player, hits } = scenario();
  assert.ok(untilFired(enemy, player) > 0, 'the Sprayer never fired');
  assert.equal(hits.length, 0, 'the pellet has not reached the player yet');
  // 10 m at 22 m/s: 0.45 s in the air.
  run(enemy, player, Math.ceil(0.5 / FRAME));
  assert.ok(hits.length >= 1, 'the first pellet should have landed by now');
});

test('a player who steps 1.5 m sideways during the flight is not hit, and the ground takes the grey (#185)', () => {
  const single = { ...ENEMY.sprayer, burst: 1 };
  const { enemy, player, hits, floor } = scenario({ config: single });
  const before = greyCount(floor);

  assert.ok(untilFired(enemy, player) > 0, 'the Sprayer never fired');
  player.x += 1.5;                       // the sidestep, the moment it fires
  run(enemy, player, Math.ceil(1.2 / FRAME));

  assert.equal(hits.length, 0, 'a sidestepped pellet must miss');
  assert.ok(greyCount(floor) > before, 'a miss still costs ground: where it landed is grey');
  assert.equal(floor.paintIdAtWorld(new THREE.Vector3(1.5, 0, 10)), PAINT_IDS.blue,
    'the grey is where the pellet landed, not under the player who dodged it');
});

test('a wall between the Sprayer and the player stops the pellet: no damage, the wall greys (#185)', () => {
  const wall = makeWall(5);
  const { enemy, player, hits, floor } = scenario({ walls: [wall] });
  const floorBefore = greyCount(floor);

  run(enemy, player, Math.ceil((ENEMY.sprayer.windup + 1.0) / FRAME));

  assert.equal(hits.length, 0, 'cover must stop the shot');
  assert.equal(wall.paintIdAtWorld(new THREE.Vector3(0, 1.1, 5)), PAINT_IDS.grey,
    'the wall is what the pellet reached, so the wall is what greys');
  assert.equal(greyCount(floor), floorBefore, 'nothing behind the wall is touched');
});

test("a Turret's pellet hits a submerged player in range, and greys nothing (#185)", () => {
  resetPlayerSignal();
  PLAYER_SIGNAL.submerged = true;
  try {
    const { enemy, player, hits, floor } = scenario({ config: ENEMY.turret, dist: 12 });
    const before = greyCount(floor);
    run(enemy, player, Math.ceil((ENEMY.turret.windup + 0.8) / FRAME));
    assert.ok(hits.length >= 1, 'a turret ignores stealth: the submerged player is hit');
    assert.ok(hits.every((d) => d === ENEMY.turret.attackDamage));
    assert.equal(greyCount(floor), before, 'turrets leave the ground alone');
  } finally {
    resetPlayerSignal();
  }
});

test('a fast pellet cannot tunnel through the player between two frames (#185)', () => {
  // 30 m/s is 0.5 m a frame, more than the player's radius: only a swept test
  // catches it. Stand the player exactly where a frame boundary would skip.
  const a = new THREE.Vector3(0, 1, 0);
  const seg = new THREE.Vector3(0, 0, 0.5);
  const feet = new THREE.Vector3(0.3, 0, 0.25);    // the axis sits between the two ends
  const t = segmentToAxis(a, seg, feet, PLAYER.height, PLAYER.radius + ENEMY_SHOT.radius);
  assert.ok(t >= 0 && t <= 1, `the swept test must find the hit, got ${t}`);

  const wide = new THREE.Vector3(1.0, 0, 0.25);    // 1 m off the line: a clean miss
  assert.equal(segmentToAxis(a, seg, wide, PLAYER.height, PLAYER.radius + ENEMY_SHOT.radius), -1);

  const over = new THREE.Vector3(0, -3, 0.25);     // the player is 3 m below the flight
  assert.equal(segmentToAxis(a, seg, over, PLAYER.height, PLAYER.radius + ENEMY_SHOT.radius), -1);
});

test('a pinned Sprayer still fires pellets (#185, algorithms.md)', () => {
  const { enemy, player, hits } = scenario({ dist: 6 });
  assert.equal(enemy.takeColourHit(PAINT_IDS.green, 0), true);
  const rooted = enemy.position.clone();
  run(enemy, player, Math.ceil((ENEMY.sprayer.windup + 0.6) / FRAME));
  assert.equal(hits.length, ENEMY.sprayer.burst, `a pinned Sprayer landed ${hits.length} pellets`);
  assert.ok(enemy.position.distanceTo(rooted) < 1e-9, 'the pin still roots it');
});

test('a dead Sprayer\'s pellets already in the air keep flying (#185)', () => {
  const single = { ...ENEMY.sprayer, burst: 1 };
  const { enemy, player, hits } = scenario({ config: single });
  assert.ok(untilFired(enemy, player) > 0);
  enemy.takeColourHit(PAINT_IDS.blue, 999);
  assert.equal(enemy.alive, false);
  run(enemy, player, Math.ceil(0.6 / FRAME));
  assert.equal(hits.length, 1, 'the shot was fired before it died: it still lands');
});

test('one pool per level, shared; 100 bursts allocate no pellets (#185)', () => {
  const { enemy, player, pool, parent } = scenario({ dist: 6 });
  const second = new Enemy({
    position: new THREE.Vector3(3, 0, 0),
    config: ENEMY.sprayer,
    parent,
    floors: [],
    blockers: [],
  });
  assert.equal(second._shots, pool, 'both enemies of a level share one pool');
  const charger = new Enemy({ position: new THREE.Vector3(), config: ENEMY.charger, parent, floors: [] });
  assert.equal(charger._shots, null, 'melee enemies never touch the pool');

  const size = pool.pellets.length;
  const meshes = pool.group.children.length;
  const first = pool.pellets[0];
  // A burst every 0.6 s wind-up + 0.36 s burst + 1.2 s reload ≈ 2.2 s.
  run(enemy, player, Math.ceil(100 * 2.3 / FRAME));
  assert.equal(pool.pellets.length, size, 'the pool grew');
  assert.equal(pool.group.children.length, meshes, 'a pellet mesh was added after construction');
  assert.equal(pool.pellets[0], first, 'pellets are reused, not replaced');
  assert.equal(size, ENEMY_SHOT.poolSize);
});

test('pellets read no light, and the pool is freed with its last enemy (#185)', () => {
  const { enemy, pool, parent } = scenario();
  pool.group.traverse((obj) => {
    if (obj.material) assert.ok(obj.material.isMeshBasicMaterial,
      'a custom-lit pellet would need the light-direction pass (AGENTS rule 5)');
  });
  assert.ok(parent.children.includes(pool.group), 'the pellets live under the level root');
  enemy.dispose();
  assert.equal(pool.disposed, true, 'the last enemy out frees the pool');
  assert.equal(parent.children.includes(pool.group), false);
  assert.notEqual(EnemyShots.for(parent), pool, 'a disposed pool is never handed out again');
});
