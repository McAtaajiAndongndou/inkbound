// The Ascent, polish pass 1: the collapsing catwalk (#102), the chain's
// scaffold landmark, the base on the horizon and the cold-dawn mood.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level02 } from '../src/levels/level-02-ascent.js';
import { ASCENT as L } from '../src/levels/layouts/ascent.js';
import { ASCENT as TUNING, PLAYER, TRAP } from '../src/config.js';

async function loaded() {
  const level = new Level02({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const box3 = ([x0, x1, y0, y1, z0, z1]) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
const C = TUNING.catwalk;
const centreOf = (d) => new THREE.Vector3((d.x[0] + d.x[1]) / 2, d.y, (d.z[0] + d.z[1]) / 2);
/** Tick the catwalk alone, in small steps, with the player at `at()`. */
function run(level, seconds, at) {
  const player = { position: new THREE.Vector3() };
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    player.position.copy(at(t));
    level.catwalk.update(1 / 60, player);
  }
}

test('every catwalk segment is a collapsing segment, and nothing else is', async () => {
  const level = await loaded();
  const want = L.slabs.filter((s) => s.kind === 'catwalk').map((s) => s.id).sort();
  assert.deepEqual(level.catwalk.segments.map((s) => s.id).sort(), want);
  level.dispose();
});

test('a segment you stand on drops after its delay, and the scree catches the fall', async () => {
  const level = await loaded();
  const seg = level.catwalk.get('span-2-3');
  const on = centreOf(seg.data);

  run(level, C.delay * 0.9, () => on);
  assert.equal(seg.state, 'going', 'stepping on it starts the clock');
  assert.equal(seg.floor.mesh.position.y > 0, true, 'still standing before the delay');

  run(level, C.delay * 0.2, () => on);
  assert.equal(seg.state, 'fallen');
  assert.ok(seg.floor.mesh.position.y < PLAYER.killY, 'the floor is out of every floor test');

  // What is under it now: a real floor, the scree, not the void.
  const below = level.surfaces.filter((s) => s.isFloor && s.mesh.position.y < seg.y - 1
    && s.mesh.position.y > PLAYER.killY && s.worldToCell(new THREE.Vector3(on.x, s.mesh.position.y, on.z)));
  assert.ok(below.length > 0, 'a fall from the catwalk lands on a floor');
  assert.ok(below.every((s) => s.catch), 'and that floor is the scree');
  level.dispose();
});

test('a segment nobody stands on never drops', async () => {
  const level = await loaded();
  run(level, C.delay * 5, () => new THREE.Vector3(0, 0, 74));   // the trailhead
  assert.ok(level.catwalk.segments.every((s) => s.state === 'solid'));
  level.dispose();
});

test('a run at full speed crosses span 2 with a floor under every step', async () => {
  const level = await loaded();
  // North along span 2, from its south end to its north end, at maxSpeed.
  const z0 = 30;
  const z1 = 6;
  const seconds = (z0 - z1) / PLAYER.maxSpeed;
  const player = { position: new THREE.Vector3() };
  for (let t = 0; t < seconds; t += 1 / 60) {
    player.position.set(32, 12, z0 - PLAYER.maxSpeed * t);
    level.catwalk.update(1 / 60, player);
    const under = level.catwalk.segments.find((s) => s.data.z[0] <= player.position.z && player.position.z <= s.data.z[1] && s.data.x[0] === 30);
    assert.notEqual(under.state, 'fallen', `${under.id} fell under a running player at z ${player.position.z.toFixed(1)}`);
  }
  // …and behind the run, the catwalk is going: turning back is a commitment.
  assert.ok(level.catwalk.segments.filter((s) => s.data.x[0] === 30).every((s) => s.state !== 'solid'));
  level.dispose();
});

test('the tell: a going segment shakes and flashes the trap amber', async () => {
  const level = await loaded();
  const seg = level.catwalk.get('span-1-2');
  const on = centreOf(seg.data);
  let amber = false;
  let onTop = false;
  let moved = false;
  const player = { position: on };
  assert.equal(seg.flash.visible, false, 'no flash on a solid segment');
  for (let t = 0; t < C.delay * 0.95; t += 1 / 120) {
    level.catwalk.update(1 / 120, player);
    if (seg.slab.material.color.getHex() === new THREE.Color(TRAP.amber).getHex()) amber = true;
    if (seg.flash.visible) onTop = true;
    if (Math.abs(seg.slab.position.y - seg.slabY) > 1e-3) moved = true;
  }
  assert.ok(amber, 'it flashes amber');
  assert.ok(onTop, 'and the flash shows on the walking surface, where the player looks');
  assert.ok(moved, 'it shakes');
  run(level, C.delay, () => new THREE.Vector3(0, 0, 74));
  assert.equal(seg.flash.visible, false, 'no flash once it has fallen');
  // The flash is this segment's own: the others keep their colour.
  const other = level.catwalk.get('span-1-1');
  assert.notEqual(other.slab.material, seg.slab.material);
  level.dispose();
});

test('a fallen segment comes back, but never into the player', async () => {
  const level = await loaded();
  const seg = level.catwalk.get('span-1-1');
  const on = centreOf(seg.data);
  run(level, C.delay + 0.05, () => on);
  assert.equal(seg.state, 'fallen');

  // Hanging in the gap (mid-jump) when it would reform: it waits.
  run(level, C.reformAfter + 0.5, () => new THREE.Vector3(on.x, on.y + 0.5, on.z));
  assert.equal(seg.state, 'fallen', 'it does not reform round the player');

  run(level, 0.1, () => new THREE.Vector3(32, 4, 20));   // down on the scree
  assert.equal(seg.state, 'solid', 'it is back for the next crossing');
  assert.equal(seg.floor.mesh.position.y, seg.y);
  assert.ok(seg.slab.visible);
  level.dispose();
});

test('the chain scaffold keeps out of every route and jump, and its marker is in view from R5', () => {
  // The player's body along every route leg and the chain, sampled: no prop in it.
  const body = (p) => new THREE.Box3(
    new THREE.Vector3(p.x - PLAYER.radius, p.y, p.z - PLAYER.radius),
    new THREE.Vector3(p.x + PLAYER.radius, p.y + PLAYER.height + 2, p.z + PLAYER.radius),   // +2: a bounce's arc
  );
  const props = L.props.map((p) => ({ p, b: box3(p.box) }));
  for (const route of [L.routes.main, L.routes.chain]) {
    for (let i = 0; i < route.length - 1; i++) {
      const a = new THREE.Vector3(...route[i]);
      const b = new THREE.Vector3(...route[i + 1]);
      for (let k = 0; k <= 20; k++) {
        const p = a.clone().lerp(b, k / 20);
        const hit = props.find(({ b: pb }) => pb.intersectsBox(body(p)));
        assert.ok(!hit, `a ${hit?.p.kind} stands in the route at ${p.toArray().map((v) => v.toFixed(1))}`);
      }
    }
  }

  // The doc's finding: from R5's entrance, 41 m away, the pads did not read.
  // The gantry's floodlights (44 m up) and pad 1's marker read from there;
  // pad 2's marker is behind leg 2 from there, so each pad's marker has to
  // read from the stop before it: the launch point for pad 1, pad 1 for pad 2.
  const rock = L.solids.map((s) => box3(s.box));
  const seen = (eye, m) => {
    const c = box3(m.box).getCenter(new THREE.Vector3());
    const dist = eye.distanceTo(c);
    const ray = new THREE.Ray(eye, c.clone().sub(eye).normalize());
    return !rock.some((b) => {
      const at = ray.intersectBox(b, new THREE.Vector3());
      return at && eye.distanceTo(at) < dist - 0.5;
    });
  };
  const entrance = new THREE.Vector3(...L.rooms.find((r) => r.id === 'R5').eye.pos);
  const stop = (i) => new THREE.Vector3(...L.routes.chain[i]).add(new THREE.Vector3(0, PLAYER.eyeHeight, 0));
  const lights = L.props.filter((p) => p.kind === 'floodlight');
  const markers = lights.filter((p) => p.box[1] - p.box[0] < 0.5);
  const gantry = lights.filter((p) => !markers.includes(p));
  assert.equal(markers.length, 2, 'one lit marker per pad');
  assert.equal(gantry.length, 4, 'a floodlight on every mast');
  for (const g of gantry) assert.ok(seen(entrance, g), 'every gantry floodlight reads from R5\'s entrance');
  assert.ok(seen(entrance, markers[0]), 'pad 1\'s marker reads from R5\'s entrance');
  markers.forEach((m, i) => assert.ok(seen(stop(i), m), `pad ${i + 1}'s marker reads from the stop before it`));
});

test('the base reads on the horizon: unfogged, inside the camera and the sky', async () => {
  const level = await loaded();
  const summit = new THREE.Vector3(...L.rooms.find((r) => r.id === 'R7').eye.pos);
  for (const lm of L.landmarks.filter((l) => l.silhouette)) {
    const mesh = level.root.getObjectByName(lm.id);
    assert.equal(mesh.material.fog, false, `${lm.id} would dissolve into the fog`);
    // A box is inside the dome when its farthest corner is.
    const [x0, x1, y0, y1, z0, z1] = lm.box;
    const far = Math.hypot(Math.max(-x0, x1), Math.max(-y0, y1), Math.max(-z0, z1));
    assert.ok(far < TUNING.mood.skyRadius, `${lm.id} is outside the sky dome (${far.toFixed(0)} m)`);
    assert.ok(summit.distanceTo(box3(lm.box).getCenter(new THREE.Vector3())) < 500, 'inside the camera far plane (game.js: 500)');
  }
  level.dispose();
});

test('the lift beacon is inside the fog from the trailhead, so the goal reads the whole climb', () => {
  const tower = L.landmarks.find((l) => l.id === 'lift-tower');
  const trailhead = new THREE.Vector3(...L.rooms[0].eye.pos);
  assert.ok(trailhead.distanceTo(new THREE.Vector3(...tower.beacon)) < TUNING.mood.fogFar * 0.6);
});

test('ten reloads with the polish leak nothing into the scene', async () => {
  const scene = new THREE.Scene();
  for (let i = 0; i < 10; i++) {
    const level = new Level02({ scene });
    await level.load();
    scene.add(level.root);
    level.dispose();
  }
  assert.equal(scene.children.length, 0);
});

// Renda (30 Oct): "remove the black sun". The dome was 450 m but the game camera
// draws only to 400 m (camera-rig.js), so the far side of the dome was clipped
// and the void showed through as a huge black disc. The viewer's camera reaches
// 1000 m, which is why its shots never showed it. Measured against the GAME's camera.
test('the whole sky dome is inside the game camera\'s reach from anywhere on the climb', async () => {
  const { CameraRig } = await import('../src/core/camera-rig.js');
  const { CAMERA } = await import('../src/config.js');
  const far = new CameraRig(16 / 9).camera.far;
  const points = [...L.routes.main, ...L.rooms.filter((r) => r.eye).map((r) => r.eye.pos)];
  const out = Math.max(...points.map((p) => Math.hypot(...p)));
  const reach = TUNING.mood.skyRadius + out + CAMERA.tpvDistance + 4;   // + the third-person camera, + a margin
  assert.ok(reach < far, `the dome's far side is ${reach.toFixed(0)} m away; the camera stops at ${far} m`);
});
