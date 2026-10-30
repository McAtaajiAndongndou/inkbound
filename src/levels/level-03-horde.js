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
import { LAST_COLOUR as TUNING, ENEMY, TRAP } from '../config.js';
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
