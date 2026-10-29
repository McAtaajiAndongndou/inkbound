import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, PAINT, PAINT_IDS, SURFACE } from '../src/config.js';

/**
 * #107 — enemies paint grey.
 *
 * ADR-0002 makes grey a faction colour, so an enemy taking ground is the paint
 * gun's operation run in reverse. Issue #80 does that for the Drainer at melee
 * range, continuously; this is the same conversion from a DISTANCE, where it
 * lands.
 *
 * What these tests fix in place, in the issue's own words:
 *   - a Sprayer shot greys a ~1.5 m radius AT THE IMPACT
 *   - conversion never passes through a wall or a floor
 *   - the player can repaint converted ground immediately
 *   - only the Sprayer does it at range — the Turret's fire deliberately does not
 *   - enemy grey is the same grey as dead ground, with no tint of its own
 *
 * No browser and no GLB: the enemy falls back to its box, and the raycast runs
 * against real PaintSurface meshes, which is the whole machinery under test.
 */

const FRAME = 1 / 60;
const WINDUP_FRAMES = Math.ceil((ENEMY.sprayer.windup / FRAME) + 2); // 0.6 s + slack

/** Flat ground on the XZ plane at y = `y`, one metre of paint per grid square. */
function makeSurface({ width = 40, height = 40, cells = 4, y = 0, unpaintable = false } = {}) {
  const s = new PaintSurface({ width, height, cells, unpaintable });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.y = y;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

/** An upright surface standing on the floor at z = `z`, spanning y 0..`height`.
 *
 *  FACING -Z, which is the side a shooter standing at negative z is on. Every
 *  surface in this game is a one-sided plane (ShaderMaterial, FrontSide) and the
 *  raycast honours that — so a wall only exists from the side its normal points
 *  at. That is not a limitation of this feature: the player's gun reads the same
 *  faces, on purpose, which is what "shares the machinery" means.
 */
function makeWall({ z = 0, width = 20, height = 4, cells = 4, unpaintable = false } = {}) {
  const s = new PaintSurface({ width, height, cells, unpaintable });
  s.mesh.rotation.y = Math.PI;            // face -Z: toward the shooter
  s.mesh.position.set(0, height / 2, z);
  s.mesh.updateMatrixWorld(true);
  return s;
}

function spawn(config, at, { floors, surfaces }) {
  return new Enemy({
    position: new THREE.Vector3(at[0], at[1] ?? 0, at[2]),
    config,
    parent: new THREE.Group(),
    floors: floors ?? surfaces,
    surfaces,
  });
}

function run(enemy, playerPos, frames) {
  for (let i = 0; i < frames; i++) enemy.update(FRAME, playerPos);
}

/**
 * A painted field with a shooter on it and the ground point its shot is aimed
 * at: one call is one "the Sprayer can see you" situation.
 */
function scenario({ shooter = ENEMY.sprayer, at = [0, 0, 0], targetZ = 6, extra = [] } = {}) {
  const floor = makeSurface();
  const target = new THREE.Vector3(0, 0, targetZ);
  floor.splat(target, 'blue', 6);          // stand on paint, as the manual check says
  const surfaces = [floor, ...extra];
  const enemy = spawn(shooter, at, { floors: [floor], surfaces });
  return { floor, enemy, target, surfaces };
}

/**
 * Radius in metres of the grey hole, measured from `centre`.
 *
 * The field is painted blue first, so inside `limit` "grey" and "hole" are the
 * same thing. Cell centres are converted back through the mesh rather than
 * assumed, so this works for ground and for walls.
 */
function holeRadius(surface, centre, limit) {
  const { cols, rows, data } = surface.map;
  const v = new THREE.Vector3();
  let max = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data[(row * cols + col) * 4] !== PAINT_IDS.grey) continue;

      v.set(
        ((col + 0.5) / cols) * surface.width - surface.width / 2,
        ((row + 0.5) / rows) * surface.height - surface.height / 2,
        0,
      );
      surface.mesh.localToWorld(v);

      const dx = v.x - centre.x;
      const dz = v.z - centre.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > limit) continue;             // outside the painted field: grey for free
      if (d > max) max = d;
    }
  }
  return max;
}

/** How many cells inside `limit` of `centre` are grey (i.e. were converted). */
function greyCells(surface, centre, limit = 4) {
  const { cols, rows, data } = surface.map;
  const v = new THREE.Vector3();
  let count = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (data[(row * cols + col) * 4] !== PAINT_IDS.grey) continue;
      v.set(
        ((col + 0.5) / cols) * surface.width - surface.width / 2,
        ((row + 0.5) / rows) * surface.height - surface.height / 2,
        0,
      );
      surface.mesh.localToWorld(v);
      if (Math.hypot(v.x - centre.x, v.z - centre.z) <= limit) count++;
    }
  }
  return count;
}

test("a Sprayer's shot turns the ground grey where it lands", () => {
  const { floor, enemy, target } = scenario();

  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.blue);
  run(enemy, target, WINDUP_FRAMES);

  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.grey,
    'the shot landed on painted ground and left grey');
  assert.equal(floor.surfaceAtWorld(target), SURFACE.grey,
    'grey is not just a colour: it is the physics of dead ground');
});

test('it greys the IMPACT, not the ground around the shooter', () => {
  const { floor, enemy, target } = scenario();

  const nearShooter = new THREE.Vector3(0, 0, 1);
  assert.equal(floor.paintIdAtWorld(nearShooter), PAINT_IDS.blue);
  run(enemy, target, WINDUP_FRAMES);

  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.grey);
  assert.equal(floor.paintIdAtWorld(nearShooter), PAINT_IDS.blue,
    'the ground under the enemy is five metres from the impact and must not change');
});

test('the hole is about the radius the config declares', () => {
  const { floor, enemy, target } = scenario();
  run(enemy, target, WINDUP_FRAMES);

  const r = holeRadius(floor, target, 5);
  assert.ok(greyCells(floor, target) > 0, 'nothing was converted at all');
  assert.ok(Math.abs(r - ENEMY.sprayer.greyRadius) <= 0.35,
    `hole radius ${r.toFixed(2)} m does not match the declared ${ENEMY.sprayer.greyRadius} m`);
  assert.ok(ENEMY.sprayer.greyRadius >= 1.4 && ENEMY.sprayer.greyRadius <= 1.6,
    'the issue asks for a ~1.5 m radius');
});

test('nothing outside the radius is touched', () => {
  const { floor, enemy, target } = scenario();
  run(enemy, target, WINDUP_FRAMES);

  // Positive half first: a test that only proves "blue stayed blue" would pass
  // on a build where nothing converts anything, which is the build this is for.
  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.grey, 'the shot did not land');

  // Outside the reach on both axes, and still well inside the painted field.
  const outside = [
    new THREE.Vector3(2.5, 0, 6),
    new THREE.Vector3(0, 0, 9),
    new THREE.Vector3(-2.5, 0, 6),
  ];
  for (const p of outside) {
    assert.equal(floor.paintIdAtWorld(p), PAINT_IDS.blue,
      `a cell ${p.toArray().join(',')} is outside the reach and must keep its paint`);
  }
});

test('a wall between the two takes the shot, not the ground behind it', () => {
  const wall = makeWall({ z: 0 });
  // Painted, so "the wall took the hit" is observable rather than assumed.
  wall.splat(new THREE.Vector3(0, 0.65, 0), 'blue', 2);

  const { floor, enemy, target } = scenario({ at: [0, 0, -5], extra: [wall] });
  run(enemy, target, WINDUP_FRAMES);

  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.blue,
    'the conversion passed through a wall');
  assert.equal(wall.paintIdAtWorld(new THREE.Vector3(0, 0.65, 0)), PAINT_IDS.grey,
    'the wall is what the ray reached, so the wall is what greys');
});

test('a raised surface takes the hit instead of the floor underneath it', () => {
  const step = makeSurface({ width: 20, height: 2, y: 0.7 });
  step.splat(new THREE.Vector3(0, 0.7, 0), 'blue', 12);   // the whole step, painted

  const { floor, enemy, target } = scenario({ at: [0, 0, -5], extra: [step] });
  run(enemy, target, WINDUP_FRAMES);

  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.blue,
    'the shot reached the floor through the step');
  // Every grey cell on a fully painted step is a cell the shot converted.
  assert.ok(greyCells(step, new THREE.Vector3(0, 0.7, 0), 3) > 0,
    'the step is what the ray reached, so the step is what greys');
});

test('an unpaintable gate refuses the conversion; the same wall without the flag takes it', () => {
  const gate = makeWall({ z: 0, unpaintable: true });
  const blocked = scenario({ at: [0, 0, -5], extra: [gate] });

  assert.doesNotThrow(() => run(blocked.enemy, blocked.target, WINDUP_FRAMES));
  assert.equal(blocked.floor.paintIdAtWorld(blocked.target), PAINT_IDS.blue,
    'a gate must not let the conversion through to the ground behind it');
  assert.equal(gate.paintIdAtWorld(new THREE.Vector3(0, 0.65, 0)), PAINT_IDS.grey);

  // The same wall, paintable: it takes the hit, and the ground behind it still
  // does not change. That is the assertion with teeth — an unpaintable surface
  // reads grey whether or not anything ran.
  const wall = makeWall({ z: 0 });
  wall.splat(new THREE.Vector3(0, 0.65, 0), 'blue', 2);
  const open = scenario({ at: [0, 0, -5], extra: [wall] });
  run(open.enemy, open.target, WINDUP_FRAMES);

  assert.equal(wall.paintIdAtWorld(new THREE.Vector3(0, 0.65, 0)), PAINT_IDS.grey,
    'a paintable wall in the way is what the shot converts');
  assert.equal(open.floor.paintIdAtWorld(open.target), PAINT_IDS.blue);
});

test('the player can repaint converted ground immediately', () => {
  const { floor, enemy, target } = scenario();
  run(enemy, target, WINDUP_FRAMES);
  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.grey);

  // Both directions in the same cells, in the same frame — no lock, no cooldown.
  assert.equal(floor.splat(target, 'blue', 1.5), true);
  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.blue);
  assert.equal(floor.surfaceAtWorld(target), SURFACE.blue);
});

test('enemy grey is the exact grey dead ground uses: no tint, no second id', () => {
  const { floor, enemy, target } = scenario();
  run(enemy, target, WINDUP_FRAMES);

  assert.ok(greyCells(floor, target) > 0);

  // Every cell in the field is either the player's blue or PAINT_IDS.grey.
  // A tint of its own would need a fifth id, and there is not one.
  assert.equal(PAINT.grey.id, PAINT_IDS.grey);
  assert.deepEqual(Object.keys(PAINT), ['grey', 'blue', 'red', 'green']);
  assert.equal(floor.paintIdAtWorld(target), PAINT.grey.id);
});

test('nothing changes hands while the shot is still winding up', () => {
  const { floor, enemy, target } = scenario();
  const half = Math.floor(ENEMY.sprayer.windup / FRAME / 2);

  run(enemy, target, half);
  assert.equal(enemy.telegraphing, true, 'the attack should be mid-telegraph');
  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.blue,
    'the conversion happens on impact, not on the windup');

  run(enemy, target, WINDUP_FRAMES);
  assert.equal(floor.paintIdAtWorld(target), PAINT_IDS.grey);
});

test('one attack is one splat: the hole does not grow while it cools down', () => {
  const { floor, enemy, target } = scenario();
  run(enemy, target, WINDUP_FRAMES);

  const after = greyCells(floor, target);
  assert.ok(after > 0, 'the first attack converted nothing');

  // One second of frames inside a 2.5 s cooldown: no second shot, so no change.
  run(enemy, target, 60);
  assert.equal(greyCells(floor, target), after,
    'the ground kept converting between shots');
});

test('a Sprayer killed mid-windup converts nothing; a live one does', () => {
  const dead = scenario();
  run(dead.enemy, dead.target, Math.floor(dead.enemy.config.windup / FRAME) - 4);
  dead.enemy.takeColourHit(PAINT_IDS.blue, 999);
  run(dead.enemy, dead.target, WINDUP_FRAMES);
  assert.equal(dead.floor.paintIdAtWorld(dead.target), PAINT_IDS.blue);

  const live = scenario();
  run(live.enemy, live.target, WINDUP_FRAMES);
  assert.equal(live.floor.paintIdAtWorld(live.target), PAINT_IDS.grey);
});

test('a Turret and a Charger leave the ground alone; a Sprayer does not', () => {
  const turret = scenario({ shooter: ENEMY.turret, at: [0, 0, 0], targetZ: 6 });
  run(turret.enemy, turret.target, Math.ceil(ENEMY.turret.windup / FRAME) + 6);
  assert.equal(turret.floor.paintIdAtWorld(turret.target), PAINT_IDS.blue,
    'turrets deliberately leave ground alone');

  const charger = scenario({ shooter: ENEMY.charger, at: [0, 0, 0], targetZ: 6 });
  run(charger.enemy, charger.target, 120);
  assert.equal(charger.floor.paintIdAtWorld(charger.target), PAINT_IDS.blue,
    'the Charger takes health by contact, not territory');

  const sprayer = scenario();
  run(sprayer.enemy, sprayer.target, WINDUP_FRAMES);
  assert.equal(sprayer.floor.paintIdAtWorld(sprayer.target), PAINT_IDS.grey,
    'the Sprayer is the one that does convert');
});

test('only the Sprayer carries a grey radius, and the Drainer greys by eating', () => {
  const converting = Object.entries(ENEMY)
    .filter(([, config]) => config.greyRadius > 0)
    .map(([type]) => type);

  assert.deepEqual(converting, ['sprayer']);
  assert.equal(ENEMY.turret.greyRadius, undefined);
  assert.equal(ENEMY.drainer.greyRadius, undefined);
  assert.equal(ENEMY.drainer.drainsPaint, true,
    "the Drainer's grey is #80's drain, not a shot that lands");
});

test('an enemy with no surfaces to shoot at does not throw', () => {
  const target = new THREE.Vector3(0, 0, 6);
  const naked = spawn(ENEMY.sprayer, [0, 0, 0], { floors: [], surfaces: [] });

  assert.doesNotThrow(() => run(naked, target, WINDUP_FRAMES));
  assert.equal(naked.alive, true);

  // ...and the same enemy with surfaces greys, so the guard above is not
  // accidentally turning the feature off everywhere.
  const { floor, enemy, target: t } = scenario();
  run(enemy, t, WINDUP_FRAMES);
  assert.equal(floor.paintIdAtWorld(t), PAINT_IDS.grey);
});
