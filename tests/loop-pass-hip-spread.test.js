// Loop pass step 7 (quality plan §3.2): hip-fire and aiming felt the same,
// because hip spread (0.025) was close to ADS (0.005). Hip-fire now spreads
// wider (0.06), so hip paints and aiming duels.
import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT_GUN } from '../src/config.js';

test('step 7: hip-fire is clearly looser than aiming', () => {
  assert.equal(PAINT_GUN.hipSpread, 0.06);
  assert.ok(PAINT_GUN.hipSpread >= 10 * PAINT_GUN.adsSpread, 'hip should be at least ten times wider than ADS');
});
