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
    takeColourHit() {
      if (!this.alive) return false;
      this.hits++; this.hp -= 10; if (this.hp <= 0) this.alive = false; return true;
    },
  };
  enemy.mesh = new THREE.Group();
  enemy.mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  enemy.mesh.position.z = -5;
  enemy.mesh.userData.enemy = enemy;
  enemy.mesh.updateMatrixWorld(true);

  const gun = new PaintGun([wall], 1, [enemy]);
  return { gun, camera, enemy, splats, wall };
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

// A stand-in scene: counts what gets added, so pooling can be checked.
function fakeScene() {
  return { added: 0, removed: 0, add() { this.added++; }, remove() { this.removed++; } };
}

test('with a scene, a shot lands after flight and reports on impact', () => {
  const { camera, enemy } = setup({ alive: true });
  const scene = fakeScene();
  const gun = new PaintGun([], 1, [enemy], scene);
  const kinds = [];
  gun.onImpact = (kind) => kinds.push(kind);

  assert.equal(gun.tryFire(camera), true);
  assert.deepEqual(kinds, [], 'nothing reported at the moment of firing');
  for (let i = 0; i < 60; i++) gun.update(1 / 60);
  assert.deepEqual(kinds, ['kill']);
});

test('firing adds nothing to the scene: projectiles and bursts are pooled', () => {
  const { camera, wall } = setup({ alive: false });
  const scene = fakeScene();
  const gun = new PaintGun([wall], 1, [], scene);
  const pooled = scene.added;

  for (let shot = 0; shot < 40; shot++) {
    gun.cooldown = 0;
    gun.ammo = gun.maxAmmo;
    gun.tryFire(camera);
    for (let i = 0; i < 10; i++) gun.update(1 / 60);
  }
  assert.equal(scene.added, pooled, 'no meshes created after construction');
  assert.equal(scene.removed, 0);
});

test('a second shot landing on an enemy the first one killed is not a kill', () => {
  const { camera, enemy } = setup({ alive: true });
  const gun = new PaintGun([], 1, [enemy], fakeScene());
  const kinds = [];
  gun.onImpact = (kind) => kinds.push(kind);

  gun.tryFire(camera);   // both in flight before either lands
  gun.cooldown = 0;
  gun.tryFire(camera);
  for (let i = 0; i < 60; i++) gun.update(1 / 60);
  assert.deepEqual(kinds, ['kill']);
});

test('a splat reports whether it claimed ground or repainted our own (#113)', () => {
  const { gun, camera, wall } = setup({ alive: false });
  let ground = 0; // grey
  wall.paintIdAtWorld = () => ground;
  const claims = [];
  gun.onImpact = (kind, claimed) => claims.push([kind, claimed]);
  gun.tryFire(camera);           // grey -> blue: claimed
  ground = 1;                    // the wall is blue now
  gun.cooldown = 0;
  gun.tryFire(camera);           // blue -> blue: just a splat
  assert.deepEqual(claims, [['splat', true], ['splat', false]]);
});
