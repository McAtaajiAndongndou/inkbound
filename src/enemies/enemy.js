import * as THREE from "three";
import { ENEMY, PAINT, PAINT_IDS } from "../config.js";
import { SurfaceProbe } from "../paint/surface-probe.js";
import { createToonMaterial, addOutline, GREY_TOON } from "../shaders/toon/toon-material.js";

// Paint ids are indices into the grid (see PAINT_IDS in config.js).
const ID_TO_NAME = ["grey", "blue", "red", "green"];

// The un-hit body colour. Kept as a constant so the tint fade has somewhere
// to return to, and so _buildMesh and the fade can never disagree.
const BASE_COLOUR = GREY_TOON;

// How long a colour hit stays fully saturated before fading back, in seconds.
const TINT_FADE = 1.0;
const KILL_FLASH_MS = 120;

/**
 * One enemy class, five configs. Behaviour comes from ENEMY.* flags, not from
 * subclassing — see DESIGN.md.
 *
 * THE CONTRACT other folders depend on:
 *   enemy.position  Vector3   player.checkEnemyContact reads this
 *   enemy.config    ENEMY     entry; .contactDamage comes off it
 *   enemy.mesh      Group     tagged userData.enemy so the paint gun can find
 *                             us by walking up from a hit child
 *
 * `position` is the SAME Vector3 object as `mesh.position`, not a copy, so the
 * two can never drift apart.
 */
export class Enemy {
  /**
   * @param {object} opts
   * @param {THREE.Vector3} opts.position where it starts (world)
   * @param {object} opts.config           a resolved ENEMY entry, e.g. ENEMY.charger
   * @param {THREE.Object3D} opts.parent   attach here — the level passes its
   *                                        `root`, so scene membership stays
   *                                        with the level (decision #2)
   * @param {PaintSurface[]} opts.floors   walkable surfaces, for the ground
   *                                        probe. Without them an enemy walks
   *                                        straight off the island and glides
   *                                        across the gap, because nothing here
   *                                        ever applies gravity.
   */
  constructor({ position, config, parent, floors }) {
    this.config = config;
    // Derived from the config's identity rather than passed alongside it, so
    // `type` and `config` cannot be handed over disagreeing.
    this.type = Object.keys(ENEMY).find((key) => ENEMY[key] === config) ?? "sprayer";
    this.alive = true;
    this.hp = config.hp;

    this._toPlayer = new THREE.Vector3();
    this._vel = new THREE.Vector3();      // own planar velocity — needed to slide
    this._desired = new THREE.Vector3();
    this._next = new THREE.Vector3();
    this._knockback = new THREE.Vector3(); // red impulse; decays each frame
    this._tintTarget = new THREE.Color();
    this._tintBlend = new THREE.Color();
    this._baseColour = new THREE.Color(BASE_COLOUR);
    this._tintTimer = 0;
    this._pinnedTimer = 0;                 // green: hard root (movement only)
    this._slipTimer = 0;                   // blue: direct hit slow

    // Without floors we cannot tell ground from void, so the safe fallback is
    // to stand still rather than walk off the edge.
    this._probe = new SurfaceProbe(floors ?? []);

    this.mesh = this._buildMesh();
    this.mesh.position.copy(position);
    this.position = this.mesh.position;   // alias, not a copy

    parent.add(this.mesh);
  }

  /** Give the paint gun something to tint. Kept as a field so the fade can
   *  write the uniform every frame without re-walking the mesh. */
  _buildMesh() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const bodyMat = createToonMaterial(BASE_COLOUR);
    this.bodyMat = bodyMat;         // takeColourHit fades this uniform
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    group.add(body);
    addOutline(body);

    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 0.55, 0.41);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, 0.55, 0.41);
    group.add(eyeR);

    group.userData.enemy = this;

    return group;
  }

  /**
   * Chase, but obey the paint.
   *
   * The enemy asks the SAME grid the player does — `surfaceAtWorld` on the
   * floor under it — and reads the same rules:
   *   friction    how fast it brakes (blue 0.4 vs grey 10.0)
   *   traction    how sharply it turns on grippy ground (grey 1.0)
   *   speedScale  its speed cap (blue 1.6x vs grey 1.0x)
   *
   * On grey that means "track the player at speed". Paint the floor under it
   * blue and it commits to a heading, stops steering, and cannot brake — so
   * it slides straight past. That is the DESIGN.md Charger lesson, and it
   * needs no hardcoded ice flag: just read the grid.
   */
  update(dt, playerPos) {
    if (!this.alive) return;

    // The tint fade runs for EVERY living enemy, movers or not. It used to sit
    // after the canMove check, so a stationary enemy kept its hit colour
    // forever. It is called exactly once, here, so no branch below repeats it.
    this._fadeTint(dt);

    if (!this.config.canMove) return;

    // Green pin: movement stops, threat does not (settled rule). The knockback
    // from a red hit can still carry it while pinned, so apply that first.
    if (this._pinnedTimer > 0) {
      this._pinnedTimer -= dt;
      this._applyKnockback(dt);
      return;
    }
    if (this._slipTimer > 0) this._slipTimer -= dt;

    const ground = this._probe.down(this.position);
    if (!ground) {                    // over a gap: no pathfinding, so hold
      this._applyKnockback(dt);
      return;
    }
    const rules = ground.surface.surfaceAtWorld(ground.point);

    // A direct blue hit slows even on grey ground; on blue ground the grid
    // friction already handles the slide, so this stacks.
    const speedMult = this._slipTimer > 0 ? 0.3 : 1;

    this._toPlayer.copy(playerPos).sub(this.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    // Guard against a non-Vector3 argument. `.copy()` of an object without
    // x/y/z yields NaN, and `NaN > anything` is false — so a wrong argument
    // used to freeze the enemy in place with no error at all.
    if (Number.isFinite(dist) && dist > 0.001) {
      const inv = 1 / dist;
      // Only blue has friction below 1 (grey/red 10.0, green 14.0), so this is
      // a clean read of "am I standing on ice" straight off the grid.
      const icy = rules.friction < 1;

      if (icy) {
        // Can shove off, but cannot change course. A heading is picked once,
        // then kept — which is exactly why painting blue makes it slide
        // straight past instead of tracking you.
        //
        // Note this deliberately ignores `traction`. Blending steering by
        // traction (blue 0.5) converges geometrically and is still pointing
        // at the player within a second or two — a slow turn, not a slide.
        if (this._vel.lengthSq() < 1e-4) {
          this._vel
            .set(this._toPlayer.x * inv, 0, this._toPlayer.z * inv)
            .multiplyScalar(this.config.speed * rules.speedScale * speedMult);
        }
      } else {
        this._desired
          .set(this._toPlayer.x * inv, 0, this._toPlayer.z * inv)
          .multiplyScalar(this.config.speed * rules.speedScale * speedMult);
        this._vel.lerp(this._desired, Math.min(1, rules.traction));
      }
    }

    // Braking is friction. Blue at 0.4 barely slows anything, so a committed
    // Charger carries its momentum across the whole island.
    const damping = Math.max(0, 1 - rules.friction * dt);
    this._vel.x *= damping;
    this._vel.z *= damping;

    this._next.copy(this.position).addScaledVector(this._vel, dt);

    // Probe the DESTINATION, not just the current spot. If the step would put
    // us over a gap there is no floor to stand on, so the move is refused.
    // This is what keeps an enemy on its own island without a leash radius or
    // any knowledge of the level layout.
    const nextGround = this._probe.down(this._next);
    if (nextGround) {
      this.position.x = this._next.x;
      this.position.z = this._next.z;
      this.position.y = nextGround.y;      // stay glued to the floor

      const vx = this._vel.x;
      const vz = this._vel.z;
      if (vx * vx + vz * vz > 1e-6) {
        // Face the direction of travel, not the player — on ice the heading is
        // the whole point, and watching it plough past aimed the wrong way
        // would read as broken.
        //
        // A bare yaw, not `lookAt`. An enemy on flat ground only ever needs to
        // turn about Y, and `lookAt` measured ~12 bytes/frame of garbage
        // because it updates the world matrix and inverts the parent
        // quaternion every call. atan2 gives the identical result for a +Z
        // facing mesh, and the mesh is built with no base rotation.
        this.mesh.rotation.y = Math.atan2(vx, vz);
      }
    } else {
      this._vel.set(0, 0, 0);   // refused: stop pushing into the void
    }

    this._applyKnockback(dt);
  }

  /**
   * Red hit impulse. Deliberately bypasses the ground probe: the point of
   * knockback is to fling an enemy into walls or off a ledge, and refusing the
   * step here would neuter the environmental kill the design asks for.
   * No gravity yet (see README known gaps), so a flung enemy holds its height.
   */
  _applyKnockback(dt) {
    if (this._knockback.lengthSq() < 1e-6) return;
    this.position.addScaledVector(this._knockback, dt);
    this._knockback.multiplyScalar(Math.max(0, 1 - dt * 6));
  }

  /**
   * Paint hit. Two jobs now, matching the "painted enemy = active round" rule:
   *
   *   1. Feedback — the body's toon `uColour` uniform tints, then fades back.
   *   2. Reaction — blue slows, red knocks back, green pins, and enough
   *      damage kills. This is colour-roles Tier 1 (see MECHANICS.md).
   *
   * The gun still charges ammo and checks its own cooldown, so nothing here
   * touches ammo. Every Color is reused — nothing is allocated per hit.
   *
   * @param {number} colourId  PAINT_IDS value (1 blue, 2 red, 3 green)
   * @param {number} damage    integer; defaults so a plain hit still hurts
   * @param {THREE.Vector3|null} sourcePos  impact point, so red knocks away
   *                                        from the shot rather than randomly
   */
  takeColourHit(colourId, damage = 10, sourcePos = null) {
    if (!this.alive) return false;

    const name = ID_TO_NAME[colourId];
    if (!name || colourId === PAINT_IDS.grey) return false;

    // Feedback first, so a killing hit still reads as coloured.
    this._tintTarget.setHex(PAINT[name].hex);
    this._tintTimer = TINT_FADE;
    this.bodyMat.uniforms.uColour.value.copy(this._tintTarget);

    this.hp -= damage;

    if (colourId === PAINT_IDS.blue) {
      // Direct-hit slow; on blue floor the grid friction already slides it.
      this._slipTimer = 1.5;
    } else if (colourId === PAINT_IDS.red) {
      this._knockback.copy(this.position);
      if (sourcePos) {
        this._knockback.sub(sourcePos);
      } else {
        this._knockback.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
      this._knockback.y = 0;
      if (this._knockback.lengthSq() < 1e-6) this._knockback.set(0, 0, 1);
      this._knockback.normalize().multiplyScalar(6);
    } else if (colourId === PAINT_IDS.green) {
      // Hard root: no buildup. Stops movement, not threat.
      this._pinnedTimer = 1.5;
      this._vel.set(0, 0, 0);
    }

    if (this.hp <= 0) {
      this.alive = false;
      setTimeout(() => this.dispose(), KILL_FLASH_MS);
    }

    return true;
  }

  _fadeTint(dt) {
    if (this._tintTimer <= 0) return;

    this._tintTimer -= dt;
    // At t=0 the lerp lands exactly on the base colour, so the last write
    // before the timer expires is already the resting state — no snap.
    this._tintBlend
      .copy(this._baseColour)
      .lerp(this._tintTarget, Math.max(0, this._tintTimer / TINT_FADE));
    this.bodyMat.uniforms.uColour.value.copy(this._tintBlend);
  }

  /** Frees our own GPU resources. The level still disposes them via its base
   *  traverse — `dispose()` is idempotent, and the level calls us first
   *  because a future enemy may own pooled resources outside `root`. */
  dispose() {
    this.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this.mesh.removeFromParent();
  }
}