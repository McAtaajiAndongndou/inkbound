import * as THREE from "three";
import { PAINT_GUN, AMMO } from "../config.js";


const PROJECTILE_COLOURS = {
  blue: 0x3b82f6,
  red: 0xef4444,
  green: 0x22c55e,
  grey: 0xaaaaaa,
};

const PROJECTILE_SPEED = 60;

const BURST_PARTICLE_COUNT = 8;
const BURST_PARTICLE_SPEED = 5;
const BURST_PARTICLE_LIFETIME = 0.45;

/**
 * Fires paint. Raycasts from the camera into the scene, finds the first
 * paintable surface, and splats.
 *
 * Ammo is the "magazine" from the CoD layer: it is what makes Level 2
 * a different game from Level 1 without changing any other rule.
 */
export class PaintGun {
  constructor(surfaces, level = 1, enemies = [], scene = null) {
    this.surfaces = surfaces; // array of PaintSurface
    this.enemies = enemies;
    this.scene = scene;
    this.projectiles = [];

    this.burstParticles = [];
    this._burstGeometry = new THREE.SphereGeometry(0.04,6,6);
    this._burstMaterials = {};

    for (const [name,hex] of Object.entries(PROJECTILE_COLOURS)){
      this._burstMaterials[name] = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 1,
      });
    }

    this.colours = ["blue", "red", "green", "grey"];
    this.current = 0;

    const ammo = AMMO[level];
    this.maxAmmo = ammo.tank;

    this.ammo = {
      blue: ammo.tank,
      red: ammo.tank,
      green: ammo.tank,
    };

    this.cooldown = 0;
    this.lastSplat = null;
    this.lastShot = null;  // 'splat' | 'hit' | 'kill' — what the last landed shot did (HUD + SFX)
    this.dryFire = false;

    this._raycaster = new THREE.Raycaster();
    this._centre = new THREE.Vector2(0, 0); // always fire from screen centre
    this._meshes = [
      ...surfaces.map((s) => s.mesh),
      ...enemies.map((enemy) => enemy.mesh).filter(Boolean),
    ];

    this._geometry = new THREE.SphereGeometry(0.07,8,8);
    this._materials = {};
    for (const [name,hex] of Object.entries(PROJECTILE_COLOURS)){
      this._materials[name] = new THREE.MeshBasicMaterial({color:hex});
  
    }

    this._dir = new THREE.Vector3();
  }

  get colour() {
    return this.colours[this.current];
  }

  selectColour(index) {
    if (index >= 0 && index < this.colours.length) this.current = index;
  }

  cycleColour(dir = 1) {
    this.current =
      (this.current + dir + this.colours.length) % this.colours.length;
  }
  
  tryFire(camera, muzzle = null) {
    if (this.cooldown > 0) return false;

    if (this.colour !== "grey" && this.ammo[this.colour] < PAINT_GUN.cost) {
      this.dryFire = true;
      return false;
    }

    this.lastShot = null;
    this._raycaster.setFromCamera(this._centre, camera);
    this._raycaster.far = PAINT_GUN.range;

    const hits = this._raycaster.intersectObjects(this._meshes, true);

    // If nothing is hit, still fire a visible projectile.
    if (hits.length === 0) {
      const start = new THREE.Vector3();
      camera.getWorldPosition(start);

      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      const target = start.addScaledVector(direction, PAINT_GUN.range);

      if (this.colour !== "grey") {
        this.ammo[this.colour] -= PAINT_GUN.cost;
      }

      this.cooldown = PAINT_GUN.fireDelay;
      this._spawnProjectile(camera, muzzle, target, this.colour, () => {});
      return true;
    }

    // Find the first hit that isn't a dead enemy.
    let hit = null;
    let enemy = null;

    for (const h of hits) {
      let obj = h.object;

      while (obj && !obj.userData.enemy) {
        obj = obj.parent;
      }

      const foundEnemy = obj?.userData.enemy ?? null;

      if (foundEnemy && !foundEnemy.alive) continue;

      hit = h;
      enemy = foundEnemy;
      break;
    }

    if (!hit) return false;

    // Grey paint cannot damage enemies.
    if (enemy && this.colour === "grey") return false;

    let surface = null;

    if (!enemy) {
      let surfaceObject = hit.object;

      while (surfaceObject && !surfaceObject.userData.paintSurface) {
        surfaceObject = surfaceObject.parent;
      }

      surface = surfaceObject?.userData.paintSurface;

      if (!surface) return false;
    }

    const colour = this.colour;
    const colourId = this.current + 1;
    const point = hit.point.clone();

    const normal = hit.face
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);

    if (colour !== "grey") {
      this.ammo[colour] -= PAINT_GUN.cost;
    }

    this.cooldown = PAINT_GUN.fireDelay;

    const onImpact = () => {
      this._spawnImpactBurst(point, colour, normal);

      if (enemy) {
        enemy.takeColourHit(colourId, undefined, point);
        this.lastShot = enemy.alive ? "hit" : "kill";
      } else {
        if (surface.splat(point, colour, PAINT_GUN.radius)) {
          this.lastSplat = { point: point.clone(), colour, age: 0 };
          this.lastShot = "splat";
        }
      }
    };

    this._spawnProjectile(camera, muzzle, point, colour, onImpact);

    return true;
  }

 

  _spawnProjectile(camera,muzzle,target,colour,onImpact){
    if(!this.scene){
      onImpact();
      return;
    }

    const mesh = new THREE.Mesh(this._geometry, this._materials[colour]);
    if (muzzle){
      mesh.position.copy(muzzle);
    }else{
      camera.getWorldPosition(mesh.position);
    }

    mesh.lookAt(target);
    mesh.scale.set(1,1,3);

    this.scene.add(mesh);
    this.projectiles.push({mesh, target:target.clone(), onImpact});
  }

  _spawnImpactBurst(point, colour, normal){
    if(!this.scene){
      return;
    }

    for (let i = 0; i < BURST_PARTICLE_COUNT; i++){
      const mesh = new THREE.Mesh(
        this._burstGeometry,
        this._burstMaterials[colour].clone()
      );

      mesh.position.copy(point);

      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      if(direction.dot(normal) < 0){
        direction.reflect(normal);
      }

      this.scene.add(mesh);

      this.burstParticles.push({
        mesh,
        direction,
        age:0,
      });
    }
  }

  refillAmmo() {
    if (this.colour === "grey") return;
    this.ammo[this.colour] = this.maxAmmo;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.lastSplat) this.lastSplat.age += dt;
    this.dryFire = false;

    for (let i = this.projectiles.length - 1; i >= 0; i--){
      const p = this.projectiles[i];
      const dir = this._dir.subVectors(p.target, p.mesh.position);
      const dist = dir.length();
      const step = PROJECTILE_SPEED * dt;

      if (dist <= step){
        this.scene.remove(p.mesh);
        this.projectiles.splice(i,1);
        p.onImpact();
      }else{
        p.mesh.position.addScaledVector(dir, step/dist);
      }
    }

    for (let i = this.burstParticles.length - 1; i >=0; i--){
      const p = this.burstParticles[i];

      p.age += dt;
      p.mesh.position.addScaledVector(
        p.direction,
        BURST_PARTICLE_SPEED * dt
      );

      const progress = p.age/BURST_PARTICLE_LIFETIME;
      p.mesh.material.opacity = 1 - progress;

      if(p.age >= BURST_PARTICLE_LIFETIME){
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.burstParticles.splice(i,1);
      }
    }
  }

  dispose(){
    for(const p of this.projectiles){
      this.scene?.remove(p.mesh);
    }

    for(const p of this.burstParticles){
      this.scene?.remove(p.mesh);
      p.mesh.material.dispose();
    }

    this.burstParticles.length = 0;
    this._burstGeometry.dispose();

    for (const material of Object.values(this._burstMaterials)){
      material.dispose();
    }

    this.projectiles.length = 0;
    this._geometry.dispose();
    for(const m of Object.values(this._materials)){
      m.dispose();
    }
  }

    
}
