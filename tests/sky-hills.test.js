// Far hills drawn into the sky dome (Renda, 30 Oct): one continuous line all the
// way round, in the sky's own colours, replacing the dropped 3D ridge (grey
// geometry with gaps). Opt-in per mood: Outskirts has them, nothing else does.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { skyDome } from '../src/levels/mood.js';
import { OUTSKIRTS, PRIMER, ASCENT } from '../src/config.js';
import { Level01 } from '../src/levels/level-01-mission.js';

test('a mood with hills turns them on with its numbers; one without leaves them off', () => {
  const on = skyDome(OUTSKIRTS.mood).material.uniforms;
  const h = OUTSKIRTS.mood.hills;
  assert.deepEqual(on.uHills.value.toArray(), [1, h.height, h.swell, h.soft]);
  assert.deepEqual(on.uHillShade.value.toArray(), [h.farShade, h.nearShade, h.nearDrop]);
  assert.equal(on.uHillGround.value, h.groundFloor);
  const off = skyDome(PRIMER.mood).material.uniforms;
  assert.equal(off.uHills.value.x, 0, 'the Primer is indoors: no hills');
});

test('the hills stay a low band: crests between the horizon and the haze band\'s top', () => {
  const h = OUTSKIRTS.mood.hills;
  // crest() spans -1..1, so a layer reaches height ± swell above the horizon (0.5).
  assert.ok(h.height - h.swell - h.nearDrop > 0, 'a crest dips below the horizon: a gap in the line');
  assert.ok(0.5 + h.height + h.swell < 0.6, 'a crest climbs out of the haze band: a wall, not far hills');
  assert.ok(h.nearShade > h.farShade, 'the nearer layer is darker, so the two read as depth');
});

// Renda (30 Oct): "the ground still reads like a void and gap". Under the near
// crest the dome is land that darkens only toward straight down, so there is
// no pale strip under the hills and no black pit at the horizon.
test('below the hills is land: it reaches the void only well below the horizon', async () => {
  const h = OUTSKIRTS.mood.hills;
  assert.ok(h.groundFloor < 0.25, 'the land must run well below the horizon before it goes dark');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/levels/mood.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /inNear \* step\(/, 'the near layer must fill all the way down, not stop at a band');
});

test('the crest wave closes on itself all the way round (whole-number frequencies)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/levels/mood.js', import.meta.url), 'utf8');
  // Both crest shapes: Outskirts' rolling one and the Ascent's jagged one.
  const body = src.slice(src.indexOf('float crest('), src.indexOf('float line(', src.indexOf('float crest(')));
  assert.match(body, /float crag\(/, 'the jagged crest is checked too');
  const freqs = [...body.matchAll(/a \* (\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  assert.ok(freqs.length >= 3);
  for (const f of freqs) assert.equal(f % 1, 0, `frequency ${f} would leave a seam behind you`);
});

test('Outskirts\' sky is built with its hills on', async () => {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const dome = level.atmosphere.getObjectByName('sky-dome');
  assert.ok(dome, 'Outskirts has a sky dome');
  assert.equal(dome.material.uniforms.uHills.value.x, 1);
  level.dispose();
});

// The Ascent (quality plan §8.4 item 6; Renda: the grey 3D peaks "are meant to
// be mountains … the execution sucks"). The same sky hills, three layers deep,
// each farther range lighter and bluer: atmospheric perspective.
test('the Ascent\'s ridges: three layers, each farther one lighter and bluer', async () => {
  const h = ASCENT.mood.hills;
  assert.ok(h, 'the Ascent has sky ridges');
  assert.ok(h.farShade < h.midShade && h.midShade < h.nearShade, 'farther must be lighter (less shade toward the void)');
  assert.ok(h.farTint > h.midTint && h.midTint > h.nearTint, 'farther must be bluer (more of the zenith)');
  assert.ok(h.midDrop > 0 && h.midDrop < h.nearDrop, 'the middle range sits between the far and near crests');
  assert.ok(h.height - h.swell - h.nearDrop > 0, 'a crest dips below the horizon: a gap in the range');
  assert.ok(0.5 + h.height + h.swell < 0.6, 'a crest climbs out of the haze band: a wall, not far mountains');
  assert.ok(h.groundFloor < 0.25, 'land under the near crest, not a void');
  const u = skyDome(ASCENT.mood).material.uniforms;
  assert.deepEqual(u.uHillMid.value.toArray(), [h.midShade, h.midDrop]);
  assert.deepEqual(u.uHillTint.value.toArray(), [h.farTint, h.midTint, h.nearTint]);
});

test('a mood without the middle layer or tints draws the two plain layers (Outskirts unchanged)', () => {
  const u = skyDome(OUTSKIRTS.mood).material.uniforms;
  assert.deepEqual(u.uHillMid.value.toArray(), [0, 0], 'no middle layer');
  assert.deepEqual(u.uHillTint.value.toArray(), [0, 0, 0], 'no pull toward the zenith');
});

test('the Ascent\'s sky is built with its ridges on', async () => {
  const { Level02 } = await import('../src/levels/level-02-ascent.js');
  const level = new Level02({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const dome = level.atmosphere.getObjectByName('sky-dome');
  assert.ok(dome, 'the Ascent has a sky dome');
  assert.equal(dome.material.uniforms.uHills.value.x, 1);
  assert.ok(dome.material.uniforms.uHillMid.value.x > 0, 'with its middle range');
  level.dispose();
});

// Renda (30 Oct): "I don't want them to be too similar to the hills in L1".
test('the Ascent\'s ridges are jagged mountains; Outskirts keeps its rolling hills', () => {
  assert.equal(skyDome(OUTSKIRTS.mood).material.uniforms.uHillJag.value, 0, 'Outskirts: rolling');
  assert.equal(skyDome(PRIMER.mood).material.uniforms.uHillJag.value, 0);
  const jag = skyDome(ASCENT.mood).material.uniforms.uHillJag.value;
  assert.ok(jag >= 0.8, 'the Ascent: mostly the all-ridged crest, or it reads as Outskirts again');
  assert.ok(ASCENT.mood.hills.swell > OUTSKIRTS.mood.hills.swell, 'mountains rise and fall more than hills');
});
