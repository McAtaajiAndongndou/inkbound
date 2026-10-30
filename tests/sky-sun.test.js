// The Ascent's dawn sun (Renda, 30 Oct: "do something about the sun"). There
// was no sun to see. It is drawn into the sky dome: low, on the same side as
// the scene light, among the ridges, smothered by the Corp's grey and let
// through as the climb is painted (#197).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { DynamicSky, skyDome, sunDirection, DEFAULT_SUN } from '../src/levels/mood.js';
import { ASCENT, OUTSKIRTS, PRIMER } from '../src/config.js';
import { Level02 } from '../src/levels/level-02-ascent.js';

test('the sun stands on the scene light\'s side of the sky, at the mood\'s own height', () => {
  const s = ASCENT.mood.sun;
  const dir = sunDirection(s, DEFAULT_SUN);
  assert.equal(dir.w, 1);
  const flat = new THREE.Vector2(dir.x, dir.z).normalize();
  const light = new THREE.Vector2(DEFAULT_SUN[0], DEFAULT_SUN[2]).normalize();
  assert.ok(flat.dot(light) > 0.9999, 'the drawn sun must be where the light comes from, or lit faces point away from it');
  assert.ok(Math.abs(Math.asin(dir.y) - THREE.MathUtils.degToRad(s.elevation)) < 1e-9);
  assert.ok(Math.abs(new THREE.Vector3(dir.x, dir.y, dir.z).length() - 1) < 1e-9);
});

test('a low dawn sun: among the peaks, so a ridge can hide part of it', () => {
  const s = ASCENT.mood.sun;
  const h = ASCENT.mood.hills;
  // A crest at band b is at asin(2 (b - 0.5)) above the horizon.
  const peakTop = THREE.MathUtils.radToDeg(Math.asin(2 * (h.height + h.swell)));
  const lowest = THREE.MathUtils.radToDeg(Math.asin(2 * (h.height - h.swell)));
  assert.ok(s.elevation > lowest && s.elevation < peakTop, `sun at ${s.elevation} degrees, peaks ${lowest.toFixed(1)}..${peakTop.toFixed(1)}`);
  assert.ok(s.drained > 0 && s.drained < 0.5, 'a drained sky smothers the sun, but not away entirely');
});

test('moods without a sun draw none (Outskirts and the Primer unchanged)', () => {
  assert.equal(skyDome(OUTSKIRTS.mood).material.uniforms.uSun.value.w, 0);
  assert.equal(skyDome(PRIMER.mood).material.uniforms.uSun.value.w, 0);
});

test('the sun breaks through as the sky is restored', () => {
  const dome = skyDome(ASCENT.mood, 450, ASCENT.mood.drained);
  const state = { coverage: 0 };
  const sky = new DynamicSky({ dome, mood: ASCENT.mood, surfaces: [{ coverage: () => state.coverage }], fog: null, probe: null });
  const look = dome.material.uniforms.uSunLook.value;
  assert.ok(Math.abs(look.w - ASCENT.mood.sun.drained) < 1e-9, 'drained: smothered');
  state.coverage = 1;
  for (let t = 0; t < 10; t += 1 / 60) sky.update(1 / 60);
  assert.ok(look.w > 0.99, `restored: the full sun (${look.w})`);
});

test('the Ascent is built with its sun on, on its layout\'s light side', async () => {
  const level = new Level02({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const sun = level.atmosphere.getObjectByName('sky-dome').material.uniforms.uSun.value;
  assert.equal(sun.w, 1);
  const flat = new THREE.Vector2(sun.x, sun.z).normalize();
  assert.ok(flat.dot(new THREE.Vector2(level.sunDir.x, level.sunDir.z).normalize()) > 0.9999,
    'the sun in the sky and the light on the surfaces agree');
  level.dispose();
});
