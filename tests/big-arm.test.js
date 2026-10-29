// Big Arm (#99): Last Colour's arena boss, against the issue's acceptance
// criteria and docs/levels/03-last-colour.md (R4, the decided design).
//
// No browser and no GLB: it falls back to its (scaled) box, on real
// PaintSurface floors.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { BigArm } from '../src/enemies/boss.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, BLUE_FREEZE, PAINT_IDS } from '../src/config.js';
import { Level03 } from '../src/levels/level-03-horde.js';

const B = ENEMY.bigArm;
const DT = 1 / 60;
const { blue, red, green } = PAINT_IDS;

function floor({ y = 0, size = 40 } = {}) {
  const s = new PaintSurface({ width: size, height: size, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.y = y;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}
function boss({ floors = [floor()], at = [0, 0, 0] } = {}) {
  const parent = new THREE.Group();
  for (const f of floors) parent.add(f.mesh);
  const b = new BigArm({ position: new THREE.Vector3(...at), parent, floors, surfaces: floors, blockers: [] });
  return { b, floors };
}
const run = (b, seconds, player) => { for (let t = 0; t < seconds - 1e-9; t += DT) b.update(DT, player); };
/** Blue ×3, green, red: one full combo. */
function combo(b) {
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(blue);
  b.takeColourHit(green);
  b.takeColourHit(red);
}
const far = new THREE.Vector3(30, 0, 0);

test('damage does not kill it: no amount of plain hits, traps or falls', () => {
  const { b } = boss();
  for (let i = 0; i < 60; i++) { b.takeColourHit(red, 50); b.takeColourHit(green, 50); }
  assert.equal(b.takeDamage(9999), false);
  assert.ok(b.alive);
  assert.equal(b.hp, B.hp, 'hp counts combos left, and none have landed');
});

test('the combo, in order: blue freezes, green pins, red knocks it down', () => {
  const { b } = boss();
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(blue);
  assert.equal(b.combo, 'frozen', 'step 1: the ordinary freeze');
  assert.equal(b.hp, B.hp, 'and the freeze costs no hp');

  b.takeColourHit(green);
  assert.equal(b.combo, 'pinned', 'step 2: green on a frozen boss pins it');
  assert.ok(b._shackles.visible, 'the shackles are the tell');
  assert.equal(b._frostShell.visible, false, 'the frost gives way');

  b.takeColourHit(red);
  assert.equal(b.combo, 'down', 'step 3: red on a pinned boss knocks it flat');
  assert.equal(b.hp, B.hp - 1);
  assert.ok(b.alive);
});

test('out of order does nothing: green or red on a free boss is a tint', () => {
  const { b } = boss();
  b.takeColourHit(green);
  b.takeColourHit(red);
  assert.equal(b.combo, 'open');
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(blue);
  b.takeColourHit(red);   // red on a frozen boss: not the next step
  assert.equal(b.combo, 'frozen');
  assert.equal(b.hp, B.hp);
});

test('miss a window and the chain breaks: the frost melts, the shackles snap', () => {
  const { b } = boss();
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(blue);
  run(b, BLUE_FREEZE.critWindow + 0.1, far);
  assert.equal(b.combo, 'open', 'too slow with green');

  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(blue);
  b.takeColourHit(green);
  run(b, B.pinFor + 0.1, far);
  assert.equal(b.combo, 'open', 'too slow with red');
  assert.equal(b._shackles.visible, false);
  b.takeColourHit(red);
  assert.equal(b.hp, B.hp, 'red after the window is only a tint');
});

test('each combo ends a phase; phase 2 calls two Drainers; the third combo kills it with red', () => {
  const { b } = boss();
  const phases = [];
  const summons = [];
  const deaths = [];
  b.onPhase = (_, p) => phases.push(p);
  b.onSummon = (_, n) => summons.push(n);
  b.onDeath = (_, cause) => deaths.push({ ...cause });

  combo(b);
  run(b, B.downFor + 0.1, far);
  assert.equal(b.phase, 2);
  assert.deepEqual(summons, [2]);
  assert.equal(b.config.speed, B.phases[1].speed, 'phase 2 is faster');

  combo(b);
  run(b, B.downFor + 0.1, far);
  assert.equal(b.phase, 3);
  assert.equal(b.config.ignoresPaint, true, 'phase 3 is enraged');

  combo(b);
  assert.equal(b.alive, false);
  assert.deepEqual(phases, [2, 3]);
  assert.deepEqual(summons, [2], 'only phase 2 summons');
  assert.deepEqual(deaths, [{ colour: 'red', effect: 'knockback' }]);
});

test('the slam is telegraphed, greys the floor round it, and only hurts inside its radius', () => {
  const { b, floors: [ground] } = boss();
  b.wake();
  let hits = 0;
  b.onAttack = () => { hits++; };
  ground.splat(new THREE.Vector3(0, 0, 2), 'blue', 6);   // the player's paint all round it

  const near = new THREE.Vector3(0, 0, 3);
  let telegraphed = false;
  for (let t = 0; t < B.windup + 1; t += DT) {
    b.update(DT, near);
    if (b.telegraphing) telegraphed = true;
    if (hits) break;
  }
  assert.ok(telegraphed, 'a tell before the slam');
  assert.equal(hits, 1, 'inside the slam: it lands');
  const slammed = new THREE.Vector3(b.position.x, 0, b.position.z + B.slamReach);
  assert.equal(ground.paintIdAtWorld(slammed), PAINT_IDS.grey, 'the floor at the impact is grey');
  assert.equal(ground.paintIdAtWorld(new THREE.Vector3(0, 0, b.position.z + B.slamReach + B.slamRadius + 1.5)), PAINT_IDS.blue,
    'paint outside the radius survives');

  // Dodged: out of the radius by the time it lands.
  const { b: b2 } = boss();
  b2.wake();
  let hits2 = 0;
  b2.onAttack = () => { hits2++; };
  const p = new THREE.Vector3(0, 0, 3);
  for (let t = 0; t < B.windup + 0.2; t += DT) {
    b2.update(DT, p);
    if (b2.telegraphing) p.set(0, 0, 3 + B.slamRadius + B.slamReach + 1);   // step back on the tell
  }
  assert.equal(hits2, 0, 'stepping back on the tell dodges it');
});

test('the slam cannot reach the balconies: raised paint is safe paint', () => {
  const ground = floor();
  const balcony = floor({ y: 5, size: 10 });
  const { b } = boss({ floors: [ground, balcony] });
  const up = new THREE.Vector3(0, 5, 1);
  balcony.splat(up, 'green', 3);
  b.slam(new THREE.Vector3(0, 0, 1));
  assert.equal(balcony.paintIdAtWorld(up), PAINT_IDS.green);
});

test('phase 2 grabs: a tell, then it lands only if you are still in reach', () => {
  const { b } = boss();
  b.wake();
  combo(b);
  run(b, B.downFor + 0.1, far);
  assert.equal(b.phase, 2);

  let grabs = 0;
  b.onGrab = () => { grabs++; };
  const close = new THREE.Vector3(0, 0, B.grab.range - 0.5);
  b.update(DT, close);
  assert.ok(b.grabbing, 'in reach: the grab starts with a tell');
  run(b, B.grab.windup + DT, close);
  assert.equal(grabs, 1);

  // The next one, dodged.
  run(b, B.grab.cooldown + 0.1, far);
  b.update(DT, close);
  assert.ok(b.grabbing);
  run(b, B.grab.windup + DT, far);
  assert.equal(grabs, 1, 'walked out of reach on the tell');
});

test('phase 3 ignores paint: its speed is the same on any ground', () => {
  const { b, floors: [ground] } = boss();
  combo(b); run(b, B.downFor + 0.1, far);
  combo(b); run(b, B.downFor + 0.1, far);
  const blueGround = { surface: ground, point: new THREE.Vector3() };
  assert.equal(b._moveSpeed({ speedScale: 0.3, friction: 0 }, blueGround, 1, DT), B.phases[2].speed);
  assert.equal(b._moveSpeed({ speedScale: 1.7, friction: 0 }, blueGround, 1, DT), B.phases[2].speed);
});

// --- in Last Colour ------------------------------------------------------------

async function lastColour() {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  for (const e of level.enemies) if (e !== level.bigArm) e.update = () => {};
  return level;
}
const inCore = { position: new THREE.Vector3(0, 0, -20) };
const tick = (level, s) => { for (let t = 0; t < s - 1e-9; t += 0.05) level.update(0.05, inCore); };

test('in Last Colour: it waits in the bay until wave three is gone, plus the 12 s warning', async () => {
  const level = await lastColour();
  assert.ok(level.bigArm.sleeping);
  for (const r of level.roster) if (r.data.wave <= 3) r.enemy.alive = false;
  tick(level, 11);
  assert.ok(level.bigArm.sleeping, 'still behind its pulsing gate');
  tick(level, 1.5);
  assert.equal(level.bigArm.sleeping, false);
  level.dispose();
});

test('in Last Colour: phase 2 wakes the two bay Drainers, and the Siphon waits for all three', async () => {
  const level = await lastColour();
  for (const r of level.roster) if (r.data.wave <= 3) r.enemy.alive = false;
  tick(level, 13);
  const summons = level.roster.filter((r) => r.data.wake === 'summon').map((r) => r.enemy);
  assert.equal(summons.length, 2);
  assert.ok(summons.every((d) => d.sleeping));

  combo(level.bigArm);
  tick(level, B.downFor + 0.2);
  assert.equal(level.bigArm.phase, 2);
  assert.ok(summons.every((d) => !d.sleeping), 'called out of the bay');
  assert.equal(level.siphon.phase, 'dormant', 'the Core is not clear while Big Arm stands');

  for (const d of summons) d.alive = false;
  combo(level.bigArm);
  tick(level, B.downFor + 0.2);
  combo(level.bigArm);
  tick(level, 0.1);
  assert.equal(level.bigArm.alive, false);
  assert.equal(level.siphon.phase, 'intake', 'Big Arm down: the exam begins');
  level.dispose();
});

test('in Last Colour: the grab damages and pulls the player toward it', async () => {
  const level = await lastColour();
  const player = { position: new THREE.Vector3(0, 0, -60), velocity: new THREE.Vector3(), hp: 100, takeDamage(n) { this.hp -= n; } };
  level.update(DT, player);
  level.bigArm.position.set(0, 0, -64);
  level.bigArm.onGrab(level.bigArm);
  assert.equal(player.hp, 100 - B.grab.damage);
  assert.ok(player.velocity.z < 0, 'pulled toward Big Arm');
  level.dispose();
});
