import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector/promises';

// Input wires listeners onto window/document — stub them for Node.
const noop = () => {};
globalThis.window ??= { addEventListener: noop, removeEventListener: noop };
globalThis.document ??= { addEventListener: noop, removeEventListener: noop };

const { Input } = await import('../src/core/input.js');

function makeInput() {
  return new Input({ addEventListener: noop, removeEventListener: noop, requestPointerLock: noop });
}

const press = (input, code) => input._onKeyDown({ code, preventDefault: noop });

test('every one-shot action survives consumeActions (refill included)', () => {
  const input = makeInput();
  for (const code of ['Space', 'KeyV', 'KeyR', 'Digit4', 'KeyF']) press(input, code);

  const a = input.consumeActions();
  assert.equal(a.jump, true);
  assert.equal(a.toggleView, true);
  assert.equal(a.restart, true);
  assert.equal(a.colour, 3);
  assert.equal(a.refill, true);
});

test('consumeActions hands out every pending field, whatever gets added later', () => {
  const input = makeInput();
  const a = input.consumeActions();
  assert.deepEqual(Object.keys(a).sort(), Object.keys(input.pending).sort());
});

test('actions fire once: the next frame is cleared', () => {
  const input = makeInput();
  press(input, 'KeyF');
  press(input, 'Digit2');
  input.consumeActions();

  const next = input.consumeActions();
  assert.equal(next.refill, false);
  assert.equal(next.colour, null);
});

test('consumeMouse returns the delta once, then zero', () => {
  const input = makeInput();
  input.locked = true;
  input._onMouseMove({ movementX: 5, movementY: -3 });
  input._onMouseMove({ movementX: 2, movementY: 1 });

  const m = input.consumeMouse();
  assert.deepEqual([m.x, m.y], [7, -2]);
  const again = input.consumeMouse();
  assert.deepEqual([again.x, again.y], [0, 0]);
});

test('consume*() reuse their result objects instead of allocating', () => {
  const input = makeInput();
  assert.equal(input.consumeActions(), input.consumeActions());
  assert.equal(input.consumeMouse(), input.consumeMouse());
});

test('consume*() allocate (almost) nothing per frame', async () => {
  const input = makeInput();
  input.locked = true;
  const move = { movementX: 1, movementY: 1 };
  const key = { code: 'KeyF', preventDefault: noop };
  // keep the results, like main.js does by handing them to player.update —
  // otherwise V8 sees they never escape and optimises the allocation away
  const sink = { actions: null, mouse: null };
  const frame = (i) => {
    if (i % 10 === 0) input._onKeyDown(key);
    input._onMouseMove(move);
    sink.actions = input.consumeActions();
    sink.mouse = input.consumeMouse();
  };
  for (let i = 0; i < 20000; i++) frame(i); // warm up the JIT

  const session = new Session();
  session.connect();
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 256,
    includeObjectsCollectedByMinorGC: true,
    includeObjectsCollectedByMajorGC: true,
  });
  const FRAMES = 50000;
  for (let i = 0; i < FRAMES; i++) frame(i);
  const { profile } = await session.post('HeapProfiler.stopSampling');
  session.disconnect();

  // Count everything under frame(): V8 inlines consume*() into it, so the
  // profiler charges their allocations to frame itself. frame() allocates
  // nothing of its own (its event objects are hoisted above).
  let bytes = 0;
  (function walk(node, inside) {
    const here = inside || node.callFrame.functionName === 'frame';
    if (here) bytes += node.selfSize;
    node.children.forEach((c) => walk(c, here));
  })(profile.head, false);

  // a fresh object per call is ~30+ bytes; spread-copying pending is more
  const perFrame = bytes / FRAMES;
  assert.ok(perFrame < 8, `consume*() allocated ${perFrame.toFixed(1)} bytes/frame`);
});
