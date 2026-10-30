// The dressing pass (docs/levels/dressing-pass.md): set pieces off the arena
// floor. Its "Done when" asks, per level: every new mesh is under level.root,
// instanced, non-colliding and outside the keep-outs; no beacon sightline is
// blocked; ten reloads free it all; and nothing reads as paint or as amber.
// (The intro camera's path is mission-intro.test.js's, which already walks
// every mesh under root, the dressing included.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { buildDressing } from '../src/levels/dressing.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as LC } from '../src/levels/layouts/last-colour.js';
import { DRESSING, PAINT, DANGER, MARKER, GATE, LAST_COLOUR as LC_TUNING } from '../src/config.js';

async function loaded(Level) {
  const level = new Level({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const box3 = ([x0, x1, y0, y1, z0, z1]) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const stripBox = (s) => box3(s.face.endsWith('x')
  ? [s.at - 0.5, s.at + 0.5, s.y[0], s.y[1], s.span[0], s.span[1]]
  : [s.span[0], s.span[1], s.y[0], s.y[1], s.at - 0.5, s.at + 0.5]);

/** The ray from `eye` to `target` hits none of `meshes` before it gets there. */
function clearSight(eye, target, meshes) {
  const from = new THREE.Vector3(...eye);
  const to = new THREE.Vector3(...target);
  const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to) - 1.3);
  const hit = ray.intersectObjects(meshes, false)[0];
  return hit ? `${hit.object.name} at ${hit.point.toArray().map((v) => v.toFixed(1))}` : null;
}

/** Is the eye's line to `target` already blocked by one of the layout's solids? */
function blockedBySolids(eye, target, solids) {
  const from = new THREE.Vector3(...eye);
  const to = new THREE.Vector3(...target);
  const ray = new THREE.Ray(from, to.clone().sub(from).normalize());
  const at = new THREE.Vector3();
  return solids.some((s) => {
    const hit = ray.intersectBox(box3(s.box), at);
    return hit && hit.distanceTo(from) < from.distanceTo(to) - 1.3;
  });
}

// --- the builder ---------------------------------------------------------------

test('buildDressing: one instanced mesh per shape and look, coloured per instance, under root', () => {
  const level = { root: new THREE.Group() };
  const { meshes } = buildDressing(level, [
    { kind: 'rib', box: [0, 1, 0, 1, 0, 1] },
    { kind: 'cornice', box: [0, 1, 2, 3, 0, 1] },
    { kind: 'pipe', box: [0, 10, 0, 0.5, 0, 0.5] },
    { kind: 'block', box: [0, 1, 0, 1, 0, 1] },
  ]);
  assert.deepEqual(meshes.map((m) => m.name).sort(), ['dressing:box|silhouette', 'dressing:box|toon', 'dressing:round|toon']);
  const boxes = meshes.find((m) => m.name === 'dressing:box|toon');
  assert.equal(boxes.count, 2);
  const c = new THREE.Color();
  boxes.getColorAt(1, c);
  assert.equal(c.getHex(), DRESSING.kinds.cornice.colour);
  for (const m of meshes) {
    assert.ok(m.isInstancedMesh && m.parent === level.root);
    assert.ok(!m.material.isShaderMaterial, 'built-in materials: nothing joins the uLightDir pass');
  }
  assert.equal(meshes.find((m) => m.name === 'dressing:box|silhouette').material.fog, false, 'a skyline is never fogged away');
  assert.throws(() => buildDressing(level, [{ kind: 'nope', box: [0, 1, 0, 1, 0, 1] }]));
});

test('grey only: no dressing colour reads as a paint colour, as amber or as marker white', () => {
  const forbidden = [PAINT.blue.hex, PAINT.red.hex, PAINT.green.hex, DANGER.amber, MARKER.white].map((h) => new THREE.Color(h));
  const hsl = {};
  for (const [kind, spec] of Object.entries(DRESSING.kinds)) {
    const c = new THREE.Color(spec.colour);
    for (const f of forbidden) {
      const d = Math.hypot(c.r - f.r, c.g - f.g, c.b - f.b);
      assert.ok(d > 0.35, `${kind} is too close to ${f.getHexString()}`);
    }
    // Low saturation: grey. The one exception is the Corp's signage accent.
    if (spec.colour === GATE.field) continue;
    c.getHSL(hsl);
    assert.ok(hsl.s < 0.3, `${kind} is saturated (${hsl.s.toFixed(2)})`);
  }
});

// --- per level -----------------------------------------------------------------

const LEVELS = [
  { name: 'Last Colour', Level: Level03, layout: LC, beacon: LC.landmarks[0].beacon },
];

for (const { name, Level, layout, beacon } of LEVELS) {
  test(`${name}: dressing is instanced, under root, never a collider, within the draw-call budget`, async () => {
    const level = await loaded(Level);
    const { meshes, items } = level.dressing;
    assert.ok(items.length > 0);
    assert.ok(meshes.length <= DRESSING.maxDrawCalls, `${meshes.length} draw calls`);
    for (const m of meshes) {
      assert.ok(m.isInstancedMesh, `${m.name} is instanced`);
      let p = m;
      while (p.parent) p = p.parent;
      assert.equal(p, level.root, `${m.name} is under level.root`);
      assert.ok(!level.surfaces.some((s) => s.mesh === m), `${m.name} collides`);
    }
    // Instanced by shape and look: no two meshes share both.
    assert.equal(new Set(meshes.map((m) => m.name)).size, meshes.length);
    level.dispose();
  });

  test(`${name}: dressing keeps out of strips, route points and the arena floor`, async () => {
    const level = await loaded(Level);
    const strips = layout.strips.map((s) => ({ id: s.id, b: stripBox(s) }));
    const points = Object.values(layout.routes).flat().map((p) => new THREE.Vector3(...p));
    const tops = layout.solids.filter((s) => s.top);
    for (const item of level.dressing.items) {
      const b = box3(item.box);
      const label = `${item.kind} ${JSON.stringify(item.box)}`;
      for (const s of strips) assert.ok(!b.intersectsBox(s.b), `${label} overlaps strip ${s.id}`);
      for (const q of points) assert.ok(b.distanceToPoint(q) >= 1, `${label} is within 1 m of a route point`);
      // Standing on a floor: low enough not to hide a Drainer (the 1.2 m rule).
      // A `mount`ed piece hugs a solid (the Siphon's corner pipes): it hides
      // nothing the solid does not, so it must stay within 0.6 m of it.
      if (item.mount) {
        const host = layout.solids.find((s) => s.id === item.mount);
        assert.ok(host && box3(host.box).expandByScalar(0.6).containsBox(b), `${label} strays from ${item.mount}`);
        continue;
      }
      for (const t of tops) {
        const [x0, x1, , y1, z0, z1] = t.box;
        const over = item.box[0] < x1 && item.box[1] > x0 && item.box[4] < z1 && item.box[5] > z0;
        if (!over || Math.abs(item.box[2] - y1) > 0.05) continue;
        assert.ok(item.box[3] - y1 <= LC_TUNING.props.maxFloorHeight + 1e-6, `${label} stands ${(item.box[3] - y1).toFixed(1)} m tall on ${t.id}`);
      }
      // ...and nothing inside a walkable space below head height plus a bounce:
      // a non-colliding prop the player walks through is a bug, not dressing.
      for (const t of tops) {
        const [x0, x1, , y1, z0, z1] = t.box;
        const inside = item.box[0] < x1 - 0.01 && item.box[1] > x0 + 0.01 && item.box[4] < z1 - 0.01 && item.box[5] > z0 + 0.01;
        if (!inside || item.box[2] < y1 - 0.05 || item.box[2] >= y1 + 3 - 1e-6) continue;
        assert.ok(item.box[3] - y1 <= LC_TUNING.props.maxFloorHeight + 1e-6, `${label} hangs into ${t.id}'s head room`);
      }
    }
    level.dispose();
  });

  test(`${name}: no dressing blocks any room eye's view of the beacon`, async () => {
    const level = await loaded(Level);
    let checked = 0;
    for (const r of layout.rooms.filter((rm) => !rm.planned)) {
      if (blockedBySolids(r.eye.pos, beacon, layout.solids)) continue;
      checked++;
      assert.equal(clearSight(r.eye.pos, beacon, level.dressing.meshes), null, `${r.id}'s view of the beacon`);
    }
    assert.ok(checked >= 2, `${checked} rooms see the beacon`);
    level.dispose();
  });

  test(`${name}: ten reloads free every dressing mesh`, async () => {
    let made = 0;
    let freed = 0;
    for (let i = 0; i < 10; i++) {
      const level = await loaded(Level);
      for (const m of level.dressing.meshes) {
        made += 2;
        m.geometry.addEventListener('dispose', () => { freed++; });
        m.material.addEventListener('dispose', () => { freed++; });
      }
      level.dispose();
      assert.equal(level.root.children.length, 0);
    }
    assert.ok(made > 0);
    assert.equal(freed, made);
  });
}

// --- Last Colour ---------------------------------------------------------------

test('Last Colour: the beacon still clears the hangar from anywhere on the landing, trusses and cornices included', async () => {
  const level = await loaded(Level03);
  const [x0, x1, , y1, z0, z1] = LC.solids.find((s) => s.id === 'landing').box;
  for (let x = x0 + 1; x <= x1 - 1; x += 2) {
    for (let z = z0 + 1; z <= z1 - 1; z += 2) {
      const eye = [x, y1 + 1.5, z];
      if (blockedBySolids(eye, LC.landmarks[0].beacon, LC.solids)) continue;
      assert.equal(clearSight(eye, LC.landmarks[0].beacon, level.dressing.meshes), null, `from ${eye}`);
    }
  }
  level.dispose();
});

test('Last Colour: every wall is ribbed and capped, and the skyline stays below the Siphon\'s mast', async () => {
  const level = await loaded(Level03);
  const { items } = level.dressing;
  const walls = LC.solids.filter((s) => s.kind === 'wall');
  assert.equal(items.filter((i) => i.kind === 'cornice').length, walls.length, 'a cornice on every wall');
  assert.ok(items.filter((i) => i.kind === 'rib').length >= 40, 'ribs on the room faces');
  for (const rib of items.filter((i) => i.kind === 'rib')) assert.ok(rib.box[2] >= 3, 'ribs start 3 m up at least');
  const skyline = items.filter((i) => i.kind === 'block' || i.kind === 'stack');
  assert.ok(skyline.length >= 5);
  const mast = LC.landmarks[0].beacon[1];
  for (const s of skyline) assert.ok(s.box[3] < mast, `${JSON.stringify(s.box)} is taller than the mast`);
  assert.ok(items.some((i) => i.kind === 'truss'), 'the hangar has its roof frame');
  level.dispose();
});

test('Last Colour: every room has its story cluster', async () => {
  const level = await loaded(Level03);
  const kinds = new Set(['crate', 'machine', 'belt', 'pill', 'sign', 'glass', 'specimen', 'deck', 'bar', 'pipe']);
  for (const room of LC.rooms.map((r) => r.id)) {
    assert.ok(level.dressing.items.some((i) => i.room === room && kinds.has(i.kind)), `${room} has no cluster`);
  }
  // The specimens are behind glass, and the glass is see-through.
  const glass = level.dressing.meshes.find((m) => m.name === 'dressing:round|glass');
  assert.ok(glass && glass.material.transparent && glass.material.opacity < 0.5);
  level.dispose();
});
