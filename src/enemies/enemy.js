import * as THREE from "three";
import { ENEMY, PAINT } from "../config.js";
import { createToonMaterial, addOutline } from "../shaders/toon/toon-material.js";

// Paint ids are indices into the grid (see PAINT_IDS in config.js).
const ID_TO_NAME = ["grey", "blue", "red", "green"];

// The un-hit body colour. Kept as a constant so the tint fade has somewhere
// to return to, and so _buildMesh and the fade can never disagree.
const BASE_COLOUR = 0xe0703a;

// How long a colour hit stays fully saturated before fading back, in seconds.
const TINT_FADE = 1.0;

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
   */
  constructor({ position, config, parent }) {
    this.config = config;
    // Derived from the config's identity rather than passed alongside it, so
    // `type` and `config` cannot be handed over disagreeing.
    this.type = Object.keys(ENEMY).find((key) => ENEMY[key] === config) ?? "sprayer";
    this.alive = true;

    this._toPlayer = new THREE.Vector3();
    this._tintTarget = new THREE.Color();
    this._tintBlend = new THREE.Color();
    this._baseColour = new THREE.Color(BASE_COLOUR);
    this._tintTimer = 0;

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

  update(dt, playerPos) {
    if (!this.alive || !this.config.canMove) return;

    this._toPlayer.copy(playerPos).sub(this.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    // Guard against a non-Vector3 argument. `.copy()` of an object without
    // x/y/z yields NaN, and `NaN > anything` is false — so a wrong argument
    // used to freeze the enemy in place with no error at all.
    if (Number.isFinite(dist) && dist > 0.001) {
      this._toPlayer.normalize();
      this.position.addScaledVector(this._toPlayer, this.config.speed * dt);
      this.mesh.lookAt(
        this.position.x + this._toPlayer.x,
        this.position.y,
        this.position.z + this._toPlayer.z,
      );
    }

    this._fadeTint(dt);
  }

  /**
   * Paint hit. The gun already charges ammo and checks its own cooldown, so
   * this only has to produce feedback — the body's toon `uColour` uniform,
   * faded back to BASE_COLOUR over TINT_FADE seconds.
   *
   * Reuses every Color it touches: nothing is allocated per hit.
   */
  takeColourHit(colourId) {
    const name = ID_TO_NAME[colourId];
    if (!name) return false;

    this._tintTarget.setHex(PAINT[name].hex);
    this._tintTimer = TINT_FADE;
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
