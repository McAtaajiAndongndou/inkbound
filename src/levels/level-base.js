import * as THREE from 'three';

/**
 * OWNER: E (Levels)
 *
 * Every level extends this. The class carries the level "package" as fields so
 * `main.js` never needs to know the layout — it receives `root`, `surfaces`,
 * `spawn`, etc. and just calls `load()` then `update(dt, player)`.
 *
 * The dispose() contract is not optional — it is what stops the tab dying
 * during a three-level demo in front of a marker. Removing a mesh does NOT
 * free GPU memory; we must dispose geometry, materials and uniform textures
 * (the paint map lives in `material.uniforms.uPaintMap`, not `material.map`).
 */
export class LevelBase {
  constructor(game) {
    this.game = game;                       // { scene, onWin } created in main.js
    this.root = new THREE.Group();
    this.surfaces = [];                     // PaintSurface[], paintable + collideable
    this.spawn = new THREE.Vector3();       // where the player starts
    this.spawnPoints = [];                  // Vector3[], enemy spawns
    this.enemies = [];                      // Enemy[], ticked in update()
    this.extraction = null;                 // THREE.Box3 win trigger (if any)
    this._complete = false;                 // win reported once
  }

  async load() { throw new Error('implement load()'); }

  update(dt, player) { /* subclasses override to tick enemies / check win */ }

  dispose() {
    // Traverse every object under root, freeing geometry, materials and any
    // textures held in uniforms (uPaintMap) or material.map.
    this.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();

      const materials = Array.isArray(obj.material)
        ? obj.material
        : (obj.material ? [obj.material] : []);

      for (const mat of materials) {
        if (mat.uniforms) {
          for (const key of Object.keys(mat.uniforms)) {
            const value = mat.uniforms[key]?.value;
            if (value && value.isTexture) value.dispose();
          }
        }
        if (mat.map && mat.map.isTexture) mat.map.dispose();
        mat.dispose();
      }
    });

    if (this.game?.scene) this.game.scene.remove(this.root);
    this.root.clear();
  }
}
