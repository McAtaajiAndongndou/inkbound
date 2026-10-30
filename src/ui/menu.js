// OWNER: E (UI & Audio)
// Pause menu + options. RESTART WITHOUT PAGE REFRESH — explicit rubric item.
//
// The menu is open whenever the pointer is NOT locked: on first load (title)
// and after Escape (paused). main.js reads `menu.open` and freezes the game
// while it is up, so enemies cannot hurt you behind the menu.
//
// Credits (brief: "accessible from within the game") open from the Credits
// button and render straight from CREDITS in credits.js.
//
// Level select (#78) lists every level, stubs included, so a marker can jump
// to any of them. The menu only knows ids and names, and it reads them from the
// ONE list — `levels/index.js` (INTEGRATION.md) — never its own copy: main.js
// passes `game.levels` in, and the registry import is only the default for
// tests that build a Menu without deps. main.js maps an id to a level and swaps
// it in through `onSelectLevel`.
//
// Still TODO: loadout select, quality setting.
import { OPTIONS } from '../config.js';

/**
 * The controls list, as data so a test can hold it to the real bindings
 * (polish audit P0-3): it advertised F = Refill, a key that does not exist and
 * a button the design forbids, and hid Shift (submerge) and Q (paintstreak).
 */
export const CONTROLS = [
  ['WASD', 'Move'],
  ['Space', 'Jump'],
  ['Mouse', 'Look'],
  ['Click', 'Paint'],
  ['Right-click', 'Aim'],
  ['1–4', 'Colour'],
  ['Shift', 'Submerge in your paint (refill fast)'],
  ['Q', 'Paintstreak (when full)'],
  ['V', 'Switch view'],
  ['R', 'Restart'],
  ['M', 'Mute'],
  ['Enter', 'Skip sergeant'],
  ['Esc', 'Pause'],
];
import { CREDITS, OURS } from './credits.js';
import { LEVELS } from '../levels/index.js';
import { Briefing } from './briefing.js';
import { MissionIntro } from './mission-intro.js';
import { INTROS } from './intro-lines.js';

// The level that opens on the sergeant's briefing still (#111).
const BRIEFING_LEVEL = 'primer';

const STORAGE_KEY = 'inkbound.options';

export class Menu {
  /**
   * @param {HTMLElement} parent
   * @param {object} deps
   * @param {AudioManager} deps.audio
   * @param {HTMLCanvasElement} deps.canvas  what pointer lock is requested on
   * @param {() => void} deps.onRestart      reloads the level (main.js loadLevel)
   * @param {(id: string) => void|Promise<void>} [deps.onSelectLevel]
   *   swaps in the level with that LEVELS id; throw or reject if it fails
   * @param {{id: string, name: string}[]} [deps.levels]
   *   the list to render — `game.levels` from main.js, the registry default here
   * @param {string} [deps.currentLevel]       id of the level loaded at start
   * @param {import('./campaign.js').Campaign} [deps.campaign]
   *   the player's progress: the title offers "Continue" to the furthest
   *   mission they have reached
   */
  constructor(parent, { audio, canvas, onRestart, onSelectLevel, levels = LEVELS, currentLevel = LEVELS[0].id, campaign = null }) {
    this.campaign = campaign;
    this.audio = audio;
    this.canvas = canvas;
    this.onRestart = onRestart;
    this.onSelectLevel = onSelectLevel;
    this.levels = levels;
    this.currentLevel = currentLevel;
    this._switching = false;
    this.sensitivity = 1;   // multiplier on PLAYER.lookSensitivity
    this.started = false;   // false until the first time play begins
    this._load();

    const el = document.createElement('div');
    el.id = 'menu';
    el.innerHTML = `
      <div class="menu-card" role="dialog" aria-labelledby="menu-title">
        <h1 id="menu-title">INKBOUND</h1>
        <p id="menu-sub">The world is grey. Colour changes physics.</p>

        <div id="menu-main">
        <div class="menu-actions">
          <button id="menu-resume" class="primary" type="button">Play</button>
          <button id="menu-continue" class="hidden" type="button"></button>
          <button id="menu-restart" type="button">Restart level</button>
          <button id="menu-levels-btn" type="button">Level select</button>
          <button id="menu-credits-btn" type="button">Credits</button>
        </div>

        <section>
          <h2>Options</h2>
          <label class="menu-row">Volume
            <input id="opt-volume" type="range" min="0" max="100" step="1">
            <output id="opt-volume-out"></output>
          </label>
          <label class="menu-row">Music
            <input id="opt-music" type="range" min="0" max="100" step="1">
            <output id="opt-music-out"></output>
          </label>
          <label class="menu-row">Mouse sensitivity
            <input id="opt-sens" type="range"
              min="${OPTIONS.sensitivityMin * 100}" max="${OPTIONS.sensitivityMax * 100}" step="5">
            <output id="opt-sens-out"></output>
          </label>
          <div class="menu-row">Sound
            <button id="opt-mute" type="button"></button>
          </div>
        </section>

        <section>
          <h2>Controls</h2>
          <dl class="menu-controls">${CONTROLS.map(([key, what]) => `
            <dt>${esc(key)}</dt><dd>${esc(what)}</dd>`).join('')}
          </dl>
        </section>
        </div>

        <div id="menu-levels" class="hidden">
          <section>
            <h2>Level select</h2>
            <ol class="level-list">${this.levels.map((l, i) => `
              <li><button type="button" data-level="${esc(l.id)}">
                <span class="level-num">${i + 1}</span>${esc(l.name)}
              </button></li>`).join('')}
            </ol>
            <p id="menu-levels-error" class="level-error hidden" role="alert"></p>
          </section>
          <div class="menu-actions">
            <button class="levels-back" type="button">← Back</button>
          </div>
        </div>

        <div id="menu-credits" class="hidden">
          <div class="menu-actions">
            <button class="credits-back" type="button">← Back</button>
          </div>
          <section>
            <h2>Credits</h2>
            <ul class="credits-list">${renderCredits()}</ul>
          </section>
          <section>
            <h2>Made by the team</h2>
            <ul class="credits-ours">${OURS.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
          </section>
          <div class="menu-actions">
            <button class="credits-back" type="button">← Back</button>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(el);
    this.el = el;

    // #111: shown the first time the pointer locks into the Primer — entered
    // from a fresh load or from level select, not again on restart.
    this.briefing = new Briefing(parent, { isBlocked: () => this.menuShowing });
    this.briefing.setCard(INTROS[BRIEFING_LEVEL]?.card);
    this._briefingPending = currentLevel === BRIEFING_LEVEL;

    // Mission intro (G4): plays the first time the pointer locks into a new
    // mission — not on a restart. The Primer opens on the briefing instead.
    this.intro = new MissionIntro(parent, {
      isBlocked: () => this.menuShowing,
      onLine: () => audio.play('blip'),
    });
    this._introPending = currentLevel !== BRIEFING_LEVEL;

    const $ = (sel) => el.querySelector(sel);
    this.title = $('#menu-sub');
    this.resumeBtn = $('#menu-resume');
    this.continueBtn = $('#menu-continue');
    this.continueBtn.addEventListener('click', () => this._selectLevel(this._continueId));
    this.restartBtn = $('#menu-restart');
    this.volume = $('#opt-volume');
    this.volumeOut = $('#opt-volume-out');
    this.music = $('#opt-music');
    this.musicOut = $('#opt-music-out');
    this.sens = $('#opt-sens');
    this.sensOut = $('#opt-sens-out');
    this.muteBtn = $('#opt-mute');
    this.mainView = $('#menu-main');
    this.creditsView = $('#menu-credits');
    this.levelsView = $('#menu-levels');
    this.levelsError = $('#menu-levels-error');
    this.levelBtns = [...el.querySelectorAll('[data-level]')];

    $('#menu-credits-btn').addEventListener('click', () => this._showView('credits'));
    for (const back of el.querySelectorAll('.credits-back')) {
      back.addEventListener('click', () => this._showView('main'));
    }
    $('#menu-levels-btn').addEventListener('click', () => this._showView('levels'));
    el.querySelector('.levels-back').addEventListener('click', () => this._showView('main'));
    for (const btn of this.levelBtns) {
      btn.addEventListener('click', () => this._selectLevel(btn.dataset.level));
    }

    this.resumeBtn.addEventListener('click', () => this._resume());
    this.restartBtn.addEventListener('click', () => {
      this.onRestart();
      this._resume();
    });
    // clicking the dimmed backdrop (not the card) also resumes, like the old
    // "Click to play" prompt did
    el.addEventListener('click', (e) => { if (e.target === el) this._resume(); });

    this.volume.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(this.volume.value / 100);
      if (audio.muted && audio.volume > 0) audio.setMuted(false); // dragging up un-mutes
      this._sync();
    });
    // a quick blip on release so the player hears the level they picked
    this.volume.addEventListener('change', () => audio.play('hit'));
    // #199 — the music's own level. Effects are untouched at 0.
    this.music.addEventListener('input', () => {
      audio.unlock();
      audio.music?.setVolume(this.music.value / 100);
      this._sync();
    });

    this.sens.addEventListener('input', () => {
      this.sensitivity = this.sens.value / 100;
      this._save();
      this._sync();
    });

    this.muteBtn.addEventListener('click', () => {
      audio.unlock();
      audio.toggleMute();
      this._sync();
    });

    this._onKey = (e) => {
      if (e.code !== 'KeyM' || e.repeat) return;
      audio.toggleMute();
      this._sync();
    };
    this._onLock = () => this._setOpen(document.pointerLockElement !== this.canvas);
    window.addEventListener('keydown', this._onKey);
    document.addEventListener('pointerlockchange', this._onLock);

    this._sync();
    this._setOpen(true);
  }

  /**
   * True while the menu, the briefing still or the mission intro is up —
   * main.js pauses the game on this, so the world waits while they play.
   */
  get open() {
    return this.menuShowing || this.briefing.open || this.intro.open;
  }

  /** The intro to play for the current level (null: none written for it). */
  get introData() {
    return INTROS[this.currentLevel] ?? null;
  }

  /** The menu card itself, not counting the briefing. */
  get menuShowing() {
    return !this.el.classList.contains('hidden');
  }

  _resume() {
    this.audio.unlock();
    // Chrome refuses a re-lock for ~1s after Escape and rejects the promise;
    // the menu simply stays open and the next click works.
    const p = this.canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  /**
   * Open on the credits (the campaign's end, Enter on the finale). Unlocking
   * the pointer is what opens the menu; the view is chosen first.
   */
  showCredits() {
    this._showView('credits');
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    else this._setOpen(true);
  }

  /** The mission "Continue" would load, or null: none saved, or it is the one loaded. */
  get _continueId() {
    const id = this.campaign?.reached;
    return id && id !== this.currentLevel ? id : null;
  }

  /** Mark which level is loaded — main.js calls this if it swaps levels itself. */
  setCurrentLevel(id) {
    // A restart reloads the same id and keeps the still skipped; arriving in
    // the Primer from another level is the tutorial opening again.
    if (id === BRIEFING_LEVEL && id !== this.currentLevel) this._briefingPending = true;
    if (id !== BRIEFING_LEVEL) this._briefingPending = false;
    // A new mission gets its intro; a restart goes straight to play. Leaving a
    // level mid-intro (level select under it) drops that intro.
    if (id !== this.currentLevel) {
      this.intro.hide();
      this._introPending = id !== BRIEFING_LEVEL;
    }
    const changed = id !== this.currentLevel;
    this.currentLevel = id;
    this._syncLevels();
    // Next mission from the win screen: the pointer never unlocked, so start
    // the new mission's intro (or the Primer's briefing) now, not on a re-lock.
    if (changed && this.started && !this.menuShowing) this._startPending();
  }

  /** Play whatever opens the mission: the intro, then (Primer only) the briefing. */
  _startPending() {
    if (this._introPending) {
      this._introPending = false;
      if (this.introData) this.intro.play(this.introData);
    }
    if (this._briefingPending) {
      this._briefingPending = false;
      this.briefing.show();
    }
  }

  /** @param {'main' | 'levels' | 'credits'} view */
  _showView(view) {
    this.mainView.classList.toggle('hidden', view !== 'main');
    this.levelsView.classList.toggle('hidden', view !== 'levels');
    this.creditsView.classList.toggle('hidden', view !== 'credits');
    if (view === 'levels') this._syncLevels();
    this.levelsError.classList.add('hidden');
    this.el.scrollTop = 0;
  }

  // A failed load must not strand the player: the error shows in the list, the
  // buttons come back, and Back / Resume still work.
  async _selectLevel(id) {
    if (this._switching) return;
    this._switching = true;
    this.levelsError.classList.add('hidden');
    this._syncLevels();
    try {
      if (!this.onSelectLevel) throw new Error('level switching is not hooked up in main.js yet');
      await this.onSelectLevel(id);
      this.currentLevel = id;
      this._switching = false;
      this._syncLevels();
      this._resume();
    } catch (err) {
      console.error(`[menu] could not load level "${id}"`, err);
      const name = this.levels.find((l) => l.id === id)?.name ?? id;
      this.levelsError.textContent = `Couldn't load ${name}. Pick another level or go back.`;
      this.levelsError.classList.remove('hidden');
      this._switching = false;
      this._syncLevels();
    }
  }

  _syncLevels() {
    for (const btn of this.levelBtns) {
      const current = btn.dataset.level === this.currentLevel;
      btn.classList.toggle('current', current);
      if (current) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
      btn.disabled = this._switching;
    }
  }

  _setOpen(open) {
    if (!open) {
      this.started = true;
      this._showView('main'); // next pause opens on the main view; closes the level list
      this._startPending();
    }
    this.el.classList.toggle('hidden', !open);
    // first load reads as a title screen; afterwards it is a pause menu
    this.title.textContent = this.started ? 'Paused' : 'The world is grey. Colour changes physics.';
    this.resumeBtn.textContent = this.started ? 'Resume' : 'Play';
    this.restartBtn.classList.toggle('hidden', !this.started);
    // "Continue" is the title's: a returning player picks up at the furthest
    // mission they reached instead of replaying the Primer.
    const cont = !this.started ? this._continueId : null;
    this.continueBtn.classList.toggle('hidden', !cont);
    if (cont) this.continueBtn.textContent = `Continue — ${this.campaign.name(cont)}`;
  }

  _sync() {
    const vol = Math.round(this.audio.volume * 100);
    this.volume.value = vol;
    this.volumeOut.textContent = vol;
    const music = Math.round((this.audio.music?.volume ?? 0) * 100);
    this.music.value = music;
    this.musicOut.textContent = music;
    this.sens.value = Math.round(this.sensitivity * 100);
    this.sensOut.textContent = `${this.sensitivity.toFixed(2)}×`;
    this.muteBtn.setAttribute('aria-pressed', String(this.audio.muted));
    this.muteBtn.textContent = this.audio.muted ? 'Muted' : 'On';
  }

  // Per-player preference, so it lives in their browser. Storage can throw
  // (private mode, blocked site data) — the defaults still work.
  _load() {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
      if (typeof saved?.sensitivity === 'number') {
        this.sensitivity = Math.max(OPTIONS.sensitivityMin, Math.min(OPTIONS.sensitivityMax, saved.sensitivity));
      }
    } catch { /* defaults */ }
  }

  _save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ sensitivity: this.sensitivity }));
    } catch { /* not persisted, still applied */ }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    document.removeEventListener('pointerlockchange', this._onLock);
    this.briefing.dispose();
    this.intro.dispose();
    this.el.remove();
  }
}

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const link = (url, label = url.replace(/^https?:\/\//, '')) =>
  `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

/** One <li> per CREDITS entry: what, author, licence (linked), source(s), changes. */
function renderCredits() {
  return CREDITS.map((c) => {
    const sources = [].concat(c.source).map((url) => link(url)).join(' · ');
    const licence = c.licenceUrl ? link(c.licenceUrl, c.licence) : esc(c.licence);
    return `
      <li>
        <b>${esc(c.what)}</b>
        <span>by ${esc(c.author)} · ${licence}</span>
        <span class="credits-src">${sources}</span>
        ${c.changes ? `<span class="credits-note">${esc(c.changes)}</span>` : ''}
      </li>`;
  }).join('');
}
