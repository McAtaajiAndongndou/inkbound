import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Input } from "./core/input.js";
import { Player } from "./core/player.js";
import { Avatar } from "./shaders/avatar.js";
import { CameraRig } from "./core/camera-rig.js";
import { PaintGun } from "./paint/paint-gun.js";
import { createLevel, levelEntry, LEVELS, DEFAULT_LEVEL_ID } from "./levels/index.js";
import { Hud } from "./ui/hud.js";
import { CommsBar } from "./ui/comms.js";
import { PaintGunModel } from "./paint/paint-gun-model.js";


import { Menu } from "./ui/menu.js";
import { audio } from "./audio/audio-manager.js";
import { preloadEnemyModel } from "./enemies/enemy.js";
import { PLAYER, PAINT_GUN, ANIM, DRY_OUT, SUBMERGE } from "./config.js";

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

// WHICH LEVEL. `?level=ascent` is the dev/QA selector until the pause-menu list
// lands (issue 006, ui). The ids live in `levels/index.js` — this file must never
// hold a second list, or adding a level works here and is missing in the menu.
const requestedLevel = new URLSearchParams(window.location.search).get("level");
let currentLevelId = requestedLevel ? levelEntry(requestedLevel).id : DEFAULT_LEVEL_ID;

const muzzleVec = new THREE.Vector3();
const handVec = new THREE.Vector3();
let avatar = null;
const lastPos = new THREE.Vector3();

// #124 viewmodel bob. It lives in this file rather than in
// `paint/paint-gun-model.js` because #124's file list is avatar.js / main.js /
// config.js — and the gun's own `update()` has just laid the model out at its
// rest position, so adding the sway AFTER it is all the hook this needs.
//   viewSpeed  the player's horizontal speed, refreshed by `simulate`
//   viewPhase  the sway's phase, so the gun stays in step with the walking
let viewSpeed = 0;
let viewPhase = 0;

/**
 * Sway the first-person gun while the player walks (#124). No-op in third person
 * and while standing, so the gun never drifts between frames on its own.
 */
function applyViewBob(dt) {
  const viewmodel = gunModel?.firstPersonGun;
  if (!viewmodel || !viewmodel.visible) return;

  // Ramp with speed rather than switch on at a threshold, so a slow walk sways
  // gently instead of the gun starting to swing the instant the player moves.
  const stride = Math.min(1, viewSpeed / 3);
  if (stride > 0.02) viewPhase += dt * ANIM.viewBobSpeed;
  viewmodel.position.x += Math.sin(viewPhase) * ANIM.viewBob * stride;
}

const hud = new Hud(document.getElementById("hud"));
hud.onColourClick((i) => gun && gun.selectColour(i));
// #112 — the sergeant's one line per level. Levels ask through `game.say`.
const comms = new CommsBar(document.getElementById("hud"));

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

// Scorecard (#110): how long the run took and how much of it was spent on
// grey. Both only count while the run is live — alive, not yet won, menu
// closed (simulate() does not run behind the menu) — and reset on restart.
const run = { time: 0, dryTime: 0, over: false };

const game = {
  scene,
  loadGLB: (url) => gltfLoader.loadAsync(url),
  onWin: () => {
    run.over = true;
    hud.showEnd("win", { stats: { time: run.time, dryTime: run.dryTime } });
    audio.play("win");
  },
  // #112 — a level asks for a comms line by id at a calm, scripted beat. The
  // bar holds the text and refuses to show it mid-fight.
  say: (id) => comms.say(id),

  // --- level switching (issue 006 is the menu that calls this) --------------
  // The menu needs three things and no more: the list to render, which one is
  // current, and the ability to load another. Keeping the list HERE rather than
  // in the menu is what stops the two drifting apart.
  levels: LEVELS,
  currentLevelId: () => currentLevelId,
  loadLevel: (id) => {
    currentLevelId = levelEntry(id).id;
    loadLevel().catch(reportLoadError);
  },
};

// Level select (#78). The id -> level mapping is `levels/index.js`, the ONE
// list (INTEGRATION.md) — this file holds no second copy of it. An unknown id
// falls back to the default inside the registry; it never throws here.
/**
 * Build and load a level WITHOUT touching the one being played, so a load that
 * throws leaves the current level running and the menu usable (#78).
 */
async function buildLevel(id) {
  const next = createLevel(id, game);
  try {
    await next.load();
  } catch (err) {
    next.dispose();
    throw err;
  }
  return next;
}

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

/** Swap in level `id` (default: reload the current one). Rejects if it fails. */
async function loadLevel(id = currentLevelId) {
  const next = await buildLevel(id);

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
  run.time = 0;
  run.dryTime = 0;
  run.over = false;
  comms.reset();

  level = next;
  // Record the id that ACTUALLY loaded: the registry falls back to the default
  // on an unknown id, and the menu must mark the level the player is really in.
  currentLevelId = levelEntry(id).id;
  menu.setCurrentLevel(currentLevelId);
  scene.add(level.root);

  player = new Player(level.surfaces, level.spawn);
  scene.add(player.mesh);

  // ENEMY RANGED ATTACKS DO DAMAGE. `Enemy` fires `onAttack` when a windup
  // completes, but nothing ever assigned it — every ranged enemy in the game was
  // a light show, so standing in the open cost nothing (playtest, 28 Oct). The
  // damage number lives on each config (`attackDamage`) beside `contactDamage`.
  for (const enemy of level.enemies) {
    enemy.onAttack = (e) => player.takeDamage(e.config.attackDamage ?? 0);
  }

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
    run.over = true;
    avatar.die();
    // #75 — dry out and death share this one lose path; `reason` picks the
    // wording. `player.dry` is set by simulate() each frame.
    hud.showEnd("lose", { level: currentLevelId, reason: player.dry ? "dry" : "dead" });
    audio.play("lose");
  };

  

  gun = new PaintGun(level.surfaces, 1, level.enemies, scene);
  // Shots land when the projectile arrives, not when fired, so the hit
  // feedback is driven from the impact rather than from tryFire().
  gun.onImpact = (kind, claimed) => {
    // #113: a splat that takes ground sounds different from repainting your own.
    audio.play(kind === "splat" && claimed ? "claim" : kind);
    if (kind !== "splat") hud.showHitmarker(kind === "kill");
  };
  gunModel = new PaintGunModel(rig.camera, player, avatar);
}

const reportLoadError = (err) => console.error("[main] level failed to load", err);

preloadEnemyModel().then(async () => {
  await loadLevel();
  document.getElementById("loading").remove();
  animate();
});

// Title + pause menu. Open whenever the pointer is unlocked (load, Escape).
// The level list comes from the registry through `game` (INTEGRATION.md: the
// ONE list — the menu must not carry its own copy).
const menu = new Menu(document.body, {
  audio,
  canvas: renderer.domElement,
  onRestart: () => loadLevel().catch(reportLoadError),
  onSelectLevel: (id) => loadLevel(id),
  levels: game.levels,
  currentLevel: currentLevelId,
});

const clock = new THREE.Clock();

// #113 jump and land, read off the player's own state rather than hooked into
// player.js (core lane). A jump is the vertical speed snapping up to at least
// jumpSpeed in one step — ground, coyote, wall hop and a red bounce all count.
// A land needs a real fall, so walking down a step stays quiet.
const LAND_MIN_FALL = 4; // m/s

function playMovementSounds(wasGrounded, fallSpeed) {
  if (player.dead) return;
  const vy = player.velocity.y;
  // 0.6, not lower: a climb rises at climbSpeed (4.5) and the hop off it is a jump too.
  if (vy >= PLAYER.jumpSpeed * 0.95 && -fallSpeed < PLAYER.jumpSpeed * 0.6) audio.play("jump");
  else if (!wasGrounded && player.onGround && fallSpeed >= LAND_MIN_FALL) audio.play("land");
}

/** One step of gameplay. Skipped entirely while the menu is open. */
function simulate(dt, elapsed, actions, mouse) {
  if (actions.restart){
    loadLevel().catch(reportLoadError);
    return;
  }
  if (actions.toggleView) rig.toggle();
  if (actions.colour !== null) gun.selectColour(actions.colour);

  player.look(mouse.x, mouse.y, PLAYER.lookSensitivity * menu.sensitivity);
  const wasGrounded = player.onGround;
  const fallSpeed = -player.velocity.y;
  player.update(dt, input, actions);
  if (!run.over && !player.dead) {
    run.time += dt;
    if (player.currentColour === "grey") run.dryTime += dt;
  }
  playMovementSounds(wasGrounded, fallSpeed);

   if (!player.dead && player.onGround) {
    const onPlayerPaint = level.surfaces.some((surface) => surface.isPlayerPaintAtWorld(player.position));

    if (onPlayerPaint) {
      // #108 — submerged refills 3× faster. That is the "commit" half of the
      // trade: you cannot fire, but you come back up with a full tank.
      const refillMult = player.submerged ? SUBMERGE.refillMultiplier : 1;
      gun.ammo = Math.min(gun.maxAmmo, gun.ammo + PAINT_GUN.refillRate * refillMult * dt);
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
  viewSpeed = speed;              // #124, for the viewmodel bob
  if (!player.dead) {
    // #82 + #122: the physics already knows; the avatar is only told. Climbing goes first because it outranks the air states, and setMoving goes last because it defers to both.
    avatar.setClimbing(player.climbing, player.velocity.y);
    avatar.setAirborne(player.onGround, player.velocity.y);
    // #124 — the SAME flag the ADS camera reads in `animate`, so the body and the
    // camera raise the gun together instead of one lagging the other.
    avatar.setAiming(input.aiming);
    avatar.setMoving(speed > 0.5);
  }
  avatar.update(dt);

  level.update(dt, player);
  // #124 — `checkEnemyContact` reports a hit by moving health rather than by
  // returning one, and the player's own hurt cooldown already de-dupes, so the
  // difference is exactly one flinch per hit.
  const healthBefore = player.health;
  player.checkEnemyContact(level.enemies);
  if (player.health < healthBefore) avatar.hit();

  // #112 — "in combat" for the comms bar: just hit, or any live enemy alerted
  // or still searching (#109). The bar waits out a fight rather than talk over it.
  let inCombat = player.hurtTimer > 0;
  for (let i = 0; !inCombat && i < level.enemies.length; i++) {
    const enemy = level.enemies[i];
    inCombat = enemy.alive && enemy.awareness !== "dormant";
  }
  comms.update(dt, inCombat);

  gun.update(dt);
  if (input.firing && input.locked && !player.dead && !player.submerged && gun.tryFire(rig.camera, gunModel?.getMuzzleWorldPosition(muzzleVec, rig.firstPerson), input.aiming)) {
    gunModel?.kick();
    audio.play("fire");
    avatar.fire();                // #124 — the shot accent, after the shot lands
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
    // #124 — after the gun's own update, which is what lays it out at rest.
    applyViewBob(dt);
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