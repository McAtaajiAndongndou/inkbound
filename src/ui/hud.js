import { PAINT } from '../config.js';
const HINTS = {
  Grey: 'Dead ground: slow, no refill',
  Ice: 'Slide: low friction',
  Bounce: 'Bounce: launches you',
  Grip: 'Grip: climb walls',
};

// End screens (#81). Keyed by the level ids in ui/menu.js LEVELS, so a marker
// is told WHICH level they finished. An unknown id falls back to the generic
// wording rather than a blank title.
const END_LEVELS = {
  primer: { name: 'The Primer', win: 'PRIMER COMPLETE' },
  outskirts: { name: 'Outskirts', win: 'OUTSKIRTS CLEARED' },
  ascent: { name: 'The Ascent', win: 'ASCENT CLEARED' },
  'last-colour': { name: 'Last Colour', win: 'CORE BREACHED' },
};

// The two ways to lose: health gone, or paint gone (the L2 "run dry" failure).
const END_LOSE = {
  dead: { title: 'DOWN', detail: (name) => `You were taken out on ${name}.` },
  dry: { title: 'RUN DRY', detail: (name) => `Your paint tank ran empty on ${name}.` },
};

const RESTART_HINT = '<b>R</b> restart level · <b>Esc</b> menu';

/**
 * HUD. DOM-based, which is cheap and does not cost us a draw call.
 * Ammo counter, current colour, and a live readout of what the player is
 * standing on — that readout is a debug tool AND a teaching tool.
 */
export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div id="hud-bottom">
        <div id="health-wrap" class="hidden">
          <div id="health-bar"><div id="health-fill"></div></div>
          <div id="health-text">100</div>
        </div>
        <div id="ammo-wrap">
          <div id="ammo-bar">
            <div id="ammo-fill"></div>
            <div id="dry-fire">EMPTY</div>
          </div>
          <div id="ammo-text">100</div>
        </div>
        <div id="colours">
          <button class="swatch" data-i="0" style="--c:#3aa7ff"><span>1</span>Ice</button>
          <button class="swatch" data-i="1" style="--c:#ff4d5a"><span>2</span>Bounce</button>
          <button class="swatch" data-i="2" style="--c:#4ee08a"><span>3</span>Grip</button>
          <button class="swatch" data-i="3" style="--c:#585e54"><span>4</span>Grey</button>
        </div>
      </div>
      <div id="hud-top">
        <div id="standing">Standing on: <b>Dead</b></div>
        <div id="standing-hint"></div>
        <div id="coverage">Coverage: 0%</div>
      </div>
      <div id="end-win" class="end hidden" role="status">
        <h1>EXTRACTED</h1><p class="end-detail"></p><p class="end-restart">${RESTART_HINT}</p>
      </div>
      <div id="end-lose" class="end hidden" role="status">
        <h1>DOWN</h1><p class="end-detail"></p><p class="end-restart">${RESTART_HINT}</p>
      </div>
    `;

    this.ammoFill = root.querySelector('#ammo-fill');
    this.ammoText = root.querySelector('#ammo-text');
    this.standing = root.querySelector('#standing b');
    this.coverage = root.querySelector('#coverage');
    this.dryFire = root.querySelector('#dry-fire');
    this.swatches = [...root.querySelectorAll('.swatch')];
    this.hint = root.querySelector('#standing-hint');
    this.healthWrap = root.querySelector('#health-wrap');
    this.healthFill = root.querySelector('#health-fill');
    this.healthText = root.querySelector('#health-text');
    this.endWin = root.querySelector('#end-win');
    this.endLose = root.querySelector('#end-lose');
    this.hitmarker = root.querySelector('#hitmarker');

    this._coverageTimer = 0;
    this._coverageValue = 0;
  }

  onColourClick(handler) {
    this.swatches.forEach((el) => {
      el.addEventListener('click', () => handler(Number(el.dataset.i)));
    });
  }

  /**
   * Flash the hitmarker. The fade is a CSS animation, so nothing ticks per
   * frame; dropping and re-adding the class restarts it on rapid hits.
   */
  showHitmarker(kill = false) {
    const el = this.hitmarker;
    el.classList.remove('show', 'kill');
    void el.offsetWidth; // force a reflow so the animation restarts
    el.classList.add('show');
    el.classList.toggle('kill', kill);
  }

  /**
   * @param {'win' | 'lose'} kind
   * @param {object} [opts]
   * @param {string} [opts.level]            a LEVELS id from ui/menu.js
   * @param {'dead' | 'dry'} [opts.reason]   why the player lost (default dead)
   */
  showEnd(kind, { level, reason = 'dead' } = {}) {
    const info = END_LEVELS[level];
    const name = info?.name ?? 'this level';
    const el = kind === 'win' ? this.endWin : this.endLose;

    if (kind === 'win') {
      el.querySelector('h1').textContent = info?.win ?? 'EXTRACTED';
      el.querySelector('.end-detail').textContent = info ? `${info.name} complete.` : '';
    } else {
      const lose = END_LOSE[reason] ?? END_LOSE.dead;
      el.querySelector('h1').textContent = lose.title;
      el.querySelector('.end-detail').textContent = lose.detail(name);
    }
    el.classList.toggle('dry', kind === 'lose' && reason === 'dry');

    this.endWin.classList.toggle('hidden', kind !== 'win');
    this.endLose.classList.toggle('hidden', kind !== 'lose');
  }

  hideEnd() {
    this.endWin.classList.add('hidden');
    this.endLose.classList.add('hidden');
  }

  update(dt, { gun, player, surfaces }) {
    const pct = gun.ammo / gun.maxAmmo;

    this.ammoFill.style.width = `${pct * 100}%`;
    this.ammoFill.style.background = `#${PAINT[gun.colour].hex.toString(16).padStart(6, '0')}`;
    this.ammoText.textContent = Math.floor(gun.ammo);
  
    this.standing.textContent = PAINT[player.currentColour].name;
    this.standing.style.color = `#${PAINT[player.currentColour].hex.toString(16).padStart(6, '0')}`;
    this.hint.textContent = HINTS[PAINT[player.currentColour].name] ?? '';

    if (typeof player.health === 'number') {
      const max = player.maxHealth ?? 100;
      const p = Math.max(0, Math.min(1, player.health / max));
      this.healthWrap.classList.remove('hidden');
      this.healthFill.style.width = `${p * 100}%`;
      this.healthFill.style.background = p <= 0.25 ? '#ff4d5a' : '#4ee08a';
      this.healthText.textContent = Math.ceil(player.health);
    }

    this.swatches.forEach((el, i) => el.classList.toggle('active', i === gun.current));

    // coverage is a full grid scan — do it 4x a second, not 60
    this._coverageTimer -= dt;
    if (this._coverageTimer <= 0) {
      this._coverageTimer = 0.25;
      const total = surfaces.reduce((sum, s) => sum + s.coverage(), 0) / surfaces.length;
      this._coverageValue = total;
      this.coverage.textContent = `Coverage: ${Math.round(total * 100)}%`;
    }
    this.dryFire.style.display = gun.dryFire ? 'flex' : 'none';
  }
}
