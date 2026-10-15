import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Player } from '../src/core/player.js';
import { PAINT, PLAYER } from '../src/config.js';

// Encounter gate (#37): island B's exit is sealed until the arena is clear, so
// the Charger has to be fought rather than run past. These pin the three
// acceptance criteria on the issue — blocks until clear, no soft-lock, and a
// clean restart — plus the geometry envelope that makes "blocks" true.

async function buildLevel() {
  const game = { scene: new THREE.Scene(), onWin: null };
  const level = new Level01(game);
  await level.load();
  return { level, game };
}

const gateZ = (level) => level.gate.surface.mesh.position.z;

/** Hold W straight down -z for `frames`; returns the furthest -z reached. */
function walkForward(player, frames) {
  const input = { isDown: (k) => k === 'KeyW' };
  let minZ = player.position.z;
  for (let i = 0; i < frames; i++) {
    player.update(1 / 60, input, { jump: false });
    minZ = Math.min(minZ, player.position.z);
  }
  return minZ;
}

/** Kill everything the gate is waiting on, then let the level tick once. */
function clearArena(level) {
  for (const enemy of level._gateWatch) enemy.takeColourHit(1, 999);
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });
}

test('the gate watches only the island B enemies, not island C (#37)', async () => {
  const { level } = await buildLevel();

  assert.ok(level.gate, 'the level must expose its gate');
  assert.equal(level.gate.open, false, 'the gate starts sealed');
  assert.deepEqual(level._gateWatch.map((e) => e.type), ['charger'],
    'the Sprayer is on island C and must not hold the gate');
});

test('the gate blocks progress until island B is clear (#37)', async () => {
  const { level } = await buildLevel();

  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -2));
  player.onGround = true;
  const furthest = walkForward(player, 120);   // two full seconds of pushing at the exit

  assert.ok(furthest > gateZ(level),
    `the player walked out of a sealed arena: z=${furthest}`);
  assert.equal(player.touchingWall?.surface, level.gate.surface,
    'the player should be pressed against the gate itself, not some other wall');
});

test('clearing island B opens the gate, and the exit is genuinely open (#37)', async () => {
  const { level } = await buildLevel();
  const sprayer = level.enemies.find((e) => e.type === 'sprayer');

  clearArena(level);

  assert.equal(level.gate.open, true, 'killing the arena must open the gate');
  assert.equal(level.gate.light.material.color.getHex(), PAINT.green.hex,
    'the lock light should read "open"');
  assert.equal(sprayer.alive, true, 'island C was never part of this fight');

  // ...and it is open to the player, not just to the flag. 200 frames is more
  // than it takes to cross the lip, so the run ends in Gap 2 and respawns —
  // the furthest point reached is what matters, not where it finished.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -2));
  player.onGround = true;
  const furthest = walkForward(player, 200);

  assert.ok(furthest < gateZ(level),
    `the gate stayed shut: got no further than z=${furthest}`);
});

test('an enemy flung out of the arena cannot hold the gate shut (#37)', async () => {
  const { level } = await buildLevel();
  const charger = level.enemies.find((e) => e.type === 'charger');

  // The soft-lock this issue warns about: a red hit flings an enemy off the
  // edge, and with no gravity it floats there ALIVE forever
  // (`enemy.js` `_applyKnockback`). A clear condition that only checks `alive`
  // would seal the level permanently.
  charger.position.set(0, 0, -11);   // mid-Gap 2, out of the arena, still alive
  assert.equal(charger.alive, true);

  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });

  assert.equal(level.gate.open, true,
    'an enemy that left the island must still release the gate');
});

test('no paint colour opens the gate — the fight is the only answer (#37)', async () => {
  const { level } = await buildLevel();

  for (const colour of ['blue', 'red', 'green']) {
    level.gate.surface.splat(new THREE.Vector3(0, 3, gateZ(level)), colour, 30);
  }
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });

  assert.equal(level.gate.open, false,
    'the gate is not a paint puzzle; it is the L1 "not every obstacle is a colour" beat');
});

test('the gate sits on island B\'s exit, full width, taller than a red bounce (#37)', async () => {
  const { level } = await buildLevel();

  // It must be the island's own front edge, not a number repeated in the block.
  const [a, b, c] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);
  const bFront = b.mesh.position.z - b.height / 2;
  assert.ok(Math.abs(gateZ(level) - bFront) < 1e-6,
    `the gate should be island B's exit (${bFront}), got ${gateZ(level)}`);

  // Full width, so it cannot be walked around: the corridor is 16 wide.
  assert.equal(level.gate.surface.width, 16);

  // And tall enough that the red trampoline cannot be used to hop it.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(level.gate.surface.height > apex,
    `gate is ${level.gate.surface.height} m but a red bounce reaches ${apex.toFixed(2)} m`);
});

test('restart rebuilds the gate sealed, not left open (#37, R)', async () => {
  const { level } = await buildLevel();
  clearArena(level);
  assert.equal(level.gate.open, true);

  // main.js restarts by disposing the level and loading a new one.
  const { level: fresh } = await buildLevel();

  assert.equal(fresh.gate.open, false, 'a fresh level must start sealed');
  assert.equal(fresh.gate.surface.mesh.position.y, fresh.gate.surface.height / 2,
    'the panel must be back in the corridor, not left dropped below the world');
  assert.equal(fresh.gate.light.material.color.getHex(), PAINT.red.hex);
});
