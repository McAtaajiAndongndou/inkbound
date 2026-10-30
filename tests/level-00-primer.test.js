// The BUILT Primer against its layout data — the same contract as the other
// data levels, plus the Primer's own: the floor already painted where the
// lessons need it, the Charger's gate, and a win that is never in free play.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { PRIMER as L } from '../src/levels/layouts/primer.js';
import { SURFACE } from '../src/config.js';

async function loaded(onWin = null) {
  const level = new Level00({ scene: new THREE.Scene(), onWin });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const boxOf = (s) => new THREE.Box3().setFromObject(s.mesh);
const normalOf = (s) => new THREE.Vector3(0, 0, 1).applyQuaternion(s.mesh.quaternion);

/** The surface rules (friction, bounce…) of the floor under a point. */
function groundAt(level, x, y, z) {
  const p = new THREE.Vector3(x, y, z);
  const floor = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y) < 1e-6 && s.worldToCell(p));
  return floor?.surfaceAtWorld(p);
}

test('the package: one Charger, one gate, every painted wall at its size', async () => {
  const level = await loaded();
  assert.equal(level.enemies.length, 1);
  assert.equal(level.gates.length, 1);
  const paintable = level.surfaces.filter((s) => !s.isFloor && !s.unpaintable);
  for (const strip of L.strips) {
    const area = paintable.filter((s) => s.strip === strip.id).reduce((a, s) => a + s.mesh.geometry.parameters.width * s.mesh.geometry.parameters.height, 0);
    assert.ok(Math.abs(area - (strip.span[1] - strip.span[0]) * (strip.y[1] - strip.y[0])) < 1e-6, `${strip.id} is not built at its size`);
  }
  assert.ok(paintable.every((s) => s.strip), 'a paintable wall that is not in the data');
  level.dispose();
});

test('the teaching examples are on the floor at load, and only there', async () => {
  const level = await loaded();
  for (const p of L.prepaint) {
    const [x0, x1, z0, z1] = p.rect;
    // Corners and centre of every rect read as that colour's physics.
    for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z1 - 0.1], [(x0 + x1) / 2, (z0 + z1) / 2]]) {
      assert.deepEqual(groundAt(level, x, p.y, z), SURFACE[p.colour], `${p.id} is not ${p.colour} at (${x}, ${z})`);
    }
  }
  // Beside the blue strip the run-up is still grey: the lesson is the contrast.
  assert.deepEqual(groundAt(level, 5, 0, 50), SURFACE.grey);
  level.dispose();
});

test('no two surfaces share a plane, and no wall faces into a solid', async () => {
  const level = await loaded();
  const all = level.surfaces.map((s) => ({ s, b: boxOf(s), n: normalOf(s) }));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const p = all[i];
      const q = all[j];
      if (Math.abs(Math.abs(p.n.dot(q.n)) - 1) > 1e-6) continue;
      const ov = new THREE.Box3().copy(p.b).intersect(q.b);
      if (ov.isEmpty()) continue;
      const d = ov.getSize(new THREE.Vector3()).toArray().sort((a, b) => a - b);
      assert.ok(!(d[0] < 1e-6 && d[1] > 1e-3 && d[2] > 1e-3), `${p.s.layoutId} and ${q.s.layoutId} overlap in one plane`);
    }
  }
  const boxes = L.solids.map(({ box: [x0, x1, y0, y1, z0, z1] }) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  for (const w of level.surfaces.filter((s) => !s.isFloor)) {
    const c = boxOf(w).getCenter(new THREE.Vector3()).addScaledVector(normalOf(w), 0.05);
    assert.ok(!boxes.some((b) => b.containsPoint(c)), `a ${w.layoutId} wall faces into a solid`);
  }
  level.dispose();
});

test("R7: the Charger wakes 3 s after you walk in, and the gate opens when it's gone", async () => {
  const level = await loaded();
  for (const e of level.enemies) e.update = () => {};
  const charger = level.roster[0].enemy;
  level.update(0.016, { position: new THREE.Vector3(0, 8, -10) });   // R6
  assert.equal(charger.sleeping, true);
  level.update(0.016, { position: new THREE.Vector3(0, 8, -30) });   // R7
  assert.equal(charger.sleeping, true, 'B5: the sergeant gets 3 s to finish his line first');
  level.update(3, { position: new THREE.Vector3(0, 8, -30) });
  assert.equal(charger.sleeping, false);
  assert.equal(level.gates[0].open, false);
  charger.alive = false;
  level.update(0.016, { position: new THREE.Vector3(0, 8, -30) });
  assert.equal(level.gates[0].open, true);
  level.dispose();
});

test('the win is at extraction, once, and never while the Charger stands', async () => {
  let wins = 0;
  const level = await loaded(() => { wins++; });
  for (const e of level.enemies) e.update = () => {};
  const pad = level.extraction.getCenter(new THREE.Vector3());
  level.update(0.016, { position: pad });
  assert.equal(wins, 0);
  level.roster[0].enemy.alive = false;
  level.update(0.016, { position: pad });
  level.update(0.016, { position: pad });
  assert.equal(wins, 1);
  // Free play is never the win: its whole floor is outside the volume.
  const r8 = L.solids.find((s) => s.id === 'r8-floor').box;
  assert.ok(!level.extraction.containsPoint(new THREE.Vector3((r8[0] + r8[1]) / 2, r8[3], (r8[4] + r8[5]) / 2)));
  level.dispose();
});

test('repeated load + dispose (R x10) never throws', async () => {
  for (let i = 0; i < 10; i++) (await loaded()).dispose();
});
