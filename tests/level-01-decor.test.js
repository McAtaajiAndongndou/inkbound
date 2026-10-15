import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Level01 } from '../src/levels/level-01-mission.js';
import { DECOR, KINDS, collectVariants, clearDecorCache } from '../src/levels/decor.js';

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
 * (a x100 scale, a Z-up node, several models in a strip, wildly different native
 * sizes) and a hand-built stub would happily agree with my own misunderstanding
 * of it.
 */
function parseGlb(url) {
  // KINDS holds RUNTIME urls, and Vite serves `public/` at the root — so
  // `./assets/trees/pine.glb` is the right thing to ask the browser for and the
  // wrong thing to hand to readFileSync. Same convention as the avatar's
  // `./assets/soldier-swat.glb`.
  const path = url.replace(/^\.\//, 'public/');
  const buffer = readFileSync(path);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
}

/** A level whose decor models load for real; every kind has settled on return. */
async function buildLevelWithModels() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null, loadGLB: parseGlb });
  await level.load();
  await Promise.all(Object.values(level.decor).map((props) => props.pending));
  return level;
}

/** Every code-built prop of one kind, found by walking root. */
function findProps(level, kind) {
  const found = [];
  level.root.traverse((o) => {
    if (o.userData?.decor && (kind === undefined || o.userData.decorKind === kind)) found.push(o);
  });
  return found;
}

const HEARTBEAT = DECOR.reactInterval + 0.01;

// --- placement ---------------------------------------------------------------

/**
 * A prop over a gap floats in mid-air, and with the gaps no longer filled with
 * fog colour that is the first thing a player would notice. Placement is a mix
 * of a hand-written table and a seeded scatter, so it needs a machine watching
 * it.
 */
test('every prop of every kind stands on a floor, never over a gap', async () => {
  const level = await buildLevel();
  const floors = level.surfaces.filter((s) => s.isFloor);
  const point = new THREE.Vector3();

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.ok(props.props.length > 0, `no ${kind} was placed at all`);

    for (const prop of props.props) {
      point.set(prop.x, prop.y, prop.z);
      // worldToCell is the level's OWN "is this point on this surface" API — the
      // same one the paint gun and the physics probe use, so this test cannot
      // drift away from what the game actually treats as a floor.
      const under = floors.find((s) => s.worldToCell(point) !== null);
      assert.ok(under, `${kind} floats over a gap at (${point.x}, ${point.y}, ${point.z})`);
    }
  }
});

/**
 * The SCATTER must not push trees into the route. Trees are the only kind that
 * has to stay clear of it — they are tall enough to hide an incoming Charger.
 *
 * Hand-placed trees are exempt on purpose: that table is the level author's
 * framing, and the two on the platform sit at x = ±3 because the platform is
 * only 8 wide and that is already near its edge.
 *
 * The ground cover is allowed near the route: a corridor with bare edges reads as
 * a corridor, not as a forest floor.
 */
test('no scattered tree stands in the route', async () => {
  const level = await buildLevel();
  const scattered = level.decor.tree.props.filter((p) => !p.hand);
  assert.ok(scattered.length > 0, 'the tree scatter produced nothing');

  for (const tree of scattered) {
    assert.ok(Math.abs(tree.x) >= KINDS.tree.edge,
      `a scattered tree at x=${tree.x} is inside the route (edge=${KINDS.tree.edge})`);
  }
});

/**
 * Props are decoration. The moment one is a PaintSurface the player controller
 * would treat it as something to stand on and collide with, which could block
 * the Gap 1 jump or trap the player against the Charger.
 */
test('decor is decoration, not physics', async () => {
  const level = await buildLevel();

  let paintable = 0;
  for (const prop of findProps(level)) {
    prop.traverse((o) => { if (o.userData?.paintSurface) paintable++; });
  }

  assert.equal(paintable, 0, 'a prop must never be a PaintSurface, or it collides');
  assert.equal(level.surfaces.filter((s) => s.userData?.decor).length, 0);
});

// --- shared resources --------------------------------------------------------

/**
 * Per-prop geometry or material would be hundreds of each for no reason. This
 * pins the "build one, share it" rule, which is what keeps the decor free rather
 * than a frame-rate problem on lab hardware.
 *
 * The reaction is what makes this worth stating: the obvious way to write it is a
 * cloned material per prop, and that quietly triples the material count. A prop
 * must point at one of the SHARED palette materials and nothing else.
 */
test('each kind shares its geometry, and swaps between shared palette materials', async () => {
  const level = await buildLevel();

  for (const [kind, props] of Object.entries(level.decor)) {
    const geometries = new Set();
    const materials = new Set();

    for (const prop of props.props) {
      for (const part of prop.mesh.children) {
        geometries.add(part.geometry);
        materials.add(part.material);
      }
    }

    const expected = KINDS[kind].fallback === 'tree' ? 2 : 1;
    assert.equal(geometries.size, expected,
      `${kind}: expected ${expected} shared shape(s), found ${geometries.size}`);

    const palette = new Set([level.palette.base, ...Object.values(level.palette.tint)]);
    for (const material of materials) {
      assert.ok(palette.has(material),
        `${kind} uses a material outside the shared palette — a per-prop clone`);
    }
    assert.ok(materials.size <= 2, `${kind} should only be using the base and grey tint at load`);
  }
});

/**
 * The ground does not read scene lights — it reads its own `uLightDir` uniform,
 * whose shader default is only NEARLY the sun's vector. So "the ground and the
 * props are lit from the same side" (#57) is a wiring problem, not a lighting
 * one, and the wiring happens in one place at the end of load().
 *
 * The decor is covered here because it was the actual MISS: the first version of
 * this test walked `level.surfaces` only, so every tree kept
 * `createToonMaterial`'s own default direction — (0.5, 1.0, 0.3) normalised to
 * (0.431, 0.863, 0.259) against the sun's (0.485, 0.808, 0.323) — and the whole
 * forest was lit from somewhere the ground was not.
 *
 * The literal below mirrors main.js (`sun.position.set(18, 30, 12)`), which a
 * test cannot import because it is a module with side effects.
 */
test('the ground, the walls, the gates and all the decor are lit from the same direction (#57)', async () => {
  const level = await buildLevel();
  const expected = new THREE.Vector3(18, 30, 12).normalize();
  const fallback = new THREE.Vector3(0.5, 1.0, 0.3).normalize();

  assert.ok(level.surfaces.length > 0);
  for (const surface of level.surfaces) {
    const uniform = surface.material.uniforms.uLightDir;
    assert.ok(uniform, 'a paint surface with no uLightDir cannot be lit at all');
    assert.ok(uniform.value.distanceTo(expected) < 1e-6,
      `surface lit from [${uniform.value.toArray()}], the sun is [${expected.toArray()}]`);
  }

  assert.ok(level.decorMaterials.length >= 2, 'the decor palette must be exposed');
  for (const material of level.decorMaterials) {
    const uniform = material.uniforms.uLightDir;
    assert.ok(uniform, 'a decor material with no uLightDir cannot be lit at all');
    assert.ok(uniform.value.distanceTo(expected) < 1e-6,
      `decor lit from [${uniform.value.toArray()}], the sun is [${expected.toArray()}]`);
    // and it must not be the shader's own default wearing the sun's name
    assert.ok(uniform.value.distanceTo(fallback) > 1e-6,
      'decor is still on createToonMaterial\'s default direction');
  }
});

// --- the reaction: grey world comes back to colour ---------------------------

/**
 * THE core promise of the game, asserted for EVERY kind of prop: the world is
 * grey, and painting the ground brings back the colour. Trees are the case that
 * was built first and got all the attention — so the test walks every kind, to
 * catch the case where a new kind is added and quietly does not react.
 *
 * Each kind is painted a DIFFERENT colour. The heartbeat is level-wide (every
 * kind updates together), so one kind's update can legitimately paint a
 * neighbour's ground; using one colour per kind keeps each assertion about the
 * kind it names rather than about whatever ran before it.
 */
test('painting the ground turns every kind of prop standing on it (#57)', async () => {
  // Each kind gets its OWN level. The heartbeat is level-wide, so a single shared
  // level lets one kind's update paint a neighbour's ground — and then the
  // neighbour starts its turn already the colour it is about to be asked for.
  // A fresh level per kind costs ~20ms each and removes the whole class of
  // cross-talk, which is worth far more than the time.
  for (const kind of Object.keys(KINDS)) {
    const level = await buildLevel();
    const prop = level.decor[kind].props.find((p) => p.floor && p.z > 8 && p.parts);
    assert.ok(prop, `${kind} has no prop with a fallback part on the spawn island`);
    assert.equal(prop.paintName, 'grey', `${kind} should start grey`);

    const before = prop.parts[0].material;
    assert.equal(before, level.palette.tint.grey, `${kind} should start on the grey tint`);

    prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'blue', 3);
    level.update(HEARTBEAT, { position: new THREE.Vector3(prop.x, 2, prop.z) });

    assert.equal(prop.paintName, 'blue', `${kind} did not read the paint under it`);
    assert.notEqual(prop.parts[0].material, before, `${kind} material did not change`);
    assert.equal(prop.parts.every((p) => p.material === level.palette.tint.blue), true,
      `${kind} must use the SHARED blue, not its own`);
  }
});

/**
 * Every kind must be reachable by the test above — a kind added without a
 * placement would make that loop silently skip it.
 */
test('every kind places props and reacts, so none can be added and quietly ignored', async () => {
  const level = await buildLevel();

  assert.deepEqual(Object.keys(level.decor).sort(), Object.keys(KINDS).sort(),
    'the level must build one decor set per kind');

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.ok(props.props.length > 0, `${kind} placed nothing`);
    assert.ok(props.props.some((p) => p.floor), `${kind} has no prop standing on a floor`);
  }
});

/**
 * The same promise once the models are in: a kind that only reacts on the
 * fallback path is a kind that stops reacting the moment its download lands.
 */
test('every kind reacts on the model path too, not just the fallback', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    const prop = props.props.find((p) => p.floor && p.z > 8);
    prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'blue', 3);

    const changed = props.update(1, { position: new THREE.Vector3(prop.x, 2, prop.z) });

    assert.ok(changed > 0, `${kind} did not react with models loaded`);
    assert.equal(prop.paintName, 'blue');
    assert.equal(prop.bucket, props.buckets[prop.variant].blue,
      `${kind} must have moved into the blue bucket`);
  }
});

test('each paint colour has its own tint, and they are not the drained one', async () => {
  const level = await buildLevel();

  const seen = new Set();
  for (const name of ['blue', 'red', 'green']) {
    const material = level.palette.tint[name];
    assert.ok(material, `no tint material for ${name}`);
    assert.notEqual(material, level.palette.tint.grey);
    seen.add(material.uniforms.uColour.value.getHex());
  }

  assert.equal(seen.size, 3, 'blue, red and green must look different from each other');
  assert.equal(seen.has(level.palette.tint.grey.uniforms.uColour.value.getHex()), false);
});

test('the base part never changes — only the tint is repainted', async () => {
  const level = await buildLevel();
  const props = level.decor.tree;
  const prop = props.props.find((p) => p.floor && p.z > 8 && p.mesh);

  const trunk = prop.mesh.children.find((c) => c.material === level.palette.base);
  assert.ok(trunk, 'a tree should have a dark trunk that is not on the tint palette');

  prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'green', 3);
  level.update(HEARTBEAT, { position: new THREE.Vector3(prop.x, 2, prop.z) });

  assert.equal(prop.paintName, 'green');
  assert.equal(trunk.material, level.palette.base, 'a green tree is a green canopy, not a green tree');
});

/**
 * The reaction is deliberately local. Without the radius every prop in the level
 * would be re-checked and recoloured from wherever the player happens to be,
 * which reads as the whole world being on a switch rather than the ground the
 * player actually painted.
 */
test('props far from the player keep their colour', async () => {
  const level = await buildLevel();
  const props = level.decor.tree;
  const prop = props.props.find((p) => p.floor && p.z > 8 && p.mesh);

  prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'red', 3);

  // the player is on the far ledge, well outside DECOR.reactRadius
  level.update(HEARTBEAT, { position: new THREE.Vector3(0, 9, -27) });

  assert.equal(prop.paintName, 'grey', 'a prop past reactRadius must not be repainted');
});

test('a prop only pays for a material swap when the colour actually changed', async () => {
  const level = await buildLevel();
  const props = level.decor.tree;
  const prop = props.props.find((p) => p.floor && p.z > 8);
  const player = { position: new THREE.Vector3(prop.x, 2, prop.z) };

  prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'blue', 3);
  assert.ok(props.update(1, player) > 0, 'the first heartbeat reports the change');

  // nothing was painted since, so the next heartbeat is a no-op — the point of
  // tracking `paintName` per prop instead of reassigning every time
  assert.equal(props.update(1, player), 0,
    'a second heartbeat with no new paint must change nothing');
});

/**
 * The heartbeat is an accumulator, not a "last checked at" timestamp, so a
 * restart or a frame hitch cannot make it catch up by running the loop dozens of
 * times in one frame.
 */
test('many tiny frames do not fire the heartbeat early', async () => {
  const level = await buildLevel();
  const props = level.decor.tree;
  const prop = props.props.find((p) => p.floor && p.z > 8);
  const player = { position: new THREE.Vector3(prop.x, 2, prop.z) };

  prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'blue', 3);

  for (let i = 0; i < 30; i++) level.update(DECOR.reactInterval / 60, player);
  assert.equal(prop.paintName, 'grey');

  level.update(DECOR.reactInterval, player);
  assert.equal(prop.paintName, 'blue');
});

test('the heartbeat allocates (almost) nothing per prop', async () => {
  const level = await buildLevel();
  const props = level.decor.tree;
  const player = { position: new THREE.Vector3(0, 2, 13) };

  const run = (n) => {
    for (let i = 0; i < n; i++) {
      // keep new paint arriving so the reaction path is actually exercised
      if (i % 500 === 0) {
        const prop = props.props.find((p) => p.floor && p.z > 8);
        prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), i % 1000 === 0 ? 'blue' : 'red', 3);
      }
      // and keep the player in range so the prop loop does not short-circuit
      player.position.set((i % 10) - 5, 2, 13);
      props.update(DECOR.reactInterval, player);
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

  // Count only allocations made by decor.js itself — a boxed double from a
  // three.js callee lands on a three.js frame, not on decor.js. See the same
  // note in player-alloc.test.js.
  let bytes = 0;
  (function walk(node) {
    if (node.callFrame.url.endsWith('/levels/decor.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);

  const perCall = bytes / FRAMES;
  assert.ok(perCall < 24,
    `the heartbeat allocated ${perCall.toFixed(1)} bytes per call; it must reuse its scratch vectors`);
});

// --- the real models, instanced ---------------------------------------------

/**
 * The asset pipeline, run against the real files.
 *
 * The tree packs hold five trees laid out in a strip along X; every other file
 * holds ONE prop. Getting the grouping wrong is silent — group by the wrong node
 * and you get one "variant" dozens of primitives wide, and a level where every
 * tree is five trees stacked on top of each other.
 */
test('every shipped model file yields complete shapes (#57 step 4)', async () => {
  for (const [kind, config] of Object.entries(KINDS)) {
    for (const url of config.models) {
      const variants = collectVariants(await parseGlb(url));

      assert.ok(variants.length >= 1, `${url} yielded no shapes`);
      for (const variant of variants) {
        // a prop is either one tint part or a base + tint pair; never nothing
        assert.ok(variant.tint || variant.base, `${kind}/${url} yielded an empty shape`);
        for (const part of [variant.base, variant.tint].filter(Boolean).flat()) {
          assert.ok(part.geometry.attributes.position.count > 0);
        }
      }
    }
  }
});

/**
 * The export defects, undone by the bake. Checked against the REAL files,
 * because each one is a property of those files: the strip offset, the unit
 * scale, and a pivot that is somewhere different on every variant. The native
 * sizes really are absurd — `rocks.glb` is 0.30 units tall and `rock-large.glb`
 * is 7.67 — which is why every variant is normalised to its kind's height.
 */
test('baked models stand on y=0, centred, at the height the design asked for', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.variants.length, KINDS[kind].maxVariants,
      `${kind} did not bake every variant it asked for`);
    assert.ok(props.modelCount > 0, `${kind} did not move onto its models`);

    for (const variant of props.variants) {
      for (const part of [variant.base, variant.tint].filter(Boolean)) {
        const box = new THREE.Box3().setFromBufferAttribute(part.attributes.position);

        // the strip offset is gone: nothing may live 170 metres from its origin
        assert.ok(Math.abs(box.min.x) < 20 && Math.abs(box.max.x) < 20,
          `${kind} still sits at its strip position, x=${box.min.x}..${box.max.x}`);
        // and no single part may be taller than the height its kind was baked to
        assert.ok(box.max.y <= KINDS[kind].height + 1e-4,
          `${kind} has a part taller than its normalised height`);
      }

      // The pivot invariant, stated on the COMBINED shape rather than on one
      // part — and that distinction is not pedantic. The bake normalises the
      // union of the parts, so the lowest point of the union is the one at y=0.
      // Asserting it on the "base" part instead fails on a bush with berries,
      // where the berries are legitimately 15cm off the ground and the leaves
      // are what touches it.
      const combined = new THREE.Box3();
      for (const part of [variant.base, variant.tint].filter(Boolean)) {
        combined.union(new THREE.Box3().setFromBufferAttribute(part.attributes.position));
      }

      assert.ok(Math.abs(combined.min.y) < 1e-4,
        `${kind} prop hovers at y=${combined.min.y}; the pivot was not undone`);
      assert.ok(Math.abs(combined.max.y - KINDS[kind].height) < 1e-3,
        `${kind} prop is ${combined.max.y.toFixed(3)} tall, expected ${KINDS[kind].height}`);
      // and it is centred, not standing off to one side of its own origin
      assert.ok(Math.abs(combined.min.x + combined.max.x) < 1e-3,
        `${kind} prop is not centred on x (${combined.min.x}..${combined.max.x})`);
    }
  }
});

test('the models replace the code shapes rather than standing beside them (#57 step 5)', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.fallback.visible, false,
      `${kind} fallback must be hidden, or every prop is drawn twice`);
    assert.ok(props.models.children.length > 0);
    assert.equal(props.props.every((p) => p.bucket !== null), true,
      `${kind}: every prop must be sitting in an instanced bucket`);
    assert.equal(props.modelCount, props.props.length);
  }
});

/**
 * The draw-call budget, pinned. This is the point of step 5: a kind's cost must
 * not scale with how many instances it holds. One InstancedMesh per variant per
 * paint colour, plus one per variant for the base parts — which share a single
 * material that never changes, so they are one call each rather than four.
 */
test('every kind costs a fixed number of draw calls per variant (#57 step 5)', async () => {
  const level = await buildLevelWithModels();
  const colours = Object.keys(level.palette.tint).length;

  for (const [kind, props] of Object.entries(level.decor)) {
    // a variant with no base part costs one call fewer: there is nothing for the
    // base bucket to draw
    const expected = props.variants.reduce(
      (sum, v) => sum + (v.base ? 1 : 0) + (v.tint ? colours : 0), 0);
    assert.equal(props.models.children.length, expected,
      `${kind} should cost ${expected} draw calls`);
    assert.ok(props.models.children.every((m) => m.isInstancedMesh),
      `${kind}: every model draw call must be an InstancedMesh`);
  }
});

test('only the buckets in use are drawn', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    for (const bucket of props.buckets) {
      for (const colour of ['blue', 'red', 'green']) {
        assert.equal(bucket[colour].live, 0, `${kind}: nothing is painted ${colour} yet`);
        assert.equal(bucket[colour].mesh.count, 0,
          `${kind}: a bucket nothing is in must not be submitted to the GPU at all`);
      }
    }
    assert.equal(props.props.length, props.buckets.reduce((n, b) => n + b.grey.live, 0));
  }
});

/**
 * The reaction has to survive the upgrade: step 5 must not quietly delete the
 * colour. With models in place a prop changes colour by MOVING between buckets,
 * because the toon shader cannot do per-instance colour — so this is the test
 * that the swap-remove free list actually keeps its books.
 */
test('painting still works once the props are models (#57 step 3 + 5)', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    const prop = props.props.find((p) => p.floor && p.z > 8 && p.variant >= 0);
    assert.ok(prop, `${kind} has no prop on the spawn island to test`);

    prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), 'blue', 3);
    const buckets = props.buckets[prop.variant];
    const greyBefore = buckets.grey.live;

    const changed = props.update(1, { position: new THREE.Vector3(prop.x, 2, prop.z) });

    assert.ok(changed > 0, `${kind} did not react`);
    assert.equal(prop.paintName, 'blue');
    assert.equal(prop.bucket, buckets.blue, `${kind} must have moved into the blue bucket`);
    assert.ok(buckets.grey.live < greyBefore,
      `${kind} must have LEFT the grey bucket, not been copied into both`);
  }
});

/**
 * Swap-remove is easy to get subtly wrong, and the failure is invisible: the
 * buckets stay the right SIZE while props inside them swap places. So this walks
 * several colour changes and checks the invariant directly — every prop is in
 * exactly one tint bucket, and the bucket agrees about where.
 */
test('every prop is in exactly one bucket, however often it is repainted', async () => {
  const level = await buildLevelWithModels();
  const props = level.decor.tree;
  const prop = props.props.find((p) => p.floor && p.variant >= 0);

  for (const colour of ['blue', 'red', 'green', 'blue']) {
    prop.floor.splat(new THREE.Vector3(prop.x, prop.y, prop.z), colour, 4);
    props.update(1, { position: new THREE.Vector3(prop.x, 2, prop.z) });

    let found = 0;
    for (const bucket of props.buckets) {
      for (const name of Object.keys(level.palette.tint)) {
        const slot = bucket[name].slots.indexOf(prop);
        if (slot === -1) continue;
        found += 1;
        assert.equal(prop[bucket[name].slotField], slot,
          `bucket says ${slot}, the prop says ${prop[bucket[name].slotField]}`);
        assert.ok(slot < bucket[name].live, 'a prop must not sit past the live count');
      }
    }
    assert.equal(found, 1, `the prop is in ${found} buckets after being painted ${colour}`);
  }
});

test('a kind that fails to load leaves decor standing, not a hole (#57 step 4)', async () => {
  clearDecorCache();
  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: () => Promise.reject(new Error('offline')),
  });
  await level.load();
  await Promise.all(Object.values(level.decor).map((props) => props.pending));

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.modelCount, 0, `${kind} should not have adopted models`);
    assert.equal(props.fallback.visible, true, `${kind} fallback must still be showing`);
    assert.ok(props.props.length > 0, `${kind} left the level bare`);
    assert.equal(props.props.every((p) => p.bucket === null), true,
      `${kind}: every prop must still be on the fallback path`);
  }
});

/**
 * The fallback props must NOT be on screen while the models load.
 *
 * They exist so a failed download can never leave a bare level — but showing
 * them during a normal load meant every restart flashed cones and blobs that
 * then turned into trees. Renda reported exactly that: "when the lvl first loads
 * after pressing R, it initially shows the old trees and grass".
 *
 * Driven by level time, not a timer, so this is testable.
 */
test('the fallback props stay hidden while the models load', async () => {
  const level = await buildLevelWithModels();      // models arrive

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.fallback.visible, false, `${kind} showed its fallback despite loading`);
  }

  // and a heartbeat well past the delay must not bring it back
  for (let i = 0; i < 20; i++) {
    level.update(DECOR.reactInterval, { position: new THREE.Vector3(0, 2, 13) });
  }
  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.fallback.visible, false, `${kind} revealed its fallback after the models landed`);
    assert.ok(props.modelCount > 0);
  }
});

test('a slow load still gets a dressed level once the delay has passed', async () => {
  clearDecorCache();
  // a loader that never resolves — the worst case: no error, no models
  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: () => new Promise(() => {}),
  });
  await level.load();

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.fallback.visible, false, `${kind} showed the fallback before its delay`);
  }

  // step past DECOR.fallbackDelay in small slices, exactly as a game loop would
  const steps = Math.ceil(DECOR.fallbackDelay / 0.05) + 2;
  for (let i = 0; i < steps; i++) {
    level.update(0.05, { position: new THREE.Vector3(0, 2, 13) });
  }

  for (const [kind, props] of Object.entries(level.decor)) {
    assert.equal(props.fallback.visible, true,
      `${kind} left the level bare — a hung download must still produce a dressed level`);
  }
});

/**
 * The model cache is module-level, which is the point of it - but it must not
 * quietly turn the load-path tests above into no-ops. Every one of them clears
 * it first, and this proves the clearing actually works.
 */
test('the model cache is real, and clearing it forces a genuine reload', async () => {
  const warm = await buildLevelWithModels();
  assert.equal(warm.decor.tree.modelCount > 0, true);

  clearDecorCache();

  const wanted = Object.values(KINDS).reduce((n, c) => n + c.models.length, 0);
  let fetched = 0;
  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: async (url) => { fetched += 1; return parseGlb(url); },
  });
  await level.load();
  await Promise.all(Object.values(level.decor).map((props) => props.pending));

  assert.equal(fetched, wanted, 'a cleared cache must re-fetch every model');
  assert.equal(level.decor.tree.modelCount > 0, true);
});

test('a warm cache does NOT re-fetch, which is what kills the flicker on R', async () => {
  await buildLevelWithModels();   // warms the cache

  let fetched = 0;
  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: async (url) => { fetched += 1; return parseGlb(url); },
  });
  await level.load();
  await Promise.all(Object.values(level.decor).map((props) => props.pending));

  assert.equal(fetched, 0,
    'a restart must not touch the loader at all - that reload is what put the fallback cones on screen');
  assert.equal(level.decor.tree.modelCount > 0, true);
  assert.equal(level.decor.tree.fallback.visible, false);
});

/**
 * THE ONE THAT COST A WHOLE DEBUGGING SESSION, pinned so it cannot come back.
 *
 * A custom ShaderMaterial does NOT get the instance transform for free. three.js
 * applies `instanceMatrix` inside its own <project_vertex> chunk, behind
 * `#ifdef USE_INSTANCING`. The toon shader builds its own mvPosition — it has to,
 * so that <fog_vertex> gets view-space depth — and by replacing that chunk it
 * silently lost the multiply.
 *
 * The failure mode is the worst kind: no error, no console warning, the draw
 * call still issued and every triangle still counted by renderer.info. All 377
 * decor instances simply rendered on top of each other at their mesh's origin,
 * so a fully dressed level looked like one tree floating in an empty corridor.
 *
 * This is a SOURCE check rather than a render check, and that is a real
 * limitation worth stating: `node --test` has no GL context, so the only thing
 * verifiable here is that the shader contains the transform. It is still worth
 * having, because the bug it catches is invisible to every other test in this
 * suite — the CPU-side instance matrices were provably correct the whole time.
 */
test('every custom shader used on an instanced mesh applies the instance transform', async () => {
  const level = await buildLevelWithModels();
  let checked = 0;

  for (const [kind, props] of Object.entries(level.decor)) {
    for (const mesh of props.models.children) {
      assert.ok(mesh.isInstancedMesh, `${kind}: model draw calls must be instanced`);
      const source = mesh.material.vertexShader;

      assert.match(source, /#ifdef USE_INSTANCING/,
        `${kind}/${mesh.name}: shader never declares the instance branch, so every instance draws at the mesh origin`);
      assert.match(source, /instanceMatrix \*/,
        `${kind}/${mesh.name}: shader mentions instancing but never multiplies by instanceMatrix`);
      assert.match(source, /modelViewMatrix \* localPosition/,
        `${kind}/${mesh.name}: shader computes mvPosition from the untransformed position`);
      checked += 1;
    }
  }

  assert.ok(checked > 0, 'no instanced meshes to check — the models did not load');
});

test('the model geometry carries only the attributes the shader uses', async () => {
  const level = await buildLevelWithModels();

  for (const [kind, props] of Object.entries(level.decor)) {
    for (const variant of props.variants) {
      for (const part of [variant.base, variant.tint].filter(Boolean)) {
        assert.deepEqual(Object.keys(part.attributes).sort(), ['normal', 'position'],
          `${kind}: the bake should drop UVs and everything else the flat-toon shader ignores — `
          + 'a matching attribute set is also what lets several primitives merge into one geometry');
      }
    }
  }
});

/**
 * The "R race" from the plan: pressing R while the models are in flight rebuilds
 * the level, and the load then resolves against a level that no longer exists.
 * Attaching the result there puts props on screen that nothing will ever remove,
 * because dispose() has already run.
 */
test('a model load that finishes after the level died is dropped (#57 step 4)', async () => {
  clearDecorCache();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const level = new Level01({
    scene: new THREE.Scene(),
    onWin: null,
    loadGLB: async (url) => { await gate; return parseGlb(url); },
  });
  await level.load();

  const decor = level.decor;
  level.dispose();          // R, mid-download
  release();                // ...and the files arrive
  const loaded = await Promise.all(Object.values(decor).map((props) => props.pending));

  assert.deepEqual(loaded, loaded.map(() => 0), 'a dead level must not adopt the models');
  for (const [kind, props] of Object.entries(decor)) {
    assert.equal(props.models.children.length, 0, `${kind} added to a disposed decor set`);
    assert.equal(props.modelCount, 0);
  }
});
