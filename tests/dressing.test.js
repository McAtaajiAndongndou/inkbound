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
import { Level01 } from '../src/levels/level-01-mission.js';
import { Level02 } from '../src/levels/level-02-ascent.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { ASCENT as AS } from '../src/levels/layouts/ascent.js';
import { ASCENT_KINDS } from '../src/levels/decor.js';
import { LAST_COLOUR as LC } from '../src/levels/layouts/last-colour.js';
import { DRESSING, PAINT, DANGER, MARKER, GATE, OUTSKIRTS, LAST_COLOUR as LC_TUNING } from '../src/config.js';

async function loaded(Level) {
  const level = new Level({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const box3 = ([x0, x1, y0, y1, z0, z1]) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
/** An item's box in the world: its `tilt` turns it about its centre (dressing.js). */
function worldBox(item) {
  const b = box3(item.box);
  if (!item.tilt) return b;
  const c = b.getCenter(new THREE.Vector3());
  const m = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...item.tilt)))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  return b.applyMatrix4(m);
}
/** A post, a leg, a rail or an arm: two of its three sizes 0.3 m or less. It cannot hide anything. */
const thin = ([x0, x1, y0, y1, z0, z1]) => [x1 - x0, y1 - y0, z1 - z0].filter((d) => d <= 0.3 + 1e-6).length >= 2;
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
  { name: 'The Ascent', Level: Level02, layout: AS, beacon: AS.landmarks[0].beacon },
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
      const b = worldBox(item);
      const wb = [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z];
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
      if (thin(item.box)) continue;
      for (const t of tops) {
        const [x0, x1, , y1, z0, z1] = t.box;
        const over = wb[0] < x1 && wb[1] > x0 && wb[4] < z1 && wb[5] > z0;
        if (!over || Math.abs(wb[2] - y1) > 0.05) continue;
        assert.ok(wb[3] - y1 <= LC_TUNING.props.maxFloorHeight + 1e-6, `${label} stands ${(wb[3] - y1).toFixed(1)} m tall on ${t.id}`);
      }
      // ...and nothing inside a walkable space below head height plus a bounce:
      // a non-colliding prop the player walks through is a bug, not dressing.
      for (const t of tops) {
        const [x0, x1, , y1, z0, z1] = t.box;
        const inside = wb[0] < x1 - 0.01 && wb[1] > x0 + 0.01 && wb[4] < z1 - 0.01 && wb[5] > z0 + 0.01;
        if (!inside || wb[2] < y1 - 0.05 || wb[2] >= y1 + 3 - 1e-6) continue;
        assert.ok(wb[3] - y1 <= LC_TUNING.props.maxFloorHeight + 1e-6, `${label} hangs into ${t.id}'s head room`);
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

// --- The Ascent ----------------------------------------------------------------

const treeMeshes = (level) => {
  const out = [];
  for (const d of Object.values(level.decor)) d.root.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
};

test('The Ascent: MegaKit trees, hand-placed off the fight floors, thinning with height', async () => {
  const level = await loaded(Level02);
  const trees = Object.entries(AS.dressing.trees).flatMap(([kind, list]) => list.map(([x, y, z]) => ({ kind, x, y, z })));
  assert.ok(trees.length >= 12);
  for (const d of Object.values(level.decor)) {
    assert.equal(d.root.parent, level.root);
    assert.ok(d.props.length > 0);
  }
  const points = Object.values(AS.routes).flat().map((q) => new THREE.Vector3(...q));
  const strips = AS.strips.map(stripBox);
  for (const t of trees) {
    const at = new THREE.Vector3(t.x, t.y, t.z);
    for (const q of points) assert.ok(at.distanceTo(q) >= 4, `tree at ${t.x},${t.z} is on the route`);
    for (const s of strips) assert.ok(s.distanceToPoint(at) >= 3, `tree at ${t.x},${t.z} is at a climb`);
    // On a catch shelf, or the trailhead's rim: never in a fight.
    const floor = AS.solids.find((s) => s.top && Math.abs(s.box[3] - t.y) < 1e-6
      && t.x > s.box[0] && t.x < s.box[1] && t.z > s.box[4] && t.z < s.box[5]);
    assert.ok(floor, `tree at ${t.x},${t.z} stands on nothing`);
    assert.ok(floor.kind === 'catch' || (floor.id === 'trailhead' && Math.abs(t.x) >= 17), `tree on ${floor.id}`);
    if (t.kind === 'pine') assert.ok(t.y <= 4, 'pines grow low');
  }
  assert.ok(!trees.some((t) => t.y >= 32), 'nothing on the summit or the ledge');
  for (const m of treeMeshes(level)) assert.ok(!level.surfaces.some((s) => s.mesh === m), 'a tree collides');
  // Trees are custom-shaded: aimed with the sun (AGENTS rule 5).
  assert.ok(level.palette.base.uniforms.uLightDir.value.distanceTo(level.sunDir) < 1e-6);
  level.dispose();
});

test('The Ascent: no tree hides the beacon from any room eye, and the budget holds with every model loaded', async () => {
  const level = await loaded(Level02);
  const beacon = AS.landmarks[0].beacon;
  for (const r of AS.rooms.filter((rm) => !rm.planned)) {
    if (blockedBySolids(r.eye.pos, beacon, AS.solids)) continue;
    assert.equal(clearSight(r.eye.pos, beacon, treeMeshes(level)), null, `${r.id}'s view of the beacon`);
  }
  // A loaded variant is one draw call per material (base and tint).
  const trees = Object.values(ASCENT_KINDS).reduce((n, k) => n + k.maxVariants * 2, 0);
  assert.ok(level.dressing.meshes.length + trees <= DRESSING.maxDrawCalls, `${level.dressing.meshes.length} + ${trees} draw calls`);
  // The range sits behind the base, never in front of it, from the summit.
  const R7 = AS.rooms.find((r) => r.id === 'R7').eye.pos;
  const base = AS.landmarks.find((l) => l.id === 'the-base-stack').box;
  assert.equal(clearSight(R7, [(base[0] + base[1]) / 2, base[3] - 2, (base[4] + base[5]) / 2], level.dressing.meshes), null);
  level.dispose();
});

test('The Ascent: ten reloads free the trees and their palette', async () => {
  let made = 0;
  let freed = 0;
  for (let i = 0; i < 10; i++) {
    const level = await loaded(Level02);
    const mats = new Set([level.palette.base, ...Object.values(level.palette.tint)]);
    for (const m of treeMeshes(level)) { made++; m.geometry.addEventListener('dispose', () => { freed++; }); }
    for (const m of mats) { made++; m.addEventListener('dispose', () => { freed++; }); }
    level.dispose();
  }
  assert.ok(made > 0);
  assert.ok(freed >= made, `${freed} of ${made} freed`);
});

// --- Outskirts -----------------------------------------------------------------

test('Outskirts: the skyline and the billboard are instanced, off every walkable floor, and clear of the beacon', async () => {
  const level = await loaded(Level01);
  const { meshes, items } = level.dressing;
  assert.ok(meshes.length <= DRESSING.maxDrawCalls);
  for (const m of meshes) {
    assert.ok(m.isInstancedMesh && m.parent === level.root);
    assert.ok(!level.surfaces.some((s) => s.mesh === m), 'collides');
  }
  // Nothing in the air over a floor the player walks (the forest shelves,
  // across 8 m of lethal lake, are backdrop and may be dressed).
  const walk = level.surfaces.filter((s) => s.isFloor && !s.shoulder).map((s) => {
    const b = new THREE.Box3().setFromObject(s.mesh);
    b.max.y += 6;
    return b;
  });
  const instance = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  for (const m of meshes) {
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, instance.matrix);
      instance.matrix.decompose(instance.position, instance.quaternion, instance.scale);
      instance.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(instance);
      for (const w of walk) assert.ok(!b.intersectsBox(w), `${m.name} #${i} is over the walk`);
    }
  }
  const b = OUTSKIRTS.beacon;
  const beacon = [b.x, b.top + 1.2, b.z];
  assert.equal(clearSight([level.spawn.x, level.spawn.y + 1.6, level.spawn.z], beacon, meshes), null);
  for (const shot of Level01.SHOTS) assert.equal(clearSight(shot.position, beacon, meshes), null, shot.name);
  // The billboard carries the pill, and the skyline is the Corp's silhouette.
  assert.ok(items.some((i) => i.kind === 'sign') && items.some((i) => i.kind === 'board'));
  assert.ok(items.filter((i) => i.kind === 'stack').length >= 2);
  level.dispose();
});

test('Outskirts: ten reloads free the dressing', async () => {
  let made = 0;
  let freed = 0;
  for (let i = 0; i < 10; i++) {
    const level = await loaded(Level01);
    for (const m of level.dressing.meshes) {
      made += 2;
      m.geometry.addEventListener('dispose', () => { freed++; });
      m.material.addEventListener('dispose', () => { freed++; });
    }
    level.dispose();
  }
  assert.ok(made > 0);
  assert.equal(freed, made);
});

test('The Ascent: a story cluster in the trailhead, both terraces and the summit', async () => {
  const level = await loaded(Level02);
  for (const room of ['R0', 'R2', 'R4', 'R7']) {
    assert.ok(level.dressing.items.some((i) => i.room === room), `${room} has no cluster`);
  }
  // The haul cables end in their anchors.
  for (const c of AS.curves.cables) {
    const foot = new THREE.Vector3(...c.points.at(-1));
    assert.ok(level.dressing.items.some((i) => i.kind === 'concrete' && box3(i.box).expandByScalar(0.1).containsPoint(foot)));
  }
  level.dispose();
});

