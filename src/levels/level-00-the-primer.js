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
import { PRIMER as TUNING, PLACED_LIGHTS } from '../config.js';
import * as kit from './level-kit.js';
import { applyMood } from './mood.js';
import { SpikePit } from './spike-pit.js';
import { buildDressing } from './dressing.js';
import { ComboRack } from './combo-rack.js';

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
    this._lamps();
    this._floorGrid();
    // R7's second wave: the combo dummy and the rack that teaches it (QA 30 Oct).
    this.comboDummy = this.roster.find((r) => r.data.id === 'r7-combo-dummy')?.enemy ?? null;
    this.comboRack = new ComboRack(this.root, PRIMER.comboRack);
  }

  /**
   * Warm lamps (layout `lamps`): a small lit box and a soft additive halo
   * behind it. Unlit materials (no `uLightDir` wiring, AGENTS rule 5), under
   * `root` (disposed). Hero lamps light a room's focal prop; lead lamps hang on
   * the far side of the exit, so the next doorway is the warmest thing in view.
   */
  _lamps() {
    const d = TUNING.dressing;
    const bulb = new THREE.MeshBasicMaterial({ color: d.lamp });
    const halo = new THREE.MeshBasicMaterial({
      color: d.lamp, map: haloTexture(), transparent: true, opacity: d.glow,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.lamps = [];
    for (const l of PRIMER.lamps ?? []) {
      const group = new THREE.Group();
      group.position.set(...l.at);
      group.name = l.id;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), bulb);
      const size = d.glowSize * (l.role === 'lead' ? 1.5 : 1);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), halo);
      glow.position.z = 0.05;
      group.add(box, glow);
      this.root.add(group);
      this.lamps.push(group);
      // #198: the lead lamps really light the way on (the pool, #195): warm
      // tungsten on the doorway's floor and walls, not only a glow sprite.
      if (l.role === 'lead') kit.placeLight(this, PLACED_LIGHTS.lamp, group.position.clone());
    }
  }

  /** Floor grid squares bigger than the walls' (TUNING.dressing.floorGrid): floor and wall read apart. */
  _floorGrid() {
    for (const s of this.surfaces) {
      const u = s.isFloor ? s.mesh.material?.uniforms?.uGridStep : null;
      if (u) u.value *= TUNING.dressing.floorGrid;
    }
  }

  /**
   * The layout's trap zones, built as spike pits in the floors they sit on.
   * R6's floor is three pieces across the pit, so collect every piece the box
   * touches (sampled every half metre); one piece left blue on the others unread.
   */
  _pits() {
    this.pits = [];
    const p = new THREE.Vector3();
    for (const t of PRIMER.traps) {
      const [x0, x1, y0, , z0, z1] = t.box;
      const floors = new Set();
      for (let x = x0; x <= x1; x += 0.5) {
        for (let z = z0; z <= z1; z += 0.5) {
          p.set(x, y0, z);
          const floor = this.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y0) < 1e-6 && s.worldToCell(p));
          if (floor) floors.add(floor);
        }
      }
      this.pits.push(new SpikePit({ parent: this.root, floors: [...floors], box: t.box }));
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
    // The rebels' chalk stencils on R0's wall (the dressing pass, PRIMER.dressing).
    this.dressing = buildDressing(this, PRIMER.dressing.items);
  }

  /** Is `p` standing in R2's submerge pool (the layout's `r2-pool` prepaint)? */
  _inPool(p) {
    const pool = PRIMER.prepaint.find((q) => q.id === 'r2-pool');
    const [x0, x1, z0, z1] = pool.rect;
    return p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && Math.abs(p.y - pool.y) < 0.5;
  }

  /** Is `p` beyond every spike pit's far edge? The route runs toward -z. */
  _pastPits(p) {
    return PRIMER.traps.every((t) => p.z < t.box[4]);
  }

  update(dt, player) {
    super.update(dt, player);
    for (const pit of this.pits) pit.update(dt, [player, ...this.enemies]);
    this.comboRack?.update(this.comboDummy);
    this._sergeant(player.position);
  }

  /**
   * #112 — the sergeant's lines (docs/levels/00-the-primer.md): the first
   * splat (R2), submerge (standing in R2's pool, polish audit), the Charger
   * (once you are past R6's spike pit — on entering R6 it played AT the trap,
   * and a pit hit counts as combat and cut it; quality plan B5), extraction (R9).
   * A fight clears a line, so the Charger's wake waits a few seconds after R7's
   * doorway (layout `wake`) for the line to be read.
   *
   * Each is asked until the bar takes it: the bar refuses a line while another
   * is up (`say` returns false), and the pool line comes right after R2's first.
   */
  _sergeant(p) {
    this._said ??= new Set();
    const ask = (id, when) => {
      if (this._said.has(id) || !when) return;
      if (this.game.say?.(id) !== false) this._said.add(id);
    };
    ask('primer-splat', this.inRoom('R2', p));
    ask('primer-submerge', this._said.has('primer-splat') && this._inPool(p));
    ask('primer-trap', this.inRoom('R6', p) && !this._pastPits(p));   // #217: before the pit
    // Past the pit, and still asked in R7 until the Charger wakes: the trap
    // warning holds the bar ~6 s, so at a walk the player is through R7's door
    // before the bar is free (#217).
    const charger = this.enemies[0];
    ask('primer-theirs', this._pastPits(p) && (this.inRoom('R6', p) || this.inRoom('R7', p)) && charger?.sleeping !== false);
    // The combo: the moment its dummy wakes (the Charger is down).
    ask('primer-combo', this.comboDummy?.sleeping === false);
    ask('primer-ready', this.inRoom('R9', p));
  }
}

/** A soft round falloff, code-built (no download), for the lamps' halos. */
function haloTexture() {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - r) ** 2;
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.needsUpdate = true;
  return tex;
}
