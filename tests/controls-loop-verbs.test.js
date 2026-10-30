// #228: a new player reads the controls cold. Submerge (Shift) and the
// paintstreak (Q) are the loop's verbs, so they are near the top, and each
// says what it does and when.
import test from 'node:test';
import assert from 'node:assert/strict';

const { CONTROLS } = await import('../src/ui/menu.js');
const at = (key) => CONTROLS.findIndex(([k]) => k === key);

test('#228: Shift and Q are in the first rows, right after the paint they build on', () => {
  assert.ok(at('Shift') >= 0 && at('Shift') < 6, `Shift is entry ${at('Shift') + 1}`);
  assert.ok(at('Q') >= 0 && at('Q') < 6, `Q is entry ${at('Q') + 1}`);
  assert.ok(at('Click') < at('Shift') && at('Shift') < at('Q'), 'paint, then refill, then spend');
});

test('#228: each says what it does and when', () => {
  const what = (key) => CONTROLS[at(key)][1];
  assert.match(what('Shift'), /submerge/i);
  assert.match(what('Shift'), /refill/i);
  assert.match(what('Q'), /paintstreak/i);
  assert.match(what('Q'), /full/i, 'the gauge must be full');
});
