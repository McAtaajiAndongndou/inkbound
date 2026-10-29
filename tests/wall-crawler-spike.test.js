import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Namespace import on purpose: `findClip` and `sampledMinY` do not exist on the
// commit before #114, and a NAMED import of a missing binding is a module-level
// crash — every test would fail for the same uninformative reason. Through the
// namespace each one fails on its own assertion instead, which is what a
// fails-before run is supposed to prove.
import * as enemyModule from '../src/enemies/enemy.js';

const { fitModelToHeight } = enemyModule;
const findClip = enemyModule.findClip ?? (() => undefined);
const sampledMinY = enemyModule.sampledMinY ?? (() => 0);

const ASSET = 'public/assets/wall-crawler.glb';

/**
 * #114 — the one-GLB spike, before bulk-downloading the rest of the zombies.
 *
 * `node --test` has no server, so `preloadEnemyModel` cannot fetch. GLTFLoader
 * can still PARSE a .glb from an ArrayBuffer, which means the real asset can be
 * measured in the suite rather than assumed: these tests read the shipped file.
 *
 * That matters because every claim below is a measurement of this file. A test
 * that asserted "there are 9 clips" without opening it would pass forever while
 * the model was missing.
 */
const gltfPromise = new Promise((resolve, reject) => {
  const buf = readFileSync(ASSET);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  new GLTFLoader().parse(ab, '', resolve, reject);
});

function skinnedMeshes(object) {
  const found = [];
  object.traverse((o) => { if (o.isSkinnedMesh) found.push(o); });
  return found;
}

// --- the lookup that broke ---------------------------------------------------

test('findClip resolves a clip behind any rig prefix, not just "Armature|"', () => {
  const clips = [{ name: 'CharacterArmature|Idle' }, { name: 'CharacterArmature|Crawl' }];
  assert.equal(findClip(clips, 'Crawl')?.name, 'CharacterArmature|Crawl');
});

test('findClip leaves the soldier names working unchanged', () => {
  const clips = [{ name: 'Armature|Rifle@Aim' }, { name: 'Armature|Rifle@Run.001' }];
  assert.equal(findClip(clips, 'Rifle@Aim')?.name, 'Armature|Rifle@Aim');
});

test('findClip prefers an exact match over a prefix match', () => {
  const clips = [{ name: 'Rig|Idle' }, { name: 'Idle' }];
  assert.equal(findClip(clips, 'Idle')?.name, 'Idle');
});

test('findClip returns nothing for a clip the pack does not ship', () => {
  // The wall-crawler has no attack clip at all; this is how the code finds out.
  assert.equal(findClip([{ name: 'CharacterArmature|Idle' }], 'Attack'), undefined);
  assert.equal(findClip(undefined, 'Idle'), undefined);
  assert.equal(findClip([{ name: 'CharacterArmature|Idle' }], undefined), undefined);
});

// --- the asset ---------------------------------------------------------------

test('the wall-crawler GLB loads and is a SkinnedMesh', async () => {
  const gltf = await gltfPromise;
  const skinned = skinnedMeshes(gltf.scene);
  assert.equal(skinned.length, 1, 'exactly one skinned mesh');
  // The point of the spike: the soldiers have NO skin, so this is the first
  // bone-deformed mesh in the project and the first real test of the pipeline.
  assert.ok(skinned[0].skeleton.bones.length >= 10, 'a real skeleton, not a stub');
});

test('every clip the enemy asks for exists on the rig', async () => {
  const gltf = await gltfPromise;
  for (const name of ['Idle', 'Crawl', 'Jump']) {
    assert.ok(findClip(gltf.animations, name), `missing clip "${name}"`);
  }
});

test('it costs one draw call and stays inside the download budget', async () => {
  const gltf = await gltfPromise;
  const meshes = skinnedMeshes(gltf.scene);
  assert.equal(meshes.length, 1, 'one skinned mesh = one draw call');
  assert.equal(gltf.animations.length, 9);

  const bytes = readFileSync(ASSET).length;
  assert.ok(bytes < 400 * 1024, `${(bytes / 1024).toFixed(0)} KB is over the 400 KB budget`);
});

// --- the floor, which is where a skinned model differs -----------------------

test('the crawl clip reaches below the bind-pose floor', async () => {
  const gltf = await gltfPromise;
  const crawl = findClip(gltf.animations, 'Crawl');
  const dip = sampledMinY(gltf.scene, crawl);

  // Measured: the bind pose stands on y = -0.009, the crawl plants at -0.039.
  // If a future asset change removes that difference this test should be
  // revisited rather than silently kept — the number IS the finding.
  assert.ok(dip < -0.02, `crawl bottomed at y=${dip.toFixed(3)}, expected below -0.02`);
});

test('fitting to the bind pose alone would sink the crawler, so the fit is told where the floor is', async () => {
  const gltf = await gltfPromise;
  const scene = gltf.scene;
  const crawl = findClip(gltf.animations, 'Crawl');

  const blind = fitModelToHeight(scene, 1.6);
  const dip = sampledMinY(scene, crawl);
  const sinking = dip * blind.scale + blind.feetOffset;
  assert.ok(sinking < -0.02, `bind-pose fit puts the crawl ${sinking.toFixed(3)} m under the floor`);

  const aware = fitModelToHeight(scene, 1.6, dip);
  const resting = dip * aware.scale + aware.feetOffset;
  assert.ok(Math.abs(resting) < 1e-9, `told about the clip, the crawl rests at y=${resting}`);
});

test('once fitted, no clip the enemy plays sinks more than 2 cm', async () => {
  const gltf = await gltfPromise;
  const scene = gltf.scene;
  const dip = sampledMinY(scene, findClip(gltf.animations, 'Crawl'));
  // Pair the negative with a positive: if the measurement silently returned 0
  // the assertions below would all pass while proving nothing.
  assert.ok(dip < -0.02, 'the dip has to be measured before "no sink" means anything');
  const { scale, feetOffset } = fitModelToHeight(scene, 1.6, dip);

  const model = cloneSkinned(scene);
  model.scale.setScalar(scale);
  model.position.y = feetOffset;
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);

  for (const name of ['Idle', 'Crawl', 'Jump']) {
    const lowest = sampledMinY(model, findClip(gltf.animations, name));
    assert.ok(
      lowest > -0.02,
      `"${name}" reaches y=${lowest.toFixed(3)} — the character is through the floor`
    );
  }
});

test('the fitted model is the height the enemy system asks for', async () => {
  const gltf = await gltfPromise;
  const { scale } = fitModelToHeight(gltf.scene, 1.6);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  assert.ok(Math.abs((box.max.y - box.min.y) * scale - 1.6) < 1e-6);
});

// --- the pure maths, for the models that come after this one -----------------

test('a skinned model with no clips measures as no dip', () => {
  assert.equal(sampledMinY(undefined, undefined), 0);
  assert.equal(sampledMinY(new THREE.Group(), { duration: 1 }), 0);
});

test('an empty model still fits without being flung out of the world', () => {
  const { scale, feetOffset } = fitModelToHeight(new THREE.Group(), 1.6, -Infinity);
  assert.equal(scale, 1);
  assert.equal(feetOffset, 0);
});
