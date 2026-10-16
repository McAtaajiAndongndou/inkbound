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

/**
 * Walls are looked up BY Z rather than as "the first surface that is not a floor".
 *
 * That shortcut broke the moment the tower landed (#39 #6): the first non-floor
 * surface became deck 1's 1.2 m face instead of the wall these tests were written
 * against, and both of them silently started testing nothing.
 */
// The PAINTABLE face at z. There are three surfaces stacked at the back wall
// (the rock base, the rock band and the one green band), so asking by z alone
// picks the wrong one — and painting an unpaintable surface is a no-op, which
// made this look like "the wall is not climbable".
const climbableAt = (level, z) => level.surfaces.find((s) => !s.isFloor && !s.unpaintable
  && Math.abs(s.mesh.position.z - z) < 1e-6);

test('the per-frame contact objects are reused, not re-created', async () => {
  const { level, player } = await setup();
  const input = { isDown: (c) => c === 'KeyW' };
  const actions = { jump: false };

  player.position.set(0, 0, 13);
  const a = player._probeGround();
  player.position.set(0, 0, 0);
  const b = player._probeGround();
  assert.equal(a, b, 'ground probe should return the same scratch object');

  // walk into the extraction climb twice — the wall at the top of island C
  const wall = climbableAt(level, -40);
  assert.ok(wall, 'expected a climb face at z=-40');
  player.position.set(7.5, 7.0, -39.6);
  player.update(1 / 60, input, actions);
  const first = player.touchingWall;
  player.position.set(7.5, 7.0, -39.6);
  player.update(1 / 60, input, actions);
  assert.ok(first, 'expected to be touching the wall');
  // IDENTITY, not assert.equal: a PaintSurface reaches the entire level through its
  // mesh's parent, so a failed deep-ish comparison makes node inspect hundreds of
  // megabytes of scene graph and take half a minute to say "not equal".
  assert.ok(player.touchingWall === first,
    'wall contact should be the same object each frame');
  assert.ok(player.touchingWall.surface === wall,
    `expected the wall at z=${wall.mesh.position.z}, hit `
    + `${player.touchingWall.surface ? 'z=' + player.touchingWall.surface.mesh.position.z : 'nothing'}`);

  const cell1 = wall.worldToCell(new THREE.Vector3(7.5, 9.5, -40));
  const cell2 = wall.worldToCell(new THREE.Vector3(9.0, 9.5, -40));
  assert.equal(cell1, cell2, 'worldToCell should reuse its result object');
});

test('player.update allocates (almost) nothing per frame', async () => {
  const { level, player } = await setup();
  const input = { isDown: (c) => c === 'KeyW' };
  const actions = { jump: false, toggleView: false, colour: null, restart: false };

  // Paint a climb face green and lean on it, so the CLIMB path is exercised too —
  // that branch runs `_resolveWalls` AND the wall-contact record every frame.
  const face = climbableAt(level, -40);
  assert.ok(face, 'expected a climb face at z=-40');
  face.splat(new THREE.Vector3(7.5, 9.5, -40), 'green', 50);
  assert.equal(face.surfaceAtWorld(new THREE.Vector3(7.5, 9.5, -40)).climbable, true,
    'the face must actually be green, or this test is not exercising the climb');

  const run = (n) => {
    for (let i = 0; i < n; i++) {
      // alternate between open floor and pressed against the green face
      if (i % 500 === 0) player.position.set(7.5, i % 1000 === 0 ? 7.0 : 7.2, -39.6);
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

  // Count only allocations made by player.js itself. A boxed double from a
  // three.js callee (Vector3.length(), Math.hypot's result, ...) lands on a
  // three.js frame, not on player.js, and whether the window runs optimised
  // code is not deterministic — counting the whole call subtree made this test
  // flap. See the same note in surface-probe.test.js.
  let bytes = 0;
  (function walk(node) {
    if (node.callFrame.url.endsWith('/core/player.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);

  // Before this fix it was ~300 bytes/frame (a raycast hit + Math.hypot + wall
  // contact). A real regression reads ~100+ bytes/frame, so 24 keeps plenty of
  // teeth. The floor is not 0 because player.js still uses `for...of` for the
  // enemies, floors and walls loops: an array iterator is a real allocation per
  // call until V8 optimises it away, worth ~9-10 bytes/frame here (measured on
  // _resolveWalls). Indexed loops in core would let this drop back to ~4.
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 24, `player.update allocated ${perFrame.toFixed(1)} bytes/frame`);
});
