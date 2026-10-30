import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { ENEMY, ENEMY_BODY, HEALTH, PLAYER } from '../src/config.js';

/**
 * #186 — enemies are solid to the player. The player is pushed out along the
 * line between centres; the enemy is not moved. Stand-in enemies: the player
 * only reads position, config, alive and climbing.
 */

const FRAME = 1 / 60;
const SOLDIER = PLAYER.radius + ENEMY_BODY.radius;          // 0.8 m

function makeFloor() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);
  const rules = { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 1.0 };
  return {
    mesh, width: 200, height: 200, isFloor: true,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => 1,
    isPlayerPaintAtWorld: () => true,
    splat: () => {},
  };
}

/** A wall in the plane x = 0, its face toward +X. */
function makeWall() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), new THREE.MeshBasicMaterial());
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(0, 3, 0);
  mesh.updateMatrixWorld(true);
  const rules = { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 1.0 };
  return {
    mesh, width: 20, height: 6, isFloor: false,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => 0,
    isPlayerPaintAtWorld: () => false,
    splat: () => {},
  };
}

function enemy(x, y, z, { config = ENEMY.charger, alive = true, sleeping = false, climbing = false } = {}) {
  return { position: new THREE.Vector3(x, y, z), config, alive, sleeping, climbing };
}

const W = { isDown: (code) => code === 'KeyW', aiming: false };
const IDLE = { isDown: () => false, aiming: false };
const ACTIONS = { jump: false };

/** One game frame, in main.js's order: player, (level), bodies, contact. */
function frame(player, enemies, input = W) {
  player.update(FRAME, input, ACTIONS);
  player.resolveEnemyBodies(enemies);
  player.checkEnemyContact(enemies);
}

function flatDist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test('ENEMY_BODY lives in config, and Big Arm is the bigger body (#186)', () => {
  assert.equal(ENEMY_BODY.radius, 0.4);
  assert.equal(ENEMY_BODY.chest, 0.9);
  assert.equal(ENEMY.bigArm.bodyRadius, 0.6);
});

test('walking into a standing enemy stops the player 0.8 m from its centre, from any direction (#186)', () => {
  for (let k = 0; k < 8; k++) {
    const yaw = (k / 8) * Math.PI * 2;
    // _fwd = (-sin yaw, 0, -cos yaw): put the enemy 3 m ahead.
    const e = enemy(-Math.sin(yaw) * 3, 0, -Math.cos(yaw) * 3);
    const p = new Player([makeFloor()], new THREE.Vector3(0, 0, 0));
    p.yaw = yaw;
    for (let i = 0; i < 120; i++) frame(p, [e]);
    const d = flatDist(p.position, e.position);
    assert.ok(Math.abs(d - SOLDIER) <= 0.05, `heading ${k}/8: stopped ${d.toFixed(3)} m away, want 0.8`);
  }
});

test('holding W into an enemy for 2 s never gets inside 0.8 m, or through it (#186)', () => {
  const e = enemy(0, 0, -3);
  const p = new Player([makeFloor()], new THREE.Vector3(0, 0, 0));
  p.yaw = 0;
  for (let i = 0; i < 120; i++) {
    frame(p, [e]);
    assert.ok(flatDist(p.position, e.position) >= SOLDIER - 1e-6, `frame ${i}: inside the body`);
    assert.ok(p.position.z > e.position.z, `frame ${i}: walked through to the other side`);
  }
});

test('a Big Arm stops the player at 1.0 m, and pressing on it hurts (#186)', () => {
  const boss = enemy(0, 0, -3, { config: ENEMY.bigArm });
  const p = new Player([makeFloor()], new THREE.Vector3(0, 0, 0));
  p.yaw = 0;
  for (let i = 0; i < 120; i++) frame(p, [boss]);
  const d = flatDist(p.position, boss.position);
  assert.ok(Math.abs(d - 1.0) <= 0.05, `stopped ${d.toFixed(3)} m from Big Arm, want 1.0`);
  assert.ok(p.health <= HEALTH.max - ENEMY.bigArm.contactDamage,
    `pressed against Big Arm, health is ${p.health}`);
});

test('the touch range grows with the body, and is unchanged for soldiers (#186)', () => {
  // Exactly at the push-out distance, plus float noise outward.
  const p = new Player([], new THREE.Vector3(0, 0, 0));
  p.checkEnemyContact([enemy(0, 0, -(1.0 + 1e-9), { config: ENEMY.bigArm })]);
  assert.equal(p.health, HEALTH.max - ENEMY.bigArm.contactDamage, 'Big Arm at 1.0 m must hurt');

  const q = new Player([], new THREE.Vector3(0, 0, 0));
  q.checkEnemyContact([enemy(0, 0, -1.1)]);
  assert.equal(q.health, HEALTH.max, 'a soldier at 1.1 m is still out of touch (contactRange 1.0)');
});

test('a dead enemy is not solid; a sleeping one is (#186)', () => {
  const p = new Player([makeFloor()], new THREE.Vector3(0, 0, 0));
  p.resolveEnemyBodies([enemy(0, 0, -0.3, { alive: false })]);
  assert.equal(p.position.z, 0, 'a corpse pushed the player');

  p.resolveEnemyBodies([enemy(0, 0, -0.3, { sleeping: true })]);
  assert.ok(Math.abs(p.position.z - (-0.3 + SOLDIER)) < 1e-9, 'a dormant guard is still standing there');
});

test('a crawler on a face is not solid (#186)', () => {
  const p = new Player([], new THREE.Vector3(0, 0, 0));
  p.resolveEnemyBodies([enemy(0, 0, -0.3, { config: ENEMY.wallCrawler, climbing: true })]);
  assert.equal(p.position.z, 0);
});

test('an enemy 2 m below the player does not push them (#186)', () => {
  const p = new Player([], new THREE.Vector3(0, 2, 0));
  p.resolveEnemyBodies([enemy(0, 0, -0.3)]);
  assert.equal(p.position.z, 0);
});

test('exactly on top: the player backs out the way they came (#186)', () => {
  const p = new Player([], new THREE.Vector3(0, 0, 0));
  p.yaw = 0;                       // facing -Z
  p.resolveEnemyBodies([enemy(0, 0, 0)]);
  assert.ok(Math.abs(p.position.z - SOLDIER) < 1e-9 && Math.abs(p.position.x) < 1e-9,
    `pushed to (${p.position.x}, ${p.position.z}), want (0, 0.8)`);
});

test('an enemy beside a wall cannot push the player into it (#186)', () => {
  // Wall in the plane x = 0; the player leans on it at x = 0.4; an enemy
  // shoulders in from +X, slightly off-line.
  const wall = makeWall();
  const p = new Player([makeFloor(), wall], new THREE.Vector3(PLAYER.radius, 0, 0.1));
  const e = enemy(0.9, 0, 0);
  for (let i = 0; i < 60; i++) {
    frame(p, [e], IDLE);
    assert.ok(p.position.x >= PLAYER.radius - 1e-6, `frame ${i}: pushed into the wall (x = ${p.position.x})`);
  }
  assert.ok(flatDist(p.position, e.position) >= SOLDIER - 0.01,
    `settled ${flatDist(p.position, e.position).toFixed(3)} m from the enemy: still inside it`);
});

test('pressed against a Charger, contact damage still lands (#186)', () => {
  const e = enemy(0, 0, -3, { config: ENEMY.charger });
  const p = new Player([makeFloor()], new THREE.Vector3(0, 0, 0));
  p.yaw = 0;
  for (let i = 0; i < 120; i++) frame(p, [e]);
  assert.ok(p.health < HEALTH.max, 'the push-out must keep you inside contactRange');
});

test('resolveEnemyBodies allocates nothing per frame (#186)', async () => {
  const p = new Player([makeFloor(), makeWall()], new THREE.Vector3(1, 0, 0));
  const enemies = [];
  for (let i = 0; i < 20; i++) enemies.push(enemy(1 + (i % 5) * 0.3, 0, Math.floor(i / 5) * 0.3));
  const run = (n) => {
    for (let i = 0; i < n; i++) {
      p.position.set(1.2, 0, 0.4);
      p.resolveEnemyBodies(enemies);
    }
  };
  run(20000);

  const session = new Session();
  session.connect();
  await session.post('HeapProfiler.startSampling', { samplingInterval: 256 });
  const FRAMES = 20000;
  run(FRAMES);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();

  let bytes = 0;
  (function walk(node) {
    if (node.callFrame.url.endsWith('/core/player.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);
  // Same yardstick as player-alloc.test.js: the walls re-run still uses for...of.
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 24, `resolveEnemyBodies allocated ${perFrame.toFixed(1)} bytes/frame`);
});
