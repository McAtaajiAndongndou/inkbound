// The BUILT Last Colour against its layout data — the same contract as
// tests/level-02-ascent.test.js, plus the level's own behaviour: gates, the
// wave bays, and the two breaths (decision 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as L } from '../src/levels/layouts/last-colour.js';

async function loaded(onWin = null) {
  const level = new Level03({ scene: new THREE.Scene(), onWin });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const boxOf = (s) => new THREE.Box3().setFromObject(s.mesh);
const normalOf = (s) => new THREE.Vector3(0, 0, 1).applyQuaternion(s.mesh.quaternion);

test('the package: 30 enemies built, Big Arm placed but not spawned, four gates', async () => {
  const level = await loaded();
  assert.equal(level.enemies.length, L.enemies.filter((e) => !e.planned).length);
  assert.equal(level.enemies.length, 30);
  assert.ok(!level.roster.some((r) => r.data.planned), 'a planned enemy must not spawn as a stand-in');
  assert.equal(level.gates.length, L.gates.length);
  assert.ok(level.extraction instanceof THREE.Box3);
  level.dispose();
});

test('every climb strip is built as paint at exactly its size, and no other wall takes paint', async () => {
  const level = await loaded();
  const paintable = level.surfaces.filter((s) => !s.isFloor && !s.unpaintable);
  for (const strip of L.strips) {
    const parts = paintable.filter((s) => s.strip === strip.id);
    const area = parts.reduce((a, s) => a + s.mesh.geometry.parameters.width * s.mesh.geometry.parameters.height, 0);
    const want = (strip.span[1] - strip.span[0]) * (strip.y[1] - strip.y[0]);
    assert.ok(Math.abs(area - want) < 1e-6, `${strip.id}: built ${area} m², the data says ${want}`);
  }
  // The Siphon's plates (#100) are the other designed paint: one per target.
  const plates = paintable.filter((s) => s.siphon);
  assert.deepEqual(plates.map((s) => s.siphon).sort(), L.targets.map((t) => t.id).sort());
  assert.ok(paintable.every((s) => s.strip || s.siphon), 'a paintable wall that is not a strip is a climb nobody designed');
  level.dispose();
});

test('no two surfaces overlap in the same plane', async () => {
  const level = await loaded();
  const all = level.surfaces.map((s) => ({ s, b: boxOf(s), n: normalOf(s) }));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const p = all[i];
      const q = all[j];
      if (Math.abs(Math.abs(p.n.dot(q.n)) - 1) > 1e-6) continue;
      const ov = new THREE.Box3().copy(p.b).intersect(q.b);
      if (ov.isEmpty()) continue;
      const size = ov.getSize(new THREE.Vector3());
      const d = [size.x, size.y, size.z].sort((a, b) => a - b);
      assert.ok(!(d[0] < 1e-6 && d[1] > 1e-3 && d[2] > 1e-3), `${p.s.layoutId} and ${q.s.layoutId} overlap in one plane`);
    }
  }
  level.dispose();
});

test('no wall faces into solid steel', async () => {
  const level = await loaded();
  const boxes = L.solids.map(({ box: [x0, x1, y0, y1, z0, z1] }) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  for (const w of level.surfaces.filter((s) => !s.isFloor)) {
    const c = boxOf(w).getCenter(new THREE.Vector3()).addScaledVector(normalOf(w), 0.05);
    assert.ok(!boxes.some((b) => b.containsPoint(c)), `a ${w.layoutId} wall faces into steel`);
  }
  level.dispose();
});

test('every walkable top in the data is a floor in the level', async () => {
  const level = await loaded();
  const fl = level.surfaces.filter((s) => s.isFloor).map(boxOf);
  for (const s of L.solids.filter((x) => x.top)) {
    const [x0, x1, , y1, z0, z1] = s.box;
    for (const [fx, fz] of [[0.5, 0.5], [0.1, 0.9], [0.9, 0.1]]) {
      const x = x0 + (x1 - x0) * fx;
      const z = z0 + (z1 - z0) * fz;
      const covered = L.solids.some((o) => o !== s && o.box[2] <= y1 + 1e-6 && o.box[3] > y1 + 1e-6
        && x >= o.box[0] && x <= o.box[1] && z >= o.box[4] && z <= o.box[5]);
      if (covered) continue;
      assert.ok(fl.some((b) => Math.abs(b.max.y - y1) < 1e-6 && x >= b.min.x - 1e-6 && x <= b.max.x + 1e-6 && z >= b.min.z - 1e-6 && z <= b.max.z + 1e-6),
        `${s.id}: no floor at (${x.toFixed(1)}, ${y1}, ${z.toFixed(1)})`);
    }
  }
  level.dispose();
});

// --- behaviour: enemy AI frozen, so these are about the triggers alone -------

function freeze(level) {
  for (const e of level.enemies) e.update = () => {};
}
const at = (level, p, dt = 0.016) => level.update(dt, { position: new THREE.Vector3(...p) });
const gate = (level, id) => level.gates.find((g) => g.data.id === id);
const kill = (level, pred) => { for (const r of level.roster) if (pred(r.data)) r.enemy.alive = false; };
const HANGAR = [0, 0, 60];
const CORE = [0, 0, -24];

test('the hangar: wave one wakes as you drop in; the corridor gate holds until it is gone', async () => {
  const level = await loaded();
  freeze(level);
  at(level, [0, 3, 86]);   // on the landing
  assert.ok(level.roster.filter((r) => r.data.wave === 1 && r.data.room === 'R1').every((r) => r.enemy.sleeping), 'nothing wakes on the landing');

  at(level, HANGAR);
  assert.ok(level.roster.filter((r) => r.data.room === 'R1').every((r) => !r.enemy.sleeping));
  assert.equal(gate(level, 'gate-corridor').open, false);

  kill(level, (d) => d.room === 'R1');
  at(level, HANGAR);
  assert.equal(gate(level, 'gate-corridor').open, true);
  assert.ok(gate(level, 'gate-corridor').collider.mesh.position.y < -50, 'an open gate is out of every wall test');
  level.dispose();
});

test('the Core: the bays open as you walk in; wave three waits 8 s after wave two', async () => {
  const level = await loaded();
  freeze(level);
  assert.equal(gate(level, 'gate-bay-w').open, false);
  at(level, CORE);
  assert.equal(gate(level, 'gate-bay-w').open, true);
  assert.equal(gate(level, 'gate-bay-e').open, true);
  const w3 = level.roster.filter((r) => r.data.wave === 3);
  assert.ok(level.roster.filter((r) => r.data.wave === 2).every((r) => !r.enemy.sleeping), 'wave two pours in');
  assert.ok(w3.every((r) => r.enemy.sleeping), 'wave three is still standing at the back');

  kill(level, (d) => d.room === 'R3' && d.wave === 2);
  at(level, CORE, 1);   // this tick SEES wave two gone: the 8 s count starts here
  at(level, CORE, 7.5);
  assert.ok(w3.every((r) => r.enemy.sleeping), 'wave three must wait out the breath (7.5 s in)');
  at(level, CORE, 1);
  assert.ok(w3.every((r) => !r.enemy.sleeping), 'wave three comes in after 8 s');
  level.dispose();
});

test("Big Arm's gate pulses for 12 s once wave three is gone, then drops", async () => {
  const level = await loaded();
  freeze(level);
  at(level, CORE);
  kill(level, (d) => d.room === 'R3' && d.wave === 2);
  at(level, CORE, 9);   // wave three wakes
  const north = gate(level, 'gate-bay-n');
  kill(level, (d) => d.room === 'R3' && d.wave === 3);

  const opacities = [];
  for (let t = 0; t < 11; t += 0.1) {
    at(level, CORE, 0.1);
    opacities.push(north.field.material.opacity);
  }
  assert.equal(north.open, false, 'still warning at 11 s');
  assert.ok(Math.max(...opacities) - Math.min(...opacities) > 0.3, 'the field must visibly pulse during the warning');

  at(level, CORE, 1.5);
  assert.equal(north.open, true);
  level.dispose();
});

test('reaching the intake is no longer the win: a clear Core starts the Siphon instead', async () => {
  let wins = 0;
  const level = await loaded(() => { wins++; });
  freeze(level);
  const intake = level.extraction.getCenter(new THREE.Vector3()).toArray();
  at(level, intake);
  assert.equal(level.siphon.phase, 'dormant', 'not while the Core still holds its waves');
  kill(level, (d) => d.room === 'R3');
  at(level, intake);
  at(level, intake);
  assert.equal(wins, 0, 'the old placeholder win is gone (#100)');
  assert.equal(level.siphon.phase, 'intake', 'the exam has begun');
  level.dispose();
});

test('repeated load + dispose (R x10) never throws', async () => {
  for (let i = 0; i < 10; i++) (await loaded()).dispose();
});
