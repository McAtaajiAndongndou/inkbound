import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Input } from "./core/input.js";
import { Player } from "./core/player.js";
import { Avatar } from "./shaders/avatar.js";
import { CameraRig } from "./core/camera-rig.js";
import { PaintGun } from "./paint/paint-gun.js";
import { Level01 } from "./levels/level-01-mission.js";
import { Hud } from "./ui/hud.js";
import { PaintGunModel } from "./paint/paint-gun-model.js";


import { Menu } from "./ui/menu.js";
import { audio } from "./audio/audio-manager.js";
import { preloadEnemyModel } from "./enemies/enemy.js";
import { PLAYER } from "./config.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setScissorTest(false);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f16);
scene.fog = new THREE.Fog(0x0f0f16, 45, 110);

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

let level = null;
let player = null;
let gun = null;
let gunModel = null;

const muzzleVec = new THREE.Vector3();
const handVec = new THREE.Vector3();
let avatar = null;
const lastPos = new THREE.Vector3();
const hud = new Hud(document.getElementById("hud"));
hud.onColourClick((i) => gun && gun.selectColour(i));

window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", () => audio.unlock());

// Levels read the scene and report a win back through this object.
// `game` stays the integration point until core swaps in game.js.
//
// `loadGLB` is the ONE glTF loader for the game. MECHANICS.md:196 puts the
// GLB/animation pipeline in `shaders/`, and the levels lane must not grow a
// second one -- so a level that wants a model asks for it here instead of
// importing GLTFLoader itself. Levels treat it as optional: with no loader they
// build their own fallback geometry, which is what keeps `node --test` (no DOM,
// no server) from dialling out on every level load.
const gltfLoader = new GLTFLoader();

const game = {
  scene,
  loadGLB: (url) => gltfLoader.loadAsync(url),
  onWin: () => {
    hud.showEnd("win");
    audio.play("win");
  },
};

const rig = new CameraRig(window.innerWidth / window.innerHeight);
scene.add(rig.camera);
const input = new Input(renderer.domElement);

function hidePlaceholder(p, a) {
  setPlaceholderVisible(p, false);
  for (const child of p.mesh.children) {
    if (child !== a.root) child.visible = false;
  }
}

/**
 * Show or hide the PLACEHOLDER capsule — the pill-shaped stand-in the player is
 * drawn as until the avatar model arrives.
 *
 * #39 #1, "the pill shows up sometimes when pressing R". The pill is this
 * capsule: `CapsuleGeometry`, white, and it WAS only hidden once the avatar
 * model finished loading. On the first load the `#loading` screen covers that
 * window, so it was never seen; `R` restarts with no loading screen, so every
 * restart put a white capsule on screen for as long as the model took to come
 * back. "Sometimes", because a warm HTTP cache usually hides it.
 *
 * Two things this deliberately does NOT do:
 *
 *   - It does not touch `mesh.visible`. `animate()` sets that every frame from
 *     the camera mode, so a flag there would be overwritten immediately.
 *   - It does not touch the mesh's CHILDREN. The avatar's own root is a child of
 *     this mesh, so hiding the children (which `hidePlaceholder` does, for the
 *     gun) would hide the avatar instead.
 */
function setPlaceholderVisible(p, visible) {
  if (p.mesh.material) p.mesh.material.visible = visible;
}

function loadLevel() {
  if(gun){
    gun.dispose();
  }
 
  if (gunModel){
    gunModel.dispose();
    gunModel = null;
  }
  if (level) {
    if (avatar) avatar.dispose();
    level.dispose();
    scene.remove(player.mesh);
    player.dispose();
  }

  hud.hideEnd();

  level = new Level01(game);
  level.load();
  scene.add(level.root);

  player = new Player(level.surfaces, level.spawn);
  scene.add(player.mesh);

  // Hidden NOW, before the avatar exists, and revealed only if the model never
  // arrives. See `setPlaceholderVisible` (#39 #1). Order matters: hiding it
  // after `new Avatar(...)` would need to know to leave the avatar's own root
  // alone, and this way nothing is hidden that should not be.
  setPlaceholderVisible(player, false);

  const thisPlayer = player;
  avatar = new Avatar(
    player.mesh,
    () => {
      if (player === thisPlayer) hidePlaceholder(thisPlayer, avatar);
    },
    () => {
      // No model, ever: fall back to the capsule rather than leaving the player
      // as an invisible pair of floating hands.
      if (player === thisPlayer) {
        setPlaceholderVisible(thisPlayer, true);
        console.warn('[main] avatar model unavailable — showing the placeholder capsule');
      }
    },
  );
  avatar.setArmed(true);
  lastPos.copy(player.mesh.position);

  player.onDeath = () => {
    avatar.die();
    hud.showEnd("lose");
    audio.play("lose");
  };

  

  gun = new PaintGun(level.surfaces, 1, level.enemies, scene);
  gunModel = new PaintGunModel(rig.camera, player, avatar);
}

preloadEnemyModel().then(() => {
  loadLevel();
  document.getElementById("loading").remove();
  animate();
});

// Title + pause menu. Open whenever the pointer is unlocked (load, Escape).
const menu = new Menu(document.body, {
  audio,
  canvas: renderer.domElement,
  onRestart: loadLevel,
});

const clock = new THREE.Clock();

/** One step of gameplay. Skipped entirely while the menu is open. */
function simulate(dt, elapsed, actions, mouse) {
  if (actions.restart){
    loadLevel();
    return;
  }
  if (actions.toggleView) rig.toggle();
  if (actions.colour !== null) gun.selectColour(actions.colour);
  if (actions.refill) gun.refillAmmo();

  player.look(mouse.x, mouse.y, PLAYER.lookSensitivity * menu.sensitivity);
  player.update(dt, input, actions);
 

  const p = player.mesh.position;
  const dx = p.x - lastPos.x;
  const dz = p.z - lastPos.z;
  const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
  lastPos.copy(p);
  if (!player.dead) avatar.setMoving(speed > 0.5);
  avatar.update(dt);

  level.update(dt, player);
  player.checkEnemyContact(level.enemies);

  gun.update(dt);
  if (input.firing && input.locked && !player.dead && gun.tryFire(rig.camera, gunModel?.getMuzzleWorldPosition(muzzleVec, rig.firstPerson), input.aiming)) {
    gunModel?.kick();
    audio.play("fire");
    if (gun.lastShot === "splat") {
      audio.play("splat");
    } else {
      audio.play(gun.lastShot);
      hud.showHitmarker(gun.lastShot === "kill");
    }
  }

  for (const s of level.surfaces) s.update(elapsed);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // clamp so a stall cannot teleport you
  const elapsed = clock.elapsedTime;

  // Always drain input, so keys pressed while paused do not fire on resume.
  const actions = input.consumeActions();
  const mouse = input.consumeMouse();

  // Menu up (title or Escape): the world freezes but keeps rendering behind it,
  // so enemies cannot hurt you while you change settings.
  if (!menu.open) {
    rig.setAiming(input.aiming);
    simulate(dt, elapsed, actions, mouse);
  }

  rig.update(player,dt);
  player.mesh.visible = !rig.firstPerson;


  if (gunModel){
    gunModel.update(rig.firstPerson,dt);
  }

  hud.update(dt, {
    gun,
    player,
    surfaces: level.surfaces,
  });

  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, rig.camera);

  // --- minimap, bottom-right, orthographic (Viewing rubric) ---
  // Two things have to come off for this pass, and both were needed:
  //
  //   1. scene.fog. Fog is scaled for the player's camera, which sits ~6 units
  //      off the ground, but the minimap camera sits 60 units up -- well past
  //      fogFar -- so every surface would render 100% fogged.
  //   2. level.atmosphere. That is the level's "air": the sky dome and the mist
  //      sheets. Those are real geometry, so turning fog off does not touch
  //      them; without this the mist sheets draw as a grey wash over the map.
  //
  // Restored afterwards rather than rebuilt: the level owns both.
  //
  // Deliberate tradeoff on the fog toggle: it flips the USE_FOG define, so
  // three.js switches to the fog-free variant of each program. Programs are
  // cached after the first two frames, so this is a per-frame program switch,
  // not a per-frame recompile. If the minimap ever grows expensive, the clean
  // fix is a separate scene for it -- not worth it at beta.
  const size = Math.round(Math.min(w, h) * 0.2);
  const pad = 16;
  const fog = scene.fog;
  const atmosphere = level.atmosphere;
  const lake = level.lake;
  scene.fog = null;
  if (atmosphere) atmosphere.visible = false;
  if (lake) lake.visible = false;
  renderer.setScissorTest(true);
  renderer.setViewport(w - size - pad, h - size - pad, size, size);
  renderer.setScissor(w - size - pad, h - size - pad, size, size);
  renderer.render(scene, rig.minimap);
  renderer.setScissorTest(false);
  scene.fog = fog;
  if (atmosphere) atmosphere.visible = true;
  if (lake) lake.visible = true;
}



window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});