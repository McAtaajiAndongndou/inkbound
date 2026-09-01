import * as THREE from 'three';
import { Input } from './core/input.js';
import { Player } from './core/player.js';
import { CameraRig } from './core/camera-rig.js';
import { PaintGun } from './paint/paint-gun.js';
import { buildLevel1 } from './levels/level-01.js';
import { Hud } from './ui/hud.js';

// ---------------------------------------------------------------------------
// Renderer + scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for lab hardware
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setScissorTest(false);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f16);
scene.fog = new THREE.Fog(0x0f0f16, 45, 110);

// lights: one directional caster, one ambient fill. Deliberate, not decorative.
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

// ---------------------------------------------------------------------------
// Game state — everything here is torn down and rebuilt on restart
// ---------------------------------------------------------------------------
let level = null;
let player = null;
let gun = null;

const rig = new CameraRig(window.innerWidth / window.innerHeight);
const input = new Input(renderer.domElement);
const hud = new Hud(document.getElementById('hud'));
hud.onColourClick((i) => gun && gun.selectColour(i));

function loadLevel() {
  if (level) {
    scene.remove(level.group);
    scene.remove(player.mesh);
    level.dispose();     // .dispose() on every geometry, material and texture
    player.dispose();
  }

  level = buildLevel1();
  scene.add(level.group);

  player = new Player(level.surfaces);
  player.position.copy(level.spawn);
  scene.add(player.mesh);

  gun = new PaintGun(level.surfaces, 1);
}

loadLevel();
document.getElementById('loading').remove();

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // clamp so a stall cannot teleport you
  const elapsed = clock.elapsedTime;
  const actions = input.consumeActions();

  if (actions.restart) loadLevel();
  if (actions.toggleView) rig.toggle();
  if (actions.colour !== null) gun.selectColour(actions.colour);

  const mouse = input.consumeMouse();
  player.look(mouse.x, mouse.y);
  player.update(dt, input, actions);

  gun.update(dt);
  if (input.firing && input.locked) gun.tryFire(rig.camera);

  for (const s of level.surfaces) s.update(elapsed);

  rig.update(player);
  player.mesh.visible = !rig.firstPerson;

  hud.update(dt, { gun, player, surfaces: level.surfaces, locked: input.locked });

  // --- main view ---
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, rig.camera);

  // --- minimap, bottom-right, orthographic (Viewing rubric) ---
  const size = Math.round(Math.min(w, h) * 0.2);
  const pad = 16;
  renderer.setScissorTest(true);
  renderer.setViewport(w - size - pad, h - size - pad, size, size);
  renderer.setScissor(w - size - pad, h - size - pad, size, size);
  renderer.render(scene, rig.minimap);
  renderer.setScissorTest(false);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});
