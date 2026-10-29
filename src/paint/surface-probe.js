import * as THREE from "three";
import { PLAYER } from "../config.js";

/**
 * OWNER: E (Levels) — extracted from core/player.js
 *
 * "What floor am I standing on?" as a standalone, allocation-free query.
 *
 * NOT a THREE.Raycaster. A raycast allocates a hit object plus point/uv/
 * normal/face per hit, every frame; core removed it from the player loop for
 * exactly that reason (see player.js _probeGround). Every floor here is a
 * single flat PaintSurface plane, so we intersect the ray with each plane in
 * the plane's own local space instead — the same trick as _resolveWalls.
 *
 * One instance per consumer: the scratch vectors below are per-instance and
 * the returned hit object is REUSED, so the player and an enemy cannot
 * trample each other's result. Do not hold the returned object across calls.
 *
 * Player migration onto this module is deliberately a separate change — the
 * enemy adopts it first, so the extraction is proven by one caller before
 * the core controller depends on it.
 */
export class SurfaceProbe {
  /**
   * @param {PaintSurface[]} floors walkable surfaces only — walls must be
   *                              filtered out by the caller via `isFloor`
   */
  constructor(floors) {
    this.floors = floors;

    // reused every call — never allocate in a loop
    this._dirLocal = new THREE.Vector3();
    this._inv = new THREE.Matrix4();
    this._origin = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._hit = { y: 0, surface: null, point: new THREE.Vector3() };
  }

  /**
   * Nearest floor at or below `position`, or null when there is none.
   * Reuses one result object — copy anything you need to keep.
   */
  down(position) {
    this._origin.copy(position);
    this._origin.y += PLAYER.groundProbeLift;

    let best = null;
    let bestDist = PLAYER.groundProbeRange;

    // TOLERANCE ON EVERY BOUNDARY, not just the edges. The world-space plane
    // maths below lands an exact limit at 6.000000000000001 often enough to
    // matter: a floor exactly at `groundProbeRange` away, or a point exactly on
    // a lip, would be rejected while a raycaster hits it. A player standing on
    // the lip must get the floor, not fall through.
    const EPS = 1e-6;

    // indexed loop: `for...of` over an array allocates an iterator object on
    // every call until V8 optimises it away, and this runs per enemy per frame.
    for (let i = 0; i < this.floors.length; i++) {
      const floor = this.floors[i];
      // one matrix inverse per floor: the direction is just minus the
      // inverse's Y column, so no second worldToLocal is needed
      floor.mesh.updateWorldMatrix(true, false);
      this._inv.copy(floor.mesh.matrixWorld).invert();
      this._local.copy(this._origin).applyMatrix4(this._inv);

      const e = this._inv.elements;
      this._dirLocal.set(-e[4], -e[5], -e[6]);

      // the plane faces local +Z; only hit it from the front
      if (this._dirLocal.z >= 0) continue;

      const dist = -this._local.z / this._dirLocal.z;
      if (dist < 0 || dist > bestDist + EPS) continue;

      const hx = this._local.x + this._dirLocal.x * dist;
      const hy = this._local.y + this._dirLocal.y * dist;
      if (Math.abs(hx) > floor.width * 0.5 + EPS
        || Math.abs(hy) > floor.height * 0.5 + EPS) continue;

      best = floor;
      bestDist = dist;
    }

    if (!best) return null;

    const hit = this._hit;
    hit.surface = best;
    hit.y = this._origin.y - bestDist;
    hit.point.set(this._origin.x, hit.y, this._origin.z);
    return hit;
  }
}
