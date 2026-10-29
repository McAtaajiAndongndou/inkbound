import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import * as kit from '../src/levels/level-kit.js';

/** The two fields every kit helper writes to. */
function fakeLevel() {
  return { root: new THREE.Group(), surfaces: [] };
}

/** World-space facing of a face: the plane's +z, turned by its rotation. */
function normalOf(surface) {
  surface.mesh.updateMatrixWorld(true);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(surface.mesh.quaternion);
}

test('a platform is a floor at its height, covering exactly its footprint', () => {
  const level = fakeLevel();
  const s = kit.platform(level, { y: 5, xMin: -2, xMax: 6, zMin: -10, zMax: -4, mark: 'terrace', cells: 4 });
  assert.equal(s.isFloor, true);
  assert.equal(s.terrace, true);
  assert.ok(level.surfaces.includes(s) && s.mesh.parent === level.root, 'must be in surfaces AND root, or it is unfreed or uncollided');

  const box = new THREE.Box3().setFromObject(s.mesh);
  assert.deepEqual([box.min.x, box.max.x, box.min.z, box.max.z].map((n) => Math.round(n * 1000) / 1000), [-2, 6, -10, -4]);
  assert.ok(Math.abs(box.min.y - 5) < 1e-6 && Math.abs(box.max.y - 5) < 1e-6);
});

test('a face is a wall spanning yBase..yTop, facing the way it was asked to', () => {
  const level = fakeLevel();
  const plusZ = kit.face(level, { yBase: 2, yTop: 7, z: 3, xMin: -1, xMax: 1, cells: 4 });
  const minusZ = kit.face(level, { yBase: 0, yTop: 1, z: 3, xMin: -1, xMax: 1, normalZ: -1, cells: 4 });
  const minusX = kit.face(level, { yBase: 0, yTop: 1, x: 4, zMin: 0, zMax: 2, normalX: -1, cells: 4 });

  for (const s of [plusZ, minusZ, minusX]) assert.equal(s.isFloor, false);
  assert.ok(normalOf(plusZ).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-6);
  assert.ok(normalOf(minusZ).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6);
  assert.ok(normalOf(minusX).distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-6);

  const box = new THREE.Box3().setFromObject(plusZ.mesh);
  assert.ok(Math.abs(box.min.y - 2) < 1e-6 && Math.abs(box.max.y - 7) < 1e-6);
});

test('rock refuses paint, so it can never be climbed', () => {
  const level = fakeLevel();
  const r = kit.rock(level, { xMin: 0, xMax: 4, yBase: 0, yTop: 5, z: 0, cells: 4 });
  assert.equal(r.unpaintable, true);
  assert.equal(r.isFloor, false);
});

test('a pillar top overhangs every climbable side, and stands on its yBase', () => {
  const level = fakeLevel();
  const spec = { xMin: 0, xMax: 4, zMin: -4, zMax: 0, y: 10, yBase: 5, overhang: 1, cells: 4 };
  const top = kit.pillar(level, spec);

  assert.equal(level.surfaces.length, 4, 'three sides and a top — the back leans on a wall');
  const t = new THREE.Box3().setFromObject(top.mesh);
  assert.ok(t.min.x <= spec.xMin - 1 + 1e-6 && t.max.x >= spec.xMax + 1 - 1e-6, 'the top must reach past both side faces');
  assert.ok(t.max.z >= spec.zMax + 1 - 1e-6, 'the top must reach past the front face');

  for (const s of level.surfaces.filter((x) => !x.isFloor)) {
    const b = new THREE.Box3().setFromObject(s.mesh);
    assert.ok(Math.abs(b.min.y - 5) < 1e-6 && Math.abs(b.max.y - 10) < 1e-6, 'sides span yBase..y');
  }
});

test('every face of a block points OUT of it', () => {
  // A face pointing in pushes the player INTO the block: the wall resolver reads
  // the normal straight off the mesh rotation.
  const level = fakeLevel();
  const spec = { xMin: 2, xMax: 6, zMin: -8, zMax: -3, y: 4, yBase: 0, unpaintable: true, cells: 4 };
  kit.block(level, spec);

  const walls = level.surfaces.filter((s) => !s.isFloor);
  assert.equal(walls.length, 4, 'a free-standing block is closed on all four sides');
  const centre = new THREE.Vector3((spec.xMin + spec.xMax) / 2, 2, (spec.zMin + spec.zMax) / 2);
  for (const s of walls) {
    const out = s.mesh.position.clone().sub(centre).setY(0);
    assert.ok(normalOf(s).dot(out) > 0, `face at ${s.mesh.position.toArray()} faces into the block`);
    assert.equal(s.unpaintable, true);
  }
});

test("a block's top overhangs its back too — it can be climbed from all four sides", () => {
  const level = fakeLevel();
  const top = kit.block(level, { xMin: 0, xMax: 4, zMin: -4, zMax: 0, y: 3, overhang: 0.5, cells: 4 });
  const t = new THREE.Box3().setFromObject(top.mesh);
  assert.ok(t.min.z <= -4 - 0.5 + 1e-6, 'the back face would strand a green climber');
  assert.ok(t.max.z >= 0.5 - 1e-6 && t.min.x <= -0.5 + 1e-6 && t.max.x >= 4.5 - 1e-6);
});

test('the extraction zone is the box asked for, with a see-through marker', () => {
  const level = fakeLevel();
  const box = kit.extractionZone(level, new THREE.Vector3(-1, 0, -5), new THREE.Vector3(1, 3, -2));
  assert.ok(box.containsPoint(new THREE.Vector3(0, 1, -3)));
  assert.ok(!box.containsPoint(new THREE.Vector3(0, 1, 0)));
  const marker = level.root.children.find((o) => o.isMesh);
  assert.ok(marker && marker.material.transparent, 'the marker must not hide what is behind it');
  assert.equal(level.surfaces.length, 0, 'the marker is not a surface — you walk into it, not onto it');
});

test('aimCustomShading points every uLightDir at the same normalised sun', () => {
  const uniform = () => ({ uniforms: { uLightDir: { value: new THREE.Vector3() } } });
  const surfaces = [{ material: uniform() }, { material: { uniforms: {} } }];
  const materials = [uniform()];
  const dir = kit.aimCustomShading(surfaces, materials, [2, 4, 4]);
  assert.ok(Math.abs(dir.length() - 1) < 1e-9);
  assert.ok(surfaces[0].material.uniforms.uLightDir.value.equals(dir));
  assert.ok(materials[0].uniforms.uLightDir.value.equals(dir));
});

test('spawnEnemies returns sleepers for the dormant ones only', () => {
  const level = fakeLevel();
  kit.platform(level, { y: 0, xMin: -10, xMax: 10, zMin: -10, zMax: 10, cells: 2 });
  const { enemies, sleepers } = kit.spawnEnemies(level, [
    { type: 'charger', x: 0, y: 0, z: 0 },
    { type: 'sprayer', x: 3, y: 0, z: 3, sleeping: true, wakeOn: 'arena' },
  ]);
  assert.equal(enemies.length, 2);
  assert.equal(sleepers.length, 1);
  assert.equal(sleepers[0].wakeOn, 'arena');
  for (const e of enemies) e.dispose?.();
});
