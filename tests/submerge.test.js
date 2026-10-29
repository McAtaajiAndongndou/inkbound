import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Player } from '../src/core/player.js';
import { SUBMERGE, PLAYER } from '../src/config.js';

/**
 * A floor that reports whatever paint id we pass in, and a paintSurface that
 * answers `isPlayerPaintAtWorld` the way the real one does. Enough to drive
 * Player.update() without loading a level.
 */
function makeFloor(paintId) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial(),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.updateMatrixWorld(true);

  // SURFACE rules: pure grey has standSlow 0.6, anything painted is normal.
  const rules = paintId === 0
    ? { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 0.6 }
    : { friction: 10, traction: 1, speedScale: 1, restitution: 0, climbable: false, standSlow: 1.0 };

  return {
    mesh,
    width: 200,
    height: 200,
    isFloor: true,
    surfaceAtWorld: () => rules,
    paintIdAtWorld: () => paintId,
    isPlayerPaintAtWorld: () => paintId !== 0,
    splat: () => {},
  };
}

function makeInput({ submergeHeld = false, aiming = false } = {}) {
  return {
    isDown: (code) => code === SUBMERGE.key && submergeHeld,
    aiming,
  };
}

function runFor(player, input, seconds) {
  const actions = { jump: false };
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) player.update(1 / 60, input, actions);
}

function planarSpeed(player) {
  return Math.hypot(player.velocity.x, player.velocity.z);
}

test('a fresh player is not submerged (#108)', () => {
  const p = new Player([makeFloor(1)], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  assert.equal(p.submerged, false);
});

test('holding the key on your own paint submerges (#108)', () => {
  const p = new Player([makeFloor(1)], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  runFor(p, makeInput({ submergeHeld: true }), 0.1);
  assert.equal(p.submerged, true);
});

test('holding the key on grey does nothing — the state requires your paint (#108)', () => {
  const p = new Player([makeFloor(0)], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  runFor(p, makeInput({ submergeHeld: true }), 0.1);
  assert.equal(p.submerged, false);
});

test('releasing the key drops the state the same frame (#108)', () => {
  const p = new Player([makeFloor(1)], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  runFor(p, makeInput({ submergeHeld: true }), 0.1);
  assert.equal(p.submerged, true);

  runFor(p, makeInput({ submergeHeld: false }), 1 / 60);
  assert.equal(p.submerged, false);
});

test('submerged movement is faster than standing on the same paint (#108)', () => {
  // Standing: only W held.
  const standing = new Player([makeFloor(1)], new THREE.Vector3(0, 0, 0));
  standing.onGround = true;
  const standInput = {
    isDown: (code) => code === 'KeyW',
    aiming: false,
  };
  runFor(standing, standInput, 2);
  const standingSpeed = planarSpeed(standing);

  // Submerged: W AND the submerge key held. `update()` recomputes
  // `this.submerged` from the input every frame, so the input MUST report
  // the key as held — setting `submerged.submerged = true` before the loop
  // gets overwritten on the first frame.
  const submerged = new Player([makeFloor(1)], new THREE.Vector3(0, 0, 0));
  submerged.onGround = true;
  const submergedInput = {
    isDown: (code) => code === 'KeyW' || code === SUBMERGE.key,
    aiming: false,
  };
  runFor(submerged, submergedInput, 2);
  const submergedSpeed = planarSpeed(submerged);

  assert.equal(submerged.submerged, true,
    'the submerged player should have `submerged === true` after 2 s of holding the key');
  assert.ok(
    submergedSpeed > standingSpeed * 1.1,
    `submerged (${submergedSpeed.toFixed(2)}) should be measurably faster than standing (${standingSpeed.toFixed(2)})`,
  );
});

test('stepping off your own paint while submerged drops the state that frame (#108)', () => {
  const paintFloor = makeFloor(1);
  const p = new Player([paintFloor], new THREE.Vector3(0, 0, 0));
  p.onGround = true;
  runFor(p, makeInput({ submergeHeld: true }), 0.1);
  assert.equal(p.submerged, true);

  // Swap the surface under the player to grey without changing anything else
  p.surfaces = [makeFloor(0)];
  p.floors = [p.surfaces[0]];
  runFor(p, makeInput({ submergeHeld: true }), 1 / 60);
  assert.equal(p.submerged, false);
});

test('the config exists and is sane (#108)', () => {
  assert.equal(typeof SUBMERGE.key, 'string', 'submerge key must be a string');
  assert.ok(SUBMERGE.speedMultiplier > 1, 'submerge must be FASTER than walking');
  assert.ok(SUBMERGE.refillMultiplier > 1, 'submerge must refill faster');
  assert.ok(SUBMERGE.cameraOffset > 0, 'camera must lower by a positive amount');
});