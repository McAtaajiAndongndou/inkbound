import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { PLAYER, SURFACE } from '../src/config.js';

/**
 * A single floor that reads as the given surface rules everywhere.
 * Enough to drive Player.update() without loading L1.
 */
function makeFloor(surfaceRules) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial(),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);

  return {
    mesh,
    width: 200,
    height: 200,
    isFloor: true,
    surfaceAtWorld: () => surfaceRules,
    paintIdAtWorld: () => 0,
    splat: () => {},
  };
}

function newPlayerOn(floor) {
  const p = new Player([floor], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  return p;
}

function runFor(player, seconds) {
  const input = { isDown: (k) => k === 'KeyW', aiming: false };
  const actions = { jump: false };
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) player.update(1 / 60, input, actions);
}

function planarSpeed(player) {
  const { x, z } = player.velocity;
  return Math.sqrt(x * x + z * z);
}

test('grey is measurably slower than blue (#74)', () => {
  const greyPlayer = newPlayerOn(makeFloor(SURFACE.grey));
  runFor(greyPlayer, 2);
  const greySpeed = planarSpeed(greyPlayer);

  const bluePlayer = newPlayerOn(makeFloor(SURFACE.blue));
  runFor(bluePlayer, 2);
  const blueSpeed = planarSpeed(bluePlayer);

  assert.ok(
    greySpeed < blueSpeed * 0.85,
    `grey (${greySpeed.toFixed(2)}) must be measurably slower than blue (${blueSpeed.toFixed(2)})`,
  );
});

test('stepping off grey restores speed immediately (#74)', () => {
  const greyPlayer = newPlayerOn(makeFloor(SURFACE.grey));
  runFor(greyPlayer, 2);
  const greySpeed = planarSpeed(greyPlayer);

  // swap the surface under the player to blue, keep everything else the same
  const blueFloor = makeFloor(SURFACE.blue);
  greyPlayer.floors = [blueFloor];
  greyPlayer.surfaces = [blueFloor];

  runFor(greyPlayer, 2);
  const after = planarSpeed(greyPlayer);

  assert.ok(
    after > greySpeed * 1.2,
    `stepping onto blue should speed back up: grey ${greySpeed.toFixed(2)} -> ${after.toFixed(2)}`,
  );
});

test('earned blue does not carry over onto grey (#74, #52)', () => {
  // Step 1: earn the blue boost on blue
  const bluePlayer = newPlayerOn(makeFloor(SURFACE.blue));
  runFor(bluePlayer, 2);
  const blueSpeed = planarSpeed(bluePlayer);
  assert.ok(
    blueSpeed > PLAYER.maxSpeed,
    `blue should give more than base speed: ${blueSpeed.toFixed(2)} vs ${PLAYER.maxSpeed}`,
  );

  // Step 2: swap to grey. Running there must give GREY's speed, not blue's.
  const greyFloor = makeFloor(SURFACE.grey);
  bluePlayer.floors = [greyFloor];
  bluePlayer.surfaces = [greyFloor];
  runFor(bluePlayer, 2);
  const greySpeed = planarSpeed(bluePlayer);

  // The blue boost must not have survived the swap.
  assert.ok(
    greySpeed < PLAYER.maxSpeed * 0.85,
    `grey must be measurably slower than base even after earning blue: ${greySpeed.toFixed(2)} vs base ${PLAYER.maxSpeed}`,
  );

  // And it must be the SAME slow speed you'd get without having touched blue.
  const freshGrey = newPlayerOn(makeFloor(SURFACE.grey));
  runFor(freshGrey, 2);
  const freshGreySpeed = planarSpeed(freshGrey);
  assert.ok(
    Math.abs(greySpeed - freshGreySpeed) < 0.05,
    `grey's slow speed must be identical whether or not blue was earned: ${greySpeed.toFixed(2)} vs ${freshGreySpeed.toFixed(2)}`,
  );
});