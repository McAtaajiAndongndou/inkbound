import * as THREE from 'three';
import { PLAYER } from '../config.js';

/**
 * Kinematic player controller.
 *
 * THE IMPORTANT BIT: every frame we ask the surface under the player's feet
 * what its friction and restitution are, and we ask the wall in front what
 * its climbable flag is. Those values come straight from the paint grid.
 *
 * So painting the floor blue really does make the player slide, and painting
 * a wall green really does let them climb it. Nothing is faked.
 *
 * NOTE: this is hand-rolled on purpose for the alpha — it is small, it has no
 * async WASM init, and it demonstrates the mechanic today. Rapier replaces it
 * in week 2 for proper collision against arbitrary geometry.
 */
export class Player {
  constructor(surfaces) {
    this.surfaces = surfaces;
    this.floorMeshes = surfaces.filter((s) => s.isFloor).map((s) => s.mesh);
    this.wallMeshes = surfaces.filter((s) => !s.isFloor).map((s) => s.mesh);

    this.position = new THREE.Vector3(0, 4, 8);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.climbing = false;
    this.groundSurface = null;    // the physics rules currently under our feet
    this.currentColour = 'grey';  // for the HUD

    // visible avatar (third-person view needs something to look at)
    const geometry = new THREE.CapsuleGeometry(PLAYER.radius, PLAYER.height - PLAYER.radius * 2, 4, 12);
    const material = new THREE.MeshStandardMaterial({ color: 0xf2f2f7, roughness: 0.4, metalness: 0.1 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;

    // reused every frame — allocate nothing in the loop
    this._down = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 4);
    this._forward = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, PLAYER.radius + 0.35);
    this._wish = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._probe = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  /** Raycast down. Returns { y, surface } or null. */
  _probeGround() {
    this._probe.copy(this.position);
    this._probe.y += 0.2;
    this._down.ray.origin.copy(this._probe);

    const hits = this._down.intersectObjects(this.floorMeshes, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    const surface = hit.object.userData.paintSurface;
    return { y: hit.point.y, surface, point: hit.point };
  }

  /** Raycast forward. Returns the wall's surface rules if we are against one. */
  _probeWall() {
    if (this.wallMeshes.length === 0) return null;

    this._dir.set(Math.sin(this.yaw) * -1, 0, Math.cos(this.yaw) * -1).normalize();
    this._probe.copy(this.position);
    this._probe.y += PLAYER.height * 0.5;

    this._forward.ray.origin.copy(this._probe);
    this._forward.ray.direction.copy(this._dir);

    const hits = this._forward.intersectObjects(this.wallMeshes, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    const surface = hit.object.userData.paintSurface;
    if (!surface) return null;
    return surface.surfaceAtWorld(hit.point);
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
    this.groundSurface = rules;
    this.currentColour = ground
      ? ['grey', 'blue', 'red', 'green'][ground.surface.paintIdAtWorld(ground.point)]
      : 'grey';

    // ---- climbing: green wall in front, holding W ------------------------
    const wall = this._probeWall();
    this.climbing = !!(wall && wall.climbable && input.isDown('KeyW'));

    if (this.climbing) {
      this.velocity.y = PLAYER.climbSpeed;
      this.velocity.x *= 0.6;
      this.velocity.z *= 0.6;
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

    // speed cap (ice is allowed to exceed it slightly, which feels right)
    const speedCap = rules && rules.friction < 1 ? PLAYER.maxSpeed * 1.6 : PLAYER.maxSpeed;
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    if (planar > speedCap) {
      this.velocity.x *= speedCap / planar;
      this.velocity.z *= speedCap / planar;
    }

    // ---- jump ------------------------------------------------------------
    if (actions.jump && (this.onGround || this.climbing)) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.onGround = false;
    }

    // ---- integrate -------------------------------------------------------
    this.position.addScaledVector(this.velocity, dt);

    // ---- ground collision + BOUNCE FROM THE PAINT ------------------------
    this.onGround = false;
    if (ground && this.position.y <= feetY + 0.01) {
      this.position.y = feetY;

      if (rules && rules.restitution > 0 && this.velocity.y < -3) {
        // red paint: bounce back up instead of stopping
        this.velocity.y = -this.velocity.y * rules.restitution;
      } else {
        this.velocity.y = 0;
        this.onGround = true;
      }
    }

    // fell off the world
    if (this.position.y < -20) this.respawn();

    this.mesh.position.copy(this.position);
    this.mesh.position.y += PLAYER.height * 0.5;
    this.mesh.rotation.y = this.yaw;
  }

  respawn() {
    this.position.set(0, 4, 8);
    this.velocity.set(0, 0, 0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
