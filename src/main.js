import * as THREE from "three";
import { Input } from "./core/input.js";
import { Player } from "./core/player.js";
import { CameraRig } from "./core/camera-rig.js";
import { PaintGun } from "./paint/paint-gun.js";
import { Level01 } from "./levels/level-01-mission.js";
import { Hud } from "./ui/hud.js";

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

// Win overlay — inline here (decision #15), hidden until the level reports a win.
const winOverlay = document.createElement("div");
winOverlay.style.cssText = [
  "position: fixed; inset: 0; display: none;",
  "align-items: center; justify-content: center;",
  "background: rgba(15,15,22,.72); color: #e8e8ef;",
  "font: 700 2rem/1.2 ui-sans-serif, system-ui, sans-serif;",
  "text-align: center; z-index: 30; cursor: pointer;",
].join(" ");
winOverlay.innerHTML =
  '<div>EXTRACTED<span style="display:block;font-size:.9rem;font-weight:600;opacity:.6;margin-top:.6rem">press R to redeploy</span></div>';
winOverlay.addEventListener("click", () => {
  winOverlay.style.display = "none";
});
document.body.appendChild(winOverlay);

// Levels read the scene and report a win back through this object.
// `game` stays the integration point until core swaps in game.js.
const game = {
  scene,
  onWin: () => {
    winOverlay.style.display = "flex";
  },
};

const rig = new CameraRig(window.innerWidth / window.innerHeight);
const input = new Input(renderer.domElement);
const hud = new Hud(document.getElementById("hud"));
hud.onColourClick((i) => gun && gun.selectColour(i));

function loadLevel() {
  if (level) {
    level.dispose(); // removes root from scene + frees every GPU resource
    scene.remove(player.mesh);
    player.dispose();
  }

  winOverlay.style.display = "none";

  level = new Level01(game);
  level.load(); // no awaits inside yet — main.js does not await it
  scene.add(level.root);

  player = new Player(level.surfaces);
  player.position.copy(level.spawn);
  scene.add(player.mesh);

  gun = new PaintGun(level.surfaces, 1);
}

loadLevel();
document.getElementById("loading").remove();

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
  if (actions.refill) gun.refillAmmo();

  const mouse = input.consumeMouse();
  player.look(mouse.x, mouse.y);
  player.update(dt, input, actions);

  level.update(dt, player);

  gun.update(dt);
  if (input.firing && input.locked) gun.tryFire(rig.camera);

  for (const s of level.surfaces) s.update(elapsed);

  rig.update(player);
  player.mesh.visible = !rig.firstPerson;

  hud.update(dt, {
    gun,
    player,
    surfaces: level.surfaces,
    locked: input.locked,
  });

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

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});
