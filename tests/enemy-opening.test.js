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
  const [charger, sprayer] = level.enemies;
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
  // The player is out past the far lip, so nothing but the budget can stop it.
  const player = new THREE.Vector3(0, y, zMin - 30);

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
