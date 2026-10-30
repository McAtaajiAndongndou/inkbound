// OWNER: E (Levels)
//
// A level built entirely from a layout DATA file (src/levels/layouts/*.js).
//
// The Ascent was the first; Last Colour is the second, and this is the part
// both share: build the geometry (layout-builder.js), spawn the enemies, run
// their wake rules, open gates, and decide the win. A subclass names its
// layout and nothing else — every number lives in the data.
//
// WAKE RULES (an enemy's `wake` in the data):
//   always         awake from the start (a turret: a machine does not doze)
//   enter:R4       dormant until the player stands in room R4
//   cleared:R2.1   dormant until every enemy of room R2, wave 1, is gone
//   cleared:R3.2+8 the same, then 8 more seconds — a breath before the next
//                  wave (Last Colour, decision 1: the pacing never dropped)
// Dormant enemies are visible and inert, and any hit wakes them (DECISIONS,
// 24 Oct), so a trigger is never the only way an enemy starts.
//
// GATES (a layout `gate`): a full-height barrier that drops when its `opens`
// rule holds — the same grammar. While a delayed rule is counting down, the
// gate's field PULSES: that is the warning ("something is coming through").
// Collision is positional, so a gate opens by moving its collider below the
// world, exactly as Outskirts' do.
//
// "GONE" means dead OR out of its room — and catch floors belong to no room —
// so an enemy knocked off a ledge counts as beaten. That is Outskirts'
// soft-lock guard, and the Ascent's ledge needed it (the lift never left).
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { GATE } from '../config.js';
import { audio } from '../audio/audio-manager.js';
import * as kit from './level-kit.js';
import { buildLayout, roomTest } from './layout-builder.js';
import { separateEnemies } from '../enemies/separation.js';
import { DEFAULT_SUN } from './mood.js';   // main.js's sun; a layout may give its own `sunDir` (#125)


export class LayoutLevel extends LevelBase {
  /** Subclasses return their layout data. */
  get layout() { throw new Error('a LayoutLevel must name its layout'); }

  /**
   * True when the level calls `game.onWin()` itself (Last Colour's Siphon) and
   * the win volume is only the objective marker, not the trigger.
   */
  get scriptedWin() { return false; }

  async load() {
    const L = this.layout;
    buildLayout(this, L, { cells: L.cells });
    this.inRoom = roomTest(L);

    const [x, y, z] = L.routes.main[0];
    this.spawn.set(x, y + 2, z);   // lifted, so the player drops onto the floor
    if (L.spawnLook) this.spawnLook = new THREE.Vector3(...L.spawnLook);
    this.spawnPoints = L.enemies.filter((e) => !e.planned).map((e) => new THREE.Vector3(...e.pos));

    const [wx0, wx1, wy0, wy1, wz0, wz1] = L.win.box;
    this.extraction = kit.extractionZone(this, new THREE.Vector3(wx0, wy0, wz0), new THREE.Vector3(wx1, wy1, wz1));

    this._buildGates();
    this._prepaint();
    this._spawnEnemies();

    // LAST, once every custom-shaded surface exists (AGENTS.md rule 5).
    this.sunDir = kit.aimCustomShading(this.surfaces, [], L.sunDir ?? DEFAULT_SUN);
  }

  /**
   * Paint already on the floor at load: the layout's `prepaint` rects (the
   * Primer's blue strip and red pad, every level's spawn pad). See kit.paintRect.
   */
  _prepaint() {
    for (const p of this.layout.prepaint ?? []) kit.paintRect(this, p.rect, p.y, p.colour);
  }

  /** Every enemy in the data that exists in the game (`planned` ones do not yet). */
  _spawnEnemies() {
    const live = this.layout.enemies.filter((e) => !e.planned);
    const specs = live.map((e) => ({
      type: e.type, x: e.pos[0], y: e.pos[1], z: e.pos[2],
      sleeping: e.wake !== 'always', wakeOn: e.wake, tune: e.tune,
    }));
    const { enemies } = kit.spawnEnemies(this, specs, this.constructor.name);
    this.enemies = enemies;
    this.roster = live.map((data, i) => ({ data, enemy: enemies[i] })).filter((r) => r.enemy);
    this._huntRooms = new Set((this.layout.rooms ?? []).filter((r) => r.hunt).map((r) => r.id));
  }

  /**
   * A gate: an invisible, unpaintable collider (the only thing that blocks) and
   * a see-through field in front of it (the thing the player reads). The Corp's
   * grey-violet, like Outskirts' fields (`GATE`, polish audit P0-5): not red,
   * which means bounce. It drops when the fight it guards is won, with the same
   * `gate` sound as Outskirts' doors.
   */
  _buildGates() {
    this.gates = [];
    for (const g of this.layout.gates ?? []) {
      const [x0, x1, y0, y1, z0, z1] = g.box;
      const alongX = x1 - x0 >= z1 - z0;
      const collider = alongX
        ? kit.face(this, { yBase: y0, yTop: y1, z: (z0 + z1) / 2, xMin: x0, xMax: x1, unpaintable: true, cells: this.layout.cells })
        : kit.face(this, { yBase: y0, yTop: y1, x: (x0 + x1) / 2, zMin: z0, zMax: z1, normalX: 1, unpaintable: true, cells: this.layout.cells });
      collider.mesh.visible = false;
      collider.layoutId = g.id;
      collider.gate = true;

      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(alongX ? x1 - x0 : z1 - z0, y1 - y0),
        new THREE.MeshBasicMaterial({ color: GATE.field, transparent: true, opacity: GATE.layoutOpacity, side: THREE.DoubleSide, depthWrite: false }),
      );
      field.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (!alongX) field.rotation.y = Math.PI / 2;
      this.root.add(field);
      this.gates.push({ data: g, collider, field, open: false });
    }
  }

  /** Is every enemy of `room` (and, if given, `wave`) dead, or out of its room? */
  groupCleared(room, wave) {
    return this.roster
      .filter((r) => r.data.room === room && (wave === undefined || r.data.wave === wave))
      .every((r) => !r.enemy.alive || !this.inRoom(room, r.enemy.position));
  }

  /** Evaluate a `cleared:R2.1` / `cleared:R2` rule. */
  _cleared(arg) {
    const [room, wave] = arg.split('.');
    return this.groupCleared(room, wave === undefined ? undefined : Number(wave));
  }

  /**
   * Evaluate a wake or open rule: 'yes', 'no', or 'pending' (its condition has
   * been met and its delay is still counting down).
   *
   * Every rule is a one-shot event, so it LATCHES: once its condition is met
   * the countdown runs to the end even if the condition stops holding — an
   * `enter:` delay counts from the first step in, and leaving does not cancel
   * the wave you started.
   */
  _rule(rule, player) {
    const [cond, delayText] = rule.split('+');
    if (!this._since.has(rule)) {
      const [kind, arg] = cond.split(':');
      const holds = kind === 'always'
        || (kind === 'enter' && this.inRoom(arg, player.position))
        || (kind === 'cleared' && this._cleared(arg));
      if (!holds) return 'no';
      this._since.set(rule, this._clock);
    }
    return this._clock - this._since.get(rule) >= Number(delayText ?? 0) ? 'yes' : 'pending';
  }

  update(dt, player) {
    this._clock = (this._clock ?? 0) + dt;
    this._since ??= new Map();
    // #197: the sky warms with the territory (null on a static-sky level).
    this.sky?.update(dt);
    // #198: the lights this level placed in the pool (traps, the Siphon).
    kit.updatePlacedLights(this, dt);

    for (let i = 0; i < this.roster.length; i++) {
      const { data, enemy } = this.roster[i];
      if (enemy.sleeping && this._rule(data.wake, player) === 'yes') enemy.wake();
      // A `hunt` room's waves never give up on you (Last Colour's Core, QA 30
      // Oct): an enemy that loses you — a Charger that overshoots past the sight
      // radius — drops to Dormant and stands still, and the next wave waits on
      // it forever. Woken again, it is provoked (#216) and comes back.
      else if (!enemy.sleeping && enemy.alive && enemy.awareness === 'dormant' && this._huntRooms.has(data.room)) {
        enemy.sleeping = true;
        enemy.wake();
      }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(dt, player.position);
    }
    separateEnemies(this.enemies);   // #187: bodies push apart once everyone has moved
    for (const gate of this.gates) {
      if (gate.open) continue;
      const state = this._rule(gate.data.opens, player);
      if (state === 'yes') {
        gate.open = true;
        gate.collider.mesh.position.y = -100;   // below PLAYER.killY: out of every wall test
        gate.field.visible = false;
        audio.play('gate');   // the layout levels' doors were silent (polish audit)
      } else if (state === 'pending') {
        // The warning: the field pulses while its countdown runs.
        gate.field.material.opacity = GATE.layoutOpacity + GATE.layoutPulse * Math.sin(this._clock * 8);
      }
    }
    if (!this._complete && !this.scriptedWin && this.extraction.containsPoint(player.position) && this._cleared(this.layout.win.requires)) {
      this._complete = true;
      this.game.onWin?.();
    }
  }

  dispose() {
    for (const enemy of this.enemies) enemy.dispose?.();
    super.dispose();
  }
}
