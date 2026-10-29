import test from 'node:test';
import assert from 'node:assert/strict';

const { createDismissGate, BRIEFING_LINE } = await import('../src/ui/briefing.js');

const key = (code, repeat = false) => ({ code, repeat });
const mouse = (button = 0) => ({ button });

test('the click that locked the pointer cannot skip the still (#111)', () => {
  const gate = createDismissGate();
  // Its press happened before the still appeared; only the release can land here.
  assert.equal(gate.mouseup(mouse()), false);
});

test('a fresh click skips at once, on release', () => {
  const gate = createDismissGate();
  assert.equal(gate.mousedown(mouse()), false, 'not on the press — the trigger would still be down');
  assert.equal(gate.mouseup(mouse()), true);
});

test('only the left button dismisses', () => {
  const gate = createDismissGate();
  gate.mousedown(mouse(2));
  assert.equal(gate.mouseup(mouse(2)), false);
});

test('any fresh key skips; a held key repeating does not, and Escape is the menu\'s', () => {
  const gate = createDismissGate();
  assert.equal(gate.keydown(key('Space')), true);
  assert.equal(gate.keydown(key('KeyW', true)), false);
  assert.equal(gate.keydown(key('Escape')), false);
});

test('showing again forgets a press from before', () => {
  const gate = createDismissGate();
  gate.mousedown(mouse());
  gate.reset();
  assert.equal(gate.mouseup(mouse()), false);
});

test('the briefing is two lines at most and says why, not how', () => {
  // ~80 characters wraps to two lines on the 720p frame at the line's size.
  assert.ok(BRIEFING_LINE.length <= 90, `briefing line is ${BRIEFING_LINE.length} chars`);
  assert.doesNotMatch(BRIEFING_LINE, /\b(WASD|click|press|key|mouse)\b/i, 'controls live in the pause menu');
});
