// Loop pass step 7c (quality plan §3.2, Renda): "the paint from hipfire takes
// up wider surface area". Hip-fire splats are bigger; aimed splats are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { PaintGun } from '../src/paint/paint-gun.js';
import { PAINT_GUN } from '../src/config.js';

test('step 7c: a hip-fire splat is bigger than an aimed one', async () => {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  const radii = [];
  for (const s of level.surfaces) {
    const splat = s.splat.bind(s);
    s.splat = (point, colour, radius) => { radii.push(radius); return splat(point, colour, radius); };
  }
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 500);
  camera.position.set(0, 3.7, 21);
  camera.lookAt(0, 0, 9);
  camera.updateMatrixWorld(true);
  const gun = new PaintGun(level.surfaces, 'outskirts', []);   // no scene: shots land at once
  // Spread is random; centre every shot so both land on the same floor.
  const random = Math.random;
  Math.random = () => 0.5;

  assert.ok(gun.tryFire(camera, null, false), 'hip shot fired');
  const hip = radii.at(-1);
  gun.cooldown = 0;
  assert.ok(gun.tryFire(camera, null, true), 'aimed shot fired');
  const aimed = radii.at(-1);

  Math.random = random;
  assert.equal(hip, PAINT_GUN.hipRadius);
  assert.equal(aimed, PAINT_GUN.radius);
  assert.ok(hip > aimed, `hip ${hip} m should out-paint aimed ${aimed} m`);
  level.dispose();
});
