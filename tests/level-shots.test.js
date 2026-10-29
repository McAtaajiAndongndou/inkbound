import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { LEVELS } from '../src/levels/index.js';
import { autoShots, levelShots, levelBounds, EYE_HEIGHT } from '../src/levels/level-shots.js';

function makeGame() {
  return { scene: new THREE.Scene(), onWin: null };
}

async function loaded(entry) {
  const level = entry.create(makeGame());
  await level.load();
  return level;
}

const finite = (arr) => arr.length === 3 && arr.every(Number.isFinite);

test('every registered level gets the auto shots, stubs included', async () => {
  for (const entry of LEVELS) {
    const level = await loaded(entry);
    const names = levelShots(level).map((s) => s.name);
    for (const required of ['spawn', 'overview', 'top']) {
      assert.ok(names.includes(required), `${entry.id} is missing the "${required}" shot`);
    }
    level.dispose();
  }
});

test('every shot is finite data with a name and a distinct target', async () => {
  for (const entry of LEVELS) {
    const level = await loaded(entry);
    const shots = levelShots(level);
    assert.equal(new Set(shots.map((s) => s.name)).size, shots.length, `${entry.id}: shot names must be unique`);
    for (const s of shots) {
      assert.ok(typeof s.name === 'string' && s.name, `${entry.id}: a shot needs a name`);
      assert.ok(finite(s.position) && finite(s.target), `${entry.id}/${s.name}: position and target must be [x,y,z]`);
      const d = new THREE.Vector3(...s.position).distanceTo(new THREE.Vector3(...s.target));
      assert.ok(d > 0.5, `${entry.id}/${s.name}: a camera on its own target has no direction`);
    }
    level.dispose();
  }
});

/**
 * Everything the camera would see as SOLID: visible, opaque meshes. Not the
 * paint surfaces — a gate's collider is a surface the player never sees, while
 * the concrete lintel above it is plain geometry that blocks the view. Left out:
 * anything transparent (gate curtains, the win marker, mist), the atmosphere
 * group, and instanced decor, which is scattered dressing rather than layout.
 */
function solidMeshes(level) {
  const out = [];
  level.root.traverseVisible((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    for (let p = o; p; p = p.parent) if (p === level.atmosphere) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !m || m.transparent)) return;
    out.push(o);
  });
  return out;
}

/**
 * How far along the view line the first solid thing is, as a fraction of the
 * camera-to-target distance (Infinity if nothing is hit). Surfaces are single
 * planes, so a "solid" block is six faces with nothing inside them — an
 * inside-the-box test cannot work. A ray can: double-sided proxies, so a
 * camera inside a block hits the face it is looking out through.
 */
function firstBlock(level, shot) {
  level.root.updateMatrixWorld(true);
  const proxyMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const proxies = solidMeshes(level).map((s) => {
    const m = new THREE.Mesh(s.geometry, proxyMat);
    m.matrixAutoUpdate = false;
    m.matrixWorld.copy(s.matrixWorld);
    return m;
  });
  const from = new THREE.Vector3(...shot.position);
  const to = new THREE.Vector3(...shot.target);
  const dist = from.distanceTo(to);
  const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, dist);
  const hits = ray.intersectObjects(proxies, false);
  proxyMat.dispose();
  return hits.length ? hits[0].distance / dist : Infinity;
}

test('every shot can see down its own view line', async () => {
  // The failure this catches: a shot that renders one wall face — the camera
  // inside a block, or parked behind a gate — which looks like "the level is
  // broken" when it is only the camera that is. Hitting something in the far
  // half is fine: a view aimed at a floor or a pillar ends ON it.
  for (const entry of LEVELS) {
    const level = await loaded(entry);
    for (const s of levelShots(level)) {
      const at = firstBlock(level, s);
      assert.ok(at >= 0.5, `${entry.id}/${s.name}: view blocked ${Math.round(at * 100)}% of the way to its target`);
    }
    level.dispose();
  }
});

test('the view-line check fails a camera inside a block or behind a wall', async () => {
  // Kept so the check above cannot quietly become a no-op again (its first
  // version tested "inside a Box3", which every flat surface skipped).
  const level = await loaded(LEVELS.find((l) => l.id === 'outskirts'));
  const insideDeck = { position: [7, 2, -4], target: [0, 0, 0] };
  const behindGateC = { position: [-3, 8, -22], target: [0, 6, -38] };   // the first 'pillars' shot
  assert.ok(firstBlock(level, insideDeck) < 0.5, 'a camera inside island B\'s deck must be caught');
  assert.ok(firstBlock(level, behindGateC) < 0.5, 'a camera behind gate C must be caught');
  level.dispose();
});

test('the spawn shot is at player eye height above spawn', async () => {
  const level = await loaded(LEVELS.find((l) => l.id === 'outskirts'));
  const spawn = autoShots(level).find((s) => s.name === 'spawn');
  assert.deepEqual(
    spawn.position,
    [level.spawn.x, level.spawn.y + EYE_HEIGHT, level.spawn.z].map((n) => Math.round(n * 100) / 100),
  );
  // Looking ahead, not at the floor: a level judged from a downward view
  // hides exactly the sightlines the shot is for.
  assert.equal(spawn.target[1], spawn.position[1]);
  level.dispose();
});

test('the high shots drop the fog; the eye shot keeps it', async () => {
  const level = await loaded(LEVELS.find((l) => l.id === 'outskirts'));
  const byName = Object.fromEntries(autoShots(level).map((s) => [s.name, s]));
  assert.equal(byName.top.fog, false);
  assert.equal(byName.overview.fog, false);
  assert.notEqual(byName.spawn.fog, false);
  level.dispose();
});

test('the route bounds leave out the backdrop shelves', async () => {
  const level = await loaded(LEVELS.find((l) => l.id === 'outskirts'));
  const bounds = levelBounds(level);
  const shelf = level.surfaces.find((s) => s.isFloor && s.shoulder);
  assert.ok(shelf, 'Outskirts should still have backdrop shelves for this test to mean anything');
  const shelfBox = new THREE.Box3().setFromObject(shelf.mesh);
  assert.ok(
    shelfBox.max.x > bounds.max.x + 0.01 || shelfBox.min.x < bounds.min.x - 0.01,
    'a shelf inside the route bounds means the top shot is framing scenery',
  );
  level.dispose();
});

test("an authored shot replaces the auto shot of the same name", async () => {
  const level = await loaded(LEVELS.find((l) => l.id === 'outskirts'));
  const original = level.constructor.SHOTS;
  const custom = { name: 'top', position: [1, 2, 3], target: [0, 0, 0] };
  try {
    level.constructor.SHOTS = [custom];
    const tops = levelShots(level).filter((s) => s.name === 'top');
    assert.equal(tops.length, 1);
    assert.deepEqual(tops[0].position, [1, 2, 3]);
  } finally {
    level.constructor.SHOTS = original;
    level.dispose();
  }
});
