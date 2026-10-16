import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
// ^ if your #48 spike imports these differently (e.g. "three/addons/..."), match that.
import { ENEMY, PAINT, PAINT_IDS } from "../config.js";
import { SurfaceProbe } from "../paint/surface-probe.js";
import { createToonMaterial, addOutline, GREY_TOON } from "../shaders/toon/toon-material.js";
import { audio } from "../audio/audio-manager.js";

// Paint ids are indices into the grid (see PAINT_IDS in config.js).
const ID_TO_NAME = ["grey", "blue", "red", "green"];

// The un-hit body colour. Kept as a constant so the tint fade has somewhere
// to return to, and so _buildMesh and the fade can never disagree.
const BASE_COLOUR = GREY_TOON;

// How long a colour hit stays fully saturated before fading back, in seconds.
const TINT_FADE = 1.0;
const KILL_FLASH_MS = 120;

// Attack telegraph (#40). Yellow is not a paint colour, so the warning can
// never be mistaken for a paint hit.
const TELEGRAPH_COLOUR = 0xffe600;
const TELEGRAPH_SWELL = 0.35;       // body grows by this fraction by the end of the windup
const DEFAULT_WINDUP = 0.6;         // seconds; overridden by config.windup
const DEFAULT_ATTACK_COOLDOWN = 2;  // seconds; overridden by config.attackCooldown

// --- GLB soldiers (#50) ------------------------------------------------------
const MODEL_HEIGHT = 1.6;           // world units tall; tune to taste

const MODEL_URLS = {
  charger: "./assets/soldier-charger.glb",
  sprayer: "./assets/soldier-sprayer.glb",
};
const MODELS = {};                  // type -> { scene, clips, scale } once loaded

// Both files ship the same 5 rifle clips (no idle/die/melee).
const CLIPS = {
  charger: { idle: "Rifle@Aim", run: "Rifle@Run.001", attack: "Rifle@AimShoot" },
  sprayer: { idle: "Rifle@Aim", run: "Rifle@Run.001", attack: "Rifle@Shoot" },
};

/**
 * Size a model to `targetHeight` AND find where its feet are.
 *
 * Exported so this can be tested without a .glb: `node --test` has no server, so
 * the asset itself is unloadable in a test, and this was the bug (#39).
 *
 * WHY IT IS NOT JUST A SCALE — the bug this exists to kill:
 * `_tick` glues the enemy's ORIGIN to the floor (`position.y = nextGround.y`),
 * which is only correct when the model's pivot is between its feet. These
 * soldiers' pivots are mid-body — measured: min.y −2.695 on a 5.936 m model — so
 * each one was drawn with its knees and shins buried in the ground. Half the
 * body gone, no error anywhere, and it reads as "the enemies clip through the
 * floor" (#39 #2).
 *
 * `avatar.js` had already solved this for the player with `-box.min.y * scale`.
 * This is the same correction, made once and measured rather than assumed.
 *
 * @returns {{ scale: number, feetOffset: number }} metres to LIFT the model so
 *          its lowest vertex sits on the origin.
 */
export function fitModelToHeight(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const height = box.max.y - box.min.y;
  const scale = height > 0 && Number.isFinite(height) ? targetHeight / height : 1;

  // An EMPTY box is min.y = +Infinity, so `-min.y * scale` is -Infinity and the
  // model would be flung out of the world. A model with no geometry is a real
  // possibility (a GLB with an empty scene), so this is guarded rather than
  // assumed, and the test is `a flat or empty model does not divide by zero`.
  const feetOffset = Number.isFinite(box.min.y) ? -box.min.y * scale : 0;

  return { scale, feetOffset };
}

/** Await before spawning enemies. Any model that fails falls back to the box. */
export async function preloadEnemyModel() {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(MODEL_URLS).map(async ([type, url]) => {
      try {
        const gltf = await loader.loadAsync(url);
        MODELS[type] = {
          scene: gltf.scene,
          clips: gltf.animations,
          ...fitModelToHeight(gltf.scene, MODEL_HEIGHT),
        };
      } catch (e) {
        console.warn(`Enemy model "${type}" failed to load, using box fallback`, e);
      }
    })
  );
}
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

    // Attack telegraph (#40)
    this._windupTimer = 0;                 // > 0 while telegraphing an attack
    this._windupTotal = 0;
    this._attackCooldown = 0;
    this._telegraphColour = new THREE.Color(TELEGRAPH_COLOUR);
    this.onAttack = null;                  // fired when a windup completes: (enemy) => void

    // Without floors we cannot tell ground from void, so the safe fallback is
    // to stand still rather than walk off the edge.
    this._probe = new SurfaceProbe(floors ?? []);

    // Animation state. Must exist BEFORE _buildMesh: _buildModel fills it in.
    this._anim = null;

    this.mesh = this._buildMesh();
    this.mesh.position.copy(position);
    this.position = this.mesh.position;   // alias, not a copy

    parent.add(this.mesh);
  }

    /** Model for this enemy type if loaded, otherwise the old box. */
  _buildMesh() {
    const m = MODELS[this.type];
    return m ? this._buildModel(m) : this._buildBox();
  }

  /** GLB soldier. Both enemy types share the one rig; only the attack clip differs. */
  _buildModel(m) {
    const group = new THREE.Group();

    const model = cloneSkinned(m.scene);
    model.scale.setScalar(m.scale);
    // ...and LIFT it so its feet are on the origin, because `_tick` glues the
    // origin to the floor. See `fitModelToHeight` for the measurement (#39 #2).
    model.position.y = m.feetOffset;

    // Keep the model's own colours/textures; tint via emissive (see _setColour).
    const mats = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      if (!mats.has(src)) {
        mats.set(src, new THREE.MeshToonMaterial({ color: GREY_TOON }));
      }
      o.material = mats.get(src);
      o.frustumCulled = false;
    });
    this._mats = [...mats.values()];
    this.bodyMat = this._mats[0];
    this._baseColour.set(0x000000);
    group.add(model);

    const names = CLIPS[this.type] ?? CLIPS.sprayer;
    const mixer = new THREE.AnimationMixer(model);
    const act = (n) =>
      mixer.clipAction(THREE.AnimationClip.findByName(m.clips, `Armature|${n}`));

    const attack = act(names.attack);
    attack.setLoop(THREE.LoopOnce, 1);
    attack.clampWhenFinished = true;

    this._anim = { mixer, idle: act(names.idle), run: act(names.run), attack, current: null };
    this._play("idle");

    group.userData.enemy = this;
    return group;
  }

  /**
   * Fallback body: the old box. Used when no GLB loaded — in Node tests the
   * assets can't be fetched, and in the browser a load may fail. Spawning
   * enemies must never throw; this keeps the level playable either way.
   */
  _buildBox() {
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
   * Tint the body. The box swaps its uColour uniform; the GLB tints via
   * emissive, not material.color: emissive rests at black on every material,
   * so one blended colour fades back to "no tint" — material.color would have
   * to restore each material's own shade (navy uniform, black gear, skin).
   */
  _setColour(c) {
    if (this._mats) for (const m of this._mats) m.emissive.copy(c);  // GLB model
    else this.bodyMat.uniforms.uColour.value.copy(c);                // box fallback
  }

  /** Crossfade to idle / run / attack. */
  _play(name) {
    const a = this._anim;
    const next = a[name];
    if (a.current === next) return;
    next.reset().play();
    if (a.current) a.current.crossFadeTo(next, 0.15, false);
    a.current = next;
  }

  _animate(dt) {
    if (!this._anim) return;
    if (this._windupTimer > 0) {
      // Stretch the clip across the windup so the telegraph and animation line up.
      const a = this._anim.attack;
      a.timeScale = a.getClip().duration / this._windupTotal;
      this._play("attack");
    } else if (this._vel.x * this._vel.x + this._vel.z * this._vel.z > 0.25) {
      this._play("run");
    } else {
      this._play("idle");
    }
    this._anim.mixer.update(dt);
  }

  /** Per-frame entry point: logic first, then animation. */
  update(dt, playerPos) {
    this._tick(dt, playerPos);
    if (this.alive) this._animate(dt);
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
  _tick(dt, playerPos) {
    if (!this.alive) return;

    // The tint fade runs for EVERY living enemy, movers or not. It used to sit
    // after the canMove check, so a stationary enemy kept its hit colour
    // forever. It is called exactly once, here, so no branch below repeats it.
    this._fadeTint(dt);

    // Attack telegraph (#40). Runs for every living enemy, movers or not. While
    // winding up the enemy plants its feet so the tell reads; knockback from a
    // red hit still carries it.
    this._updateAttack(dt, playerPos);
    if (this._windupTimer > 0) {
      this._applyKnockback(dt);
      return;
    }

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
    //
    // `stopDistance` is the other reason not to steer: a MELEE enemy stops ON the
    // player instead of walking through them. There is no enemy-versus-player
    // collision in this engine, so a Charger simply crossed the player's position,
    // flipped 180 degrees to come back, and repeated every few frames at 5 m/s —
    // Renda: "when the charger collides with the player they start tweaking"
    // (#39). The stop has to be behaviour, because there is nothing else to stop it.
    //
    // ...EXCEPT ON ICE, and that exception is the whole of island B's lesson. A
    // stop is a brake, and the design says a Charger on blue paint CANNOT brake: it
    // commits to its heading and slides straight past. Holding here would quietly
    // turn the level's main teaching beat into "ice is slightly slippery", and the
    // test that caught it is
    // `on blue a Charger commits to its heading and slides past a sidestep`.
    const icy = rules.friction < 1;
    const holding = !icy && this.config.stopDistance > 0 && dist < this.config.stopDistance;

    if (Number.isFinite(dist) && dist > 0.001 && !holding) {
      const inv = 1 / dist;

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

    // ...and only turn the body when it is actually TRAVELLING. The threshold used
    // to be 1e-6 (0.001 m/s), which meant an enemy pressed up against something
    // kept re-aiming its facing on the jitter of its own damping — reading as
    // vibration rather than as standing still (#39).
    const vx = this._vel.x;
    const vz = this._vel.z;
    if (vx * vx + vz * vz > 0.04) {
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
   *   1. Feedback — the body colour tints, then fades back.
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
    this._setColour(this._tintTarget);

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
      // A dead enemy never lands its attack: cancel the windup. The colour is
      // left alone so the killing hit still reads as coloured.
      this._windupTimer = 0;
      this.mesh.scale.setScalar(1);
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
    this._setColour(this._tintBlend);
  }

  // --- attack telegraph (#40) -------------------------------------------------
  // Every attack is announced first: yellow flash + swell + the 'telegraph'
  // sound, THEN the attack lands. The tell starts before damage, not with it.

  /** True while the enemy is winding up an attack. */
  get telegraphing() {
    return this._windupTimer > 0;
  }

  /**
   * Begin an attack windup. Returns false if the enemy is dead, already
   * winding up, or still cooling down from its last attack.
   * The attack itself lands when the windup ends — see `onAttack`.
   * Anything that attacks (shooting, a charge, a drain) should go through this.
   */
  startTelegraph() {
    if (!this.alive || this._windupTimer > 0 || this._attackCooldown > 0) return false;
    this._windupTotal = this.config.windup ?? DEFAULT_WINDUP;
    this._windupTimer = this._windupTotal;
    this._vel.set(0, 0, 0);          // plant: the tell has to read
    audio.play("telegraph");
    return true;
  }

  _updateAttack(dt, playerPos) {
    if (this._attackCooldown > 0) this._attackCooldown -= dt;

    if (this._windupTimer <= 0) {
      // Enemies with an attackRange start their own windup once the player is
      // inside it. Guard the argument like update() does: a non-Vector3 gives NaN.
      const range = this.config.attackRange;
      if (range && playerPos) {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        if (dx * dx + dz * dz <= range * range) this.startTelegraph();
      }
      return;
    }

    this._windupTimer -= dt;
    if (this._windupTimer <= 0) {
      this._endTelegraph();
      this._attackCooldown = this.config.attackCooldown ?? DEFAULT_ATTACK_COOLDOWN;
      this.onAttack?.(this);
      return;
    }

    // p runs 0 -> 1 across the windup. The flicker speeds up as the hit gets
    // closer, so the last moments read as the most urgent. A colour change on
    // a small body is easy to miss at ~10 m, so the whole mesh swells too.
    const p = 1 - this._windupTimer / this._windupTotal;
    const flicker = 0.5 + 0.5 * Math.sin(p * Math.PI * 2 * (3 + 6 * p));
    const amount = (0.35 + 0.65 * flicker) * (0.5 + 0.5 * p);

    this._tintBlend.copy(this._baseColour).lerp(this._telegraphColour, amount);
    this._setColour(this._tintBlend);
    this.mesh.scale.setScalar(1 + TELEGRAPH_SWELL * p);
  }

  _endTelegraph() {
    this._windupTimer = 0;
    this.mesh.scale.setScalar(1);
    // A live paint tint rewrites the colour on the next frame; otherwise put
    // the body back to its resting colour so the yellow does not stick.
    if (this._tintTimer <= 0) this._setColour(this._baseColour);
  }

  /** Frees our own GPU resources. The level still disposes them via its base
   *  traverse — `dispose()` is idempotent, and the level calls us first
   *  because a future enemy may own pooled resources outside `root`.
   *
   *  Model clones SHARE geometry with each other (and the cached GLB), so only
   *  the box fallback disposes geometry. The per-enemy material is always ours. */
  dispose() {
    (this._mats ?? [this.bodyMat]).forEach((m) => m?.dispose());
    if (!this._anim) {
      this.mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
    }
    this.mesh.removeFromParent();
  }
}