import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PaintGun } from '../src/paint/paint-gun.js';
import { Enemy } from '../src/enemies/enemy.js';
import { ENEMY, PAINT_GUN, PAINT_IDS } from '../src/config.js';

const SPLASH = Math.round(PAINT_GUN.damage * PAINT_GUN.splashFraction);

// Camera at the origin looking down -Z. Enemy A is the target at z -5; its
// body centre is at y 0 (origin at the feet, 0.8 below).
function makeCamera() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  return camera;
}

function makeMock(x, y, z) {
  const enemy = {
    alive: true,
    hp: 100,
    direct: 0,
    splash: 0,
    position: new THREE.Vector3(x, y, z),
    takeColourHit() { this.direct++; this.hp -= 10; return true; },
    takeDamage(d) {
      this.splash += d; this.hp -= d;
      if (this.hp <= 0) this.alive = false;
      return true;
    },
  };
  enemy.mesh = new THREE.Group();
  enemy.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  enemy.mesh.position.copy(enemy.position).setY(enemy.position.y + 0.8);
  enemy.mesh.userData.enemy = enemy;
  enemy.mesh.updateMatrixWorld(true);
  return enemy;
}

function makeSurface(mesh, splats = []) {
  mesh.updateMatrixWorld(true);
  const surface = { mesh, splat: (p, c) => { splats.push(c); return true; } };
  mesh.userData.paintSurface = surface;
  return surface;
}

function solidPlane(w, h) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
}

test('hipfire damages every enemy inside the splat radius', () => {
  const a = makeMock(0, -0.8, -5);
  const b = makeMock(1, -0.8, -5);
  const gun = new PaintGun([], 1, [a, b]);

  assert.equal(gun.tryFire(makeCamera(), null, false), true);
  assert.equal(a.direct, 1, 'the target takes the direct hit');
  assert.equal(b.splash, SPLASH, 'the neighbour takes splash');
  assert.equal(b.direct, 0, 'splash is not a paint hit');
});

test('aiming is single-target: no splash', () => {
  const a = makeMock(0, -0.8, -5);
  const b = makeMock(1, -0.8, -5);
  const gun = new PaintGun([], 1, [a, b]);

  gun.tryFire(makeCamera(), null, true);
  assert.equal(a.direct, 1);
  assert.equal(b.splash, 0);
});

test('splash is partial, so a direct hit is still worth aiming for', () => {
  assert.ok(SPLASH > 0);
  assert.ok(SPLASH < PAINT_GUN.damage);
});

test('clumped enemies take more total damage from hipfire than from aiming', () => {
  const total = (aiming) => {
    const a = makeMock(0, -0.8, -5);
    const b = makeMock(1, -0.8, -5);
    const gun = new PaintGun([], 1, [a, b]);
    gun.tryFire(makeCamera(), null, aiming);
    return (100 - a.hp) + (100 - b.hp);
  };
  assert.ok(total(false) > total(true));
});

test('enemies outside the radius take nothing', () => {
  const a = makeMock(0, -0.8, -5);
  const far = makeMock(PAINT_GUN.splashRadius + 2, -0.8, -5);
  const gun = new PaintGun([], 1, [a, far]);

  gun.tryFire(makeCamera(), null, false);
  assert.equal(far.splash, 0);
});

test('splash does not go through a wall', () => {
  const a = makeMock(0, -0.8, -5);
  const b = makeMock(1, -0.8, -5);

  const wall = solidPlane(4, 4);
  wall.rotation.y = Math.PI / 2;     // a vertical wall at x = 0.6, between A and B
  wall.position.set(0.6, 0, -5);
  const gun = new PaintGun([makeSurface(wall)], 1, [a, b]);

  gun.tryFire(makeCamera(), null, false);
  assert.equal(a.direct, 1);
  assert.equal(b.splash, 0);
});

test('splash does not go through a floor', () => {
  const a = makeMock(0, -0.8, -5);
  const below = makeMock(0.3, -1.8, -5);   // body centre at y -1, under the floor

  const floor = solidPlane(10, 10);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.5, -5);
  const gun = new PaintGun([makeSurface(floor)], 1, [a, below]);

  gun.tryFire(makeCamera(), null, false);
  assert.equal(below.splash, 0);
});

test('splash never crits and never spends a freeze', () => {
  const a = makeMock(0, -0.8, -5);
  const frozen = new Enemy({
    position: new THREE.Vector3(1, -0.8, -5),
    config: ENEMY.sprayer,
    parent: new THREE.Group(),
    floors: [],
  });
  for (let i = 0; i < 3; i++) frozen.takeColourHit(PAINT_IDS.blue, 10);
  const far = new THREE.Vector3(0, 0, 100);
  for (let i = 0; i < 30; i++) frozen.update(1 / 60, far);   // past the arm delay
  assert.ok(frozen._frozenTimer > 0, 'frozen and armed');
  frozen.mesh.updateMatrixWorld(true);   // headless: nothing else refreshes it

  const before = frozen.hp;
  const gun = new PaintGun([], 1, [a, frozen]);
  gun.tryFire(makeCamera(), null, false);

  assert.equal(before - frozen.hp, SPLASH, 'plain splash damage, no x3');
  assert.ok(frozen._frozenTimer > 0, 'the freeze is still there for an aimed shot');
});

test('painting works identically in both modes', () => {
  for (const aiming of [false, true]) {
    const splats = [];
    const wall = solidPlane(20, 20);
    wall.position.z = -10;
    const gun = new PaintGun([makeSurface(wall, splats)], 1, []);

    assert.equal(gun.tryFire(makeCamera(), null, aiming), true);
    assert.deepEqual(splats, ['blue'], `aiming=${aiming}`);
    assert.equal(gun.lastShot, 'splat');
  }
});

test('an aimed shot still crits a frozen enemy', () => {
  const frozen = new Enemy({
    position: new THREE.Vector3(0, -0.8, -5),
    config: ENEMY.sprayer,
    parent: new THREE.Group(),
    floors: [],
  });
  for (let i = 0; i < 3; i++) frozen.takeColourHit(PAINT_IDS.blue, 10);
  const far = new THREE.Vector3(0, 0, 100);
  for (let i = 0; i < 30; i++) frozen.update(1 / 60, far);
  frozen.mesh.updateMatrixWorld(true);

  const before = frozen.hp;
  const gun = new PaintGun([], 1, [frozen]);
  gun.tryFire(makeCamera(), null, true);

  assert.equal(before - frozen.hp, PAINT_GUN.damage * 3, 'x3 crit');
});