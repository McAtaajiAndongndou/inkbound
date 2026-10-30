// The skyline's finish (Renda, 30 Oct, option A): it read as black walls close
// by. Far blocks now fade toward the level's drained horizon, and lit windows
// and chimney smoke are generated from the blocks and stacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildDressing, skylineDetail } from '../src/levels/dressing.js';
import { DRESSING, OUTSKIRTS, LAST_COLOUR } from '../src/config.js';
import { Level01 } from '../src/levels/level-01-mission.js';
import { Level03 } from '../src/levels/level-03-horde.js';

const block = { kind: 'block', box: [-20, 20, -40, 20, -130, -110] };   // far up -z: faces +z
const stack = { kind: 'stack', box: [30, 34, -40, 30, -120, -116] };

test('windows sit on the face toward the level, inside the block, above the ground', () => {
  const windows = skylineDetail([block]).filter((i) => i.kind === 'window');
  assert.ok(windows.length > 0, 'a 40 x 20 m face should have lit windows');
  for (const { box: [x0, x1, y0, y1, z0, z1] } of windows) {
    assert.ok(x0 >= -20 && x1 <= 20, 'inside the face');
    assert.ok(y0 >= DRESSING.skyline.windowMargin && y1 <= 20, 'above the ground, under the roof');
    assert.ok(z0 >= -110 - 1e-9 && z1 <= -110 + 0.2, 'on the +z face, the one toward the origin');
  }
  assert.deepEqual(skylineDetail([block]), skylineDetail([block]), 'the same windows every load');
});

test('smoke climbs and widens above each stack', () => {
  const puffs = skylineDetail([stack]).filter((i) => i.kind === 'smoke');
  assert.equal(puffs.length, DRESSING.skyline.smokePuffs);
  let lastY = 30;
  let lastW = 0;
  for (const { box: [x0, x1, y0, y1] } of puffs) {
    const y = (y0 + y1) / 2;
    assert.ok(y > lastY, 'each puff above the last');
    assert.ok(x1 - x0 > lastW, 'each puff wider than the last');
    lastY = y;
    lastW = x1 - x0;
  }
});

test('hazed kinds fade toward the horizon; windows do not', () => {
  const level = { root: new THREE.Group() };
  const horizon = 0x808080;
  const { meshes } = buildDressing(level, [block, { kind: 'window', box: [0, 1, 0, 1, 0, 1] }], { horizon });
  const boxes = meshes.find((m) => m.name === 'dressing:box|silhouette');
  const c = new THREE.Color();
  boxes.getColorAt(0, c);
  const expected = new THREE.Color(DRESSING.kinds.block.colour).lerp(new THREE.Color(horizon), DRESSING.skyline.haze);
  assert.ok(Math.abs(c.r - expected.r) < 1e-6 && Math.abs(c.g - expected.g) < 1e-6, 'the block is faded');
  boxes.getColorAt(1, c);
  assert.equal(c.getHex(), DRESSING.kinds.window.colour, 'a lit window cuts through the haze');
  // Without a horizon nothing fades (the Ascent's range and base keep their colours).
  const plain = buildDressing({ root: new THREE.Group() }, [block]).meshes[0];
  plain.getColorAt(0, c);
  assert.equal(c.getHex(), DRESSING.kinds.block.colour);
});

for (const [name, Level, mood] of [['Outskirts', Level01, OUTSKIRTS.mood], ['Last Colour', Level03, LAST_COLOUR.mood]]) {
  test(`${name}: its skyline has windows and smoke, faded toward its drained horizon`, async () => {
    const level = new Level({ scene: new THREE.Scene(), onWin: null });
    await level.load();
    const { items, meshes } = level.dressing;
    assert.ok(items.some((i) => i.kind === 'window'), 'lit windows');
    assert.ok(items.some((i) => i.kind === 'smoke'), 'chimney smoke');
    assert.ok(meshes.length <= DRESSING.maxDrawCalls);
    const boxes = meshes.find((m) => m.name === 'dressing:box|silhouette');
    const i = items.filter((it) => DRESSING.kinds[it.kind].shape === 'box' && DRESSING.kinds[it.kind].look === 'silhouette')
      .findIndex((it) => it.kind === 'block');
    const c = new THREE.Color();
    boxes.getColorAt(i, c);
    const expected = new THREE.Color(DRESSING.kinds.block.colour).lerp(new THREE.Color(mood.drained.horizon), DRESSING.skyline.haze);
    assert.ok(Math.abs(c.r - expected.r) < 1e-6, `${name}: the skyline is not faded toward its drained horizon`);
    level.dispose();
  });
}
