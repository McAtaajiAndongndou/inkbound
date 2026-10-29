// OWNER: shaders (Lethabo) — #77
//
// THE MATRIX GAP. ENEMIES.md names the turret as the one enemy that paint does
// not solve: docs/DECISIONS.md settles it as no status procs at all, and the
// answer is positioning — break line of sight and flank. That only works if the
// procs GENUINELY do nothing. The moment a turret can be frozen or shoved, the
// gap is gone and the turret is just another enemy.
//
// These tests are written against the turret's real config on the real level
// floor, because the interesting failure is not "the branch is missing" — it is
// "red's knockback runs during the windup branch, so a red hit still shoves a
// CANNOT-MOVE turret sideways while it is telegraphing" (that is the one that
// actually shipped on main).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Level01 } from '../src/levels/level-01-mission.js';
import { Enemy } from '../src/enemies/enemy.js';
import { ENEMY, PAINT_IDS } from '../src/config.js';

const DT = 1 / 60;

async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  return level;
}

/** Island B: the flattest walkable ground in L1, and where the Charger lives. */
function arena(level) {
  const island = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);
  assert.ok(island, 'island B floor surface not found — level layout changed');
  return { floor: island, y: island.mesh.position.y };
}

function makeEnemy(level, config, x, z, y) {
  return new Enemy({
    position: new THREE.Vector3(x, y, z),
    config,
    parent: level.root,
    floors: level.surfaces,
  });
}

/** A turret, sitting still, with the player 4 m away and inside attackRange. */
function makeTurret(level, y) {
  const turret = makeEnemy(level, ENEMY.turret, 0, 0, y);
  const player = new THREE.Vector3(0, y, -4);
  return { turret, player };
}

test('the turret is the only enemy flagged as taking no status procs', () => {
  assert.equal(ENEMY.turret.noProcs, true, 'turret config must opt out of procs');

  for (const [name, config] of Object.entries(ENEMY)) {
    if (name === 'turret') continue;
    assert.ok(!config.noProcs,
      `${name} must still take procs — paint is supposed to solve it`);
  }
});

test('blue on a turret builds no slow', async () => {
  const level = await buildLevel();
  const { turret } = makeTurret(level, arena(level).y);

  turret.takeColourHit(PAINT_IDS.blue);

  assert.equal(turret._slipTimer, 0, 'blue must not start the slow timer');
  assert.equal(turret.hp, ENEMY.turret.hp - 10, 'blue still has to deal damage');
});

test('green on a turret pins nothing', async () => {
  const level = await buildLevel();
  const { turret } = makeTurret(level, arena(level).y);

  turret.takeColourHit(PAINT_IDS.green);

  assert.equal(turret._pinnedTimer, 0, 'green must not root the turret');
  assert.equal(turret.hp, ENEMY.turret.hp - 10, 'green still has to deal damage');
});

test('red on a turret builds no knockback', async () => {
  const level = await buildLevel();
  const { turret, player } = makeTurret(level, arena(level).y);

  turret.takeColourHit(PAINT_IDS.red, 10, player);

  assert.equal(turret._knockback.lengthSq(), 0, 'red must not store an impulse');
  assert.equal(turret.hp, ENEMY.turret.hp - 10, 'red still has to deal damage');
});

test('a red hit cannot slide a turret, even mid-telegraph', async () => {
  // The regression. A turret has canMove: false and _tick returns early for it —
  // but the WINDUP branch returns before that check and calls _applyKnockback,
  // so for the 0.8 s of its telegraph a red hit used to shove it sideways.
  const level = await buildLevel();
  const { turret, player } = makeTurret(level, arena(level).y);

  turret.update(DT, player);
  assert.ok(turret.telegraphing, 'turret should be winding up with the player 4 m away');

  const before = turret.position.clone();
  turret.takeColourHit(PAINT_IDS.red, 10, player);
  for (let i = 0; i < 30; i++) turret.update(DT, player); // still inside the 48-frame windup

  assert.ok(turret.telegraphing, 'test must still be inside the windup');
  assert.ok(turret.position.distanceTo(before) < 1e-9,
    `turret moved ${turret.position.distanceTo(before).toFixed(4)} m on a red hit`);
});

test('all three colours deal the same damage to a turret', async () => {
  const level = await buildLevel();
  const { y } = arena(level);

  // No damage argument: this is exactly what paint-gun.js passes
  // (`takeColourHit(colourId, undefined, target)`), so it tests the real call.
  const tints = [PAINT_IDS.blue, PAINT_IDS.red, PAINT_IDS.green].map((id) => {
    const e = makeEnemy(level, ENEMY.turret, 0, 0, y);
    e.takeColourHit(id);
    return ENEMY.turret.hp - e.hp;
  });

  assert.deepEqual(tints, [10, 10, 10], 'colour must not change the damage');
});

test('a turret is still killable', async () => {
  const level = await buildLevel();
  const { turret, player } = makeTurret(level, arena(level).y);

  const hits = Math.ceil(ENEMY.turret.hp / 10);
  for (let i = 0; i < hits - 1; i++) turret.takeColourHit(PAINT_IDS.red, 10, player);
  assert.ok(turret.alive, 'must survive one hit short of death');

  turret.takeColourHit(PAINT_IDS.red, 10, player);
  assert.equal(turret.alive, false, 'the last hit must kill it');
  assert.ok(turret.hp <= 0);
});

test('every other enemy still takes its procs', async () => {
  // The other half of the flag: it must be scoped to the turret, not to
  // "enemies that happen to be standing still".
  const level = await buildLevel();
  const { y } = arena(level);

  const blue = makeEnemy(level, ENEMY.charger, 0, 0, y);
  blue.takeColourHit(PAINT_IDS.blue);
  assert.ok(blue._slipTimer > 0, 'a Charger must still be slowed by blue');

  const green = makeEnemy(level, ENEMY.charger, 2, 0, y);
  green.takeColourHit(PAINT_IDS.green);
  assert.ok(green._pinnedTimer > 0, 'a Charger must still be pinned by green');

  const red = makeEnemy(level, ENEMY.charger, -2, 0, y);
  red.takeColourHit(PAINT_IDS.red);
  assert.ok(red._knockback.lengthSq() > 0, 'a Charger must still be knocked by red');
});
