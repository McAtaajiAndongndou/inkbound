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

test('each gate watches only the enemies that belong to its own arena (#37, #56)', async () => {
  const { level } = await buildLevel();

  assert.equal(level.gateB.open, false, 'island B starts sealed');
  assert.deepEqual(level.gateB.watch.map((e) => e.type), ['charger'],
    'island C\'s enemies must not hold island B shut');

  assert.equal(level.gateC.open, false, 'island C starts sealed');
  // Island C's door watches the ARENA FLOOR only — the two that rush you. The two
  // shooters up the right-hand pillar are not part of it: they stand on the only
  // landing you can bounce to, so there is nothing to run past.
  assert.deepEqual(level.gateC.watch.map((e) => e.type).sort(),
    ['charger', 'sprayer'],
    `island C's door watches the arena floor only, got ${level.gateC.watch.map((e) => e.type)}`);
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

test('the island C gate blocks the arena exit until island C is clear (#56, #39 #6)', async () => {
  const { level } = await buildLevel();

  // Stand in the arena, in front of the tower doorway. It seals the way in until
  // island C's arena is clear — the door is the only route, so the fight has to
  // be won rather than run past.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -21));
  player.onGround = true;
  const furthest = walkForward(player, 120);

  assert.ok(furthest > gateZ(level.gateC),
    `the player got into the tower past a sealed gate: z=${furthest}`);
  assert.equal(player.touchingWall?.surface, level.gateC.surface,
    'the player should be pressed against the gate itself, not a tower face');
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
  // The Charger that BELONGS to island B, not merely the first one in the list —
  // island A has had its own Charger since #011.
  const charger = level.gateB.watch.find((e) => e.type === 'charger');
  assert.ok(charger, 'island B should be watching a Charger');

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

  // Full width, so it cannot be walked around. Read off the corridor's own floor
  // rather than a literal: the width is a design number that has already changed
  // once (#39 #5 widened the corridor 16 -> 22), and what this test actually
  // cares about is that the barrier SPANS it, not what it measures.
  assert.equal(level.gateB.surface.width, a.width,
    'a gate narrower than the corridor is a gate you can walk around');

  // And tall enough that the red trampoline cannot be used to hop it.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(level.gateB.surface.height > apex,
    `gate is ${level.gateB.surface.height} m but a red bounce reaches ${apex.toFixed(2)} m`);
});

test('island C\'s gate is the tower doorway and leaves no gap to crawl under (#56, #39 #6)', async () => {
  const { level } = await buildLevel();

  // It sits on the arena's own back edge, at the foot of the tower — a DOORWAY,
  // with the structure either side of it, rather than a pane standing in mid-air
  // on a platform lip. That change is #39 #3 and #6 together.
  const [a, b, c] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);
  const cBack = c.mesh.position.z - c.height / 2;
  assert.ok(Math.abs(gateZ(level.gateC) - cBack) < 1e-6,
    `the gate should be island C's back edge (${cBack}), got ${gateZ(level.gateC)}`);

  // Full width, like every corridor barrier — again read off the corridor itself.
  const corridorWidth = Math.max(...level.surfaces.filter((s) => s.isFloor).map((s) => s.width));
  assert.equal(level.gateC.surface.width, corridorWidth,
    'full width, like every corridor barrier');

  // Its base must meet the arena floor: a gap underneath would be a crawl-through.
  assert.ok(Math.abs(panelBottom(level.gateC) - c.mesh.position.y) < 1e-6,
    `the panel floats ${panelBottom(level.gateC)} above a floor at ${c.mesh.position.y}`);

  // Taller than a red bounce taken from the floor.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(level.gateC.surface.height > apex,
    `gate is ${level.gateC.surface.height} m but a red bounce reaches ${apex.toFixed(2)} m`);
});

/**
 * #39 #3: the bypass that the old gate doc comment admitted to and papered over.
 *
 * Every barrier in this game is a PaintSurface, and every PaintSurface used to be
 * paintable — so painting a gate green made it climbable and a determined player
 * could go over the top. `unpaintable` closes that at the source, and this pins
 * it: a gate must refuse paint AND therefore report grey's rules (not climbable).
 */
test('a gate cannot be painted green and climbed over (#39 #3)', async () => {
  const { level } = await buildLevel();

  for (const gate of level.gates) {
    const surface = gate.surface;
    const point = new THREE.Vector3(0, surface.mesh.position.y, gateZ(gate));

    for (const colour of ['green', 'blue', 'red']) {
      assert.equal(surface.splat(point, colour, 30), false,
        `a ${colour} splat was accepted by a gate — the door is climbable again`);
    }

    assert.equal(surface.paintIdAtWorld(point), 0, 'a gate must stay grey');
    assert.equal(surface.surfaceAtWorld(point).climbable, false,
      'grey is the one rule set with climbable false, and that is what unpaintable means');
  }
});

test('the extraction only fires once island C is clear — the climb-proof check (#56)', async () => {
  const { level, game } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const atExtraction = { position: new THREE.Vector3(6, 12, -43.5) };

  // The arena is what gates the win, and it is checked separately from the door's
  // collision entirely: `_arenaCleared` cannot be painted, climbed or walked
  // around, so it is the enforcement whatever happens to the geometry (#56).
  level.update(1 / 60, atExtraction);
  assert.equal(wins, 0, 'island C was not fought, so there is no win');

  clearArena(level, level.gateC);
  assert.equal(level.gateC.open, true, 'clearing island C opens the door');
  assert.equal(level.gateC.light.material.color.getHex(), PAINT.green.hex);

  level.update(1 / 60, atExtraction);
  assert.equal(wins, 1, 'once island C is clear, the extraction fires');
});

test('clearing island C opens the door, and the way past it is genuinely open (#56)', async () => {
  const { level } = await buildLevel();

  clearArena(level, level.gateC);
  assert.equal(level.gateC.open, true, 'clearing island C must open the door');

  // Open to the player, not just to the flag: walking into the doorway now gets
  // through it and on down the tower's ground floor, instead of stopping dead.
  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, -21));
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

  // Island C's door sits on the arena floor now, not on a platform lip (#39 #6).
  const arenaC = fresh.surfaces.find((s) => s.isFloor && s.mesh.position.y === 0
    && Math.abs(s.mesh.position.z - (-20)) < 1e-6);
  assert.ok(Math.abs(panelBottom(fresh.gateC) - arenaC.mesh.position.y) < 1e-6,
    'the island C panel must be back on the arena floor');
  assert.equal(fresh.gateB.light.material.color.getHex(), PAINT.red.hex);
  assert.equal(fresh.gateC.light.material.color.getHex(), PAINT.red.hex);
});
