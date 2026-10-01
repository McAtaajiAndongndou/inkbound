import * as THREE from 'three';
import { PLAYER } from '../config.js';

const ID_TO_NAME = ['grey', 'blue', 'red', 'green'];

/**
 * Kinematic player controller.
 *
 * THE IMPORTANT BIT: every frame we ask the surface under the player's feet
 * what its friction and restitution are, and we ask the wall we are touching
 * whether it is climbable. Those values come straight from the paint grid.
 *
 * So painting the floor blue really does make the player slide, and painting
 * a wall green really does let them climb it. Nothing is faked.
 *
 * NOTE: hand-rolled on purpose for the alpha — small, no async WASM init,
 * demonstrates the mechanic today. Rapier replaces it in week 2.
 */
export class Player {
  /**
   * @param {PaintSurface[]} surfaces the level's surfaces
   * @param {THREE.Vector3} spawn     the level's spawn point — start and respawn here
   */
  constructor(surfaces, spawn = new THREE.Vector3()) {
    this.surfaces = surfaces;
    this.floors = surfaces.filter((s) => s.isFloor);
    this.walls = surfaces.filter((s) => !s.isFloor);

    this.spawn = spawn.clone();
    this.position = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.climbing = false;
    this.touchingWall = null;   // { surface, point, normal, rules }
    this.currentColour = 'grey';

    // visible avatar for third-person
    const geometry = new THREE.CapsuleGeometry(
      PLAYER.radius, PLAYER.height - PLAYER.radius * 2, 4, 12,
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xf2f2f7, roughness: 0.4, metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;

    // reused every frame — allocate nothing in the loop
    this._probeRange = 6;       // how far below the probe origin we look for ground
    this._dirLocal = new THREE.Vector3();
    this._inv = new THREE.Matrix4();
    this._ground = { y: 0, surface: null, point: new THREE.Vector3() };
    this._wallContact = { surface: null, rules: null, normal: new THREE.Vector3(), contactZ: 0 };
    this._wish = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._probe = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._world = new THREE.Vector3();
    this._normal = new THREE.Vector3();
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  /**
   * Straight-down ground probe. Returns the nearest floor below the player,
   * or null. The result object is reused every frame — do not hold onto it.
   *
   * Not a THREE.Raycaster: that allocates a hit object (plus point, uv,
   * normal, face) per hit, every frame. Every floor is a single flat
   * PaintSurface plane, so we intersect the ray with each plane in its local
   * space instead — same trick as _resolveWalls, and allocation-free.
   */
  _probeGround() {
    this._probe.copy(this.position);
    this._probe.y += 0.5;

    let best = null;
    let bestDist = this._probeRange;

    for (const floor of this.floors) {
      // ray origin and direction (world 0,-1,0) in the floor's local space.
      // One matrix inverse per floor: the direction is just minus the
      // inverse's Y column, so we do not need a second worldToLocal.
      floor.mesh.updateWorldMatrix(true, false);
      this._inv.copy(floor.mesh.matrixWorld).invert();
      this._local.copy(this._probe).applyMatrix4(this._inv);
      const e = this._inv.elements;
      this._dirLocal.set(-e[4], -e[5], -e[6]);

      // the plane faces local +Z; only hit it from the front, like the raycast did
      if (this._dirLocal.z >= 0) continue;

      const dist = -this._local.z / this._dirLocal.z;   // world units along the ray
      if (dist < 0 || dist > bestDist) continue;

      const hx = this._local.x + this._dirLocal.x * dist;
      const hy = this._local.y + this._dirLocal.y * dist;
      if (Math.abs(hx) > floor.width * 0.5 || Math.abs(hy) > floor.height * 0.5) continue;

      best = floor;
      bestDist = dist;
    }

    if (!best) return null;

    const ground = this._ground;
    ground.surface = best;
    ground.y = this._probe.y - bestDist;
    ground.point.set(this._probe.x, ground.y, this._probe.z);
    return ground;
  }

  /**
   * Solid wall collision AND the climb check, in one pass.
   *
   * Each wall is a PlaneGeometry lying in its own local XY plane with its
   * normal down local +Z. So we convert the player into the wall's local
   * space: if they are inside the plane's bounds and their local z is within
   * the player radius, they are touching it. We push them back out along the
   * normal — that is what stops you phasing through, which is what stopped
   * climbing from ever triggering.
   */
  _resolveWalls() {
    this.touchingWall = null;

    for (const wall of this.walls) {
      // test at chest height, not at the feet
      this._world.copy(this.position);
      this._world.y += PLAYER.height * 0.5;

      this._local.copy(this._world);
      wall.mesh.worldToLocal(this._local);

      const halfW = wall.width * 0.5;
      const halfH = wall.height * 0.5;

      // outside the panel's footprint? not touching it
      if (Math.abs(this._local.x) > halfW + PLAYER.radius) continue;
      if (Math.abs(this._local.y) > halfH) continue;
      if (Math.abs(this._local.z) > PLAYER.radius) continue;

      // --- push the player back out along the wall normal ---
      const side = this._local.z >= 0 ? 1 : -1;
      const contactZ = this._local.z;
      this._local.z = side * PLAYER.radius;

      wall.mesh.localToWorld(this._local);
      this.position.x = this._local.x;
      this.position.z = this._local.z;

      // --- what colour is the bit of wall we are touching? ---
      this._local.copy(this._world);
      wall.mesh.worldToLocal(this._local);
      this._local.z = 0;
      wall.mesh.localToWorld(this._local);

      this._normal.set(0, 0, side).applyQuaternion(wall.mesh.quaternion).normalize();

      // reuse one contact object rather than allocating one per frame
      const contact = this._wallContact;
      contact.surface = wall;
      contact.rules = wall.surfaceAtWorld(this._local);
      contact.normal.copy(this._normal);
      contact.contactZ = contactZ;
      this.touchingWall = contact;

      // kill velocity heading into the wall so we do not grind through it
      const into = this.velocity.dot(this._normal);
      if (into < 0) this.velocity.addScaledVector(this._normal, -into);
    }
  }

  update(dt, input, actions) {
    // ---- movement intent, relative to where we are looking ---------------
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this._wish.set(0, 0, 0);
    if (input.isDown('KeyW')) this._wish.add(this._fwd);
    if (input.isDown('KeyS')) this._wish.sub(this._fwd);
    if (input.isDown('KeyD')) this._wish.add(this._right);
    if (input.isDown('KeyA')) this._wish.sub(this._right);
    if (this._wish.lengthSq() > 0) this._wish.normalize();

    // ---- what are we standing on? ---------------------------------------
    const ground = this._probeGround();
    const feetY = ground ? ground.y : -Infinity;
    const rules = ground ? ground.surface.surfaceAtWorld(ground.point) : null;
    this.currentColour = ground
      ? ID_TO_NAME[ground.surface.paintIdAtWorld(ground.point)]
      : 'grey';

    // ---- climbing: touching a GREEN wall and pushing into it -------------
    const wall = this.touchingWall;
    const pushingIntoWall = wall && this._wish.dot(wall.normal) < -0.25;
    this.climbing = !!(wall && wall.rules.climbable && pushingIntoWall);

    if (this.climbing) {
      this.velocity.y = PLAYER.climbSpeed;
    } else {
      this.velocity.y += PLAYER.gravity * dt;
    }

    // ---- horizontal acceleration + friction FROM THE PAINT ---------------
    const accel = this.onGround ? PLAYER.accel : PLAYER.airAccel;
    this.velocity.x += this._wish.x * accel * dt;
    this.velocity.z += this._wish.z * accel * dt;

    if (this.onGround && rules) {
      // blue paint has friction 0.4 vs grey's 10.0 — that is the ice
      const damping = Math.max(0, 1 - rules.friction * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;
    }

    const speedCap = rules && rules.friction < 1 ? PLAYER.maxSpeed * 1.6 : PLAYER.maxSpeed;
    // not Math.hypot — V8 allocates on every hypot call
    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const planar = Math.sqrt(vx * vx + vz * vz);
    if (planar > speedCap) {
      this.velocity.x *= speedCap / planar;
      this.velocity.z *= speedCap / planar;
    }

    // ---- jump ------------------------------------------------------------
    if (actions.jump && (this.onGround || this.climbing)) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.onGround = false;
      if (this.climbing) {
        // hop off the wall so you land on the ledge instead of sticking
        this.velocity.addScaledVector(wall.normal, 3.5);
      }
    }

    // ---- integrate -------------------------------------------------------
    this.position.addScaledVector(this.velocity, dt);

    // ---- walls: push out, and record what we are touching -----------------
    this._resolveWalls();

    // ---- ground collision + BOUNCE FROM THE PAINT ------------------------
    this.onGround = false;
    if (ground && this.position.y <= feetY + 0.02) {
      this.position.y = feetY;

      const impact = this.velocity.y;
      if (rules && rules.restitution > 0) {
        // Red paint is a TRAMPOLINE, not just a bouncy landing.
        // Falling harder throws you higher, but simply standing on it
        // still launches you at minBounce — otherwise walking onto red
        // does nothing, because a grounded player has ~zero fall speed.
        // do NOT set onGround, or friction would eat the bounce.
        this.velocity.y = Math.max(-impact * rules.restitution, PLAYER.minBounce);
        this.position.y = feetY + 0.05;   // clear the surface so we do not re-hit
      } else {
        this.velocity.y = 0;
        this.onGround = true;
      }
    }

    if (this.position.y < -20) this.respawn();

    this.mesh.position.copy(this.position);
    this.mesh.position.y += PLAYER.height * 0.5;
    this.mesh.rotation.y = this.yaw;
  }

  respawn() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}