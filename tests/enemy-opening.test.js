import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Player } from '../src/core/player.js';
import { ENEMY, HEALTH, PAINT_GUN, PAINT_IDS } from '../src/config.js';

// #76 — the Charger's recovery window.
//
// ENEMIES.md asks every attack for three beats: tell -> threat -> OPENING. The
// Charger had the first two and not the third: it wound up, charged, and was
// immediately back on you, so the fight read as "sidestep or take 25" — a
// reaction test rather than a skill. This file pins the third beat, on the real
// level, through the real `_tick` — not on a flag.

const DT = 1 / 60;

async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  return level;
}

/**
 * Island B — the Charger's arena, and the only floor long enough to charge on.
 * z spans about -7 .. 4.5, so it is also the only place where "ended by an 8 m
 * run" and "ended by the lip" can be told apart.
 */
function arena(level) {
  // By TYPE, not by index: island B fields two Chargers now, so the second
  // spawn is a Charger and `enemies[1]` would hand the Sprayer tests a melee
  // enemy that never fires.
  const charger = level.enemies.find((e) => e.type === 'charger');
  const sprayer = level.enemies.find((e) => e.type === 'sprayer');
  // Island B's arena sleeps until the player lands in it (#012); these tests
  // place the player there by hand, so wake it the way landing would.
  charger.wake();
  sprayer.wake();
  const floor = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  return {
    charger,
    sprayer,
    y: floor.mesh.position.y,
    zMid: floor.mesh.position.z,
    zMax: floor.mesh.position.z + floor.height / 2,
    zMin: floor.mesh.position.z - floor.height / 2,
  };
}

/** Step until the window opens. Returns the frame count, or -1 if it never does. */
function stepUntilOpen(enemy, target, maxFrames = 400) {
  for (let i = 1; i <= maxFrames; i++) {
    enemy.update(DT, target);
    if (enemy.recovering) return i;
  }
  return -1;
}

/** Step through an open window, counting its length in frames. */
function countWindow(enemy, target) {
  let frames = 0;
  while (enemy.recovering && frames < 600) {
    enemy.update(DT, target);
    frames += 1;
  }
  return frames;
}

test('the window is 1.2 s, and it belongs to the Charger alone (#76)', () => {
  assert.ok(Math.abs(ENEMY.charger.recovery - 1.2) < 1e-9,
    `the spec says 1.2 s, config says ${ENEMY.charger.recovery}`);

  // "Do not touch any other enemy" is part of the issue. A default recovery on
  // every config would quietly freeze the sprayer and the turret mid-fight.
  for (const [name, config] of Object.entries(ENEMY)) {
    if (name === 'charger') continue;
    assert.equal(config.recovery, undefined,
      `${name} must not inherit the recovery state`);
  }
});

test('arriving on the player ends the charge and opens the window (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMid } = arena(level);

  // 2 m apart. The Charger holds at stopDistance (1.2 m) — #39's melee stop —
  // and that arrival is the beat the player actually experiences.
  charger.position.set(0, y, zMid + 2);
  const player = new THREE.Vector3(0, y, zMid);

  const frames = stepUntilOpen(charger, player);
  assert.ok(frames > 0, 'the Charger arrived and never opened a window');

  // It stands EXACTLY still for the whole window, even with the player somewhere
  // else — a recovering charger that re-aims is still "back on you".
  const planted = charger.position.clone();
  const decoy = new THREE.Vector3(5, y, zMid - 3);

  let still = 0;
  while (charger.recovering && still < 600) {
    charger.update(DT, decoy);
    still += 1;
    assert.ok(charger.position.distanceTo(planted) < 1e-9,
      'the Charger moved inside the opening');
    assert.equal(charger._vel.lengthSq(), 0, 'the Charger kept velocity inside the opening');
  }

  assert.ok(Math.abs(still * DT - ENEMY.charger.recovery) <= 2 * DT,
    `the window lasted ${(still * DT).toFixed(3)} s, not ${ENEMY.charger.recovery} s`);

  // ...and then it is a normal enemy again. A state that never lets go would be
  // a free kill, not an opening.
  const resumed = charger.position.clone();
  for (let i = 0; i < 10; i++) charger.update(DT, decoy);
  assert.ok(charger.position.distanceTo(resumed) > 0.1,
    'the Charger should chase again once the window closes');
});

test('hitting a wall or a ledge ends the charge and opens the same window (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMax } = arena(level);

  // Parked just short of island B's front lip, aimed at a player standing
  // across Gap 1: the step past the lip is refused, which is the wall impact.
  charger.position.set(0, y, zMax - 0.6);
  const player = new THREE.Vector3(0, y, zMax + 9);

  const frames = stepUntilOpen(charger, player);
  assert.ok(frames > 0, 'a refused step against the lip must buy the opening');

  const planted = charger.position.clone();
  for (let i = 0; i < 60; i++) charger.update(DT, player);
  assert.ok(charger.position.distanceTo(planted) < 1e-6,
    'a charger that is winded against a wall must not keep shoving at it');
});

test('a long chase ends by distance, on open floor — not only at the lip (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMax, zMin } = arena(level);

  charger.position.set(0, y, zMax - 0.5);
  // The player is at the far end, 10.5 m away: further than the 8 m budget, so
  // nothing but the budget can stop the charge — but still inside #109's 16 m
  // detection radius, because an enemy that has never seen you does not chase.
  // In front of the lip, not past it: B's back wall stands on the lip (#012)
  // and an enemy cannot see through it.
  const player = new THREE.Vector3(0, y, zMin + 0.5);

  const frames = stepUntilOpen(charger, player);
  assert.ok(frames > 0, `no window after ${frames} frames of chasing`);
  assert.ok(charger.position.z > zMin + 0.5,
    `the window should open on open floor, not at the lip (z=${charger.position.z})`);
});

test('the window is wide enough for the combo it is there to enable (#76)', () => {
  // The fight is "bait -> dodge -> punish", and the punish is a 3-shot combo.
  // Below this the window is decoration: the player cannot fire three times.
  const combo = 3 * PAINT_GUN.fireDelay;
  assert.ok(ENEMY.charger.recovery > combo,
    `a 3-shot combo takes ${combo.toFixed(2)} s, the window is ${ENEMY.charger.recovery} s`);
});

test('a recovering Charger takes full damage and dies to a combo (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMid } = arena(level);

  charger.position.set(0, y, zMid + 2);
  const player = new THREE.Vector3(0, y, zMid);
  assert.ok(stepUntilOpen(charger, player) > 0);

  const hp = charger.hp;
  assert.equal(charger.takeColourHit(PAINT_IDS.blue, 10), true);
  assert.equal(charger.hp, hp - 10, 'the opening must not halve incoming damage');

  // Its whole 30 hp, three shots, no cooldown dance.
  charger.takeColourHit(PAINT_IDS.blue, 10);
  charger.takeColourHit(PAINT_IDS.blue, 10);
  assert.equal(charger.alive, false, 'three 10-damage hits should kill it inside the window');
});

test('a recovering Charger does not re-alert (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMid } = arena(level);

  charger.position.set(0, y, zMid + 2);
  const player = new THREE.Vector3(0, y, zMid);
  assert.ok(stepUntilOpen(charger, player) > 0);

  assert.equal(charger.startTelegraph(), false,
    'a windup must not start inside the opening');

  while (charger.recovering) {
    charger.update(DT, player);
    assert.equal(charger.telegraphing, false, 'it re-alerted inside the opening');
  }

  // Proof the refusal above came from the window, not from something else.
  assert.equal(charger.startTelegraph(), true, 'with the window closed it may wind up again');
});

test('contact damage inside the window is the existing rule, untouched (#76)', async () => {
  const level = await buildLevel();
  const { charger, y, zMid } = arena(level);

  charger.position.set(0, y, zMid + 2);
  const target = new THREE.Vector3(0, y, zMid);
  assert.ok(stepUntilOpen(charger, target) > 0);

  // Standing against a winded Charger still costs what it always cost: the
  // issue is explicit that recovery must not become a free pass.
  const player = new Player([]);
  player.position.set(charger.position.x, charger.position.y, charger.position.z + 0.4);
  player.checkEnemyContact([charger]);

  assert.equal(player.health, HEALTH.max - ENEMY.charger.contactDamage);
});

test('the other enemies never enter the state (#76)', async () => {
  const level = await buildLevel();
  const { sprayer, y, zMid } = arena(level);

  // Drive a sprayer for a full attack cycle: it moves, winds up, fires.
  for (let i = 0; i < 180; i++) sprayer.update(DT, new THREE.Vector3(0, y, zMid));

  assert.equal(sprayer.recovering, false, 'only the Charger may be winded');
});

// --- #118 — the Sprayer's reload ---------------------------------------------
//
// The Sprayer had the first two beats of an attack and not the third, exactly
// as the Charger did before #76: it aimed, fired, and was straight back to
// aiming. docs/enemies/algorithms.md specifies the missing beat — AIM 0.6 s ->
// FIRE a burst of 3 -> RELOAD 1.2 s — and the reload is the window that makes
// the enemy punishable rather than merely survivable. It is also the enemy that
// eats your territory, so the window is the moment you can step onto grey and
// repaint it.

/** The deck Sprayer, moved onto island B's floor where the fight happens. */
function placedSprayer(level) {
  const { y, zMid } = arena(level);
  const sprayer = level.enemies.find((e) => e.type === 'sprayer');
  sprayer.wake();
  // 2 m out: inside the 12 m attack range, outside `stopDistance`, which is
  // where a Sprayer actually gets to shoot from.
  sprayer.position.set(0, y, zMid + 2);
  return { sprayer, target: new THREE.Vector3(0, y, zMid) };
}

/** Count landed shots, timed on the enemy's own clock (seconds of DT). */
function shotClock(enemy) {
  const shots = [];
  let t = 0;
  enemy.onAttack = () => shots.push(t);
  return {
    shots,
    run(frames, target) {
      for (let i = 0; i < frames; i++) {
        enemy.update(DT, target);
        t += DT;
      }
    },
  };
}

/** Step until the reload opens. Returns the frame count, or -1 if it never does. */
function stepUntilReload(sprayer, clock, target, maxFrames = 400) {
  for (let i = 1; i <= maxFrames; i++) {
    clock.run(1, target);
    if (sprayer.reloading) return i;
  }
  return -1;
}

test('the burst and the reload belong to the Sprayer alone (#118)', () => {
  assert.equal(ENEMY.sprayer.burst, 3, 'algorithms.md: a burst of 3');
  assert.ok(Math.abs(ENEMY.sprayer.reload - 1.2) < 1e-9,
    `the spec says a 1.2 s reload, config says ${ENEMY.sprayer.reload}`);

  // The same rule #76 had to keep: a default on every config would stop the
  // Charger and the turret mid-fight for a beat they never asked for.
  for (const [name, config] of Object.entries(ENEMY)) {
    if (name === 'sprayer') continue;
    assert.equal(config.reload, undefined, `${name} must not inherit a reload`);
    assert.equal(config.burst, undefined, `${name} must not inherit a burst`);
  }
});

test('a burst of 3, then a 1.2 s window with no shot (#118)', async () => {
  const level = await buildLevel();
  const { sprayer, target } = placedSprayer(level);
  const clock = shotClock(sprayer);

  // 4 s at 60 Hz is two full cycles: aim, burst, reload, aim, burst.
  clock.run(240, target);
  const shots = clock.shots;
  assert.ok(shots.length >= 6, `only ${shots.length} shots in 4 s — the burst never repeated`);

  // The tell still comes first: a burst does not shortcut the 0.6 s aim.
  assert.ok(shots[0] >= ENEMY.sprayer.windup - 2 * DT,
    `the first shot landed at ${shots[0].toFixed(3)} s, before the aim finished`);

  // A burst, not a trickle: 3 shots a frame or two apart...
  for (const i of [0, 1]) {
    assert.ok(shots[i + 1] - shots[i] < 0.2,
      `shots ${i + 1} and ${i + 2} are ${(shots[i + 1] - shots[i]).toFixed(2)} s apart, not one burst`);
  }

  // ...and then the gun is empty. The gap after the third shot is the reload
  // plus the next aim, and it can never be shorter than the window itself.
  const window = shots[3] - shots[2];
  assert.ok(window >= ENEMY.sprayer.reload,
    `the gap after the burst was ${window.toFixed(2)} s, shorter than the ${ENEMY.sprayer.reload} s reload`);
  // The reload REPLACES the 2.5 s `attackCooldown`: both would stack into a
  // second wait with no tell on it, which is the thing the issue forbids.
  assert.ok(window < ENEMY.sprayer.reload + ENEMY.sprayer.windup + 0.15,
    `the gap after the burst was ${window.toFixed(2)} s — at least two waits, not one opening`);

  // The second burst is still a burst: the whole cycle repeats, it does not
  // degrade into single shots after one reload.
  assert.ok(shots[4] - shots[3] < 0.2 && shots[5] - shots[4] < 0.2,
    'the second burst was not a burst');
});

test('inside the reload it plants, stays silent and cannot start anything (#118)', async () => {
  const level = await buildLevel();
  const { sprayer, target } = placedSprayer(level);
  const clock = shotClock(sprayer);

  assert.ok(stepUntilReload(sprayer, clock, target) > 0, 'the burst never opened a reload');
  // Shots are pellets now (#185): `onAttack` counts the ones that LAND, and the
  // burst's last pellet is still in the air on the frame the reload begins.
  assert.ok(clock.shots.length >= 2, `only ${clock.shots.length} shots had landed`);
  assert.equal(sprayer.startTelegraph(), false,
    'a reloading Sprayer must not start a windup');

  // For the whole window it is rooted and silent — standing right in front of
  // it is the punish, so it must not creep through its own opening.
  const planted = sprayer.position.clone();
  let held = 0;
  while (sprayer.reloading && held < 300) {
    clock.run(1, target);
    held += 1;
    assert.ok(clock.shots.length <= 3, 'it fired inside its own reload');
    assert.ok(sprayer.position.distanceTo(planted) < 1e-9,
      'a reloading Sprayer must plant, not walk through the opening');
  }
  assert.equal(clock.shots.length, 3, `the burst landed ${clock.shots.length} shots, not 3`);

  assert.ok(Math.abs(held * DT - ENEMY.sprayer.reload) <= 2 * DT,
    `the window lasted ${(held * DT).toFixed(3)} s, not ${ENEMY.sprayer.reload} s`);
});

test('losing sight mid-reload does not reset the window (#118)', async () => {
  const level = await buildLevel();
  const { sprayer, target } = placedSprayer(level);
  const clock = shotClock(sprayer);

  assert.ok(stepUntilReload(sprayer, clock, target) > 0);

  // The player vanishes mid-window: nothing to see, nothing to aim at. The gun
  // is still empty — a reload that restarts when you break line of sight would
  // let an enemy that cannot see you hold its opening forever.
  const gone = new THREE.Vector3(0, target.y, target.z - 200);
  clock.run(1, gone);
  assert.notEqual(sprayer.awareness, 'alert', 'the decoy must actually be out of sight');

  let held = 0;
  while (sprayer.reloading && held < 300) {
    clock.run(1, gone);
    held += 1;
  }
  assert.ok(Math.abs(held * DT - (ENEMY.sprayer.reload - DT)) <= 2 * DT,
    `the window ran ${(held * DT).toFixed(2)} s after the player left — it did not keep counting`);
});

test('a pinned Sprayer still fires — pinning is control, not safety (#118)', async () => {
  const level = await buildLevel();
  const { sprayer, target } = placedSprayer(level);
  const clock = shotClock(sprayer);

  assert.equal(sprayer.takeColourHit(PAINT_IDS.green, 0), true);
  const rooted = sprayer.position.clone();

  // 1 s of green: the pin holds, and the aim + the burst happen inside it.
  clock.run(60, target);
  assert.equal(clock.shots.length, 3,
    `a pinned Sprayer fired ${clock.shots.length} of its 3 shots`);
  assert.ok(sprayer._pinnedTimer > 0, 'the pin must still be running while it fires');
  assert.ok(sprayer.position.distanceTo(rooted) < 1e-9, 'the pin must still root it');
});

test('the reload is a tell: the body eases back off its aim (#118)', async () => {
  const level = await buildLevel();
  const { sprayer, target } = placedSprayer(level);
  const clock = shotClock(sprayer);

  // No GLB loader in Node, so the gait runs on a stand-in, as the #123 and #80
  // posture tests do.
  sprayer._model = { position: { y: 0 }, rotation: { x: 0 } };
  sprayer._feetOffset = 0;

  assert.ok(stepUntilReload(sprayer, clock, target) > 0);
  clock.run(1, target);

  const lean = sprayer._model.rotation.x;
  assert.ok(lean <= -0.1,
    `the reload posture leans ${lean.toFixed(2)} rad — it must read as gun-down, not upright`);

  // ...and it is the RELOAD's posture, not a permanent one: with the window
  // closed the body is upright or leaning forward again.
  while (sprayer.reloading) clock.run(1, target);
  clock.run(1, target);
  assert.ok(sprayer._model.rotation.x > lean,
    'the body never came back off the reload posture');
});

test('the window is wide enough for the splat it exists to allow (#118)', () => {
  // The design note, verbatim: if the window is shorter than the time it takes
  // to paint one splat and get back to cover, the Drainer and the Sprayer
  // together become a death spiral.
  assert.ok(ENEMY.sprayer.reload > PAINT_GUN.fireDelay,
    `one splat takes ${PAINT_GUN.fireDelay} s, the window is ${ENEMY.sprayer.reload} s`);
});
