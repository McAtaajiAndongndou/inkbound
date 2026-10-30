// OWNER: E (UI & Audio)
// Mission intro (docs/mission-intro.md, PRD G4). Each mission opens with one
// camera move from the goal back to the player while a title card types out —
// Call of Duty 4's mission card over a Splatoon-style stage pan. It ends on the
// play camera, so control lands with no cut.
//
// The menu owns it, like the briefing: `menu.open` stays true while it plays, so
// main.js freezes the world (and the run clock, and the comms bar) without
// knowing the intro exists. main.js only moves the camera, from `progress`.
//
// Skipping uses the briefing's dismiss gate: a fresh key or click, never the
// click that locked the pointer, and the skipping input is swallowed.
import { MISSION_INTRO } from '../config.js';
import { createDismissGate } from './briefing.js';

/** The card's lines, in the order they type out. */
export const cardLines = (card) => [card.name, card.location, card.when, card.objective];

/** Ease in and out, so the camera neither lurches off nor slams into the player. */
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The timeline, free of the DOM so tests can step it. Phases:
 *   playing   camera moving, card typing
 *   leaving   camera home, card fading — control is about to land
 *   done      over
 */
export class IntroTimeline {
  constructor(card) {
    this.lines = cardLines(card);
    this.time = 0;
    this.phase = 'playing';
    this._leaving = 0;

    // When each line starts typing: one after another, a short pause between.
    let at = 0;
    this.starts = this.lines.map((line) => {
      const start = at;
      at += line.length / MISSION_INTRO.typeSpeed + MISSION_INTRO.linePause;
      return start;
    });
  }

  /** The camera's eased progress, 0 at the goal and 1 on the player. */
  get progress() {
    return this.phase === 'playing' ? ease(Math.min(1, this.time / MISSION_INTRO.moveTime)) : 1;
  }

  /** How much of each line is typed so far. */
  typed() {
    if (this.phase !== 'playing') return this.lines;
    return this.lines.map((line, i) =>
      line.slice(0, Math.max(0, Math.floor((this.time - this.starts[i]) * MISSION_INTRO.typeSpeed))));
  }

  /** How many lines have started typing — main.js blips once per new line. */
  get linesStarted() {
    return this.phase === 'playing' ? this.starts.filter((s) => s <= this.time).length : this.lines.length;
  }

  update(dt) {
    if (this.phase === 'playing') {
      this.time += dt;
      if (this.time >= MISSION_INTRO.moveTime) this.phase = 'leaving';
    } else if (this.phase === 'leaving') {
      this._leaving += dt;
      if (this._leaving >= MISSION_INTRO.fadeOut) this.phase = 'done';
    }
  }

  /** Camera straight home, card fades. */
  skip() {
    if (this.phase === 'playing') this.phase = 'leaving';
  }
}

export class MissionIntro {
  /**
   * @param {HTMLElement} parent
   * @param {object} [opts]
   * @param {() => boolean} [opts.isBlocked]  true while the pause menu is up —
   *   the intro then waits, frozen, underneath it
   * @param {() => void} [opts.onLine]       a line starts typing (the radio blip)
   */
  constructor(parent, { isBlocked = () => false, onLine = () => {} } = {}) {
    this.isBlocked = isBlocked;
    this.onLine = onLine;
    this.gate = createDismissGate();
    this.timeline = null;
    this.from = null;
    this._blips = 0;

    const el = document.createElement('div');
    el.id = 'mission-intro';
    el.className = 'hidden';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="intro-card">
        <h1 class="intro-name"></h1>
        <p class="intro-location"></p>
        <p class="intro-when"></p>
        <p class="intro-objective"></p>
      </div>
      <p class="intro-hint">Click or press any key to skip</p>
    `;
    parent.appendChild(el);
    this.el = el;
    this.fields = ['.intro-name', '.intro-location', '.intro-when', '.intro-objective'].map((s) => el.querySelector(s));

    // Capture phase on window, as the briefing does: runs before Input and
    // stops the skipping press reaching the game.
    const guard = (handler) => (e) => {
      if (!this.open || this.isBlocked()) return;
      e.stopPropagation();
      e.preventDefault();
      if (handler(e)) this.skip();
    };
    const onKey = guard((e) => this.gate.keydown(e));
    this._onKeyDown = (e) => { if (e.code !== 'Escape') onKey(e); };
    this._onMouseDown = guard((e) => this.gate.mousedown(e));
    this._onMouseUp = guard((e) => this.gate.mouseup(e));
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('mousedown', this._onMouseDown, true);
    window.addEventListener('mouseup', this._onMouseUp, true);
  }

  get open() {
    return this.timeline !== null;
  }

  /** The camera's eased progress (1 once skipped or when nothing is playing). */
  get progress() {
    return this.timeline?.progress ?? 1;
  }

  /**
   * @param {{ card: object, from: { pos: number[], target: number[] } | null }} intro
   */
  play(intro) {
    this.timeline = new IntroTimeline(intro.card);
    this.from = intro.from;
    this._blips = 0;
    this.gate.reset();
    this.el.classList.remove('hidden', 'leaving');
    this._render();
  }

  skip() {
    this.timeline?.skip();
    this._render();
  }

  /** Advance, unless the pause menu is over it. */
  update(dt) {
    if (!this.timeline || this.isBlocked()) return;
    this.timeline.update(dt);
    if (this.timeline.phase === 'done') {
      this.hide();
      return;
    }
    this._render();
  }

  hide() {
    this.timeline = null;
    this.from = null;
    this.el.classList.add('hidden');
  }

  _render() {
    const t = this.timeline;
    const typed = t.typed();
    this.fields.forEach((field, i) => { field.textContent = typed[i]; });
    this.el.classList.toggle('leaving', t.phase !== 'playing');
    while (this._blips < t.linesStarted) {
      this._blips++;
      if (t.phase === 'playing') this.onLine();
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('mousedown', this._onMouseDown, true);
    window.removeEventListener('mouseup', this._onMouseUp, true);
    this.el.remove();
  }
}
