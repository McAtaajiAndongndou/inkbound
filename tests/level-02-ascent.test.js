// The BUILT Ascent: does the level match its layout data, exactly?
// (tests/ascent-layout.test.js checks the data against the physics; this file
// checks the build against the data, so the two together cover design → game.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level02 } from '../src/levels/level-02-ascent.js';
import { ASCENT } from '../src/levels/layouts/ascent.js';

async function loaded(onWin = null) {
  const level = new Level02({ scene: new THREE.Scene(), onWin });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const boxOf = (s) => new THREE.Box3().setFromObject(s.mesh);
const normalOf = (s) => new THREE.Vector3(0, 0, 1).applyQuaternion(s.mesh.quaternion);
const walls = (l) => l.surfaces.filter((s) => !s.isFloor);
const floors = (l) => l.surfaces.filter((s) => s.isFloor);

test('the level package is complete: surfaces, win volume, 13 enemies', async () => {
  const level = await loaded();
  assert.ok(level.surfaces.length > 0);
  assert.ok(level.extraction instanceof THREE.Box3);
  assert.equal(level.enemies.length, ASCENT.enemies.length);
  assert.ok(level.surfaces.every((s) => typeof s.isFloor === 'boolean'));
  level.dispose();
});

test('every climb strip is built as paint, exactly its size, and no other wall takes paint', async () => {
  const level = await loaded();
  const paintable = walls(level).filter((s) => !s.unpaintable);
  for (const strip of ASCENT.strips) {
    const parts = paintable.filter((s) => s.strip === strip.id);
    assert.ok(parts.length > 0, `${strip.id} was not built`);
    const area = parts.reduce((a, s) => a + s.mesh.geometry.parameters.width * s.mesh.geometry.parameters.height, 0);
    const want = (strip.span[1] - strip.span[0]) * (strip.y[1] - strip.y[0]);
    assert.ok(Math.abs(area - want) < 1e-6, `${strip.id}: built ${area} m², the data says ${want}`);
  }
  assert.ok(paintable.every((s) => s.strip), 'a paintable wall that is not a strip is a climb nobody designed');
  level.dispose();
});

test('no two surfaces overlap in the same plane (no z-fighting, no doubled collider)', async () => {
  const level = await loaded();
  const all = level.surfaces.map((s) => ({ s, b: boxOf(s), n: normalOf(s) }));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const p = all[i];
      const q = all[j];
      if (Math.abs(Math.abs(p.n.dot(q.n)) - 1) > 1e-6) continue;   // not parallel
      const ov = new THREE.Box3().copy(p.b).intersect(q.b);
      if (ov.isEmpty()) continue;
      const size = ov.getSize(new THREE.Vector3());
      const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
      // Same plane AND a real shared area (not just a shared edge).
      assert.ok(!(dims[0] < 1e-6 && dims[1] > 1e-3 && dims[2] > 1e-3),
        `${p.s.layoutId} and ${q.s.layoutId} overlap in one plane`);
    }
  }
  level.dispose();
});

test('no wall is buried inside the mountain: every wall faces open air', async () => {
  const level = await loaded();
  const boxes = [...ASCENT.solids, ...ASCENT.kerbs].map(({ box: [x0, x1, y0, y1, z0, z1] }) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  for (const w of walls(level)) {
    const c = boxOf(w).getCenter(new THREE.Vector3()).addScaledVector(normalOf(w), 0.05);
    const inside = boxes.find((b) => b.containsPoint(c));
    assert.ok(!inside, `a ${w.layoutId} wall faces into solid rock at ${c.toArray().map((v) => v.toFixed(1))}`);
  }
  level.dispose();
});

test('every walkable top in the data is a floor in the level', async () => {
  const level = await loaded();
  const fl = floors(level).map((s) => ({ b: boxOf(s) }));
  const boxes = [...ASCENT.solids, ...ASCENT.kerbs];
  for (const s of ASCENT.solids.filter((x) => x.top)) {
    const [x0, x1, , y1, z0, z1] = s.box;
    for (const [fx, fz] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.9]]) {
      const x = x0 + (x1 - x0) * fx;
      const z = z0 + (z1 - z0) * fz;
      // A point something else stands on is not floor, correctly.
      const coveredBy = boxes.find((o) => o !== s && o.box[2] <= y1 + 1e-6 && o.box[3] > y1 + 1e-6
        && x >= o.box[0] && x <= o.box[1] && z >= o.box[4] && z <= o.box[5]);
      if (coveredBy) continue;
      const hit = fl.find(({ b }) => Math.abs(b.max.y - y1) < 1e-6 && x >= b.min.x - 1e-6 && x <= b.max.x + 1e-6 && z >= b.min.z - 1e-6 && z <= b.max.z + 1e-6);
      assert.ok(hit, `${s.id}: no floor at (${x.toFixed(1)}, ${y1}, ${z.toFixed(1)})`);
    }
  }
  level.dispose();
});

test('turrets start awake; everything else waits', async () => {
  const level = await loaded();
  for (const { data, enemy } of level.roster) {
    assert.equal(enemy.sleeping, data.wake !== 'always', `${data.id}: wrong starting state`);
  }
  level.dispose();
});

/** Stand the player at a point and tick once. Enemy AI is frozen: this is about triggers. */
function tickAt(level, p) {
  level.update(0.016, { position: new THREE.Vector3(...p) });
}
function freeze(level) {
  for (const e of level.enemies) e.update = () => {};
}

test('Terrace One: wave 1 wakes on entry; wave 2 only once wave 1 is gone', async () => {
  const level = await loaded();
  freeze(level);
  const byId = Object.fromEntries(level.roster.map((r) => [r.data.id, r.enemy]));

  tickAt(level, [0, 12, 36]);   // on Terrace One
  assert.equal(byId['e1-w1-a'].sleeping, false);
  assert.equal(byId['e1-w1-b'].sleeping, false);
  assert.equal(byId['e1-w2-a'].sleeping, true, 'wave 2 must wait for wave 1');

  byId['e1-w1-a'].alive = false;
  tickAt(level, [0, 12, 36]);
  assert.equal(byId['e1-w2-a'].sleeping, true, 'one of wave 1 is still up');

  byId['e1-w1-b'].alive = false;
  tickAt(level, [0, 12, 36]);
  assert.equal(byId['e1-w2-a'].sleeping, false);
  assert.equal(byId['e1-w2-b'].sleeping, false);
  level.dispose();
});

test('the ledge: the second Charger waits for the first; the lift waits for both', async () => {
  let wins = 0;
  const level = await loaded(() => { wins++; });
  freeze(level);
  const byId = Object.fromEntries(level.roster.map((r) => [r.data.id, r.enemy]));

  tickAt(level, [-28.5, 32, -10]);
  assert.equal(byId.c1.sleeping, false);
  assert.equal(byId.c2.sleeping, true);

  // Knocked off the ridge onto the catch shelf: that is the clean kill.
  byId.c1.position.set(-34, 26, -10);
  tickAt(level, [-28.5, 32, -10]);
  assert.equal(byId.c2.sleeping, false);

  const lift = ASCENT.slabs.find((s) => s.kind === 'lift');
  const onLift = [(lift.x[0] + lift.x[1]) / 2, lift.y, (lift.z[0] + lift.z[1]) / 2];
  tickAt(level, onLift);
  assert.equal(wins, 0, 'the lift must not leave while a Charger holds the ledge');

  byId.c2.alive = false;
  tickAt(level, onLift);
  tickAt(level, onLift);
  assert.equal(wins, 1, 'the win fires once');
  level.dispose();
});

test('repeated load + dispose (R x10) never throws', async () => {
  for (let i = 0; i < 10; i++) {
    const level = await loaded();
    level.dispose();
  }
});
