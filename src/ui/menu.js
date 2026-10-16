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
// Still TODO: loadout select, quality setting, level select.
import { OPTIONS } from '../config.js';
import { CREDITS, OURS } from './credits.js';

const STORAGE_KEY = 'inkbound.options';

export class Menu {
  /**
   * @param {HTMLElement} parent
   * @param {object} deps
   * @param {AudioManager} deps.audio
   * @param {HTMLCanvasElement} deps.canvas  what pointer lock is requested on
   * @param {() => void} deps.onRestart      reloads the level (main.js loadLevel)
   */
  constructor(parent, { audio, canvas, onRestart }) {
    this.audio = audio;
    this.canvas = canvas;
    this.onRestart = onRestart;
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
          <button id="menu-restart" type="button">Restart level</button>
          <button id="menu-credits-btn" type="button">Credits</button>
        </div>

        <section>
          <h2>Options</h2>
          <label class="menu-row">Volume
            <input id="opt-volume" type="range" min="0" max="100" step="1">
            <output id="opt-volume-out"></output>
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
          <dl class="menu-controls">
            <dt>WASD</dt><dd>Move</dd>
            <dt>Space</dt><dd>Jump</dd>
            <dt>Mouse</dt><dd>Look</dd>
            <dt>Click</dt><dd>Paint</dd>
            <dt>1–4</dt><dd>Colour</dd>
            <dt>F</dt><dd>Refill ammo</dd>
            <dt>V</dt><dd>Switch view</dd>
            <dt>R</dt><dd>Restart</dd>
            <dt>M</dt><dd>Mute</dd>
            <dt>Esc</dt><dd>Pause</dd>
          </dl>
        </section>
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

    const $ = (sel) => el.querySelector(sel);
    this.title = $('#menu-sub');
    this.resumeBtn = $('#menu-resume');
    this.restartBtn = $('#menu-restart');
    this.volume = $('#opt-volume');
    this.volumeOut = $('#opt-volume-out');
    this.sens = $('#opt-sens');
    this.sensOut = $('#opt-sens-out');
    this.muteBtn = $('#opt-mute');
    this.mainView = $('#menu-main');
    this.creditsView = $('#menu-credits');

    $('#menu-credits-btn').addEventListener('click', () => this._showCredits(true));
    for (const back of el.querySelectorAll('.credits-back')) {
      back.addEventListener('click', () => this._showCredits(false));
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

  /** True while the menu is showing — main.js pauses the game on this. */
  get open() {
    return !this.el.classList.contains('hidden');
  }

  _resume() {
    this.audio.unlock();
    // Chrome refuses a re-lock for ~1s after Escape and rejects the promise;
    // the menu simply stays open and the next click works.
    const p = this.canvas.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  _showCredits(show) {
    this.mainView.classList.toggle('hidden', show);
    this.creditsView.classList.toggle('hidden', !show);
    this.el.scrollTop = 0;
  }

  _setOpen(open) {
    if (!open) {
      this.started = true;
      this._showCredits(false); // next pause opens on the main view
    }
    this.el.classList.toggle('hidden', !open);
    // first load reads as a title screen; afterwards it is a pause menu
    this.title.textContent = this.started ? 'Paused' : 'The world is grey. Colour changes physics.';
    this.resumeBtn.textContent = this.started ? 'Resume' : 'Play';
    this.restartBtn.classList.toggle('hidden', !this.started);
  }

  _sync() {
    const vol = Math.round(this.audio.volume * 100);
    this.volume.value = vol;
    this.volumeOut.textContent = vol;
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
