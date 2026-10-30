// Far hills drawn into the sky dome (Renda, 30 Oct): one continuous line all the
// way round, in the sky's own colours, replacing the dropped 3D ridge (grey
// geometry with gaps). Opt-in per mood: Outskirts has them, nothing else does.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { skyDome } from '../src/levels/mood.js';
import { OUTSKIRTS, PRIMER } from '../src/config.js';
import { Level01 } from '../src/levels/level-01-mission.js';

test('a mood with hills turns them on with its numbers; one without leaves them off', () => {
  const on = skyDome(OUTSKIRTS.mood).material.uniforms;
  const h = OUTSKIRTS.mood.hills;
  assert.deepEqual(on.uHills.value.toArray(), [1, h.height, h.swell, h.soft]);
  assert.deepEqual(on.uHillShade.value.toArray(), [h.farShade, h.nearShade, h.nearDrop]);
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

test('the crest wave closes on itself all the way round (whole-number frequencies)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/levels/mood.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('float crest('), src.indexOf('void main', src.indexOf('float crest(')));
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
