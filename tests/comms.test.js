import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const { CommsTimeline, COMMS, holdTime } = await import('../src/ui/comms.js');
const { COMMS_LINES } = await import('../src/ui/comms-lines.js');

const LINES = {
  summit: { who: 'Sergeant', text: 'Hold here a moment.' },
  ledge: { who: 'Sergeant', text: 'Good. Keep moving.' },
  unwritten: { who: 'Sergeant', text: null },
};

// Silence the bar's own warnings (unwritten / dropped lines) in test output.
const quiet = (fn) => () => {
  const warn = console.warn;
  console.warn = () => {};
  try { fn(); } finally { console.warn = warn; }
};

/** Step the timeline `seconds` forward in 50 ms frames. */
function run(t, seconds, inCombat = false) {
  for (let s = 0; s < seconds; s += 0.05) t.update(0.05, inCombat);
}

test('a requested line slides in, holds, fades out and clears with no input (#112)', () => {
  const t = new CommsTimeline(LINES);
  assert.equal(t.request('summit'), true);
  t.update(0.05, false);
  assert.equal(t.phase, 'showing');
  run(t, COMMS.slideIn + holdTime(LINES.summit.text) - 0.2);
  assert.equal(t.phase, 'showing', 'still up for the readable hold');
  run(t, 0.4);
  assert.equal(t.phase, 'leaving');
  run(t, COMMS.fadeOut + 0.1);
  assert.equal(t.phase, 'idle');
});

test('the hold is a readable few seconds, whatever the line length', () => {
  assert.equal(holdTime('Go.'), COMMS.holdMin);
  assert.equal(holdTime('x'.repeat(500)), COMMS.holdMax);
});

test('a line asked for mid-fight waits for calm, then shows', () => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, 3, true);
  assert.equal(t.phase, 'waiting', 'never appears during combat');
  t.update(0.05, false);
  assert.equal(t.phase, 'showing');
});

test('if calm never comes the line is dropped, not shown late', quiet(() => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, COMMS.maxWait + 0.5, true);
  assert.equal(t.phase, 'idle');
}));

test('a fight starting clears a line that is already up', () => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, 1);
  t.update(0.05, true);
  assert.equal(t.phase, 'leaving');
});

test('skippable: skip takes the line down at once', () => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, 1);
  t.skip();
  assert.equal(t.phase, 'leaving');
});

test('at most one line: a second request while one is up is refused', () => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, 1);
  assert.equal(t.request('ledge'), false);
  assert.equal(t.line, LINES.summit);
});

test('each line plays once per level; reset (restart) makes it available again', () => {
  const t = new CommsTimeline(LINES);
  t.request('summit');
  run(t, 15);
  assert.equal(t.request('summit'), false, 'not twice in one run');
  t.reset();
  assert.equal(t.request('summit'), true);
});

test('an unwritten or unknown line stays silent', quiet(() => {
  const t = new CommsTimeline(LINES);
  assert.equal(t.request('unwritten'), false);
  assert.equal(t.request('no-such-line'), false);
  assert.equal(t.phase, 'idle');
}));

test('every line a level asks for exists in COMMS_LINES', () => {
  const dir = 'src/levels';
  const asked = readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .flatMap((f) => [...readFileSync(`${dir}/${f}`, 'utf8').matchAll(/game\.say\?\.\(\s*'([^']+)'/g)].map((m) => m[1]));
  assert.ok(asked.length > 0, 'expected levels to request lines');
  for (const id of asked) assert.ok(id in COMMS_LINES, `levels ask for "${id}" but comms-lines.js has no entry`);
});

test('each written line is one short line under a name plate', () => {
  for (const [id, line] of Object.entries(COMMS_LINES)) {
    assert.ok(line.who, `${id} has a name plate`);
    if (line.text) assert.ok(line.text.length <= 90, `${id} is ${line.text.length} chars`);
  }
});
