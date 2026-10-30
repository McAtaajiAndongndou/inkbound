// Polish audit (30 Oct), the UI lane: the controls list (P0-3), pitch variance
// (P1-3), the new sounds, and the feedback cues — hurt (P0-4), low ink and tank
// full (P1-6), the rising refill (Q2), submerge (Q1) and grey (Q3).
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };

const { AudioManager, SFX } = await import('../src/audio/audio-manager.js');
const { CONTROLS } = await import('../src/ui/menu.js');
const { FeedbackCues, screenAngle } = await import('../src/ui/feedback.js');
const { COMMS_LINES } = await import('../src/ui/comms-lines.js');
const { AUDIO, FEEDBACK, DRY_OUT, SUBMERGE, PAINTSTREAK, PAINT } = await import('../src/config.js');

// --- P0-3 the controls list ----------------------------------------------------

test('the controls list advertises no refill key, and lists submerge and paintstreak (P0-3)', () => {
  const keys = CONTROLS.map(([k]) => k);
  assert.ok(!keys.includes('F'), 'there is no refill button: refill is standing in your paint');
  assert.ok(!CONTROLS.some(([, what]) => /refill ammo/i.test(what)));
  assert.ok(keys.includes('Shift') && SUBMERGE.key.startsWith('Shift'), 'Shift is submerge, and it is bound');
  assert.ok(keys.includes('Q') && PAINTSTREAK.key === 'KeyQ', 'Q is the paintstreak, and it is bound');
});

test('the Primer has a submerge line for R2\'s pool', () => {
  assert.match(COMMS_LINES['primer-submerge'].text, /Shift/);
});

// --- the audio manager ---------------------------------------------------------

/** A Web Audio stand-in recording every frequency and envelope peak. */
function fakeContext() {
  const log = { freqs: [], peaks: [] };
  const param = (kind) => ({
    value: 0,
    setValueAtTime(v) { if (kind === 'f') log.freqs.push(v); },
    setTargetAtTime() {},
    exponentialRampToValueAtTime(v) { if (kind === 'g') log.peaks.push(v); },
  });
  const node = (extra = {}) => ({ connect(n) { return n; }, start() {}, stop() {}, ...extra });
  return {
    log,
    currentTime: 0,
    sampleRate: 8000,
    createOscillator: () => node({ frequency: param('f') }),
    createBufferSource: () => node(),
    createBiquadFilter: () => node({ Q: param(), frequency: param('f') }),
    createGain: () => node({ gain: param('g') }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
  };
}
function manager(random = () => 0.5) {
  store.clear();
  const a = new AudioManager();
  a.ctx = fakeContext();
  a.master = { gain: { setTargetAtTime() {} } };
  a._noise = {};
  a.setVolume(1);
  a.random = random;
  return a;
}

test('every play is detuned by at most ±6%, and two plays are not identical (P1-3)', () => {
  const lo = manager(() => 0);
  lo.play('fire');
  const hi = manager(() => 1);
  hi.play('fire');
  const mid = manager(() => 0.5);
  mid.play('fire');
  const base = mid.ctx.log.freqs[0];
  assert.ok(Math.abs(lo.ctx.log.freqs[0] / base - (1 - AUDIO.pitchVariance)) < 1e-9);
  assert.ok(Math.abs(hi.ctx.log.freqs[0] / base - (1 + AUDIO.pitchVariance)) < 1e-9);
  assert.equal(AUDIO.pitchVariance, 0.06);
});

test('`gain` scales a sound (distance) and `pitch` raises it (the refill tone)', () => {
  const full = manager();
  full.play('crush');
  const far = manager();
  far.play('crush', { gain: 0.25 });
  // The envelope ramps to its gain, then down to a fixed floor (0.0001): count the gains.
  const sum = (a) => a.ctx.log.peaks.filter((p) => p > 0.001).reduce((s, p) => s + p, 0);
  assert.ok(Math.abs(sum(far) - sum(full) * 0.25) < 1e-9);
  const up = manager();
  up.play('refill', { pitch: 1.5 });
  const flat = manager();
  flat.play('refill');
  assert.ok(Math.abs(up.ctx.log.freqs[0] / flat.ctx.log.freqs[0] - 1.5) < 1e-9);
  const silent = manager();
  silent.play('crush', { gain: 0 });
  assert.equal(silent.ctx.log.freqs.length, 0, 'a gain of 0 builds nothing');
});

test('the detune is reset after each play, even when a recipe throws', () => {
  const a = manager(() => 1);
  SFX.__boom = () => { throw new Error('boom'); };
  assert.throws(() => a.play('__boom'));
  delete SFX.__boom;
  assert.equal(a._pitch, 1);
  assert.equal(a._gain, 1);
});

const AUDIT_SOUNDS = ['vent', 'crush', 'hiss', 'tick', 'creak', 'hurt', 'submergeIn', 'submergeOut', 'refill',
  'tankFull', 'lowInk', 'sludge', 'freeze', 'shatter', 'pin', 'slam', 'siphon', 'solved', 'siphonDown'];

test('every sound the audit asked for has a synthesised recipe, and the cut blade is gone', () => {
  for (const name of AUDIT_SOUNDS) {
    assert.equal(typeof SFX[name], 'function', name);
    const a = manager();
    a.play(name);
    assert.ok(a.ctx.log.freqs.length > 0, `${name} makes a sound`);
  }
  assert.equal(SFX.blade, undefined, 'defined and never played: deleted');
});

test('the new sounds stay under a splat, the footstep and refill well under', () => {
  const loud = (name) => { const a = manager(); a.play(name); return a.ctx.log.peaks.reduce((s, p) => s + p, 0); };
  const splat = loud('splat');
  for (const name of AUDIT_SOUNDS) assert.ok(loud(name) < splat, `${name} is not quieter than a splat`);
  for (const name of ['sludge', 'refill', 'tick']) assert.ok(loud(name) < splat * 0.25, `${name} repeats, so it must be quiet`);
});

// --- the feedback cues ---------------------------------------------------------

function rig() {
  const heard = [];
  const cues = new FeedbackCues({ play: (name, opts) => heard.push({ name, ...opts }) });
  const player = {
    health: 100, dead: false, submerged: false, currentColour: 'blue', onGround: true,
    velocity: { x: 0, y: 0, z: 0 }, yaw: 0, position: { x: 0, y: 0, z: 0 },
  };
  const gun = { ammo: 100, maxAmmo: 100 };
  const step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) cues.update(dt, { player, gun }); };
  return { cues, heard, player, gun, step, names: () => heard.map((h) => h.name) };
}

test('a hit thuds, pulses the vignette, points the arc at its source, then fades (P0-4)', () => {
  const { cues, player, step, names } = rig();
  step();
  player.health = 75;
  player.lastHurtFrom = { x: 10, y: 0, z: 0 };   // to the player's right (yaw 0 faces -z)
  player.lastHurtAge = 0;
  step();
  assert.deepEqual(names(), ['hurt']);
  assert.ok(cues.hurt > 0.9);
  assert.ok(cues.arc > 0.9);
  assert.ok(Math.abs(cues.arcAngle - Math.PI / 2) < 1e-9, 'the arc points right');
  step(60 * FEEDBACK.hurtArcFade + 2);
  assert.equal(cues.hurt, 0);
  assert.equal(cues.arc, 0);
  assert.deepEqual(names(), ['hurt'], 'one hit, one thud');
});

test('a hit with no known source still thuds and pulses, with no arc', () => {
  const { cues, player, step, names } = rig();
  step();
  player.health = 90;
  step();
  assert.deepEqual(names(), ['hurt']);
  assert.ok(cues.hurt > 0.9);
  assert.equal(cues.arc, 0);
});

test('screenAngle: ahead is 0, behind is PI, left is -PI/2', () => {
  const p = { yaw: 0, position: { x: 0, z: 0 } };
  assert.ok(Math.abs(screenAngle(p, { x: 0, z: -5 })) < 1e-9);
  assert.ok(Math.abs(Math.abs(screenAngle(p, { x: 0, z: 5 })) - Math.PI) < 1e-9);
  assert.ok(Math.abs(screenAngle(p, { x: -5, z: 0 }) + Math.PI / 2) < 1e-9);
});

test('low ink warns once on the way down; full dings once on the way up (P1-6)', () => {
  const { gun, step, names } = rig();
  step();
  for (let a = 100; a >= 4; a -= 4) { gun.ammo = a; step(); }
  assert.equal(names().filter((n) => n === 'lowInk').length, 1);
  assert.ok(gun.ammo / gun.maxAmmo < DRY_OUT.warningBelow);
  for (let a = gun.ammo; a <= 100; a += 1) { gun.ammo = Math.min(100, a); step(); }
  gun.ammo = 100;
  step(10);
  assert.equal(names().filter((n) => n === 'tankFull').length, 1);
});

test('filling bubbles at a rising pitch (Q2); a level load is not a refill', () => {
  const { cues, heard, gun, step } = rig();
  gun.ammo = 0;
  step();
  for (let i = 0; i < 300 && gun.ammo < 100; i++) { gun.ammo = Math.min(100, gun.ammo + 0.5); step(); }
  const bubbles = heard.filter((h) => h.name === 'refill');
  assert.ok(bubbles.length > 10, 'it bubbles while it fills');
  assert.ok(bubbles.at(-1).pitch > bubbles[0].pitch, 'and the pitch rises with the tank');
  assert.ok(bubbles.every((b) => b.pitch <= 1 + FEEDBACK.refillRise + 1e-9));
  const before = heard.length;
  cues.reset();
  gun.ammo = 100;
  step();
  assert.equal(heard.length, before, 'reset: a fresh full tank makes no sound');
});

test('submerging splashes in and out, and tints the screen edge your ground colour (Q1)', () => {
  const { cues, player, step, names } = rig();
  step();
  player.submerged = true;
  step();
  assert.deepEqual(cues.edge, { colour: `#${PAINT.blue.hex.toString(16).padStart(6, '0')}`, alpha: FEEDBACK.submergeTint });
  player.submerged = false;
  step();
  assert.deepEqual(names(), ['submergeIn', 'submergeOut']);
  assert.equal(cues.edge, null);
});

test('walking on grey squelches at a footstep rhythm and drains the edge; standing still is quiet (Q3)', () => {
  const { cues, player, step, names } = rig();
  player.currentColour = 'grey';
  step(60);
  assert.deepEqual(names(), [], 'standing on grey: no steps');
  assert.equal(cues.edge.alpha, FEEDBACK.greyEdge, 'but the edge is drained');
  player.velocity = { x: 4, y: 0, z: 0 };
  step(60);
  const steps = names().filter((n) => n === 'sludge').length;
  assert.ok(Math.abs(steps - Math.ceil(1 / FEEDBACK.stepInterval)) <= 1, `${steps} steps a second`);
  player.currentColour = 'blue';
  const n = names().length;
  step(60);
  assert.equal(names().length, n, 'paint underfoot: no sludge');
});
