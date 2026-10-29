
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PaintGun } from '../src/paint/paint-gun.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { PAINT_GUN } from '../src/config.js';

function makeGun() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20));
  mesh.position.z = -10;
  mesh.updateMatrixWorld();

  const surface = {
    mesh,
    splat: () => true,
  };

  mesh.userData.paintSurface = surface;

  return {
    gun: new PaintGun([surface], 1),
    camera,
  };
}

test('blue, red and green use the same ammo reserve', () => {
  const { gun, camera } = makeGun();
  const startingAmmo = gun.ammo;

  for (const colour of [0, 1, 2]) {
    gun.selectColour(colour);
    gun.cooldown = 0;
    assert.equal(gun.tryFire(camera), true);
  }

  assert.equal(gun.ammo, startingAmmo - 3 * PAINT_GUN.cost);
});

test('grey shots do not consume ammo', () => {
  const { gun, camera } = makeGun();
  const startingAmmo = gun.ammo;

  gun.selectColour(3);

  assert.equal(gun.tryFire(camera), true);
  assert.equal(gun.ammo, startingAmmo);
});

test('an empty tank prevents coloured shots', () => {
  const { gun, camera } = makeGun();

  gun.ammo = 0;
  gun.selectColour(0);

  assert.equal(gun.tryFire(camera), false);
  assert.equal(gun.ammo, 0);
  assert.equal(gun.dryFire, true);
});

test('player paint allows refill, but grey does not', () => {
  const surface = new PaintSurface({
    width: 10,
    height: 10,
  });

  surface.mesh.updateMatrixWorld(true);

  const point = new THREE.Vector3(0, 0, 0);

  assert.equal(surface.isPlayerPaintAtWorld(point), false);

  surface.splat(point, 'blue', 1);
  assert.equal(surface.isPlayerPaintAtWorld(point), true);

  surface.splat(point, 'grey', 1);
  assert.equal(surface.isPlayerPaintAtWorld(point), false);

  surface.dispose();
});
