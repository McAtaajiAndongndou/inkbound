import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Input } from "./core/input.js";
import { Player } from "./core/player.js";
import { Avatar } from "./shaders/avatar.js";
import { CameraRig } from "./core/camera-rig.js";
import { PaintGun } from "./paint/paint-gun.js";
import { createLevel, levelEntry, LEVELS, DEFAULT_LEVEL_ID } from "./levels/index.js";
import { Hud } from "./ui/hud.js";
import { PaintGunModel } from "./paint/paint-gun-model.js";
import { Menu } from "./ui/menu.js";
import { audio } from "./audio/audio-manager.js";
import { preloadEnemyModel } from "./enemies/enemy.js";
import { PLAYER, PAINT_GUN, DRY_OUT } from "./config.js";

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

const requestedLevel = new URLSearchParams(window.location.search).get("level");
let currentLevelId = requestedLevel ? levelEntry(requestedLevel).id : DEFAULT_LEVEL_ID;

const muzzleVec = new THREE.Vector3();
const handVec = new THREE.Vector3();
let avatar = null;
const lastPos = new THREE.Vector3();
const hud = new Hud(document.getElementById("hud"));
hud.onColourClick((i) => gun && gun.selectColour(i));

window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", () => audio.unlock());

const gltfLoader = new GLTFLoader();

const game = {
  scene,
  loadGLB: (url) => gltfLoader.loadAsync(url),
  onWin: () => {
    hud.showEnd("win");
    audio.play("win");
  },
  levels: LEVELS,
  currentLevelId: () => currentLevelId,
  loadLevel: (id) => {
    currentLevelId = levelEntry(id).id;
    loadLevel();
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

function setPlaceholderVisible(p, visible) {
  if (p.mesh.material) p.mesh.material.visible = visible;
}

function loadLevel() {
  if (gun) {
    gun.dispose();
  }
  if (gunModel) {
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

  level = createLevel(currentLevelId, game);
  level.load();
  scene.add(level.root);

  player = new Player(level.surfaces, level.spawn);
  scene.add(player.mesh);

  setPlaceholderVisible(player, false);

  const thisPlayer = player;
  avatar = new Avatar(
    player.mesh,
    () => {
      if (player === thisPlayer) hidePlaceholder(thisPlayer, avatar);
    },
    () => {
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
  gun.onImpact = (kind) => {
    audio.play(kind);
    if (kind !== "splat") hud.showHitmarker(kind === "kill");
  };
  gunModel = new PaintGunModel(rig.camera, player, avatar);
}

preloadEnemyModel().then(() => {
  loadLevel();
  document.getElementById("loading").remove();
  animate();
});

const menu = new Menu(document.body, {
  audio,
  canvas: renderer.domElement,
  onRestart: loadLevel,
});

const clock = new THREE.Clock();

function simulate(dt, elapsed, actions, mouse) {
  if (actions.restart) {
    loadLevel();
    return;
  }
  if (actions.toggleView) rig.toggle();
  if (actions.colour !== null) gun.selectColour(actions.colour);

  player.look(mouse.x, mouse.y, PLAYER.lookSensitivity * menu.sensitivity);
  player.update(dt, input, actions);

  if (!player.dead && player.onGround) {
    const onPlayerPaint = level.surfaces.some((surface) => surface.isPlayerPaintAtWorld(player.position));

    if (onPlayerPaint) {
      gun.ammo = Math.min(gun.maxAmmo, gun.ammo + PAINT_GUN.refillRate * dt);
    }

    // ---- dry out (#75) ---------------------------------------------------
    // Dry = empty tank AND no paint underfoot. The loss only fires after
    // DRY_OUT.graceTime seconds of continuous dry state, so the player has a
    // beat to notice the ammo bar pulsing and step back onto paint.
    player.dry = gun.ammo <= 0 && !onPlayerPaint;
    if (player.dry) {
      player.dryTimer += dt;
      if (player.dryTimer >= DRY_OUT.graceTime) player.kill();
    } else {
      player.dryTimer = 0;
    }
  } else {
    player.dry = false;
    player.dryTimer = 0;
  }

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
  }

  for (const s of level.surfaces) s.update(elapsed);
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  const actions = input.consumeActions();
  const mouse = input.consumeMouse();

  if (!menu.open) {
    rig.setAiming(input.aiming);
    simulate(dt, elapsed, actions, mouse);
  }

  rig.update(player, dt);
  player.mesh.visible = !rig.firstPerson;

  if (gunModel) {
    gunModel.update(rig.firstPerson, dt);
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

  const size = Math.round(Math.min(w, h) * 0.2);
  const pad = 16;
  const fog = scene.fog;
  const atmosphere = level.atmosphere;
  const waste = level.waste;
  scene.fog = null;
  if (atmosphere) atmosphere.visible = false;
  if (waste) waste.visible = false;
  renderer.setScissorTest(true);
  renderer.setViewport(w - size - pad, h - size - pad, size, size);
  renderer.setScissor(w - size - pad, h - size - pad, size, size);
  renderer.render(scene, rig.minimap);
  renderer.setScissorTest(false);
  scene.fog = fog;
  if (atmosphere) atmosphere.visible = true;
  if (waste) waste.visible = true;
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});