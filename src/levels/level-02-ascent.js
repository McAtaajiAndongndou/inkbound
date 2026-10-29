// OWNER: E (Levels)
// L2 — "THE ASCENT". A spiral climb round one peak; paint is scarce.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: paint is scarce, so every shot
// is a choice between traversal and combat. The player is RATIONING.
// Enemies: Wall-crawler, Turret, Charger (13). Traps: in the trap pass.
//
// Status: BLOCKOUT of design v2. Every number comes from the layout DATA —
// src/levels/layouts/ascent.js — the same file the design doc's plan, sections
// and 3D massing model are generated from (docs/levels/02-the-ascent.md).
// Nothing about the layout lives in this file: to change the level, change the
// data, run tests/ascent-layout.test.js, and re-render the doc.
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { PAINT_GRID } from '../config.js';
import * as kit from './level-kit.js';
import { buildLayout, roomTest } from './layout-builder.js';
import { ASCENT } from './layouts/ascent.js';

// Same sun as main.js's DirectionalLight (18, 30, 12), so custom-shaded
// surfaces are lit from the side the shadows say. The mood pass (#125) owns it.
const SUN = [18, 30, 12];

/** The spawn: the first route point, lifted so the player drops onto the floor. */
const SPAWN = (() => {
  const [x, y, z] = ASCENT.routes.main[0];
  return { x, y: y + 2, z };
})();

export class Level02 extends LevelBase {
  // Viewer shots: the design doc's "what you see" frames, one per room, from
  // the same eye points — so a viewer screenshot of the BUILT level can be put
  // side by side with the doc's massing frame and compared.
  static SHOTS = ASCENT.rooms.map((r) => ({
    name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
  }));

  async load() {
    buildLayout(this, ASCENT, { cells: PAINT_GRID.level2Cells });
    this.inRoom = roomTest(ASCENT);

    this.spawn.set(SPAWN.x, SPAWN.y, SPAWN.z);
    this.spawnPoints = ASCENT.enemies.map((e) => new THREE.Vector3(...e.pos));

    // The lift cage is the win volume (#95): on the far side of the summit from
    // where you arrive, so you get the view first.
    const lift = ASCENT.slabs.find((s) => s.kind === 'lift');
    this.extraction = kit.extractionZone(
      this,
      new THREE.Vector3(lift.x[0], lift.y - 0.5, lift.z[0]),
      new THREE.Vector3(lift.x[1], lift.y + 3, lift.z[1]),
    );

    this._spawnEnemies();

    // LAST, once every custom-shaded surface exists (AGENTS.md rule 5).
    this.sunDir = kit.aimCustomShading(this.surfaces, [], SUN);
  }

  /**
   * Every enemy in the data, with its wake rule:
   *   always         — awake from the start (turrets: a machine does not doze)
   *   enter:R4       — dormant until the player stands in room R4
   *   cleared:R2.1   — dormant until every enemy of room R2, wave 1 is gone
   * Dormant enemies are visible and inert, and any hit wakes them
   * (DECISIONS, 24 Oct), so a cleared-trigger is never the only way they start.
   */
  _spawnEnemies() {
    const specs = ASCENT.enemies.map((e) => ({
      type: e.type, x: e.pos[0], y: e.pos[1], z: e.pos[2],
      sleeping: e.wake !== 'always', wakeOn: e.wake,
    }));
    const { enemies } = kit.spawnEnemies(this, specs, 'Level02');
    this.enemies = enemies;

    // Keep the data record beside each enemy: its room and wave are what the
    // cleared-triggers and the win rule count.
    this.roster = ASCENT.enemies.map((data, i) => ({ data, enemy: enemies[i] })).filter((r) => r.enemy);
  }

  /** Is every enemy of `room` (and, if given, `wave`) dead, or out of its room? */
  groupCleared(room, wave) {
    return this.roster
      .filter((r) => r.data.room === room && (wave === undefined || r.data.wave === wave))
      .every((r) => !r.enemy.alive || !this.inRoom(room, r.enemy.position));
  }

  update(dt, player) {
    for (let i = 0; i < this.roster.length; i++) {
      const { data, enemy } = this.roster[i];
      if (!enemy.sleeping) continue;
      const [kind, arg] = data.wake.split(':');
      if (kind === 'enter' && this.inRoom(arg, player.position)) enemy.wake();
      if (kind === 'cleared') {
        const [room, wave] = arg.split('.');
        if (this.groupCleared(room, Number(wave))) enemy.wake();
      }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(dt, player.position);
    }
    // The lift leaves once the ledge is clear — dead or knocked off it both
    // count, the same soft-lock guard Outskirts' gates use.
    if (!this._complete && this.extraction.containsPoint(player.position) && this.groupCleared('R6')) {
      this._complete = true;
      this.game.onWin?.();
    }
  }

  dispose() {
    for (const enemy of this.enemies) enemy.dispose?.();
    super.dispose();
  }
}
