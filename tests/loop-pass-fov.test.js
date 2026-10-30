// Loop pass step 8 (quality plan §5): the third-person field of view 70 -> 78,
// so more of the fight is on screen. Aiming still zooms in.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMERA } from '../src/config.js';

test('step 8: a wider normal view, and aiming still narrows it', () => {
  assert.equal(CAMERA.normalFov, 78);
  assert.ok(CAMERA.adsFov < CAMERA.normalFov - 20, 'aiming must still read as a zoom');
});
