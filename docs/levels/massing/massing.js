// The massing model — any layout in src/levels/layouts/, built from its data.
// Open /docs/levels/massing/massing.html?layout=ascent (or last-colour).
// See massing.html for what this is and is not.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYOUTS } from '../../../src/levels/layouts/index.js';
import { ENEMY, PLAYER } from '../../../src/config.js';

const params = new URLSearchParams(location.search);
const L = LAYOUTS[params.get('layout')] ?? LAYOUTS.ascent;
document.title = `${L.name} Massing`;
document.getElementById('heading').textContent = `${L.name.toUpperCase()} — MASSING`;

// One colour per room for the walkable tops, so "which room is this floor"
// reads at a glance. Rock is one grey; nothing else gets colour.
const ROOM_COLOUR = {
  R0: 0xd8c9a3, R1: 0xa9cbbf, R2: 0xe3b48f, R3: 0xbdb7dd, R4: 0xe6c97a,
  R5: 0x9fbedb, R6: 0xdba3a3, R7: 0xc6d99b, R8: 0xf0e08a,
};
const ROCK = 0x8a9097;
const ENEMY_COLOUR = {
  wallCrawler: 0x7d4fc4, turret: 0xd99a1e, charger: 0xc0392b,
  drainer: 0x4c6ef5, stalker: 0x0c8599, bigArm: 0x862e9c,
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6ec);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-40, 90, 60);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);

const LAYER_NAMES = ['enemies', 'ranges', 'routes', 'sight', 'gates', 'traps'];
const layers = { labels: [] };
for (const k of LAYER_NAMES) { layers[k] = new THREE.Group(); scene.add(layers[k]); }
layers.sight.visible = false;

const solidsForRays = [];
const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function boxMesh([x0, x1, y0, y1, z0, z1], material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}
function edges(mesh, color = 0x3b434b) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }));
  e.position.copy(mesh.position);
  scene.add(e);
}

// --- solids -----------------------------------------------------------------
for (const s of L.solids) {
  const colour = s.kind === 'cover' ? 0x7b8a99 : s.kind === 'siphon' ? 0x5a4f6b : s.kind === 'wall' ? 0x9aa0a6 : ROCK;
  const m = boxMesh(s.box, mat(colour));
  scene.add(m);
  edges(m);
  solidsForRays.push(m);
  if (s.top) {
    const [x0, x1, , y1, z0, z1] = s.box;
    const l = s.lips ?? {};
    const topColour = s.kind === 'catch' ? 0xb39b77 : s.kind === 'shoulder' ? 0xd9d6cf : ROOM_COLOUR[s.room] ?? 0xd9d6cf;
    scene.add(boxMesh([x0 - (l['-x'] ?? 0), x1 + (l['+x'] ?? 0), y1, y1 + 0.08, z0 - (l['-z'] ?? 0), z1 + (l['+z'] ?? 0)], mat(topColour)));
  }
}
for (const k of L.kerbs ?? []) scene.add(boxMesh(k.box, mat(0x6b7682)));

// --- slabs: catwalk segments, pads, lifts --------------------------------------
for (const s of L.slabs ?? []) {
  const gap = s.kind === 'catwalk' ? 0.12 : 0;   // show the segments as segments
  const colour = { catwalk: 0xe08a3c, pad: 0xd9473c, lift: 0xf0e08a }[s.kind] ?? 0xd9d6cf;
  const m = boxMesh([s.x[0] + gap, s.x[1] - gap, s.y - 0.3, s.y, s.z[0] + gap, s.z[1] - gap], mat(colour));
  scene.add(m);
  edges(m);
  // Scaffold posts down to the floor below, as the level builder makes them.
  if (s.scaffold) {
    const cx = (s.x[0] + s.x[1]) / 2;
    const cz = (s.z[0] + s.z[1]) / 2;
    const floor = Math.max(0, ...L.solids.filter(({ box: b }) => cx >= b[0] && cx <= b[1] && cz >= b[4] && cz <= b[5] && b[3] < s.y).map((o) => o.box[3]));
    for (const px of [s.x[0] + 0.2, s.x[1] - 0.2]) scene.add(boxMesh([px - 0.1, px + 0.1, floor, s.y - 0.3, s.z[0] + 0.1, s.z[0] + 0.3], mat(0xd9473c)));
  }
}

// --- paintable strips: a thin teal skin just off the rock face -----------------
for (const s of L.strips) {
  const off = 0.05;
  const [a0, a1] = s.span;
  const along = s.face === '+z' || s.face === '-z';
  const n = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[s.face];
  const x = along ? [a0, a1] : [s.at + n[0] * off - 0.02, s.at + n[0] * off + 0.02];
  const z = along ? [s.at + n[1] * off - 0.02, s.at + n[1] * off + 0.02] : [a0, a1];
  scene.add(boxMesh([x[0], x[1], s.y[0], s.y[1], z[0], z[1]], new THREE.MeshBasicMaterial({ color: 0x2fa58a })));
}

// --- paint already on the floor when the level loads (the Primer's examples) ---
const PREPAINT = { blue: 0x2f7fe0, red: 0xe0453a, green: 0x2fae4e };
for (const p of L.prepaint ?? []) {
  const [x0, x1, z0, z1] = p.rect;
  scene.add(boxMesh([x0, x1, p.y + 0.08, p.y + 0.14, z0, z1], new THREE.MeshBasicMaterial({ color: PREPAINT[p.colour] })));
}

// --- gates: the red fields; trap zones: amber volumes; Siphon targets ------------
for (const g of L.gates ?? []) {
  layers.gates.add(boxMesh(g.box, new THREE.MeshBasicMaterial({ color: 0xd9473c, transparent: true, opacity: 0.35, depthWrite: false })));
  const [x0, x1, , y1, z0, z1] = g.box;
  addLabel(`gate: opens ${g.opens}`, [(x0 + x1) / 2, y1 + 0.5, (z0 + z1) / 2], 'gate');
}
for (const t of L.traps ?? []) {
  layers.traps.add(boxMesh(t.box, new THREE.MeshBasicMaterial({ color: 0xf08c00, transparent: true, opacity: 0.3, depthWrite: false })));
  const [x0, x1, , y1, z0, z1] = t.box;
  addLabel(`trap: ${t.kind} (trap pass)`, [(x0 + x1) / 2, y1 + 0.5, (z0 + z1) / 2], 'trap');
}
for (const t of L.targets ?? []) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0xf08c00 }));
  m.position.set(...t.pos);
  layers.traps.add(m);
}

// --- landmarks -------------------------------------------------------------
const landmarkMeshes = [];
for (const lm of L.landmarks ?? []) {
  const m = boxMesh(lm.box, mat(0x3d4650));
  scene.add(m);
  landmarkMeshes.push(m);
  solidsForRays.push(m);
  if (lm.beacon) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    beacon.position.set(...lm.beacon);
    scene.add(beacon);
  }
}

const grid = new THREE.GridHelper(400, 40, 0x9aa5ae, 0xc3ccd3);
grid.position.y = -0.01;
scene.add(grid);

// --- enemies + turret ranges -------------------------------------------------
for (const e of L.enemies) {
  const h = e.type === 'turret' ? 1.2 : e.type === 'bigArm' ? 3.4 : 1.7;
  const body = new THREE.Mesh(
    e.type === 'turret' ? new THREE.CylinderGeometry(0.7, 0.9, h, 12) : new THREE.ConeGeometry(e.type === 'bigArm' ? 1.4 : 0.6, h, 12),
    new THREE.MeshLambertMaterial({ color: ENEMY_COLOUR[e.type] ?? 0x555555, wireframe: !!e.planned }),
  );
  body.position.set(e.pos[0], e.pos[1] + h / 2, e.pos[2]);
  layers.enemies.add(body);
  addLabel(`${e.id}${e.wave > 1 ? ` (wave ${e.wave})` : ''}${e.planned ? ' — planned' : ''}`, [e.pos[0], e.pos[1] + h + 0.6, e.pos[2]], 'enemy');
  if (e.type === 'turret') {
    const r = ENEMY.turret.attackRange;
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return new THREE.Vector3(e.pos[0] + Math.cos(a) * r, e.pos[1] + 0.2, e.pos[2] + Math.sin(a) * r);
      })),
      new THREE.LineBasicMaterial({ color: 0xd99a1e }),
    );
    layers.ranges.add(ring);
  }
}

// --- routes -----------------------------------------------------------------
function polyline(points, color, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y + 0.35, z)));
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 1, gapSize: 0.6 })
    : new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(g, m);
  if (dashed) line.computeLineDistances();
  return line;
}
for (const [name, route] of Object.entries(L.routes)) {
  layers.routes.add(name === 'main' ? polyline(route, 0xffffff) : polyline(route, 0xd9473c, true));
}

// --- a player-sized figure at every room's arrival point ----------------------
const playerMat = new THREE.MeshLambertMaterial({ color: 0x3b5bdb });
const figures = [];
for (const r of L.rooms) {
  const [x, y, z] = r.eye.pos;
  const fig = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER.radius, PLAYER.height - PLAYER.radius * 2, 4, 10), playerMat);
  fig.position.set(x, y - 1.5 + PLAYER.height / 2, z);
  fig.userData.room = r.id;
  figures.push(fig);
  scene.add(fig);
}

// --- room labels at the centre of each room's biggest floor ----------------------
for (const r of L.rooms) {
  const tops = L.solids.filter((s) => s.room === r.id && s.top && (!s.kind || s.kind === 'pocket'));
  if (!tops.length) continue;
  const big = tops.reduce((a, b) => ((a.box[1] - a.box[0]) * (a.box[5] - a.box[4]) >= (b.box[1] - b.box[0]) * (b.box[5] - b.box[4]) ? a : b));
  const [x0, x1, , y1, z0, z1] = big.box;
  addLabel(`${r.id} ${r.name}`, [(x0 + x1) / 2, y1 + 2, (z0 + z1) / 2], 'room');
}

// --- sightlines from every arrival point to the level's goal --------------------
const goal = new THREE.Vector3(...L.doc.goal.point);
const ray = new THREE.Raycaster();
for (const r of L.rooms) {
  const from = new THREE.Vector3(...r.eye.pos);
  const dir = goal.clone().sub(from);
  const len = dir.length();
  ray.set(from, dir.normalize());
  ray.far = len - 0.6;
  const blocked = ray.intersectObjects(solidsForRays.filter((m) => !landmarkMeshes.includes(m))).length > 0;
  layers.sight.add(polyline([[from.x, from.y - 0.35, from.z], [goal.x, goal.y - 0.35, goal.z]], blocked ? 0xc0392b : 0x2f9e44));
}
document.getElementById('sight-label').textContent = `Sightlines to ${L.doc.goal.label}`;

// --- labels as HTML, projected every frame -------------------------------------
function addLabel(text, pos, kind) {
  const el = document.createElement('div');
  el.className = `tag ${kind}`;
  el.textContent = text;
  document.getElementById('labels').appendChild(el);
  layers.labels.push({ el, pos: new THREE.Vector3(...pos), kind });
}
const v = new THREE.Vector3();
const occluder = new THREE.Raycaster();
const toLabel = new THREE.Vector3();
/** True when rock stands between the camera and the label's point. */
function hidden(pos) {
  toLabel.copy(pos).sub(camera.position);
  const len = toLabel.length();
  occluder.set(camera.position, toLabel.normalize());
  occluder.far = len - 0.5;
  return occluder.intersectObjects(solidsForRays, false).length > 0;
}
function placeLabels() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const l of layers.labels) {
    // A label follows its layer: hiding trap zones hides their labels too.
    const visible = layerOn.labels && (l.kind === 'room' || layerOn[l.kind === 'enemy' ? 'enemies' : `${l.kind}s`]);
    v.copy(l.pos).project(camera);
    // Eye views are "what you see": a label behind rock is not something you see.
    const show = visible && v.z < 1 && v.z > -1 && camera.position.distanceTo(l.pos) < 160
      && !(current?.startsWith('eye-') && hidden(l.pos));
    l.el.style.display = show ? 'block' : 'none';
    if (show) {
      l.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      l.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    }
  }
}

// --- views -------------------------------------------------------------------
const VIEWS = [
  ...L.doc.views,
  ...L.rooms.map((r) => ({
    name: `eye-${r.id}`, label: `Eye: ${r.id} ${r.name}${r.planned ? ' (planned)' : ''}`, pos: r.eye.pos, target: r.eye.target, fov: 70,
    caption: `${r.id} — ${r.name}. What you see on arrival, at 1.5 m eye height. "${r.question}"`,
  })),
];
const caption = document.getElementById('caption');
let current = null;
function view(name) {
  const vw = VIEWS.find((x) => x.name === name);
  if (!vw) return false;
  camera.fov = vw.fov;
  camera.updateProjectionMatrix();
  camera.position.set(...vw.pos);
  controls.target.set(...vw.target);
  controls.update();
  caption.textContent = vw.caption;
  current = name;
  // Your own body is not in your own view.
  for (const f of figures) f.visible = name !== `eye-${f.userData.room}`;
  for (const b of document.querySelectorAll('#views button')) b.classList.toggle('on', b.dataset.name === name);
  history.replaceState(null, '', `?layout=${L.id}&view=${name}`);
  return true;
}
for (const vw of VIEWS) {
  const b = document.createElement('button');
  b.textContent = vw.label;
  b.dataset.name = vw.name;
  b.addEventListener('click', () => view(vw.name));
  document.getElementById('views').appendChild(b);
}

const layerOn = { labels: true, enemies: true, ranges: true, routes: true, sight: false, gates: true, traps: true };
for (const cb of document.querySelectorAll('[data-layer]')) {
  cb.addEventListener('change', () => {
    const k = cb.dataset.layer;
    layerOn[k] = cb.checked;
    if (layers[k] && layers[k].isObject3D) layers[k].visible = cb.checked;
  });
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  placeLabels();
}

window.massing = {
  view,
  views: () => VIEWS.map((x) => x.name),
  layer: (k, on) => { layerOn[k] = on; if (layers[k]?.isObject3D) layers[k].visible = on; const cb = document.querySelector(`[data-layer="${k}"]`); if (cb) cb.checked = on; },
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  camera,
  controls,
};

// `?clean` hides the panel and caption, for capturing frames into the doc.
if (params.has('clean')) {
  document.getElementById('panel').style.display = 'none';
  caption.style.display = 'none';
}

view(params.get('view') ?? 'overview');
animate();
