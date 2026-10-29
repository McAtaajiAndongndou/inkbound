// Renders a level design doc's diagrams FROM ITS LAYOUT DATA.
//
//   node docs/levels/massing/render-diagrams.mjs ascent
//   node docs/levels/massing/render-diagrams.mjs last-colour
//
// Writes plan.svg, one section-<id>.svg per cut in the layout's `doc.sections`,
// pacing.svg and timings.json into docs/levels/<layout id>/. Never edit the
// SVGs by hand: change the layout in src/levels/layouts/ and re-run.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYOUTS } from '../../../src/levels/layouts/index.js';
import { PLAYER, SURFACE, ENEMY } from '../../../src/config.js';
import * as THREE from 'three';

const LY = LAYOUTS[process.argv[2] ?? 'ascent'];
if (!LY) throw new Error(`no layout "${process.argv[2]}" — known: ${Object.keys(LAYOUTS).join(', ')}`);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', LY.id);
mkdirSync(OUT, { recursive: true });
const G = Math.abs(PLAYER.gravity);
const JUMP = PLAYER.jumpSpeed ** 2 / (2 * G);
const RED = PLAYER.minBounce ** 2 / (2 * G);
const GREY_SPEED = PLAYER.maxSpeed * SURFACE.grey.standSlow;   // most of the world is grey

const ROOM = { R0: '#d8c9a3', R1: '#a9cbbf', R2: '#e3b48f', R3: '#bdb7dd', R4: '#e6c97a', R5: '#9fbedb', R6: '#dba3a3', R7: '#c6d99b', R8: '#f0e08a' };
const ROCK = '#9aa0a6';
const COVER = '#6f7c89';
const ENEMY_C = { wallCrawler: '#7d4fc4', turret: '#d99a1e', charger: '#c0392b', drainer: '#4c6ef5', stalker: '#0c8599', bigArm: '#862e9c' };
const ENEMY_L = { wallCrawler: 'W', turret: 'T', charger: 'C', drainer: 'D', stalker: 'S', bigArm: 'B' };
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="system-ui, Segoe UI, sans-serif" font-size="11">
<rect width="${w}" height="${h}" fill="#ffffff"/>
${body}
</svg>
`;
}
const text = (x, y, s, o = {}) => `<text x="${r1(x)}" y="${r1(y)}" fill="${o.fill ?? '#1d232a'}" font-size="${o.size ?? 11}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const halo = (x, y, s, o = {}) => `<text x="${r1(x)}" y="${r1(y)}" stroke="#ffffff" stroke-width="3" fill="none" font-size="${o.size ?? 11}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}>${esc(s)}</text>${text(x, y, s, o)}`;

// --- shared: the walkable tops, and which room a point is in ------------------
function tops() {
  const out = [];
  for (const s of LY.solids) {
    if (!s.top) continue;
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    out.push({ x0: x0 - (l['-x'] ?? 0), x1: x1 + (l['+x'] ?? 0), z0: z0 - (l['-z'] ?? 0), z1: z1 + (l['+z'] ?? 0), y: y1, room: s.room });
  }
  for (const s of LY.slabs) out.push({ x0: s.x[0], x1: s.x[1], z0: s.z[0], z1: s.z[1], y: s.y, room: s.room });
  return out;
}
const roomAt = ([x, y, z]) => tops().find((t) => x >= t.x0 - 1e-6 && x <= t.x1 + 1e-6 && z >= t.z0 - 1e-6 && z <= t.z1 + 1e-6 && Math.abs(t.y - y) < 0.01)?.room;
function roomCentre(id) {
  const c = LY.solids.filter((s) => s.room === id && s.top && !s.kind);
  if (!c.length) return null;
  const big = c.reduce((a, b) => ((a.box[1] - a.box[0]) * (a.box[5] - a.box[4]) >= (b.box[1] - b.box[0]) * (b.box[5] - b.box[4]) ? a : b));
  return { x: (big.box[0] + big.box[1]) / 2, y: big.box[3], z: (big.box[4] + big.box[5]) / 2 };
}

// ============================================================================
// PLAN
// ============================================================================
function plan() {
  const S = 5;
  const [X0, X1, Z0, Z1] = LY.doc.planBounds;
  const L = 30, T = 46;
  const W = (X1 - X0) * S + L + 200;
  const H = (Z1 - Z0) * S + T + 30;
  const px = (x) => L + (x - X0) * S;
  const pz = (z) => T + (z - Z0) * S;
  const b = [];

  // grid every 10 m
  for (let x = Math.ceil(X0 / 10) * 10; x <= X1; x += 10) b.push(`<line x1="${px(x)}" y1="${T}" x2="${px(x)}" y2="${pz(Z1)}" stroke="#eef1f4"/>`);
  for (let z = Math.ceil(Z0 / 10) * 10; z <= Z1; z += 10) b.push(`<line x1="${L}" y1="${pz(z)}" x2="${px(X1)}" y2="${pz(z)}" stroke="#eef1f4"/>`);
  b.push(text(L, 18, `${LY.name.toUpperCase()} — PLAN (from above, north up). 1 square = 10 m. Numbers are floor heights in metres.`, { size: 12, weight: 600 }));
  b.push(text(L, 34, 'Void around everything: a fall off an un-kerbed edge with no catch floor is a death.', { fill: '#5b6570' }));

  // solids, lowest top first so higher ones draw over
  const solids = [...LY.solids].sort((a, c) => a.box[3] - c.box[3]);
  for (const s of solids) {
    const [x0, x1, , y1, z0, z1] = s.box;
    const fill = s.kind === 'cover' ? COVER : s.kind === 'catch' ? '#c9b48f' : s.kind === 'shoulder' ? '#d9d6cf' : s.top ? ROOM[s.room] : ROCK;
    b.push(`<rect x="${px(x0)}" y="${pz(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="${fill}" stroke="#4b545c" stroke-width="0.6"/>`);
  }
  for (const k of LY.kerbs) {
    const [x0, x1, , , z0, z1] = k.box;
    b.push(`<rect x="${px(x0)}" y="${pz(z0)}" width="${Math.max((x1 - x0) * S, 1.5)}" height="${Math.max((z1 - z0) * S, 1.5)}" fill="#3d4650"/>`);
  }
  for (const s of LY.slabs) {
    const fill = { catwalk: '#e08a3c', pad: '#d9473c', lift: '#f0e08a' }[s.kind];
    b.push(`<rect x="${px(s.x[0]) + 0.6}" y="${pz(s.z[0]) + 0.6}" width="${(s.x[1] - s.x[0]) * S - 1.2}" height="${(s.z[1] - s.z[0]) * S - 1.2}" fill="${fill}" stroke="#4b545c" stroke-width="0.6"/>`);
  }
  // height labels on the big floors
  for (const s of solids) {
    if (!s.top) continue;
    const [x0, x1, , y1, z0, z1] = s.box;
    if ((x1 - x0) * (z1 - z0) < 50 || s.kind === 'step') continue;
    b.push(halo(px((x0 + x1) / 2), pz((z0 + z1) / 2) + 4, `${y1}`, { anchor: 'middle', fill: '#3d4650' }));
  }
  // climb strips: thick teal on the edge
  for (const st of LY.strips) {
    const along = st.face === '+z' || st.face === '-z';
    const [ax, az, bx, bz] = along ? [st.span[0], st.at, st.span[1], st.at] : [st.at, st.span[0], st.at, st.span[1]];
    b.push(`<line x1="${px(ax)}" y1="${pz(az)}" x2="${px(bx)}" y2="${pz(bz)}" stroke="#16866e" stroke-width="5"/>`);
  }
  // routes
  const pts = (r) => r.map(([x, , z]) => `${r1(px(x))},${r1(pz(z))}`).join(' ');
  b.push(`<polyline points="${pts(LY.routes.main)}" fill="none" stroke="#1d232a" stroke-width="3.5" stroke-linejoin="round"/>`);
  b.push(`<polyline points="${pts(LY.routes.main)}" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>`);
  for (const [name, route] of Object.entries(LY.routes)) {
    if (name !== 'main') b.push(`<polyline points="${pts(route)}" fill="none" stroke="#d9473c" stroke-width="2.4" stroke-dasharray="5 3"/>`);
  }
  // gates: a thick red line across the opening; traps: amber zones; Siphon-style targets: amber diamonds
  for (const g of LY.gates ?? []) {
    const [x0, x1, , , z0, z1] = g.box;
    const [ax, az, bx, bz] = x1 - x0 >= z1 - z0 ? [x0, (z0 + z1) / 2, x1, (z0 + z1) / 2] : [(x0 + x1) / 2, z0, (x0 + x1) / 2, z1];
    b.push(`<line x1="${px(ax)}" y1="${pz(az)}" x2="${px(bx)}" y2="${pz(bz)}" stroke="#d9473c" stroke-width="4" stroke-dasharray="6 3"/>`);
  }
  for (const t of LY.traps ?? []) {
    const [x0, x1, , , z0, z1] = t.box;
    b.push(`<rect x="${px(x0)}" y="${pz(z0)}" width="${(x1 - x0) * S}" height="${Math.max((z1 - z0) * S, 3)}" fill="#f08c00" fill-opacity="0.35" stroke="#f08c00" stroke-dasharray="3 2"/>`);
  }
  for (const t of LY.targets ?? []) {
    const cx = px(t.pos[0]);
    const cy = pz(t.pos[2]);
    b.push(`<path d="M ${cx} ${cy - 5} L ${cx + 5} ${cy} L ${cx} ${cy + 5} L ${cx - 5} ${cy} Z" fill="#f08c00" stroke="#7a4500" stroke-width="0.6"/>`);
  }
  // turret ranges + enemies
  for (const e of LY.enemies.filter((x) => x.type === 'turret')) {
    b.push(`<circle cx="${px(e.pos[0])}" cy="${pz(e.pos[2])}" r="${ENEMY.turret.attackRange * S}" fill="#d99a1e" fill-opacity="0.07" stroke="#d99a1e" stroke-dasharray="4 3"/>`);
  }
  for (const e of LY.enemies) {
    const cx = px(e.pos[0]);
    const cy = pz(e.pos[2]);
    const wave2 = e.wave > 1 || e.planned;
    b.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="${wave2 ? '#ffffff' : ENEMY_C[e.type]}" stroke="${ENEMY_C[e.type]}" stroke-width="2"${e.planned ? ' stroke-dasharray="2 2"' : ''}/>`);
    b.push(text(cx, cy + 3.5, ENEMY_L[e.type], { anchor: 'middle', size: 9, fill: wave2 ? ENEMY_C[e.type] : '#ffffff', weight: 700 }));
  }
  // landmarks
  for (const lm of LY.landmarks ?? []) {
    const [lx0, lx1, , , lz0, lz1] = lm.box;
    if (lx1 < X0 || lx0 > X1 || lz1 < Z0 || lz0 > Z1) continue;   // off the map: see offMap
    b.push(`<rect x="${px(lx0)}" y="${pz(lz0)}" width="${(lx1 - lx0) * S}" height="${(lz1 - lz0) * S}" fill="#3d4650"/>`);
  }
  // room labels
  for (const r of LY.rooms) {
    const c = roomCentre(r.id);
    if (!c) continue;
    b.push(halo(px(c.x), pz(c.z) - 6, `${r.id} ${r.name}`, { anchor: 'middle', weight: 600 }));
  }
  // section cut lines
  const cut = (x1, z1, x2, z2, label) => {
    b.push(`<line x1="${px(x1)}" y1="${pz(z1)}" x2="${px(x2)}" y2="${pz(z2)}" stroke="#2f6fb3" stroke-width="1" stroke-dasharray="8 4"/>`);
    b.push(halo(px(x1), pz(z1) - 4, label, { fill: '#2f6fb3', weight: 600 }));
  };
  for (const c of LY.doc.sections) {
    if (c.axis === 'x') cut(c.at, Z0 + 1, c.at, Z1 - 1, c.id.toUpperCase());
    else cut(X0 + 1, c.at, X1 - 1, c.at, c.id.toUpperCase());
  }
  // something that matters but is off the map (the Ascent's base)
  const off = LY.doc.offMap;
  if (off) {
    b.push(`<line x1="${px(off.from[0])}" y1="${pz(off.from[1])}" x2="${px(off.to[0])}" y2="${pz(off.to[1])}" stroke="#3d4650" stroke-width="1.5"/>`);
    b.push(halo(px(off.to[0]) + 1, pz(off.to[1]) + 12, off.label, { fill: '#3d4650' }));
  }
  // north arrow + scale bar
  const nx = px(X1) - 20, ny = T + 30;
  b.push(`<path d="M ${nx} ${ny - 18} L ${nx - 6} ${ny} L ${nx + 6} ${ny} Z" fill="#1d232a"/>`);
  b.push(text(nx, ny + 14, 'N', { anchor: 'middle', weight: 700 }));
  b.push(`<rect x="${px(X1) - 120}" y="${pz(Z1) - 14}" width="${20 * S}" height="5" fill="#1d232a"/>`);
  b.push(text(px(X1) - 120, pz(Z1) - 18, '20 m'));

  // legend
  const lx = px(X1) + 18;
  let ly = T + 70;
  const key = (sw, label) => { b.push(sw(lx, ly)); b.push(text(lx + 22, ly + 4, label)); ly += 20; };
  b.push(text(lx, ly - 18, 'KEY', { weight: 700 }));
  key((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#16866e" stroke-width="5"/>`, 'Paintable climb (green)');
  // Only what this level contains: a key full of absent things is noise.
  const slabKinds = new Set((LY.slabs ?? []).map((s) => s.kind));
  if (slabKinds.has('catwalk')) key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="#e08a3c"/>`, 'Catwalk segment');
  if (slabKinds.has('pad')) key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="#d9473c"/>`, 'Chain pad');
  if (LY.solids.some((s) => s.kind === 'catch')) key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="#c9b48f"/>`, 'Catch floor');
  key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="${COVER}"/>`, 'Cover');
  if ((LY.kerbs ?? []).length) key((x, y) => `<rect x="${x}" y="${y - 2}" width="16" height="4" fill="#3d4650"/>`, 'Kerb (1 m)');
  key((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#1d232a" stroke-width="3.5"/><line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#fff" stroke-width="1.8"/>`, 'Main route');
  key((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#d9473c" stroke-width="2.4" stroke-dasharray="5 3"/>`, 'Other route');
  if ((LY.gates ?? []).length) key((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#d9473c" stroke-width="4" stroke-dasharray="6 3"/>`, 'Gate field');
  if ((LY.traps ?? []).length) key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="#f08c00" fill-opacity="0.35" stroke="#f08c00"/>`, 'Trap zone (trap pass)');
  if ((LY.targets ?? []).length) key((x, y) => `<path d="M ${x + 8} ${y - 5} L ${x + 13} ${y} L ${x + 8} ${y + 5} L ${x + 3} ${y} Z" fill="#f08c00"/>`, 'Siphon target (#100)');
  const NAMES = { wallCrawler: 'Wall-crawler', turret: 'Turret (15 m ring)', charger: 'Charger', drainer: 'Drainer', stalker: 'Stalker', bigArm: 'Big Arm' };
  for (const type of [...new Set(LY.enemies.map((e) => e.type))]) {
    key((x, y) => `<circle cx="${x + 8}" cy="${y}" r="6" fill="${ENEMY_C[type]}"/>`, NAMES[type] ?? type);
  }
  key((x, y) => `<circle cx="${x + 8}" cy="${y}" r="6" fill="#fff" stroke="#7d4fc4" stroke-width="2"/>`, 'Later wave (hollow)');
  if (LY.enemies.some((e) => e.planned)) key((x, y) => `<circle cx="${x + 8}" cy="${y}" r="6" fill="#fff" stroke="#862e9c" stroke-width="2" stroke-dasharray="2 2"/>`, 'Planned, not built');
  key((x, y) => `<line x1="${x}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#2f6fb3" stroke-dasharray="8 4"/>`, 'Section cut');
  ly += 6;
  for (const r of LY.rooms) key((x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="12" fill="${ROOM[r.id]}"/>`, `${r.id} ${r.name}`);

  return svg(W, H, b.join('\n'));
}

// ============================================================================
// SECTIONS
// ============================================================================
function section({ id, axis, at, title, from, to, top = 62 }) {
  // u is the horizontal coordinate of the drawing. For a cut at x = c the
  // drawing runs along z with SOUTH ON THE LEFT (the way the player travels);
  // for a cut at z = c it runs along x, WEST ON THE LEFT.
  const S = 6;
  const Y0 = -6, Y1 = top;
  const L = 70, T = 40;
  const span = Math.abs(to - from);
  // The reach gauge gets its own margin on the right, clear of the rock.
  const GAUGE = 150;
  const W = Math.max(span * S + L + GAUGE, 760);
  const H = (Y1 - Y0) * S + T + 40;
  const pu = (u) => L + (axis === 'x' ? (from - u) : (u - from)) * S;
  const py = (y) => T + (Y1 - y) * S;
  const b = [];
  const crosses = (lo, hi) => lo < at - 1e-6 === false && hi > at + 1e-6 === false ? false : lo <= at + 1e-6 && hi >= at - 1e-6;
  const uRange = (box) => (axis === 'x' ? [box[4], box[5]] : [box[0], box[1]]);
  const cRange = (box) => (axis === 'x' ? [box[0], box[1]] : [box[4], box[5]]);

  b.push(text(L, 18, title, { size: 12, weight: 600 }));
  b.push(text(L, 32, `Side view, true scale (1 m = ${S} px both ways). ${axis === 'x' ? 'South ← → North' : 'West ← → East'}.`, { fill: '#5b6570' }));
  for (let y = 0; y <= Y1 - 2; y += 10) {
    b.push(`<line x1="${L}" y1="${py(y)}" x2="${W - 20}" y2="${py(y)}" stroke="#eef1f4"/>`);
    b.push(text(L - 8, py(y) + 4, `${y} m`, { anchor: 'end', fill: '#5b6570' }));
  }
  b.push(text(L - 8, py(-4) + 4, 'void', { anchor: 'end', fill: '#c0392b' }));

  const cut = (box) => { const [c0, c1] = cRange(box); return c0 <= at + 1e-6 && c1 >= at - 1e-6; };
  const rectU = (u0, u1, y0, y1, fill, stroke = '#4b545c') => {
    const a = pu(u0), c = pu(u1);
    return `<rect x="${r1(Math.min(a, c))}" y="${r1(py(y1))}" width="${r1(Math.abs(c - a))}" height="${r1((y1 - y0) * S)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`;
  };
  for (const s of [...LY.solids, ...(LY.landmarks ?? [])]) {
    if (!cut(s.box)) continue;
    const [u0, u1] = uRange(s.box);
    const isLandmark = (LY.landmarks ?? []).includes(s);
    const fill = s.kind === 'cover' ? COVER : s.kind === 'siphon' ? '#5a4f6b' : isLandmark ? '#3d4650' : ROCK;
    b.push(rectU(u0, u1, s.box[2], s.box[3], fill));
    if (s.top) b.push(rectU(u0, u1, s.box[3] - 0.5, s.box[3], s.kind === 'catch' ? '#c9b48f' : s.kind === 'shoulder' ? '#d9d6cf' : ROOM[s.room], 'none'));
  }
  for (const g of LY.gates ?? []) if (cut(g.box)) { const [u0, u1] = uRange(g.box); b.push(rectU(u0, Math.max(u1, u0 + 0.3), g.box[2], g.box[3], '#d9473c', 'none').replace('/>', ' fill-opacity="0.45"/>')); }
  for (const t of LY.traps ?? []) if (cut(t.box)) { const [u0, u1] = uRange(t.box); b.push(rectU(u0, Math.max(u1, u0 + 0.3), t.box[2], t.box[3], '#f08c00', '#f08c00').replace('/>', ' fill-opacity="0.3"/>')); }
  for (const k of LY.kerbs ?? []) if (cut(k.box)) { const [u0, u1] = uRange(k.box); b.push(rectU(u0, u1, k.box[2], k.box[3], '#3d4650', 'none')); }
  for (const s of LY.slabs ?? []) {
    const box = [s.x[0], s.x[1], s.y - 0.4, s.y, s.z[0], s.z[1]];
    if (!cut(box)) continue;
    const [u0, u1] = uRange(box);
    b.push(rectU(u0 + 0.1, u1 - 0.1, s.y - 0.4, s.y, { catwalk: '#e08a3c', pad: '#d9473c', lift: '#f0e08a' }[s.kind]));
    // a fall from a traversal piece: where does it land?
    if (s.kind === 'catwalk' || s.kind === 'pad') {
      const u = (u0 + u1) / 2;
      const p = axis === 'x' ? [at, s.y, u] : [u, s.y, at];
      const below = tops().filter((t) => p[0] >= t.x0 && p[0] <= t.x1 && p[2] >= t.z0 && p[2] <= t.z1 && t.y < s.y - 0.5).sort((a, c) => c.y - a.y)[0];
      if (below) b.push(`<line x1="${pu(u)}" y1="${py(s.y - 0.6)}" x2="${pu(u)}" y2="${py(below.y + 0.4)}" stroke="#c0392b" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#fall)"/>`);
    }
  }
  // climb strips that face along the drawing's u axis
  for (const st of LY.strips) {
    const facesU = axis === 'x' ? (st.face === '+z' || st.face === '-z') : (st.face === '+x' || st.face === '-x');
    if (!facesU || at < st.span[0] - 1e-6 || at > st.span[1] + 1e-6) continue;
    const out = (st.face[0] === '+' ? 1 : -1) * 0.35;
    const u = st.at + out;
    b.push(`<line x1="${pu(u)}" y1="${py(st.y[0])}" x2="${pu(u)}" y2="${py(st.y[1])}" stroke="#16866e" stroke-width="4"/>`);
    // Label on the ROCK side of the face: the open side is where the player stands.
    const rockRight = pu(u - out) > pu(u);
    b.push(halo(pu(u) + (rockRight ? 6 : -6), py((st.y[0] + st.y[1]) / 2), `${st.y[1] - st.y[0]} m green`, { anchor: rockRight ? 'start' : 'end', fill: '#0f5e4d', weight: 600 }));
  }
  // enemies and players near the cut
  const near = (p) => Math.abs((axis === 'x' ? p[0] : p[2]) - at) <= 4;
  for (const e of LY.enemies) {
    if (!near(e.pos)) continue;
    const u = axis === 'x' ? e.pos[2] : e.pos[0];
    b.push(`<circle cx="${pu(u)}" cy="${py(e.pos[1] + 0.9)}" r="5" fill="${e.wave > 1 ? '#fff' : ENEMY_C[e.type]}" stroke="${ENEMY_C[e.type]}" stroke-width="2"/>`);
  }
  for (const r of LY.rooms) {
    const p = [r.eye.pos[0], r.eye.pos[1] - 1.5, r.eye.pos[2]];
    if (!near(p)) continue;
    const u = axis === 'x' ? p[2] : p[0];
    b.push(`<rect x="${pu(u) - 2.4}" y="${py(p[1] + PLAYER.height)}" width="4.8" height="${PLAYER.height * S}" rx="2.4" fill="#3b5bdb"/>`);
    b.push(halo(pu(u), py(p[1] + PLAYER.height) - 5, r.id, { anchor: 'middle', fill: '#3b5bdb', weight: 700 }));
  }
  // routes that run in the plane of the cut
  for (const [name, route] of Object.entries(LY.routes)) {
    const segs = [];
    for (let i = 1; i < route.length; i++) if (near(route[i - 1]) && near(route[i])) segs.push([route[i - 1], route[i]]);
    for (const [a, c] of segs) {
      const ua = axis === 'x' ? a[2] : a[0];
      const uc = axis === 'x' ? c[2] : c[0];
      if (name === 'chain') {
        // a bounce is an arc: up to the red apex, over, down onto the pad
        const apex = Math.max(a[1], c[1]) + 1.0;
        b.push(`<path d="M ${pu(ua)} ${py(a[1] + 0.3)} Q ${(pu(ua) + pu(uc)) / 2} ${py(apex + 1.5)} ${pu(uc)} ${py(c[1] + 0.3)}" fill="none" stroke="#d9473c" stroke-width="1.6" stroke-dasharray="4 2"/>`);
      } else {
        b.push(`<line x1="${pu(ua)}" y1="${py(a[1] + 0.3)}" x2="${pu(uc)}" y2="${py(c[1] + 0.3)}" stroke="#1d232a" stroke-width="1.2"/>`);
      }
    }
  }
  // the reach gauge, at true scale, so every height above can be compared to it
  const gx = L + span * S + 40, g0 = py(0);
  b.push(`<rect x="${gx - 2.4}" y="${py(PLAYER.height)}" width="4.8" height="${PLAYER.height * S}" rx="2.4" fill="#3b5bdb"/>`);
  for (const [h, label, c] of [[JUMP, `jump ${JUMP.toFixed(2)} m`, '#5b6570'], [RED, `red bounce ${RED.toFixed(2)} m`, '#c0392b']]) {
    b.push(`<line x1="${gx + 6}" y1="${py(h)}" x2="${gx + 16}" y2="${py(h)}" stroke="${c}" stroke-width="1.5"/>`);
    b.push(`<line x1="${gx + 11}" y1="${g0}" x2="${gx + 11}" y2="${py(h)}" stroke="${c}" stroke-width="0.8"/>`);
    b.push(halo(gx + 18, py(h) + 4, label, { fill: c }));
  }
  b.push(halo(gx - 6, py(0) + 14, 'reach gauge', { anchor: 'middle', fill: '#5b6570' }));

  const defs = '<defs><marker id="fall" viewBox="0 0 10 10" refX="5" refY="8" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 2 L5 9 L9 2" fill="none" stroke="#c0392b" stroke-width="1.5"/></marker></defs>';
  return svg(W, H, defs + b.join('\n'));
}

// ============================================================================
// PACING — measured travel from the routes, plus the design's fight estimates
// ============================================================================
function timings(route) {
  const per = {};
  let length = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const c = route[i];
    const flat = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const rise = c[1] - a[1];
    // A rise bigger than a jump over a short distance is a climb: at
    // PLAYER.climbSpeed, plus ~2 s to aim and paint the strip.
    const isClimb = rise > JUMP + 0.01 && flat < 3;
    const climb = isClimb ? rise / PLAYER.climbSpeed + 2 : 0;
    // A segment belongs to the room you are moving INTO; a climb belongs to the
    // room that owns its strip (the R1 climbs end on Terrace One, but are R1).
    const strip = isClimb && LY.strips.find((s) => Math.abs(s.y[0] - a[1]) < 0.01 && Math.abs(s.y[1] - c[1]) < 0.01);
    const room = (strip && strip.room) || roomAt(c) || roomAt(a) || '?';
    const t = flat / GREY_SPEED + climb;
    per[room] = (per[room] ?? 0) + t;
    length += flat + Math.max(rise, 0);
  }
  return { per, length };
}

function pacing() {
  const main = timings(LY.routes.main);
  const rows = LY.rooms.map((r) => {
    const travel = main.per[r.id] ?? 0;
    const dwell = r.dwellSeconds ?? 0;
    return { id: r.id, name: r.name, intensity: r.intensity, planned: !!r.planned, travel: r1(travel), dwell, fight: r.fightSeconds, total: r1(travel + dwell + r.fightSeconds) };
  });
  const total = rows.reduce((a, r) => a + r.total, 0);
  const result = { assumptions: { walkSpeed: r1(GREY_SPEED), climbSpeed: PLAYER.climbSpeed, note: 'Walk speed is grey ground (maxSpeed x grey standSlow). Fight times are design estimates.' }, routeMetres: r1(main.length), rooms: rows, totalSeconds: r1(total) };
  // An alternative route (the Ascent's chain) replaces one room's travel.
  const alt = LY.doc.altRoute;
  let altNote = '';
  if (alt) {
    const t = timings(LY.routes[alt.route]);
    const altSeconds = r1(Object.values(t.per).reduce((a, c) => a + c, 0) + alt.paintSeconds);
    const replaced = rows.find((r) => r.id === alt.replaces);
    const withAlt = total - replaced.travel + altSeconds + alt.extraSeconds;
    result.altRoute = { route: alt.route, seconds: altSeconds, totalSeconds: r1(withAlt) };
    altNote = ` (≈ ${Math.floor(withAlt / 60)} min ${Math.round(withAlt % 60)} s taking the ${alt.route})`;
  }
  const planned = rows.filter((r) => r.planned);
  if (planned.length) {
    const without = total - planned.reduce((a, r) => a + r.total, 0);
    result.withoutPlannedSeconds = r1(without);
    altNote += `; ${Math.floor(without / 60)} min ${Math.round(without % 60)} s without the planned beats`;
  }

  const S = 2.0;   // px per second
  const L = 50, T = 50, Hc = 180;
  const W = total * S + L + 40;
  const H = T + Hc + 116;
  const b = [];
  b.push(text(L, 18, `PACING — first-timer, main route. ${Math.floor(total / 60)} min ${Math.round(total % 60)} s${altNote}.`, { size: 12, weight: 600 }));
  b.push(text(L, 34, `Bar width = time (travel measured from the route at ${r1(GREY_SPEED)} m/s on grey + climbs; fights are estimates). Height = intensity.`, { fill: '#5b6570' }));
  for (let i = 0; i <= 10; i += 5) {
    const y = T + Hc - (i / 10) * Hc;
    b.push(`<line x1="${L}" y1="${y}" x2="${W - 40}" y2="${y}" stroke="#eef1f4"/>`);
    b.push(text(L - 6, y + 4, `${i}`, { anchor: 'end', fill: '#5b6570' }));
  }
  let x = L;
  let prev = null;
  let narrow = false;
  for (const r of rows) {
    const w = r.total * S;
    const h = Math.max(r.intensity / 10 * Hc, 3);
    b.push(`<rect x="${r1(x)}" y="${r1(T + Hc - h)}" width="${r1(Math.max(w - 1, 1))}" height="${r1(h)}" fill="${ROOM[r.id]}" stroke="#4b545c" stroke-width="0.6"${r.planned ? ' stroke-dasharray="4 3" fill-opacity="0.5"' : ''}/>`);
    if (r.fight) b.push(`<rect x="${r1(x + (r.travel + r.dwell) * S)}" y="${r1(T + Hc - h)}" width="${r1(Math.max(r.fight * S - 1, 1))}" height="${r1(h)}" fill="#000" fill-opacity="0.12"/>`);
    if (prev) b.push(`<line x1="${r1(x)}" y1="${T + Hc - prev}" x2="${r1(x)}" y2="${T + Hc - h}" stroke="#1d232a" stroke-width="1"/>`);
    if (r.total > 0) {
      // Narrow bars stagger their labels so neighbours do not collide.
      const drop = w < 40 && (narrow = !narrow) ? 28 : 0;
      b.push(text(x + w / 2, T + Hc + 16 + drop, r.planned ? `${r.id}*` : r.id, { anchor: 'middle', weight: 700 }));
      b.push(text(x + w / 2, T + Hc + 30 + drop, `${Math.round(r.total)} s`, { anchor: 'middle', fill: '#5b6570' }));
    }
    x += w;
    prev = h;
  }
  for (let m = 0; m <= total / 60; m++) {
    const mx = L + m * 60 * S;
    b.push(`<line x1="${mx}" y1="${T + Hc + 66}" x2="${mx}" y2="${T + Hc + 72}" stroke="#1d232a"/>`);
    b.push(text(mx, T + Hc + 86, `${m} min`, { anchor: 'middle', fill: '#5b6570' }));
  }
  b.push(text(L, H - 8, `Darker part of a bar = fighting (estimate). Lighter = moving, climbing (measured) and refilling (estimate).${planned.length ? ' * = planned, not built.' : ''}`, { fill: '#5b6570' }));
  return { svg: svg(Math.ceil(W), H, b.join('\n')), result };
}

// ============================================================================
// SIGHTLINES — can each room's arrival point see the level's goal?
// ============================================================================
function sightlines() {
  const face = new THREE.Vector3(...LY.doc.goal.point);
  const boxes = [...LY.solids, ...(LY.landmarks ?? [])].map(({ box: [x0, x1, y0, y1, z0, z1] }) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
  const hit = new THREE.Vector3();
  return LY.rooms.map((r) => {
    const a = new THREE.Vector3(...r.eye.pos);
    const dir = face.clone().sub(a);
    const len = dir.length();
    const ray = new THREE.Ray(a, dir.normalize());
    const blocked = boxes.some((b) => !b.containsPoint(face) && ray.intersectBox(b, hit) && hit.distanceTo(a) < len - 0.5);
    return { id: r.id, seesGoal: !blocked, metres: Math.round(len) };
  });
}

// --- write -----------------------------------------------------------------
writeFileSync(join(OUT, 'plan.svg'), plan());
for (const c of LY.doc.sections) writeFileSync(join(OUT, `section-${c.id}.svg`), section(c));
const p = pacing();
writeFileSync(join(OUT, 'pacing.svg'), p.svg);
p.result.sightlines = sightlines();
writeFileSync(join(OUT, 'timings.json'), `${JSON.stringify(p.result, null, 2)}\n`);
console.log(JSON.stringify(p.result, null, 2));
