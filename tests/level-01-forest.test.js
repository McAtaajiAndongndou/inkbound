import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';

/** Same shape the other level tests use: a bare game object, no renderer. */
async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  return level;
}

function findTrees(level) {
  const trees = [];
  level.root.traverse((o) => { if (o.userData?.tree) trees.push(o); });
  return trees;
}

/**
 * A tree over a gap floats in mid-air, and with the gaps no longer filled with
 * fog colour that is the first thing a player would notice. Placement is a hand-
 * written table, so it needs a machine watching it.
 */
test('every tree stands on a floor, never over a gap', async () => {
  const level = await buildLevel();
  const trees = findTrees(level);
  assert.ok(trees.length >= 15, `expected a forest, found ${trees.length}`);

  const floors = level.surfaces.filter((s) => s.isFloor);
  const point = new THREE.Vector3();

  for (const tree of trees) {
    point.set(tree.position.x, tree.position.y, tree.position.z);
    // worldToCell is the level's OWN "is this point on this surface" API — the
    // same one the paint gun and the physics probe use, so this test cannot
    // drift away from what the game actually treats as a floor.
    const under = floors.find((s) => s.worldToCell(point) !== null);
    assert.ok(under,
      `tree floats over a gap at (${point.x}, ${point.y}, ${point.z})`);
  }
});

/**
 * Per-tree geometry or material would be ~38 geometries and ~38 materials for no
 * reason. This pins the "build one, share it" rule from the plan, which is what
 * keeps the forest free rather than a frame-rate problem on lab hardware.
 */
test('the forest shares its geometry and materials', async () => {
  const level = await buildLevel();
  const geometries = new Set();
  const materials = new Set();

  for (const tree of findTrees(level)) {
    for (const part of tree.children) {
      geometries.add(part.geometry);
      materials.add(part.material);
    }
  }

  assert.equal(geometries.size, 2, 'one canopy shape + one trunk shape, shared by all');
  assert.equal(materials.size, 2, 'one canopy material + one trunk material, shared by all');
});

/**
 * Trees are decoration. The moment one is a PaintSurface the player controller
 * would treat it as something to stand on and collide with, which could block
 * the Gap 1 jump or trap the player against the Charger.
 */
test('trees are decoration, not physics', async () => {
  const level = await buildLevel();
  const trees = findTrees(level);

  let paintable = 0;
  for (const tree of trees) {
    tree.traverse((o) => { if (o.userData?.paintSurface) paintable++; });
  }

  assert.equal(paintable, 0, 'a tree must never be a PaintSurface, or it collides');
  assert.equal(level.surfaces.filter((s) => s.userData?.tree).length, 0);
});

/**
 * The ground does not read scene lights — it reads its own `uLightDir` uniform,
 * whose shader default is only NEARLY the sun's vector. So "the ground and the
 * props are lit from the same side" (#57) is a wiring problem, not a lighting
 * one, and the wiring happens in one place at the end of load().
 *
 * The literal below mirrors main.js (`sun.position.set(18, 30, 12)`), which a
 * test cannot import because it is a module with side effects.
 */
test('the ground, the walls and the gates are lit from the same direction (#57)', async () => {
  const level = await buildLevel();
  const expected = new THREE.Vector3(18, 30, 12).normalize();

  assert.ok(level.surfaces.length > 0);
  for (const surface of level.surfaces) {
    const uniform = surface.material.uniforms.uLightDir;
    assert.ok(uniform, 'a paint surface with no uLightDir cannot be lit at all');
    assert.ok(
      uniform.value.distanceTo(expected) < 1e-6,
      `surface lit from [${uniform.value.toArray()}], the sun is [${expected.toArray()}]`,
    );
  }
});
