// Loop pass step 3b (Renda's idea, #240): a shot that hits an enemy used to
// paint nothing. It now drips a small splat of its colour on the floor just
// past the enemy along the shot, never under its feet.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { PaintGun } from '../src/paint/paint-gun.js';
import { PAINT_GUN, PAINT_IDS } from '../src/config.js';

/** The Primer's R7 Charger, and a gun aimed at it from 15 m down the hall. */
async function setup(colourIndex = 0) {
  const level = new Level00({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  const charger = level.enemies[0];
  const gun = new PaintGun(level.surfaces, 'primer', level.enemies);   // no scene: shots land at once
  gun.selectColour?.(colourIndex);
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 500);
  camera.position.set(charger.position.x, charger.position.y + 1.5, charger.position.z + 15);
  camera.lookAt(charger.position.x, charger.position.y + 0.9, charger.position.z);
  camera.updateMatrixWorld(true);
  const floor = (x, z) => {
    const p = new THREE.Vector3(x, charger.position.y, z);
    const s = level.surfaces.find((f) => f.isFloor && f.worldToCell(p) && Math.abs(f.mesh.position.y - p.y) < 1e-6);
    return s ? s.paintIdAtWorld(p) : null;
  };
  return { level, charger, gun, camera, floor };
}

test('step 3b: a hit drips its colour on the floor just past the enemy', async () => {
  const { level, charger, gun, camera, floor } = await setup(0);
  const { x, z } = charger.position;
  assert.equal(floor(x, z - PAINT_GUN.hitDripOffset), PAINT_IDS.grey, 'the floor behind it starts grey');
  assert.ok(gun.tryFire(camera, null, true), 'the shot fired');
  assert.equal(gun.lastShot, 'hit');
  assert.equal(floor(x, z - PAINT_GUN.hitDripOffset), PAINT_IDS[gun.colour], 'no drip behind the enemy');
  assert.equal(floor(x, z), PAINT_IDS.grey, 'the drip landed under its feet: the floor would proc on every hit');
  level.dispose();
});

test('step 3b: the drip is small: kills stay the big refill', () => {
  assert.ok(PAINT_GUN.hitDrip > 0 && PAINT_GUN.hitDrip < 1, `hitDrip ${PAINT_GUN.hitDrip} m`);
  assert.ok(PAINT_GUN.hitDripOffset > PAINT_GUN.hitDrip, 'the drip must clear the enemy');
});
