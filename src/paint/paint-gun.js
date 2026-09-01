import * as THREE from 'three';
import { PAINT_GUN, AMMO } from '../config.js';

/**
 * Fires paint. Raycasts from the camera into the scene, finds the first
 * paintable surface, and splats.
 *
 * Ammo is the "magazine" from the CoD layer: it is what makes Level 2
 * a different game from Level 1 without changing any other rule.
 */
export class PaintGun {
  constructor(surfaces, level = 1) {
    this.surfaces = surfaces;              // array of PaintSurface
    this.colours = ['blue', 'red', 'green'];
    this.current = 0;

    const ammo = AMMO[level];
    this.maxAmmo = ammo.tank;
    this.ammo = ammo.tank;
    this.refillRate = ammo.refillRate;

    this.cooldown = 0;
    this.lastSplat = null;                 // for the hit marker

    this._raycaster = new THREE.Raycaster();
    this._centre = new THREE.Vector2(0, 0); // always fire from screen centre
    this._meshes = surfaces.map((s) => s.mesh);
  }

  get colour() {
    return this.colours[this.current];
  }

  selectColour(index) {
    if (index >= 0 && index < this.colours.length) this.current = index;
  }

  cycleColour(dir = 1) {
    this.current = (this.current + dir + this.colours.length) % this.colours.length;
  }

  tryFire(camera) {
    if (this.cooldown > 0 || this.ammo < PAINT_GUN.cost) return false;

    this._raycaster.setFromCamera(this._centre, camera);
    this._raycaster.far = PAINT_GUN.range;

    const hits = this._raycaster.intersectObjects(this._meshes, false);
    if (hits.length === 0) return false;

    const hit = hits[0];
    const surface = hit.object.userData.paintSurface;
    if (!surface) return false;

    const ok = surface.splat(hit.point, this.colour, PAINT_GUN.radius);
    if (!ok) return false;

    this.ammo -= PAINT_GUN.cost;
    this.cooldown = PAINT_GUN.fireDelay;
    this.lastSplat = { point: hit.point.clone(), colour: this.colour, age: 0 };
    return true;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.ammo = Math.min(this.maxAmmo, this.ammo + this.refillRate * dt);
    if (this.lastSplat) this.lastSplat.age += dt;
  }
}
