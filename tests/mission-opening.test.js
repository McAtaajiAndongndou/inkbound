import test from 'node:test';
import assert from 'node:assert/strict';

const { MissionOpening } = await import('../src/ui/mission-opening.js');

/** Stand-ins for the two overlays: each records whether it is up. */
function opening(level) {
  const briefing = { up: false, show() { this.up = true; }, hide() { this.up = false; } };
  const intro = { up: null, play(data) { this.up = data.id; }, hide() { this.up = null; } };
  const o = new MissionOpening({ briefing, intro, introFor: (id) => ({ id }) }, level);
  return { o, briefing, intro };
}

test('#221: leaving the Primer mid-briefing takes the briefing down before the next intro', () => {
  const { o, briefing, intro } = opening('primer');
  o.start();
  assert.equal(briefing.up, true, 'the Primer opens on its briefing');
  // Pause → level select → Outskirts, with the briefing never dismissed.
  assert.equal(o.levelLoaded('outskirts'), true);
  assert.equal(briefing.up, false, 'the old sergeant line goes with the old level');
  o.start();
  assert.equal(intro.up, 'outskirts');
  assert.equal(briefing.up, false, 'the Outskirts intro plays alone');
});

test('leaving a level mid-intro drops that intro', () => {
  const { o, intro } = opening('outskirts');
  o.start();
  o.levelLoaded('ascent');
  assert.equal(intro.up, null, 'the old intro is gone before the new one starts');
  o.start();
  assert.equal(intro.up, 'ascent');
});

test('a restart reopens nothing', () => {
  const { o, briefing, intro } = opening('ascent');
  o.start();
  intro.hide();
  assert.equal(o.levelLoaded('ascent'), false);
  o.start();
  assert.equal(intro.up, null);
  assert.equal(briefing.up, false);
});

test('arriving in the Primer from another level opens its briefing, not an intro', () => {
  const { o, briefing, intro } = opening('outskirts');
  o.start();
  o.levelLoaded('primer');
  o.start();
  assert.equal(briefing.up, true);
  assert.equal(intro.up, null);
});
