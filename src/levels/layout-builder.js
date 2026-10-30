// OWNER: E (Levels)
//
// Builds a level's geometry from a layout DATA file (src/levels/layouts/*.js).
//
// The point is the one the Ascent's design doc makes: the drawings, the massing
// model and the level must come from the same numbers, so the build cannot
// "interpret" the design. This file turns the data's boxes into the kit's
// PaintSurfaces and nothing else — no layout decision is made here.
//
// THE RULES IT APPLIES, all of them mechanical:
//
//   1. Every box gets a walkable top and four side faces (no bottom: nothing
//      stands under a box). Every face is ROCK — unpaintable — except where a
//      layout `strip` says it is a climb. A paintable wall is always a decision
//      in the data, never an accident of the builder.
//   2. A face pressed against another box is removed, and so is the part of a
//      top that another box stands on. Otherwise two planes share the same
//      place: z-fighting, and a wall the player collides with inside a mountain.
//   3. Thin walkable pieces (`slabs`: catwalk segments, pads, the lift) are a
//      floor plane plus a plain underside, so they are visible from below.
//      Pads marked `scaffold` get posts down to the floor below them.
//   4. Landmarks are plain meshes: lit by the scene, never collided with.
import * as THREE from 'three';
import * as kit from './level-kit.js';
import { MARKER } from '../config.js';

const EPS = 1e-6;
const MIN = 0.05;   // a face thinner than this is a rounding sliver, not geometry
const SIDES = ['+x', '-x', '+z', '-z'];

/** Remove `cut` from every rect ({a0, a1, b0, b1}); returns what is left. */
function subtract(rects, cut) {
  const out = [];
  for (const r of rects) {
    const a0 = Math.max(r.a0, cut.a0);
    const a1 = Math.min(r.a1, cut.a1);
    const b0 = Math.max(r.b0, cut.b0);
    const b1 = Math.min(r.b1, cut.b1);
    if (a1 - a0 <= EPS || b1 - b0 <= EPS) { out.push(r); continue; }
    if (a0 - r.a0 > EPS) out.push({ a0: r.a0, a1: a0, b0: r.b0, b1: r.b1 });
    if (r.a1 - a1 > EPS) out.push({ a0: a1, a1: r.a1, b0: r.b0, b1: r.b1 });
    if (b0 - r.b0 > EPS) out.push({ a0, a1, b0: r.b0, b1: b0 });
    if (r.b1 - b1 > EPS) out.push({ a0, a1, b0: b1, b1: r.b1 });
  }
  return out;
}

/** The plane and the along-axis range of one side of a box. */
function sideOf([x0, x1, , , z0, z1], side) {
  switch (side) {
    case '+x': return { plane: x1, a: [z0, z1] };
    case '-x': return { plane: x0, a: [z0, z1] };
    case '+z': return { plane: z1, a: [x0, x1] };
    default: return { plane: z0, a: [x0, x1] };
  }
}

/** Does box `o` sit against (or straddle) this side's plane, on its outside? */
function covers(o, side, plane) {
  const [x0, x1, , , z0, z1] = o.box;
  switch (side) {
    case '+x': return x0 <= plane + EPS && x1 > plane + EPS;
    case '-x': return x1 >= plane - EPS && x0 < plane - EPS;
    case '+z': return z0 <= plane + EPS && z1 > plane + EPS;
    default: return z1 >= plane - EPS && z0 < plane - EPS;
  }
}

function emitFace(level, side, plane, a0, a1, y0, y1, paintable, cells) {
  const common = { yBase: y0, yTop: y1, unpaintable: !paintable, cells };
  switch (side) {
    case '+x': return kit.face(level, { ...common, x: plane, zMin: a0, zMax: a1, normalX: 1 });
    case '-x': return kit.face(level, { ...common, x: plane, zMin: a0, zMax: a1, normalX: -1 });
    case '+z': return kit.face(level, { ...common, z: plane, xMin: a0, xMax: a1 });
    default: return kit.face(level, { ...common, z: plane, xMin: a0, xMax: a1, normalZ: -1 });
  }
}

/** Split one visible wall rect into rock and paintable columns, by the strips on it. */
function emitWall(level, side, plane, rect, strips, cells, tag) {
  const on = strips.filter((s) => s.face === side && Math.abs(s.at - plane) < EPS);
  const cutsA = new Set([rect.a0, rect.a1]);
  const cutsY = new Set([rect.b0, rect.b1]);
  for (const s of on) {
    for (const v of s.span) if (v > rect.a0 && v < rect.a1) cutsA.add(v);
    for (const v of s.y) if (v > rect.b0 && v < rect.b1) cutsY.add(v);
  }
  const as = [...cutsA].sort((p, q) => p - q);
  const ys = [...cutsY].sort((p, q) => p - q);
  for (let i = 0; i < as.length - 1; i++) {
    const a0 = as[i];
    const a1 = as[i + 1];
    if (a1 - a0 < MIN) continue;
    // Walk up the column, merging cells of the same kind into one face.
    let runStart = ys[0];
    let runStrip = null;
    for (let j = 0; j < ys.length - 1; j++) {
      const midA = (a0 + a1) / 2;
      const midY = (ys[j] + ys[j + 1]) / 2;
      const strip = on.find((s) => midA > s.span[0] && midA < s.span[1] && midY > s.y[0] && midY < s.y[1]) ?? null;
      if (j > 0 && strip !== runStrip) {
        if (ys[j] - runStart >= MIN) tag(emitFace(level, side, plane, a0, a1, runStart, ys[j], !!runStrip, cells), runStrip);
        runStart = ys[j];
      }
      runStrip = strip;
    }
    const top = ys[ys.length - 1];
    if (top - runStart >= MIN) tag(emitFace(level, side, plane, a0, a1, runStart, top, !!runStrip, cells), runStrip);
  }
}

/**
 * Build every box, kerb, slab and landmark in `layout` into `level`.
 * Each surface is tagged with `layoutId` (the box it came from), `room`, and,
 * for a climb face, `strip` (the strip id) — tests and triggers read those.
 */
export function buildLayout(level, layout, { cells }) {
  const boxes = [
    ...layout.solids,
    ...(layout.kerbs ?? []).map((k) => ({ ...k, kind: 'kerb' })),
  ];

  for (const s of boxes) {
    const tag = (surf, strip) => {
      surf.layoutId = s.id;
      surf.room = s.room;
      if (strip) surf.strip = strip.id;
      return surf;
    };

    // --- the top, minus anything standing on it ------------------------------
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    let tops = [{ a0: x0 - (l['-x'] ?? 0), a1: x1 + (l['+x'] ?? 0), b0: z0 - (l['-z'] ?? 0), b1: z1 + (l['+z'] ?? 0) }];
    for (const o of boxes) {
      if (o === s) continue;
      const [ox0, ox1, oy0, oy1, oz0, oz1] = o.box;
      // Something standing on this top — or another top at the SAME height,
      // which a lip would otherwise run into (Terrace Two's west lip slid
      // under leg 1's floor).
      const standsOn = oy0 <= y1 + EPS && oy1 > y1 + EPS;
      const sameHeight = Math.abs(oy1 - y1) < EPS;
      if (standsOn || sameHeight) tops = subtract(tops, { a0: ox0, a1: ox1, b0: oz0, b1: oz1 });
      // Two LIPS at the same height can still cross at a corner (Last Colour's
      // south-west balcony): the box listed first keeps the corner.
      if (sameHeight && o.lips && boxes.indexOf(o) < boxes.indexOf(s)) {
        const ol = o.lips;
        tops = subtract(tops, { a0: ox0 - (ol['-x'] ?? 0), a1: ox1 + (ol['+x'] ?? 0), b0: oz0 - (ol['-z'] ?? 0), b1: oz1 + (ol['+z'] ?? 0) });
      }
    }
    // A slab at the same height replaces the floor under it. Terrace One's east
    // lip (for the scree-return climb) runs the whole edge and slid 0.3 m under
    // the first catwalk segment: two floors in one plane.
    for (const sl of layout.slabs ?? []) {
      if (Math.abs(sl.y - y1) < EPS) tops = subtract(tops, { a0: sl.x[0], a1: sl.x[1], b0: sl.z[0], b1: sl.z[1] });
    }
    for (const r of tops) {
      if (r.a1 - r.a0 < MIN || r.b1 - r.b0 < MIN) continue;
      tag(kit.platform(level, { y: y1, xMin: r.a0, xMax: r.a1, zMin: r.b0, zMax: r.b1, mark: s.kind, cells }));
    }

    // --- the four sides, minus anything pressed against them ------------------
    for (const side of SIDES) {
      const { plane, a } = sideOf(s.box, side);
      let walls = [{ a0: a[0], a1: a[1], b0: s.box[2], b1: s.box[3] }];
      for (const o of boxes) {
        if (o === s || !covers(o, side, plane)) continue;
        const oa = side === '+x' || side === '-x' ? [o.box[4], o.box[5]] : [o.box[0], o.box[1]];
        walls = subtract(walls, { a0: oa[0], a1: oa[1], b0: o.box[2], b1: o.box[3] });
      }
      for (const r of walls) {
        if (r.a1 - r.a0 < MIN || r.b1 - r.b0 < MIN) continue;
        emitWall(level, side, plane, r, layout.strips ?? [], cells, tag);
      }
    }
  }

  // --- slabs: a floor plane, a visible underside, scaffold posts ---------------
  const under = new THREE.MeshToonMaterial({ color: 0x6b6f75 });
  for (const s of layout.slabs ?? []) {
    const surf = kit.platform(level, { y: s.y, xMin: s.x[0], xMax: s.x[1], zMin: s.z[0], zMax: s.z[1], mark: s.kind, cells });
    surf.layoutId = s.id;
    surf.room = s.room;
    const w = s.x[1] - s.x[0];
    const d = s.z[1] - s.z[0];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), under);
    slab.position.set((s.x[0] + s.x[1]) / 2, s.y - 0.17, (s.z[0] + s.z[1]) / 2);
    level.root.add(slab);
    surf.underside = slab;   // a collapsing segment (catwalk.js) drops this
    if (s.scaffold) {
      const floor = highestTopBelow(layout, (s.x[0] + s.x[1]) / 2, (s.z[0] + s.z[1]) / 2, s.y);
      const h = s.y - 0.3 - floor;
      if (h > MIN) {
        for (const [px, pz] of [[s.x[0] + 0.2, s.z[0] + 0.2], [s.x[1] - 0.2, s.z[0] + 0.2]]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2), under);
          post.position.set(px, floor + h / 2, pz);
          level.root.add(post);
        }
      }
    }
  }

  // --- landmarks ---------------------------------------------------------------
  for (const lm of layout.landmarks ?? []) {
    const [lx0, lx1, ly0, ly1, lz0, lz1] = lm.box;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(lx1 - lx0, ly1 - ly0, lz1 - lz0), new THREE.MeshToonMaterial({ color: 0x4a5058 }));
    mesh.position.set((lx0 + lx1) / 2, (ly0 + ly1) / 2, (lz0 + lz1) / 2);
    mesh.name = lm.id;
    level.root.add(mesh);
    if (lm.beacon) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: MARKER.white }));
      beacon.position.set(...lm.beacon);
      beacon.name = `${lm.id}-beacon`;
      level.root.add(beacon);
    }
  }
}

/** The highest box top or slab under (x, z), strictly below y. 0 if none. */
function highestTopBelow(layout, x, z, y) {
  let best = -Infinity;
  for (const s of layout.solids) {
    const [x0, x1, , y1, z0, z1] = s.box;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && y1 < y - EPS) best = Math.max(best, y1);
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * A "is this point in room R" test from the layout: on (or just above) any
 * walkable top that belongs to R. Used for wake-on-entry and "is the room clear".
 */
export function roomTest(layout) {
  const rects = [];
  for (const s of layout.solids) {
    // A catch floor is where a fall lands — OUT of the fight. Counting it as the
    // room meant a Charger knocked off the ledge onto its catch shelf was still
    // "on the ledge", so the ledge never cleared and the lift never left.
    if (!s.top || s.kind === 'catch') continue;
    const [x0, x1, , y1, z0, z1] = s.box;
    rects.push({ room: s.room, x0, x1, z0, z1, y: y1 });
  }
  for (const s of layout.slabs ?? []) rects.push({ room: s.room, x0: s.x[0], x1: s.x[1], z0: s.z[0], z1: s.z[1], y: s.y });
  return (room, p) => rects.some((r) => r.room === room
    && p.x >= r.x0 - 0.5 && p.x <= r.x1 + 0.5 && p.z >= r.z0 - 0.5 && p.z <= r.z1 + 0.5
    && p.y >= r.y - 0.5 && p.y <= r.y + 3);
}
