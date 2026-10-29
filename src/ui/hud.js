import { PAINT,DRY_OUT } from '../config.js';
const HINTS = {
  Grey: 'Dead ground: slow, no refill',
  Ice: 'Slide: low friction',
  Bounce: 'Bounce: launches you',
  Grip: 'Grip: climb walls',
};

// End screens (#81). Keyed by the level ids in the ONE list (levels/index.js),
// so a marker is told WHICH level they finished. An unknown id falls back to the
// generic wording rather than a blank title.
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

// Territory readout (#127). The minimap is the territory VIEW; this number,
// sat right under it, is its summary. It is a full grid scan, so it samples
// TERRITORY.interval apart, and a drop — enemy grey eating the level — holds
// the "falling" look for TERRITORY.fallHold so it reads in the corner of the eye.
export const TERRITORY = { interval: 0.25, fallHold: 1.5 };

/**
 * Tracks the displayed percentage and whether it is falling. A drop of a whole
 * point (what the player can see) starts or extends the hold; a rise clears it.
 */
export class TerritoryTrend {
  constructor() {
    this.reset();
  }

  reset() {
    this.pct = null;
    this.fallTimer = 0;
  }

  get falling() {
    return this.fallTimer > 0;
  }

  /** @param {number} fraction 0..1 of the level painted  @returns {number} the whole percent shown */
  sample(fraction) {
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    if (this.pct !== null && pct < this.pct) this.fallTimer = TERRITORY.fallHold;
    else if (this.pct !== null && pct > this.pct) this.fallTimer = 0;
    this.pct = pct;
    return pct;
  }

  update(dt) {
    if (this.fallTimer > 0) this.fallTimer -= dt;
  }
}

const hex = (name) => `#${PAINT[name].hex.toString(16).padStart(6, '0')}`;

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
      <div id="dry-warning" class="hidden">DRY OUT</div>
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
      </div>
      <div id="territory" aria-live="off">
        <span class="territory-label">Territory</span>
        <b class="territory-value">0%</b><span class="territory-trend" aria-hidden="true">▼</span>
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
    this.ammoBar = root.querySelector('#ammo-bar');
    this.dryWarning = root.querySelector('#dry-warning');
    this.standing = root.querySelector('#standing b');
    this.territory = root.querySelector('#territory');
    this.territoryValue = root.querySelector('.territory-value');
    this._territoryTrend = new TerritoryTrend();
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
   * @param {string} [opts.level]            a LEVELS id from levels/index.js
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
    // main.js calls this on every level load: a fresh level starting below the
    // last one's territory is not ground being lost.
    this._territoryTrend.reset();
  }

  update(dt, { gun, player, surfaces }) {
    const pct = gun.ammo / gun.maxAmmo;

    this.ammoFill.style.width = `${pct * 100}%`;
    this.ammoFill.style.background = `#${PAINT[gun.colour].hex.toString(16).padStart(6, '0')}`;
    this.ammoText.textContent = Math.floor(gun.ammo);

    
    // ---- dry out warning (#75) --------------------------------------------
    // Two cues: the ammo bar pulses below DRY_OUT.warningBelow, and a
    // fullscreen banner appears while the player is actually dry, counting
    // down the grace.
    const critical = pct < DRY_OUT.warningBelow && gun.ammo > 0;
    this.ammoBar.classList.toggle('critical', critical);

    this.dryWarning.classList.toggle('hidden', !player.dry);
    if (player.dry) {
      const remaining = Math.max(0, DRY_OUT.graceTime - player.dryTimer);
      this.dryWarning.textContent = `DRY OUT — ${remaining.toFixed(1)}s`;
    }
  
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

    // Territory (#127): a full grid scan, so 4x a second, not 60. Tinted with
    // the colour in hand, so it reads as ground held rather than a counter.
    this.territoryValue.style.color = hex(gun.colour);
    this._territoryTrend.update(dt);
    this._coverageTimer -= dt;
    if (this._coverageTimer <= 0) {
      this._coverageTimer = TERRITORY.interval;
      const total = surfaces.reduce((sum, s) => sum + s.coverage(), 0) / surfaces.length;
      this._coverageValue = total;
      this.territoryValue.textContent = `${this._territoryTrend.sample(total)}%`;
    }
    this.territory.classList.toggle('falling', this._territoryTrend.falling);
    this.dryFire.style.display = gun.dryFire ? 'flex' : 'none';
  }
}
