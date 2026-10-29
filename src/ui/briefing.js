// OWNER: E (UI & Audio)
// Sergeant briefing still (#111, PRD G1). The Primer opens on one still — the
// sergeant and the player — with the briefing line underneath (docs/levels/
// 00-the-primer.md, R0). One drawing, no portrait system; in-game lines are the
// comms bar (#112), not this.
//
// The menu owns it: it shows once the pointer locks into the Primer, and
// `menu.open` stays true while it is up, so main.js freezes the world behind it
// without knowing the briefing exists.
//
// Dismissing needs a FRESH input — a mouse press that starts after the still
// appeared, or a key that is not auto-repeat. The click on Play that locked the
// pointer began before the still existed, so it can never skip it; anything
// after it skips at once. The dismissing input is swallowed, so it does not
// also fire paint or jump.

export const BRIEFING_IMAGE = './assets/sergeant-briefing.png';
export const BRIEFING_LINE = 'The world ran out of colour. We kept what was left. Prove you can carry it.';

/**
 * The dismiss rule, kept free of the DOM so tests can drive it with plain
 * event-shaped objects. Each handler returns true when the briefing should close.
 */
export function createDismissGate() {
  let pressed = false; // a left press that began while the still was up

  return {
    reset() { pressed = false; },
    keydown(e) {
      // Escape belongs to the pause menu (and pointer lock eats it anyway).
      return !e.repeat && e.code !== 'Escape';
    },
    mousedown(e) {
      if (e.button === 0) pressed = true;
      return false;
    },
    mouseup(e) {
      // Close on release, not press: Input clears `firing` on the same event,
      // so the game resumes with the trigger up.
      return e.button === 0 && pressed;
    },
  };
}

export class Briefing {
  /**
   * @param {HTMLElement} parent
   * @param {object} [opts]
   * @param {() => boolean} [opts.isBlocked]  true while the pause menu is up —
   *   input then belongs to the menu, and the still waits underneath it
   */
  constructor(parent, { isBlocked = () => false } = {}) {
    this.isBlocked = isBlocked;
    this.gate = createDismissGate();

    const el = document.createElement('div');
    el.id = 'briefing';
    el.className = 'hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Briefing');
    el.innerHTML = `
      <figure class="briefing-frame">
        <img class="briefing-still" src="${BRIEFING_IMAGE}" alt="The sergeant briefs you before the course.">
        <figcaption class="briefing-comms">
          <span class="briefing-who">Sergeant</span>
          <p class="briefing-line"></p>
        </figcaption>
      </figure>
      <p class="briefing-hint">Click or press any key</p>
    `;
    el.querySelector('.briefing-line').textContent = BRIEFING_LINE;
    // No art (missing file, failed request): the line stands on a plain panel.
    el.querySelector('.briefing-still').addEventListener('error', () => el.classList.add('no-still'));
    parent.appendChild(el);
    this.el = el;

    // Capture phase on window, so this runs before Input's listeners and can
    // stop the dismissing press reaching the game.
    const guard = (handler) => (e) => {
      if (!this.open || this.isBlocked()) return;
      e.stopPropagation();
      e.preventDefault();
      if (handler(e)) this.hide();
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
    return !this.el.classList.contains('hidden');
  }

  show() {
    this.gate.reset();
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('mousedown', this._onMouseDown, true);
    window.removeEventListener('mouseup', this._onMouseUp, true);
    this.el.remove();
  }
}
