import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Player } from '../src/core/player.js';
import { PAINT, PLAYER } from '../src/config.js';

// Encounter gates (#37 island B, #56 island C): each arena's exit is sealed
// until that arena is clear, so the fight has to be won rather than run past.
// These pin the acceptance criteria on both issues — blocks until clear, no
// soft-lock, and a clean restart — plus the geometry envelope that makes
// "blocks" true, and the one place a gate is NOT the enforcement (#56).

async function buildLevel() {
  const game = { scene: new THREE.Scene(), onWin: null };
  const level = new Level01(game);
  await level.load();
  return { level, game };
}

const gateZ = (gate) => gate.surface.mesh.position.z;
const panelBottom = (gate) => gate.surface.mesh.position.y - gate.surface.height / 2;

/** The platform is the only floor above the corridor and below the ledge. */
const platformFloor = (level) =>
  level.surfaces.find((s) => s.isFloor && s.mesh.position.y === 4);

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

/** Kill everything one gate is waiting on, then let the level tick once. */
function clearArena(level, gate) {
  for (const enemy of gate.watch) enemy.takeColourHit(1, 999);
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });
}

test('each gate watches only the enemies that spawn in its own arena (#37, #56)', async () => {
  const { level } = await buildLevel();

  assert.equal(level.gateB.open, false, 'island B starts sealed');
  assert.deepEqual(level.gateB.watch.map((e) => e.type), ['charger'],
    'island C\'s pair must not hold island B shut');
  assert.equal(level.gateC.open, false, 'island C starts sealed');
  assert.deepEqual(level.gateC.watch.map((e) => e.type).sort(), ['charger', 'sprayer'],
    'island B\'s Charger must not hold island C shut');
});

test('the island B gate blocks progress until island B is clear (#37)', async () => {
  const { level } = await buildLevel();

  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -2));
  player.onGround = true;
  const furthest = walkForward(player, 120);   // two full seconds of pushing at the exit

  assert.ok(furthest > gateZ(level.gateB),
    `the player walked out of a sealed arena: z=${furthest}`);
  assert.equal(player.touchingWall?.surface, level.gateB.surface,
    'the player should be pressed against the gate itself, not some other wall');
});

test('the island C gate blocks the way off the platform until island C is clear (#56)', async () => {
  const { level } = await buildLevel();

  // Stand on the platform, at the lip: the wall climb is the next step, and the
  // gate seals it until island C's arena is clear.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 4, -20));
  player.onGround = true;
  const furthest = walkForward(player, 120);

  assert.ok(furthest > gateZ(level.gateC),
    `the player left the platform past a sealed gate: z=${furthest}`);
  assert.equal(player.touchingWall?.surface, level.gateC.surface,
    'the player should be pressed against the gate itself, not the wall');
});

test('clearing island B opens gate B, and gate C is untouched (#37)', async () => {
  const { level } = await buildLevel();
  const sprayer = level.enemies.find((e) => e.type === 'sprayer');

  clearArena(level, level.gateB);

  assert.equal(level.gateB.open, true, 'killing the arena must open the gate');
  assert.equal(level.gateB.light.material.color.getHex(), PAINT.green.hex,
    'the lock light should read "open"');
  assert.equal(sprayer.alive, true, 'island C was never part of this fight');
  assert.equal(level.gateC.open, false, 'and island C is still sealed');

  // ...and it is open to the player, not just to the flag. 200 frames is more
  // than it takes to cross the lip, so the run ends in Gap 2 and respawns —
  // the furthest point reached is what matters, not where it finished.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -2));
  player.onGround = true;
  const furthest = walkForward(player, 200);

  assert.ok(furthest < gateZ(level.gateB),
    `the gate stayed shut: got no further than z=${furthest}`);
});

test('an enemy flung out of an arena cannot hold its gate shut (#37, #56)', async () => {
  const { level } = await buildLevel();
  const charger = level.enemies.find((e) => e.type === 'charger');

  // The soft-lock the issues warn about: a red hit flings an enemy off the
  // edge, and with no gravity it floats there ALIVE forever
  // (`enemy.js` `_applyKnockback`). A clear condition that only checks `alive`
  // would seal the level permanently.
  charger.position.set(0, 0, -11);   // mid-Gap 2, out of island B, still alive
  assert.equal(charger.alive, true);

  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });

  assert.equal(level.gateB.open, true,
    'an enemy that left the island must still release island B');

  // Same guard for island C: both of its enemies flung clear, both still alive.
  for (const e of level.gateC.watch) e.position.set(0, 0, -11);
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });

  assert.equal(level.gateC.open, true,
    'enemies that left island C must release it too');
});

test('no paint colour opens a gate — the fight is the only answer (#37, #56)', async () => {
  const { level } = await buildLevel();

  for (const gate of level.gates) {
    for (const colour of ['blue', 'red', 'green']) {
      gate.surface.splat(new THREE.Vector3(0, gate.surface.mesh.position.y, gateZ(gate)), colour, 30);
    }
  }
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });

  assert.equal(level.gateB.open, false,
    'the gate is not a paint puzzle; it is the L1 "not every obstacle is a colour" beat');
  assert.equal(level.gateC.open, false, 'and island C\'s gate is not one either');
});

test('island B\'s gate sits on island B\'s exit, full width, taller than a red bounce (#37)', async () => {
  const { level } = await buildLevel();

  // It must be the island's own front edge, not a number repeated in the block.
  const [a, b, c] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);
  const bFront = b.mesh.position.z - b.height / 2;
  assert.ok(Math.abs(gateZ(level.gateB) - bFront) < 1e-6,
    `the gate should be island B's exit (${bFront}), got ${gateZ(level.gateB)}`);

  // Full width, so it cannot be walked around: the corridor is 16 wide.
  assert.equal(level.gateB.surface.width, 16);

  // And tall enough that the red trampoline cannot be used to hop it.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(level.gateB.surface.height > apex,
    `gate is ${level.gateB.surface.height} m but a red bounce reaches ${apex.toFixed(2)} m`);
});

test('island C\'s gate sits on the platform lip and leaves no gap to crawl under (#56)', async () => {
  const { level } = await buildLevel();
  const platform = platformFloor(level);
  const lip = platform.mesh.position.z - platform.height / 2;

  // The launch off island C cannot be gated (see `_gate()`), so the gate sits on
  // the next horizontal choke point: the far lip of the platform.
  assert.ok(Math.abs(gateZ(level.gateC) - lip) < 1e-6,
    `the gate should be the platform's lip (${lip}), got ${gateZ(level.gateC)}`);
  assert.equal(level.gateC.surface.width, 16, 'full width, like every corridor barrier');

  // Its base must meet the platform: a gap underneath would be a crawl-through.
  assert.ok(Math.abs(panelBottom(level.gateC) - platform.mesh.position.y) < 1e-6,
    `the panel floats ${panelBottom(level.gateC)} above a platform at ${platform.mesh.position.y}`);

  // Taller than a red bounce taken from the platform itself.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(level.gateC.surface.height > apex,
    `gate is ${level.gateC.surface.height} m but a red bounce reaches ${apex.toFixed(2)} m`);
});

test('the extraction only fires once island C is clear — the climb-proof check (#56)', async () => {
  const { level, game } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const atExtraction = { position: new THREE.Vector3(0, 9, -27) };

  // The lip panel can be green-climbed over (climbing only needs green paint on
  // it), so standing in the extraction is NOT enough on its own (#56).
  level.update(1 / 60, atExtraction);
  assert.equal(wins, 0, 'island C was not fought, so there is no win');

  clearArena(level, level.gateC);
  assert.equal(level.gateC.open, true, 'clearing island C opens the way to the wall');
  assert.equal(level.gateC.light.material.color.getHex(), PAINT.green.hex);

  level.update(1 / 60, atExtraction);
  assert.equal(wins, 1, 'once island C is clear, the extraction fires');
});

test('clearing island C opens the lip, and the way past it is genuinely open (#56)', async () => {
  const { level } = await buildLevel();

  clearArena(level, level.gateC);
  assert.equal(level.gateC.open, true, 'clearing island C must open the lip');

  // Open to the player, not just to the flag: walking off the platform now gets
  // past the lip and down onto island C below it (the wall climb is the route
  // on from there), instead of stopping dead at z=-23.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 4, -20));
  player.onGround = true;
  const furthest = walkForward(player, 120);

  assert.ok(furthest < gateZ(level.gateC),
    `the gate stayed shut: got no further than z=${furthest}`);
});

test('restart rebuilds both gates sealed, not left open (#37, #56, R)', async () => {
  const { level } = await buildLevel();
  clearArena(level, level.gateB);
  clearArena(level, level.gateC);
  assert.equal(level.gateB.open, true);
  assert.equal(level.gateC.open, true);

  // main.js restarts by disposing the level and loading a new one.
  const { level: fresh } = await buildLevel();

  assert.equal(fresh.gateB.open, false, 'a fresh level must start sealed');
  assert.equal(fresh.gateC.open, false, 'both gates start sealed');
  assert.equal(fresh.gateB.surface.mesh.position.y, fresh.gateB.surface.height / 2,
    'the island B panel must be back in the corridor, not left dropped below the world');
  assert.ok(Math.abs(panelBottom(fresh.gateC) - platformFloor(fresh).mesh.position.y) < 1e-6,
    'the island C panel must be back on its lip');
  assert.equal(fresh.gateB.light.material.color.getHex(), PAINT.red.hex);
  assert.equal(fresh.gateC.light.material.color.getHex(), PAINT.red.hex);
});
