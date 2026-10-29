// OWNER: shaders (Lethabo) — #123
//
// The enemy GLBs have no leg bones, so walk, melee and death are procedural:
// the bob/lean IS the walk cycle, the Charger's commit posture IS the melee
// tell, and a corpse sinks before removal. These tests measure the poses and
// the sink, not configuration — the same discipline as the gait tests that
// came before them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, PAINT_IDS } from '../src/config.js';

/** The frame step most tests use — 60 fps, so a second is sixty calls. */
const DT = 1 / 60;

/** A flat walkable surface. */
function makeFloor() {
  const s = new PaintSurface({ width: 80, height: 80, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

function makeEnemy(config, floor = makeFloor()) {
  return new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config,
    parent: new THREE.Group(),
    floors: [floor],
  });
}

function run(enemy, frames, player, dt = DT) {
  for (let i = 0; i < frames; i++) enemy.update(dt, player);
}

/** The gait needs a model to pose; Node tests have no GLB, so stand in the two fields it writes. */
function withModel(enemy) {
  enemy._model = { position: { y: 0 }, rotation: { x: 0 } };
  enemy._feetOffset = 0;
  return enemy;
}

/** The deepest forward lean observed while the enemy is NOT winding up. */
function maxLeanWhileMoving(enemy, frames, player) {
  let max = -Infinity;
  for (let i = 0; i < frames; i++) {
    enemy.update(DT, player);
    if (!enemy.telegraphing) max = Math.max(max, enemy._model.rotation.x);
  }
  return max;
}

test('a moving Charger commits — its lean is visibly past a walking Sprayer', () => {
  const player = new THREE.Vector3(0, 0, -8);

  const charger = withModel(makeEnemy(ENEMY.charger));
  const chargerLean = maxLeanWhileMoving(charger, 90, player);

  const sprayer = withModel(makeEnemy(ENEMY.sprayer));
  const sprayerLean = maxLeanWhileMoving(sprayer, 90, player);

  assert.ok(chargerLean > 0.3,
    `a charging Charger should pitch hard forward, leaned ${chargerLean.toFixed(3)} rad`);
  assert.ok(sprayerLean < 0.2,
    `a Sprayer stalks nearly upright, leaned ${sprayerLean.toFixed(3)} rad`);
  assert.ok(chargerLean > sprayerLean + 0.15,
    'the two gaits must be distinguishable with the sound off');
});

test('the Charger coils before it springs — a recoil beat, then the commit', () => {
  // The Charger has no attackRange: its melee windup is procedural, a brief
  // backward recoil on the first beat of a charge before the forward pitch.
  const charger = withModel(makeEnemy(ENEMY.charger));
  const player = new THREE.Vector3(0, 0, -8);

  let minLean = Infinity;
  let maxLean = -Infinity;
  for (let i = 0; i < 90; i++) {
    charger.update(DT, player);
    minLean = Math.min(minLean, charger._model.rotation.x);
    maxLean = Math.max(maxLean, charger._model.rotation.x);
  }

  assert.ok(minLean < -0.05,
    `the coil should lean the body backward first, min was ${minLean.toFixed(3)}`);
  assert.ok(maxLean > 0.3,
    `then the charge commits forward, max was ${maxLean.toFixed(3)}`);
});

test('a killed enemy sinks, keeps its kill colour, and is removed after the sink', () => {
  const enemy = makeEnemy(ENEMY.sprayer);
  const parent = enemy.mesh.parent;
  assert.ok(parent, 'attached to the level');

  enemy.takeColourHit(PAINT_IDS.red, 1000);   // a killing hit, and a red one
  assert.equal(enemy.alive, false);

  const y = enemy.position.y;
  run(enemy, 10);
  assert.ok(enemy.position.y < y - 0.05, 'the corpse is sinking');
  assert.ok(enemy.mesh.parent, 'still in the scene mid-sink');
  assert.ok(enemy.bodyMat.uniforms.uColour.value.r > 0.5,
    'the killing tint is not lost on the way down');

  run(enemy, 30);
  assert.equal(enemy.mesh.parent, null, 'removed once the sink has run');
});

test('the sink covers the same ground at any frame rate', () => {
  // Same simulated moment, two different step sizes: 13 frames at 60 fps and
  // 26 frames at 120 fps are both 0.2167 s into the sink. The depth must agree
  // or the motion is frame-rate dependent.
  const a = makeEnemy(ENEMY.sprayer);
  const b = makeEnemy(ENEMY.sprayer);
  a.takeColourHit(PAINT_IDS.red, 1000);
  b.takeColourHit(PAINT_IDS.red, 1000);

  run(a, 13, null, 1 / 60);
  run(b, 26, null, 1 / 120);

  assert.ok(Math.abs(a.position.y - b.position.y) < 1e-6,
    `same time, different frame rates: ${a.position.y.toFixed(4)} vs ${b.position.y.toFixed(4)}`);

  // And both dispose after the same simulated duration.
  run(a, 20, null, 1 / 60);    // 33 frames total at 60 fps = 0.55 s
  run(b, 40, null, 1 / 120);   // 66 frames total at 120 fps = 0.55 s
  assert.equal(a.mesh.parent, null);
  assert.equal(b.mesh.parent, null);
});

test('the death applies to every config — turret and wall-crawler sink too', () => {
  for (const config of [ENEMY.turret, ENEMY.wallCrawler, ENEMY.charger, ENEMY.drainer]) {
    const enemy = makeEnemy(config);
    enemy.takeDamage(enemy.hp);
    run(enemy, 40);
    assert.equal(enemy.mesh.parent, null,
      `${Object.keys(ENEMY).find((k) => ENEMY[k] === config)} must sink and be removed`);
  }
});
