import * as THREE from 'three';
import { CAMERA } from '../config.js';
import { pointLights } from '../shaders/point-lights.js';

/**
 * The yaw and pitch that look from `spawn` toward `look`, in the player's own
 * convention (forward = (-sin yaw, 0, -cos yaw); pitch up is positive) and
 * clamped to the camera's pitch range, so the first frame is one the player
 * could have turned to themselves (polish audit, Level visuals: the Ascent's
 * first frame was a grey wall because every level started facing -z, level).
 * main.js applies it to the player; the viewer's spawn shot uses it too.
 */
export function spawnAim(spawn, look) {
  const dx = look.x - spawn.x;
  const dz = look.z - spawn.z;
  const flat = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(look.y - spawn.y, Math.max(flat, 1e-6));
  return { yaw, pitch: Math.max(CAMERA.pitchMin, Math.min(CAMERA.pitchMax, pitch)) };
}

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
    this.spawnLook = null;                  // optional Vector3 the first frame faces (see spawnAim)
    this.spawnPoints = [];                  // Vector3[], enemy spawns
    this.enemies = [];                      // Enemy[], ticked in update()
    this.extraction = null;                 // THREE.Box3 win trigger (if any)
    this._complete = false;                 // win reported once
    // Optional: a Group holding everything that is "air" rather than level
    // geometry -- sky, mist, weather. main.js hides it for the minimap pass so
    // the top-down view is not washed out. Levels with no atmosphere leave it
    // null, and main.js tolerates that.
    this.atmosphere = null;
    // The cube map wet paint reflects (#194). Built after the sky exists
    // (mood.js / Outskirts' _mood); disposed first in dispose().
    this.skyProbe = null;
  }

  /**
   * `{ yaw, pitch }` for the player's first frame, or null to keep the default
   * (facing -z, level). main.js applies it when it builds the player.
   */
  get spawnFacing() {
    return this.spawnLook ? spawnAim(this.spawn, this.spawnLook) : null;
  }

  async load() { throw new Error('implement load()'); }

  update(dt, player) { /* subclasses override to tick enemies / check win */ }

  dispose() {
    // The probe's cube target is not under root, so the walk below cannot see it.
    this.skyProbe?.dispose();
    this.skyProbe = null;
    // Every light source this level placed (#198); enemies hand back their own.
    pointLights.removeOwner(this);

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
            // A render target's texture belongs to its target, whose owner
            // disposes it (the sky probe above). The paint's uEnvMap is SHARED
            // with the next level's surfaces, so freeing it here would blank
            // the level that is loading.
            if (value && value.isTexture && !value.isRenderTargetTexture) value.dispose();
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
