// Polish audit (30 Oct), the core lane: red refills (P0-2), submerge refills
// x4, hit-stop (P1-1), camera trauma (P1-2), and the hurt source + flinch (P0-4).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { CameraRig } from '../src/core/camera-rig.js';
import { HitStop, Trauma, refillStep } from '../src/core/feel.js';
import { SURFACE, PAINT_GUN, SUBMERGE, HIT_STOP, SHAKE, DRY_OUT } from '../src/config.js';

const DT = 1 / 60;

/** One big floor reading as `rules` everywhere, `paintId` its colour. */
function floor(rules, paintId) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);
  return {
    mesh, width: 200, height: 200, isFloor: true,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => paintId,
    isPlayerPaintAtWorld: () => paintId !== 0,
    splat: () => {},
  };
}
const still = { isDown: () => false, aiming: false };
const noJump = { jump: false };

/** Run the player and main.js's refill step together, as simulate() does. */
function play(player, gun, seconds, input = still) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    player.update(DT, input, noJump);
    const touching = !player.dead && (player.onGround || player.touchedGround);
    const onPaint = touching && player.floors.some((f) => f.isPlayerPaintAtWorld(player.position));
    refillStep(player, gun, onPaint, DT);
  }
}

// --- P0-2 ----------------------------------------------------------------------

test('red refills you: the bounce counts as touching your paint (P0-2)', () => {
  const red = floor(SURFACE.red, 2);
  const player = new Player([red], new THREE.Vector3(0, 0, 0));
  const gun = { ammo: 0, maxAmmo: 100 };
  play(player, gun, 6);
  assert.equal(player.onGround, false, 'red never lets you stand (unchanged, on purpose)');
  assert.ok(gun.ammo > 0, `bouncing on red refilled nothing: ${gun.ammo}`);
  assert.equal(player.dead, false, 'and an empty tank on red never dries you out');
});

test('grey still refills nothing, and an empty tank on grey still dries you out', () => {
  const grey = floor(SURFACE.grey, 0);
  const player = new Player([grey], new THREE.Vector3(0, 0, 0));
  const gun = { ammo: 0, maxAmmo: 100 };
  play(player, gun, DRY_OUT.graceTime + 0.5);
  assert.equal(gun.ammo, 0);
  assert.equal(player.dead, true);
});

// Loop pass step 4a raised the multiplier 4 -> 5; the rule is the ratio and the time.
test('submerged refills refillMultiplier times the standing rate: a full tank in under 3.2 s', () => {
  assert.ok(SUBMERGE.refillMultiplier >= 4, 'submerge must stay the fast reload');
  const green = floor(SURFACE.green, 3);
  const standing = new Player([green], new THREE.Vector3(0, 0, 0));
  const g1 = { ammo: 0, maxAmmo: 100 };
  play(standing, g1, 1);
  const sunk = new Player([green], new THREE.Vector3(0, 0, 0));
  const g2 = { ammo: 0, maxAmmo: 100 };
  play(sunk, g2, 1, { isDown: (k) => k === SUBMERGE.key, aiming: false });
  assert.ok(sunk.submerged);
  assert.ok(Math.abs(g2.ammo / g1.ammo - SUBMERGE.refillMultiplier) < 0.15, `${g2.ammo} vs ${g1.ammo}`);
  assert.ok(100 / (PAINT_GUN.refillRate * SUBMERGE.refillMultiplier) < 3.2, 'empty to full under 3.2 s');
});

// --- P0-4 ----------------------------------------------------------------------

test('a hit records where it came from, ages, and calls onHurt once', () => {
  const player = new Player([floor(SURFACE.grey, 0)], new THREE.Vector3());
  const hits = [];
  player.onHurt = (n, from) => hits.push([n, from]);
  assert.ok(player.takeDamage(10, new THREE.Vector3(3, 0, -4)));
  assert.deepEqual(player.lastHurtFrom.toArray(), [3, 0, -4]);
  assert.equal(player.lastHurtAge, 0);
  assert.equal(player.takeDamage(10, new THREE.Vector3()), false, 'the cooldown still holds');
  assert.equal(hits.length, 1);
  player.update(0.5, still, noJump);
  assert.ok(player.lastHurtAge >= 0.5);
  player.hurtTimer = 0;
  player.takeDamage(5);
  assert.equal(player.lastHurtFrom, null, 'a hit with no source clears the old one');
});

test('enemy contact passes the enemy as the source', () => {
  const player = new Player([floor(SURFACE.grey, 0)], new THREE.Vector3());
  const enemy = { position: new THREE.Vector3(0.5, 0, 0), config: { contactDamage: 20 } };
  player.checkEnemyContact([enemy]);
  assert.equal(player.health, 80);
  assert.ok(player.lastHurtFrom.equals(enemy.position));
});

// --- P1-1 ----------------------------------------------------------------------

test('hit-stop freezes the step for its length, the longest stop winning, then lets go', () => {
  const h = new HitStop();
  assert.equal(h.step(DT), DT);
  h.hit('kill');
  h.hit('shatter');
  h.hit('kill');
  assert.equal(h.left, HIT_STOP.shatter, 'overlapping stops do not add up');
  let frozen = 0;
  while (h.step(DT) === 0) frozen++;
  assert.equal(frozen, Math.ceil(HIT_STOP.shatter / DT - 1e-9));
  assert.equal(h.step(DT), DT);
  assert.ok(HIT_STOP.kill < HIT_STOP.shatter && HIT_STOP.shatter < HIT_STOP.combo);
});

// --- P1-2 ----------------------------------------------------------------------

test('trauma decays to nothing, shakes as its square, and the kick fades', () => {
  const small = new Trauma();
  small.add(0.2);
  const big = new Trauma();
  big.add(1);
  let sMax = 0;
  let bMax = 0;
  for (let i = 0; i < 10; i++) {
    sMax = Math.max(sMax, Math.abs(small.update(DT).roll));
    bMax = Math.max(bMax, Math.abs(big.update(DT).roll));
  }
  assert.ok(bMax > sMax * 8, 'squared: a small event barely moves the camera');
  for (let i = 0; i < 120; i++) big.update(DT);
  assert.equal(big.value, 0);
  big.kick(SHAKE.hurtKick);
  assert.ok(Math.abs(big.update(DT).pitch) > 0);
  for (let i = 0; i < 120; i++) big.update(DT);
  assert.equal(big.kickValue, 0);
});

test('the camera rig shakes on trauma and settles back to the same view', () => {
  const player = { position: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, submerged: false };
  const calm = new CameraRig(1);
  calm.update(player, DT);
  const shaken = new CameraRig(1);
  shaken.addTrauma(1);
  shaken.update(player, DT);
  shaken.update(player, DT);
  calm.update(player, DT);
  assert.ok(!calm.camera.quaternion.equals(shaken.camera.quaternion), 'trauma moves the view');
  for (let i = 0; i < 120; i++) { shaken.update(player, DT); calm.update(player, DT); }
  assert.ok(calm.camera.position.distanceTo(shaken.camera.position) < 1e-9, 'and it settles');
  assert.ok(calm.camera.quaternion.angleTo(shaken.camera.quaternion) < 1e-6);
});
