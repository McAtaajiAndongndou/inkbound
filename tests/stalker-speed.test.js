// OWNER: shaders (Lethabo) — #120
//
// The Stalker is the only enemy that attacks the loop from the other side: it is
// fast on YOUR paint and slow on grey, so the escape is to give up your own
// territory. The design note is that the player must be able to deduce the rule
// without being told — which only works if the numbers are brutal, so these
// tests measure actual walked distance rather than configuration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, HEALTH, PAINT_IDS, STALKER } from '../src/config.js';

/** The frame step every test uses — 60 fps, so a second is sixty calls. */
const DT = 1 / 60;

/** A flat walkable surface. `cells` is cells-per-metre, not a count. */
function makeFloor({ size = 80, y = 0, cells = 4 } = {}) {
  const s = new PaintSurface({ width: size, height: size, cells });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(0, y, 0);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

/** Paint the whole floor one colour — the uniform-territory speed cases. */
function paintedFloor(colour) {
  const floor = makeFloor();
  floor.splat(new THREE.Vector3(0, 0, 0), colour, 45);
  return floor;
}

/** Paint a strip along z at `x`, wide enough for the lookahead fan to find. */
function stripFloor(x, width = 1.4, colour = 'green') {
  const floor = makeFloor();
  for (let z = -10; z <= 6; z += 0.8) {
    floor.splat(new THREE.Vector3(x, 0, z), colour, width / 2);
  }
  return floor;
}

function makeStalker({ at = [0, 0, 0], floor }) {
  return new Enemy({
    position: new THREE.Vector3(...at),
    config: ENEMY.stalker,
    parent: new THREE.Group(),
    floors: [floor],
  });
}

function run(enemy, frames, player) {
  for (let i = 0; i < frames; i++) enemy.update(DT, player);
}

/** Horizontal distance walked toward the player over `seconds`. */
function walked({ colour = null, seconds = 1, playerAt = [0, 0, -12] }) {
  const floor = colour ? paintedFloor(colour) : makeFloor();
  const enemy = makeStalker({ floor });
  const player = new THREE.Vector3(...playerAt);
  const start = enemy.position.clone();
  run(enemy, Math.round(seconds / DT), player);
  const dx = enemy.position.x - start.x;
  const dz = enemy.position.z - start.z;
  return Math.sqrt(dx * dx + dz * dz);
}

test('it is ~2 m/s on grey', () => {
  const d = walked({});
  assert.ok(d > 1.6 && d < 2.4, `walked ${d.toFixed(2)} m in one second, expected ~2.0`);
});

test('it is ~6 m/s on the player\'s paint', () => {
  const d = walked({ colour: 'green' });
  assert.ok(d > 5.4 && d < 6.6, `walked ${d.toFixed(2)} m in one second, expected ~6.0`);
});

test('it is ~6 m/s on blue and red too, not only green', () => {
  // "Your paint" is every colour the player owns; a rule that only saw green
  // would make blue fields a loophole instead of a danger.
  for (const colour of ['blue', 'red']) {
    const d = walked({ colour });
    assert.ok(d > 5.4 && d < 6.6, `${colour}: walked ${d.toFixed(2)} m in one second, expected ~6.0`);
  }
});

test('paint is obviously the fast lane — the ratio is ~3:1', () => {
  const grey = walked({});
  const paint = walked({ colour: 'green' });
  const ratio = paint / grey;
  assert.ok(ratio > 2.5 && ratio < 3.5,
    `ratio ${ratio.toFixed(2)} — the design note says a slight difference reads as noise`);
});

test('it prefers to travel inside the player\'s territory', () => {
  const player = new THREE.Vector3(0, 0, -12);
  const floor = stripFloor(1.5);          // one strip on +x, grey elsewhere
  const enemy = makeStalker({ floor });
  run(enemy, 60, player);

  assert.ok(
    floor.isPlayerPaintAtWorld(enemy.position),
    `a hunter on the strip should be standing on paint, it is at x=${enemy.position.x.toFixed(2)}`,
  );
});

test('on bare grey it takes the direct line — the preference never overrides sense', () => {
  const player = new THREE.Vector3(0, 0, -12);
  const enemy = makeStalker({ floor: makeFloor() });
  run(enemy, 60, player);
  assert.ok(Math.abs(enemy.position.x) < 0.4,
    `drifted ${enemy.position.x.toFixed(2)} m sideways on a uniform floor`);
});

test('its speed is read off the ground every frame, not once at spawn', () => {
  // The wall-crawler's CLIMB has the same rule; the enemy can cross the boundary
  // mid-chase and must change speed when it does.
  const floor = paintedFloor('green');
  const enemy = makeStalker({ floor });
  const player = new THREE.Vector3(0, 0, -14);
  run(enemy, 30, player);                  // 3 m, fast lane

  // Strip the paint under it: paint grey is not a splat, so drain the green by
  // painting everything grey via a second unpaintable… simplest is a fresh grey
  // floor position: move the player and check it now walks at grey speed.
  // Painting over green with grey is what the Drainer does; here we just verify
  // the read is live by crossing onto a grey patch.
  floor.splat(new THREE.Vector3(0, 0, -2), 'grey', 45);
  const before = enemy.position.clone();
  run(enemy, 60, player);
  const d = enemy.position.distanceTo(before);
  assert.ok(d < 2.6, `walked ${d.toFixed(2)} m after the paint went grey, expected ~2.0`);
});

test('normal colour procs apply — it is not proc-immune', () => {
  const floor = paintedFloor('green');
  const green = makeStalker({ floor });
  green.takeColourHit(PAINT_IDS.green);
  assert.ok(green._pinnedTimer > 0, 'green must pin it');

  const red = makeStalker({ floor });
  red.takeColourHit(PAINT_IDS.red, 10, new THREE.Vector3(0, 0, -5));
  assert.ok(red._knockback.lengthSq() > 0, 'red must knock it back');

  const blue = makeStalker({ floor });
  for (let i = 0; i < 3; i++) blue.takeColourHit(PAINT_IDS.blue);
  assert.ok(blue._frozenTimer > 0, 'three blue hits must freeze it');
});

test('it never hides: visible and opaque the whole time', () => {
  const enemy = makeStalker({ floor: paintedFloor('green') });
  const player = new THREE.Vector3(0, 0, -10);
  run(enemy, 120, player);
  assert.equal(enemy.mesh.visible, true, 'must stay visible');
  enemy.mesh.traverse((o) => {
    if (o.isMesh) assert.ok(o.material.opacity === 1, 'no fade, no transparency');
  });
});

test('inside lunge range it telegraphs for 0.4 s, then commits', () => {
  const enemy = makeStalker({ floor: paintedFloor('green') });
  const player = new THREE.Vector3(0, 0, -3);
  run(enemy, 2, player);
  assert.ok(enemy.telegraphing, 'should be winding up 3 m out');

  // The windup plants it (startTelegraph), so nothing moves for 0.4 s.
  const before = enemy.position.clone();
  run(enemy, 20, player);
  assert.ok(enemy.position.distanceTo(before) < 1e-9, 'the tell plants it');

  // The telegraph is over: the commitment is a heading held at lunge speed.
  // (The windup's 24 countdown frames plus the set-up frame make the commit
  // land on frame 26, so ride a few frames past it.)
  run(enemy, 5, player);
  const speed = Math.hypot(enemy._vel.x, enemy._vel.z);
  assert.ok(Math.abs(speed - STALKER.lungeSpeed) < 0.6,
    `committed at ${speed.toFixed(2)} m/s, expected ${STALKER.lungeSpeed}`);
});

test('a lunge that reaches the player costs no recovery', () => {
  const enemy = makeStalker({ floor: paintedFloor('green') });
  const player = new THREE.Vector3(0, 0, -3);
  // 0.4 s telegraph + 0.5 s commitment = 54 frames before the lunge can end.
  run(enemy, 60, player);
  const dist = enemy.position.distanceTo(player);
  assert.ok(dist <= HEALTH.contactRange + 0.5,
    `3 m is inside the reach, it must arrive (ended ${dist.toFixed(2)} m away)`);
  assert.equal(enemy._recoverTimer, 0, 'a hit owes no recovery window');
});

test('a sidestep during the tell makes it miss and plants it for ~0.8 s', () => {
  const enemy = makeStalker({ floor: paintedFloor('green') });
  const player = new THREE.Vector3(0, 0, -3);
  // Run to just past the commit: 2 settle frames + 24 windup frames + a couple
  // of committed frames. The heading toward (0, -3) is captured in here.
  run(enemy, 28, player);

  // The player steps aside AFTER the heading was captured — the intended dodge.
  player.set(6, 0, -3);
  run(enemy, 30, player);                  // ride out the rest of the lunge

  // The heading was held, not re-aimed: it went where the player WAS.
  assert.ok(Math.abs(enemy.position.z + STALKER.lungeSpeed * STALKER.lungeTime) < 0.6,
    `it must hold the captured heading, ended at z=${enemy.position.z.toFixed(2)}`);
  assert.ok(enemy._recoverTimer > 0.3,
    `a miss owes ~${STALKER.lungeRecovery}s planted, has ${enemy._recoverTimer.toFixed(2)}`);
  const speed = Math.hypot(enemy._vel.x, enemy._vel.z);
  assert.ok(speed < 0.01, 'recovery plants it');
});

test('the config is the identity: surface speed, paint preference, lunge, procs on', () => {
  const c = ENEMY.stalker;
  assert.equal(c.surfaceSpeed, true);
  assert.equal(c.prefersPaint, true);
  assert.equal(c.lunges, true);
  assert.ok(!c.noProcs, 'paint must solve it like every non-turret');
  assert.equal(c.speed, STALKER.greySpeed);
  assert.equal(c.windup, STALKER.lungeWindup);
  assert.equal(c.attackRange, STALKER.lungeSpeed * STALKER.lungeTime + HEALTH.contactRange,
    'lunge range must be exactly "close enough to arrive"');
});
