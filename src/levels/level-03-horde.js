// OWNER: E (Levels)
// L3 — "LAST COLOUR". One axis to the Siphon: hangar, corridor, the Core.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: the enemies EAT your paint,
// so your safe painted ground shrinks while you fight. The player is DROWNING.
// Enemies: Drainer, Charger, Turret, Stalker (30); Big Arm is placed, not built
// (#99). Trap: the cargo crusher (crusher.js); the laser grid is parked.
//
// Status: BLOCKOUT of design v2, plus polish pass 1 (amber mood, the Corp prop
// kit, the crusher). Every number comes from the layout DATA —
// src/levels/layouts/last-colour.js — the same file the design doc's plan,
// sections, pacing and 3D massing model are generated from
// (docs/levels/03-last-colour.md). The behaviour (waves, gates, the win) is
// LayoutLevel's, shared with the Ascent. The win is a PLACEHOLDER until the
// Siphon's phases exist (#100): reach its intake with the Core clear.
import * as THREE from 'three';
import { LayoutLevel } from './layout-level.js';
import { LAST_COLOUR } from './layouts/last-colour.js';
import { LAST_COLOUR as TUNING } from '../config.js';
import { applyMood } from './mood.js';
import { buildProps, setLamp } from './prop-kit.js';
import { CargoCrusher } from './crusher.js';

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

  async load() {
    await super.load();
    applyMood(this, TUNING.mood);
    this.props = buildProps(this, LAST_COLOUR.props);
    this._crushers();
  }

  /** The layout's built trap zones: each crusher in the floor it sits on. */
  _crushers() {
    this.crushers = [];
    const centre = new THREE.Vector3();
    for (const t of LAST_COLOUR.traps.filter((tr) => tr.kind === 'crusher' && !tr.planned)) {
      const [x0, x1, y0, , z0, z1] = t.box;
      centre.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
      const floor = this.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y0) < 1e-6 && s.worldToCell(centre));
      this.crushers.push(new CargoCrusher({ parent: this.root, floor, box: t.box }));
    }
  }

  update(dt, player) {
    super.update(dt, player);
    for (const c of this.crushers) c.update(dt, [player, ...this.enemies]);
    // The lamps over the bay gates blink while their wave's breath counts down.
    for (const lamp of this.props.lamps) setLamp(lamp, this._rule(lamp.rule, player), this._clock);
  }
}
