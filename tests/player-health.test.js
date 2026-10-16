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

/**
 * #39 — "sometimes I die at 50 HP".
 *
 * `Enemy.takeColourHit` sets `alive = false` and `dispose()` detaches the MESH,
 * but nothing removes the enemy from the level's `enemies` array and `position`
 * keeps pointing at the spot where it died. This loop used to read only `position`
 * and `config`, so every corpse remained a live hazard for the rest of the level:
 * walk over the body of the Charger you just killed and eat 25 damage with nothing
 * on screen to explain it.
 */
test('a dead enemy is not a hazard, at the spot where it died (#39)', () => {
  const p = makePlayer();

  const corpse = fakeEnemy(0, 0, 0, ENEMY.charger);
  corpse.alive = false;

  p.checkEnemyContact([corpse]);
  assert.equal(p.health, HEALTH.max, 'a corpse must deal no contact damage');

  // ...and it stays harmless on every later frame, not just the first
  p.update(HEALTH.hurtCooldown + 0.01, noInput, noActions);
  p.position.set(0, 0, 0);   // update() runs gravity, and contact is height-sensitive
  p.checkEnemyContact([corpse]);
  assert.equal(p.health, HEALTH.max, 'the corpse must stay harmless');

  // a LIVING enemy in the same spot still hurts — the check is `alive`, not "skip"
  const living = fakeEnemy(0, 0, 0, ENEMY.charger);
  living.alive = true;
  p.checkEnemyContact([living]);
  assert.equal(p.health, HEALTH.max - ENEMY.charger.contactDamage);
});

test('an enemy that does not report `alive` is still treated as alive', () => {
  // The stand-ins above have no `alive` field at all. Skipping anything falsy
  // rather than an explicit `false` would silently make every one of them inert
  // and turn this whole file into a no-op.
  const p = makePlayer();
  p.checkEnemyContact([fakeEnemy(0, 0, 0)]);
  assert.equal(p.health, HEALTH.max - ENEMY.sprayer.contactDamage);
});

test('every enemy type has a contactDamage number in config', () => {
  for (const [name, cfg] of Object.entries(ENEMY)) {
    assert.equal(typeof cfg.contactDamage, 'number', `ENEMY.${name}.contactDamage`);
  }
});
