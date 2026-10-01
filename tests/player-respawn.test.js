import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { Level01 } from '../src/levels/level-01-mission.js';

async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  return level;
}

test('player starts at the level spawn', async () => {
  const level = await buildLevel();
  const player = new Player(level.surfaces, level.spawn);
  assert.deepEqual(player.position.toArray(), level.spawn.toArray());
});

test('respawn lands at the level spawn, not a hardcoded point', async () => {
  const level = await buildLevel();
  const player = new Player(level.surfaces, level.spawn);

  player.position.set(5, -50, -5);
  player.velocity.set(1, -30, 1);
  player.respawn();

  assert.deepEqual(player.position.toArray(), level.spawn.toArray());
  assert.deepEqual(player.velocity.toArray(), [0, 0, 0]);
});

test('respawn follows whatever spawn the level provides', () => {
  const spawn = new THREE.Vector3(3, 7, -2);
  const player = new Player([], spawn);
  player.position.set(0, -100, 0);
  player.respawn();
  assert.deepEqual(player.position.toArray(), [3, 7, -2]);
});

test('player keeps its own copy of the spawn (moving it does not move the level spawn)', () => {
  const spawn = new THREE.Vector3(1, 2, 3);
  const player = new Player([], spawn);
  player.position.x += 10;
  player.spawn.x += 10;
  assert.deepEqual(spawn.toArray(), [1, 2, 3]);
});
