// #224 (QA B10): a black circle in the Ascent's sky followed the cursor. The
// dome (radius 450, past the base) is bigger than the camera's far plane
// (400), so the part straight ahead was clipped and the dark background showed
// through, centred on the view. The dome now draws ON the far plane.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { skyDome } from '../src/levels/mood.js';
import { CameraRig } from '../src/core/camera-rig.js';
import { ASCENT } from '../src/config.js';

test('#224: the dome is pinned to the far plane, so no radius can be clipped', () => {
  const dome = skyDome(ASCENT.mood, ASCENT.mood.skyRadius);
  assert.match(dome.material.vertexShader, /gl_Position\s*=\s*\w+\.xyww/);
  assert.equal(dome.material.depthWrite, false, 'whatever is drawn in front still wins');
});

test('#224: why it mattered — the Ascent dome is bigger than the camera reaches', () => {
  const far = new CameraRig(16 / 9).camera.far;
  assert.ok(ASCENT.mood.skyRadius > far,
    'if this ever fails, the dome fits inside the far plane and the pin is belt-and-braces');
});
