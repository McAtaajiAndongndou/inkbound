import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { HEALTH, ENEMY } from '../src/config.js';

// Enemy is still a stub (#15); these stand in with the fields the player reads.
function fakeEnemy(x, y, z, config = ENEMY.sprayer) {
  return { position: new THREE.Vector3(x, y, z), config };
}

function makePlayer() {
  const p = new Player([]);
  p.position.set(0, 0, 0);
  return p;
}

const noInput = { isDown: () => false };
const noActions = { jump: false };

test('player starts at full health and alive', () => {
  const p = makePlayer();
  assert.equal(p.health, HEALTH.max);
  assert.equal(p.maxHealth, HEALTH.max);
  assert.equal(p.dead, false);
});

test('takeDamage subtracts health and starts the hurt cooldown', () => {
  const p = makePlayer();
  assert.equal(p.takeDamage(30), true);
  assert.equal(p.health, HEALTH.max - 30);
  assert.equal(p.takeDamage(30), false, 'second hit inside the cooldown is ignored');
  assert.equal(p.health, HEALTH.max - 30);
});

test('the cooldown wears off with update(dt)', () => {
  const p = makePlayer();
  p.takeDamage(10);
  p.update(HEALTH.hurtCooldown + 0.01, noInput, noActions);
  assert.equal(p.takeDamage(10), true);
  assert.equal(p.health, HEALTH.max - 20);
});

test('health hitting 0 kills the player exactly once', () => {
  const p = makePlayer();
  let deaths = 0;
  p.onDeath = () => { deaths++; };

  p.takeDamage(HEALTH.max + 50);
  assert.equal(p.health, 0, 'health clamps at 0');
  assert.equal(p.dead, true);
  assert.equal(deaths, 1);

  p.hurtTimer = 0;
  assert.equal(p.takeDamage(10), false, 'dead players take no more damage');
  assert.equal(deaths, 1);
});

test('a dead player is frozen', () => {
  const p = makePlayer();
  p.takeDamage(HEALTH.max);
  const before = p.position.clone();
  p.update(0.5, { isDown: () => true }, { jump: true });
  assert.deepEqual(p.position.toArray(), before.toArray());
});

test('touching an enemy deals its contactDamage', () => {
  const p = makePlayer();
  p.checkEnemyContact([fakeEnemy(HEALTH.contactRange * 0.5, 0.5, 0)]);
  assert.equal(p.health, HEALTH.max - ENEMY.sprayer.contactDamage);
});

test('enemies out of range, or above/below, do nothing', () => {
  const p = makePlayer();
  p.checkEnemyContact([
    fakeEnemy(HEALTH.contactRange + 0.5, 0, 0),
    fakeEnemy(0, HEALTH.contactHeight + 0.5, 0),
  ]);
  assert.equal(p.health, HEALTH.max);
});

test('several enemies touching at once still land only one hit per cooldown', () => {
  const p = makePlayer();
  p.checkEnemyContact([fakeEnemy(0, 0, 0), fakeEnemy(0.2, 0, 0, ENEMY.charger)]);
  assert.equal(p.health, HEALTH.max - ENEMY.sprayer.contactDamage);
});

test('contact ignores enemies that do not expose position/config yet', () => {
  const p = makePlayer();
  assert.doesNotThrow(() => p.checkEnemyContact([{}, { position: new THREE.Vector3() }]));
  assert.equal(p.health, HEALTH.max);
});

test('every enemy type has a contactDamage number in config', () => {
  for (const [name, cfg] of Object.entries(ENEMY)) {
    assert.equal(typeof cfg.contactDamage, 'number', `ENEMY.${name}.contactDamage`);
  }
});
