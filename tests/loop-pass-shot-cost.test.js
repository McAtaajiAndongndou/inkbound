// Loop pass step 3 (quality plan §3.1): a full tank emptied in ~3.5 s of
// trigger, so painting, the core verb, was the scarcest thing in the game.
// The shot now costs half, so the trigger lasts about twice as long, and the
// refill rates stay as they were, so submerge is still the fast reload.
import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT_GUN, AMMO, SUBMERGE } from '../src/config.js';

const triggerSeconds = (tank) => (tank / PAINT_GUN.cost) * PAINT_GUN.fireDelay;

test('step 3: a full standard tank lasts about 7 s of trigger, not 3.5 s', () => {
  const s = triggerSeconds(AMMO.outskirts ?? 100);
  assert.ok(s >= 6.5 && s <= 7.5, `a tank lasts ${s.toFixed(2)} s of trigger`);
});

test('step 3: the Ascent is still the starved level, and submerge is still the fast reload', () => {
  for (const [id, tank] of Object.entries(AMMO)) {
    if (id !== 'ascent') assert.ok(AMMO.ascent < tank, `the Ascent's tank should stay smaller than ${id}'s`);
  }
  assert.ok(SUBMERGE.refillMultiplier > 1, 'submerged refill must beat standing refill');
});
