import { PAINT } from '../config.js';
const HINTS = {
  Dead: 'Normal ground',
  Neutral: 'Normal ground',
  Ice: 'Slide: low friction',
  Bounce: 'Bounce: launches you',
  Grip: 'Grip: climb walls',
};

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
          <button class="swatch" data-i="3" style="--c:#5a5a66"><span>4</span>Neutral</button>
        </div>
      </div>
      <div id="hud-top">
        <div id="standing">Standing on: <b>Dead</b></div>
        <div id="standing-hint"></div>
        <div id="coverage">Coverage: 0%</div>
      </div>
      <div id="controls">
        <b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Mouse</b> look &nbsp;
        <b>Click</b> paint &nbsp; <b>1/2/3/4</b> colour &nbsp;<span id="refill-warning"><b>F</b> refill ammo</span> &nbsp; <b>V</b> view &nbsp; <b>R</b> restart
      </div>
      <div id="click-prompt">Click to play</div>
      <div id="end-win" class="end hidden"><h1>EXTRACTED</h1><p>Press R to redeploy</p></div>
      <div id="end-lose" class="end hidden"><h1>DOWN</h1><p>Press R to redeploy</p></div>
    `;

    this.ammoFill = root.querySelector('#ammo-fill');
    this.ammoText = root.querySelector('#ammo-text');
    this.standing = root.querySelector('#standing b');
    this.coverage = root.querySelector('#coverage');
    this.prompt = root.querySelector('#click-prompt');
    this.refillWarning = root.querySelector('#refill-warning');
    this.dryFire = root.querySelector('#dry-fire');
    this.swatches = [...root.querySelectorAll('.swatch')];
    this.hint = root.querySelector('#standing-hint');
    this.healthWrap = root.querySelector('#health-wrap');
    this.healthFill = root.querySelector('#health-fill');
    this.healthText = root.querySelector('#health-text');
    this.endWin = root.querySelector('#end-win');
    this.endLose = root.querySelector('#end-lose');

    this._coverageTimer = 0;
    this._coverageValue = 0;
  }

  onColourClick(handler) {
    this.swatches.forEach((el) => {
      el.addEventListener('click', () => handler(Number(el.dataset.i)));
    });
  }

  showEnd(kind) {
    this.endWin.classList.toggle('hidden', kind !== 'win');
    this.endLose.classList.toggle('hidden', kind !== 'lose');
  }

  hideEnd() {
    this.endWin.classList.add('hidden');
    this.endLose.classList.add('hidden');
  }

  update(dt, { gun, player, surfaces, locked }) {
    if (gun.colour === "grey"){
      this.ammoFill.style.width = "100%";
      this.ammoFill.style.background = `#${PAINT.grey.hex.toString(16).padStart(6, "0")}`;
      this.ammoText.textContent = "∞";
      this.refillWarning.classList.remove("critical");
    } else {
      const pct = gun.ammo[gun.colour] / gun.maxAmmo;
      this.ammoFill.style.width = `${pct * 100}%`;
      this.ammoFill.style.background = `#${PAINT[gun.colour].hex.toString(16).padStart(6, '0')}`;
      this.ammoText.textContent = Math.floor(gun.ammo[gun.colour]);
      this.refillWarning.classList.toggle('critical', pct <= 0.25);
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
    this.prompt.style.display = locked ? 'none' : 'grid';

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
