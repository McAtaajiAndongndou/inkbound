// OWNER: Shaders + enemies
import * as THREE from 'three';
import { ENEMY_ATTACK } from '../config.js';

/**
 * The colour given back (polish audit P1-4): a killed enemy bursts into
 * droplets of the colour that killed it. main.js paints the splat they "land"
 * as (player paint, so the kill is a refill pool); this is the burst you see.
 *
 * One InstancedMesh of small low-poly drops, thrown out and up, falling under
 * gravity and shrinking out over `life`. Unlit (MeshBasicMaterial), so it needs
 * no `uLightDir` wiring (AGENTS rule 5). The enemy that made it disposes it
 * (geometry and material, AGENTS rule 6) when its corpse is removed.
 */
export class DeathBurst {
  /**
   * @param {THREE.Object3D} parent  where to add it (the level root)
   * @param {THREE.Vector3} at       the enemy's feet
   * @param {number} colour          hex: the killing colour
   */
  constructor(parent, at, colour) {
    const cfg = ENEMY_ATTACK.burst;
    this.cfg = cfg;
    this.t = 0;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(cfg.size, 0),
      new THREE.MeshBasicMaterial({ color: colour }),
      cfg.count,
    );
    this.mesh.name = 'death-burst';
    this.mesh.frustumCulled = false;
    this.origin = at.clone();
    this.origin.y += cfg.height;
    this.vel = [];
    for (let i = 0; i < cfg.count; i++) {
      // Golden-angle spread round the body, alternating up-throw, so no two
      // drops leave on the same line and nothing random makes tests flaky.
      const a = i * 2.39996;
      const out = cfg.speed * (0.6 + 0.4 * ((i * 7) % 5) / 4);
      this.vel.push(new THREE.Vector3(Math.cos(a) * out, cfg.lift * (0.6 + 0.4 * (i % 3) / 2), Math.sin(a) * out));
    }
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    parent?.add(this.mesh);
    this.update(0);
  }

  get done() {
    return this.t >= this.cfg.life;
  }

  update(dt) {
    this.t += dt;
    const t = Math.min(this.t, this.cfg.life);
    const k = 1 - t / this.cfg.life;
    for (let i = 0; i < this.vel.length; i++) {
      const v = this.vel[i];
      this._p.set(
        this.origin.x + v.x * t,
        Math.max(this.origin.y - this.cfg.height, this.origin.y + v.y * t - 0.5 * this.cfg.gravity * t * t),
        this.origin.z + v.z * t,
      );
      this._s.setScalar(Math.max(0.001, k));
      this.mesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = !this.done;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
