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

// Pools are sized for the worst case with headroom: at most ~0.5 s of flight
// (range 30 / speed 60) and ~0.45 s of burst, at one shot per fireDelay.
const PROJECTILE_POOL = 16;
const BURST_POOL = BURST_PARTICLE_COUNT * 8;

/**
 * Fires paint. Raycasts from the camera, then sends a visible projectile to
 * the hit point; the splat / enemy hit happens when it lands.
 *
 * Nothing is allocated per shot (the brief: "create nothing per frame").
 * Projectile and burst meshes come from fixed pools built once here, each
 * burst particle owning its material so it can fade on its own.
 */
export class PaintGun {
  constructor(surfaces, level = 1, enemies = [], scene = null) {
    this.surfaces = surfaces;
    this.enemies = enemies;
    this.scene = scene;

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
    this.lastSplat = null;  // { point, colour, age } of the latest splat, reused
    this.lastShot = null;   // 'splat' | 'hit' | 'kill' — set when the projectile lands
    this.onImpact = null;   // optional (kind) => {}, fired when a shot lands (HUD + SFX)
    this.dryFire = false;

    this._raycaster = new THREE.Raycaster();
    this._meshes = [
      ...surfaces.map((s) => s.mesh),
      ...enemies.map((enemy) => enemy.mesh).filter(Boolean),
    ];

    // reused every shot
    this._dir = new THREE.Vector3();
    this._shotNdc = new THREE.Vector2();
    this._start = new THREE.Vector3();

    // --- projectile pool: shared geometry, one material per colour ---------
    this._geometry = new THREE.SphereGeometry(0.07, 8, 8);
    this._materials = {};
    for (const [name, hex] of Object.entries(PROJECTILE_COLOURS)) {
      this._materials[name] = new THREE.MeshBasicMaterial({ color: hex });
    }
    this._projectiles = [];
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const mesh = new THREE.Mesh(this._geometry, this._materials.blue);
      mesh.scale.set(1, 1, 3);
      mesh.visible = false;
      this.scene?.add(mesh);
      this._projectiles.push({
        mesh,
        active: false,
        target: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        colour: "blue",
        colourId: 1,
        enemy: null,
        surface: null,
        miss: false,
      });
    }
    this._nextProjectile = 0;

    // --- burst pool: shared geometry, a material per particle (own opacity) --
    this._burstGeometry = new THREE.SphereGeometry(0.04, 6, 6);
    this._bursts = [];
    for (let i = 0; i < BURST_POOL; i++) {
      const mesh = new THREE.Mesh(
        this._burstGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 }),
      );
      mesh.visible = false;
      this.scene?.add(mesh);
      this._bursts.push({ mesh, direction: new THREE.Vector3(), age: 0, active: false });
    }
    this._nextBurst = 0;
  }

  get colour() {
    return this.colours[this.current];
  }

  selectColour(index) {
    if (index >= 0 && index < this.colours.length) {
      this.current = index;
    }
  }

  cycleColour(dir = 1) {
    this.current =
      (this.current + dir + this.colours.length) % this.colours.length;
  }

  tryFire(camera, muzzle = null, aiming = false) {
    if (this.cooldown > 0) return false;

    if (this.colour !== "grey" && this.ammo[this.colour] < PAINT_GUN.cost) {
      this.dryFire = true;
      return false;
    }

    this.lastShot = null;

    const spread = aiming ? PAINT_GUN.adsSpread : PAINT_GUN.hipSpread;
    this._shotNdc.set(
      (Math.random() * 2 - 1) * spread,
      (Math.random() * 2 - 1) * spread,
    );

    this._raycaster.setFromCamera(this._shotNdc, camera);
    this._raycaster.far = PAINT_GUN.range;

    const hits = this._raycaster.intersectObjects(this._meshes, true);

    if (hits.length === 0) {
      // A miss still flies, to max range, and lands on nothing.
      camera.getWorldPosition(this._start);
      this._start.addScaledVector(this._raycaster.ray.direction, PAINT_GUN.range);

      if (this.colour !== "grey") {
        this.ammo[this.colour] -= PAINT_GUN.cost;
      }

      this.cooldown = PAINT_GUN.fireDelay;
      const p = this._takeProjectile();
      p.miss = true;
      this._launch(p, camera, muzzle, this._start, this.colour);
      return true;
    }

    // A killed enemy's mesh leaves the scene but the raycaster still hits it
    // (it tests geometry, not scene membership). Look past dead enemies so
    // they cannot soak up shots — and ammo — as invisible walls.
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

    if (this.colour !== "grey") {
      this.ammo[this.colour] -= PAINT_GUN.cost;
    }

    this.cooldown = PAINT_GUN.fireDelay;

    const p = this._takeProjectile();
    p.miss = false;
    p.enemy = enemy;
    p.surface = surface;
    p.colourId = this.current + 1;
    if (hit.face) {
      p.normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    } else {
      p.normal.set(0, 1, 0);
    }
    this._launch(p, camera, muzzle, hit.point, this.colour);
    return true;
  }

  /**
   * Next pool slot, round-robin. The pool is sized so a slot is free by the
   * time it comes round again; if one is somehow still in flight, it lands
   * now rather than being silently dropped.
   */
  _takeProjectile() {
    const p = this._projectiles[this._nextProjectile];
    this._nextProjectile = (this._nextProjectile + 1) % this._projectiles.length;
    if (p.active) this._land(p);
    return p;
  }

  _launch(p, camera, muzzle, target, colour) {
    p.target.copy(target);
    p.colour = colour;

    // No scene (tests, or a gun built without one): land straight away.
    if (!this.scene) {
      this._land(p);
      return;
    }

    const mesh = p.mesh;
    mesh.material = this._materials[colour];
    if (muzzle) {
      mesh.position.copy(muzzle);
    } else {
      camera.getWorldPosition(mesh.position);
    }
    mesh.lookAt(p.target);
    mesh.visible = true;
    p.active = true;
  }

  /** The projectile arrived: splat or hit, then report what THIS shot did. */
  _land(p) {
    p.active = false;
    p.mesh.visible = false;
    if (p.miss) return;

    this._spawnImpactBurst(p.target, p.colour, p.normal);

    let kind = null;
    if (p.enemy) {
      // false if an earlier shot killed it while this one was in flight
      if (p.enemy.takeColourHit(p.colourId, undefined, p.target)) {
        kind = p.enemy.alive ? "hit" : "kill";
      }
    } else if (p.surface.splat(p.target, p.colour, PAINT_GUN.radius)) {
      if (!this.lastSplat) this.lastSplat = { point: new THREE.Vector3(), colour: p.colour, age: 0 };
      this.lastSplat.point.copy(p.target);
      this.lastSplat.colour = p.colour;
      this.lastSplat.age = 0;
      kind = "splat";
    }
    p.enemy = null;
    p.surface = null;

    if (kind) {
      this.lastShot = kind;
      this.onImpact?.(kind);
    }
  }

  _spawnImpactBurst(point, colour, normal) {
    if (!this.scene) return;

    for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
      const b = this._bursts[this._nextBurst];
      this._nextBurst = (this._nextBurst + 1) % this._bursts.length;

      b.mesh.material.color.setHex(PROJECTILE_COLOURS[colour]);
      b.mesh.material.opacity = 1;
      b.mesh.position.copy(point);
      b.mesh.visible = true;

      b.direction.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();

      if (b.direction.dot(normal) < 0) {
        b.direction.reflect(normal);
      }

      b.age = 0;
      b.active = true;
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

    const step = PROJECTILE_SPEED * dt;
    for (const p of this._projectiles) {
      if (!p.active) continue;
      const dir = this._dir.subVectors(p.target, p.mesh.position);
      const dist = dir.length();

      if (dist <= step) {
        this._land(p);
      } else {
        p.mesh.position.addScaledVector(dir, step / dist);
      }
    }

    for (const b of this._bursts) {
      if (!b.active) continue;

      b.age += dt;
      b.mesh.position.addScaledVector(b.direction, BURST_PARTICLE_SPEED * dt);
      b.mesh.material.opacity = Math.max(0, 1 - b.age / BURST_PARTICLE_LIFETIME);

      if (b.age >= BURST_PARTICLE_LIFETIME) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  dispose() {
    for (const p of this._projectiles) {
      this.scene?.remove(p.mesh);
    }

    for (const b of this._bursts) {
      this.scene?.remove(b.mesh);
      b.mesh.material.dispose();
    }

    this._projectiles.length = 0;
    this._bursts.length = 0;

    this._burstGeometry.dispose();
    this._geometry.dispose();

    for (const material of Object.values(this._materials)) {
      material.dispose();
    }
  }
}
