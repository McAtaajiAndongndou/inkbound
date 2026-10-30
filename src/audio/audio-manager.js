// OWNER: E (UI & Audio)
// Web Audio SFX: gun, splat, hit, enemy telegraph, win/lose.
// Sound is named inside the 25% Gameplay & Experience band — it is not optional.
// Browsers block audio until first user gesture: the context is only created
// in unlock(), which main.js calls from a click/keypress, never on page load.
import { AUDIO } from '../config.js';
import { Music } from './music.js';

const STORAGE_KEY = 'inkbound.audio';

/**
 * Every sound is synthesised — no asset files to load, nothing to dispose,
 * and it works offline on the lab machines. One master gain node carries
 * volume and mute, so the options menu only ever touches that.
 *
 *   audio.play('fire' | 'splat' | 'hit' | 'kill' | 'telegraph' | 'win' | 'lose')
 *   world (#113): 'claim' | 'charge' | 'gate' | 'jump' | 'land'
 *   traps (#113): 'spike' | 'collapse'
 *   polish audit: traps 'vent' | 'crush' | 'hiss' | 'tick' | 'creak';
 *     you 'hurt' | 'submergeIn' | 'submergeOut' | 'refill' | 'tankFull' |
 *     'lowInk' | 'sludge'; combos 'freeze' | 'shatter' | 'pin';
 *     set pieces 'slam' | 'siphon' | 'solved' | 'siphonDown'
 *
 *   audio.play(name, { gain, pitch }) — `gain` (0..1) scales the recipe, for a
 *   sound heard from a distance; `pitch` multiplies every frequency in it. On
 *   top of `pitch`, EVERY play is detuned by up to ±AUDIO.pitchVariance
 *   (polish audit P1-3): you fire 7 shots a second, and identical blips at
 *   that rate are what tires the ear.
 *
 * Every gameplay sound is played from the gameplay step, which main.js skips
 * while the menu is open — so nothing new plays behind the pause menu.
 *
 * Safe to call before unlock() or in Node: play() is a no-op without a context.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._pitch = 1;         // per-play detune and gain, set by play()
    this._gain = 1;
    this._noise = null;      // one shared white-noise buffer for every noisy SFX

    this.volume = AUDIO.volume;
    this.muted = false;
    this._load();
    // #199 — the adaptive music, on its own bus into this one's master, so the
    // Music slider never touches the effects and Volume/mute still cover both.
    this.music = new Music(this);
  }

  /** Create/resume the context. Call from a user gesture; repeat calls are cheap. */
  unlock() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this._noise = this._makeNoise();
      this._applyGain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this._applyGain();
    this._save();
  }

  setMuted(m) {
    this.muted = !!m;
    this._applyGain();
    this._save();
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  /** The gain that actually reaches the speakers. */
  get effectiveVolume() {
    return this.muted ? 0 : this.volume;
  }

  play(name, { gain = 1, pitch = 1 } = {}) {
    if (!this.ctx || this.effectiveVolume === 0 || !(gain > 0)) return;
    const sfx = SFX[name];
    if (!sfx) return;
    // Recipes read these through _tone/_burst; reset after, so a recipe that
    // throws cannot leave the next sound detuned.
    this._pitch = pitch * (1 + (this.random() * 2 - 1) * AUDIO.pitchVariance);
    this._gain = Math.min(1, gain);
    try {
      sfx(this, this.ctx.currentTime);
    } finally {
      this._pitch = 1;
      this._gain = 1;
    }
  }

  /** 0..1. A method so the tests can pin the detune. */
  random() {
    return Math.random();
  }

  // --- building blocks ----------------------------------------------------

  /** A pitched blip: oscillator from f0 to f1 over `dur`, with a fast attack. */
  _tone(t, { type = 'sine', f0, f1 = f0, dur, gain = 0.3 }) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0 * this._pitch, t);
    osc.frequency.exponentialRampToValueAtTime(f1 * this._pitch, t + dur);
    this._envelope(env, t, dur, gain * this._gain);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise — the "wet" half of fire and splat. */
  _burst(t, { filter = 'lowpass', f0, f1 = f0, q = 1, dur, gain = 0.3 }) {
    const src = this.ctx.createBufferSource();
    const biquad = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    src.buffer = this._noise;
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(f0 * this._pitch, t);
    biquad.frequency.exponentialRampToValueAtTime(f1 * this._pitch, t + dur);
    this._envelope(env, t, dur, gain * this._gain);
    src.connect(biquad).connect(env).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _envelope(env, t, dur, gain) {
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _applyGain() {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(this.effectiveVolume, this.ctx.currentTime, 0.01);
  }

  // Volume is a per-player preference, so it lives in their browser. Storage
  // can throw (private mode, blocked site data) — the defaults still work.
  _load() {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
      if (saved) {
        if (typeof saved.volume === 'number') this.volume = Math.max(0, Math.min(1, saved.volume));
        this.muted = !!saved.muted;
      }
    } catch { /* defaults */ }
  }

  _save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ volume: this.volume, muted: this.muted }));
    } catch { /* not persisted, still applied */ }
  }
}

// Each sound is a tiny recipe on top of _tone/_burst. Tweak by ear here.
// Exported for the tests only; call sites go through audio.play(name).
export const SFX = {
  fire: (a, t) => {
    a._burst(t, { filter: 'bandpass', f0: 2400, f1: 700, q: 1.2, dur: 0.09, gain: 0.25 });
  },
  splat: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 1800, f1: 200, q: 2, dur: 0.18, gain: 0.35 });
    a._tone(t, { type: 'sine', f0: 180, f1: 70, dur: 0.12, gain: 0.25 });
  },
  hit: (a, t) => {
    a._tone(t, { type: 'square', f0: 1300, f1: 1100, dur: 0.06, gain: 0.12 });
  },
  kill: (a, t) => {
    a._tone(t, { type: 'square', f0: 900, dur: 0.06, gain: 0.12 });
    a._tone(t + 0.07, { type: 'square', f0: 1500, f1: 1400, dur: 0.12, gain: 0.12 });
    a._burst(t, { filter: 'lowpass', f0: 1200, f1: 150, dur: 0.25, gain: 0.3 });
  },
  telegraph: (a, t) => {
    // a rising whine: long enough to read as "something is about to happen"
    a._tone(t, { type: 'sawtooth', f0: 220, f1: 660, dur: 0.45, gain: 0.08 });
  },

  // --- the world around combat (#113) --------------------------------------
  // Short and quiet on purpose: none of these may be louder than a splat. The
  // test suite holds that line (tests/audio-manager.test.js).

  // A shot that TAKES ground — grey or another colour turned yours — rather than
  // repainting your own. The splat plus a small upward lift, so claiming reads
  // apart from just hitting the floor.
  claim: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 1600, f1: 220, q: 2, dur: 0.16, gain: 0.28 });
    a._tone(t + 0.02, { type: 'sine', f0: 320, f1: 560, dur: 0.12, gain: 0.07 });
  },
  // The Charger's coil before a charge: the telegraph's whine, shorter and lower,
  // because the coil itself is only ~0.2 s.
  charge: (a, t) => {
    a._tone(t, { type: 'sawtooth', f0: 140, f1: 420, dur: 0.24, gain: 0.07 });
  },
  // A mission intro's title card line typing in: a soft radio blip (G4).
  blip: (a, t) => {
    a._tone(t, { type: 'sine', f0: 1400, f1: 1250, dur: 0.05, gain: 0.05 });
  },
  // An encounter gate opening: a low clunk, then the field lifting.
  gate: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 500, f1: 90, q: 1, dur: 0.3, gain: 0.16 });
    a._tone(t + 0.08, { type: 'triangle', f0: 220, f1: 440, dur: 0.5, gain: 0.1 });
  },
  jump: (a, t) => {
    a._burst(t, { filter: 'bandpass', f0: 900, f1: 1800, q: 1.5, dur: 0.06, gain: 0.06 });
  },
  land: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 420, f1: 110, q: 1, dur: 0.1, gain: 0.12 });
  },

  // Traps (#113). Each plays when the trap fires, not every frame it exists.
  // Spike pit: a dry metallic snap as the spikes come up.
  spike: (a, t) => {
    a._burst(t, { filter: 'highpass', f0: 2600, f1: 1800, q: 1, dur: 0.07, gain: 0.12 });
    a._tone(t, { type: 'square', f0: 1700, f1: 1500, dur: 0.04, gain: 0.05 });
  },
  // Collapsing segment: a crumble, falling in pitch as it gives way.
  collapse: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 900, f1: 120, q: 1, dur: 0.5, gain: 0.16 });
    a._burst(t + 0.12, { filter: 'lowpass', f0: 600, f1: 90, q: 1, dur: 0.35, gain: 0.1 });
  },
  // (The swinging blade's swoosh was here. The blades are cut, so it went too.)

  // --- polish audit: traps you can hear (the levels lane plays them by distance)
  // Vent eruption: a pressurised hiss with a low thump under it.
  vent: (a, t) => {
    a._burst(t, { filter: 'highpass', f0: 1800, f1: 3200, q: 0.8, dur: 0.6, gain: 0.13 });
    a._tone(t, { type: 'sine', f0: 110, f1: 60, dur: 0.18, gain: 0.12 });
  },
  // Crusher drop: a heavy metal clank. The beat.
  crush: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 700, f1: 80, q: 1.5, dur: 0.32, gain: 0.2 });
    a._tone(t, { type: 'square', f0: 240, f1: 170, dur: 0.09, gain: 0.07 });
  },
  // Crusher rise: hydraulic hiss.
  hiss: (a, t) => {
    a._burst(t, { filter: 'bandpass', f0: 2200, f1: 1400, q: 2, dur: 0.45, gain: 0.07 });
  },
  // Warning-lamp tick: a dry click on each blink of the tell.
  tick: (a, t) => {
    a._tone(t, { type: 'square', f0: 2400, f1: 2300, dur: 0.025, gain: 0.05 });
  },
  // Catwalk step-on: a low metal groan.
  creak: (a, t) => {
    a._tone(t, { type: 'sawtooth', f0: 95, f1: 70, dur: 0.35, gain: 0.06 });
    a._burst(t, { filter: 'bandpass', f0: 600, f1: 400, q: 6, dur: 0.3, gain: 0.05 });
  },

  // --- polish audit: what happens to YOU ------------------------------------
  // Hurt (P0-4): a dull body thud and a short low buzz. Not a beep: a beep is a UI sound.
  hurt: (a, t) => {
    a._tone(t, { type: 'sine', f0: 150, f1: 55, dur: 0.16, gain: 0.26 });
    a._burst(t, { filter: 'lowpass', f0: 900, f1: 120, q: 1, dur: 0.14, gain: 0.16 });
  },
  // Submerge: a wet plunge in, a lighter splash out (Splatoon's swim is mostly sound).
  submergeIn: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 2400, f1: 180, q: 3, dur: 0.22, gain: 0.2 });
    a._tone(t, { type: 'sine', f0: 420, f1: 140, dur: 0.16, gain: 0.08 });
  },
  submergeOut: (a, t) => {
    a._burst(t, { filter: 'bandpass', f0: 500, f1: 2600, q: 2, dur: 0.16, gain: 0.14 });
  },
  // Refill: a soft bubble, played repeatedly while the tank fills at a pitch
  // that rises with the tank (the `pitch` option), so filling is a rising tone.
  refill: (a, t) => {
    a._tone(t, { type: 'sine', f0: 520, f1: 760, dur: 0.06, gain: 0.05 });
  },
  // Tank full: Splatoon's ding, a clean two-note click.
  tankFull: (a, t) => {
    a._tone(t, { type: 'triangle', f0: 1320, dur: 0.06, gain: 0.12 });
    a._tone(t + 0.06, { type: 'triangle', f0: 1760, dur: 0.12, gain: 0.12 });
  },
  // Low ink (P1-6): two falling blips before empty, heard while you watch the fight.
  lowInk: (a, t) => {
    a._tone(t, { type: 'square', f0: 880, f1: 820, dur: 0.05, gain: 0.06 });
    a._tone(t + 0.09, { type: 'square', f0: 660, f1: 600, dur: 0.07, gain: 0.06 });
  },
  // Grey footstep: a sticky, damp squelch. Corp paint grabs your boots.
  sludge: (a, t) => {
    a._burst(t, { filter: 'lowpass', f0: 380, f1: 140, q: 4, dur: 0.12, gain: 0.07 });
  },

  // --- polish audit: the combo (P1-5). The enemies lane plays these -----------
  // Blue freeze lands: a crisp, glassy crackle.
  freeze: (a, t) => {
    a._burst(t, { filter: 'highpass', f0: 3800, f1: 5200, q: 2, dur: 0.18, gain: 0.1 });
    a._tone(t, { type: 'sine', f0: 1900, f1: 2600, dur: 0.14, gain: 0.06 });
  },
  // Freeze-shatter crit: glass breaking with weight under it. The best combo, so the biggest of these.
  shatter: (a, t) => {
    a._burst(t, { filter: 'highpass', f0: 2600, f1: 900, q: 1, dur: 0.32, gain: 0.2 });
    a._tone(t, { type: 'triangle', f0: 1600, f1: 400, dur: 0.22, gain: 0.1 });
    a._tone(t, { type: 'sine', f0: 140, f1: 60, dur: 0.2, gain: 0.1 });
  },
  // Green pin: a sticky clamp.
  pin: (a, t) => {
    a._burst(t, { filter: 'bandpass', f0: 700, f1: 300, q: 5, dur: 0.12, gain: 0.12 });
    a._tone(t, { type: 'square', f0: 330, f1: 300, dur: 0.05, gain: 0.05 });
  },

  // --- polish audit: set pieces ---------------------------------------------
  // Big Arm's slam: a deep boom.
  slam: (a, t) => {
    a._tone(t, { type: 'sine', f0: 90, f1: 35, dur: 0.45, gain: 0.22 });
    a._burst(t, { filter: 'lowpass', f0: 600, f1: 60, q: 1, dur: 0.4, gain: 0.08 });
  },
  // The Siphon reveals a target: a low machine hum, rising.
  siphon: (a, t) => {
    a._tone(t, { type: 'sawtooth', f0: 110, f1: 220, dur: 0.7, gain: 0.06 });
  },
  // A Siphon target takes its colour.
  solved: (a, t) => {
    a._tone(t, { type: 'triangle', f0: 660, f1: 990, dur: 0.18, gain: 0.1 });
  },
  // The Siphon goes down: the machine winding down, a long fall in pitch.
  siphonDown: (a, t) => {
    a._tone(t, { type: 'sawtooth', f0: 330, f1: 55, dur: 1.4, gain: 0.08 });
    a._burst(t + 0.3, { filter: 'lowpass', f0: 800, f1: 80, q: 1, dur: 1.0, gain: 0.08 });
  },
  win: (a, t) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      a._tone(t + i * 0.11, { type: 'triangle', f0: f, dur: 0.3, gain: 0.25 }));
  },
  lose: (a, t) => {
    [392, 330, 262].forEach((f, i) =>
      a._tone(t + i * 0.18, { type: 'triangle', f0: f, f1: f * 0.94, dur: 0.4, gain: 0.25 }));
  },
};

/** One manager for the whole game. Enemies import this to play 'telegraph'. */
export const audio = new AudioManager();
