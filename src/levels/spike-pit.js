// OWNER: E (Levels)
import * as THREE from 'three';
import { TRAP, PAINT_IDS } from '../config.js';
import { TrapVolume } from './trap-volume.js';

/**
 * The Primer's spike pit (R6, #101): a band of spikes across the corridor that
 * answers "is this place dangerous?" — yes, and it still never kills.
 *
 * It is a TrapVolume with two rules on top, nothing more:
 *   - `spare`: a hit never takes the last TRAP.pit.spare health (issue #79).
 *   - blue is safe: a target standing on BLUE paint is not hit. Blue is ice;
 *     you slide over the points instead of stepping between them. Same idea as
 *     Outskirts' vent ("paint is safety"), narrowed to the one colour the room
 *     before taught. Red and green do not help: one answer per lesson.
 *
 * THE TELL is the sag: the boards at both edges tilt down toward the pit, a
 * dark recess sits over it, and the spikes poke through. The recess is
 * see-through so blue paint on the pit still shows — the player has to SEE
 * that their answer landed.
 *
 * Every mesh is unlit (MeshBasicMaterial), so no `uLightDir` wiring (AGENTS
 * rule 5), and it lives under `parent`, so the level's dispose walk frees it.
 */
export class SpikePit {
  /**
   * @param {object} spec
   * @param {THREE.Object3D} spec.parent   the level root
   * @param {object} spec.floor            the PaintSurface the pit is in
   * @param {number[]} spec.box            the layout trap box [x0,x1,y0,y1,z0,z1]
   */
  constructor({ parent, floor, box }) {
    const [x0, x1, y0, y1, z0, z1] = box;
    const cfg = TRAP.pit;
    this.floor = floor;
    this.trap = new TrapVolume({
      region: new THREE.Box3(new THREE.Vector3(x0, y0 - 0.5, z0), new THREE.Vector3(x1, y1, z1)),
      damage: TRAP.spike.damage,
      cooldown: TRAP.spike.cooldown,
      spare: cfg.spare,
    });
    this._exposed = [];

    const w = x1 - x0;
    const d = z1 - z0;
    this.group = new THREE.Group();
    this.group.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2);
    parent.add(this.group);

    const bed = new THREE.MeshBasicMaterial({ color: TRAP.bed, transparent: true, opacity: cfg.bedOpacity, depthWrite: false });
    const recess = new THREE.Mesh(new THREE.PlaneGeometry(w, d), bed);
    recess.rotation.x = -Math.PI / 2;
    recess.position.y = 0.01;
    this.group.add(recess);

    // The sag: a sagging board at each edge, its inner end dipping into the pit.
    const board = new THREE.MeshBasicMaterial({ color: TRAP.amber });
    const boardGeo = new THREE.BoxGeometry(w, 0.1, 0.8);
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(boardGeo, board);
      b.position.set(0, 0.02, side * (d / 2 - 0.4));
      b.rotation.x = side * cfg.sag;   // the edge nearest the pit is the low end
      this.group.add(b);
    }

    // The spikes: one instanced cone per ~1 m, rows across the depth.
    const cols = Math.max(1, Math.round(w));
    const rows = cfg.spikeRows;
    const cone = new THREE.ConeGeometry(0.12, cfg.spikeHeight, 6);
    cone.translate(0, cfg.spikeHeight / 2, 0);
    this.spikes = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: 0x8a8378 }), cols * rows);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const stagger = (j % 2) * 0.5;
        m.makeTranslation(-w / 2 + (i + 0.5 + stagger) * (w / (cols + 0.5)), 0, -d / 2 + 0.9 + j * (d - 1.8) / Math.max(1, rows - 1));
        this.spikes.setMatrixAt(n++, m);
      }
    }
    this.group.add(this.spikes);
  }

  /** Is the floor under `position` blue? Blue slides over the spikes. */
  onBlue(position) {
    return this.floor.paintIdAtWorld(position) === PAINT_IDS.blue;
  }

  update(dt, targets) {
    this._exposed.length = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t && t.position && !this.onBlue(t.position)) this._exposed.push(t);
    }
    this.trap.update(dt, this._exposed);
  }
}
