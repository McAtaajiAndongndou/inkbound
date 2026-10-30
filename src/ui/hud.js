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

// The campaign's end: Last Colour's win (campaign.js). The Siphon is down and
// the colour comes back — the one screen that says the story is over.
const FINALE = {
  title: "THE COLOUR'S BACK",
  detail: 'The Siphon is down. Corrupt Corp is out of colour.',
};

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The win screen's key line: next mission, or credits after the finale (#flow). */
export function winHint({ next, finale } = {}) {
  if (finale) return '<b>Enter</b> credits · <b>R</b> replay · <b>Esc</b> menu';
  if (next) return `<b>Enter</b> next: ${esc(next)} · ${RESTART_HINT}`;
  return RESTART_HINT;
}

// Scorecard (#110): three numbers, written for a player. No rank, nothing saved.
const pct = (x) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const clock = (seconds) => {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

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
          <div id="streak" title="Paintstreak — Q when full"><div id="streak-fill"></div></div>
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
        <h1>EXTRACTED</h1><p class="end-detail"></p>
        <dl class="scorecard hidden">
          <div><dt>Coverage</dt><dd data-stat="coverage"></dd><span>of the level painted</span></div>
          <div><dt>Time</dt><dd data-stat="time"></dd><span>start to finish</span></div>
          <div><dt>Dry time</dt><dd data-stat="dry"></dd><span>of the run on grey</span></div>
        </dl>
        <p class="end-campaign hidden"></p>
        <p class="end-restart">${RESTART_HINT}</p>
      </div>
      <div id="end-lose" class="end hidden" role="status">
        <h1>DOWN</h1><p class="end-detail"></p><p class="end-restart">${RESTART_HINT}</p>
      </div>
    `;

    this.ammoFill = root.querySelector('#ammo-fill');
    this.ammoText = root.querySelector('#ammo-text');
    this.ammoBar = root.querySelector('#ammo-bar');
    this.streak = root.querySelector('#streak');
    this.streakFill = root.querySelector('#streak-fill');
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
    this.scorecard = root.querySelector('.scorecard');
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
   * @param {{ time: number, dryTime: number }} [opts.stats]
   *   the run, in seconds, for the win scorecard (main.js accumulates it)
   * @param {string} [opts.next]   the next mission's name: the win offers it on Enter
   * @param {{ cleared: number, of: number, time: number }} [opts.campaign]
   *   set on the finale's win: the campaign-complete screen's totals
   */
  showEnd(kind, { level, reason = 'dead', stats, next, campaign } = {}) {
    const info = END_LEVELS[level];
    const name = info?.name ?? 'this level';
    const el = kind === 'win' ? this.endWin : this.endLose;

    if (kind === 'win') {
      el.querySelector('h1').textContent = campaign ? FINALE.title : info?.win ?? 'EXTRACTED';
      el.querySelector('.end-detail').textContent = campaign ? FINALE.detail : info ? `${info.name} complete.` : '';
      this._showScorecard(stats);
      const totals = el.querySelector('.end-campaign');
      totals.classList.toggle('hidden', !campaign);
      if (campaign) {
        totals.textContent = `Campaign: ${campaign.cleared} of ${campaign.of} missions cleared · ${clock(campaign.time)} total`;
      }
      el.querySelector('.end-restart').innerHTML = winHint({ next, finale: !!campaign });
    } else {
      const lose = END_LOSE[reason] ?? END_LOSE.dead;
      el.querySelector('h1').textContent = lose.title;
      el.querySelector('.end-detail').textContent = lose.detail(name);
    }
    el.classList.toggle('dry', kind === 'lose' && reason === 'dry');
    el.classList.toggle('finale', !!campaign);

    this.endWin.classList.toggle('hidden', kind !== 'win');
    this.endLose.classList.toggle('hidden', kind !== 'lose');
  }

  /** Which end screen is up: 'win', 'lose' or null. */
  get endShowing() {
    if (!this.endWin.classList.contains('hidden')) return 'win';
    if (!this.endLose.classList.contains('hidden')) return 'lose';
    return null;
  }

  hideEnd() {
    this.endWin.classList.add('hidden');
    this.endLose.classList.add('hidden');
    this.killfeed.clear();
    // main.js calls this on every level load: a fresh level starting below the
    // last one's territory is not ground being lost.
    this._territoryTrend.reset();
    this._coverageTimer = 0; // a restarted level reads its own coverage on the next frame
  }

  // Coverage is the HUD's own readout value, not a second scan of the level.
  _showScorecard(stats) {
    this.scorecard.classList.toggle('hidden', !stats);
    if (!stats) return;
    const stat = (name) => this.scorecard.querySelector(`[data-stat="${name}"]`);
    stat('coverage').textContent = pct(this._coverageValue);
    stat('time').textContent = clock(stats.time);
    stat('dry').textContent = pct(stats.time > 0 ? stats.dryTime / stats.time : 0);
  }

  update(dt, { gun, player, surfaces, streak }) {
    this._renderKillfeed(dt);
    const pct = gun.ammo / gun.maxAmmo;

    // Paintstreak (#131): a line under the ammo bar, not a fifth element — it is
    // part of the paint readout. Full = it glows and shows the key.
    if (streak) {
      this.streakFill.style.width = `${streak.fraction * 100}%`;
      this.streak.classList.toggle('full', streak.full);
    }

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
