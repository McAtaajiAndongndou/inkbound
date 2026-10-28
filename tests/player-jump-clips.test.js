import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as avatarModule from '../src/shaders/avatar.js';

const CLIPS_FILE = 'public/assets/player-jump.clips.json';
const SOLDIER_FILE = 'public/assets/soldier-swat.glb';

// The library's own clip lengths, measured off UAL1_Standard.glb. If the bake
// ever silently truncates a clip, these are what catch it.
const EXPECTED_SECONDS = { Jump_Start: 1.33, Jump_Loop: 2.5, Jump_Land: 1.27 };
const BONE_COUNT = 61;

const LIBRARY_CLIPS = avatarModule.LIBRARY_CLIPS ?? {};

const raw = JSON.parse(readFileSync(CLIPS_FILE, 'utf8'));
const clips = raw.map((c) => THREE.AnimationClip.parse(c));

const soldierPromise = new Promise((resolve, reject) => {
  const buf = readFileSync(SOLDIER_FILE);
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', resolve, reject);
});

const boneNames = async () => {
  const gltf = await soldierPromise;
  const names = new Set();
  gltf.scene.traverse((o) => {
    if (o.isBone) names.add(o.name);
  });
  return names;
};

test('the player rig ships the jump clips the library was bought for', () => {
  assert.deepEqual(Object.keys(LIBRARY_CLIPS).sort(), ['jumpLand', 'jumpLoop', 'jumpStart']);
  const names = clips.map((c) => c.name).sort();
  assert.deepEqual(names, Object.values(LIBRARY_CLIPS).sort());
});

test('each clip keeps the library original length', () => {
  for (const clip of clips) {
    const want = EXPECTED_SECONDS[clip.name];
    assert.ok(want, `unexpected clip ${clip.name}`);
    assert.ok(
      Math.abs(clip.duration - want) < 0.02,
      `${clip.name} is ${clip.duration.toFixed(2)}s, the library's is ${want}s`,
    );
  }
});

test('every bone the clips name exists on the player rig', async () => {
  const bones = await boneNames();
  const missing = new Set();
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const bone = track.name.split('.')[0];
      if (!bones.has(bone)) missing.add(bone);
    }
  }
  assert.deepEqual([...missing], [], 'a track bound to a bone this rig does not have would simply not move');
});

test('every clip drives the whole skeleton, not a partial one', () => {
  for (const clip of clips) {
    assert.equal(clip.tracks.length, BONE_COUNT, `${clip.name} drives ${clip.tracks.length} of ${BONE_COUNT} bones`);
    for (const track of clip.tracks) {
      assert.ok(track.name.endsWith('.quaternion'), `${track.name} is not a rotation track`);
    }
  }
});

test('the baked rotations are real rotations', () => {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const v = track.values;
      for (let i = 0; i < v.length; i += 4) {
        const len = Math.hypot(v[i], v[i + 1], v[i + 2], v[i + 3]);
        assert.ok(Math.abs(len - 1) < 2e-3, `${track.name} sample ${i / 4} has length ${len.toFixed(4)}`);
      }
    }
  }
});

test('played on the player rig, no clip folds, flattens or buries the character', async () => {
  const gltf = await soldierPromise;
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const meshes = [];
  const bones = new Map();
  scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
    if (o.isBone) bones.set(o.name, o);
  });
  assert.ok(meshes.length > 0, 'the player model is expected to be skinned');
  assert.ok(bones.has('Head') && bones.has('Body'), 'the cheap standing-up check needs Head and Body');

  const mixer = new THREE.AnimationMixer(scene);
  const v = new THREE.Vector3();

  const poseAt = (t) => {
    mixer.setTime(t);
    scene.updateMatrixWorld(true);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position;
      mesh.skeleton.update();
      for (let i = 0; i < pos.count; i += 5) {
        v.fromBufferAttribute(pos, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    }
    const head = bones.get('Head').getWorldPosition(new THREE.Vector3());
    const hips = bones.get('Body').getWorldPosition(new THREE.Vector3());
    const up = head.sub(hips).normalize().dot(new THREE.Vector3(0, 1, 0));
    return { minY, height: maxY - minY, up };
  };

  for (const clip of clips) {
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().play();
    for (let i = 0; i <= 4; i++) {
      const { minY, height, up } = poseAt((clip.duration * i) / 4);
      // Bind height is 1.82 m. A bad retarget shows up as a 90 degree turn
      // (height collapses) or as the feet dropping through the floor.
      assert.ok(height > 1.3 && height < 2.1, `${clip.name} at ${i}/4 is ${height.toFixed(2)}m tall`);
      assert.ok(minY > -0.25, `${clip.name} at ${i}/4 sinks to ${minY.toFixed(2)}m through the floor`);
      assert.ok(up > 0.4, `${clip.name} at ${i}/4 has the spine ${up.toFixed(2)} aligned with up, i.e. folded over`);
    }
  }
});

test('the asset stays small enough to be worth shipping', () => {
  const bytes = readFileSync(CLIPS_FILE).length;
  assert.ok(bytes < 600 * 1024, `${(bytes / 1024).toFixed(0)} KB of clips is a download nobody asked for`);
});