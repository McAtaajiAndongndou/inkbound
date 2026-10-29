// Paintstreak (#131, PRD C7). The reward for playing well is the ability to
// play better: new ground and kills fill a gauge, and a full gauge is spent on
// one large splat that claims a zone and stuns everything inside it.
//
// Lives in paint/ because both halves are paint: the gauge is fed by painted
// cells, and the spend IS a splat. The HUD only draws `fraction`; main.js owns
// the key and calls `spend`. All numbers are in config.js PAINTSTREAK.
//
// Coordinate with Dikeledi (paint lane) on `zoneSplat` — it is the one new
// write into the paint grid, and it goes through `PaintSurface.splat` so it is
// the same write the gun makes.
import * as THREE from 'three';
import { PAINTSTREAK, PAINT_IDS } from '../config.js';

const CHANNELS = ['paint', 'kill', 'traverse'];

/** Player-painted cells across every paintable surface: the coverage the gauge reads. */
export function countPaintedCells(surfaces) {
  let n = 0;
  for (const s of surfaces) {
    if (s.unpaintable) continue;
    const { data, cols, rows } = s.map;
    for (let i = 0, total = cols * rows; i < total; i++) {
      const id = data[i * 4];
      if (id === PAINT_IDS.blue || id === PAINT_IDS.red || id === PAINT_IDS.green) n++;
    }
  }
  return n;
}

const _local = new THREE.Vector3();
const _point = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

/**
 * Paint a circle of `colour` at `centre` onto every FLOOR it reaches — not only
 * the one under the player — so a zone at the edge of an island still claims
 * the neighbouring strip. Walls are skipped: the zone is ground.
 *
 * Each surface is splatted at the point of it nearest the centre, with the
 * radius the circle still has at that distance, which keeps the claimed shape
 * close to one circle across surface seams.
 */
export function zoneSplat(surfaces, centre, colour, radius = PAINTSTREAK.zoneRadius) {
  let painted = 0;
  for (const s of surfaces) {
    if (s.unpaintable || !s.mesh) continue;
    _normalMatrix.getNormalMatrix(s.mesh.matrixWorld);
    _normal.set(0, 0, 1).applyMatrix3(_normalMatrix).normalize();
    if (_normal.y < 0.7) continue; // a wall or a ceiling

    _local.copy(centre);
    s.mesh.worldToLocal(_local);
    if (Math.abs(_local.z) > PAINTSTREAK.zoneHeight) continue;

    const hx = s.width / 2;
    const hy = s.height / 2;
    const cx = Math.max(-hx, Math.min(hx, _local.x));
    const cy = Math.max(-hy, Math.min(hy, _local.y));
    const d = Math.hypot(_local.x - cx, _local.y - cy);
    if (d >= radius) continue;

    _point.set(cx, cy, 0);
    s.mesh.localToWorld(_point);
    if (s.splat(_point, colour, Math.sqrt(radius * radius - d * d))) painted++;
  }
  return painted;
}

export class Paintstreak {
  constructor() {
    this.reset();
  }

  /** Level load, restart or death: an empty gauge and a fresh baseline. */
  reset() {
    this.value = 0;
    this._cells = null;          // painted cells at the last scan; null = take a baseline
    this._sampleTimer = 0;
    this._active = { paint: 0, kill: 0, traverse: 0 };
  }

  get fraction() {
    return this.value / PAINTSTREAK.max;
  }

  get full() {
    return this.value >= PAINTSTREAK.max;
  }

  /** How many of paint / kill / traverse have happened inside the variety window. */
  get activeChannels() {
    let n = 0;
    for (const c of CHANNELS) if (this._active[c] > 0) n++;
    return n;
  }

  get multiplier() {
    return 1 + PAINTSTREAK.varietyBonus * Math.max(0, this.activeChannels - 1);
  }

  /** An enemy died. */
  onKill() {
    this._touch('kill');
    this._add(PAINTSTREAK.pointsPerKill);
  }

  /**
   * @param {number} dt
   * @param {object} world
   * @param {object[]} world.surfaces  the level's PaintSurfaces
   * @param {number} world.speed       the player's horizontal speed, m/s
   */
  update(dt, { surfaces, speed }) {
    for (const c of CHANNELS) if (this._active[c] > 0) this._active[c] -= dt;
    if (speed >= PAINTSTREAK.traverseSpeed) this._touch('traverse');

    // Coverage: a grid scan, so a few times a second rather than every frame.
    this._sampleTimer -= dt;
    if (this._sampleTimer > 0) return;
    this._sampleTimer = PAINTSTREAK.sampleInterval;
    const cells = countPaintedCells(surfaces);
    if (this._cells !== null && cells > this._cells) {
      this._touch('paint');
      this._add((cells - this._cells) / PAINTSTREAK.cellsPerPoint);
    }
    // Ground the enemies took back lowers the baseline, so winning it back
    // fills again: retaking territory is playing the loop.
    this._cells = cells;
  }

  /**
   * Spend a full gauge: claim the zone at `centre` in `colour` and stun every
   * enemy standing in it. Returns false (and does nothing) unless full.
   */
  spend({ surfaces, enemies, centre, colour }) {
    if (!this.full) return false;
    this.value = 0;

    zoneSplat(surfaces, centre, colour);
    // The zone is the reward, not more fuel: rebaseline so it cannot refill itself.
    this._cells = countPaintedCells(surfaces);

    const r2 = PAINTSTREAK.zoneRadius * PAINTSTREAK.zoneRadius;
    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.position) continue;
      const dx = enemy.position.x - centre.x;
      const dz = enemy.position.z - centre.z;
      if (dx * dx + dz * dz > r2) continue;
      if (Math.abs(enemy.position.y - centre.y) > PAINTSTREAK.zoneHeight) continue;
      enemy.stun?.(PAINTSTREAK.stunTime);
    }
    return true;
  }

  _touch(channel) {
    this._active[channel] = PAINTSTREAK.varietyWindow;
  }

  _add(points) {
    this.value = Math.min(PAINTSTREAK.max, this.value + points * this.multiplier);
  }
}
