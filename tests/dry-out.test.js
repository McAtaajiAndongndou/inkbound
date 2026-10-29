import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { DRY_OUT, HEALTH } from '../src/config.js';

function makePlayer() {
  const surfaces = [];
  const p = new Player(surfaces, new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  return p;
}

test('a fresh player is not dry (#75)', () => {
  const p = makePlayer();
  assert.equal(p.dry, false);
  assert.equal(p.dryTimer, 0);
});

test('kill() ends the run through onDeath, the same path as a health death (#75)', () => {
  const p = makePlayer();
  let fired = 0;
  p.onDeath = () => fired += 1;
  p.kill();
  assert.equal(p.dead, true);
  assert.equal(p.health, 0);
  assert.equal(fired, 1);
});

test('kill() is idempotent — a second call does not fire onDeath again (#75)', () => {
  const p = makePlayer();
  let fired = 0;
  p.onDeath = () => fired += 1;
  p.kill();
  p.kill();
  assert.equal(fired, 1);
});

test('a dead player takes no further damage (#75)', () => {
  const p = makePlayer();
  p.kill();
  assert.equal(p.takeDamage(HEALTH.max), false);
});

test('respawn clears dry and dryTimer (#75)', () => {
  const p = makePlayer();
  p.dry = true;
  p.dryTimer = DRY_OUT.graceTime;
  p.respawn();
  assert.equal(p.dry, false);
  assert.equal(p.dryTimer, 0);
});

test('the grace window is long enough to be noticed, short enough to be fair (#75)', () => {
  assert.ok(DRY_OUT.graceTime >= 0.8, 'too short to notice the warning');
  assert.ok(DRY_OUT.graceTime <= 2.0, 'too long to feel like a loss state');
});

test('the warning threshold fires before the loss, not after (#75)', () => {
  assert.ok(DRY_OUT.warningBelow > 0, 'must fire before empty');
  assert.ok(DRY_OUT.warningBelow < 1, 'must not always-on');
});