import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PaintSurface } from '../src/paint/paint-surface.js';
import { createPaintMap, createPaintMaterial } from '../src/shaders/paint-material.js';
import { PAINT_IDS, SEALED } from '../src/config.js';

// #156 — a sealed face reads before you shoot it.
//
// A wall that refuses paint and a wall that takes it were drawn identically:
// the same grey grid. `PaintSurface` had always known (`unpaintable`), and the
// material just never showed it. The fix is texture, never colour (ADR-0002:
// "grey is Corrupt Corp's"): sealed faces are broken into panels with dark
// seams and a rivet at every corner, in the SAME grey, so nothing here can be
// mistaken for a paint colour or for the danger amber.
//
// These tests fail on the pre-#156 shader: it had no uUnpaintable uniform at
// all, so the first assertion reads undefined instead of 1.

test('a sealed face gets its own material state, an open face does not', () => {
  const sealed = new PaintSurface({ width: 10, height: 6, cells: 2, unpaintable: true });
  const open = new PaintSurface({ width: 10, height: 6, cells: 2 });

  assert.equal(sealed.material.uniforms.uUnpaintable.value, 1,
    'a sealed face must tell the material it cannot be painted');
  assert.equal(open.material.uniforms.uUnpaintable.value, 0,
    'open ground must take the unchanged path — painted cells look as they do today');

  // The flag is build-time state, not per-frame: which faces are paintable is
  // level data.
  assert.equal(sealed.unpaintable, true);
});

test('the sealed pattern is in the shader and keyed on that uniform', () => {
  const material = createPaintMaterial(createPaintMap(4, 4), 4, true);
  const src = material.fragmentShader;

  // The uniform alone is not a feature — without the branch the flag does
  // nothing and every wall still looks identical. Pin the branch itself.
  assert.match(src, /uUnpaintable > 0\.5/, 'the pattern must be gated on the sealed flag');
  assert.match(src, /sealed panels \(#156\)/, 'the sealed-panel block is missing from the shader');

  // The pattern's numbers come from config.js, so tuning them there must reach
  // the shader. A hardcoded literal here means SEALED stopped being the source.
  assert.ok(src.includes(SEALED.seamDepth.toFixed(3)),
    'seamDepth in config.js is no longer reaching the shader');
  assert.ok(src.includes(SEALED.rivetLift.toFixed(3)),
    'rivetLift in config.js is no longer reaching the shader');
});

test('the default is an open face — every existing caller stays paintable', () => {
  // fog-height.test.js and friends build materials with no third argument.
  const material = createPaintMaterial(createPaintMap(4, 4), 4);
  assert.equal(material.uniforms.uUnpaintable.value, 0);
});

test('a sealed face never paints and stays grey', () => {
  const sealed = new PaintSurface({ width: 10, height: 10, cells: 2, unpaintable: true });
  sealed.mesh.rotation.x = -Math.PI / 2;
  sealed.mesh.updateMatrixWorld(true);

  const centre = new THREE.Vector3(0, 0, 0);
  assert.equal(sealed.splat(centre, 'green', 3), false, 'sealed refuses every colour');
  assert.equal(sealed.paintIdAtWorld(centre), PAINT_IDS.grey, 'and stays grey');
  assert.equal(sealed.coverage(), 0);
});
