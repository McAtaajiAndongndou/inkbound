// OWNER: E (Levels)
// L3 — "LAST COLOUR". One axis to the Siphon: hangar, corridor, the Core.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: the enemies EAT your paint,
// so your safe painted ground shrinks while you fight. The player is DROWNING.
// Enemies: Drainer, Charger, Turret, Stalker (30), then Big Arm and the two
// Drainers it calls (#99, src/enemies/boss.js). Trap: the cargo crusher (crusher.js); the laser grid is parked.
//
// Status: BLOCKOUT of design v2, plus polish pass 1 (amber mood, the Corp prop
// kit, the crusher), plus the Siphon's three-colour exam (#100, siphon.js). Every number comes from the layout DATA —
// src/levels/layouts/last-colour.js — the same file the design doc's plan,
// sections, pacing and 3D massing model are generated from
// (docs/levels/03-last-colour.md). The behaviour (waves, gates, the win) is
// LayoutLevel's, shared with the Ascent. The win is the Siphon's: its exam
// begins when the Core is clear and the level is won when phase three is done.
import * as THREE from 'three';
import { LayoutLevel } from './layout-level.js';
import { LAST_COLOUR } from './layouts/last-colour.js';
import { LAST_COLOUR as TUNING, ENEMY, TRAP, CURVES, PLACED_LIGHTS } from '../config.js';
import { cables, lathe } from './curves.js';
import { applyMood } from './mood.js';
import { buildProps, setLamp } from './prop-kit.js';
import { CargoCrusher } from './crusher.js';
import { Siphon } from './siphon.js';
import * as kit from './level-kit.js';

export class Level03 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room, from
  // the same eye points, so the built level can be compared with the doc —
  // plus the crusher from the corridor floor.
  static SHOTS = [
    ...LAST_COLOUR.rooms.map((r) => ({
      name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
    })),
    { name: 'crusher', label: 'R2 the cargo crusher', position: [0, 1.6, 34], target: [-2, 2, 23], fog: true },
  ];

  get layout() { return LAST_COLOUR; }

  /** The Siphon calls the win, not the intake volume. */
  get scriptedWin() { return true; }

  async load() {
    await super.load();
    applyMood(this, TUNING.mood);
    this.props = buildProps(this, LAST_COLOUR.props);
    this._crushers();
    this.siphon = new Siphon(this, {
      targets: LAST_COLOUR.targets,
      spill: LAST_COLOUR.spill,
      beacon: this.root.getObjectByName('siphon-mast-beacon'),
      onDone: () => {
        if (this._complete) return;
        this._complete = true;
        this.game.onWin?.();
      },
    });
    this._bigArm();
    this._curves();
    this._lights();
    // The Siphon's plates are paint material built after LayoutLevel's light
    // pass: aim them too (AGENTS rule 5).
    kit.aimCustomShading(this.surfaces, [], this.sunDir.toArray());
  }

  /**
   * Big Arm's hooks (#99). Its slam's hit goes through `onAttack` like every
   * attack (main.js wires it); the grab and the summon are the level's to do.
   */
  _bigArm() {
    const entry = this.roster.find((r) => r.data.type === 'bigArm');
    this.bigArm = entry?.enemy ?? null;
    if (!this.bigArm) return;
    const grab = ENEMY.bigArm.grab;
    this.bigArm.onGrab = (boss) => {
      const p = this._player;
      if (!p) return;
      p.takeDamage?.(grab.damage);
      // Pulled in: toward it, and off your feet.
      const pull = new THREE.Vector3().subVectors(boss.position, p.position).setY(0);
      if (pull.lengthSq() > 1e-6 && p.velocity) p.velocity.addScaledVector(pull.normalize(), grab.pull);
    };
    this.bigArm.onSummon = () => {
      for (const r of this.roster) if (r.data.wake === 'summon') r.enemy.wake();
    };
  }

  /**
   * Curves (#198): the Siphon's tank and the two vats are surfaces of
   * revolution (lathes, flat-shaded: Corp machinery), the hoses and the hangar's
   * roof cables are sagging tubes — one draw call for the hoses, one for the
   * cables. Positions are layout data (LAST_COLOUR.curves).
   */
  _curves() {
    const C = LAST_COLOUR.curves;
    this.tank = lathe(C.tank.profile, CURVES.vatColour);
    this.tank.position.set(...C.tank.at);
    this.tank.name = 'siphon-tank';
    this.vats = C.vats.at.map((at, i) => {
      const vat = lathe(C.vats.profile, CURVES.vatColour);
      vat.position.set(...at);
      vat.name = `vat-${i + 1}`;
      return vat;
    });
    this.root.add(this.tank, ...this.vats);
    this.hoses = cables(this, C.hoses.map((h) => ({ ...h, radius: CURVES.hoseRadius })), CURVES.hoseColour, 'hoses');
    this.cables = cables(this, C.cables, CURVES.colour);
  }

  /**
   * Placed lights (#198, through the pool #195): each crusher amber while it
   * warns and while it is down (a dim amber between), the Siphon a sickly
   * grey-violet that pulses faster while its exam drains, and the mast beacon
   * marker white until the Siphon dies.
   */
  _lights() {
    const L = PLACED_LIGHTS;
    for (const c of this.crushers) {
      const at = c.group.position.clone();
      at.y += 2;
      kit.placeLight(this, L.trap, at, () => (c.state === 'warn' || c.state === 'down' ? 1 : L.trap.rest));
    }
    let clock = 0;
    kit.placeLight(this, L.siphon, new THREE.Vector3(0, 6, -29), (dt) => {
      const phase = this.siphon.phase;
      if (phase === 'done') return 0;
      const draining = phase !== 'dormant' && phase !== 'finale';
      clock += dt * (draining ? L.siphon.drainRate : L.siphon.pulseRate);
      return 0.6 + 0.4 * Math.sin(clock);
    });
    const beacon = this.root.getObjectByName('siphon-mast-beacon');
    if (beacon) kit.placeLight(this, L.beacon, beacon.position.clone(), () => (beacon.visible ? 1 : 0));
  }

  /** The layout's built trap zones: each crusher in the floor it sits on. */
  _crushers() {
    this.crushers = [];
    const centre = new THREE.Vector3();
    for (const t of LAST_COLOUR.traps.filter((tr) => tr.kind === 'crusher' && !tr.planned)) {
      const [x0, x1, y0, , z0, z1] = t.box;
      centre.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
      const floor = this.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y0) < 1e-6 && s.worldToCell(centre));
      const crusher = new CargoCrusher({ parent: this.root, floor, box: t.box });
      // A beat that lands next to you shakes the camera (polish audit, P1-2).
      crusher.onSlam = (gain) => this.game?.shake?.(TRAP.shake.crusher * gain);
      this.crushers.push(crusher);
    }
  }

  update(dt, player) {
    this._player = player;
    super.update(dt, player);
    for (const c of this.crushers) c.update(dt, [player, ...this.enemies]);
    // The lamps over the bay gates blink while their wave's breath counts down.
    for (const lamp of this.props.lamps) setLamp(lamp, this._rule(lamp.rule, player), this._clock);
    this.siphon.update(dt, this._cleared(LAST_COLOUR.win.requires));
    // #197: while the Siphon's exam runs it drains the sky back to Corp grey;
    // its destruction (the finale) restores the level's amber for good.
    const phase = this.siphon.phase;
    if (phase === 'finale' || phase === 'done') this.sky?.restore();
    else if (phase !== 'dormant') this.sky?.drain();
    // #112 — the sergeant's line on arrival at the base.
    if (!this._saidBase && this.inRoom('R0', player.position)) {
      this._saidBase = true;
      this.game.say?.('last-colour-base');
    }
  }
}
