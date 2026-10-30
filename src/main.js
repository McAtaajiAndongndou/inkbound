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
import { Campaign } from "./ui/campaign.js";
import { PaintGunModel } from "./paint/paint-gun-model.js";


import { Menu } from "./ui/menu.js";
import { audio } from "./audio/audio-manager.js";
import { preloadEnemyModel } from "./enemies/enemy.js";
import { PLAYER, ANIM, PAINTSTREAK, MISSION_INTRO, PAINT, SHAKE, DEATH_SPLAT } from "./config.js";
import { Paintstreak, zoneSplat } from "./paint/paintstreak.js";
import { HitStop, refillStep } from "./core/feel.js";
import { pointLights } from "./shaders/point-lights.js";
import { FrostPass } from "./shaders/frost/frost-pass.js";

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
// #195 — the point-light pool's fixed lights, in the scene for the whole game:
// the light count never changes, so three.js never recompiles mid-fight.
pointLights.attach(scene);
// #196 — the scene copy frost shells refract. Renders only while one is on screen.
const frostPass = new FrostPass();

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

// #131 paintstreak: new ground and kills fill it; Q spends a FULL gauge on a
// zone at your feet. Edge-triggered here (no input.js action), so holding the
// key cannot auto-fire it the moment the gauge fills again.
const streak = new Paintstreak();
// Polish audit P1-1: kills stop time for a few frames; rendering carries on.
const hitStop = new HitStop();
let streakKeyWasDown = false;
let lastPaintColour = "blue"; // the zone's colour if grey is in hand
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

// The campaign: Primer → Outskirts → the Ascent → Last Colour. A win offers the
// next mission on Enter; Last Colour's win is the campaign's end.
const campaign = new Campaign(LEVELS);

const game = {
  scene,
  // #194: the level's SkyProbe renders the sky's cube map through it.
  renderer,
  loadGLB: (url) => gltfLoader.loadAsync(url),
  onWin: () => {
    run.over = true;
    campaign.recordWin(currentLevelId, run.time);
    const next = campaign.next(currentLevelId);
    hud.showEnd("win", {
      level: currentLevelId,
      stats: { time: run.time, dryTime: run.dryTime },
      next: next && campaign.name(next),
      campaign: campaign.isFinale(currentLevelId) ? campaign.totals() : undefined,
    });
    audio.play("win");
  },
  // #112 — a level asks for a comms line by id at a calm, scripted beat. The
  // bar holds the text and refuses to show it mid-fight.
  say: (id) => comms.say(id),
  // Polish audit P1-2: a level shakes the camera for a heavy event near the
  // player (the crusher's beat, a catwalk falling). `amount` is trauma, 0..1.
  shake: (amount) => rig.addTrauma(amount),

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
    frostPass.dispose();   // #196: the scene copy goes with the level
    scene.remove(player.mesh);
    player.dispose();
  }

  hud.hideEnd();
  run.time = 0;
  run.dryTime = 0;
  run.over = false;
  comms.reset();
  streak.reset();

  level = next;
  // Record the id that ACTUALLY loaded: the registry falls back to the default
  // on an unknown id, and the menu must mark the level the player is really in.
  currentLevelId = levelEntry(id).id;
  menu.setCurrentLevel(currentLevelId);
  scene.add(level.root);

  player = new Player(level.surfaces, level.spawn);
  scene.add(player.mesh);
  // #225: the camera collides with this level's surfaces, and starts on the
  // player rather than sweeping in from wherever the last level left it.
  rig.setColliders(level.surfaces.map((surface) => surface.mesh));
  rig.snap();
  // A level may name what its first frame faces (the Ascent: its lift beacon).
  const facing = level.spawnFacing;
  if (facing) {
    player.yaw = facing.yaw;
    player.pitch = facing.pitch;
  }
  // P0-4 + P1-2: a hit shakes the camera and flinches it up.
  player.onHurt = () => {
    rig.addTrauma(SHAKE.hurt);
    rig.kick(SHAKE.hurtKick);
  };
  hitStop.reset();
  rig.trauma.reset();

  // ENEMY RANGED ATTACKS DO DAMAGE. `Enemy` fires `onAttack` when a windup
  // completes, but nothing ever assigned it — every ranged enemy in the game was
  // a light show, so standing in the open cost nothing (playtest, 28 Oct). The
  // damage number lives on each config (`attackDamage`) beside `contactDamage`.
  for (const enemy of level.enemies) {
    // The attacker's position rides along, for the HUD's damage arc (P0-4).
    enemy.onAttack = (e) => player.takeDamage(e.config.attackDamage ?? 0, e.position);
    enemy.onDeath = (e, cause) => {
      // #129 killfeed: the enemy says what killed it; the HUD words it.
      hud.reportKill(e.type, cause);
      // P1-1: the kill lands. The freeze-shatter crit lands harder.
      hitStop.hit(cause.effect === "shatter" ? "shatter" : "kill");
      // P1-4: death returns colour — a splat of the killing colour, as player
      // paint, so a kill becomes a refill pool. Grey and colourless kills give none.
      if (cause.colour && cause.colour !== "grey") zoneSplat(level.surfaces, e.position, cause.colour, DEATH_SPLAT.radius);
    };
    // Big Arm (#99): a combo step stops time (P1-1); its slam shakes the camera
    // by distance (P1-2), hit or not. Hooks only Big Arm fires.
    enemy.onComboStep = () => hitStop.hit("combo");
    enemy.onSlam = (e, at) => {
      const d = player.position.distanceTo(at ?? e.position);
      rig.addTrauma(SHAKE.slam * Math.max(0, 1 - d / SHAKE.slamRange));
    };
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
    streak.reset(); // #131: a death empties the gauge
    avatar.die();
    // #75 — dry out and death share this one lose path; `reason` picks the
    // wording. `player.dry` is set by simulate() each frame.
    hud.showEnd("lose", { level: currentLevelId, reason: player.dry ? "dry" : "dead" });
    audio.play("lose");
  };

  

  gun = new PaintGun(level.surfaces, currentLevelId, level.enemies, scene);
  // Shots land when the projectile arrives, not when fired, so the hit
  // feedback is driven from the impact rather than from tryFire().
  gun.onImpact = (kind, claimed) => {
    // #113: a splat that takes ground sounds different from repainting your own.
    audio.play(kind === "splat" && claimed ? "claim" : kind);
    if (kind === "kill") streak.onKill();
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
  campaign,
});

// Enter on the win screen: the next mission, or the credits after the finale.
// Not while the menu (or an intro) is up — Enter there belongs to them.
window.addEventListener("keydown", (e) => {
  if (e.code !== "Enter" || e.repeat || menu.open || hud.endShowing !== "win") return;
  const next = campaign.next(currentLevelId);
  if (next) game.loadLevel(next);
  else menu.showCredits();
});

const clock = new THREE.Clock();

// Mission intro (G4). The menu runs the timeline; this moves the camera. The
// END of the move is wherever the rig just put the play camera, so the intro
// lands on it exactly and handover has no cut. Reduced motion: no move, the
// card plays over the play camera.
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const introPos = new THREE.Vector3();
const introTarget = new THREE.Vector3();
const introEnd = new THREE.Vector3();
const introGoal = new THREE.Vector3();

function applyIntroCamera() {
  const from = menu.intro.from;
  if (!from || reducedMotion?.matches) return placeIntroMarker();
  const t = menu.intro.progress;
  const cam = rig.camera;
  // Where the play camera looks: 12 m ahead, the rig's own look distance.
  cam.getWorldDirection(introEnd).multiplyScalar(12).add(cam.position);
  introTarget.fromArray(from.target).lerp(introEnd, t);
  introPos.fromArray(from.pos).lerp(cam.position, t);
  cam.position.copy(introPos);
  cam.lookAt(introTarget);
  placeIntroMarker();
}

/** The objective marker: the goal projected through this frame's camera. */
function placeIntroMarker() {
  const goal = menu.intro.goal;
  if (!goal) return menu.intro.placeMarker(null);
  const cam = rig.camera;
  cam.updateMatrixWorld();
  introGoal.fromArray(goal.point).project(cam);
  const onScreen = introGoal.z < 1 && Math.abs(introGoal.x) < 0.95 && Math.abs(introGoal.y) < 0.95;
  menu.intro.placeMarker(onScreen ? {
    x: (introGoal.x + 1) / 2 * window.innerWidth,
    y: (1 - introGoal.y) / 2 * window.innerHeight,
  } : null);
}

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
  if (gun.colour !== "grey") lastPaintColour = gun.colour;

  // #131 — spend on the press, never on a hold, and only a full gauge.
  const streakKey = input.isDown(PAINTSTREAK.key);
  if (streakKey && !streakKeyWasDown && !player.dead && streak.full) {
    streak.spend({ surfaces: level.surfaces, enemies: level.enemies, centre: player.position, colour: lastPaintColour });
    audio.play("splat");
  }
  streakKeyWasDown = streakKey;

  player.look(mouse.x, mouse.y, PLAYER.lookSensitivity * menu.sensitivity);
  const wasGrounded = player.onGround;
  const fallSpeed = -player.velocity.y;
  player.update(dt, input, actions);
  if (!run.over && !player.dead) {
    run.time += dt;
    if (player.currentColour === "grey") run.dryTime += dt;
  }
  playMovementSounds(wasGrounded, fallSpeed);

  // Refill and dry out (#75, #108). Any frame the feet touch the floor counts,
  // the bounce off red included: before the polish audit (P0-2) red never
  // refilled you, because a bounce never sets `onGround`.
  const touching = !player.dead && (player.onGround || player.touchedGround);
  const onPlayerPaint = touching && level.surfaces.some((surface) => surface.isPlayerPaintAtWorld(player.position));
  refillStep(player, gun, onPlayerPaint, dt);
  // P1-2: a hard landing on red flings you; the camera feels it.
  if (player.bounceImpact >= SHAKE.redBounceFall) rig.addTrauma(SHAKE.redBounce);
 

  const p = player.mesh.position;
  const dx = p.x - lastPos.x;
  const dz = p.z - lastPos.z;
  const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
  lastPos.copy(p);
  viewSpeed = speed;              // #124, for the viewmodel bob
  if (!player.dead) streak.update(dt, { surfaces: level.surfaces, speed });
  if (!player.dead) {
    // #82 + #122: the physics already knows; the avatar is only told. Climbing goes first because it outranks the air states, and setMoving goes last because it defers to both.
    avatar.setClimbing(player.climbing, player.velocity.y);
    avatar.setAirborne(player.onGround, player.velocity.y);
    // #124 — the SAME flag the ADS camera reads in `animate`, so the body and the
    // camera raise the gun together instead of one lagging the other.
    avatar.setAiming(input.aiming);
    avatar.setMoving(speed > 0.5);
    // Polish audit Q1: submerged, the body becomes a blob in the paint's colour
    // (the shaders lane's avatar; optional until it lands).
    avatar.setSubmerged?.(player.submerged, PAINT[player.currentColour]?.hex);
  }
  avatar.update(dt);

  level.update(dt, player);
  // #186 — enemies are solid: push the player out of where they stand NOW,
  // after they have moved and before contact damage is judged.
  player.resolveEnemyBodies(level.enemies);
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

  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05); // clamp so a stall cannot teleport you
  const elapsed = clock.elapsedTime;

  // Always drain input, so keys pressed while paused do not fire on resume.
  const actions = input.consumeActions();
  const mouse = input.consumeMouse();

  // Menu up (title or Escape): the world freezes but keeps rendering behind it,
  // so enemies cannot hurt you while you change settings.
  if (!menu.open) {
    rig.setAiming(input.aiming);
    // P1-1: during a hit-stop the world steps by 0 and keeps rendering.
    simulate(hitStop.step(dt), elapsed, actions, mouse);
  }

  // The intro waits under the pause menu (it checks), like the briefing. It
  // runs on real time, not the clamped step, so a slow machine still gets
  // control inside MISSION_INTRO.cap; the shorter clamp only stops one long
  // frame (the first, compiling shaders) from skipping the start.
  menu.intro.update(Math.min(rawDt, MISSION_INTRO.frameClamp));
  const intro = menu.intro.open;
  document.body.classList.toggle("in-intro", intro);

  rig.update(player,dt);
  if (intro) applyIntroCamera();
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
    streak,
  });

  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  pointLights.update(rig.camera, dt);   // #195: the nearest sources to this camera
  frostPass.render(renderer, scene, rig.camera);   // #196: nothing, unless ice is on screen
  renderer.render(scene, rig.camera);
  if (intro) return; // no minimap under the intro: the HUD is hidden too

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
  // #196: keep the frost scene copy in step (render() also checks every frame).
  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
  frostPass.setSize(buffer.x, buffer.y);
});