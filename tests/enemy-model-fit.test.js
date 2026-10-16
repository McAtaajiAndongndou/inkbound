import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { fitModelToHeight } from '../src/enemies/enemy.js';

/**
 * #39 #2 — "the grey enemies are clipping through the floor".
 *
 * `Enemy._tick` glues the enemy's ORIGIN to the floor it is standing on
 * (`this.position.y = nextGround.y`). That is only correct when a model's pivot
 * is between its feet. The soldiers' pivots are mid-body — measured min.y −2.695
 * on a 5.936 m model — so at 1.6 m each one was drawn with its shins buried, and
 * nothing anywhere reported it.
 *
 * The asset cannot be loaded here (`node --test` has no server), so these pin the
 * MATHS instead: any model, any pivot, feet end up on y = 0 after the fit.
 */
function makeBody({ height, pivotY }) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, height, 1));
  mesh.position.y = pivotY;
  root.add(mesh);
  return root;
}

test('a model with a mid-body pivot is lifted so its feet sit on y = 0', () => {
  // 2 m tall, origin 5 m below its own centre — the soldiers' failure mode, exaggerated
  const model = makeBody({ height: 2, pivotY: 5 });

  const { scale, feetOffset } = fitModelToHeight(model, 1.6);

  assert.equal(scale, 0.8, '1.6 / 2');
  assert.equal(feetOffset, -4 * 0.8, 'box.min.y is 4, so the lift is 3.2 m');

  model.scale.setScalar(scale);
  model.position.y = feetOffset;
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(box.min.y) < 1e-9, `feet at y=${box.min.y}, expected 0`);
  assert.ok(Math.abs(box.max.y - 1.6) < 1e-9, `head at y=${box.max.y}, expected 1.6`);
});

test('a model whose pivot is already at its feet is not moved', () => {
  // the well-behaved case: nothing to correct, so nothing changes
  const model = makeBody({ height: 4, pivotY: 2 });

  const { scale, feetOffset } = fitModelToHeight(model, 2);

  assert.equal(scale, 0.5);
  // `assert.ok` not `assert.equal`: the helper returns -0 here, and `equal` is
  // strict about -0 vs 0. -0 is the same position on screen, so it is not a bug.
  assert.ok(feetOffset === 0, 'feet are already on the origin — do not shift the model');
});

test('a flat or empty model does not divide by zero', () => {
  const empty = new THREE.Group();
  const { scale, feetOffset } = fitModelToHeight(empty, 1.6);

  assert.ok(Number.isFinite(scale) && scale > 0, `scale went non-finite: ${scale}`);
  assert.ok(Number.isFinite(feetOffset), `feetOffset went non-finite: ${feetOffset}`);
});
