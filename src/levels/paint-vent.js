// OWNER: E (Levels)
import * as THREE from 'three';
import { TRAP } from '../config.js';
import { TrapVolume } from './trap-volume.js';

/**
 * A vent in the floor that erupts on grey and goes dead on the player's paint.
 *
 * The game's own idea used as a hazard: paint is safety. The answer costs tank,
 * so walking the long way round is still a real choice (docs/levels/01-outskirts.md).
 *
 * It is a TrapVolume with a rhythm and a paint check, nothing more. The grate is
 * an open frame so the paint under it stays visible, which is how the player
 * reads "this one is dead": they can see their own colour through the bars.
 *
 *   rest  -> tell (amber pulse) -> erupt (the column, hurts) -> rest
 *
 * Covered by paint, it drops straight back to rest and stays there. A Sprayer's
 * grey re-arms it, which is the point: the vent is contested ground.
 *
 * Every mesh is unlit (MeshBasicMaterial), so it needs no `uLightDir` wiring
 * (AGENTS rule 5), and it lives under `parent`, so the level's dispose walk frees it.
 */
export class PaintVent {
  /**
   * @param {object} spec
   * @param {THREE.Object3D} spec.parent   the level root
   * @param {object} spec.floor            the PaintSurface the vent is cut into
   * @param {{xMin:number,xMax:number,zMin:number,zMax:number}} spec.rect
   * @param {number} [spec.y]               floor height
   */
  constructor({ parent, floor, rect, y = 0 }) {
    const cfg = TRAP.vent;
    this.floor = floor;
    this.rect = rect;
    this.y = y;
    this.phase = 'rest';
    this._t = 0;

    this.trap = new TrapVolume({
      region: new THREE.Box3(
        new THREE.Vector3(rect.xMin, y - 0.5, rect.zMin),
        new THREE.Vector3(rect.xMax, y + cfg.height, rect.zMax),
      ),
      damage: cfg.damage,
      cooldown: cfg.cooldown,
    });

    // 3 x 3 samples across the grate: enough to ask "is most of it painted"
    // without reading the grid cell by cell every frame.
    this._samples = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        this._samples.push(new THREE.Vector3(
          THREE.MathUtils.lerp(rect.xMin, rect.xMax, (i + 0.5) / 3),
          y,
          THREE.MathUtils.lerp(rect.zMin, rect.zMax, (j + 0.5) / 3),
        ));
      }
    }

    this.group = new THREE.Group();
    this.group.position.set((rect.xMin + rect.xMax) / 2, y, (rect.zMin + rect.zMax) / 2);
    parent.add(this.group);

    const w = rect.xMax - rect.xMin;
    const d = rect.zMax - rect.zMin;
    this._frameMat = new THREE.MeshBasicMaterial({ color: TRAP.amber });
    this._idle = new THREE.Color(TRAP.bed);
    this._amber = new THREE.Color(TRAP.amber);
    const bar = 0.18;
    const bars = [
      [w, bar, 0, -d / 2], [w, bar, 0, d / 2],
      [bar, d, -w / 2, 0], [bar, d, w / 2, 0],
      [w, bar, 0, 0], [bar, d, 0, 0],
    ];
    for (const [bw, bd, x, z] of bars) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd), this._frameMat);
      mesh.position.set(x, 0.04, z);
      this.group.add(mesh);
    }

    this.column = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.min(w, d) * 0.35, Math.min(w, d) * 0.5, cfg.height, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: TRAP.amber, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.column.position.y = cfg.height / 2;
    this.column.visible = false;
    this.group.add(this.column);

    this._paint();
  }

  /** True when enough of the grate is the player's paint. */
  get dormant() {
    let painted = 0;
    for (let i = 0; i < this._samples.length; i++) {
      if (this.floor.isPlayerPaintAtWorld(this._samples[i])) painted += 1;
    }
    return painted >= Math.ceil(this._samples.length * TRAP.vent.coverage);
  }

  /** Advance the rhythm and hurt anything in the column. */
  update(dt, targets) {
    const cfg = TRAP.vent;

    if (this.dormant) {
      this.phase = 'dormant';
      this._t = 0;
    } else {
      if (this.phase === 'dormant') this.phase = 'rest';
      this._t += dt;
      const length = cfg[this.phase];
      if (this._t >= length) {
        this._t -= length;
        this.phase = this.phase === 'rest' ? 'tell' : this.phase === 'tell' ? 'erupt' : 'rest';
      }
    }

    // Targets are only handed over while the column stands, so a target's
    // cooldown only runs then too. TRAP.vent.cooldown equals `erupt` for that
    // reason: one hit per eruption.
    this.trap.update(dt, this.phase === 'erupt' ? targets : NONE);
    this._paint();
  }

  /** The tell: dark when dead or resting, amber pulse on tell, solid amber on erupt. */
  _paint() {
    const p = this.phase;
    this.column.visible = p === 'erupt';
    // How much amber: a live vent always glows a little, so it reads as live
    // before it ever fires; a dead one is just a dark grate.
    let amber = 0;
    if (p === 'rest') amber = 0.35;
    else if (p === 'tell') amber = 0.5 + 0.5 * Math.sin(this._t * 18);
    else if (p === 'erupt') amber = 1;
    this._frameMat.color.copy(this._idle).lerp(this._amber, amber);
  }
}

const NONE = [];
