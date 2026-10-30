// #198 — curves, flat versus smooth shading, and placed lights.
//
// Before: no Curve, TubeGeometry or LatheGeometry anywhere in src/, flat
// shading in one place, and no point lights placed. These tests pin the
// cable's sag, the curves each level must contain, the draw-call budget, the
// beacon sightlines the new geometry must not block, the shading split, the
// placed lights and the dispose contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { cable } from '../src/levels/curves.js';
import { Level00 } from '../src/levels/level-00-the-primer.js';
import { Level01 } from '../src/levels/level-01-mission.js';
import { Level02 } from '../src/levels/level-02-ascent.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as LC } from '../src/levels/layouts/last-colour.js';
import { ASCENT as AS } from '../src/levels/layouts/ascent.js';
import { pointLights } from '../src/shaders/point-lights.js';
import { CURVES, PLACED_LIGHTS, DANGER, MARKER, GATE, OUTSKIRTS } from '../src/config.js';

async function loaded(Level) {
  const level = new Level({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}

const isTube = (g) => g?.type === 'TubeGeometry' || g?.userData?.mergedFrom === 'TubeGeometry';
const meshes = (level, test) => {
  const out = [];
  level.root.traverse((o) => { if (o.isMesh && test(o)) out.push(o); });
  return out;
};

test('cable(): the midpoint sags below the straight line by the configured amount', () => {
  const a = [0, 10, 0];
  const b = [20, 6, 0];
  for (const sag of [CURVES.sag, 3]) {
    const geo = cable([a, b], 0.1, sag);
    assert.equal(geo.type, 'TubeGeometry');
    const mid = geo.parameters.path.getPoint(0.5);
    const straight = (a[1] + b[1]) / 2;
    assert.ok(Math.abs(straight - mid.y - sag) < 1e-6, `dips ${straight - mid.y}, wanted ${sag}`);
    assert.ok(Math.abs(mid.x - 10) < 1e-6);
    // ...and the ends are where they were asked to be.
    assert.ok(geo.parameters.path.getPoint(0).distanceTo(new THREE.Vector3(...a)) < 1e-6);
    assert.ok(geo.parameters.path.getPoint(1).distanceTo(new THREE.Vector3(...b)) < 1e-6);
    geo.dispose();
  }
  assert.equal(cable([a, b]).parameters.radius, CURVES.radius, 'defaults come from config');
});

for (const [name, Level] of [['Outskirts', Level01], ['The Ascent', Level02], ['Last Colour', Level03]]) {
  test(`${name}: has tubes, at most 2 cable draw calls, and none of them collide`, async () => {
    const level = await loaded(Level);
    const tubes = meshes(level, (o) => isTube(o.geometry));
    assert.ok(tubes.length >= 1, 'at least one TubeGeometry');
    assert.ok(tubes.length <= 2, `${tubes.length} cable draw calls`);
    for (const t of tubes) {
      assert.ok(!level.surfaces.some((s) => s.mesh === t), 'a cable is never a collider');
      assert.ok(!t.material.flatShading, 'cables are curves: smooth');
    }
    level.dispose();
  });
}

test('Last Colour: the vats and the Siphon tank are lathes, flat-shaded', async () => {
  const level = await loaded(Level03);
  const lathes = meshes(level, (o) => o.geometry.type === 'LatheGeometry');
  assert.ok(lathes.length >= 3, 'two vats and a tank');
  for (const l of lathes) assert.equal(l.material.flatShading, true, 'Corp machinery is faceted');
  assert.ok(level.root.getObjectByName('siphon-tank'));
  level.dispose();
});

test('flat versus smooth: Corp props and scree are flat, paint stays smooth', async () => {
  const level = await loaded(Level02);
  const props = level.props?.meshes ?? meshes(level, (o) => o.name?.startsWith('props:'));
  const toon = props.filter((m) => m.material.isMeshToonMaterial);
  assert.ok(toon.some((m) => m.name === 'props:rock'), 'the Ascent has scree');
  for (const m of toon) assert.equal(m.material.flatShading, true, `${m.name} is flat-shaded`);
  for (const s of level.surfaces) assert.ok(!s.material.flatShading, 'paint is never flat-shaded');
  level.dispose();
});

/** Is the eye's line to `target` already blocked by one of the layout's solid boxes? */
function blockedBySolids(eye, target, solids) {
  const from = new THREE.Vector3(...eye);
  const to = new THREE.Vector3(...target);
  const ray = new THREE.Ray(from, to.clone().sub(from).normalize());
  const at = new THREE.Vector3();
  return solids.some(({ box: [x0, x1, y0, y1, z0, z1] }) => {
    const hit = ray.intersectBox(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), at);
    return hit && hit.distanceTo(from) < from.distanceTo(to) - 1.3;
  });
}

/** The ray from `eye` to `target` hits none of `blockers` before the target. */
function clearSight(eye, target, blockers) {
  const from = new THREE.Vector3(...eye);
  const to = new THREE.Vector3(...target);
  const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to) - 1.3);
  const hit = ray.intersectObjects(blockers, false)[0];
  return hit ? `${hit.object.name} at ${hit.point.toArray().map((v) => v.toFixed(1))}` : null;
}

test('Last Colour: no curve blocks any room eye\'s view of the Siphon beacon', async () => {
  const level = await loaded(Level03);
  const beacon = LC.landmarks[0].beacon;
  const blockers = [level.tank, ...level.vats, level.hoses, level.cables];
  let checked = 0;
  for (const r of LC.rooms.filter((rm) => !rm.planned)) {
    // R5 stands at the Siphon's foot: the Siphon itself hides its own mast.
    // Only a view that is clear today has to stay clear.
    if (blockedBySolids(r.eye.pos, beacon, LC.solids)) continue;
    checked++;
    assert.equal(clearSight(r.eye.pos, beacon, blockers), null, `${r.id}'s view of the beacon`);
  }
  assert.ok(checked >= 4, `${checked} rooms see the beacon`);
  level.dispose();
});

test('The Ascent: the haul cables never block the beacon and clear every terrace', async () => {
  const level = await loaded(Level02);
  const beacon = AS.landmarks[0].beacon;
  for (const r of AS.rooms.filter((rm) => !rm.planned)) {
    if (blockedBySolids(r.eye.pos, beacon, AS.solids)) continue;
    assert.equal(clearSight(r.eye.pos, beacon, [level.cables]), null, `${r.id}'s view of the beacon`);
  }
  // Every point of each cable is above the solid under it — except at its two
  // ends, which are anchored (the lift tower, the trailhead floor).
  for (const spec of AS.curves.cables) {
    const path = cable(spec.points, spec.radius, spec.sag).parameters.path;
    const ends = spec.points.map((p) => new THREE.Vector3(...p));
    for (let i = 0; i <= 100; i++) {
      const p = path.getPoint(i / 100);
      if (ends.some((e) => e.distanceTo(p) < 4)) continue;
      for (const s of AS.solids) {
        const [x0, x1, , y1, z0, z1] = s.box;
        if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) assert.ok(p.y > y1 + 1, `cable inside ${s.id} at ${p.toArray()}`);
      }
    }
  }
  level.dispose();
});

test('Outskirts: the power line is clear of the spawn\'s view of the beacon', async () => {
  const level = await loaded(Level01);
  const b = OUTSKIRTS.beacon;
  const beacon = [b.x, b.top + 1.2, b.z];
  const pole = level.root.getObjectByName('power-pole');
  assert.equal(clearSight([level.spawn.x, level.spawn.y + 1.6, level.spawn.z], beacon, [level.powerLine, pole]), null);
  level.dispose();
});

test('placed lights: Last Colour lights its crushers amber, the Siphon grey-violet, the beacon white', async () => {
  pointLights.clear();
  const level = await loaded(Level03);
  const mine = pointLights.sources.filter((s) => s.owner === level);
  const hexes = mine.map((s) => s.colour.getHex());
  assert.ok(hexes.includes(DANGER.amber), 'a crusher');
  assert.ok(hexes.includes(GATE.field), 'the Siphon');
  assert.ok(hexes.includes(MARKER.white), 'the beacon');

  // A crusher's light follows its state: full while warning or down.
  const crusher = level.crushers[0];
  const light = level.placedLights.find((l) => l.handle.colour.getHex() === DANGER.amber).handle;
  const player = { position: new THREE.Vector3(0, 0, 200), takeDamage() {} };
  let sawFull = false;
  let sawRest = false;
  for (let i = 0; i < 600; i++) {
    level.update(1 / 60, player);
    const armed = crusher.state === 'warn' || crusher.state === 'down';
    if (armed) sawFull ||= Math.abs(light.intensity - PLACED_LIGHTS.trap.intensity) < 1e-9;
    else sawRest ||= Math.abs(light.intensity - PLACED_LIGHTS.trap.intensity * PLACED_LIGHTS.trap.rest) < 1e-9;
  }
  assert.ok(sawFull && sawRest, 'bright while armed, dim between beats');

  level.dispose();
  assert.equal(pointLights.sources.filter((s) => s.owner === level).length, 0, 'the level hands its lights back');
});

test('placed lights: the Primer\'s lead lamps are warm; the Outskirts vent goes dark when painted', async () => {
  pointLights.clear();
  const primer = await loaded(Level00);
  const lamps = pointLights.sources.filter((s) => s.owner === primer);
  assert.ok(lamps.length >= 2);
  assert.ok(lamps.every((s) => s.colour.getHex() === PLACED_LIGHTS.lamp.colour));
  primer.dispose();

  const outskirts = await loaded(Level01);
  const vent = outskirts.placedLights.find((l) => l.handle.colour.getHex() === DANGER.amber);
  assert.ok(vent, 'the vent has a light');
  outskirts.vent.phase = 'erupt';
  assert.equal(vent.drive(0), 1);
  outskirts.vent.phase = 'dormant';
  assert.equal(vent.drive(0), 0, 'a dead vent is dark');
  outskirts.dispose();
});

for (const [name, Level] of [['Outskirts', Level01], ['The Ascent', Level02], ['Last Colour', Level03]]) {
  test(`${name}: ten reloads free every curve`, async () => {
    let made = 0;
    let freed = 0;
    for (let i = 0; i < 10; i++) {
      const level = await loaded(Level);
      for (const m of meshes(level, (o) => isTube(o.geometry) || o.geometry.type === 'LatheGeometry')) {
        made += 2;
        m.geometry.addEventListener('dispose', () => { freed++; });
        m.material.addEventListener('dispose', () => { freed++; });
      }
      level.dispose();
    }
    assert.ok(made > 0);
    assert.equal(freed, made);
  });
}
