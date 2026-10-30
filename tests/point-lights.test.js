// #195 — point lights reach the custom shaders, through a fixed pool.
//
// Before: no point lights at all, and a THREE.PointLight would have lit almost
// nothing, because the paint and toon materials do their own lighting (AGENTS
// rule 5). These tests pin the pool's picks, its fixed light count, the falloff
// both shaders share, the enemy wind-up hook and the no-allocation rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';

import {
  PointLightPool, POINT_LIGHT_UNIFORMS, pointFalloff, pointLights,
} from '../src/shaders/point-lights.js';
import { createPaintMap, createPaintMaterial } from '../src/shaders/paint-material.js';
import { createToonMaterial } from '../src/shaders/toon/toon-material.js';
import { Enemy } from '../src/enemies/enemy.js';
import { DANGER, ENEMY, POINT_LIGHTS } from '../src/config.js';

const countLights = (scene) => {
  let n = 0;
  scene.traverse((o) => { if (o.isLight) n++; });
  return n;
};

test('with six sources, exactly the four nearest the camera reach the uniforms', () => {
  const pool = new PointLightPool();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 0);
  // distances 6, 1, 5, 2, 4, 3 — added out of order on purpose
  for (const d of [6, 1, 5, 2, 4, 3]) pool.add({ position: new THREE.Vector3(d, 0, 0), colour: 0xffffff, range: 10 });
  assert.equal(pool.update(camera), 4);
  const xs = POINT_LIGHT_UNIFORMS.uPointPos.value.map((v) => v.x);
  assert.deepEqual(xs, [1, 2, 3, 4], 'the nearest four, nearest first');
  // The real lights match the uniforms, so built-in materials agree.
  assert.deepEqual(pool.lights.map((l) => l.position.x), [1, 2, 3, 4]);
  assert.ok(pool.lights.every((l) => l.intensity > 0));

  // Move the camera to the other end: the picks follow it.
  camera.position.set(7, 0, 0);
  pool.update(camera);
  assert.deepEqual(POINT_LIGHT_UNIFORMS.uPointPos.value.map((v) => v.x), [6, 5, 4, 3]);
  pool.clear();
});

test('the scene light count never changes as sources come and go', () => {
  const scene = new THREE.Scene();
  scene.add(new THREE.DirectionalLight());
  const pool = new PointLightPool();
  pool.attach(scene);
  const camera = new THREE.PerspectiveCamera();
  const before = countLights(scene);
  assert.equal(before, 1 + POINT_LIGHTS.slots);

  pool.update(camera);
  assert.equal(countLights(scene), before, 'no sources: same count, all dark');
  assert.ok(pool.lights.every((l) => l.intensity === 0));

  const handles = [];
  for (let i = 0; i < 6; i++) {
    handles.push(pool.add({ position: new THREE.Vector3(i, 0, 0), colour: DANGER.amber }));
    pool.update(camera);
    assert.equal(countLights(scene), before);
  }
  for (const h of handles) {
    pool.remove(h);
    pool.update(camera);
    assert.equal(countLights(scene), before);
  }
  assert.ok(pool.lights.every((l) => l.intensity === 0), 'an unused slot is intensity 0, not removed');
  pool.attach(scene);
  assert.equal(countLights(scene), before, 'attaching twice adds nothing');
});

test('falloff: full at the source, zero at and beyond the range', () => {
  assert.equal(pointFalloff(0, 5), 1);
  assert.equal(pointFalloff(5, 5), 0);
  assert.equal(pointFalloff(7, 5), 0);
  let last = 1;
  for (let d = 0.5; d < 5; d += 0.5) {
    const f = pointFalloff(d, 5);
    assert.ok(f < last && f > 0, `falls smoothly at ${d}`);
    last = f;
  }
});

test('paint and toon shaders sum the pool, sharing ONE set of uniforms', () => {
  const paint = createPaintMaterial(createPaintMap(4, 4), 4);
  const toon = createToonMaterial(0xffffff);
  for (const m of [paint, toon]) {
    assert.match(m.fragmentShader, new RegExp(`uniform vec3\\s+uPointPos\\[${POINT_LIGHTS.slots}\\]`));
    assert.match(m.fragmentShader, /pointLighting\(/);
    assert.equal(m.uniforms.uPointPos, POINT_LIGHT_UNIFORMS.uPointPos, 'shared by reference');
    assert.equal(m.uniforms.uPointColour, POINT_LIGHT_UNIFORMS.uPointColour);
    assert.equal(m.uniforms.uPointRange, POINT_LIGHT_UNIFORMS.uPointRange);
  }
  assert.match(toon.vertexShader, /vWorldNormal = /, 'toon needs a world normal for world-space lights');
});

function makeEnemy(type = 'sprayer') {
  return new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY[type],
    parent: new THREE.Group(),
    floors: [],
  });
}

test('an enemy wind-up registers an amber source and releases it when the tell ends', () => {
  pointLights.clear();
  const enemy = makeEnemy();
  enemy.sleeping = false;
  const near = new THREE.Vector3(0, 0, 100);
  enemy.update(1 / 60, near);
  assert.equal(pointLights.sources.length, 0, 'no tell, no light');

  assert.ok(enemy.startTelegraph(), 'the wind-up starts');
  enemy.update(1 / 60, near);
  assert.equal(pointLights.sources.length, 1, 'the tell lights up');
  const source = pointLights.sources[0];
  assert.equal(source.colour.getHex(), DANGER.amber, 'amber: danger only (#126)');
  assert.ok(Math.abs(source.position.y - (enemy.position.y + 0.9)) < 1e-6, 'at the chest');
  const early = source.intensity;
  for (let i = 0; i < 10 && enemy.telegraphing; i++) enemy.update(1 / 60, near);
  if (enemy.telegraphing) assert.ok(source.intensity > early, 'swells with the tell');

  for (let i = 0; i < 600 && enemy.telegraphing; i++) enemy.update(1 / 60, near);
  enemy.update(1 / 60, near);
  assert.equal(enemy.telegraphing, false);
  assert.equal(pointLights.sources.length, 0, 'released when the tell ends');
  enemy.dispose();
});

test('an enemy that dies mid-tell releases its light at once', () => {
  pointLights.clear();
  const enemy = makeEnemy();
  enemy.sleeping = false;
  enemy.startTelegraph();
  enemy.update(1 / 60, new THREE.Vector3(0, 0, 100));
  assert.equal(pointLights.sources.length, 1);
  enemy.takeColourHit(1, 9999);
  assert.equal(enemy.alive, false);
  assert.equal(pointLights.sources.length, 0, 'a corpse does not glow');
  enemy.dispose();
});

test('pool.update allocates nothing per frame', async () => {
  const pool = new PointLightPool();
  const camera = new THREE.PerspectiveCamera();
  for (let i = 0; i < 7; i++) pool.add({ position: new THREE.Vector3(i * 3, 0, i), colour: DANGER.amber, flicker: i % 2 ? 0.3 : 0 });
  const run = (n) => {
    for (let i = 0; i < n; i++) {
      camera.position.set((i % 40) - 20, 1, 0);
      pool.update(camera, 1 / 60);
    }
  };
  run(20000); // warm the JIT

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

  let bytes = 0;
  (function walk(node) {
    if (node.callFrame.url.endsWith('/shaders/point-lights.js')) bytes += node.selfSize;
    node.children.forEach((c) => walk(c));
  })(profile.head);
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 4, `pool.update allocated ${perFrame.toFixed(1)} bytes/frame`);
});
