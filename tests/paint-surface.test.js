import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PaintSurface } from '../src/paint/paint-surface.js';
import { PAINT_IDS, SURFACE } from '../src/config.js';

function makeSurface(width = 10, height = 10, cells = 2) {
  const s = new PaintSurface({ width, height, cells });
  // lay flat on the XZ plane so world points map 1:1 to local x/y
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  return s;
}

test('paintIdAtWorld returns grey (0) off the surface', () => {
  const s = makeSurface();
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(100, 0, 100)), PAINT_IDS.grey);
});

test('splat writes the id, surfaceAtWorld reads it back as physics rules', () => {
  const s = makeSurface();
  const centre = new THREE.Vector3(0, 0, 0);

  assert.equal(s.surfaceAtWorld(centre).friction, SURFACE.grey.friction);

  const ok = s.splat(centre, 'blue', 1);
  assert.equal(ok, true);

  const rules = s.surfaceAtWorld(centre);
  assert.equal(rules, SURFACE.blue);   // same object — the id became the physics
});

test('paint is grid data, not geometry: mesh stays one draw call', () => {
  const s = makeSurface();
  s.splat(new THREE.Vector3(0, 0, 0), 'red', 3);
  assert.equal(s.mesh.geometry.attributes.position.count, 4); // one PlaneGeometry quad
  assert.equal(s.coverage() > 0, true);
});

test('dispose frees the paint texture and does not throw on repeat', () => {
  const s = makeSurface();
  assert.doesNotThrow(() => s.dispose());
  assert.doesNotThrow(() => s.dispose());
});
