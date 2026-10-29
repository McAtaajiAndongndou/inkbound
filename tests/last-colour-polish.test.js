// Last Colour, polish pass 1: the cargo crusher (#33) and the Corp prop kit (#56).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as L } from '../src/levels/layouts/last-colour.js';
import { LAST_COLOUR as TUNING } from '../src/config.js';

async function loaded() {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const box3 = ([x0, x1, y0, y1, z0, z1]) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const victim = (pos) => ({ position: new THREE.Vector3(...pos), hits: 0, takeDamage(n) { this.hits += n; } });

const C = TUNING.crusher;
const beat = C.period - C.downFor / 2;        // the middle of the drop
const gap = (C.period - C.downFor - C.warnFor) / 2;

test('the crusher hurts what stands under it on the beat, and not in the gap', async () => {
  const level = await loaded();
  const [crusher] = level.crushers;
  assert.ok(crusher, 'the corridor has a crusher');
  const [x0, x1, , , z0, z1] = L.traps.find((t) => t.kind === 'crusher').box;
  const under = [(x0 + x1) / 2, 0.1, (z0 + z1) / 2];

  const walker = victim(under);
  crusher.update(gap, [walker]);
  assert.equal(crusher.state, 'up');
  assert.equal(walker.hits, 0, 'the gap is the safe crossing');

  crusher.update(beat - gap, [walker]);
  assert.equal(crusher.state, 'down');
  assert.equal(walker.hits, C.damage, 'walking into it on the beat hurts');
  level.dispose();
});

test('blue crosses under the crusher on the beat', async () => {
  const level = await loaded();
  const [crusher] = level.crushers;
  const [x0, x1, , , z0, z1] = L.traps.find((t) => t.kind === 'crusher').box;
  const under = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  for (let x = x0 + 0.5; x < x1; x += 1) for (let z = z0 + 0.25; z <= z1; z += 0.5) {
    crusher.floor.splat(new THREE.Vector3(x, 0, z), 'blue', 1);
  }
  const slider = victim([under.x, 0.1, under.z]);
  crusher.update(beat, [slider]);
  assert.equal(crusher.state, 'down');
  assert.equal(slider.hits, 0, 'blue slides under the head');
  level.dispose();
});

test('the lamp is the tell: it blinks before the drop and is lit on the beat', async () => {
  const level = await loaded();
  const [crusher] = level.crushers;
  const off = new THREE.Color(TUNING.props.lightOff).getHex();
  crusher.update(gap, []);
  assert.equal(crusher.lamp.material.color.getHex(), off, 'dark between beats');
  let lit = false;
  while (crusher.state !== 'down') {
    crusher.update(0.02, []);
    if (crusher.state === 'warn' && crusher.lamp.material.color.getHex() !== off) lit = true;
  }
  assert.ok(lit, 'the lamp blinks during the warning');
  assert.equal(crusher.state, 'down');
  assert.notEqual(crusher.lamp.material.color.getHex(), off, 'lit while down');
  level.dispose();
});

test('props keep out of every strip, route point and sightline, and stay low on arena floors', () => {
  const strips = L.strips.map((s) => {
    const n = s.face.endsWith('x') ? [s.at - 0.5, s.at + 0.5, s.y[0], s.y[1], s.span[0], s.span[1]] : [s.span[0], s.span[1], s.y[0], s.y[1], s.at - 0.5, s.at + 0.5];
    return { id: s.id, b: box3(n) };
  });
  const points = [...L.routes.main, ...L.routes.flank].map((p) => new THREE.Vector3(...p));
  const beacon = new THREE.Vector3(...L.landmarks[0].beacon);
  for (const p of L.props) {
    const b = box3(p.box);
    for (const s of strips) assert.ok(!b.intersectsBox(s.b), `${p.id} overlaps strip ${s.id}`);
    for (const q of points) assert.ok(b.distanceToPoint(q) >= 1, `${p.id} is within 1 m of a route point`);
    for (const r of L.rooms.filter((rm) => !rm.planned)) {
      const eye = new THREE.Vector3(...r.eye.pos);
      const ray = new THREE.Ray(eye, beacon.clone().sub(eye).normalize());
      const hit = ray.intersectBox(b, new THREE.Vector3());
      assert.ok(!hit || hit.distanceTo(eye) > eye.distanceTo(beacon), `${p.id} blocks ${r.id}'s view of the beacon`);
    }
    if (p.box[2] === 0) {
      assert.ok(p.box[3] <= TUNING.props.maxFloorHeight, `${p.id} is tall enough to hide a Drainer`);
    }
  }
});

test('props are instanced, never colliders, and every room is dressed', async () => {
  const level = await loaded();
  const kinds = new Set(L.props.map((p) => p.kind));
  assert.ok(level.props.meshes.every((m) => m.isInstancedMesh));
  assert.ok(level.props.meshes.length <= kinds.size + 1, 'one draw call per kind (lamps: per rule)');
  assert.ok(!level.surfaces.some((s) => level.props.meshes.includes(s.mesh)), 'a prop must not collide');
  for (const room of ['R1', 'R2', 'R3']) assert.ok(L.props.some((p) => p.room === room), `${room} has no props`);
  level.dispose();
});

test('the bay lamps blink while wave three\'s breath counts down', async () => {
  const level = await loaded();
  const lamp = level.props.lamps.find((l) => l.rule === 'cleared:R3.2+8');
  const off = new THREE.Color(TUNING.props.lightOff).getHex();
  const player = { position: new THREE.Vector3(0, 0, -24) };
  level.update(0.02, player);
  assert.equal(lamp.mesh.material.color.getHex(), off, 'dark while wave two is alive');
  for (const r of level.roster) if (r.data.wave === 2) r.enemy.alive = false;
  let lit = false;
  for (let i = 0; i < 100; i++) {
    level.update(0.02, player);
    if (lamp.mesh.material.color.getHex() !== off) lit = true;
  }
  assert.ok(lit, 'the lamps blink in the 8 s breath');
  level.dispose();
});
