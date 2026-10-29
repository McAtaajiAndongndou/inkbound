import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Enemy, fitModelToHeight, findClip, sampledMinY } from '../src/enemies/enemy.js';
import { ENEMY } from '../src/config.js';

/**
 * #116 — the remaining enemy models, measured rather than assumed.
 *
 * `node --test` has no server, so `preloadEnemyModel` cannot fetch. GLTFLoader
 * can still PARSE a .glb from an ArrayBuffer, which is what makes these tests
 * worth having: every number below is read out of the shipped file on every run.
 * A test that asserted "the drainer has a model" without opening it would pass
 * forever with the file missing, wrong, or the wrong download entirely.
 *
 * The three files are the same Quaternius zombie pack as the wall-crawler
 * (#114), so they share its rig and its `CharacterArmature|` clip prefix, and
 * they are measurable with the same helpers.
 */

/** The GLB keys a level or a spawn names, and where their file lives. */
const MODELS = {
  drainer: 'public/assets/zombie-drainer.glb',
  chargerZombie: 'public/assets/zombie-charger.glb',
  bigArm: 'public/assets/zombie-big-arm.glb',
};

/**
 * What each type MUST be able to play. Copied from `CLIPS`/`FEET_CLIP` in
 * enemy.js on purpose rather than imported: the point is to fail if someone
 * edits the map to a clip these files do not have.
 */
const REQUIRED_CLIPS = {
  drainer: ['Idle', 'Walk', 'Punch', 'Crawl'],
  chargerZombie: ['Idle', 'Run', 'Run_Attack'],
  bigArm: ['Idle', 'Walk', 'Punch'],
};

const FEET_CLIP = { drainer: 'Crawl', chargerZombie: 'Walk', bigArm: 'Walk' };

/** Height the loader will fit each model to. Big Arm is the boss exception. */
const FITTED_HEIGHT = { drainer: 1.6, chargerZombie: 1.6, bigArm: 2.4 };

function load(path) {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab, '', resolve, reject);
  });
}

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(MODELS).map(async ([type, path]) => [type, await load(path)]),
  ),
);

function bounds(object) {
  const box = new THREE.Box3().setFromObject(object);
  return { minY: box.min.y, height: box.max.y - box.min.y, width: box.max.x - box.min.x };
}

function skinnedCount(object) {
  let n = 0;
  object.traverse((o) => { if (o.isSkinnedMesh) n += 1; });
  return n;
}

// --- it is a real, skinned model ---------------------------------------------

for (const type of Object.keys(MODELS)) {
  test(`${type}: the shipped file is a skinned model, not a box`, () => {
    const gltf = loaded[type];

    assert.ok(skinnedCount(gltf.scene) > 0, 'no SkinnedMesh in the file');
    assert.ok(gltf.animations.length > 0, 'no clips in the file');
    assert.ok(bounds(gltf.scene).height > 0.5, 'a model under half a metre is the wrong download');

    // The whole point of `findClip` (#114): this pack prefixes clips with the
    // rig name, and a pack that does not prefix them must also work.
    assert.ok(
      findClip(gltf.animations, 'Idle'),
      `no Idle clip among ${gltf.animations.length} — check the download`,
    );
  });
}

// --- every clip the map asks for exists in the file ---------------------------

for (const [type, names] of Object.entries(REQUIRED_CLIPS)) {
  test(`${type}: every clip the code will ask for exists`, () => {
    const gltf = loaded[type];
    const missing = names.filter((n) => !findClip(gltf.animations, n));

    assert.deepEqual(missing, [], `missing from ${MODELS[type]}`);
  });
}

// --- it stands on the floor ---------------------------------------------------

for (const type of Object.keys(MODELS)) {
  test(`${type}: fitted, its feet are on y = 0 in the clip it walks in`, () => {
    const gltf = loaded[type];
    const clip = findClip(gltf.animations, FEET_CLIP[type]);
    assert.ok(clip, `no "${FEET_CLIP[type]}" clip to measure the floor from`);

    // The floor comes from the clip, not the bind pose (#114): a crouch, a crawl
    // or a stride all reach lower than the pose the file was exported in.
    const floorY = sampledMinY(gltf.scene, clip);
    const { scale, feetOffset } = fitModelToHeight(
      gltf.scene, FITTED_HEIGHT[type], floorY,
    );

    // Where the lowest point ends up after the fit: scaled into world units,
    // then lifted by `feetOffset`, exactly as `_buildModel` does it.
    const lowest = floorY * scale + feetOffset;

    assert.ok(
      Math.abs(lowest) < 0.02,
      `${type} feet at ${lowest.toFixed(3)} m, not 0 — it floats or sinks`,
    );
  });
}

// --- the specific things the issue asks for -----------------------------------

/** A model's size in world units after the fit the loader will apply. */
function fittedSize(type) {
  const gltf = loaded[type];
  const b = bounds(gltf.scene);
  const floorY = sampledMinY(gltf.scene, findClip(gltf.animations, FEET_CLIP[type]));
  const { scale } = fitModelToHeight(gltf.scene, FITTED_HEIGHT[type], floorY);
  return { width: b.width * scale, height: b.height * scale };
}

test('bigArm: fitted, it is big enough to read as a boss across the arena', () => {
  const s = fittedSize('bigArm');

  // The design note is explicit: "if it needs a health bar to communicate its
  // importance, the model choice was wrong". Size is what carries that, so both
  // dimensions are pinned — 2.4 m tall and nearly 3 m of arm.
  assert.ok(s.height > 2.2, `only ${s.height.toFixed(2)} m tall`);
  assert.ok(s.width > 2.4, `only ${s.width.toFixed(2)} m wide`);
});

test('bigArm is not just a scaled-up soldier', () => {
  // The manual check is "tell which is the boss from 30 m". A boss that is only
  // a bigger version of the rank and file fails that at distance, so the gap in
  // size has to be obvious, not proportional.
  const boss = fittedSize('bigArm');
  const soldier = fittedSize('chargerZombie');

  assert.ok(
    boss.width > soldier.width * 1.5,
    `boss ${boss.width.toFixed(2)} m vs soldier ${soldier.width.toFixed(2)} m wide`,
  );
  assert.ok(
    boss.height > soldier.height * 1.4,
    `boss ${boss.height.toFixed(2)} m vs soldier ${soldier.height.toFixed(2)} m tall`,
  );
});

test('drainer: crawling is a different posture, not a different model', () => {
  const gltf = loaded.drainer;
  const crawl = sampledMinY(gltf.scene, findClip(gltf.animations, 'Crawl'));
  const idle = sampledMinY(gltf.scene, findClip(gltf.animations, 'Idle'));

  // Crawl has to reach LOWER than the upright pose, or "two postures" is a lie
  // and the feeding state would be the standing one renamed.
  assert.ok(
    crawl < idle - 0.02,
    `crawl floor ${crawl.toFixed(3)} vs idle ${idle.toFixed(3)} — no posture change`,
  );
});

test('bigArm binds ABOVE its origin, which is why the box alone is not enough', () => {
  // Measured: min.y +0.176 on a 1.464 m model. Fit it from the box and the clip
  // drops it through the floor by that much. This pins the file, so a
  // re-export that changes it shows up here rather than in the arena.
  const b = bounds(loaded.bigArm.scene);

  assert.ok(b.minY > 0.1, `bind-pose min.y ${b.minY.toFixed(3)} — re-measure FEET_CLIP`);
});

// --- the drainer's two postures ----------------------------------------------
// These need no GLB: `_animate` only ever reads `_feeding` and the clip slots,
// so a fake mixer is enough to prove which posture it asks for. That is also the
// only way to test it, because the real mixer needs a model the loader cannot
// fetch under `node --test`.
//
// `_feeding` is #80's flag (config.drainsPaint), not `_awareness`: the drain
// landed before this did, so the pose follows whether the Drainer is eating
// rather than whether it has seen you. #116 originally keyed it on awareness as
// a placeholder for exactly this handover.

function fakeAction(name) {
  return {
    name,
    reset() { return this; },
    play() { return this; },
    crossFadeTo() {},
  };
}

/** The box body plus a pretend mixer, so `_animate` can be read directly. */
function withFakeAnimation(config) {
  const enemy = new Enemy({
    position: new THREE.Vector3(),
    config,
    parent: new THREE.Group(),
    floors: [],
  });
  enemy._anim = {
    mixer: { update() {} },
    idle: fakeAction('idle'),
    run: fakeAction('run'),
    attack: fakeAction('attack'),
    crawl: fakeAction('crawl'),
    current: null,
  };
  return enemy;
}

test('drainer: it is on its belly while it feeds, then rises to hunt', () => {
  const enemy = withFakeAnimation(ENEMY.drainer);

  enemy._feeding = true;
  enemy._animate(1 / 60);
  assert.equal(enemy._anim.current.name, 'crawl', 'a feeding drainer is face down');

  enemy._feeding = false;
  enemy._animate(1 / 60);
  assert.notEqual(enemy._anim.current.name, 'crawl', 'a hunting drainer is on its feet');
});

test('a type with no crawl clip is never put on its belly', () => {
  const enemy = withFakeAnimation(ENEMY.charger);
  enemy._anim.crawl = null;   // what `CLIPS.charger` produces: no crawl slot

  enemy._feeding = true;
  enemy._animate(1 / 60);

  assert.equal(enemy._anim.current.name, 'idle');
});