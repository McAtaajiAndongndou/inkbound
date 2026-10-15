import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { PLAYER, SURFACE } from '../src/config.js';

// Speed cap = momentum you keep, not the tile under you (#52).
// Floors are built here, not taken from Level01, because this is a player
// contract and the level geometry is expected to move.

const STEP = 1 / 60;
const noJump = { jump: false };
const holdForward = { isDown: (k) => k === 'KeyW' };
const holdNothing = { isDown: () => false };

const planarSpeed = (p) => Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);

/** A flat floor centred at (0, y, z), optionally painted edge to edge. */
function floor(width, height, z, colour, y = 0) {
  const s = new PaintSurface({ width, height, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(0, y, z);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  if (colour) s.splat(new THREE.Vector3(0, y, z), colour, Math.max(width, height));
  return s;
}

/**
 * Run forward off the far (-z) edge and report the speed once airborne.
 * Stops before the player hits killY and respawns (which resets the cap).
 */
function runOffTheEdge(player, { frames = 900, maxAirborne = 40 } = {}) {
  let groundedPeak = 0;
  let airborne = 0;
  let minAirborneSpeed = Infinity;

  for (let i = 0; i < frames; i++) {
    player.update(STEP, holdForward, noJump);
    const speed = planarSpeed(player);

    if (player.onGround) {
      groundedPeak = Math.max(groundedPeak, speed);
    } else {
      airborne++;
      minAirborneSpeed = Math.min(minAirborneSpeed, speed);
      if (airborne >= maxAirborne) break;
    }
  }

  return { groundedPeak, airborne, minAirborneSpeed, speedCap: player.speedCap };
}

test('blue grants speed above base, and the player keeps it over a void (#52)', () => {
  const island = floor(12, 12, 0, 'blue');
  const p = new Player([island], new THREE.Vector3(0, 0, 5));
  p.onGround = true;

  const run = runOffTheEdge(p);

  assert.ok(run.groundedPeak > PLAYER.maxSpeed, `blue should beat base speed, peaked at ${run.groundedPeak}`);
  assert.ok(run.airborne >= 40, 'the run should have left the island behind');

  // over the void there is no surface — blue's speed must not die at the lip
  assert.ok(
    run.minAirborneSpeed > PLAYER.maxSpeed,
    `blue died over the void (slowest airborne frame was ${run.minAirborneSpeed.toFixed(2)} m/s)`,
  );
  assert.equal(run.speedCap, PLAYER.maxSpeed * SURFACE.blue.speedScale);
});

test('grey still caps the player at base — no accidental global buff (#52)', () => {
  const island = floor(12, 12, 0, 'grey');
  const p = new Player([island], new THREE.Vector3(0, 0, 5));
  p.onGround = true;

  const run = runOffTheEdge(p);

  // on grey the player never even reaches the base cap: friction wins first
  assert.ok(run.groundedPeak < PLAYER.maxSpeed, `grey reached ${run.groundedPeak}`);
  assert.equal(run.speedCap, PLAYER.maxSpeed);
});

test('a red pad flings the speed built on ice instead of cancelling it (#52)', () => {
  const island = floor(12, 12, 0, 'blue');
  // red pad in the last stretch, where the super jump launches
  island.splat(new THREE.Vector3(0, 0, -4.5), 'red', 2);

  const p = new Player([island], new THREE.Vector3(0, 0, 5));
  p.onGround = true;

  let launchSpeed = null;
  let iceSpeed = 0;

  for (let i = 0; i < 400; i++) {
    p.update(STEP, holdForward, noJump);
    // no jump pressed, so any upward speed above jumpSpeed is the trampoline
    if (launchSpeed === null && p.velocity.y > PLAYER.jumpSpeed) {
      launchSpeed = planarSpeed(p);
    }
    if (launchSpeed === null) iceSpeed = Math.max(iceSpeed, planarSpeed(p));
  }

  assert.ok(iceSpeed > PLAYER.maxSpeed, `expected to build ice speed first, got ${iceSpeed}`);
  assert.ok(launchSpeed !== null, 'the red pad should have launched the player');
  assert.ok(
    launchSpeed > PLAYER.maxSpeed,
    `red cancelled the ice speed at the bounce (launched at ${launchSpeed.toFixed(2)} m/s)`,
  );
  assert.ok(
    launchSpeed > iceSpeed * 0.98,
    `the pad lost too much speed: ${iceSpeed.toFixed(2)} in, ${launchSpeed.toFixed(2)} out`,
  );
});

/** Run at a gap holding forward, and press jump on the last grounded frame. */
function attemptGap({ colour, gap, pad = null, bDepth = 12 }) {
  const bEnd = -bDepth / 2;
  const islandB = floor(12, bDepth, 0, colour);
  if (pad) islandB.splat(new THREE.Vector3(0, 0, bEnd + pad.fromEdge), 'red', pad.radius);

  const islandC = floor(12, 12, bEnd - gap - 6, 'grey');

  const p = new Player([islandB, islandC], new THREE.Vector3(0, 0, bDepth / 2 - 1));
  p.onGround = true;

  let jumped = false;
  for (let i = 0; i < 900; i++) {
    const jump = !jumped && p.onGround && p.position.z <= bEnd;
    if (jump) jumped = true;
    p.update(STEP, holdForward, { jump });

    if (p.position.y < -6) return { cleared: false, travelled: null };
    if (jumped && p.onGround && p.position.z < bEnd - gap) {
      return { cleared: true, travelled: bEnd - p.position.z };
    }
  }
  return { cleared: false, travelled: null };
}

test('design envelope: blue alone falls short of the Gap 2 width, red clears it (#53)', () => {
  // Gap 2 is 9 m: blue alone must fall short, blue + red must clear. If a tune
  // ever lets blue cross it, the red pad becomes decoration — so this guards
  // the level design, not just the physics.
  const blueAlone = attemptGap({ colour: 'blue', gap: 9 });
  assert.equal(blueAlone.cleared, false, 'blue alone must NOT cross 9 m, or red is pointless');

  const withPad = attemptGap({ colour: 'blue', gap: 9, pad: { fromEdge: 0.5, radius: 1 } });
  assert.equal(withPad.cleared, true, 'blue + a red pad at the lip must clear 9 m');
  assert.ok(withPad.travelled >= 9, `expected to clear 9 m, travelled ${withPad.travelled}`);
});
