// OWNER: E (UI & Audio)
// Adaptive, synthesised music (#199). No downloaded track: every note is an
// oscillator, built from the same parts as the sound effects.
//
// THREE LAYERS, one per idea in the theme — the world is drained, you put the
// colour back, and the fight is the price:
//
//   drone   Corp. A low, detuned, slowly beating pad through a low-pass filter.
//           Always on; the filter CLOSES as your territory grows, so the cold
//           recedes as the colour comes in.
//   colour  You. An arpeggio in the level's key whose gain follows territory
//           (the HUD's number, #127). Each paint colour you have fired adds a
//           voice: blue a high bell, red a plucked bass, green a mid marimba.
//   combat  The fight. Kick and noise-snare, in while `inCombat` is true (the
//           comms bar's rule, #112), out MUSIC.combatHold seconds after.
//
// Splatoon's music changes with the match; Ape Out and Rez build theirs out of
// the game's own state. Same idea, at student scale.
//
// SCHEDULING. update() runs once a frame and schedules every note that falls in
// the next MUSIC.lookAhead seconds ON THE WEB AUDIO CLOCK — the classic
// look-ahead scheduler (Chris Wilson's "A Tale of Two Clocks"). No setTimeout:
// a frame hitch never makes a note late, because the note's time was set ahead
// in the audio thread's own clock. The only allocation per note is the
// oscillator/gain nodes Web Audio itself requires.
//
// VOLUME. The music has its own bus (the options menu's Music slider) feeding
// the master (Volume), so Music 0 silences the music and not the effects. The
// bus ducks by MUSIC.duck while the sergeant is talking.
import { MUSIC } from '../config.js';

const STORAGE_KEY = 'inkbound.music';

/** Equal temperament: the frequency `semitones` above `root`. */
const note = (root, semitones) => root * Math.pow(2, semitones / 12);

export class Music {
  /** @param {import('./audio-manager.js').AudioManager} audio  the master bus owner */
  constructor(audio) {
    this.audio = audio;
    this.volume = MUSIC.volume;
    this.levelId = null;
    this.key = null;            // the current level's MUSIC.levels entry
    this.heard = { blue: false, red: false, green: false };
    // Logical 0..1 levels, pushed to the gain params when they move.
    this.level = { colour: 0, combat: 0, duck: 0, filter: 0 };
    this._combatHold = 0;
    this._wasInCombat = false;
    this._fightTime = 0;        // how long the current fight has run
    this._step = 0;
    this._nextTime = 0;
    this._nodes = null;         // built lazily, once the audio context exists
    this._drone = null;         // this level's drone oscillators
    this._load();
  }

  // --- volume (the Music slider) -------------------------------------------

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this._applyBus();
    this._save();
  }

  // --- level ------------------------------------------------------------------

  /**
   * Switch to level `id`'s key and tempo and forget the last level's colours.
   * Safe before the audio is unlocked: it builds on the first update() after.
   */
  start(id) {
    this.levelId = id;
    this.key = MUSIC.levels[id] ?? MUSIC.levels.default;
    this.heard.blue = this.heard.red = this.heard.green = false;
    this.level.colour = 0;
    this.level.combat = 0;
    this._combatHold = 0;
    this._wasInCombat = false;
    this._fightTime = 0;
    this._step = 0;
    if (this._nodes) this._startDrone();
  }

  /**
   * Once a frame. `territory` 0..1 (the HUD's coverage), `inCombat` the comms
   * bar's rule, `talking` true while a comms line is up, `colour` the colour
   * just fired (or null) — it adds that colour's voice for the rest of the level.
   * Returns the clear stinger's name when a fight has just ended, for the tests.
   */
  update(dt, { territory = 0, inCombat = false, talking = false, colour = null } = {}) {
    if (colour && colour in this.heard) this.heard[colour] = true;

    // colour layer: 0 at no territory, full at MUSIC.fullAt
    this.level.colour = Math.min(1, Math.max(0, territory / MUSIC.fullAt));
    this.level.filter = this.level.colour;

    // combat layer: in within combatFadeIn, held combatHold s after the fight,
    // then out over combatFadeOut
    let cleared = null;
    if (inCombat) {
      this._combatHold = MUSIC.combatHold;
      this._fightTime += dt;
      this.level.combat = Math.min(1, this.level.combat + dt / MUSIC.combatFadeIn);
    } else {
      // A real fight ended: the clear stinger. A one-frame blip (a trap's hurt
      // timer) is not a fight, and a death or a win has its own stinger.
      if (this._wasInCombat && this._fightTime >= MUSIC.clearMinFight) cleared = 'clear';
      this._fightTime = 0;
      if (this._combatHold > 0) this._combatHold -= dt;
      else this.level.combat = Math.max(0, this.level.combat - dt / MUSIC.combatFadeOut);
    }
    this._wasInCombat = inCombat;

    // the sergeant: duck under the line, recover after it
    this.level.duck = talking ? 1 : Math.max(0, this.level.duck - dt / MUSIC.duckRelease);

    if (!this._ensureNodes()) return cleared;
    if (cleared) this.stinger('clear');
    this._applyLayers();
    this._schedule();
    return cleared;
  }

  /** The gain the music bus is driven to: Music slider × duck. */
  get busGain() {
    return this.volume * (1 - MUSIC.duck * Math.min(1, this.level.duck));
  }

  /** The colour layer's gain, 0 at no territory and MUSIC.gains.colour at full. */
  get colourGain() {
    return MUSIC.gains.colour * this.level.colour;
  }

  get combatGain() {
    return MUSIC.gains.combat * this.level.combat;
  }

  // --- stingers -----------------------------------------------------------------

  /** 'clear' a rising chord, 'death' a falling one, 'win' a full cadence. */
  stinger(name) {
    // A death or a win ends the fight: no clear stinger on top of it.
    if (name !== 'clear') this._fightTime = 0;
    if (!this._ensureNodes() || !this.key) return;
    const t = this.audio.ctx.currentTime + 0.02;
    const root = this.key.root;
    const chords = MUSIC.stingers[name];
    if (!chords) return;
    for (let c = 0; c < chords.length; c++) {
      const chord = chords[c];
      for (let i = 0; i < chord.length; i++) {
        this._voice(this._nodes.bus, t + c * MUSIC.stingerStep + i * MUSIC.stingerSpread,
          'triangle', note(root * 2, chord[i]), MUSIC.stingerLength, MUSIC.gains.stinger);
      }
    }
  }

  // --- the nodes ------------------------------------------------------------------

  /** Build the bus and the three layer gains once the context exists. */
  _ensureNodes() {
    const ctx = this.audio.ctx;
    if (!ctx || !this.audio.master) return false;
    if (this._nodes) return true;
    const bus = ctx.createGain();
    const drone = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const colour = ctx.createGain();
    const combat = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = MUSIC.droneOpen;
    drone.gain.value = MUSIC.gains.drone;
    colour.gain.value = 0;
    combat.gain.value = 0;
    bus.gain.value = this.busGain;
    filter.connect(drone).connect(bus);
    colour.connect(bus);
    combat.connect(bus);
    bus.connect(this.audio.master);
    this._nodes = { bus, drone, filter, colour, combat };
    this._nextTime = ctx.currentTime + 0.05;
    if (this.key) this._startDrone();
    return true;
  }

  /** The Corp drone: two detuned saws an octave below the root, and its fifth. */
  _startDrone() {
    const ctx = this.audio.ctx;
    this._stopDrone();
    const root = this.key.root / 2;
    const freqs = [root, root * (1 + MUSIC.droneDetune), note(root, 7)];
    this._drone = freqs.map((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(this._nodes.filter);
      osc.start();
      return osc;
    });
  }

  _stopDrone() {
    if (!this._drone) return;
    for (const osc of this._drone) {
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect?.();
    }
    this._drone = null;
  }

  _applyLayers() {
    const t = this.audio.ctx.currentTime;
    const s = MUSIC.smoothing;
    const n = this._nodes;
    n.colour.gain.setTargetAtTime(this.colourGain, t, s);
    n.combat.gain.setTargetAtTime(this.combatGain, t, s);
    n.bus.gain.setTargetAtTime(this.busGain, t, s);
    const cutoff = MUSIC.droneOpen + (MUSIC.droneClosed - MUSIC.droneOpen) * this.level.filter;
    n.filter.frequency.setTargetAtTime(cutoff, t, MUSIC.filterSmoothing);
  }

  _applyBus() {
    if (!this._nodes) return;
    this._nodes.bus.gain.setTargetAtTime(this.busGain, this.audio.ctx.currentTime, MUSIC.smoothing);
  }

  /** Schedule every eighth-note step inside the look-ahead window. */
  _schedule() {
    if (!this.key) return;
    const ctx = this.audio.ctx;
    const stepDur = 60 / this.key.tempo / 2;
    // After a long stall (a backgrounded tab), skip ahead rather than burst.
    if (this._nextTime < ctx.currentTime) this._nextTime = ctx.currentTime + 0.02;
    while (this._nextTime < ctx.currentTime + MUSIC.lookAhead) {
      this._playStep(this._step, this._nextTime, stepDur);
      this._nextTime += stepDur;
      this._step = (this._step + 1) % MUSIC.pattern.length;
    }
  }

  _playStep(step, t, stepDur) {
    const k = this.key;
    // Pattern entries index the scale and wrap up an octave past its end.
    const p = MUSIC.pattern[step];
    const degree = k.scale[p % k.scale.length] + 12 * Math.floor(p / k.scale.length);
    const n = this._nodes;
    if (this.level.colour > 0.001) {
      // green: the mid marimba, every step
      if (this.heard.green) this._voice(n.colour, t, 'sine', note(k.root, degree), stepDur * 1.6, MUSIC.voices.green);
      // blue: a high bell on every other step, two octaves up
      if (this.heard.blue && step % 2 === 0) this._voice(n.colour, t, 'triangle', note(k.root * 4, degree), stepDur * 3, MUSIC.voices.blue);
      // red: a plucked bass on the beat, root or fifth
      if (this.heard.red && step % 4 === 0) this._voice(n.colour, t, 'triangle', note(k.root / 2, step % 8 === 0 ? 0 : 7), stepDur * 1.2, MUSIC.voices.red);
    }
    if (this.level.combat > 0.001) {
      if (step % 4 === 0) this._kick(t);
      if (step % 4 === 2) this._snare(t);
    }
  }

  /** One enveloped note into `dest`. */
  _voice(dest, t, type, freq, dur, gain) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _kick(t) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(MUSIC.voices.kick, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(env).connect(this._nodes.combat);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  _snare(t) {
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = this.audio._noise;
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(MUSIC.voices.snare, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(hp).connect(env).connect(this._nodes.combat);
    src.start(t);
    src.stop(t + 0.16);
  }

  // --- persistence (a per-player preference, like Volume) ------------------------

  _load() {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved.volume === 'number') this.volume = Math.max(0, Math.min(1, saved.volume));
    } catch { /* defaults */ }
  }

  _save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ volume: this.volume }));
    } catch { /* not persisted, still applied */ }
  }
}
