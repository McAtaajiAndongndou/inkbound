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

// Killfeed (#129). One line per kind of kill, not per kill: in Last Colour
// dozens of Drainers die, and a line each would cover the arena exactly when
// the player needs to see it. Same enemy, same verb, same colour while the
// line is still up → the count goes up and the line's life restarts.
export const KILLFEED = { life: 3.5, fade: 0.6, maxLines: 3 };

// What the colour DID, from the enemy's `onDeath` cause — so the line teaches
// which colour answers which enemy, and never claims an effect that did not
// happen (a turret takes no procs, so it is never "flung").
const KILL_VERBS = {
  knockback: 'FLUNG',
  pin: 'PINNED',
  slip: 'SLICKED',
  shatter: 'SHATTERED',
  paint: 'PAINTED OUT',
  trap: 'TRAPPED',
};
const ENEMY_NAMES = {
  sprayer: 'SPRAYER',
  charger: 'CHARGER',
  wallCrawler: 'WALL-CRAWLER',
  turret: 'TURRET',
  drainer: 'DRAINER',
  stalker: 'STALKER',
  chargerZombie: 'CHARGER',
  bigArm: 'BIG ARM',
};

/** The feed's lines and their lifetimes, free of the DOM so tests can step it. */
export class KillFeed {
  constructor() {
    this.lines = [];   // newest first: { name, verb, colour, count, age }
  }

  push(name, verb, colour) {
    const i = this.lines.findIndex((l) => l.name === name && l.verb === verb && l.colour === colour);
    const line = i >= 0 ? this.lines.splice(i, 1)[0] : { name, verb, colour, count: 0, age: 0 };
    line.count++;
    line.age = 0;
    this.lines.unshift(line);
    this.lines.length = Math.min(this.lines.length, KILLFEED.maxLines);
  }

  update(dt) {
    for (const line of this.lines) line.age += dt;
    while (this.lines.length && this.lines[this.lines.length - 1].age >= KILLFEED.life) this.lines.pop();
  }

  clear() {
    this.lines.length = 0;
  }
}

/** "SPRAYER — FLUNG", "DRAINER — SLICKED ×5". */
export const killText = ({ name, verb, count }) => `${name} — ${verb}${count > 1 ? ` ×${count}` : ''}`;

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
      <ol id="killfeed" aria-live="polite">${'<li class="hidden"></li>'.repeat(KILLFEED.maxLines)}</ol>
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
    this.ammoBar = root.querySelector('#ammo-bar');
    this.dryWarning = root.querySelector('#dry-warning');
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
    this.killfeed = new KillFeed();
    this.killfeedEls = [...root.querySelectorAll('#killfeed li')];
    this._killfeedText = this.killfeedEls.map(() => '');

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
   * Add a kill to the feed (#129). main.js wires this to every enemy's `onDeath`.
   * @param {string} type                 the enemy's `type` (an ENEMY / model key)
   * @param {{ colour: string|null, effect: string|null }} cause
   */
  reportKill(type, { colour, effect }) {
    const name = ENEMY_NAMES[type] ?? type.toUpperCase();
    this.killfeed.push(name, KILL_VERBS[effect] ?? 'DOWN', colour);
  }

  _renderKillfeed(dt) {
    this.killfeed.update(dt);
    const { lines } = this.killfeed;
    for (let i = 0; i < this.killfeedEls.length; i++) {
      const el = this.killfeedEls[i];
      const line = lines[i];
      el.classList.toggle('hidden', !line);
      if (!line) {
        this._killfeedText[i] = '';
        continue;
      }
      const text = killText(line);
      if (text !== this._killfeedText[i]) {
        this._killfeedText[i] = text;
        el.textContent = text;
        el.style.color = line.colour ? `#${PAINT[line.colour].hex.toString(16).padStart(6, '0')}` : '';
      }
      // Fades on its own over the last KILLFEED.fade seconds of its life.
      el.style.opacity = Math.min(1, (KILLFEED.life - line.age) / KILLFEED.fade);
    }
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
    this.killfeed.clear(); // main.js calls this on every level load
  }

  update(dt, { gun, player, surfaces }) {
    this._renderKillfeed(dt);
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
