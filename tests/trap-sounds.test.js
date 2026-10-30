// #215: the trap sounds were too small to survive the mix (QA heard nothing
// from the spike pit or the crusher). Each now has a loud-enough node, the
// spike outlasts `hurt`'s attack, and a distance fade still scales them.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem() {} };
const { AudioManager } = await import('../src/audio/audio-manager.js');

/** A WebAudio stand-in recording each envelope's peak and when it ends. */
function record(name, opts) {
  const envs = [];
  const param = (env) => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime(v, at) {
      if (!env) return;
      env.peak = Math.max(env.peak, v);
      env.end = Math.max(env.end, at);
    },
  });
  const node = (extra = {}) => ({ connect(n) { return n; }, start() {}, stop() {}, ...extra });
  const a = new AudioManager();
  a.ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createOscillator: () => node({ frequency: param() }),
    createBufferSource: () => node(),
    createBiquadFilter: () => node({ Q: param(), frequency: param() }),
    createGain: () => { const env = { peak: 0, end: 0 }; envs.push(env); return node({ gain: param(env) }); },
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
  };
  a.master = { gain: { setTargetAtTime() {} } };
  a._noise = {};
  a.random = () => 0.5;   // no pitch detune
  a.setMuted(false);
  a.setVolume(1);
  a.play(name, opts);
  return envs;
}

const TARGET = { spike: 0.3, crush: 0.4, tick: 0.15, hiss: 0.12 };

for (const [name, peak] of Object.entries(TARGET)) {
  test(`#215: ${name} has a node at peak gain >= ${peak}`, () => {
    const loudest = Math.max(...record(name).map((e) => e.peak));
    assert.ok(loudest >= peak - 1e-9, `${name} peaks at ${loudest}`);
  });
}

test('#215: spike lasts >= 0.15 s, outlasting hurt', () => {
  const spike = Math.max(...record('spike').map((e) => e.end));
  const hurt = Math.max(...record('hurt').map((e) => e.end));
  assert.ok(spike >= 0.15, `spike ends at ${spike}`);
  assert.ok(spike > hurt * 0.9, 'spike is not buried under hurt');
});

test('#215: the distance fade still halves every node', () => {
  for (const name of Object.keys(TARGET)) {
    const full = record(name).map((e) => e.peak);
    const half = record(name, { gain: 0.5 }).map((e) => e.peak);
    full.forEach((p, i) => assert.ok(Math.abs(half[i] - p / 2) < 1e-9, `${name} node ${i}`));
  }
});
