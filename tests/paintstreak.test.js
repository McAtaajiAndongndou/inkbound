import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { Paintstreak, zoneSplat, countPaintedCells } from '../src/paint/paintstreak.js';
import { Enemy } from '../src/enemies/enemy.js';
import { ENEMY, PAINTSTREAK, PAINT_IDS } from '../src/config.js';

function floor({ width = 40, height = 40, x = 0, y = 0, z = 0 } = {}) {
  const s = new PaintSurface({ width, height, cells: 2 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(x, y, z);
  s.mesh.updateMatrixWorld(true);
  return s;
}

function wall() {
  const s = new PaintSurface({ width: 40, height: 10, cells: 2 });
  s.mesh.position.set(0, 5, -3);          // vertical, facing +z, 3 m from the zone centre
  s.mesh.updateMatrixWorld(true);
  return s;
}

const enemy = (type = 'sprayer', x = 0, z = 0) => new Enemy({
  position: new THREE.Vector3(x, 0, z),
  config: ENEMY[type],
  parent: new THREE.Group(),
  floors: [],
});

/** Paint `n` fresh cells on a surface, then let the streak scan them. */
function paintCells(streak, s, n, start = 0) {
  for (let i = start; i < start + n; i++) s.map.data[i * 4] = PAINT_IDS.blue;
  streak.update(PAINTSTREAK.sampleInterval, { surfaces: [s], speed: 0 });
}

// --- the gauge ---------------------------------------------------------------

test('new ground fills the gauge; what was painted before the first scan does not (#131)', () => {
  const s = floor();
  for (let i = 0; i < 200; i++) s.map.data[i * 4] = PAINT_IDS.red;   // a level's pre-painted examples
  const streak = new Paintstreak();
  streak.update(PAINTSTREAK.sampleInterval, { surfaces: [s], speed: 0 });
  assert.equal(streak.value, 0, 'the first scan is a baseline');
  paintCells(streak, s, PAINTSTREAK.cellsPerPoint * 4, 200);
  assert.ok(Math.abs(streak.value - 4) < 1e-9);
});

test('coverage outweighs kills, in that order', () => {
  // A kill against what an average splat of fresh ground (~25 cells) earns.
  const splat = 25 / PAINTSTREAK.cellsPerPoint;
  assert.ok(PAINTSTREAK.pointsPerKill > splat, 'a kill is worth more than one shot...');
  assert.ok(PAINTSTREAK.pointsPerKill < 10 * splat, '...but far less than a stretch of painting');
});

test('varied play fills faster than repeating one action', () => {
  // The same 500 cells of new ground, painted standing still...
  const repeat = new Paintstreak();
  const a = floor();
  repeat.update(PAINTSTREAK.sampleInterval, { surfaces: [a], speed: 0 });
  paintCells(repeat, a, 500);

  // ...and painted on the move, just after a kill.
  const varied = new Paintstreak();
  const b = floor();
  varied.update(PAINTSTREAK.sampleInterval, { surfaces: [b], speed: 0 });
  varied.onKill();
  const afterKill = varied.value;
  for (let i = 0; i < 500; i++) b.map.data[i * 4] = PAINT_IDS.blue;
  varied.update(PAINTSTREAK.sampleInterval, { surfaces: [b], speed: PAINTSTREAK.traverseSpeed + 1 });

  assert.equal(varied.activeChannels, 3);
  assert.ok(varied.value - afterKill > repeat.value * 1.9,
    `painting earned ${varied.value - afterKill} with variety vs ${repeat.value} without`);
});

test('variety lapses: a channel stops counting after its window', () => {
  const streak = new Paintstreak();
  streak.onKill();
  assert.equal(streak.activeChannels, 1);
  streak.update(PAINTSTREAK.varietyWindow + 0.1, { surfaces: [], speed: 0 });
  assert.equal(streak.activeChannels, 0);
});

test('the gauge caps at full, cannot be spent before then, and never fires itself', () => {
  const s = floor();
  const streak = new Paintstreak();
  assert.equal(streak.spend({ surfaces: [s], enemies: [], centre: new THREE.Vector3(), colour: 'blue' }), false, 'empty');
  for (let i = 0; i < 100; i++) streak.onKill();
  assert.equal(streak.value, PAINTSTREAK.max);
  assert.equal(countPaintedCells([s]), 0, 'filling up paints nothing by itself');
});

test('reset empties it (death, restart)', () => {
  const streak = new Paintstreak();
  streak.onKill();
  streak.reset();
  assert.equal(streak.value, 0);
  assert.equal(streak.activeChannels, 0);
});

// --- the spend -----------------------------------------------------------------

test('spending a full gauge paints a large zone instantly and empties it', () => {
  const s = floor();
  const streak = new Paintstreak();
  streak.value = PAINTSTREAK.max;
  assert.equal(streak.spend({ surfaces: [s], enemies: [], centre: new THREE.Vector3(0, 0, 0), colour: 'green' }), true);
  assert.equal(streak.value, 0);
  const cells = countPaintedCells([s]);
  const expected = Math.PI * PAINTSTREAK.zoneRadius ** 2 * 4; // 2 cells per metre
  assert.ok(cells > expected * 0.8 && cells < expected * 1.2, `${cells} cells vs ~${expected.toFixed(0)}`);
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(2, 0, 2)), PAINT_IDS.green);
  assert.equal(s.paintIdAtWorld(new THREE.Vector3(PAINTSTREAK.zoneRadius + 2, 0, 0)), PAINT_IDS.grey);
});

test('the zone it claims cannot refill the gauge', () => {
  const s = floor();
  const streak = new Paintstreak();
  streak.update(PAINTSTREAK.sampleInterval, { surfaces: [s], speed: 0 });
  streak.value = PAINTSTREAK.max;
  streak.spend({ surfaces: [s], enemies: [], centre: new THREE.Vector3(), colour: 'blue' });
  streak.update(PAINTSTREAK.sampleInterval, { surfaces: [s], speed: 0 });
  assert.equal(streak.value, 0);
});

test('the zone reaches a neighbouring floor, skips walls and far-off floors', () => {
  const here = floor({ width: 10, height: 10, x: 0 });
  const next = floor({ width: 10, height: 10, x: 10 });     // seam at x = 5
  const above = floor({ width: 10, height: 10, y: 8 });       // a deck overhead
  const side = wall();
  zoneSplat([here, next, above, side], new THREE.Vector3(3, 0, 0), 'red');
  assert.equal(next.paintIdAtWorld(new THREE.Vector3(6, 0, 0)), PAINT_IDS.red, 'across the seam');
  assert.equal(countPaintedCells([above]), 0, 'a floor 8 m up is not in the zone');
  assert.equal(countPaintedCells([side]), 0, 'walls are not ground');
});

// --- the stun ----------------------------------------------------------------

test('enemies inside the zone are stunned; outside, and turrets, are not', () => {
  const s = floor();
  const inside = enemy('sprayer', 2, 0);
  const outside = enemy('sprayer', PAINTSTREAK.zoneRadius + 3, 0);
  const turret = enemy('turret', 1, 1);
  const streak = new Paintstreak();
  streak.value = PAINTSTREAK.max;
  streak.spend({ surfaces: [s], enemies: [inside, outside, turret], centre: new THREE.Vector3(), colour: 'blue' });
  assert.equal(inside.stunned, true);
  assert.equal(outside.stunned, false);
  assert.equal(turret.stunned, false, 'no-procs: immune to every status (#77)');
});

test('a stun cancels a windup, blocks attacks, then lifts on its own', () => {
  const e = enemy('sprayer');
  e.startTelegraph();
  assert.equal(e.telegraphing, true);
  e.stun(PAINTSTREAK.stunTime);
  assert.equal(e.telegraphing, false, 'the attack in progress is cancelled');

  let attacked = false;
  e.onAttack = () => { attacked = true; };
  const near = new THREE.Vector3(1, 0, 0);
  for (let t = 0; t < PAINTSTREAK.stunTime - 0.1; t += 1 / 60) e.update(1 / 60, near);
  assert.equal(e.stunned, true);
  assert.equal(attacked, false);
  assert.equal(e.telegraphing, false, 'no new windup while stunned');
  for (let t = 0; t < 0.2; t += 1 / 60) e.update(1 / 60, near);
  assert.equal(e.stunned, false);
});
