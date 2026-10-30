// OWNER: E (Levels)
//
// The dressing pass (docs/levels/dressing-pass.md): set pieces you cannot paint,
// placed OFF the arena floor — the skyline outside the walls, wall breakup from
// 3 m up, and one story cluster per room.
//
// A dressing item is `{ kind, box: [x0,x1,y0,y1,z0,z1], room?, tilt? }`, the
// prop kit's shape plus an optional `tilt` ([rx, ry, rz] radians, about the
// box's centre) for a bent cage bar or a fallen mast. Each kind's look is a
// config entry `{ colour, shape, look }` (DRESSING.kinds):
//
//   shape  box | round (a cylinder along the box's longest axis) | lump (a
//          low-poly rock or peak) | capsule (a pill)
//   look   toon       flat-shaded Corp machinery (#198's split)
//          silhouette unlit and unfogged: a SHAPE against the sky, like the
//                     Ascent's base, so a skyline 100 m out is not fogged away
//          glass      see-through, for the specimen tubes
//          haze       see-through and unfogged, for chimney smoke on the skyline
//
//   hazed  (optional, on a kind) the skyline's fade: given the level's horizon
//          colour, the instance colour moves DRESSING.skyline.haze of the way
//          toward it, so far blocks sit back instead of reading as near walls
//
// Rules (the doc's, none new):
//   - never a collider: nothing here joins `level.surfaces`
//   - instanced by SHAPE and LOOK, with the kind's colour per instance, so a
//     level's whole dressing is a handful of draw calls however many pieces
//   - built-in materials only, so nothing joins the `uLightDir` pass (rule 5)
//   - under `level.root`, so the dispose walk frees it (rule 6)
import * as THREE from 'three';
import { DRESSING } from '../config.js';
import { flat } from './curves.js';

const UP = new THREE.Vector3(0, 1, 0);

function geometryFor(shape) {
  if (shape === 'round') return new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  if (shape === 'lump') return new THREE.IcosahedronGeometry(0.62, 0);
  // A pill that fills a unit box: 1 across, squashed to 1 long along y, so a
  // box's dimensions are the pill's (its caps are a little flatter for it).
  if (shape === 'capsule') return new THREE.CapsuleGeometry(0.5, 1, 3, 8).scale(1, 0.5, 1);
  return new THREE.BoxGeometry(1, 1, 1);
}

function materialFor(look) {
  if (look === 'silhouette') return new THREE.MeshBasicMaterial({ fog: false });
  if (look === 'glass') {
    return new THREE.MeshBasicMaterial({ transparent: true, opacity: DRESSING.glassOpacity, depthWrite: false });
  }
  if (look === 'haze') {
    return new THREE.MeshBasicMaterial({ transparent: true, opacity: DRESSING.skyline.smokeOpacity, depthWrite: false, fog: false });
  }
  return flat(new THREE.MeshToonMaterial());
}

/**
 * Build `items` under `level.root`. Returns `{ meshes, items }`: one
 * InstancedMesh per shape and look in use, named `dressing:<shape>|<look>`.
 * `horizon` (a hex colour) turns on the skyline's fade for `hazed` kinds.
 */
export function buildDressing(level, items, { horizon = null } = {}) {
  const groups = new Map();
  for (const item of items) {
    const spec = DRESSING.kinds[item.kind];
    if (!spec) throw new Error(`dressing: no kind "${item.kind}" in DRESSING.kinds`);
    const key = `${spec.shape}|${spec.look}`;
    if (!groups.has(key)) groups.set(key, { spec, list: [] });
    groups.get(key).list.push(item);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tilt = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const colour = new THREE.Color();
  const haze = horizon === null ? null : new THREE.Color(horizon);
  const zAxisToY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const xAxisToY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  const meshes = [];
  for (const [key, { spec, list }] of groups) {
    const mesh = new THREE.InstancedMesh(geometryFor(spec.shape), materialFor(spec.look), list.length);
    list.forEach((item, i) => {
      const [x0, x1, y0, y1, z0, z1] = item.box;
      const sx = x1 - x0;
      const sy = y1 - y0;
      const sz = z1 - z0;
      pos.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (spec.shape === 'round' || spec.shape === 'capsule') {
        // A unit cylinder or pill runs along y: turn it onto the box's long axis.
        if (sz >= sx && sz >= sy) { q.copy(zAxisToY); scale.set(sx, sz, sy); }
        else if (sx >= sy) { q.copy(xAxisToY); scale.set(sy, sx, sz); }
        else { q.identity(); scale.set(sx, sy, sz); }
      } else if (spec.shape === 'lump') {
        q.setFromAxisAngle(UP, i * 2.39996);   // golden angle, as the prop kit's scree
        scale.set(sx, sy, sz);
      } else {
        q.identity();
        scale.set(sx, sy, sz);
      }
      if (item.tilt) q.premultiply(tilt.setFromEuler(euler.set(...item.tilt)));
      mesh.setMatrixAt(i, m.compose(pos, q, scale));
      const kind = DRESSING.kinds[item.kind];
      colour.setHex(kind.colour);
      if (haze && kind.hazed) colour.lerp(haze, DRESSING.skyline.haze);
      mesh.setColorAt(i, colour);
    });
    mesh.name = `dressing:${key}`;
    level.root.add(mesh);
    meshes.push(mesh);
  }
  return { meshes, items };
}

/**
 * The skyline's detail, generated from its `block` and `stack` items: rows of
 * lit windows on each block's face toward the level (the face nearest the
 * origin), and a column of smoke puffs above each stack. Only some windows are
 * lit, picked by a fixed hash, so every load looks the same.
 */
export function skylineDetail(items) {
  const S = DRESSING.skyline;
  const out = [];
  items.filter((it) => it.kind === 'block').forEach((b, bi) => {
    const [x0, x1, y0, y1, z0, z1] = b.box;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const facesZ = Math.abs(cz) >= Math.abs(cx);
    const [a0, a1] = facesZ ? [x0, x1] : [z0, z1];
    const face = facesZ ? (cz < 0 ? z1 : z0) : (cx < 0 ? x1 : x0);
    const out1 = facesZ ? (cz < 0 ? 0.1 : -0.1) : (cx < 0 ? 0.1 : -0.1);
    const step = S.windowW + S.windowGap;
    const cols = Math.floor((a1 - a0 - 2 * S.windowMargin + S.windowGap) / step);
    const bottom = Math.max(y0, 0) + S.windowMargin;
    const rows = Math.floor((y1 - S.windowMargin - bottom) / S.windowRow);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (hash(bi, r, c) >= S.windowLit) continue;
        const along = a0 + S.windowMargin + c * step;
        const y = bottom + r * S.windowRow;
        const [f0, f1] = [face, face + out1].sort((p, q) => p - q);
        out.push({
          kind: 'window',
          box: facesZ ? [along, along + S.windowW, y, y + S.windowH, f0, f1] : [f0, f1, y, y + S.windowH, along, along + S.windowW],
        });
      }
    }
  });
  for (const s of items.filter((it) => it.kind === 'stack')) {
    const [x0, x1, , y1, z0, z1] = s.box;
    const w = Math.max(x1 - x0, z1 - z0);
    for (let k = 0; k < S.smokePuffs; k++) {
      const t = (k + 1) / S.smokePuffs;
      const size = w * (1 + (S.smokeGrow - 1) * t);
      const cx = (x0 + x1) / 2 + S.smokeDrift * k;
      const cy = y1 + S.smokeRise * t;
      const cz = (z0 + z1) / 2;
      out.push({ kind: 'smoke', box: [cx - size / 2, cx + size / 2, cy - size / 3, cy + size / 3, cz - size / 2, cz + size / 2] });
    }
  }
  return out;
}

/** A fixed 0..1 hash of three integers (which windows are lit). */
function hash(a, b, c) {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Wall breakup, computed from a layout's solids: a rib (pilaster) every
 * `spacing` metres on each wall face that looks into a room, from `above`
 * metres over whatever top stands at its foot (a 5 m gantry's ribs start at
 * 8 m) to the wall top, and a cornice lip along every wall top.
 *
 * Positions come from the layout's own solids, so a moved wall moves its ribs.
 * `skip(box)` drops a rib that would sit on something else (a lamp, a sign).
 */
export function wallBreakup(solids, { spacing, above, rib, cornice, skip = () => false }) {
  const walls = solids.filter((s) => s.kind === 'wall');
  const tops = solids.filter((s) => s.top);
  const topAt = (x, z) => {
    let h = -Infinity;
    for (const t of tops) {
      const [x0, x1, , y1, z0, z1] = t.box;
      if (x > x0 && x < x1 && z > z0 && z < z1) h = Math.max(h, y1);
    }
    return h;
  };
  const items = [];
  for (const w of walls) {
    const [x0, x1, y0, y1, z0, z1] = w.box;
    const alongX = x1 - x0 >= z1 - z0;
    // The cornice: the wall's top, a lip proud of both faces.
    const lip = cornice.out;
    items.push({ kind: 'cornice', box: [x0 - lip, x1 + lip, y1 - cornice.depth, y1 + cornice.rise, z0 - lip, z1 + lip], room: w.room });

    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const length = a1 - a0;
    const n = Math.floor((length - 2) / spacing);
    if (n < 1) continue;
    const start = a0 + (length - (n - 1) * spacing) / 2;
    for (const side of [-1, 1]) {
      const face = alongX ? (side < 0 ? z0 : z1) : (side < 0 ? x0 : x1);
      for (let k = 0; k < n; k++) {
        const along = start + k * spacing;
        const probe = face + side;   // 1 m out from the face
        const floor = alongX ? topAt(along, probe) : topAt(probe, along);
        if (floor === -Infinity) continue;   // this face looks at nothing: outside
        const from = Math.max(y0, floor) + above;
        if (from > y1 - 1) continue;
        const [f0, f1] = side < 0 ? [face - rib.depth, face] : [face, face + rib.depth];
        const box = alongX
          ? [along - rib.width / 2, along + rib.width / 2, from, y1, f0, f1]
          : [f0, f1, from, y1, along - rib.width / 2, along + rib.width / 2];
        if (!skip(box)) items.push({ kind: 'rib', box, room: w.room });
      }
    }
  }
  return items;
}
