// OWNER: E (UI & Audio)
// Main menu, pause, options (sensitivity, volume, quality), loadout select,
// and RESTART WITHOUT PAGE REFRESH — explicit rubric checklist item.
//
// Built so far: the options panel's volume + mute. It shows whenever the
// pointer is unlocked (Escape = pause), so it never covers the game in play.
// M toggles mute at any time.

export class Menu {
  /**
   * @param {HTMLElement} parent  where the panel is mounted (document.body)
   * @param {AudioManager} audio
   */
  constructor(parent, audio) {
    this.audio = audio;

    const el = document.createElement('div');
    el.id = 'options';
    el.innerHTML = `
      <label>Volume
        <input id="opt-volume" type="range" min="0" max="100" step="1">
        <output id="opt-volume-out"></output>
      </label>
      <button id="opt-mute" type="button">Mute (M)</button>
    `;
    parent.appendChild(el);
    this.el = el;
    this.slider = el.querySelector('#opt-volume');
    this.out = el.querySelector('#opt-volume-out');
    this.muteBtn = el.querySelector('#opt-mute');

    this.slider.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(this.slider.value / 100);
      if (audio.muted && audio.volume > 0) audio.setMuted(false); // dragging up un-mutes
      this._sync();
    });
    // a quick blip on release so the player hears the level they picked
    this.slider.addEventListener('change', () => audio.play('hit'));

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
    this._onLock = () => {
      this.el.classList.toggle('hidden', document.pointerLockElement !== null);
    };
    window.addEventListener('keydown', this._onKey);
    document.addEventListener('pointerlockchange', this._onLock);

    this._sync();
    this._onLock();
  }

  _sync() {
    const pct = Math.round(this.audio.volume * 100);
    this.slider.value = pct;
    this.out.textContent = pct;
    this.muteBtn.setAttribute('aria-pressed', String(this.audio.muted));
    this.muteBtn.textContent = this.audio.muted ? 'Unmute (M)' : 'Mute (M)';
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    document.removeEventListener('pointerlockchange', this._onLock);
    this.el.remove();
  }
}
