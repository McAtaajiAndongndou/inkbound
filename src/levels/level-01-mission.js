// OWNER: E (Levels)
// L1 — "THE BRIEFING". Linear corridor mission, objective markers, extraction point.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: it is the only level with
// generous paint. The player is LEARNING that colour changes physics.
// Enemies: Sprayer, Charger. No armour. Low count.
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { PaintSurface } from '../paint/paint-surface.js';
import { PAINT, ENEMY, PAINT_GRID } from '../config.js';
import { Enemy } from '../enemies/enemy.js';

/**
 * Layout numbers, named so the blockout is iterable — tune here, re-test.
 * Full-width corridor (x −8…8) so no gate can be bypassed sideways.
 *
 * Route (z runs +18 → −25): start island → jump Gap 1 → island B (enemies,
 * blue run-up) → blue over Gap 2 → island C (red pad) → red launch onto the
 * platform → green climb the wall → extraction ledge.
 */
const L1 = {
  corridorHalf: 8,            // full width 16
  cells: PAINT_GRID.level1Cells,
  spawn: { x: 0, y: 2, z: 13 },

  islands: {
    A: { zMin: 8,   zMax: 18  },  // start — spawn + fall respawn land here
    B: { zMin: -4,  zMax: 3.5 },  // middle — enemy spawns + blue run-up
    C: { zMin: -19, zMax: -11 },  // red pad → platform
  },

  platform: { zMin: -18, zMax: -12, y: 4, width: 8 },  // red required (jump apex 1.39m)
  wall:     { yBase: 4, yTop: 9, z: -19 },             // green required, full width
  ledge:    { zMin: -25, zMax: -14, y: 9 },            // walkable; protrudes so the wall jump-off lands
  extraction: { zMin: -25, zMax: -19 },                // win zone (back of the ledge, past the wall)

  beacons: {                  // colour-coded to their gate
    blue:  { x: 0, y: 2,    z: -7.5 },   // Gap 2
    red:   { x: 0, y: 5,    z: -12 },    // platform
    green: { x: 0, y: 10.5, z: -19 },    // wall
  },

  // DESIGN.md teaching beats, not just spawn points:
  //   Charger  — island B. Charges at 5 m/s for 25 contact damage. The only
  //              answer on the island is paint BLUE: it slides straight past
  //              instead of steering. That same blue patch is the run-up for
  //              Gap 2, so one decision pays off twice.
  //   Sprayer  — island C. Slower (10 damage) pressure while you paint the red
  //              pad that launches you to the platform.
  spawns: [
    { x: 4,  y: 0, z: 2,   type: 'charger' },
    { x: -4, y: 0, z: -14, type: 'sprayer' },
  ],
};

export class Level01 extends LevelBase {
  async load() {
    for (const { zMin, zMax } of Object.values(L1.islands)) {
      this._floor(zMin, zMax, 0);
    }
    this._floor(L1.platform.zMin, L1.platform.zMax, L1.platform.y, L1.platform.width);
    this._floor(L1.ledge.zMin, L1.ledge.zMax, L1.ledge.y);

    this._wall();
    this._beacons();
    this._extraction();

    this.spawn.set(L1.spawn.x, L1.spawn.y, L1.spawn.z);

    this.spawnPoints = L1.spawns.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this._spawnEnemies();
  }

  update(dt, player) {
    // Pass the position, not the player: Enemy.update does arithmetic on what
    // it receives, and a Player object has no x/y/z.
    for (const enemy of this.enemies) enemy.update(dt, player.position);

    // Extraction fires the win exactly once, guarded by `_complete`.
    if (!this._complete && this.extraction && this.extraction.containsPoint(player.position)) {
      this._complete = true;
      this.game.onWin?.();
    }
  }

  /**
   * Attach enemies under `this.root`, not `game.scene`, so the base traverse
   * in dispose() frees them along with everything else.
   *
   * Still guarded: a throw here would silently produce an empty `enemies`
   * array, which looks exactly like "the enemies are just not there yet".
   */
  _spawnEnemies() {
    try {
      // Only walkable surfaces — the probe treats every entry as a floor to
      // stand on, and a wall in that list would be a floor you stand on top of.
      const floors = this.surfaces.filter((s) => s.isFloor);

      for (const { x, y, z, type } of L1.spawns) {
        const config = ENEMY[type] ?? ENEMY.sprayer;
        this.enemies.push(
          new Enemy({
            position: new THREE.Vector3(x, y, z),
            config,
            parent: this.root,
            floors,
          }),
        );
      }
    } catch (err) {
      console.error('[Level01] enemy spawn failed, running without enemies:', err);
      this.enemies = [];
    }
  }

  dispose() {
    // Enemies may own GPU resources not attached to `root` — free them first,
    // then let the base traverse dispose every mesh/material/texture under root.
    for (const enemy of this.enemies) enemy.dispose?.();
    super.dispose();
  }

  /** A flat, walkable paint surface on the XZ plane. `height` is world Z depth. */
  _floor(zMin, zMax, y = 0, width = L1.corridorHalf * 2) {
    const s = new PaintSurface({ width, height: zMax - zMin, cells: L1.cells });
    s.mesh.rotation.x = -Math.PI / 2;
    s.mesh.position.set(0, y, (zMin + zMax) / 2);
    s.mesh.receiveShadow = true;
    s.isFloor = true;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /** The hard gate: a full-width vertical panel, climbable only when green. */
  _wall() {
    const { yBase, yTop, z } = L1.wall;
    const s = new PaintSurface({ width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /** Minimal unlit beacons, one per gate, colour-coded. Shared geo + material. */
  _beacons() {
    const geo = new THREE.BoxGeometry(0.7, 2.2, 0.7);
    const mats = {
      blue:  new THREE.MeshBasicMaterial({ color: PAINT.blue.hex }),
      red:   new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
      green: new THREE.MeshBasicMaterial({ color: PAINT.green.hex }),
    };
    for (const [colour, pos] of Object.entries(L1.beacons)) {
      const m = new THREE.Mesh(geo, mats[colour]);
      m.position.set(pos.x, pos.y, pos.z);
      this.root.add(m);
    }
  }

  /** The win volume (Box3) + a faint white marker box on the extraction ledge. */
  _extraction() {
    const { zMin, zMax } = L1.extraction;
    const y = L1.ledge.y;
    const min = new THREE.Vector3(-L1.corridorHalf, y - 1, zMin);
    const max = new THREE.Vector3(L1.corridorHalf, y + 2, zMax);
    this.extraction = new THREE.Box3(min, max);

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    marker.position.set(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    );
    this.root.add(marker);
  }
}
