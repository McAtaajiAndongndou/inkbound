// #199 — adaptive synthesised music.
//
// Before: no music anywhere in src/. These tests pin the three layers against
// the game state that drives them (territory, combat, the sergeant), the Music
// slider's independence from the effects, a key and tempo per level, the
// look-ahead scheduler and the stingers. Web Audio is stubbed, as in
// audio-manager.test.js: every node records what it was asked to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};

const { AudioManager } = await import('../src/audio/audio-manager.js');
const { MUSIC } = await import('../src/config.js');
const { LEVELS } = await import('../src/levels/index.js');
const { OURS } = await import('../src/ui/credits.js');

function fakeContext() {
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    oscillators: [],
    created: [],
  };
  const param = (value = 0) => ({
    value,
    target: value,
    setValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.target = v; },
    exponentialRampToValueAtTime() {},
  });
  const node = (kind, extra = {}) => {
    ctx.created.push(kind);
    return { kind, connect(n) { return n; }, disconnect() {}, start(t) { this.startAt = t; }, stop() { this.stopped = true; }, ...extra };
  };
  ctx.createOscillator = () => {
    const o = node('oscillator', { frequency: param(440), type: 'sine' });
    ctx.oscillators.push(o);
    return o;
  };
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('biquad', { Q: param(1), frequency: param(350), type: 'lowpass' });
  ctx.createBufferSource = () => node('bufferSource');
  ctx.createBuffer = () => ({ getChannelData: () => new Float32Array(1) });
  return ctx;
}

/** An AudioManager on the stub, unlocked, with music started on `level`. */
function rig(level = 'outskirts') {
  store.clear();
  const a = new AudioManager();
  a.ctx = fakeContext();
  a.master = a.ctx.createGain();
  a._noise = {};
  a.setVolume(1);
  a.music.start(level);
  a.music.update(0, {});
  return { a, m: a.music, ctx: a.ctx };
}

const run = (m, ctx, seconds, state, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) {
    ctx.currentTime += dt;
    m.update(dt, typeof state === 'function' ? state() : state);
  }
};

test('colour layer: silent at territory 0, at its configured maximum from MUSIC.fullAt', () => {
  const { m, ctx } = rig();
  run(m, ctx, 0.5, { territory: 0 });
  assert.equal(m.colourGain, 0);
  assert.equal(m._nodes.colour.gain.target, 0);
  run(m, ctx, 0.5, { territory: MUSIC.fullAt / 2 });
  assert.ok(m.colourGain > 0 && m.colourGain < MUSIC.gains.colour, 'it grows with the territory');
  run(m, ctx, 0.5, { territory: MUSIC.fullAt + 0.1 });
  assert.equal(m.colourGain, MUSIC.gains.colour);
  assert.equal(m._nodes.colour.gain.target, MUSIC.gains.colour);
});

test('the drone is always on, and its filter closes as territory grows', () => {
  const { m, ctx } = rig();
  run(m, ctx, 0.2, { territory: 0 });
  assert.ok(m._drone.length >= 2 && m._drone.every((o) => o.type === 'sawtooth'));
  assert.equal(m._nodes.filter.frequency.target, MUSIC.droneOpen);
  run(m, ctx, 0.2, { territory: MUSIC.fullAt });
  assert.equal(m._nodes.filter.frequency.target, MUSIC.droneClosed);
});

test('combat layer: in within combatFadeIn, out combatHold seconds after the fight', () => {
  const { m, ctx } = rig();
  run(m, ctx, 1, { inCombat: false });
  assert.equal(m.combatGain, 0);
  run(m, ctx, MUSIC.combatFadeIn + 1 / 60, { inCombat: true });
  assert.equal(m.combatGain, MUSIC.gains.combat, 'full within combatFadeIn');
  run(m, ctx, MUSIC.combatHold - 0.1, { inCombat: false });
  assert.equal(m.combatGain, MUSIC.gains.combat, 'held for combatHold after the fight');
  run(m, ctx, 0.2 + MUSIC.combatFadeOut + 1 / 30, { inCombat: false });
  assert.equal(m.combatGain, 0, 'gone after the hold and the fade');
});

test('the Music slider at 0 silences the music but not the effects', () => {
  const { a, m, ctx } = rig();
  run(m, ctx, 0.2, { territory: 1, inCombat: true });
  m.setVolume(0);
  run(m, ctx, 0.1, { territory: 1, inCombat: true });
  assert.equal(m._nodes.bus.gain.target, 0, 'the music bus is shut');
  assert.equal(a.effectiveVolume, 1, 'the master (effects) is untouched');
  const before = ctx.created.length;
  a.play('splat');
  assert.ok(ctx.created.length > before, 'effects still play');
  // ...and it persists like Volume does.
  const b = new AudioManager();
  assert.equal(b.music.volume, 0);
});

test('every level has its own key and tempo, and switching level switches them', () => {
  const seen = new Set();
  for (const entry of LEVELS) {
    const k = MUSIC.levels[entry.id];
    assert.ok(k, `${entry.id} has a MUSIC.levels entry`);
    assert.ok(k.root > 0 && k.tempo > 0 && k.scale.length >= 5);
    seen.add(`${k.root}@${k.tempo}`);
  }
  assert.equal(seen.size, LEVELS.length, 'four levels, four sounds');

  const { m, ctx } = rig('primer');
  const droneOf = () => m._drone.map((o) => o.frequency.value);
  const primerDrone = droneOf();
  assert.equal(m.key, MUSIC.levels.primer);
  const old = m._drone;
  m.start('last-colour');
  assert.equal(m.key, MUSIC.levels['last-colour']);
  assert.ok(old.every((o) => o.stopped), 'the old drone stops');
  assert.notDeepEqual(droneOf(), primerDrone, 'the drone moves to the new key');

  // The tempo drives the scheduler: eighth notes at the level's BPM.
  const countSteps = (id) => {
    const r = rig(id);
    r.a.music.heard.green = true;
    const startOsc = r.ctx.oscillators.length;
    run(r.m, r.ctx, 4, { territory: 1, colour: 'green' });
    return r.ctx.oscillators.length - startOsc;
  };
  const slow = countSteps('primer');
  const fast = countSteps('last-colour');
  const ratio = fast / slow;
  const want = MUSIC.levels['last-colour'].tempo / MUSIC.levels.primer.tempo;
  assert.ok(Math.abs(ratio - want) < 0.08, `note rate ratio ${ratio.toFixed(2)}, tempo ratio ${want.toFixed(2)}`);
  void ctx;
});

test('ducking: the music drops by MUSIC.duck while a comms line plays, then recovers', () => {
  const { m, ctx } = rig();
  run(m, ctx, 0.2, { talking: false });
  assert.equal(m._nodes.bus.gain.target, m.volume);
  run(m, ctx, 0.2, { talking: true });
  assert.ok(Math.abs(m._nodes.bus.gain.target - m.volume * (1 - MUSIC.duck)) < 1e-9);
  run(m, ctx, MUSIC.duckRelease + 0.1, { talking: false });
  assert.equal(m._nodes.bus.gain.target, m.volume);
});

test('notes are scheduled ahead on the audio clock, never by setTimeout', () => {
  const { m, ctx } = rig();
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => { throw new Error('setTimeout used by the music'); };
  try {
    run(m, ctx, 2, { territory: 1, inCombat: true, colour: 'blue' });
  } finally {
    globalThis.setTimeout = realTimeout;
  }
  const notes = ctx.oscillators.filter((o) => o.startAt !== undefined);
  assert.ok(notes.length >= 4, `${notes.length} notes in 2 s`);
  for (const o of notes) {
    assert.ok(o.startAt <= ctx.currentTime + MUSIC.lookAhead + 1e-9, 'never more than the look-ahead into the future');
  }
});

test('each colour fired adds its own voice', () => {
  const { m, ctx } = rig();
  const root = MUSIC.levels.outskirts.root;
  run(m, ctx, 1, { territory: 1 });
  assert.equal(ctx.oscillators.filter((o) => o.startAt > 0).length, 0, 'no colour fired: only the drone');
  run(m, ctx, 1, { territory: 1, colour: 'blue' });
  const bells = ctx.oscillators.filter((o) => o.type === 'triangle' && o.frequency.value >= root * 4 - 1);
  assert.ok(bells.length > 0, 'blue: a high bell');
  run(m, ctx, 1, { territory: 1, colour: 'red' });
  const bass = ctx.oscillators.filter((o) => o.type === 'triangle' && o.frequency.value <= root);
  assert.ok(bass.length > 0, 'red: a plucked bass');
  run(m, ctx, 1, { territory: 1, colour: 'green' });
  const marimba = ctx.oscillators.filter((o) => o.type === 'sine' && o.frequency.value >= root && o.frequency.value < root * 4);
  assert.ok(marimba.length > 0, 'green: a mid marimba');
  m.start('outskirts');
  assert.deepEqual(m.heard, { blue: false, red: false, green: false }, 'a new level starts colourless');
});

test('stingers: a rising chord on a clear (not on a blip), a falling one on death, a cadence on the win', () => {
  const { m, ctx } = rig();
  let cleared = null;
  run(m, ctx, 0.2, { inCombat: true });
  cleared = m.update(1 / 60, { inCombat: false });
  assert.equal(cleared, null, 'a 0.2 s blip is not a fight');

  run(m, ctx, MUSIC.clearMinFight + 0.5, { inCombat: true });
  const before = ctx.oscillators.length;
  cleared = m.update(1 / 60, { inCombat: false });
  assert.equal(cleared, 'clear');
  const chord = ctx.oscillators.slice(before).map((o) => o.frequency.value);
  assert.ok(chord.length >= MUSIC.stingers.clear[0].length);
  assert.ok(chord.every((f, i) => i === 0 || f > chord[i - 1]), 'rising');

  run(m, ctx, MUSIC.clearMinFight + 0.5, { inCombat: true });
  const b2 = ctx.oscillators.length;
  m.stinger('death');
  const fall = ctx.oscillators.slice(b2).map((o) => o.frequency.value);
  assert.ok(fall.every((f, i) => i === 0 || f < fall[i - 1]), 'falling');
  assert.equal(m.update(1 / 60, { inCombat: false }), null, 'a death has its own stinger, not the clear');

  const b3 = ctx.oscillators.length;
  m.stinger('win');
  const notes = MUSIC.stingers.win.reduce((n, c) => n + c.length, 0);
  assert.equal(ctx.oscillators.length - b3, notes, 'the full cadence');
});

test('safe before unlock and in Node: nothing builds, nothing throws', () => {
  store.clear();
  const a = new AudioManager();
  assert.doesNotThrow(() => {
    a.music.start('ascent');
    a.music.update(1 / 60, { territory: 0.5, inCombat: true, talking: true, colour: 'red' });
    a.music.stinger('win');
  });
  assert.equal(a.music._nodes, null);
});

test('the credits say the music is ours, and the menu has a Music slider', () => {
  assert.ok(OURS.includes('Music: synthesised in-game by the Inkbound team'));
  const menu = readFileSync(new URL('../src/ui/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /<label class="menu-row">Music\s*<input id="opt-music" type="range"/);
  assert.match(menu, /audio\.music\?\.setVolume\(this\.music\.value \/ 100\)/);
});
