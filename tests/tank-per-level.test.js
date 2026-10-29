import test from 'node:test';
import assert from 'node:assert/strict';

import { AMMO, PAINT_GUN } from '../src/config.js';
import { LEVELS } from '../src/levels/index.js';
import { PaintGun } from '../src/paint/paint-gun.js';

/**
 * The tank is per-level and keyed by the REGISTRY ID (primer, outskirts,
 * ascent, last-colour) — the same string a level uses everywhere else.
 * A numeric key is what made #155 possible: `1` looked like "the default"
 * rather than "Outskirts", and every level got Outskirts' 100.
 *
 * These tests deliberately reference ids from `LEVELS`, so adding a fifth
 * level without a matching AMMO entry breaks the "every level has a tank"
 * test rather than silently giving it the Outskirts fallback.
 */

test('AMMO is keyed by registry id, not by number (#155)', () => {
  // If this ever goes back to `{ 1: 100, 2: 60, 3: 80 }`, the whole issue
  // returns. Assert the shape directly.
  assert.equal(typeof AMMO.primer, 'number');
  assert.equal(typeof AMMO.outskirts, 'number');
  assert.equal(typeof AMMO.ascent, 'number');
  assert.equal(typeof AMMO['last-colour'], 'number');

  // The old numeric keys must be gone — otherwise someone reading AMMO
  // cannot tell which shape is real.
  assert.equal(AMMO[1], undefined);
  assert.equal(AMMO[2], undefined);
  assert.equal(AMMO[3], undefined);
});

test('the design tank sizes are the ones in docs/DECISIONS.md (#155)', () => {
  assert.equal(AMMO.outskirts, 100, 'Outskirts: plentiful');
  assert.equal(AMMO.ascent, 60, 'The Ascent: starved — 15 shots');
  assert.equal(AMMO['last-colour'], 80, 'Last Colour: contested');
});

test('the tutorial has an explicit tank, not an accidental fallback (#155)', () => {
  assert.equal(AMMO.primer, 100,
    'the Primer is the tutorial; it should read Outskirts\' 100 explicitly, ' +
    'not silently fall through to some other level');
});

test('every registry level has an AMMO entry — a fifth level cannot ship without one (#155)', () => {
  for (const level of LEVELS) {
    assert.equal(
      typeof AMMO[level.id],
      'number',
      `level "${level.id}" has no AMMO entry — add it to config.js`,
    );
  }
});

test('building the Ascent\'s gun yields 60, not 100 (#155)', () => {
  // The exact acceptance criterion. `null` surfaces are fine — we are only
  // exercising the constructor's tank lookup, not the fire path.
  const gun = new PaintGun([], 'ascent', [], null);
  assert.equal(gun.maxAmmo, 60);
  assert.equal(gun.ammo, 60);
});

test('building the Outskirts gun yields 100 (#155)', () => {
  const gun = new PaintGun([], 'outskirts', [], null);
  assert.equal(gun.maxAmmo, 100);
});

test('building Last Colour\'s gun yields 80 (#155)', () => {
  const gun = new PaintGun([], 'last-colour', [], null);
  assert.equal(gun.maxAmmo, 80);
});

test('an unknown id falls back to Outskirts, loudly, not silently (#155)', () => {
  // Sanity: the constructor must not throw for an id it does not know, but it
  // must not hand out a tank that is neither defined nor the default either.
  const gun = new PaintGun([], 'not-a-real-level', [], null);
  assert.equal(gun.maxAmmo, AMMO.outskirts,
    'unknown id should fall back to the default tank, not crash');
});