// OWNER: E (Levels)
//
// The level viewer: load any level with a free camera and look at it.
//
// DEV ONLY — open /src/levels/viewer.html?level=<id>&shot=<name>. It builds the
// level exactly as main.js does (same registry, same `game` shape, same lights)
// but runs no player, no gun and no enemy AI, so nothing moves and nothing needs
// pointer lock. That last part matters: the in-app browser refuses pointer lock,
// so the game's Play button cannot start there, and this page still works.
//
// It is a LOOKING tool, not a play tool. "Can the player make this jump" is a
// test in tests/; "does this look right" is a shot here. See level-shots.js.
//
// `window.viewer` is the scripting hook: an agent (or the console) can call
// `viewer.load('ascent')` then `viewer.shot('top')` and screenshot the result.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LEVELS, levelEntry, createLevel, DEFAULT_LEVEL_ID } from './index.js';
import { levelShots, VIEWER_FOV, EYE_HEIGHT } from './level-shots.js';
import { preloadEnemyModel } from '../enemies/enemy.js';

// --- the same renderer, scene defaults and lights as main.js -----------------
// Copied, not imported: main.js builds them at module scope and starts the game
// on import. If main.js changes its lights, change them here too, or the viewer
// shows a level lit differently from the game.
const DEFAULT_BACKGROUND = 0x0f0f16;
const DEFAULT_FOG = { colour: 0x0f0f16, near: 45, far: 110 };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8899bb, 0x22222a, 0.5));

const camera = new THREE.PerspectiveCamera(VIEWER_FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

// `?nomodels` fails every decor model load on purpose, to see what a level looks
// like when its downloads do not arrive: every kind should fall back to its
// code-built shapes, never to bare ground. (Enemies have their own loader.)
const noModels = new URLSearchParams(window.location.search).has('nomodels');
const gltfLoader = new GLTFLoader();
const game = {
  scene,
  // The level's SkyProbe (#194) renders its cube map through this.
  renderer,
  loadGLB: noModels
    ? (url) => Promise.reject(new Error(`[viewer] ?nomodels: ${url} skipped`))
    : (url) => gltfLoader.loadAsync(url),
  onWin: () => {},
};

// --- UI ----------------------------------------------------------------------
const ui = {
  level: document.getElementById('level'),
  shots: document.getElementById('shots'),
  helpers: document.getElementById('helpers'),
  fog: document.getElementById('fog'),
  copy: document.getElementById('copy'),
  cam: document.getElementById('cam'),
  status: document.getElementById('status'),
};

for (const entry of LEVELS) {
  const opt = document.createElement('option');
  opt.value = entry.id;
  opt.textContent = entry.name;
  ui.level.appendChild(opt);
}

// --- state -------------------------------------------------------------------
let level = null;
let shots = [];
let currentShot = null;
let helpers = null;
let helpersOn = true;
let fogOn = true;
let levelFog = null;
let loading = Promise.resolve();

/**
 * Debug overlays, kept OUT of level.root so the level's own dispose stays the
 * thing under test. Cyan = floors, magenta = walls, yellow = the win volume,
 * red = enemy spawn points, and a player-sized capsule at spawn for scale.
 */
function buildHelpers(lvl) {
  const group = new THREE.Group();
  group.name = 'viewer-helpers';

  for (const s of lvl.surfaces) {
    const b = new THREE.Box3().setFromObject(s.mesh);
    group.add(new THREE.Box3Helper(b, s.isFloor ? 0x33e0ff : 0xff44cc));
  }
  if (lvl.extraction) group.add(new THREE.Box3Helper(lvl.extraction, 0xffd400));

  // 0.4 radius, eye at EYE_HEIGHT — about the player's size, which is the only
  // scale reference that matters when asking "is that ledge reachable".
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, EYE_HEIGHT - 0.8, 4, 12),
    new THREE.MeshBasicMaterial({ color: 0x44ff88, wireframe: true }),
  );
  body.position.copy(lvl.spawn);
  body.position.y += (EYE_HEIGHT - 0.8) / 2 + 0.4 - 1.0;
  group.add(body);

  for (const p of lvl.spawnPoints ?? []) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3344 }),
    );
    dot.position.copy(p);
    group.add(dot);
  }
  return group;
}

function disposeGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) o.material.dispose();
  });
  scene.remove(group);
}

function renderShotButtons() {
  ui.shots.replaceChildren();
  shots.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${i < 9 ? `${i + 1}  ` : ''}${s.label ?? s.name}`;
    b.dataset.name = s.name;
    b.classList.toggle('active', s.name === currentShot);
    b.addEventListener('click', () => shot(s.name));
    ui.shots.appendChild(b);
  });
}

function setUrl() {
  const params = new URLSearchParams(window.location.search);
  if (level) params.set('level', level.__id);
  if (currentShot) params.set('shot', currentShot); else params.delete('shot');
  history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

// --- the API -----------------------------------------------------------------
/** Move the camera to a named shot. Returns false for an unknown name. */
function shot(name) {
  const s = shots.find((x) => x.name === name);
  if (!s) return false;
  camera.position.set(...s.position);
  controls.target.set(...s.target);
  controls.update();
  setFog(s.fog !== false);
  currentShot = name;
  renderShotButtons();
  setUrl();
  return true;
}

/** Load a level by registry id; resolves once load() has finished. */
function load(id, shotName = 'overview') {
  loading = loading.then(() => doLoad(id, shotName));
  return loading;
}

async function doLoad(id, shotName) {
  ui.status.textContent = 'Loading…';
  if (level) {
    level.dispose();
    level = null;
  }
  if (helpers) {
    disposeGroup(helpers);
    helpers = null;
  }
  // Each level sets its own mood; reset to main.js's default so a level that
  // sets none does not inherit the previous level's fog.
  scene.background = new THREE.Color(DEFAULT_BACKGROUND);
  scene.fog = new THREE.Fog(DEFAULT_FOG.colour, DEFAULT_FOG.near, DEFAULT_FOG.far);

  const entry = levelEntry(id);
  const next = createLevel(entry.id, game);
  try {
    await next.load();
  } catch (err) {
    next.dispose();
    ui.status.textContent = `Load failed: ${err.message}`;
    console.error('[viewer] level failed to load', err);
    throw err;
  }
  next.__id = entry.id;
  level = next;
  scene.add(level.root);
  levelFog = scene.fog;

  helpers = buildHelpers(level);
  helpers.visible = helpersOn;
  scene.add(helpers);

  ui.level.value = entry.id;
  shots = levelShots(level);
  currentShot = null;
  if (!shot(shotName)) shot('overview');
  ui.status.textContent = entry.name;
  return level;
}

function setHelpers(on) {
  helpersOn = on;
  if (helpers) helpers.visible = on;
  ui.helpers.classList.toggle('active', on);
}

/** Fog and the level's "air" go together, as in main.js's minimap pass. */
function setFog(on) {
  fogOn = on;
  scene.fog = on ? levelFog : null;
  if (level?.atmosphere) level.atmosphere.visible = on;
  ui.fog.classList.toggle('active', on);
}

/** The current camera as shot data, ready to paste into a level's `static SHOTS`. */
function cameraAsShot(name = 'new-shot') {
  const r = (n) => Math.round(n * 100) / 100;
  const p = camera.position;
  const t = controls.target;
  return { name, label: name, position: [r(p.x), r(p.y), r(p.z)], target: [r(t.x), r(t.y), r(t.z)] };
}

window.viewer = {
  load,
  shot,
  shots: () => shots.map((s) => s.name),
  helpers: setHelpers,
  fog: setFog,
  cameraAsShot,
  /**
   * Resolves once load() has finished. Decor models are NOT awaited by levels
   * (they upgrade in place), so wait a moment more before judging the props.
   */
  ready: () => loading,
  /**
   * Resolves after the canvas has redrawn. `shot()` moves the camera at once,
   * but the picture only changes on the next animation frame — a screenshot
   * taken straight after `shot()` shows the PREVIOUS view.
   */
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  get level() { return level; },
  camera,
  controls,
  scene,
  renderer,
  /**
   * Mean ms per frame over `n` frames of a synchronous render, GPU included
   * (`gl.finish()`), for the PRs' before/after numbers (#194, #196).
   */
  timeRender(n = 120) {
    const gl = renderer.getContext();
    renderer.render(scene, camera);
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      tick();
      gl.finish();
    }
    return (performance.now() - t0) / n;
  },
};

// --- wiring ------------------------------------------------------------------
ui.level.addEventListener('change', () => load(ui.level.value, currentShot ?? 'overview'));
ui.helpers.addEventListener('click', () => setHelpers(!helpersOn));
ui.fog.addEventListener('click', () => setFog(!fogOn));
ui.copy.addEventListener('click', async () => {
  const text = JSON.stringify(cameraAsShot());
  try {
    await navigator.clipboard.writeText(text);
    ui.status.textContent = 'Copied camera';
  } catch {
    ui.status.textContent = text;
  }
});
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (e.code === 'KeyH') setHelpers(!helpersOn);
  else if (e.code === 'KeyG') setFog(!fogOn);
  else if (/^Digit[1-9]$/.test(e.code)) {
    const s = shots[Number(e.code.slice(5)) - 1];
    if (s) shot(s.name);
  }
});
controls.addEventListener('change', () => {
  // Any manual move leaves the named shot, so the URL never claims a view the
  // screen is no longer showing.
  if (currentShot) {
    const s = shots.find((x) => x.name === currentShot);
    if (s && camera.position.distanceToSquared(new THREE.Vector3(...s.position)) > 1e-4) {
      currentShot = null;
      renderShotButtons();
      setUrl();
    }
  }
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  tick();
}

/** One viewer frame: tick the level's looks, then draw. */
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (level) {
    for (const s of level.surfaces) s.update?.(elapsed);
    // Decor must be ticked like the game ticks it (level-01 update()): that tick
    // is what shows the code-built fallback when a model download fails. Without
    // it the viewer shows bare ground where the game shows placeholder trees.
    // The camera stands in for the player; with no paint down, it recolours nothing.
    for (const props of Object.values(level.decor ?? {})) props.update?.(dt, camera.position);
  }
  const p = camera.position;
  ui.cam.textContent = `cam ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}${currentShot ? `  ·  ${currentShot}` : ''}`;
  renderer.render(scene, camera);
}

setHelpers(true);
setFog(true);

const params = new URLSearchParams(window.location.search);
preloadEnemyModel()
  .catch((err) => console.warn('[viewer] enemy models unavailable, using fallbacks', err))
  .then(() => load(params.get('level') ?? DEFAULT_LEVEL_ID, params.get('shot') ?? 'overview'))
  .then(animate, animate);
