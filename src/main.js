import * as THREE from "three";
import { Input } from "./core/input.js";
import { Player } from "./core/player.js";
import { Avatar } from "./shaders/avatar.js";
import { CameraRig } from "./core/camera-rig.js";
import { PaintGun } from "./paint/paint-gun.js";
import { Level01 } from "./levels/level-01-mission.js";
import { Hud } from "./ui/hud.js";
import { Menu } from "./ui/menu.js";
import { audio } from "./audio/audio-manager.js";

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
let avatar = null;
const lastPos = new THREE.Vector3();
const hud = new Hud(document.getElementById("hud"));
hud.onColourClick((i) => gun && gun.selectColour(i));
new Menu(document.body, audio);

window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", () => audio.unlock());

const game = {
  scene,
  onWin: () => {
    hud.showEnd("win");
    audio.play("win");
  },
};

const rig = new CameraRig(window.innerWidth / window.innerHeight);
const input = new Input(renderer.domElement);

function hidePlaceholder(p, a) {
  if (p.mesh.material) p.mesh.material.visible = false;
  for (const child of p.mesh.children) {
    if (child !== a.root) child.visible = false;
  }
}

function loadLevel() {
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

  const thisPlayer = player;
  avatar = new Avatar(player.mesh, () => {
    if (player === thisPlayer) hidePlaceholder(thisPlayer, avatar);
  });
  lastPos.copy(player.mesh.position);

  player.onDeath = () => {
    avatar.die();
    hud.showEnd("lose");
    audio.play("lose");
  };

  gun = new PaintGun(level.surfaces, 1, level.enemies);
}

loadLevel();
document.getElementById("loading").remove();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const actions = input.consumeActions();

  if (actions.restart) loadLevel();
  if (actions.toggleView) rig.toggle();
  if (actions.colour !== null) gun.selectColour(actions.colour);
  if (actions.refill) gun.refillAmmo();

  const mouse = input.consumeMouse();
  player.look(mouse.x, mouse.y);
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
  if (input.firing && input.locked && !player.dead && gun.tryFire(rig.camera)) {
    audio.play("fire");
    if (gun.lastShot === "splat") {
      audio.play("splat");
    } else {
      audio.play(gun.lastShot);
      hud.showHitmarker(gun.lastShot === "kill");
    }
  }

  for (const s of level.surfaces) s.update(elapsed);

  rig.update(player);
  player.mesh.visible = !rig.firstPerson;

  hud.update(dt, {
    gun,
    player,
    surfaces: level.surfaces,
    locked: input.locked,
  });

  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, rig.camera);

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