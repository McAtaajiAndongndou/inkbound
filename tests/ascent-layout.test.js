// The Ascent's layout DATA, checked against the player's physics before a
// single mesh is built. If this file is green, the design doc's numbers are
// playable; if it is red, the drawing is lying.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ASCENT } from '../src/levels/layouts/ascent.js';
import { PLAYER } from '../src/config.js';

const G = Math.abs(PLAYER.gravity);
const JUMP_APEX = PLAYER.jumpSpeed ** 2 / (2 * G);   // 1.39 m
const RED_APEX = PLAYER.minBounce ** 2 / (2 * G);    // 4.33 m
const CHEST = PLAYER.height * 0.5;                   // the wall test's height
const TOP_OUT = 0.3;
const EPS = 1e-6;

/** Every walkable top: [x0, x1, z0, z1, y, source]. Lips widen a solid's top. */
function tops() {
  const out = [];
  for (const s of ASCENT.solids) {
    if (!s.top) continue;
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    out.push({ x0: x0 - (l['-x'] ?? 0), x1: x1 + (l['+x'] ?? 0), z0: z0 - (l['-z'] ?? 0), z1: z1 + (l['+z'] ?? 0), y: y1, src: s });
  }
  for (const s of ASCENT.slabs) out.push({ x0: s.x[0], x1: s.x[1], z0: s.z[0], z1: s.z[1], y: s.y, src: s });
  return out;
}
const inside = (t, x, z) => x >= t.x0 - EPS && x <= t.x1 + EPS && z >= t.z0 - EPS && z <= t.z1 + EPS;
const floorAt = (x, y, z) => tops().find((t) => inside(t, x, z) && Math.abs(t.y - y) < 0.01);
/** The highest top under (x, z) strictly below y. */
function floorBelow(x, z, y, except) {
  let best = null;
  for (const t of tops()) if (t.src !== except && inside(t, x, z) && t.y < y - 0.01 && (!best || t.y > best.y)) best = t;
  return best;
}

/** Unit outward normal and the "along" axis of a strip. */
function stripAxes(s) {
  const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
  return { nx: n[0], nz: n[1], alongX: n[0] === 0 };
}
function stripPoint(s, t, out) {
  const { nx, nz, alongX } = stripAxes(s);
  const a = s.span[0] + (s.span[1] - s.span[0]) * t;
  const x = alongX ? a : s.at + nx * out;
  const z = alongX ? s.at + nz * out : a;
  return [x, z];
}

test('every climb strip is taller than a red bounce, so green is the only way up it', () => {
  for (const s of ASCENT.strips) {
    const h = s.y[1] - s.y[0];
    assert.ok(h > RED_APEX, `${s.id}: ${h} m can be bounced past (${RED_APEX.toFixed(2)})`);
  }
});

test('every climb strip starts from a floor and tops out onto one that overhangs it', () => {
  for (const s of ASCENT.strips) {
    for (const t of [0.1, 0.5, 0.9]) {
      const [bx, bz] = stripPoint(s, t, 0.5);
      assert.ok(floorAt(bx, s.y[0], bz), `${s.id}: nothing to stand on at the bottom`);
      const [tx, tz] = stripPoint(s, t, TOP_OUT);
      assert.ok(floorAt(tx, s.y[1], tz), `${s.id}: the floor above does not reach ${TOP_OUT} m past the top`);
    }
  }
});

test('every climb strip is on a real rock face', () => {
  for (const s of ASCENT.strips) {
    const { nx, nz } = stripAxes(s);
    const ok = ASCENT.solids.some(({ box: [x0, x1, y0, y1, z0, z1] }) => {
      const plane = nx === 1 ? x1 : nx === -1 ? x0 : nz === 1 ? z1 : z0;
      if (Math.abs(plane - s.at) > EPS) return false;
      const [a0, a1] = nx === 0 ? [x0, x1] : [z0, z1];
      return a0 <= s.span[0] + EPS && a1 >= s.span[1] - EPS && y0 <= s.y[0] + EPS && y1 >= s.y[1] - EPS;
    });
    assert.ok(ok, `${s.id}: no solid has a face there — it would be paint on air`);
  }
});

test('stairs are walkable: each step is under a plain jump', () => {
  for (const prefix of ['s12-', 's23-', 't2-step-']) {
    const steps = ASCENT.solids.filter((s) => s.id.startsWith(prefix)).map((s) => s.box[3]).sort((a, b) => a - b);
    let prev = ASCENT.solids.find((s) => s.id.startsWith(prefix)).box[2];
    for (const y of steps) {
      assert.ok(y - prev < JUMP_APEX, `${prefix}: a ${(y - prev).toFixed(2)} m rise needs more than a jump`);
      prev = y;
    }
  }
  // The deck at the top of the T2 steps.
  assert.ok(24 - 23 < JUMP_APEX);
});

test('the chain: every bounce is within red reach, every pad has headroom and a floor under it', () => {
  const chain = ASCENT.routes.chain;
  for (let i = 1; i < chain.length; i++) {
    const rise = chain[i][1] - chain[i - 1][1];
    assert.ok(rise < RED_APEX - 0.2, `bounce ${i}: ${rise} m is at the edge of a red bounce`);
    assert.ok(rise > JUMP_APEX, `bounce ${i}: a plain jump does it — the chain is not a choice`);
  }
  for (const pad of ASCENT.slabs.filter((s) => s.kind === 'pad')) {
    const cx = (pad.x[0] + pad.x[1]) / 2;
    const cz = (pad.z[0] + pad.z[1]) / 2;
    const under = floorBelow(cx, cz, pad.y, pad);
    assert.ok(under, `${pad.id}: a miss falls into the void`);
    assert.ok(pad.y - under.y >= PLAYER.height + 0.3 - EPS, `${pad.id}: ${pad.y - under.y} m over the leg below — heads go through it`);
  }
});

test('cover is cover: taller than a red bounce, never a perch', () => {
  const isLow = (s) => s.id.endsWith('low-wall');
  for (const c of ASCENT.solids.filter((s) => s.kind === 'cover' && !isLow(s))) {
    const h = c.box[3] - c.box[2];
    assert.ok(h > RED_APEX, `${c.id}: ${h} m can be bounced onto`);
  }
  for (const low of ASCENT.solids.filter(isLow)) {
    const h = low.box[3] - low.box[2];
    assert.ok(h > CHEST && h < JUMP_APEX, `${low.id}: a low wall stops a walk and allows a hop`);
  }
});

test('kerbs stop an accidental walk-off but can be jumped on purpose', () => {
  for (const k of ASCENT.kerbs) {
    const h = k.box[3] - k.box[2];
    assert.ok(h > CHEST && h < JUMP_APEX, `${k.id}: ${h} m`);
  }
});

test('every traversal piece has a catch floor under it, above the kill height', () => {
  const traversal = [
    ...ASCENT.slabs.filter((s) => s.kind === 'catwalk'),
    ...ASCENT.solids.filter((s) => s.id === 'ledge').map((s) => ({ id: s.id, x: [s.box[0] - 1, s.box[1] + 1], z: [s.box[4], s.box[5]], y: s.box[3] })),
  ];
  for (const p of traversal) {
    for (const [x, z] of [[p.x[0] + 0.1, p.z[0] + 0.1], [p.x[1] - 0.1, p.z[1] - 0.1]]) {
      const under = floorBelow(x, z, p.y);
      assert.ok(under && under.y > PLAYER.killY, `${p.id}: a fall at (${x}, ${z}) is a death`);
    }
  }
});

test('every enemy stands on a floor', () => {
  for (const e of ASCENT.enemies) {
    assert.ok(floorAt(e.pos[0], e.pos[1], e.pos[2]), `${e.id} at ${e.pos} is standing on nothing`);
  }
});

test('every route waypoint is on a floor', () => {
  for (const [name, route] of Object.entries(ASCENT.routes)) {
    for (const [x, y, z] of route) {
      assert.ok(floorAt(x, y, z), `${name}: waypoint (${x}, ${y}, ${z}) is on nothing`);
    }
  }
});

test('no two boxes overlap in volume (overlaps build as doubled walls)', () => {
  const all = [...ASCENT.solids, ...ASCENT.kerbs];
  const clashes = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i].box;
      const b = all[j].box;
      const ox = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
      const oy = Math.min(a[3], b[3]) - Math.max(a[2], b[2]);
      const oz = Math.min(a[5], b[5]) - Math.max(a[4], b[4]);
      if (ox > EPS && oy > EPS && oz > EPS) clashes.push(`${all[i].id} × ${all[j].id}`);
    }
  }
  assert.deepEqual(clashes, []);
});

test('the catwalk vista is a real breather: out of every turret\'s reach', async () => {
  const { ENEMY } = await import('../src/config.js');
  const [x0, x1, , y1, z0, z1] = ASCENT.solids.find((s) => s.id === 'vista').box;
  // The nearest point of the balcony to each turret must still be out of range.
  for (const t of ASCENT.enemies.filter((e) => e.type === 'turret')) {
    const nx = Math.max(x0, Math.min(t.pos[0], x1));
    const nz = Math.max(z0, Math.min(t.pos[2], z1));
    const d = Math.hypot(nx - t.pos[0], y1 - t.pos[1], nz - t.pos[2]);
    assert.ok(d > ENEMY.turret.attackRange, `${t.id} reaches the vista (${d.toFixed(1)} m)`);
  }
});

/** Ray against every solid and landmark box; true when nothing blocks. */
function sees(from, to) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const ray = new THREE.Ray(a, dir.normalize());
  const hit = new THREE.Vector3();
  for (const { box: [x0, x1, y0, y1, z0, z1] } of [...ASCENT.solids, ...ASCENT.landmarks]) {
    const bx = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    if (bx.containsPoint(b)) continue;   // the target's own box
    if (ray.intersectBox(bx, hit) && hit.distanceTo(a) < len - 0.5) return false;
  }
  return true;
}

test('the goal is visible from the start: the lift tower from the trailhead', () => {
  // Aimed at the tower's south face, high up — the beacon sits on its roof, so
  // a ray to the beacon itself grazes the tower and proves nothing.
  const [, , y0, y1, , z1] = ASCENT.landmarks.find((l) => l.id === 'lift-tower').box;
  const eye = ASCENT.rooms.find((r) => r.id === 'R0').eye.pos;
  const face = [0, y0 + (y1 - y0) * 0.6, z1];
  assert.ok(sees(eye, face), 'the summit edge hides the tower from the trailhead');
  // ...and with margin, not by a hair: the sightline clears the lower core's
  // south edge — the last thing between the trailhead and the tower — by 3 m.
  const [, , , edgeY, , edgeZ] = ASCENT.solids.find((s) => s.id === 'core-low').box;
  const t = (eye[2] - edgeZ) / (eye[2] - face[2]);
  const clearance = eye[1] + (face[1] - eye[1]) * t - edgeY;
  assert.ok(clearance >= 3, `the tower clears the shoulder edge by only ${clearance.toFixed(1)} m`);
});

test('the base is visible from the summit, which is the level\'s story beat', () => {
  const [x0, x1, , y1, z0, z1] = ASCENT.landmarks.find((l) => l.id === 'the-base').box;
  const nearTop = [(x0 + x1) / 2, y1 - 2, z1];
  assert.ok(sees(ASCENT.rooms.find((r) => r.id === 'R7').eye.pos, nearTop));
});

export { tops, floorAt, floorBelow, sees, JUMP_APEX, RED_APEX };
