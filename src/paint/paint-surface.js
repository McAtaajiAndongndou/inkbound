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
   */
  constructor({ width, height, cells = 2 }) {
    this.width = width;
    this.height = height;

    const cols = Math.max(2, Math.round(width * cells));
    const rows = Math.max(2, Math.round(height * cells));

    this.map = createPaintMap(cols, rows);
    this.material = createPaintMaterial(this.map);

    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.userData.paintSurface = this;

    // reused every frame / every shot — never allocate in a loop
    this._local = new THREE.Vector3();
  }

  /** Convert a world point to grid coordinates. Returns null if off the surface. */
  worldToCell(worldPoint) {
    this._local.copy(worldPoint);
    this.mesh.worldToLocal(this._local);

    const u = (this._local.x / this.width) + 0.5;
    const v = (this._local.y / this.height) + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;

    return {
      col: Math.min(this.map.cols - 1, Math.floor(u * this.map.cols)),
      row: Math.min(this.map.rows - 1, Math.floor(v * this.map.rows)),
    };
  }

  /** Paint id at a world point. Returns 0 (grey) if off the surface. */
  paintIdAtWorld(worldPoint) {
    const cell = this.worldToCell(worldPoint);
    if (!cell) return PAINT_IDS.grey;
    return this.map.data[(cell.row * this.map.cols + cell.col) * 4];
  }

  /** The physics rules in force at a world point. This is what the player reads. */
  surfaceAtWorld(worldPoint) {
    return SURFACE[ID_TO_NAME[this.paintIdAtWorld(worldPoint)]];
  }

  /** Splat a circle of paint centred on a world point. */
  splat(worldPoint, colourName, worldRadius) {
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
