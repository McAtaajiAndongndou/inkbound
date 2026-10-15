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
