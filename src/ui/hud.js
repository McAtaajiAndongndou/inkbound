import { PAINT } from '../config.js';

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
        <div id="ammo-wrap">
          <div id="ammo-bar"><div id="ammo-fill"></div></div>
          <div id="ammo-text">100</div>
        </div>
        <div id="colours">
          <button class="swatch" data-i="0" style="--c:#3aa7ff"><span>1</span>Ice</button>
          <button class="swatch" data-i="1" style="--c:#ff4d5a"><span>2</span>Bounce</button>
          <button class="swatch" data-i="2" style="--c:#4ee08a"><span>3</span>Grip</button>
        </div>
      </div>
      <div id="hud-top">
        <div id="standing">Standing on: <b>Dead</b></div>
        <div id="coverage">Coverage: 0%</div>
      </div>
      <div id="controls">
        <b>WASD</b> move &nbsp; <b>Space</b> jump &nbsp; <b>Mouse</b> look &nbsp;
        <b>Click</b> paint &nbsp; <b>1/2/3</b> colour &nbsp; <b>V</b> view &nbsp; <b>R</b> restart
      </div>
      <div id="click-prompt">Click to play</div>
    `;

    this.ammoFill = root.querySelector('#ammo-fill');
    this.ammoText = root.querySelector('#ammo-text');
    this.standing = root.querySelector('#standing b');
    this.coverage = root.querySelector('#coverage');
    this.prompt = root.querySelector('#click-prompt');
    this.swatches = [...root.querySelectorAll('.swatch')];

    this._coverageTimer = 0;
    this._coverageValue = 0;
  }

  onColourClick(handler) {
    this.swatches.forEach((el) => {
      el.addEventListener('click', () => handler(Number(el.dataset.i)));
    });
  }

  update(dt, { gun, player, surfaces, locked }) {
    const pct = gun.ammo / gun.maxAmmo;
    this.ammoFill.style.width = `${pct * 100}%`;
    this.ammoFill.style.background = `#${PAINT[gun.colour].hex.toString(16).padStart(6, '0')}`;
    this.ammoText.textContent = Math.floor(gun.ammo);

    this.standing.textContent = PAINT[player.currentColour].name;
    this.standing.style.color = `#${PAINT[player.currentColour].hex.toString(16).padStart(6, '0')}`;

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
  }
}
