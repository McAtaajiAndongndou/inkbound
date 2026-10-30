import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory localStorage so persistence can be checked in Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};

const { AudioManager } = await import('../src/audio/audio-manager.js');
const { AUDIO } = await import('../src/config.js');

test('starts at the config volume, unmuted', () => {
  store.clear();
  const a = new AudioManager();
  assert.equal(a.volume, AUDIO.volume);
  assert.equal(a.muted, false);
  assert.equal(a.effectiveVolume, AUDIO.volume);
});

test('mute silences without losing the chosen volume', () => {
  store.clear();
  const a = new AudioManager();
  a.setVolume(0.3);
  a.toggleMute();
  assert.equal(a.effectiveVolume, 0);
  a.toggleMute();
  assert.equal(a.effectiveVolume, 0.3);
});

test('volume is clamped to 0..1', () => {
  store.clear();
  const a = new AudioManager();
  a.setVolume(4);
  assert.equal(a.volume, 1);
  a.setVolume(-1);
  assert.equal(a.volume, 0);
  a.setVolume('nonsense');
  assert.equal(a.volume, 0);
});

test('volume and mute survive a reload', () => {
  store.clear();
  const a = new AudioManager();
  a.setVolume(0.25);
  a.setMuted(true);
  const b = new AudioManager();
  assert.equal(b.volume, 0.25);
  assert.equal(b.muted, true);
});

test('play() before unlock is a harmless no-op', () => {
  const a = new AudioManager();
  for (const name of ['fire', 'splat', 'hit', 'kill', 'telegraph', 'win', 'lose', 'unknown']) {
    assert.doesNotThrow(() => a.play(name));
  }
});

// A Web Audio stand-in that records every gain an envelope reaches and every
// node a recipe creates, so recipes can be checked without a sound card.
function fakeContext() {
  const peaks = [];
  const created = [];
  const param = (track) => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime(v) { if (track) track.peak = Math.max(track.peak, v); },
  });
  const node = (kind, extra = {}) => {
    created.push(kind);
    return { connect(n) { return n; }, start() {}, stop() {}, ...extra };
  };
  return {
    peaks,
    created,
    currentTime: 0,
    sampleRate: 8000,
    createOscillator: () => node('oscillator', { frequency: param() }),
    createBufferSource: () => node('bufferSource'),
    createBiquadFilter: () => node('biquad', { Q: param(), frequency: param() }),
    createGain() {
      const track = { peak: 0 };
      peaks.push(track);
      return node('gain', { gain: param(track) });
    },
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
  };
}

const { SFX } = await import('../src/audio/audio-manager.js');
const NEW_SOUNDS = ['claim', 'charge', 'gate', 'jump', 'land', 'spike', 'collapse'];

/** Summed envelope peaks: a rough "how loud is this recipe". */
function loudness(name) {
  const a = new AudioManager();
  a.ctx = fakeContext();
  a.master = { gain: { setTargetAtTime() {} } };
  a._noise = {};
  a.setMuted(false);
  a.setVolume(1);
  a.play(name);
  return { total: a.ctx.peaks.reduce((s, p) => s + p.peak, 0), created: a.ctx.created };
}

test('every #113 sound has a recipe', () => {
  for (const name of NEW_SOUNDS) assert.equal(typeof SFX[name], 'function', name);
});

test('every #113 sound is synthesised: oscillators, noise and filters, no asset', () => {
  const allowed = new Set(['oscillator', 'bufferSource', 'biquad', 'gain']);
  for (const name of NEW_SOUNDS) {
    const { created } = loudness(name);
    assert.ok(created.length > 0, `${name} makes a sound`);
    for (const kind of created) assert.ok(allowed.has(kind), `${name} built a ${kind}`);
  }
});

test('no #113 sound is louder than a splat — the world stays quiet', () => {
  const splat = loudness('splat').total;
  for (const name of NEW_SOUNDS) {
    const { total } = loudness(name);
    assert.ok(total < splat, `${name} (${total.toFixed(2)}) is not quieter than splat (${splat.toFixed(2)})`);
  }
});
