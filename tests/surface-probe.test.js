import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';

import { SurfaceProbe } from '../src/paint/surface-probe.js';
import { Level01 } from '../src/levels/level-01-mission.js';

async function setup() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  const floors = level.surfaces.filter((s) => s.isFloor);
  return { level, floors, probe: new SurfaceProbe(floors) };
}

test('the shared probe finds the same floor as a THREE.Raycaster would', async () => {
  const { floors, probe } = await setup();
  const floorMeshes = floors.map((s) => s.mesh);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 6);

  let checked = 0;
  // z is offset by 0.05 for the same reason as the player test: exactly on a
  // floor edge the raycast's triangle test includes one edge and misses the
  // other to float rounding, while the plane probe counts both.
  for (let x = -9; x <= 9; x += 1.5) {
    for (let z = -25.95; z <= 19; z += 0.5) {
      for (const y of [-1, 0, 2, 4, 6, 9, 11]) {
        const got = probe.down(new THREE.Vector3(x, y, z));

        ray.ray.origin.set(x, y + 0.5, z);
        const hit = ray.intersectObjects(floorMeshes, false)[0];

        const where = `at (${x}, ${y}, ${z})`;
        const want = hit ? floors.indexOf(hit.object.userData.paintSurface) : -1;
        const have = got ? floors.indexOf(got.surface) : -1;
        assert.equal(have, want, `different floor ${where}`);
        if (hit) assert.ok(Math.abs(got.y - hit.point.y) < 1e-6, `different height ${where}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000);
});

test('the probe returns one reused result object, not a fresh one', async () => {
  const { probe } = await setup();

  const a = probe.down(new THREE.Vector3(0, 0, 13));
  const b = probe.down(new THREE.Vector3(0, 0, 0));
  assert.ok(a && b);
  assert.equal(a, b, 'probe should reuse its scratch hit object');

  // over a gap there is nothing to return, and that must not be a stale hit
  assert.equal(probe.down(new THREE.Vector3(0, 0, 6)), null);
});

test('enemy.update allocates (almost) nothing per frame', async () => {
  const { level } = await setup();
  const [charger, sprayer] = level.enemies;
  const target = new THREE.Vector3(0, 2, 13);
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  const run = (n) => {
    for (let i = 0; i < n; i++) {
      // alternate between open floor, the island lip it is stopped at, and ice
      // so the steering branch, the refused-move branch and the frozen-heading
      // branch all get exercised
      if (i % 500 === 0) {
        charger.position.set(0, islandB.mesh.position.y,
          islandB.mesh.position.z + islandB.height / 2 - 0.3);
        sprayer.position.set(-4, 0, -14);
        islandB.splat(new THREE.Vector3(0, 0, islandB.mesh.position.z), 'blue', 30);
      }
      charger.update(1 / 60, target);
      sprayer.update(1 / 60, target);
    }
  };
  run(20000); // warm up the JIT first — cold code boxes numbers

  const session = new Session();
  session.connect();
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 256,
    includeObjectsCollectedByMinorGC: true,
    includeObjectsCollectedByMajorGC: true,
  });
  const FRAMES = 50000;
  run(FRAMES);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();

  // bytes allocated inside enemy.update (and anything it calls)
  let bytes = 0;
  (function walk(node, inUpdate) {
    const here = inUpdate || (node.callFrame.functionName === 'update' && node.callFrame.url.endsWith('enemy.js'));
    if (here) bytes += node.selfSize;
    node.children.forEach((c) => walk(c, here));
  })(profile.head, false);

  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 8, `enemy.update allocated ${perFrame.toFixed(1)} bytes/frame`);
});
