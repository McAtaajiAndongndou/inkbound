import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { Level01 } from '../src/levels/level-01-mission.js';

async function setup() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  const player = new Player(level.surfaces);
  player.position.copy(level.spawn);
  return { level, player };
}

test('ground probe finds the same floor as a THREE.Raycaster would', async () => {
  const { level, player } = await setup();
  const floors = level.surfaces.filter((s) => s.isFloor);
  const floorMeshes = floors.map((s) => s.mesh);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 6);

  let checked = 0;
  // sweep the whole corridor at several heights, including over the gaps,
  // at the platform/ledge overlaps, and off the sides.
  // z is offset by 0.05 so no sample sits EXACTLY on a floor edge: there the
  // raycast's triangle test includes one edge and misses the opposite one to
  // float rounding, while the probe counts both — a zero-width difference.
  for (let x = -9; x <= 9; x += 1.5) {
    for (let z = -25.95; z <= 19; z += 0.5) {
      for (const y of [-1, 0, 2, 4, 6, 9, 11]) {
        player.position.set(x, y, z);
        const got = player._probeGround();

        ray.ray.origin.set(x, y + 0.5, z);
        const hit = ray.intersectObjects(floorMeshes, false)[0];

        // compare plain values — asserting on PaintSurfaces makes node try to
        // print the whole level graph on failure
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

test('the per-frame contact objects are reused, not re-created', async () => {
  const { level, player } = await setup();
  const input = { isDown: (c) => c === 'KeyW' };
  const actions = { jump: false };

  player.position.set(0, 0, 13);
  const a = player._probeGround();
  player.position.set(0, 0, 0);
  const b = player._probeGround();
  assert.equal(a, b, 'ground probe should return the same scratch object');

  // walk into the wall twice
  const wall = level.surfaces.find((s) => !s.isFloor);
  player.position.set(0, 4, -18.7);
  player.update(1 / 60, input, actions);
  const first = player.touchingWall;
  player.position.set(0, 4, -18.7);
  player.update(1 / 60, input, actions);
  assert.ok(first, 'expected to be touching the wall');
  assert.equal(player.touchingWall, first, 'wall contact should be the same object each frame');
  assert.equal(player.touchingWall.surface, wall);

  const cell1 = wall.worldToCell(new THREE.Vector3(0, 6, -19));
  const cell2 = wall.worldToCell(new THREE.Vector3(1, 6, -19));
  assert.equal(cell1, cell2, 'worldToCell should reuse its result object');
});

test('player.update allocates (almost) nothing per frame', async () => {
  const { level, player } = await setup();
  const input = { isDown: (c) => c === 'KeyW' };
  const actions = { jump: false, toggleView: false, colour: null, restart: false };
  level.surfaces.find((s) => !s.isFloor).splat(new THREE.Vector3(0, 6.5, -19), 'green', 50);

  const run = (n) => {
    for (let i = 0; i < n; i++) {
      // alternate between open floor and pressed against the green wall
      if (i % 500 === 0) player.position.set(0, 0, i % 1000 === 0 ? 13 : -18.5);
      player.update(1 / 60, input, actions);
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

  // bytes allocated inside player.update (and anything it calls)
  let bytes = 0;
  (function walk(node, inUpdate) {
    const here = inUpdate || (node.callFrame.functionName === 'update' && node.callFrame.url.endsWith('player.js'));
    if (here) bytes += node.selfSize;
    node.children.forEach((c) => walk(c, here));
  })(profile.head, false);

  // Before this fix it was ~300 bytes/frame (a raycast hit + Math.hypot + wall
  // contact). One stray object per frame is ~16+ bytes, so 8 catches a regression.
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 8, `player.update allocated ${perFrame.toFixed(1)} bytes/frame`);
});
