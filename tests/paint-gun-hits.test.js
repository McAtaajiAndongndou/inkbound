import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PaintGun } from '../src/paint/paint-gun.js';

// Camera at the origin looking down -Z; an enemy box in front, a wall behind.
function setup({ alive }) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();

  const splats = [];
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20));
  wallMesh.position.z = -10;
  wallMesh.updateMatrixWorld();
  const wall = { mesh: wallMesh, splat: (p, c) => { splats.push(c); return true; } };
  wallMesh.userData.paintSurface = wall;

  const enemy = {
    alive,
    hp: 10,
    hits: 0,
    takeColourHit() { this.hits++; this.hp -= 10; if (this.hp <= 0) this.alive = false; return true; },
  };
  enemy.mesh = new THREE.Group();
  enemy.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  enemy.mesh.position.z = -5;
  enemy.mesh.userData.enemy = enemy;
  enemy.mesh.updateMatrixWorld(true);

  const gun = new PaintGun([wall], 1, [enemy]);
  return { gun, camera, enemy, splats };
}

test('a shot that kills an enemy reports a kill', () => {
  const { gun, camera, enemy } = setup({ alive: true });
  assert.equal(gun.tryFire(camera), true);
  assert.equal(enemy.hits, 1);
  assert.equal(gun.lastShot, 'kill');
});

test('a dead enemy does not soak up shots: they reach the wall behind it', () => {
  const { gun, camera, enemy, splats } = setup({ alive: false });
  assert.equal(gun.tryFire(camera), true);
  assert.equal(enemy.hits, 0);
  assert.deepEqual(splats, ['blue']);
  assert.equal(gun.lastShot, 'splat');
});

test('onImpact reports what each shot did, when it lands', () => {
  const { gun, camera } = setup({ alive: true });
  const kinds = [];
  gun.onImpact = (kind) => kinds.push(kind);
  gun.tryFire(camera);           // kills the enemy
  gun.cooldown = 0;
  gun.tryFire(camera);           // passes the dead enemy, paints the wall
  assert.deepEqual(kinds, ['kill', 'splat']);
});
