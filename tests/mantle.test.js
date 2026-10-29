import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { MANTLE, PLAYER } from '../src/config.js';

/**
 * A wall is a vertical plane. Local axes: +X is width, +Y is height, +Z is
 * the normal (facing out of the wall toward the climber).
 *
 * We orient it by its mesh.position and mesh.quaternion. The default plane
 * (rotation 0) has normal +Z, which is the side the player stands on — the
 * "front" that _resolveWalls tests against.
 */
function makeWall({ x = 0, z = 0, yBottom = 0, width = 20, height = 10, paintId = 3 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial(),
  );
  // The plane's LOCAL +Z is its normal. If we want the front face pointing
  // toward -Z in world (so a player at z = -5 is in front of it), we rotate
  // 180° around Y. Simplest: leave rotation at identity and place the wall
  // so its normal points at the player. Caller controls position; rotation
  // is 0, so normal is world +Z, and the player approaches from -Z.
  mesh.position.set(x, yBottom + height / 2, z);
  mesh.updateMatrixWorld(true);

  const rules = paintId === 0
    ? { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 0.6 }
    : { friction: 14, traction: 1, speedScale: 1, restitution: 0, climbable: true, standSlow: 1.0 };

  return {
    mesh,
    width,
    height,
    isFloor: false,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => paintId,
    isPlayerPaintAtWorld: () => paintId !== 0,
    splat: () => {},
  };
}

function makeFloor({ x = 0, y = 0, z = 0, paintId = 1, size = 200 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial(),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld(true);

  const rules = paintId === 0
    ? { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 0.6 }
    : { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 1.0 };

  return {
    mesh,
    width: size,
    height: size,
    isFloor: true,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => paintId,
    isPlayerPaintAtWorld: () => paintId !== 0,
    splat: () => {},
  };
}

/** Input: only W held (so the player pushes into the wall). */
function climbInput() {
  return {
    isDown: (code) => code === 'KeyW',
    aiming: false,
  };
}

function runFor(player, input, seconds) {
  const actions = { jump: false };
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) player.update(1 / 60, input, actions);
}

/**
 * Set the player climbing a wall by placing them in contact with it, facing
 * into it, mid-climb. The mantle check runs inside update() after this setup
 * is consumed by the physics.
 *
 * Convention: wall normal is +Z. Player stands at -Z of the wall (i.e. the
 * wall is in front of them, they push toward +Z). Wall is at z = 0, player at
 * z = -(PLAYER.radius) so their back is just outside the wall face.
 */
function makeClimberOn(wall, feetY) {
  const surfaces = [wall];
  const p = new Player(surfaces, new THREE.Vector3(0, feetY, -PLAYER.radius));
  // The player is facing +Z (toward the wall): yaw = π so _fwd = (0, 0, +1)? No —
  // _fwd = (-sin(yaw), 0, -cos(yaw)). For fwd = (0,0,+1), cos(yaw) = -1, yaw = π.
  p.yaw = Math.PI;
  // Pre-state: mid-climb, off the ground.
  p.onGround = false;
  p.climbing = true;
  // Velocity straight up, at the climb speed.
  p.velocity.set(0, PLAYER.climbSpeed, 0);
  return p;
}

// ---------------------------------------------------------------------------
// #157 — Mantle. A green climb ends by pulling the player onto the top
// surface. Only fires within reach of the top. Auto, not a button.
// ---------------------------------------------------------------------------

test('a climber on a flush-topped wall ends standing on top (#157)', () => {
  // Wall at z = 0, from y = 0 to y = 10. Floor at y = 10 covering the top,
  // extending toward the player (so it can be landed on — this is the "flush"
  // top; no lip that sticks out further than the player can reach).
  const wall = makeWall({ yBottom: 0, height: 10 });
  const top = makeFloor({ y: 10, z: -1, paintId: 1 });  // floor sits just over the edge
  const surfaces = [wall, top];

  const p = new Player(surfaces, new THREE.Vector3(0, 9.5, -PLAYER.radius));
  p.yaw = Math.PI;
  p.onGround = false;
  p.velocity.set(0, PLAYER.climbSpeed, 0);

  // Run long enough to climb to the top (0.5 m at 4.5 m/s = ~0.11 s) and then
  // mantle (0.25 s). 1 s is plenty.
  runFor(p, climbInput(), 1.0);

  assert.ok(p.position.y >= 9.99,
    `player should end on top (y ≈ 10), got y = ${p.position.y}`);
  assert.equal(p.mantling, false, 'mantle must have finished, not still in progress');
  assert.equal(p.onGround, true, 'player should be on the ground after the mantle');
});

test('mantle does not fire mid-wall, only within reach of the top (#157)', () => {
  // Wall from 0 to 10, but start the player at feet y = 3 (still mid-wall).
  // With no top floor nearby, the mantle must NOT trigger even though the
  // player is climbing.
  const wall = makeWall({ yBottom: 0, height: 10 });
  const top = makeFloor({ y: 10, z: -1, paintId: 1 });
  const p = new Player([wall, top], new THREE.Vector3(0, 3, -PLAYER.radius));
  p.yaw = Math.PI;
  p.onGround = false;
  p.velocity.set(0, PLAYER.climbSpeed, 0);

  // Short window: 0.3 s should not reach the top from y = 3.
  runFor(p, climbInput(), 0.3);

  assert.equal(p.mantling, false,
    'mantle must not fire mid-wall');
  assert.ok(p.position.y < 9.5,
    `player should still be climbing, got y = ${p.position.y}`);
});

test('mantle does not fire with no floor at the top (#157)', () => {
  // Wall from 0 to 10, but no floor at the top.
  const wall = makeWall({ yBottom: 0, height: 10 });
  const p = new Player([wall], new THREE.Vector3(0, 9.5, -PLAYER.radius));
  p.yaw = Math.PI;
  p.onGround = false;
  p.velocity.set(0, PLAYER.climbSpeed, 0);

  runFor(p, climbInput(), 0.5);

  assert.equal(p.mantling, false,
    'mantle must not fire when there is no surface to land on');
});

test('a wall-jump off mid-climb still works exactly as today (#157)', () => {
  const wall = makeWall({ yBottom: 0, height: 10 });
  const top = makeFloor({ y: 10, z: -1, paintId: 1 });
  const p = new Player([wall, top], new THREE.Vector3(0, 4, -PLAYER.radius));
  p.yaw = Math.PI;
  p.onGround = false;
  p.velocity.set(0, PLAYER.climbSpeed, 0);

  // Climb to establish contact, then jump.
  runFor(p, climbInput(), 0.1);
  assert.equal(p.climbing, true, 'should be climbing before the jump');

  // Jump this frame.
  p.update(1 / 60, climbInput(), { jump: true });

  // The wall-jump push is negative Z (away from the wall). The player should
  // now be moving away from the wall and airborne, not mantling.
  assert.equal(p.mantling, false, 'wall-jump must not become a mantle');
  assert.ok(p.velocity.z < 0,
    `wall-jump should push away from the wall (velocity.z < 0), got ${p.velocity.z}`);
});

test('mantle respects existing lips — a climb with a wide lip still works (#157)', () => {
  // Wall from 0 to 10, floor at y = 10 with a 1 m lip extending toward the
  // player. The player would land on the lip even without mantle. Mantle
  // must not break that.
  const wall = makeWall({ yBottom: 0, height: 10 });
  const lip = makeFloor({ y: 10, z: -1, paintId: 1, size: 20 });
  const p = new Player([wall, lip], new THREE.Vector3(0, 9.5, -PLAYER.radius));
  p.yaw = Math.PI;
  p.onGround = false;
  p.velocity.set(0, PLAYER.climbSpeed, 0);

  runFor(p, climbInput(), 1.0);

  assert.ok(p.position.y >= 9.99,
    `player should end on top, got y = ${p.position.y}`);
  assert.equal(p.onGround, true);
});

test('mantle height and duration live in config (#157)', () => {
  assert.equal(typeof MANTLE.reach, 'number', 'MANTLE.reach must exist');
  assert.equal(typeof MANTLE.inward, 'number', 'MANTLE.inward must exist');
  assert.equal(typeof MANTLE.duration, 'number', 'MANTLE.duration must exist');
  assert.ok(MANTLE.reach > 0 && MANTLE.reach < 2,
    'reach should be sub-player-height: 0 < reach < 2');
  assert.ok(MANTLE.duration > 0.1 && MANTLE.duration < 0.6,
    'duration should be short: 0.1 < duration < 0.6');
});