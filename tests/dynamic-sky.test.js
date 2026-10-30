// #197 — the dynamic sky: Corp grey that warms as the territory grows.
//
// Before: every sky was three bands of vertex colours fixed at load. These
// tests pin the driver (drained at 0, restored at SKY.to), the fog following
// the horizon, the scan budget, the Siphon's override, the probe refresh rule
// and the dispose contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { DynamicSky, skyDome } from '../src/levels/mood.js';
import { LEVELS } from '../src/levels/index.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { SKY, OUTSKIRTS, LAST_COLOUR } from '../src/config.js';

const DT = 1 / 60;
const MOOD = OUTSKIRTS.mood;

function rig(coverage = 0) {
  const state = { coverage, calls: 0 };
  const surfaces = [{ coverage: () => { state.calls++; return state.coverage; } }];
  const dome = skyDome(MOOD, 200, MOOD.drained);
  const fog = new THREE.Fog(MOOD.drained.horizon, 1, 2);
  const probe = { refreshes: 0, refresh() { this.refreshes++; } };
  const sky = new DynamicSky({ dome, mood: MOOD, surfaces, fog, probe });
  return { state, sky, dome, fog, probe };
}

const run = (sky, seconds, each) => {
  for (let t = 0; t < seconds; t += DT) { sky.update(DT); each?.(); }
};
const hex = (c) => c.getHex();

test('coverage 0: the dome is the drained palette', () => {
  const { sky, dome } = rig(0);
  run(sky, 3);
  const u = dome.material.uniforms;
  assert.equal(hex(u.uHorizon.value), MOOD.drained.horizon);
  assert.equal(hex(u.uZenith.value), MOOD.drained.zenith);
  assert.equal(hex(u.uVoid.value), MOOD.drained.void);
});

test('coverage at or past SKY.to: the dome rolls to the restored palette', () => {
  const { sky, dome, state } = rig(0);
  run(sky, 1);
  state.coverage = SKY.to + 0.05;
  run(sky, 0.25);
  assert.ok(sky.k > 0 && sky.k < 1, 'it rolls over, it does not snap');
  run(sky, 6);
  const u = dome.material.uniforms;
  assert.equal(hex(u.uHorizon.value), MOOD.horizon);
  assert.equal(hex(u.uZenith.value), MOOD.zenith);
  assert.equal(hex(u.uVoid.value), MOOD.void);
});

test('the fog colour equals uHorizon on every frame the sky moves', () => {
  const { sky, dome, fog, state } = rig(0);
  let moved = 0;
  for (let i = 0; i < 400; i++) {
    state.coverage = (i / 400) * SKY.to * 1.5;
    const before = sky.k;
    sky.update(DT);
    if (sky.k !== before) moved++;
    assert.equal(hex(fog.color), hex(dome.material.uniforms.uHorizon.value), `frame ${i}`);
  }
  assert.ok(moved > 100, 'the sky did move');
});

test('coverage is scanned at most SKY.scansPerSecond times a second', () => {
  const { sky, state } = rig(0);
  run(sky, 10);
  assert.ok(state.calls <= SKY.scansPerSecond * 10 + 1, `${state.calls} scans in 10 s`);
  assert.ok(state.calls >= SKY.scansPerSecond * 10 - 1, 'and it does keep scanning');
  // A stall frame does not trigger a burst of catch-up scans.
  const before = state.calls;
  sky.update(5);
  assert.equal(state.calls, before + 1);
});

test('the wet-paint probe is refreshed when k moves past the step, never every frame', () => {
  const { sky, probe, state } = rig(0);
  state.coverage = SKY.to;
  let frames = 0;
  for (let t = 0; t < 6; t += DT, frames++) sky.update(DT);
  assert.ok(probe.refreshes > 0, 'a moving sky re-photographs');
  assert.ok(probe.refreshes <= Math.ceil(1 / SKY.refreshStep), `${probe.refreshes} refreshes for one full roll`);
  assert.ok(probe.refreshes < frames / 4);
  const settled = probe.refreshes;
  run(sky, 3);
  assert.equal(probe.refreshes, settled, 'a still sky never refreshes');
});

test('the Siphon drains the sky while its exam runs and its destruction restores it within SKY.finale', async () => {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  assert.ok(level.sky, 'Last Colour has a dynamic sky');
  const player = { position: new THREE.Vector3(0, 0, 80) };
  // Restore the sky first (as if the player had painted the level).
  level.sky.restore();
  level.siphon.update = () => {};          // drive the phase by hand
  for (let t = 0; t < SKY.finale + 0.1; t += DT) level.sky.update(DT);
  assert.equal(level.sky.k, 1);

  // A fresh driver, so the finale lock is not in force: territory high, exam on.
  level.sky._mode = 'territory';
  level.siphon.phase = 'arms';
  for (let t = 0; t < 4; t += DT) level.update(DT, player);
  assert.ok(level.sky.k < 0.01, `the exam pulls the sky to drained (k ${level.sky.k.toFixed(3)})`);
  const u = level.atmosphere.getObjectByName('sky-dome').material.uniforms;
  assert.ok(Math.abs(u.uHorizon.value.getHex() - LAST_COLOUR.mood.drained.horizon) < 0x020202);

  level.siphon.phase = 'finale';
  for (let t = 0; t < SKY.finale + DT; t += DT) level.update(DT, player);
  assert.equal(level.sky.k, 1, 'restored within SKY.finale seconds');
  assert.equal(u.uHorizon.value.getHex(), LAST_COLOUR.mood.horizon);
  assert.equal(level.game.scene.fog.color.getHex(), LAST_COLOUR.mood.horizon, 'the fog came back with it');
  level.dispose();
});

test('the Primer keeps a static sky; the outdoor levels start drained', async () => {
  for (const entry of LEVELS) {
    const game = { scene: new THREE.Scene() };
    const level = entry.create(game);
    await level.load();
    const dome = level.atmosphere.getObjectByName('sky-dome');
    assert.ok(dome, `${entry.id}: a sky dome`);
    assert.equal(dome.material.fog, false, 'fog: false stays load-bearing');
    assert.equal(dome.material.depthWrite, false);
    if (entry.id === 'primer') {
      assert.equal(level.sky, null, 'indoors: static on purpose');
    } else {
      assert.ok(level.sky instanceof DynamicSky, `${entry.id}: dynamic`);
      assert.equal(game.scene.fog.color.getHex(), dome.material.uniforms.uHorizon.value.getHex(),
        `${entry.id}: fog starts on the drained horizon`);
    }
    level.dispose();
  }
});

for (const entry of LEVELS) {
  test(`${entry.name}: ten reloads free the sky dome every time`, async () => {
    let freed = 0;
    for (let i = 0; i < 10; i++) {
      const level = entry.create({ scene: new THREE.Scene() });
      await level.load();
      const dome = level.atmosphere.getObjectByName('sky-dome');
      dome.geometry.addEventListener('dispose', () => { freed++; });
      dome.material.addEventListener('dispose', () => { freed++; });
      level.dispose();
    }
    assert.equal(freed, 20, 'geometry and material, ten times');
  });
}
