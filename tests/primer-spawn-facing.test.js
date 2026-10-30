// Quality plan B4: "you start facing a wall". The Primer spawned the player 2 m
// in front of the start wall, and the third-person camera sits 5 m behind them,
// so the first frame was the back of that wall. The camera must start in the room.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';

const { CameraRig } = await import('../src/core/camera-rig.js');
const { Player } = await import('../src/core/player.js');

/** The play camera on the first frame, as main.js sets it up. */
async function firstFrame() {
  const level = new Level00({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  const player = new Player(level.surfaces, level.spawn);
  const facing = level.spawnFacing;
  if (facing) { player.yaw = facing.yaw; player.pitch = facing.pitch; }
  const rig = new CameraRig(16 / 9);
  rig.update(player, 0);
  return { level, player, camera: rig.camera };
}

test('B4: nothing stands between the Primer spawn and its first-frame camera', async () => {
  const { level, player, camera } = await firstFrame();
  const chest = player.position.clone().setY(player.position.y + 1.2);
  const toCamera = camera.position.clone().sub(chest);
  const ray = new THREE.Raycaster(chest, toCamera.clone().normalize(), 0, toCamera.length());
  const meshes = [];
  level.root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) meshes.push(o); });
  const blocked = ray.intersectObjects(meshes, false);
  assert.equal(blocked.length, 0, `the camera starts behind something ${blocked[0]?.distance.toFixed(2)} m from the player`);
  level.dispose();
});
