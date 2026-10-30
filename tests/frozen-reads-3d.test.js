// #223 (QA B9): a frozen enemy looked flat (2D) inside its frost shell. Seen
// in the level viewer: the hit flash flooded the body's emissive with full
// paint blue for the first half of the 2 s freeze, washing out all shading,
// and the shell replaced the body with its half-resolution scene copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { createFrostMaterial } from '../src/shaders/frost/frost-material.js';
import { ENEMY, FROST, PAINT, PAINT_IDS, BLUE_FREEZE } from '../src/config.js';

function charger() {
  const floor = new PaintSurface({ width: 20, height: 20, cells: 1 });
  floor.mesh.rotation.x = -Math.PI / 2;
  floor.mesh.updateMatrixWorld(true);
  floor.isFloor = true;
  return new Enemy({ position: new THREE.Vector3(), config: ENEMY.charger, parent: new THREE.Group(),
    floors: [floor], surfaces: [floor], blockers: [] });
}

/** How far the body's colour is from its rest colour toward blue, 0..1. */
function blueness(e) {
  const now = e.bodyMat.uniforms.uColour.value;
  const base = e._baseColour;
  const blue = new THREE.Color(PAINT.blue.hex);
  const full = Math.hypot(blue.r - base.r, blue.g - base.g, blue.b - base.b);
  return Math.hypot(now.r - base.r, now.g - base.g, now.b - base.b) / full;
}

const far = new THREE.Vector3(0, 0, 40);

test('#223: a frozen body is only lightly tinted — its shading survives', () => {
  const e = charger();
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) e.takeColourHit(PAINT_IDS.blue, 1, new THREE.Vector3());
  assert.ok(e._frozenTimer > 0, 'three blue hits freeze it');
  e.update(1 / 60, far);
  assert.ok(blueness(e) <= FROST.bodyTint + 1e-6, `frozen body is ${blueness(e).toFixed(2)} of the way to flat blue`);
});

test('#223: an ordinary hit still flashes at full strength', () => {
  const e = charger();
  e.takeColourHit(PAINT_IDS.blue, 1, new THREE.Vector3());
  e.update(1 / 60, far);
  assert.ok(blueness(e) > 0.9, 'the unfrozen hit flash is unchanged');
});

test('#223: the shell lets the body through head-on and bends toward the rim', () => {
  const src = createFrostMaterial(PAINT.blue.hex).fragmentShader;
  assert.match(src, /cover \*= mix\(/, 'cover is scaled by view angle');
  assert.ok(FROST.centreCover > 0 && FROST.centreCover < 1, 'head-on cover is partial, so the ice still reads');
});
