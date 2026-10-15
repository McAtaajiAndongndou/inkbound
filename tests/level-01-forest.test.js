import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Level01 } from '../src/levels/level-01-mission.js';
import { FOREST, collectVariants } from '../src/levels/forest.js';

/** Same shape the other level tests use: a bare game object, no renderer. */
async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  return level;
}

/**
 * The .glb files, read off disk and parsed without a server.
 *
 * `GLTFLoader.parse` needs no DOM and no network, so this is the REAL asset
 * pipeline running in the test suite: the actual shipped files, the actual
 * loader, the actual baking code. Only the HTTP request is skipped. That matters
 * because every interesting thing about these files is an artefact of the export
 * (a x100 scale, a Z-up node, five trees in a strip) and a hand-built stub would
 * happily agree with my own misunderstanding of it.
 */
function parseGlb(url) {
  // `FOREST.models` holds RUNTIME urls, and Vite serves `public/` at the root —
  // so `./assets/trees/pine.glb` is the right thing to ask the browser for and
  // the wrong thing to hand to readFileSync. Same convention as the avatar's
  // `./assets/soldier-swat.glb`.
  const path = url.replace(/^\.\//, 'public/');
  const buffer = readFileSync(path);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
}

/** A level whose models load for real; `forest.pending` has settled on return. */
async function buildLevelWithModels() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null, loadGLB: parseGlb });
  await level.load();
  await level.forest.pending;
  return level;
}

function findTrees(level) {
  const trees = [];
  level.root.traverse((o) => { if (o.userData?.tree) trees.push(o); });
  return trees;
}

/**
 * A tree over a gap floats in mid-air, and with the gaps no longer filled with
 * fog colour that is the first thing a player would notice. Placement is a hand-
 * written table, so it needs a machine watching it.
 */
test('every tree stands on a floor, never over a gap', async () => {
  const level = await buildLevel();
  const trees = findTrees(level);
  assert.ok(trees.length >= 15, `expected a forest, found ${trees.length}`);

  const floors = level.surfaces.filter((s) => s.isFloor);
  const point = new THREE.Vector3();

  for (const tree of trees) {
    point.set(tree.position.x, tree.position.y, tree.position.z);
    // worldToCell is the level's OWN "is this point on this surface" API — the
    // same one the paint gun and the physics probe use, so this test cannot
    // drift away from what the game actually treats as a floor.
    const under = floors.find((s) => s.worldToCell(point) !== null);
    assert.ok(under,
      `tree floats over a gap at (${point.x}, ${point.y}, ${point.z})`);
  }
});

/**
 * Per-tree geometry or material would be ~38 geometries and ~38 materials for no
 * reason. This pins the "build one, share it" rule from the plan, which is what
 * keeps the forest free rather than a frame-rate problem on lab hardware.
 *
 * The reaction to paint (step 3) is what makes this worth re-stating: the
 * obvious way to write it is a cloned material per tree, and that quietly
 * triples the material count. A tree must point at one of the SHARED palette
 * materials and nothing else.
 */
test('the forest shares its geometry, and swaps between shared palette materials', async () => {
  const level = await buildLevel();
  const geometries = new Set();
  const materials = new Set();

  for (const tree of findTrees(level)) {
    for (const part of tree.children) {
      geometries.add(part.geometry);
      materials.add(part.material);
    }
  }

  assert.equal(geometries.size, 2, 'one canopy shape + one trunk shape, shared by all');
  assert.ok(materials.size <= 2,
    `${materials.size} materials in use at load; only the grey canopy is drawn before painting`);

  const palette = new Set(level.forest.materials);
  for (const material of materials) {
    assert.ok(palette.has(material),
      'every tree material must be one of the shared palette materials, not a per-tree clone');
  }
});

/**
 * Trees are decoration. The moment one is a PaintSurface the player controller
 * would treat it as something to stand on and collide with, which could block
 * the Gap 1 jump or trap the player against the Charger.
 */
test('trees are decoration, not physics', async () => {
  const level = await buildLevel();
  const trees = findTrees(level);

  let paintable = 0;
  for (const tree of trees) {
    tree.traverse((o) => { if (o.userData?.paintSurface) paintable++; });
  }

  assert.equal(paintable, 0, 'a tree must never be a PaintSurface, or it collides');
  assert.equal(level.surfaces.filter((s) => s.userData?.tree).length, 0);
});

/**
 * The ground does not read scene lights — it reads its own `uLightDir` uniform,
 * whose shader default is only NEARLY the sun's vector. So "the ground and the
 * props are lit from the same side" (#57) is a wiring problem, not a lighting
 * one, and the wiring happens in one place at the end of load().
 *
 * The trees are covered here because they were the actual MISS: the first
 * version of this test walked `level.surfaces` only, so the trees kept
 * `createToonMaterial`'s own default direction — (0.5, 1.0, 0.3) normalised to
 * (0.431, 0.863, 0.259) against the sun's (0.485, 0.808, 0.323) — and every
 * tree in the level was lit from somewhere the ground was not.
 *
 * The literal below mirrors main.js (`sun.position.set(18, 30, 12)`), which a
 * test cannot import because it is a module with side effects.
 */
test('the ground, the walls, the gates and the trees are lit from the same direction (#57)', async () => {
  const level = await buildLevel();
  const expected = new THREE.Vector3(18, 30, 12).normalize();

  assert.ok(level.surfaces.length > 0);
  for (const surface of level.surfaces) {
    const uniform = surface.material.uniforms.uLightDir;
    assert.ok(uniform, 'a paint surface with no uLightDir cannot be lit at all');
    assert.ok(
      uniform.value.distanceTo(expected) < 1e-6,
      `surface lit from [${uniform.value.toArray()}], the sun is [${expected.toArray()}]`,
    );
  }

  assert.ok(level.forest.materials.length >= 2, 'the forest must expose its materials');
  for (const material of level.forest.materials) {
    const uniform = material.uniforms.uLightDir;
    assert.ok(uniform, 'a tree material with no uLightDir cannot be lit at all');
    assert.ok(
      uniform.value.distanceTo(expected) < 1e-6,
      `tree lit from [${uniform.value.toArray()}], the sun is [${expected.toArray()}]`,
    );
    // and it must not be the shader's own default wearing the sun's name
    assert.ok(uniform.value.distanceTo(new THREE.Vector3(0.5, 1.0, 0.3).normalize()) > 1e-6,
      'the tree is still on createToonMaterial\'s default direction');
  }
});

// --- step 3: the forest wakes up where the player paints ---------------------

/** The heartbeat is a timer, not a flag — drive it far enough to fire. */
const HEARTBEAT = FOREST.reactInterval + 0.01;

function islandATree(level) {
  return level.forest.trees.find((t) => t.floor && t.mesh.position.z > 8);
}

test('painting the ground turns the trees standing on it (#57 step 3)', async () => {
  const level = await buildLevel();
  const tree = islandATree(level);
  assert.ok(tree, 'expected a tree on the spawn island');
  assert.equal(tree.canopy.material, level.forest.canopy.grey,
    'an unpainted world has a drained canopy');

  const base = tree.mesh.position;
  tree.floor.splat(new THREE.Vector3(base.x, base.y, base.z), 'blue', 3);

  level.update(HEARTBEAT, { position: new THREE.Vector3(base.x, 2, base.z) });

  assert.equal(tree.canopy.material, level.forest.canopy.blue,
    'the canopy must read the paint it is standing on');
});

test('each paint colour has its own canopy, and they are not the drained one', async () => {
  const level = await buildLevel();

  const seen = new Set();
  for (const name of ['blue', 'red', 'green']) {
    const material = level.forest.canopy[name];
    assert.ok(material, `no canopy material for ${name}`);
    assert.notEqual(material, level.forest.canopy.grey);
    seen.add(material.uniforms.uColour.value.getHex());
  }

  assert.equal(seen.size, 3, 'blue, red and green must look different from each other');
  assert.equal(seen.has(level.forest.canopy.grey.uniforms.uColour.value.getHex()), false);
});

test('the trunk never changes — only the canopy is repainted', async () => {
  const level = await buildLevel();
  const tree = islandATree(level);
  const trunk = tree.mesh.children.find((c) => c.material === level.forest.bark);

  const base = tree.mesh.position;
  tree.floor.splat(new THREE.Vector3(base.x, base.y, base.z), 'green', 3);
  level.update(HEARTBEAT, { position: new THREE.Vector3(base.x, 2, base.z) });

  assert.equal(tree.canopy.material, level.forest.canopy.green);
  assert.equal(trunk.material, level.forest.bark, 'a green tree is a green canopy, not a green tree');
});

/**
 * The reaction is deliberately local. Without the radius every tree in the level
 * would be re-checked and re-coloured from wherever the player happens to be,
 * which reads as the whole forest being on a switch rather than the ground the
 * player actually painted.
 */
test('trees far from the player keep their colour', async () => {
  const level = await buildLevel();
  const tree = islandATree(level);

  const base = tree.mesh.position;
  tree.floor.splat(new THREE.Vector3(base.x, base.y, base.z), 'red', 3);

  // the player is on the far ledge, well outside FOREST.reactRadius
  level.update(HEARTBEAT, { position: new THREE.Vector3(0, 9, -27) });

  assert.equal(tree.canopy.material, level.forest.canopy.grey,
    'a tree past reactRadius must not be repainted');
});

test('a tree only pays for a material swap when the colour actually changed', async () => {
  const level = await buildLevel();
  const tree = islandATree(level);
  const base = tree.mesh.position;
  const player = { position: new THREE.Vector3(base.x, 2, base.z) };

  tree.floor.splat(new THREE.Vector3(base.x, base.y, base.z), 'blue', 3);
  assert.ok(level.forest.update(1, player) > 0, 'the first heartbeat reports the change');

  // nothing was painted since, so the next heartbeat is a no-op — the point of
  // tracking `paintName` per tree instead of reassigning every time
  assert.equal(level.forest.update(1, player), 0,
    'a second heartbeat with no new paint must change nothing');
});

/**
 * The heartbeat is an accumulator, not a "last checked at" timestamp, so a
 * restart or a frame hitch cannot make the forest catch up by running the loop
 * dozens of times in one frame.
 */
test('many tiny frames do not fire the heartbeat early', async () => {
  const level = await buildLevel();
  const tree = islandATree(level);
  const base = tree.mesh.position;
  const player = { position: new THREE.Vector3(base.x, 2, base.z) };

  tree.floor.splat(new THREE.Vector3(base.x, base.y, base.z), 'blue', 3);

  // half a heartbeat in 30 slices — still under the interval, so no change
  for (let i = 0; i < 30; i++) level.update(FOREST.reactInterval / 60, player);
  assert.equal(tree.canopy.material, level.forest.canopy.grey);

  level.update(FOREST.reactInterval, player);
  assert.equal(tree.canopy.material, level.forest.canopy.blue);
});

// --- steps 4 and 5: the real models, instanced ------------------------------

/**
 * The asset pipeline, run against the real files.
 *
 * Each shipped .glb is a pack, not a model: five trees laid out in a strip along
 * X, each holding a bark and a leaf primitive. Getting this wrong is silent —
 * group them by the wrong node and you get one "variant" ten primitives wide and
 * a forest where every tree is five trees stacked on top of each other.
 */
test('every shipped tree file yields five complete tree shapes (#57 step 4)', async () => {
  for (const url of FOREST.models) {
    const variants = collectVariants(await parseGlb(url));

    assert.ok(variants.length >= FOREST.maxVariants,
      `${url} should hold at least ${FOREST.maxVariants} variants, found ${variants.length}`);

    for (const [i, variant] of variants.entries()) {
      assert.ok(variant.trunk, `${url} variant ${i} has no bark primitive`);
      assert.ok(variant.canopy, `${url} variant ${i} has no leaf primitive`);
      assert.ok(variant.trunk[0].geometry.attributes.position.count > 0);
      assert.ok(variant.canopy[0].geometry.attributes.position.count > 0);
    }
  }
});

/**
 * The three things the FBX export got wrong, undone by the bake. Each one is
 * checked against the REAL file, because each one is a property of that file:
 * the strip offset (x = 172…221), the x100 node scale, and a pivot that is
 * somewhere different on every variant.
 */
test('baked models stand on y=0, centred, at the height the design asked for', async () => {
  const level = await buildLevelWithModels();

  assert.equal(level.forest.variants.length, FOREST.maxVariants);
  assert.ok(level.forest.modelCount > 0, 'the trees should have moved onto the models');

  for (const variant of level.forest.variants) {
    for (const part of [variant.trunk, variant.canopy]) {
      const box = new THREE.Box3().setFromBufferAttribute(part.attributes.position);

      // the canopy sits ON the trunk, so only the trunk proves the base is at 0
      if (part === variant.trunk) {
        assert.ok(Math.abs(box.min.y) < 1e-4,
          `a trunk base hovered at y=${box.min.y}; the strip pivot was not undone`);
      }
      // and the strip offset is gone: nothing may live 170 metres from its origin
      assert.ok(Math.abs(box.min.x) < 20 && Math.abs(box.max.x) < 20,
        `variant still sits at its strip position, x=${box.min.x}..${box.max.x}`);
    }

    const trunkBox = new THREE.Box3().setFromBufferAttribute(variant.trunk.attributes.position);
    assert.ok(trunkBox.max.y <= FOREST.modelHeight + 1e-4,
      'a variant is taller than the height it was normalised to');
  }
});

test('the models replace the cones rather than standing beside them (#57 step 5)', async () => {
  const level = await buildLevelWithModels();
  const forest = level.forest;

  assert.equal(forest.fallback.visible, false,
    'the fallback cones must be hidden, or every tree is drawn twice');
  assert.ok(forest.models.children.length > 0);
  assert.equal(forest.trees.every((t) => t.bucket !== null), true,
    'every tree must be sitting in an instanced bucket');
  assert.equal(forest.modelCount, forest.trees.length);
});

/**
 * The draw-call budget, pinned. This is the whole point of step 5: the forest's
 * cost must not scale with the number of trees. One InstancedMesh per variant
 * per paint colour, plus one per variant for the trunks — which share a single
 * material that never changes, so they are one call each rather than four.
 */
test('the forest costs a fixed number of draw calls per variant (#57 step 5)', async () => {
  const level = await buildLevelWithModels();
  const forest = level.forest;
  const colours = Object.keys(forest.canopy).length;

  assert.equal(forest.models.children.length, forest.variants.length * (1 + colours));
  assert.ok(forest.models.children.every((m) => m.isInstancedMesh),
    'every model draw call must be an InstancedMesh');

  // and the count is the budget, not the tree count: it is the same number
  // whether the level holds twenty trees or two hundred
  const perVariant = forest.models.children.length / forest.variants.length;
  assert.equal(perVariant, 1 + colours);
});

test('only the buckets in use are drawn', async () => {
  const level = await buildLevelWithModels();
  const forest = level.forest;

  const grey = forest.trees.filter((t) => t.paintName === 'grey');
  for (const bucket of forest.buckets) {
    for (const colour of ['blue', 'red', 'green']) {
      assert.equal(bucket[colour].live, 0, `nothing is painted ${colour} yet`);
      assert.equal(bucket[colour].mesh.count, 0,
        'a bucket nothing is in must not be submitted to the GPU at all');
    }
  }
  assert.equal(grey.length, forest.trees.length);
});

/**
 * The reaction has to survive the upgrade: step 5 must not quietly delete step 3.
 * With models in place a tree changes colour by MOVING between buckets, because
 * the toon shader cannot do per-instance colour — so this is the test that the
 * swap-remove free list actually keeps its books.
 */
test('painting still works once the trees are models (#57 step 3 + 5)', async () => {
  const level = await buildLevelWithModels();
  const forest = level.forest;

  const tree = forest.trees.find((t) => t.floor && t.z > 8 && t.variant >= 0);
  const base = new THREE.Vector3(tree.x, tree.y, tree.z);
  tree.floor.splat(base, 'blue', 3);

  const buckets = forest.buckets[tree.variant];
  const greyBefore = buckets.grey.live;
  const totalBefore = forest.buckets.reduce(
    (sum, set) => sum + Object.keys(forest.canopy).reduce((n, c) => n + set[c].live, 0), 0);
  const changed = level.forest.update(1, { position: new THREE.Vector3(tree.x, 2, tree.z) });

  assert.ok(changed > 0, 'the heartbeat should have repainted something');
  assert.equal(tree.paintName, 'blue');
  assert.equal(tree.bucket, buckets.blue, 'the tree must have moved into the blue bucket');
  assert.ok(buckets.blue.live > 0);
  assert.ok(buckets.grey.live < greyBefore,
    'and it must have LEFT the grey bucket, not been copied into both');

  // conservation: a move is one out and one in, at every repaint
  const totalAfter = forest.buckets.reduce(
    (sum, set) => sum + Object.keys(forest.canopy).reduce((n, c) => n + set[c].live, 0), 0);
  assert.equal(totalAfter, totalBefore, 'no tree may be lost or duplicated by a bucket move');
});

/**
 * Swap-remove is easy to get subtly wrong, and the failure is invisible: the
 * buckets stay the right SIZE while trees inside them swap places. So this walks
 * several colour changes and checks the invariant directly — every tree is in
 * exactly one canopy bucket, and the bucket agrees about where.
 */
test('every tree is in exactly one bucket, however often it is repainted', async () => {
  const level = await buildLevelWithModels();
  const forest = level.forest;
  const tree = forest.trees.find((t) => t.floor && t.variant >= 0);

  for (const colour of ['blue', 'red', 'green', 'blue']) {
    tree.floor.splat(new THREE.Vector3(tree.x, tree.y, tree.z), colour, 4);
    forest.update(1, { position: new THREE.Vector3(tree.x, 2, tree.z) });

    let found = 0;
    for (const bucket of forest.buckets) {
      for (const name of Object.keys(forest.canopy)) {
        const slot = bucket[name].slots.indexOf(tree);
        if (slot === -1) continue;
        found += 1;
        assert.equal(tree[bucket[name].slotField], slot,
          `bucket says ${slot}, the tree says ${tree[bucket[name].slotField]}`);
        assert.ok(slot < bucket[name].live, 'a tree must not sit past the live count');
      }
    }
    assert.equal(found, 1, `the tree is in ${found} buckets after being painted ${colour}`);
  }
});

test('a tree that fails to load leaves a forest standing, not a hole (#57 step 4)', async () => {
  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: () => Promise.reject(new Error('offline')),
  });
  await level.load();
  await level.forest.pending;

  assert.equal(level.forest.modelCount, 0);
  assert.equal(level.forest.fallback.visible, true, 'the cones must still be showing');
  assert.ok(level.forest.trees.length >= 15);
  assert.equal(level.forest.trees.every((t) => t.bucket === null), true,
    'and every tree must still be on the fallback path');
});

/**
 * The "R race" from the plan: pressing R while the models are in flight rebuilds
 * the level, and the load then resolves against a level that no longer exists.
 * Attaching the result there puts a forest on screen that nothing will ever
 * remove, because dispose() has already run.
 */
test('a model load that finishes after the level died is dropped (#57 step 4)', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: async (url) => { await gate; return parseGlb(url); },
  });
  await level.load();

  const forest = level.forest;
  level.dispose();          // R, mid-download
  release();                // ...and the files arrive
  const loaded = await forest.pending;

  assert.equal(loaded, 0, 'a dead level must not adopt the models');
  assert.equal(forest.models.children.length, 0, 'nothing may be added to a disposed forest');
  assert.equal(forest.modelCount, 0);
});

test('the forest heartbeat allocates (almost) nothing per tree', async () => {
  const level = await buildLevel();
  const player = { position: new THREE.Vector3(0, 2, 13) };

  const run = (n) => {
    for (let i = 0; i < n; i++) {
      // keep new paint arriving so the reaction path is actually exercised
      if (i % 500 === 0) {
        const tree = islandATree(level);
        tree.floor.splat(tree.mesh.position, i % 1000 === 0 ? 'blue' : 'red', 3);
      }
      // and keep the player in range so the tree loop does not short-circuit
      player.position.set((i % 10) - 5, 2, 13);
      level.update(FOREST.reactInterval, player);
    }
  };
  run(20000); // warm up the JIT first — cold code boxes numbers

  const session = new Session();
  session.connect();
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 256,
    includeObjectsCollectedByMinorGC: true,
    includeObjectsCollectedByMajorGC: true,
  });
  const FRAMES = 50000;
  run(FRAMES);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();

  // Count only allocations made by forest.js itself — a boxed double from a
  // three.js callee lands on a three.js frame, not on forest.js. See the same
  // note in player-alloc.test.js.
  let bytes = 0;
  (function walk(node) {
    if (node.callFrame.url.endsWith('/levels/forest.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);

  const perCall = bytes / FRAMES;
  assert.ok(perCall < 24,
    `the forest heartbeat allocated ${perCall.toFixed(1)} bytes per call; it must reuse its scratch vectors`);
});
