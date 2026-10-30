// #225 (QA B11, quality plan §5): the camera had no position smoothing and no
// collision. Now its follow is a critically damped spring, the aim stays 1:1
// with the mouse, and a wall between the shoulder and the camera pulls it in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { CameraRig } from '../src/core/camera-rig.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { CAMERA } from '../src/config.js';

const FRAME = 1 / 60;

function player(x = 0, y = 0, z = 0) {
  return { position: new THREE.Vector3(x, y, z), yaw: 0, pitch: 0, submerged: false, velocity: new THREE.Vector3() };
}

const dir = (rig) => rig.camera.getWorldDirection(new THREE.Vector3());

test('#225: the camera eases after the player instead of welding to them', () => {
  const rig = new CameraRig(16 / 9);
  const p = player();
  rig.update(p, FRAME);
  const start = rig.camera.position.clone();
  p.position.x += 1;                       // a step sideways
  rig.update(p, FRAME);
  const moved = rig.camera.position.x - start.x;
  assert.ok(moved > 0 && moved < 0.9, `one frame moved the camera ${moved.toFixed(2)} m of 1 m`);
  for (let i = 0; i < 30; i++) rig.update(p, FRAME);
  assert.ok(Math.abs(rig.camera.position.x - start.x - 1) < 0.01, 'and it arrives within half a second, no overshoot left');
});

test('#225: the aim does not lag the mouse — rotation is never damped', () => {
  const rig = new CameraRig(16 / 9);
  const reference = new CameraRig(16 / 9);
  const p = player();
  rig.update(p, FRAME);
  p.position.x += 1;                       // the follow is mid-ease...
  p.yaw = 0.7;                             // ...when the mouse turns
  p.pitch = 0.2;
  rig.update(p, FRAME);
  reference.update(p, 0);                  // a rig with no history: the undamped aim
  assert.ok(dir(rig).angleTo(dir(reference)) < 1e-6, 'same yaw and pitch, same aim direction');
});

test('#225: a teleport (load, respawn) snaps instead of sweeping across the level', () => {
  const rig = new CameraRig(16 / 9);
  const p = player();
  rig.update(p, FRAME);
  p.position.set(0, 0, -50);
  rig.update(p, FRAME);
  const fresh = new CameraRig(16 / 9);
  fresh.update(p, 0);
  assert.ok(rig.camera.position.distanceTo(fresh.camera.position) < 1e-6);
});

/** A wall `behind` m behind the player (the camera's side, +z), facing them. */
function wallBehind(behind) {
  const w = new PaintSurface({ width: 20, height: 10, cells: 1 });
  w.mesh.position.set(0, 2, behind);
  w.mesh.rotation.y = Math.PI;             // face -z: toward the player
  w.mesh.updateMatrixWorld(true);
  return w;
}

test('#225: a wall between the shoulder and the camera pulls it in front of the wall', () => {
  const rig = new CameraRig(16 / 9);
  const p = player();
  rig.update(p, FRAME);
  assert.ok(rig.camera.position.z > 3, 'without a wall the camera sits about 5 m back');
  rig.setColliders([wallBehind(2).mesh]);
  rig.update(p, FRAME);
  assert.ok(rig.camera.position.z < 2, `camera at z=${rig.camera.position.z.toFixed(2)}, the wall is at z=2`);
});

test('#225: pulled in at once, eased back out once the wall is gone', () => {
  const rig = new CameraRig(16 / 9);
  const p = player();
  rig.setColliders([wallBehind(2).mesh]);
  rig.update(p, FRAME);
  const inZ = rig.camera.position.z;
  rig.setColliders([]);
  rig.update(p, FRAME);
  const oneFrameOut = rig.camera.position.z;
  assert.ok(oneFrameOut > inZ && oneFrameOut < inZ + 1, 'it does not snap back out');
  for (let i = 0; i < 60; i++) rig.update(p, FRAME);
  assert.ok(rig.camera.position.z > 3, 'and it is all the way out after a second');
});

test('#225: third person is wider, and wider again while swimming', () => {
  const rig = new CameraRig(16 / 9);
  const p = player();
  for (let i = 0; i < 120; i++) rig.update(p, FRAME);
  assert.ok(Math.abs(rig.camera.fov - CAMERA.tpvFov) < 0.1);
  p.submerged = true;
  p.velocity.set(4, 0, 0);
  for (let i = 0; i < 120; i++) rig.update(p, FRAME);
  assert.ok(Math.abs(rig.camera.fov - (CAMERA.tpvFov + CAMERA.submergeFovBoost)) < 0.1);
  rig.setAiming(true);
  for (let i = 0; i < 120; i++) rig.update(p, FRAME);
  assert.ok(Math.abs(rig.camera.fov - CAMERA.adsFov) < 0.1, 'aiming is unchanged');
});
