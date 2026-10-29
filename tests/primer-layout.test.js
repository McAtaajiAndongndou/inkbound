// The Primer's layout DATA against the player's physics — and, for the blue
// room, against the player's actual code: the v1 doc's 8 m gap cleared with
// blue by 14 cm, so this room is checked by simulation, not by estimate.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PRIMER as L } from '../src/levels/layouts/primer.js';
import { PLAYER } from '../src/config.js';
import { Player } from '../src/core/player.js';
import * as kit from '../src/levels/level-kit.js';

const G = Math.abs(PLAYER.gravity);
const JUMP_APEX = PLAYER.jumpSpeed ** 2 / (2 * G);   // 1.39 m
const RED_APEX = PLAYER.minBounce ** 2 / (2 * G);    // 4.33 m
const CHEST = PLAYER.height * 0.5;
const EPS = 1e-6;
const solid = (id) => L.solids.find((s) => s.id === id);

function tops() {
  return L.solids.filter((s) => s.top).map((s) => {
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    return { x0: x0 - (l['-x'] ?? 0), x1: x1 + (l['+x'] ?? 0), z0: z0 - (l['-z'] ?? 0), z1: z1 + (l['+z'] ?? 0), y: y1, src: s };
  });
}
const floorAt = (x, y, z) => tops().find((t) => x >= t.x0 - EPS && x <= t.x1 + EPS && z >= t.z0 - EPS && z <= t.z1 + EPS && Math.abs(t.y - y) < 0.01);
function stripPoint(s, t, out) {
  const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
  const a = s.span[0] + (s.span[1] - s.span[0]) * t;
  return n[0] === 0 ? [a, s.at + n[1] * out] : [s.at + n[0] * out, a];
}

/**
 * Run the R3 blue gap with the real Player: the run-up and landing rebuilt
 * from the data, the blue strip painted if asked, a jump `early` metres before
 * the lip. True if the player lands on the far side.
 */
function runBlueGap({ blue, early = 0 }) {
  const level = { root: new THREE.Group(), surfaces: [] };
  const box = (id) => solid(id).box;
  const [rx0, rx1, , ry, rz0, rz1] = box('r3-runup');
  const [lx0, lx1, , ly, lz0, lz1] = box('r3-landing');
  const runup = kit.platform(level, { y: ry, xMin: rx0, xMax: rx1, zMin: rz0, zMax: rz1, cells: 4 });
  kit.platform(level, { y: ly, xMin: lx0, xMax: lx1, zMin: lz0, zMax: lz1, cells: 4 });
  level.root.updateMatrixWorld(true);
  if (blue) {
    const [px0, px1, pz0, pz1] = L.prepaint.find((p) => p.id === 'r3-blue-strip').rect;
    for (let z = pz0; z <= pz1; z += 1) for (let x = px0; x <= px1; x += 1) runup.splat(new THREE.Vector3(x, ry, z), 'blue', 1);
  }
  const player = new Player(level.surfaces, new THREE.Vector3(0, ry, rz1 - 0.5));
  player.onGround = true;
  const input = { isDown: (k) => k === 'KeyW' };
  let air = false;
  for (let i = 0; i < 900; i++) {
    const jump = !air && player.onGround && player.position.z <= rz0 + early + 0.05;
    player.update(1 / 60, input, { jump });
    if (player.position.z <= rz0 - 0.3 && !player.onGround) air = true;
    if (player.position.y < -6) return false;
    if (air && player.onGround) return player.position.z <= lz1 && Math.abs(player.position.y - ly) < 0.5;
  }
  return false;
}

test('R3 Blue, simulated: grey cannot cross the gap; the blue strip can', () => {
  assert.equal(runBlueGap({ blue: false }), false, 'a grey run-up clears the gap — the blue room teaches nothing');
  assert.equal(runBlueGap({ blue: true }), true, 'the blue strip does not clear the gap');
});

test('R3 Blue is forgiving: a jump a full metre early still makes it on blue', () => {
  // A tutorial must not demand frame-perfect timing. At 8 m (the v1 number)
  // this fails; at 6.5 m there is room for a first-timer's early jump.
  assert.equal(runBlueGap({ blue: true, early: 1 }), true);
});

test('R4 Red: the ledge is above any jump and well inside a red bounce', () => {
  const ledge = solid('r5-floor').box[3] - solid('r4-floor').box[3];
  assert.ok(ledge > JUMP_APEX + 1, `a ${ledge} m ledge is too close to a plain jump`);
  assert.ok(ledge < RED_APEX - 1, `a ${ledge} m ledge is too close to the bounce's limit`);
  assert.ok(L.prepaint.some((p) => p.colour === 'red' && p.room === 'R4'), 'the red room needs its red pad');
});

test('one mechanic per room: R4 cannot be climbed, R5 cannot be bounced', () => {
  assert.ok(!L.strips.some((s) => s.room === 'R4'), 'a paintable face in the red room lets green answer it');
  const green = L.strips.find((s) => s.id === 'r5-green');
  assert.ok(green.y[1] - green.y[0] > RED_APEX, 'red bounces past the green wall');
});

test('every climb starts on a floor and tops out onto a lip; every painted wall is on a real face', () => {
  for (const s of L.strips) {
    const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
    const onFace = L.solids.some(({ box: [x0, x1, y0, y1, z0, z1] }) => {
      const plane = n[0] === 1 ? x1 : n[0] === -1 ? x0 : n[1] === 1 ? z1 : z0;
      const [a0, a1] = n[0] === 0 ? [x0, x1] : [z0, z1];
      return Math.abs(plane - s.at) < EPS && a0 <= s.span[0] + EPS && a1 >= s.span[1] - EPS && y0 <= s.y[0] + EPS && y1 >= s.y[1] - EPS;
    });
    assert.ok(onFace, `${s.id}: paint on air`);
    if (s.climb === false) continue;
    for (const t of [0.1, 0.5, 0.9]) {
      assert.ok(floorAt(...stripPoint(s, t, 0.5).flatMap((v, i) => (i === 0 ? [v, s.y[0]] : [v]))), `${s.id}: nothing at the bottom`);
      assert.ok(floorAt(...stripPoint(s, t, 0.3).flatMap((v, i) => (i === 0 ? [v, s.y[1]] : [v]))), `${s.id}: no lip at the top`);
    }
  }
});

test('nothing kills: every wall beats its floor plus a bounce, and the pit has stairs out', () => {
  for (const w of L.solids.filter((s) => s.kind === 'wall')) {
    const [wx0, wx1, , wy1, wz0, wz1] = w.box;
    // The highest floor within 6 m of the wall — the only ones a bounce could start from.
    const near = tops().filter((t) => t.x1 >= wx0 - 6 && t.x0 <= wx1 + 6 && t.z1 >= wz0 - 6 && t.z0 <= wz1 + 6);
    const highest = Math.max(...near.map((t) => t.y));
    assert.ok(wy1 > highest + RED_APEX, `${w.id} (${wy1} m) can be cleared from a ${highest} m floor`);
  }
  const pit = solid('r3-pit').box[3];
  assert.ok(pit > PLAYER.killY);
  let y = pit;
  for (const id of ['r3-step-1', 'r3-step-2', 'r3-runup']) {
    const next = solid(id).box[3];
    assert.ok(next - y < JUMP_APEX, `${id}: a ${(next - y).toFixed(1)} m step out of the pit needs more than a jump`);
    y = next;
  }
});

test('the pit is enclosed: every side is a wall or a step at chest height', () => {
  // The first draft had two holes found by hand: the landing stopped 1 m above
  // the pit floor (a slot onto the void beneath it), and the side walls began
  // at floor level, so the pit's sides were open below 0. Either turned a fall
  // into the "safe" pit into a death.
  const [px0, px1, , py, pz0, pz1] = solid('r3-pit').box;
  const y = py + CHEST;
  const points = [];
  for (let t = 0.1; t < 1; t += 0.2) {
    const x = px0 + (px1 - px0) * t;
    const z = pz0 + (pz1 - pz0) * t;
    points.push([x, pz0 - 0.05], [x, pz1 + 0.05], [px0 - 0.05, z], [px1 + 0.05, z]);
  }
  for (const [x, z] of points) {
    const held = L.solids.some(({ box: b }) => x >= b[0] && x <= b[1] && z >= b[4] && z <= b[5] && y >= b[2] && y <= b[3]);
    assert.ok(held, `the pit is open at (${x.toFixed(2)}, ${z.toFixed(2)}) at chest height`);
  }
});

test('the low wall stops a walk and allows a hop', () => {
  const h = solid('r1-low-wall').box[3] - solid('r1-low-wall').box[2];
  assert.ok(h > CHEST && h < JUMP_APEX);
});

test('one Charger, in R7, and its gate opens when it is gone', () => {
  assert.equal(L.enemies.length, 1);
  assert.equal(L.enemies[0].type, 'charger');
  assert.equal(L.enemies[0].room, 'R7');
  assert.equal(L.gates[0].opens, 'cleared:R7');
});

test('free play has no objective: the win is beyond it, never in it', () => {
  const [wx0, wx1, , , wz0, wz1] = L.win.box;
  for (const s of L.solids.filter((x) => x.room === 'R8' && x.top)) {
    const [x0, x1, , , z0, z1] = s.box;
    const overlaps = wx0 < x1 && wx1 > x0 && wz0 < z1 && wz1 > z0;
    assert.ok(!overlaps, `the win volume overlaps free play (${s.id})`);
  }
  assert.equal(L.win.requires, 'R7', 'the win needs the gate open, i.e. the Charger gone');
});

test('no boxes overlap; every enemy, route point and pre-painted patch is on a floor', () => {
  const clashes = [];
  for (let i = 0; i < L.solids.length; i++) {
    for (let j = i + 1; j < L.solids.length; j++) {
      const a = L.solids[i].box;
      const b = L.solids[j].box;
      const o = [Math.min(a[1], b[1]) - Math.max(a[0], b[0]), Math.min(a[3], b[3]) - Math.max(a[2], b[2]), Math.min(a[5], b[5]) - Math.max(a[4], b[4])];
      if (o.every((v) => v > EPS)) clashes.push(`${L.solids[i].id} × ${L.solids[j].id}`);
    }
  }
  assert.deepEqual(clashes, []);
  for (const e of L.enemies) assert.ok(floorAt(...e.pos), `${e.id} stands on nothing`);
  for (const p of L.routes.main) assert.ok(floorAt(...p), `route point ${p} is on nothing`);
  for (const p of L.prepaint) {
    const [x0, x1, z0, z1] = p.rect;
    for (const [x, z] of [[x0, z0], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) {
      assert.ok(floorAt(x, p.y, z), `${p.id}: paint at (${x}, ${z}) is off the floor`);
    }
  }
});
