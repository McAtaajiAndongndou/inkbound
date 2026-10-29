// OWNER: E (UI & Audio)
// Comms bar (#112, PRD G2/G3). The sergeant's one line per level: a name plate
// and one short line, bottom centre. It slides in, holds long enough to read,
// and fades — no click. Same visual language as the briefing still (#111).
//
// A level asks for a line by id through `game.say(id)` (main.js) and knows
// nothing else: not the text, not the bar. The bar knows nothing of the level:
// main.js tells it each frame whether the player is in combat, and that is all
// it needs to keep the one rule — a line must never cost the player health.
// So a line asked for mid-fight WAITS for calm, and is dropped (with a warning,
// because then the trigger is wrong) if calm never comes. A line already up
// clears the moment a fight starts.

import { COMMS_LINES } from './comms-lines.js';

export const COMMS = {
  slideIn: 0.35,      // s, matches the CSS transition
  fadeOut: 0.6,       // s, matches the CSS transition
  holdBase: 2,        // s, plus holdPerChar per character...
  holdPerChar: 0.05,
  holdMin: 3.5,       // ...clamped to a readable few seconds
  holdMax: 7,
  maxWait: 10,        // s a requested line waits for calm before it is dropped
  skipKey: 'Enter',
};

/** How long a line stays fully up, in seconds. */
export const holdTime = (text) =>
  Math.min(COMMS.holdMax, Math.max(COMMS.holdMin, COMMS.holdBase + text.length * COMMS.holdPerChar));

/**
 * The bar's timing, free of the DOM so tests can step it. One line at a time:
 * idle → waiting (for calm) → showing → leaving → idle.
 */
export class CommsTimeline {
  constructor(lines = COMMS_LINES) {
    this.lines = lines;
    this.reset();
  }

  /** New level: nothing up, nothing waiting, every line available again. */
  reset() {
    this.phase = 'idle';
    this.line = null;
    this.timer = 0;
    this._said = new Set();
  }

  /**
   * Ask for line `id`. Returns false when it will not be shown: unknown or not
   * yet written, already said this level, or another line is waiting or up.
   */
  request(id) {
    const line = this.lines[id];
    if (!line?.text) {
      console.warn(`[comms] no line written for "${id}"`);
      return false;
    }
    if (this._said.has(id) || this.phase !== 'idle') return false;
    this._said.add(id);
    this.line = line;
    this.phase = 'waiting';
    this.timer = 0;
    return true;
  }

  /** Skip the line on screen (or the one waiting). */
  skip() {
    if (this.phase === 'showing') this._leave();
    else if (this.phase === 'waiting') this._clear();
  }

  /** @param {number} dt  @param {boolean} inCombat */
  update(dt, inCombat) {
    this.timer += dt;
    switch (this.phase) {
      case 'waiting':
        if (!inCombat) {
          this.phase = 'showing';
          this.timer = 0;
        } else if (this.timer >= COMMS.maxWait) {
          console.warn(`[comms] dropped "${this.line.text}" — the player never left combat; move the trigger`);
          this._clear();
        }
        break;
      case 'showing':
        if (inCombat || this.timer >= COMMS.slideIn + holdTime(this.line.text)) this._leave();
        break;
      case 'leaving':
        if (this.timer >= COMMS.fadeOut) this._clear();
        break;
    }
  }

  _leave() {
    this.phase = 'leaving';
    this.timer = 0;
  }

  _clear() {
    this.phase = 'idle';
    this.line = null;
    this.timer = 0;
  }
}

export class CommsBar {
  /** @param {HTMLElement} parent  the HUD root */
  constructor(parent, lines = COMMS_LINES) {
    this.timeline = new CommsTimeline(lines);

    const el = document.createElement('div');
    el.id = 'comms';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="comms-who"></span><p class="comms-line"></p>';
    parent.appendChild(el);
    this.el = el;
    this.who = el.querySelector('.comms-who');
    this.text = el.querySelector('.comms-line');
    this._phase = 'idle';

    this._onKey = (e) => {
      if (e.code === COMMS.skipKey && !e.repeat) this.timeline.skip();
    };
    window.addEventListener('keydown', this._onKey);
  }

  /** A level asks for line `id` (through `game.say`). */
  say(id) {
    return this.timeline.request(id);
  }

  /** Level load or restart: clear the bar and forget what was said. */
  reset() {
    this.timeline.reset();
    this._render();
  }

  /** Call from the gameplay step, so the bar holds still while paused. */
  update(dt, inCombat) {
    this.timeline.update(dt, inCombat);
    this._render();
  }

  _render() {
    const { phase, line } = this.timeline;
    if (phase === this._phase) return;
    this._phase = phase;
    if (phase === 'showing') {
      this.who.textContent = line.who;
      this.text.textContent = line.text;
    }
    this.el.classList.toggle('show', phase === 'showing');
    this.el.classList.toggle('leaving', phase === 'leaving');
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.el.remove();
  }
}
