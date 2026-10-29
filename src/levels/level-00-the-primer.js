// OWNER: E (Levels)
// L0 — "THE PRIMER". The rebel training course. Ten rooms, one new verb each.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: it teaches. Grey slows from room
// one, the first splat is on a WALL, and no room may kill except the trap.
// Enemies: one Charger behind a gate (room R7). Traps: one spike pit (R6,
// #101) — it damages, never kills, and blue slides over it (spike-pit.js).
//
// Every number comes from the layout DATA — src/levels/layouts/primer.js — the
// same file the design doc's plan, sections, pacing and 3D massing model are
// generated from (docs/levels/00-the-primer.md). Behaviour (the gate, the win,
// the paint already on the floor) is LayoutLevel's, shared with the other data
// levels. The Primer's own: its mood, its pit and its dressing (polish pass 1).
import * as THREE from 'three';
import { LayoutLevel } from './layout-level.js';
import { PRIMER } from './layouts/primer.js';
import { PRIMER as TUNING } from '../config.js';
import { applyMood } from './mood.js';
import { SpikePit } from './spike-pit.js';

export class Level00 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room, plus
  // the pit's sag from the R6 landing.
  static SHOTS = [
    ...PRIMER.rooms.map((r) => ({
      name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
    })),
    { name: 'sag', label: 'R6 The Trap — the sag', position: [0, 9.6, -3], target: [0, 8, -10], fog: true },
    { name: 'range', label: 'R1 the range — crates, boards, chalk', position: [-3, 2.2, 82], target: [4, 1.2, 72], fog: true },
  ];

  get layout() { return PRIMER; }

  async load() {
    await super.load();
    applyMood(this, TUNING.mood);
    this._pits();
    this._dressing();
  }

  /** The layout's trap zones, built as spike pits in the floor they sit on. */
  _pits() {
    this.pits = [];
    const centre = new THREE.Vector3();
    for (const t of PRIMER.traps) {
      const [x0, x1, y0, , z0, z1] = t.box;
      centre.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
      const floor = this.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y0) < 1e-6 && s.worldToCell(centre));
      this.pits.push(new SpikePit({ parent: this.root, floor, box: t.box }));
    }
  }

  /**
   * Chalk lines on the floor and a timber frame on every crate and board.
   * Unlit (MeshBasic / LineBasic), so no `uLightDir` wiring; under `root`, so disposed.
   */
  _dressing() {
    const d = TUNING.dressing;
    const chalk = new THREE.MeshBasicMaterial({ color: d.chalk, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const m of PRIMER.markings) {
      const [x0, x1, z0, z1] = m.rect;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), chalk);
      line.rotation.x = -Math.PI / 2;
      line.position.set((x0 + x1) / 2, m.y + 0.005, (z0 + z1) / 2);
      this.root.add(line);
    }
    const timber = new THREE.LineBasicMaterial({ color: d.crate });
    for (const s of PRIMER.solids.filter((b) => b.kind === 'crate' || b.kind === 'board')) {
      const [x0, x1, y0, y1, z0, z1] = s.box;
      const box = new THREE.BoxGeometry(x1 - x0 + 0.02, y1 - y0 + 0.02, z1 - z0 + 0.02);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(box), timber);
      box.dispose();
      frame.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      this.root.add(frame);
    }
  }

  update(dt, player) {
    super.update(dt, player);
    for (const pit of this.pits) pit.update(dt, [player, ...this.enemies]);
  }
}
