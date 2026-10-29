import * as THREE from 'three';
import { PAINT, PAINT_IDS, SURFACE } from '../config.js';
import { createPaintMap, createPaintMaterial } from '../shaders/paint-material.js';

const ID_TO_NAME = ['grey', 'blue', 'red', 'green'];

/**
 * A paintable surface: one mesh, one material, one draw call.
 *
 * The SAME grid data is read by two things:
 *   - the shader, to decide what colour to draw    (looks)
 *   - the player controller, to decide how to move (physics)
 *
 * That is the whole design. Paint is not decoration sitting on top of the
 * physics; paint IS the physics.
 */
export class PaintSurface {
  /**
   * @param {object} opts
   * @param {number} opts.width  world size along local X
   * @param {number} opts.height world size along local Y (before rotation)
   * @param {number} opts.cells  cells per world unit (resolution of paint)
   * @param {boolean} [opts.unpaintable] refuse all paint, permanently grey
   */
  constructor({ width, height, cells = 2, unpaintable = false }) {
    this.width = width;
    this.height = height;
    this.unpaintable = unpaintable;

    const cols = Math.max(2, Math.round(width * cells));
    const rows = Math.max(2, Math.round(height * cells));

    this.map = createPaintMap(cols, rows);
    // The VISIBLE grid is one world metre per square, whatever the paint
    // resolution is. `cells` is cells per world unit, so that is exactly `cells`
    // paint cells per square -- which decouples readability from resolution.
    // They used to be the same number, and at 4 cells/unit that meant a line
    // every 25cm: 64 lines across L1's corridor, which reads as graph paper.
    // The sealed flag goes to the material (#156): an unpaintable face is drawn
    // as broken panels with seams and rivets, in the same grey, so it reads as
    // "something you cannot paint" at a glance instead of only after a shot.
    this.material = createPaintMaterial(this.map, Math.max(1, Math.round(cells)), unpaintable);

    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.userData.paintSurface = this;

    // reused every frame / every shot — never allocate in a loop
    this._local = new THREE.Vector3();
    this._cell = { col: 0, row: 0 };
  }

  /**
   * Convert a world point to grid coordinates. Returns null if off the surface.
   * The returned object is reused on the next call — read it, do not keep it.
   */
  worldToCell(worldPoint) {
    this._local.copy(worldPoint);
    this.mesh.worldToLocal(this._local);

    const u = (this._local.x / this.width) + 0.5;
    const v = (this._local.y / this.height) + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;

    this._cell.col = Math.min(this.map.cols - 1, Math.floor(u * this.map.cols));
    this._cell.row = Math.min(this.map.rows - 1, Math.floor(v * this.map.rows));
    return this._cell;
  }

  /**
   * Paint id at a world point. Returns 0 (grey) if off the surface.
   *
   * An UNPAINTABLE surface always answers grey, and that is load-bearing rather
   * than cosmetic. `surfaceAtWorld` is derived from this, and grey's SURFACE
   * entry is the one with `climbable: false` — so "this cannot be painted" and
   * "this cannot be climbed" are the same statement. That is the whole reason the
   * flag exists (#39 #3): EVERY wall in this game is a PaintSurface, and every
   * PaintSurface is paintable, so before this there was no such thing as an
   * obstacle the player could not paint green and climb over. The encounter gates
   * needed one, and so did the block on the tower's first deck.
   */
  paintIdAtWorld(worldPoint) {
    if (this.unpaintable) return PAINT_IDS.grey;
    const cell = this.worldToCell(worldPoint);
    if (!cell) return PAINT_IDS.grey;
    return this.map.data[(cell.row * this.map.cols + cell.col) * 4];
  }

  isPlayerPaintAtWorld(worldPoint){
    const paintId = this.paintIdAtWorld(worldPoint);
    return paintId === PAINT_IDS.blue || paintId === PAINT_IDS.red || paintId === PAINT_IDS.green;
  }

  /** The physics rules in force at a world point. This is what the player reads. */
  surfaceAtWorld(worldPoint) {
    return SURFACE[ID_TO_NAME[this.paintIdAtWorld(worldPoint)]];
  }

  /**
   * Splat a circle of paint centred on a world point.
   *
   * Returns false on an unpaintable surface rather than silently doing nothing,
   * so the caller (`paint-gun.js`) can tell "refused" from "landed" — the gun
   * already reports a splat to the HUD from this return value, and a shot that
   * bounces off a gate should not light up as a hit.
   */
  splat(worldPoint, colourName, worldRadius) {
    if (this.unpaintable) return false;

    const centre = this.worldToCell(worldPoint);
    if (!centre) return false;

    const id = PAINT_IDS[colourName];
    const cellsPerUnitX = this.map.cols / this.width;
    const cellsPerUnitY = this.map.rows / this.height;
    const rx = Math.max(1, Math.round(worldRadius * cellsPerUnitX));
    const ry = Math.max(1, Math.round(worldRadius * cellsPerUnitY));

    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        // elliptical falloff so splats are round in WORLD space, not grid space
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;

        const col = centre.col + dx;
        const row = centre.row + dy;
        if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) continue;

        this.map.data[(row * this.map.cols + col) * 4] = id;
      }
    }

    this.map.texture.needsUpdate = true;
    return true;
  }

  /**
   * Convert painted ground back to grey in a circle around a world point (#80).
   *
   * This is the Drainer's whole verb. Territory is the game's positive feedback,
   * and eating it is the only thing that takes it back — so the write has to be
   * the SAME write the player's gun does: one grid, cell by cell, last writer
   * wins. A drain and a splat in the same area therefore cannot corrupt each
   * other; there is no snapshot and no second copy to get out of step.
   *
   * NEAREST FIRST, and that is a gameplay rule rather than an optimisation: the
   * hole has to grow OUTWARD from the enemy standing in it, so the patch visibly
   * shrinks toward the thing eating it instead of dissolving at a hard-coded
   * edge. Rings of increasing Chebyshev distance, masked by the same ellipse
   * `splat` uses, so a drain of radius r covers exactly the ground a splat of
   * radius r would.
   *
   * @param {THREE.Vector3} worldPoint  where the eater is standing
   * @param {number} worldRadius        how far it can reach, in world units
   * @param {number} [maxCells]         cells this call may eat. The RATE is a
   *                                    per-enemy difficulty number, so it is the
   *                                    caller's job to turn seconds into cells.
   * @returns {number} cells actually turned grey (0 if there was nothing to eat)
   */
  drain(worldPoint, worldRadius, maxCells = Infinity) {
    if (this.unpaintable || maxCells <= 0) return 0;

    const centre = this.worldToCell(worldPoint);
    if (!centre) return 0;

    const cols = this.map.cols;
    const rows = this.map.rows;
    const data = this.map.data;
    // Same cell-space maths as `splat`, so the two shapes agree.
    const rx = Math.max(1, Math.round(worldRadius * (cols / this.width)));
    const ry = Math.max(1, Math.round(worldRadius * (rows / this.height)));
    const reach = Math.max(rx, ry);

    let drained = 0;

    outer: for (let ring = 0; ring <= reach; ring++) {
      // dy/dx are offsets in CELLS from the centre; walking outwards ring by
      // ring is what makes the drain nearest-first without sorting or a scratch
      // list. `ring 0` is the cell under the enemy itself.
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          // only this ring's shell — inner rings were done on earlier passes
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;

          const col = centre.col + dx;
          const row = centre.row + dy;
          if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

          const i = (row * cols + col) * 4;
          if (data[i] === PAINT_IDS.grey) continue;   // already dead ground

          data[i] = PAINT_IDS.grey;
          if (++drained >= maxCells) break outer;
        }
      }
    }

    if (drained > 0) this.map.texture.needsUpdate = true;
    return drained;
  }

  /** Fraction of the surface that is painted. Drives the paintstreak meter. */
  coverage() {
    let painted = 0;
    const total = this.map.cols * this.map.rows;
    for (let i = 0; i < total; i++) {
      if (this.map.data[i * 4] > 0) painted++;
    }
    return painted / total;
  }

  update(elapsed) {
    this.material.uniforms.uTime.value = elapsed;
  }

  /** REQUIRED on level unload — removing a mesh does not free GPU memory. */
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.map.texture.dispose();
  }
}

export { PAINT, ID_TO_NAME };
