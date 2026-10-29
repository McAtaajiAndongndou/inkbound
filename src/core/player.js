import * as THREE from 'three';
import { PLAYER, HEALTH, CAMERA, SUBMERGE } from '../config.js';

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

    // jump feel (#33) — seconds remaining on each grace window
    this._coyoteTimer = 0;
    this._jumpBufferTimer = 0;

    // Speed cap earned from paint, in m/s. See the cap block in update(). (#52)
    this.speedCap = PLAYER.maxSpeed;

    // health — read by the HUD (health, maxHealth, dead)
    this.maxHealth = HEALTH.max;
    this.health = HEALTH.max;
    this.dead = false;
    this.hurtTimer = 0;         // > 0 means recently hit, cannot be hit again yet
    this.onDeath = null;        // optional callback, fired once when health hits 0
    // dry out (#75). Set by main.js — only main knows the gun and the surfaces.
    // Player holds the flag so the HUD and any other system can read it.
    this.dry = false;
    this.dryTimer = 0;
    // submerge (#108). Set every frame from `input.isDown(SUBMERGE.key)` AND
    // "on your own paint". Off either, it is `false` that frame — no timer,
    // no stuck state.
    this.submerged = false;
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

  /**
   * Lose `n` health. Ignored while dead or inside the post-hit cooldown.
   * Returns true if the hit landed.
   */
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

  /**
   * Contact damage by proximity: any enemy whose centre is within
   * HEALTH.contactRange (horizontally) and HEALTH.contactHeight (vertically)
   * of the player hurts for its config.contactDamage.
   * Expects each enemy to expose `position` (Vector3) and `config` (an ENEMY entry).
   *
   * DEAD ENEMIES ARE SKIPPED, and that check was missing (#39). It is not
   * hygiene: `Enemy.takeColourHit` sets `alive = false` and `dispose()` detaches
   * the MESH, but nothing removes the enemy from the level's `enemies` array, and
   * `position` keeps pointing at the spot where it died. This loop only ever
   * looked at `position` and `config` — so every corpse stayed a live hazard for
   * the rest of the level, dealing its full contactDamage to anyone who walked
   * over it. Invisible damage from a body that is not on screen any more.
   *
   * That is the "I died at 50 HP": a Charger corpse deals 25 a hit, on a 0.8 s
   * cooldown, and nothing on screen explains where it came from.
   *
   * `alive === false`, not `!enemy.alive`, so a stand-in enemy without the field
   * (the tests, and anything not yet an Enemy) is still a hazard rather than
   * being silently skipped.
   */
  checkEnemyContact(enemies) {
    if (this.dead) return;
    for (const enemy of enemies) {
      if (enemy.alive === false) continue;      // a corpse is not a hazard
      if (enemy.sleeping === true) continue;    // nor is something still dormant
      if (!enemy.position || !enemy.config) continue;
      const dx = enemy.position.x - this.position.x;
      const dz = enemy.position.z - this.position.z;
      const dy = enemy.position.y - this.position.y;
      if (dx * dx + dz * dz > HEALTH.contactRange * HEALTH.contactRange) continue;
      if (Math.abs(dy) > HEALTH.contactHeight) continue;
      if (this.takeDamage(enemy.config.contactDamage ?? 0)) return; // one hit per frame
    }
  }

  look(dx, dy, aiming = false) {
    if (this.dead) {
      return;
    }
    let sensitivity = PLAYER.lookSensitivity;

    if (aiming) {
      sensitivity *= PLAYER.adsSensitivityMultiplier;
    }

    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;

    this.pitch = Math.max(
      CAMERA.pitchMin,
      Math.min(CAMERA.pitchMax, this.pitch)
    );
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
    this._probe.y += PLAYER.groundProbeLift;

    let best = null;
    let bestDist = PLAYER.groundProbeRange;

    // Tolerance on the range and the edges. The local-space maths lands an exact
    // limit at 6.000000000000001 often enough to matter: a floor exactly
    // `groundProbeRange` away, or a sample exactly on a lip, was rejected while a
    // raycaster hits it — and a player standing on a lip must get the floor, not
    // fall through. Matches `SurfaceProbe.down`, which the enemies already use.
    const EPS = 1e-6;

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
      if (dist < 0 || dist > bestDist + EPS) continue;

      const hx = this._local.x + this._dirLocal.x * dist;
      const hy = this._local.y + this._dirLocal.y * dist;
      if (Math.abs(hx) > floor.width * 0.5 + EPS
        || Math.abs(hy) > floor.height * 0.5 + EPS) continue;

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
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.dead) return;     // dead: frozen in place until the level restarts

    // ---- jump feel (#33) — decay the grace windows -----------------------
    // onGround here is last frame's value: exactly what coyote time wants.
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
    
    // ---- submerge (#108) — a deliberate input on your own paint -----------
    // Both conditions must hold, and both are re-checked every frame:
    //   1. The player is holding the submerge key.
    //   2. The ground under them is painted (not grey).
    // The "own paint" test is `currentColour !== 'grey'` — the same check the
    // speed cap and HUD already trust. Step off your paint and the state
    // drops the same frame; no timer, no stuck state.
    this.submerged = input.isDown(SUBMERGE.key) && this.currentColour !== 'grey';
    // ---- climbing: touching a GREEN wall and pushing into it -------------
    const wall = this.touchingWall;
    const pushingIntoWall = wall && this._wish.dot(wall.normal) < -PLAYER.climbPushThreshold;
    this.climbing = !!(wall && wall.rules.climbable && pushingIntoWall);

    if (this.climbing) {
      this.velocity.y = PLAYER.climbSpeed;
    } else {
      this.velocity.y += PLAYER.gravity * dt;
    }

        // ---- horizontal acceleration + friction FROM THE PAINT ---------------
    // #108 — submerge multiplies the ACCELERATION, not just the cap. Raising
    // the cap alone does nothing at walking speed: acceleration is what limits
    // you, and the equilibrium velocity (accel / friction) is below maxSpeed
    // at base. So submerge has to speed up the push, not just the ceiling.
    const submergeSpeed = this.submerged ? SUBMERGE.speedMultiplier : 1;
    const accel = this.onGround
      ? PLAYER.accel * submergeSpeed * (rules ? rules.traction : 1)
      : PLAYER.airAccel * submergeSpeed;
    this.velocity.x += this._wish.x * accel * dt;
    this.velocity.z += this._wish.z * accel * dt;

    // a trampoline must not slow you down: red flings the speed you arrived with
    if (this.onGround && rules && rules.restitution === 0) {
      // low friction (blue) is what makes ice — see SURFACE in config.js
      const damping = Math.exp(-rules.friction * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;
    }

    // ---- speed cap: momentum you keep, not the tile under you (#52) -------
    // Surfaces grant a cap; the player keeps what it earned:
    //   - over a void, keep the last surface's cap (blue survives the lip)
    //   - a trampoline never lowers it (red flings the speed, not cancels it)
    //   - landing on a normal surface re-grants its cap (grey = base)
    const granted = PLAYER.maxSpeed * (rules ? rules.speedScale : 1);
    const settled = rules && this.onGround && rules.restitution === 0;
    if (settled) this.speedCap = granted;
    else if (granted > this.speedCap) this.speedCap = granted;

    // ---- #74: grey's LIVE penalty ---------------------------------------
    // speedScale is sticky (#52). If we put grey's penalty on speedScale it
    // would be wiped the moment the player touched blue once, and grey would
    // silently stop mattering. So `standSlow` is a separate, LIVE multiplier
    // applied only while standing on the surface. It is min'd with the sticky
    // cap, so stepping off grey restores speed immediately.
    const standSlow = (this.onGround && rules && rules.standSlow < 1) ? rules.standSlow : 1;
    const speedCap = this.speedCap * standSlow;

    // ---- absolute movement cap ------------------------------------------
    // Submerge raises the ceiling; ADS reduces it. Both compose. `submergeSpeed`
    // was declared above, in the acceleration block — one declaration, used
    // twice, no re-declare.
    const maxSpeed = speedCap * submergeSpeed * (input.aiming ? PLAYER.adsSpeedMultiplier : 1);

    // not Math.hypot — V8 allocates on every hypot call
    const vx = this.velocity.x;
    const vz = this.velocity.z;
    const planar = Math.sqrt(vx * vx + vz * vz);

    if (planar > maxSpeed) {
      this.velocity.x *= maxSpeed / planar;
      this.velocity.z *= maxSpeed / planar;
    }

    // ---- jump ------------------------------------------------------------
    // Jump fires if the buffer has a recent press AND we are grounded,
    // climbing, or still inside the coyote window (#33).
    const canJump = this.onGround || this.climbing || this._coyoteTimer > 0;
    if (this._jumpBufferTimer > 0 && canJump) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.onGround = false;
      this._coyoteTimer = 0;       // consume the grace window, no double-jump
      this._jumpBufferTimer = 0;   // consume the buffered press
      if (this.climbing) {
        // hop off the wall so you land on the ledge instead of sticking
        this.velocity.addScaledVector(wall.normal, PLAYER.wallJumpPush);
      }
    }

    // ---- integrate -------------------------------------------------------
    this.position.addScaledVector(this.velocity, dt);

    // ---- walls: push out, and record what we are touching -----------------
    this._resolveWalls();

    // ---- ground collision + BOUNCE FROM THE PAINT ------------------------
    // Snap to the floor found at the start of this frame. Not a fresh probe:
    // that one-frame-late snap is what keeps the player "grounded" for the
    // frame it takes to cross a ledge, which is what coyote time and the
    // level's playable gaps are built on (#33, #53).
    this.onGround = false;
    if (ground && this.position.y <= feetY + PLAYER.groundSnap) {
      this.position.y = feetY;

      const impact = this.velocity.y;
      if (rules && rules.restitution > 0) {
        // Red paint is a TRAMPOLINE, not just a bouncy landing.
        // Falling harder throws you higher, but simply standing on it
        // still launches you at minBounce — otherwise walking onto red
        // does nothing, because a grounded player has ~zero fall speed.
        // do NOT set onGround, or friction would eat the bounce.
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
    this.speedCap = PLAYER.maxSpeed;   // respawning earns nothing (#52)
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