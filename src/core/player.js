import * as THREE from 'three';
import { PLAYER, HEALTH, CAMERA } from '../config.js';

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
 */
export class Player {
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
    this.touchingWall = null;
    this.currentColour = 'grey';

    // jump feel (#33)
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;

    // Speed cap earned from paint (#52)
    this.speedCap = PLAYER.maxSpeed;

    // health
    this.maxHealth = HEALTH.max;
    this.health = HEALTH.max;
    this.dead = false;
    this.hurtTimer = 0;
    this.onDeath = null;

    // dry out (#75). Set by main.js — only main knows the gun and the surfaces.
    // Player holds the flag so the HUD and any other system can read it.
    this.dry = false;
    this.dryTimer = 0;

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

  takeDamage(n) {
    if (this.dead || this.hurtTimer > 0 || n <= 0) return false;

    this.health = Math.max(0, this.health - n);
    this.hurtTimer = HEALTH.hurtCooldown;

    if (this.health === 0) {
      this.dead = true;
      this.velocity.set(0, 0, 0);
      this.onDeath?.();
    }
    return true;
  }

  /**
   * Kill the player outside the health system — used by dry out (#75).
   * Same end path as a death, so the existing lose screen handles it.
   */
  kill() {
    if (this.dead) return;
    this.health = 0;
    this.dead = true;
    this.velocity.set(0, 0, 0);
    this.onDeath?.();
  }

  checkEnemyContact(enemies) {
    if (this.dead) return;
    for (const enemy of enemies) {
      if (enemy.alive === false) continue;
      if (enemy.sleeping === true) continue;
      if (!enemy.position || !enemy.config) continue;
      const dx = enemy.position.x - this.position.x;
      const dz = enemy.position.z - this.position.z;
      const dy = enemy.position.y - this.position.y;
      if (dx * dx + dz * dz > HEALTH.contactRange * HEALTH.contactRange) continue;
      if (Math.abs(dy) > HEALTH.contactHeight) continue;
      if (this.takeDamage(enemy.config.contactDamage ?? 0)) return;
    }
  }

  look(dx, dy, aiming = false) {
    if (this.dead) return;
    let sensitivity = PLAYER.lookSensitivity;

    if (aiming) {
      sensitivity *= PLAYER.adsSensitivityMultiplier;
    }

    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;

    this.pitch = Math.max(CAMERA.pitchMin, Math.min(CAMERA.pitchMax, this.pitch));
  }

  _probeGround() {
    this._probe.copy(this.position);
    this._probe.y += PLAYER.groundProbeLift;

    let best = null;
    let bestDist = PLAYER.groundProbeRange;

    for (const floor of this.floors) {
      floor.mesh.updateWorldMatrix(true, false);
      this._inv.copy(floor.mesh.matrixWorld).invert();
      this._local.copy(this._probe).applyMatrix4(this._inv);
      const e = this._inv.elements;
      this._dirLocal.set(-e[4], -e[5], -e[6]);

      if (this._dirLocal.z >= 0) continue;

      const dist = -this._local.z / this._dirLocal.z;
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

  _resolveWalls() {
    this.touchingWall = null;

    for (const wall of this.walls) {
      this._world.copy(this.position);
      this._world.y += PLAYER.height * 0.5;

      this._local.copy(this._world);
      wall.mesh.worldToLocal(this._local);

      const halfW = wall.width * 0.5;
      const halfH = wall.height * 0.5;

      if (Math.abs(this._local.x) > halfW + PLAYER.radius) continue;
      if (Math.abs(this._local.y) > halfH) continue;
      if (Math.abs(this._local.z) > PLAYER.radius) continue;

      const side = this._local.z >= 0 ? 1 : -1;
      const contactZ = this._local.z;
      this._local.z = side * PLAYER.radius;

      wall.mesh.localToWorld(this._local);
      this.position.x = this._local.x;
      this.position.z = this._local.z;

      this._local.copy(this._world);
      wall.mesh.worldToLocal(this._local);
      this._local.z = 0;
      wall.mesh.localToWorld(this._local);

      this._normal.set(0, 0, side).applyQuaternion(wall.mesh.quaternion).normalize();

      const contact = this._wallContact;
      contact.surface = wall;
      contact.rules = wall.surfaceAtWorld(this._local);
      contact.normal.copy(this._normal);
      contact.contactZ = contactZ;
      this.touchingWall = contact;

      const into = this.velocity.dot(this._normal);
      if (into < 0) this.velocity.addScaledVector(this._normal, -into);
    }
  }

  update(dt, input, actions) {
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.dead) return;

    // ---- jump feel (#33) — decay the grace windows -----------------------
    if (this.onGround || this.climbing) this._coyoteTimer = PLAYER.coyoteTime;
    else if (this._coyoteTimer > 0)    this._coyoteTimer -= dt;

    if (actions.jump) this._jumpBufferTimer = PLAYER.jumpBufferTime;
    else if (this._jumpBufferTimer > 0) this._jumpBufferTimer -= dt;

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

    // ---- climbing --------------------------------------------------------
    const wall = this.touchingWall;
    const pushingIntoWall = wall && this._wish.dot(wall.normal) < -PLAYER.climbPushThreshold;
    this.climbing = !!(wall && wall.rules.climbable && pushingIntoWall);

    if (this.climbing) {
      this.velocity.y = PLAYER.climbSpeed;
    } else {
      this.velocity.y += PLAYER.gravity * dt;
    }

    // ---- horizontal acceleration + friction FROM THE PAINT ---------------
    const accel = this.onGround
      ? PLAYER.accel * (rules ? rules.traction : 1)
      : PLAYER.airAccel;
    this.velocity.x += this._wish.x * accel * dt;
    this.velocity.z += this._wish.z * accel * dt;

    if (this.onGround && rules && rules.restitution === 0) {
      const damping = Math.max(0, 1 - rules.friction * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;
    }

    // ---- speed cap (#52 + #74) -------------------------------------------
    const granted = PLAYER.maxSpeed * (rules ? rules.speedScale : 1);
    const settled = rules && this.onGround && rules.restitution === 0;
    if (settled) this.speedCap = granted;
    else if (granted > this.speedCap) this.speedCap = granted;

    const standSlow = (this.onGround && rules && rules.standSlow < 1) ? rules.standSlow : 1;
    const speedCap = this.speedCap * standSlow;
    const maxSpeed = speedCap * (input.aiming ? PLAYER.adsSpeedMultiplier : 1);

    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const planar = Math.sqrt(vx * vx + vz * vz);

    if (planar > maxSpeed) {
      this.velocity.x *= maxSpeed / planar;
      this.velocity.z *= maxSpeed / planar;
    }

    // ---- jump ------------------------------------------------------------
    const canJump = this.onGround || this.climbing || this._coyoteTimer > 0;
    if (this._jumpBufferTimer > 0 && canJump) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.onGround = false;
      this._coyoteTimer = 0;
      this._jumpBufferTimer = 0;
      if (this.climbing) {
        this.velocity.addScaledVector(wall.normal, PLAYER.wallJumpPush);
      }
    }

    // ---- integrate -------------------------------------------------------
    this.position.addScaledVector(this.velocity, dt);

    this._resolveWalls();

    // ---- ground collision + BOUNCE ---------------------------------------
    this.onGround = false;
    if (ground && this.position.y <= feetY + PLAYER.groundSnap) {
      this.position.y = feetY;

      const impact = this.velocity.y;
      if (rules && rules.restitution > 0) {
        this.velocity.y = Math.max(-impact * rules.restitution, PLAYER.minBounce);
        this.position.y = feetY + PLAYER.bounceClearance;
      } else {
        this.velocity.y = 0;
        this.onGround = true;
      }
    }

    if (this.position.y < PLAYER.killY) this.respawn();

    this.mesh.position.copy(this.position);
    this.mesh.position.y += PLAYER.height * 0.5;
    this.mesh.rotation.y = this.yaw;
  }

  respawn() {
    this.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.speedCap = PLAYER.maxSpeed;
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;
    this.dry = false;
    this.dryTimer = 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}