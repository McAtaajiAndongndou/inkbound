import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { CameraRig } from '../src/core/camera-rig.js';
import { SUBMERGE } from '../src/config.js';

/**
 * Issue 079 — the submerge camera glides instead of snapping. The rig only
 * reads position, yaw, pitch and submerged from the player, so a plain object
 * is enough. Pitch 0 keeps the camera well above the height clamp.
 */
const DT = 1 / 60;

function makePlayer() {
  return { position: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, submerged: false };
}

function run(rig, player, seconds) {
  for (let t = 0; t < seconds; t += DT) rig.update(player, DT);
  return rig.camera.position.y;
}

test('the submerge drop is eased: the first frame moves only part of the way down', () => {
  const rig = new CameraRig(1);
  const player = makePlayer();
  const standingY = run(rig, player, 0.5);

  player.submerged = true;
  rig.update(player, DT);
  const dropped = standingY - rig.camera.position.y;

  assert.ok(dropped > 0, 'the camera starts to drop on the first frame');
  assert.ok(dropped < SUBMERGE.cameraOffset * 0.5, `only part of the way: ${dropped} of ${SUBMERGE.cameraOffset}`);
});

test('held, the camera settles exactly where the hard cut used to put it', () => {
  const rig = new CameraRig(1);
  const player = makePlayer();
  const standingY = run(rig, player, 0.5);

  player.submerged = true;
  const sunkY = run(rig, player, 1);

  assert.ok(Math.abs(standingY - sunkY - SUBMERGE.cameraOffset) < 1e-4,
    `dropped ${standingY - sunkY}, expected ${SUBMERGE.cameraOffset}`);
});

test('letting go eases back up rather than snapping', () => {
  const rig = new CameraRig(1);
  const player = makePlayer();
  const standingY = run(rig, player, 0.5);

  player.submerged = true;
  const sunkY = run(rig, player, 1);

  player.submerged = false;
  rig.update(player, DT);
  const firstFrameY = rig.camera.position.y;
  assert.ok(firstFrameY > sunkY, 'it starts rising on the first frame');
  assert.ok(firstFrameY < standingY - SUBMERGE.cameraOffset * 0.5, 'but only part of the way');

  const backY = run(rig, player, 1);
  assert.ok(Math.abs(backY - standingY) < 1e-4, 'and settles back at standing height');
});
