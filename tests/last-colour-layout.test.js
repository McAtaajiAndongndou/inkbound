// Last Colour's layout DATA, checked against the player's physics before a
// mesh is built — the same contract as tests/ascent-layout.test.js, plus the
// claims this level's design makes for itself (sealed, pockets, the Siphon).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { LAST_COLOUR as L } from '../src/levels/layouts/last-colour.js';
import { PLAYER, SURFACE } from '../src/config.js';

const G = Math.abs(PLAYER.gravity);
const JUMP_APEX = PLAYER.jumpSpeed ** 2 / (2 * G);   // 1.39 m
const RED_APEX = PLAYER.minBounce ** 2 / (2 * G);    // 4.33 m
const CHEST = PLAYER.height * 0.5;
const TOP_OUT = 0.3;
const EPS = 1e-6;
// The design doc's pocket rule: a paintable pocket within 5 s, walking on grey.
const POCKET_REACH = 5 * PLAYER.maxSpeed * SURFACE.grey.standSlow;   // 21 m

function tops() {
  const out = [];
  for (const s of L.solids) {
    if (!s.top) continue;
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    out.push({ x0: x0 - (l['-x'] ?? 0), x1: x1 + (l['+x'] ?? 0), z0: z0 - (l['-z'] ?? 0), z1: z1 + (l['+z'] ?? 0), y: y1, src: s });
  }
  return out;
}
const inside = (t, x, z) => x >= t.x0 - EPS && x <= t.x1 + EPS && z >= t.z0 - EPS && z <= t.z1 + EPS;
const floorAt = (x, y, z) => tops().find((t) => inside(t, x, z) && Math.abs(t.y - y) < 0.01);

function stripPoint(s, t, out) {
  const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
  const a = s.span[0] + (s.span[1] - s.span[0]) * t;
  return n[0] === 0 ? [a, s.at + n[1] * out] : [s.at + n[0] * out, a];
}

test('every climb is taller than a jump, starts on a floor and tops out onto a lip', () => {
  for (const s of L.strips) {
    assert.ok(s.y[1] - s.y[0] > JUMP_APEX, `${s.id}: a plain jump clears it`);
    for (const t of [0.1, 0.5, 0.9]) {
      const [bx, bz] = stripPoint(s, t, 0.5);
      assert.ok(floorAt(bx, s.y[0], bz), `${s.id}: nothing to stand on at the bottom`);
      const [tx, tz] = stripPoint(s, t, TOP_OUT);
      assert.ok(floorAt(tx, s.y[1], tz), `${s.id}: no floor ${TOP_OUT} m past the top`);
    }
  }
});

test('every climb strip is on a real face', () => {
  for (const s of L.strips) {
    const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
    const ok = L.solids.some(({ box: [x0, x1, y0, y1, z0, z1] }) => {
      const plane = n[0] === 1 ? x1 : n[0] === -1 ? x0 : n[1] === 1 ? z1 : z0;
      if (Math.abs(plane - s.at) > EPS) return false;
      const [a0, a1] = n[0] === 0 ? [x0, x1] : [z0, z1];
      return a0 <= s.span[0] + EPS && a1 >= s.span[1] - EPS && y0 <= s.y[0] + EPS && y1 >= s.y[1] - EPS;
    });
    assert.ok(ok, `${s.id}: paint on air`);
  }
});

test('no two boxes overlap in volume', () => {
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
});

test('cover is cover: blocks beat a red bounce, low walls stop a walk and allow a hop', () => {
  for (const c of L.solids.filter((s) => s.kind === 'cover')) {
    const h = c.box[3] - c.box[2];
    if (c.id.includes('low-wall')) assert.ok(h > CHEST && h < JUMP_APEX, `${c.id}: ${h} m`);
    else assert.ok(h > RED_APEX, `${c.id}: ${h} m can be bounced onto`);
  }
});

test('the level is sealed: no walkable top plus a red bounce clears a wall', () => {
  const highest = Math.max(...L.solids.filter((s) => s.top).map((s) => s.box[3]));
  for (const w of L.solids.filter((s) => s.kind === 'wall')) {
    assert.ok(w.box[3] > highest + RED_APEX, `${w.id} (${w.box[3]} m) can be cleared from a ${highest} m floor`);
  }
});

test('every enemy and every route point stands on a floor', () => {
  for (const e of L.enemies) assert.ok(floorAt(...e.pos), `${e.id} stands on nothing`);
  for (const [name, route] of Object.entries(L.routes)) {
    for (const p of route) assert.ok(floorAt(...p), `${name}: ${p} is on nothing`);
  }
});

test('the pocket rule: every arena floor point is within a 5 s walk of a climb to safe paint', () => {
  // Only climbs reachable DURING that arena's fight count. The first version
  // let the hangar borrow the corridor walkway's climb — 6.6 m away, but behind
  // the corridor gate, which is shut until the hangar is clear.
  const reachable = { 'hangar-floor': ['R0', 'R1'], 'core-floor': ['R3'] };
  const blockers = L.solids.filter((s) => s.box[3] > 0 && s.box[2] < 1);
  for (const [id, rooms] of Object.entries(reachable)) {
    const a = L.solids.find((s) => s.id === id);
    const bases = L.strips.filter((s) => rooms.includes(s.room)).map((s) => stripPoint(s, 0.5, 0.5));
    const [x0, x1, , , z0, z1] = a.box;
    for (let x = x0 + 0.5; x <= x1 - 0.5; x += 2) {
      for (let z = z0 + 0.5; z <= z1 - 0.5; z += 2) {
        // Only points a player can stand on: not inside a block, gantry or the Siphon.
        if (blockers.some(({ box: b }) => x > b[0] && x < b[1] && z > b[4] && z < b[5])) continue;
        const d = Math.min(...bases.map(([bx, bz]) => Math.hypot(bx - x, bz - z)));
        assert.ok(d <= POCKET_REACH, `${a.id} (${x.toFixed(1)}, ${z.toFixed(1)}) is ${d.toFixed(1)} m from the nearest climb`);
      }
    }
  }
});

/** Ray against every solid; gates and traps are see-through. */
function sees(from, to) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const ray = new THREE.Ray(a, dir.normalize());
  const hit = new THREE.Vector3();
  return !L.solids.some(({ box: [x0, x1, y0, y1, z0, z1] }) => {
    const bx = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    return !bx.containsPoint(b) && ray.intersectBox(bx, hit) && hit.distanceTo(a) < len - 0.5;
  });
}

test('the Siphon is the goal you can see: in view from every room you arrive in', () => {
  const [x0, x1, y0, y1, , z1] = L.solids.find((s) => s.id === 'siphon').box;
  const face = [(x0 + x1) / 2, y0 + (y1 - y0) * 0.5, z1];
  for (const r of L.rooms.filter((x) => !x.planned)) {
    assert.ok(sees(r.eye.pos, face), `${r.id}: the Siphon is hidden`);
  }
});

test("the Siphon's beacon clears the hangar wall from anywhere on the landing", () => {
  // The landing is the overlook: from all of it — off the corridor's axis too,
  // where the corridor mouth cannot help — the beacon shows over the wall.
  // (From the hangar FLOOR it does not, and that is not claimed: next to a
  // 12 m wall the goal is down the corridor axis, not over the top.)
  const beacon = L.landmarks.find((l) => l.id === 'siphon-mast').beacon;
  const [lx0, lx1, , ly1, lz0, lz1] = L.solids.find((s) => s.id === 'landing').box;
  for (const x of [lx0 + 0.5, 0, lx1 - 0.5]) {
    for (const z of [lz0 + 0.5, (lz0 + lz1) / 2]) {
      const eye = [x, ly1 + PLAYER.eyeHeight, z];
      assert.ok(sees(eye, beacon), `from the landing at (${x}, ${z}) the beacon is behind a wall`);
    }
  }
});

test('the traps can be passed the ways the design says', () => {
  const laser = L.traps.find((t) => t.kind === 'laser').box;
  const walkway = L.solids.find((s) => s.id === 'walkway').box;
  assert.ok(laser[3] < RED_APEX, 'a red bounce must clear the laser grid');
  assert.ok(laser[3] < walkway[3], 'the walkway must pass above the laser grid');
  const crusher = L.traps.find((t) => t.kind === 'crusher').box;
  assert.ok(crusher[1] <= walkway[0] + EPS, 'the crusher must leave the walkway clear');
});
