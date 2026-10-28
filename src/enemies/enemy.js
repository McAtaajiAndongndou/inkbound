import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
// ^ if your #48 spike imports these differently (e.g. "three/addons/..."), match that.
import { AWARENESS, CLIMB, ENEMY, ENEMY_NAV, PAINT, PAINT_IDS } from "../config.js";
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

// --- charge recovery (#76) ---------------------------------------------------
// Every attack owes the player three beats: tell -> threat -> opening. The
// Charger had the first two and not the third, so the fight was "sidestep or
// take 25" — a reaction test, not a skill. A charge that ENDS now buys the
// player a stationary, vulnerable window (`config.recovery`).
//
// A charge ends four ways, and every one of them goes through `_startRecovery`,
// so it is impossible to add an exit that forgets to pay out the opening:
//   1. arrival  — it stops ON the player (`stopDistance`, #39)
//   2. impact   — a refused step: wall, ledge, or a drop over maxStepDown
//   3. distance — CHARGE_DISTANCE of ground covered, so kiting still ends it
//   4. time     — CHARGE_TIME committed; the backstop, catches slow/icy charges
const CHARGE_DISTANCE = 8;          // metres of charge before it is spent
const CHARGE_TIME = 2.0;            // seconds committed before it is spent
const MIN_CHARGE_SPEED = 0.5;       // m/s below which it is standing, not charging

// --- GLB soldiers (#50) ------------------------------------------------------
const MODEL_HEIGHT = 1.6;           // world units tall; tune to taste

/**
 * The rigless gait (#39 #7b). See `Enemy._gait`.
 *
 * These numbers are the whole of the fake: the enemy GLBs have no leg bones, so
 * the body bob and lean ARE the locomotion animation. Tune here.
 */
const GAIT = {
  bob: 0.075,        // metres of rise at full stride
  maxLean: 0.22,     // radians (~12 deg) forward at full speed
  leanPerSpeed: 0.035,
};

/**
 * What every enemy knows about the player, apart from where they are (#109).
 *
 * This is a module-level signal, not a property of any one enemy, because two of
 * the three facts are things one actor does that EVERY enemy must react to:
 * submerging cuts detection for all of them, and firing reveals you to all of
 * them at once. A per-enemy copy would need the caller to loop over the enemy
 * list, and the caller is `main.js` — another lane.
 *
 * WHERE THE WRITES COME FROM, and why they are not here: this issue owns the
 * AWARENESS half of that contract, not the player's half.
 *   - `submerged` is written by submerge (#036, core lane) as it changes.
 *   - `shots` is incremented by the gun on every shot fired (paint lane).
 * Both are one line at the source. Until they exist the game runs the standing,
 * un-fired case — which is the current behaviour, not a broken one.
 *
 * `shots` is a COUNTER rather than a timestamp so that no shared clock has to be
 * agreed on: each enemy remembers the last value it saw. A shot fired while an
 * enemy is asleep is one it never hears, which is right — it was not awake to
 * hear it.
 */
export const PLAYER_SIGNAL = {
  submerged: false,
  shots: 0,
};

/** Test/level-teardown reset, so one run cannot leak awareness into the next. */
export function resetPlayerSignal() {
  PLAYER_SIGNAL.submerged = false;
  PLAYER_SIGNAL.shots = 0;
}

/**
 * The meshes a sight line is tested against (#109).
 *
 * Two ways in, and the order between them is the point: an explicit list wins,
 * because a caller that names its own walls means them. Otherwise the list is
 * read off `parent` — the level already adds every wall, gate and pillar face to
 * its root as a PaintSurface, so "what can this enemy see through" is answerable
 * without the level being taught a new argument.
 *
 * Floors are skipped. A floor is a horizontal plane and cannot stand between two
 * pairs of eyes; keeping it would only let a ray that grazes the ground report
 * occlusion that a player looking at the same scene would never see.
 */
function sightBlockers(explicit, parent) {
  const meshes = [];
  if (explicit) {
    for (const entry of explicit) {
      const mesh = entry?.isObject3D ? entry : entry?.mesh;
      if (mesh) meshes.push(mesh);
    }
    return meshes;
  }
  parent?.traverse?.((obj) => {
    const surface = obj.userData?.paintSurface;
    if (surface && !surface.isFloor) meshes.push(obj);
  });
  return meshes;
}

const MODEL_URLS = {
  charger: "./assets/soldier-charger.glb",
  sprayer: "./assets/soldier-sprayer.glb",
  // #114. The first model here from outside the soldier pack, and the first
  // SkinnedMesh the project has ever shipped: the soldiers are ten rigid parts
  // with NO skin at all, so nothing so far has tested a bone-deformed mesh.
  wallCrawler: "./assets/wall-crawler.glb",
};
const MODELS = {};                  // type -> { scene, clips, scale } once loaded

// Both files ship the same 5 rifle clips (no idle/die/melee).
const CLIPS = {
  charger: { idle: "Rifle@Aim", run: "Rifle@Run.001", attack: "Rifle@AimShoot" },
  sprayer: { idle: "Rifle@Aim", run: "Rifle@Run.001", attack: "Rifle@Shoot" },
  // The zombie pack (#114) has no attack clip at all. `Jump` is the lunge: the
  // only clip with forward commitment, and short (0.33 s) the way a strike is.
  // `Crawl` is locomotion rather than idle because this enemy is idle only in
  // the instant between two moves.
  wallCrawler: { idle: "Idle", run: "Crawl", attack: "Jump" },
};

/**
 * Which clip decides where the floor is (#114).
 *
 * The soldiers need no entry: their rig is rigid parts in a standing pose and
 * every clip measures lowest at the same y — 0.000, measured. A skinned model
 * is not like that. The wall-crawler's BIND pose is standing, but its clips are
 * not: `Crawl` plants hands and knees 5 cm below the soles of that pose and
 * `Run` kicks a foot 12 cm below them. Fit the bind pose and call it done, and
 * the character crawls through the floor — which is precisely the failure the
 * manual check in #114 exists to catch.
 */
const FEET_CLIP = {
  wallCrawler: "Crawl",
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
 * @param floorY  Optional override for where the bottom is (#114). A skinned
 *          model's clips can reach below its bind pose, and then the bind pose
 *          is the wrong floor — see `sampledMinY`. Omitted, this is the box.
 */
export function fitModelToHeight(object, targetHeight, floorY) {
  const box = new THREE.Box3().setFromObject(object);
  const height = box.max.y - box.min.y;
  const scale = height > 0 && Number.isFinite(height) ? targetHeight / height : 1;

  // An EMPTY box is min.y = +Infinity, so `-min.y * scale` is -Infinity and the
  // model would be flung out of the world. A model with no geometry is a real
  // possibility (a GLB with an empty scene), so this is guarded rather than
  // assumed, and the test is `a flat or empty model does not divide by zero`.
  // `Math.min` of the two bottoms keeps this correct whether or not a clip was
  // measured, and keeps the bind pose off the floor even if one never gets there.
  const bottom = Number.isFinite(floorY) ? Math.min(box.min.y, floorY) : box.min.y;
  const feetOffset = Number.isFinite(bottom) ? -bottom * scale : 0;

  return { scale, feetOffset };
}

/**
 * Find a clip by its bare name, whichever rig prefix it carries (#114).
 *
 * `_buildModel` used to hardcode `Armature|<name>` — true of the soldier pack
 * and false of everything else. The wall-crawler's rig is `CharacterArmature`,
 * so all three lookups returned null and `mixer.clipAction(null)` handed back a
 * do-nothing action: the enemy does not even T-pose, it throws the first time
 * the windup reads `getClip().duration`.
 *
 * Matching the tail after the last `|` leaves the soldier names working exactly
 * as they did ("Armature|Rifle@Aim" -> "Rifle@Aim") and makes the next pack work
 * for nothing — which is the whole reason this spike exists (M5-M8).
 */
export function findClip(clips, name) {
  if (!clips || !name) return undefined;
  for (const c of clips) if (c.name === name) return c;
  const suffix = `|${name}`;
  for (const c of clips) if (c.name.endsWith(suffix)) return c;
  return undefined;
}

/**
 * How low a model actually reaches while one clip plays, in the model's own
 * units (#114). Returns 0 when there is no skinned mesh to sample.
 *
 * WHY THE BIND POSE IS NOT ENOUGH. `fitModelToHeight` measures the mesh as it
 * stands in the file. A skinned mesh whose clips move bones away from that pose
 * — a crouch, a stride, a crawl — is a different shape the moment the mixer
 * runs, and the difference is not in the file's bounding box.
 *
 * WHY IT SAMPLES VERTICES AND NOT BOXES. `Box3.setFromObject` on a SkinnedMesh
 * returns the geometry's bind-pose box times the node matrix: the bones are in
 * the hierarchy and moving them does not move that box. Applying the bone
 * matrices per vertex is the only way to see the pose.
 */
export function sampledMinY(object, clip, samples = 8) {
  if (!object || !clip) return 0;
  const meshes = [];
  object.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  if (meshes.length === 0) return 0;

  const mixer = new THREE.AnimationMixer(object);
  mixer.clipAction(clip).play();

  const v = new THREE.Vector3();
  let lowest = Infinity;
  const steps = Math.max(1, samples);
  for (let s = 0; s <= steps; s++) {
    mixer.setTime((clip.duration * s) / steps);
    object.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position;
      if (!pos) continue;
      mesh.skeleton.update();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        if (v.y < lowest) lowest = v.y;
      }
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(object);
  return Number.isFinite(lowest) ? lowest : 0;
}


/** Await before spawning enemies. Any model that fails falls back to the box. */
export async function preloadEnemyModel() {
  const loader = new GLTFLoader();
  await Promise.all(
    Object.entries(MODEL_URLS).map(async ([type, url]) => {
      try {
        const gltf = await loader.loadAsync(url);

        // Where the floor is, before scaling (#114). Measured from the clip the
        // enemy walks in rather than from the bind pose, because for a skinned
        // model those are different heights — see `FEET_CLIP`. Soldiers sample
        // 0.000 here and are fitted exactly as they were.
        const feetClip = findClip(gltf.animations, FEET_CLIP[type]);
        const floorY = feetClip ? sampledMinY(gltf.scene, feetClip) : undefined;

        // `_gait` is the fake for rigs that cannot animate their own legs; a
        // skinned model can, so it must not be given both (#114).
        let skinned = false;
        gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });

        MODELS[type] = {
          scene: gltf.scene,
          clips: gltf.animations,
          skinned,
          ...fitModelToHeight(gltf.scene, MODEL_HEIGHT, floorY),
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
   * @param {THREE.Object3D[]} [opts.blockers] upright surfaces a sight line stops
   *                                        at (#109). Defaults to every wall the
   *                                        level has put under `parent`, which is
   *                                        where they already live.
   */
  constructor({ position, config, parent, floors, sleeping = false, blockers }) {
    this.config = config;
    // Derived from the config's identity rather than passed alongside it, so
    // `type` and `config` cannot be handed over disagreeing.
    this.type = Object.keys(ENEMY).find((key) => ENEMY[key] === config) ?? "sprayer";
    this.alive = true;
    this.hp = config.hp;

    // DORMANT. An enemy that exists, is visible, and does nothing until the level
    // wakes it. This is how "opt-in difficulty" is built (issue #54, and the deck
    // Sprayer / Island A Charger in Outskirts): the player must be able to SEE the
    // threat before deciding to engage. Hiding the enemy until the trigger is not
    // the same thing — that is a reveal, and it removes the decision.
    //
    // Being hit wakes it, in both damage paths, so a dormant enemy is never a
    // free kill.
    this.sleeping = sleeping;

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

    // Charge recovery (#76). `recovery: 0` means this enemy has no such state,
    // which is what keeps every other enemy in the game unaffected by it.
    this._recovery = config.recovery ?? 0;
    this._recoverTimer = 0;                // > 0 while standing in the opening
    this._chargeTime = 0;                  // seconds spent in the current charge
    this._chargeDistance = 0;              // metres covered in the current charge

    // Without floors we cannot tell ground from void, so the safe fallback is
    // to stand still rather than walk off the edge.
    this._probe = new SurfaceProbe(floors ?? []);

    // --- awareness (#109) ----------------------------------------------------
    // Dormant -> Alert -> Search, per `docs/enemies/algorithms.md`. An enemy
    // starts not knowing where you are: it has to see you, and anything it does
    // afterwards is done to where it last saw you rather than to where you are.
    //
    // NOT the same thing as `sleeping` above. `sleeping` is the level saying
    // "this one is off until you approach" (opt-in difficulty, #54); awareness
    // is the enemy's own opinion, and it is the only thing that gates attacks.
    // An awake enemy can still be dormant.
    this._awareness = "dormant";
    this._lastKnown = new THREE.Vector3();  // where it last SAW you
    this._forgetTimer = 0;                  // Search -> Dormant countdown
    this._fireTimer = 0;                    // Alert bought by your last shot
    this._seenShots = PLAYER_SIGNAL.shots;  // the shot count this enemy knows of

    // Sight lines are tested against UPRIGHT surfaces only. A floor is a
    // horizontal plane: it can never come between two pairs of eyes, and adding
    // it to this list would only let a grazing ray invent a wall that is not
    // there. Walls, gates and pillar faces are all PaintSurfaces under the
    // level's root, so an enemy can find them without being handed them — but a
    // level may pass its own list, and a test that wants one wall passes one.
    this._blockers = sightBlockers(blockers, parent);
    this._raycaster = new THREE.Raycaster();
    this._eye = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._sight = new THREE.Vector3();
    this._hits = [];                        // reused: intersectObjects fills it

    // Climbing (#115). `config.climbsGreen` shipped as a flag with nothing behind
    // it; this is the state that reads it. It is read off the PAINT every frame
    // rather than off the config, because the face is the thing being climbed —
    // see CLIMB in config.js.
    this._climbing = false;      // true while holding a face
    this._falling = false;       // true between letting go and touching floor
    this._climbFace = null;      // the PaintSurface being held
    this._fallVel = 0;           // m/s downward while falling
    this._climbNormal = new THREE.Vector3();   // chosen face's outward normal
    this._climbScan = new THREE.Vector3();     // scratch: a candidate's normal
    this._climbAnchor = new THREE.Vector3();   // scratch: face's world position
    this._climbPoint = new THREE.Vector3();    // scratch: a point on the face
    this._climbProbe = new THREE.Vector3();    // scratch: the body's own point

    // Animation state. Must exist BEFORE _buildMesh: _buildModel fills it in.
    this._anim = null;

    // Rigless gait state. `_model` is set by _buildModel only; `_stride` counts
    // METRES of travel, which is what keeps the bob in step with the movement
    // rather than with the frame rate.
    this._model = null;
    this._feetOffset = 0;
    this._stride = 0;
    // True when the model has bones of its own, which switches the fake gait off
    // (#114). Set by `_buildModel` from what preload actually found.
    this._skinned = false;

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
    // Kept so `_gait` can move the body without disturbing the group's facing
    // (`mesh.rotation.y`) or the telegraph's swell (`mesh.scale`).
    this._model = model;
    this._feetOffset = m.feetOffset;

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
    const act = (n) => {
      // Not `AnimationClip.findByName(clips, 'Armature|' + n)` any more (#114):
      // the prefix belongs to the pack, not to the lookup.
      const clip = findClip(m.clips, n);
      if (!clip) {
        console.warn(`Enemy "${this.type}": no clip "${n}" among ${m.clips?.length ?? 0} loaded clips`);
        return null;
      }
      return mixer.clipAction(clip);
    };

    const attack = act(names.attack);
    if (attack) {
      attack.setLoop(THREE.LoopOnce, 1);
      attack.clampWhenFinished = true;
    }

    this._skinned = Boolean(m.skinned);
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
    // A clip the pack does not have (#114) leaves `next` null; skipping keeps
    // the enemy on whatever pose it already holds instead of throwing here.
    if (!next || a.current === next) return;
    next.reset().play();
    if (a.current) a.current.crossFadeTo(next, 0.15, false);
    a.current = next;
  }

  _animate(dt) {
    if (!this._anim) return;
    if (this._windupTimer > 0 && this._anim.attack) {
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

  /** Per-frame entry point: logic first, then animation/gait. */
  update(dt, playerPos) {
    if (this.sleeping) {
      // Awake enough to look alive, asleep enough to be harmless: no movement, no
      // telegraph, no attack. The idle clip still plays, so a dormant enemy reads
      // as standing guard rather than as a frozen prop.
      //
      // A sleeping enemy also HEARS NOTHING (#109): the shot counter is kept up
      // to date while it cannot act on it, so waking an enemy does not hand it a
      // three-second memory of a shot that was fired at a corpse's back. Without
      // this line the enemy would wake up already alerted, which reads as the
      // level having cheated.
      this._seenShots = PLAYER_SIGNAL.shots;
      if (this.alive) this._animate(dt);
      return;
    }
    this._tick(dt, playerPos);
    if (this.alive) this._animate(dt);
    // The gait is NOT part of `_animate`, because `_animate` returns immediately
    // when there is no clip mixer — which is the case in every test (no GLB
    // loader) and for the box fallback. Keeping it separate is what lets it be
    // tested with a stand-in model.
    this._gait(dt);
  }

  /** Stop being dormant. Idempotent: the level may call it every frame on a trigger. */
  wake() {
    this.sleeping = false;
  }

  /**
   * Rigless locomotion: the body bobs and leans as it moves.
   *
   * WHY THIS EXISTS. The shipped enemy GLBs have **no leg, hip or spine bones** —
   * the rig is arms only (see #39 #7b, and the `fitModelToHeight` note above), so
   * a run cycle is not possible with these files no matter what the code does. A
   * body that translates perfectly smoothly does not read as "no animation" from
   * the player's seat; it reads as GLIDING, which is worse.
   *
   * So this fakes the part a rig would have given us, and it is honest about being
   * a fake: a vertical bob and a forward lean, driven by DISTANCE TRAVELLED rather
   * than by time, so it stays in step with the movement instead of drifting against
   * it. Lean is proportional to speed, so a Charger at 5 m/s leans like a sprinter
   * and a Sprayer at 2.5 leans gently.
   *
   * It does nothing when `_model` is absent, which is the box fallback and every
   * Node test — the box already has a readable shape and no pivot offset.
   *
   * Allocation-free by construction: local numbers only, and every write is to a
   * field that already exists.
   */
  _gait(dt) {
    if (!this._model) return;

    // A model with a real skeleton does not need the fake (#114). The
    // wall-crawler's crawl clip already bobs the body; adding GAIT.bob on top
    // would double it, and the lean would tip a crawling model off its hands.
    // The soldiers keep it because their rig is arms only — the reason it exists.
    if (this._skinned) return;

    const vx = this._vel.x;
    const vz = this._vel.z;
    const speed = Math.sqrt(vx * vx + vz * vz);

    // 2.4 radians per metre of travel: about 1.3 steps per metre, which reads as a
    // run. The same constant for every enemy, so one enemy type is not visibly
    // steeping faster than another at the same speed.
    this._stride += speed * dt;
    const bob = Math.abs(Math.sin(this._stride * 2.4)) * GAIT.bob * Math.min(1, speed / 2);

    // The windup PLANTS the feet, so a telegraphing enemy must not lean or bob —
    // otherwise the tell looks like it is still travelling.
    const lean = this._windupTimer > 0 ? 0 : Math.min(GAIT.maxLean, speed * GAIT.leanPerSpeed);

    this._model.position.y = this._feetOffset + bob;
    this._model.rotation.x = lean;
  }

  // --- climbing (#115) -------------------------------------------------------
  // `config.climbsGreen` has been in this file since the enemy configs were first
  // written, with nothing reading it. This is the behaviour: a vertical
  // PaintSurface is ground the crawler can walk on, and it reads its speed off
  // the paint under it — green 5.0, everything else 3.5.

  /** True while it is holding a face. The Opening: it cannot shoot here. */
  get climbing() {
    return this._climbing;
  }

  /** True between letting go of a face and touching floor again. */
  get falling() {
    return this._falling;
  }

  /**
   * Pick a face to climb, or null.
   *
   * Only surfaces that are NOT floors are considered — the same test
   * `sightBlockers` already uses. A floor is a plane you stand on and a face is
   * a plane you stand against, and `isFloor` is the only thing in the game that
   * tells them apart.
   *
   * A face qualifies when all three hold:
   *   1. it is vertical — its world normal has almost no Y,
   *   2. the crawler is in FRONT of it, inside `CLIMB.reach`,
   *   3. it still has surface `CLIMB.verticalGap` further along IN THE
   *      DIRECTION OF THE PLAYER, so a kerb is not a wall — and so a crawler
   *      standing on a ledge can still grab the face below it and come down.
   *
   * GREEN WINS when two faces qualify, as the design asks. The comparison is on
   * speed rather than on colour — `_climbSpeed` is the same function the climb
   * itself reads — so "prefers green" can never drift away from "green is
   * faster".
   *
   * @param {THREE.Vector3} playerPos decides which way the crawl would go
   * @returns {PaintSurface|null} the chosen face, also left in `_climbFace`
   */
  _findFace(playerPos) {
    if (this._blockers.length === 0) return null;

    // Which way the crawl goes: up to a player above, down to one below. The
    // face only has to continue THAT way.
    const toward = playerPos.y > this.position.y ? 1 : -1;

    let best = null;
    let bestSpeed = 0;

    for (let i = 0; i < this._blockers.length; i++) {
      const mesh = this._blockers[i];
      const surface = mesh.userData?.paintSurface;
      if (!surface) continue;

      mesh.updateWorldMatrix(true, false);

      // A plane's front is local +Z, so the third column of its world matrix is
      // its normal — the same fact SurfaceProbe uses one axis over, and the
      // reason no quaternion has to be read or inverted here.
      const e = mesh.matrixWorld.elements;
      // A scan vector, not `_climbNormal`: the next candidate would overwrite
      // the chosen face's normal with its own on the way past.
      this._climbScan.set(e[8], e[9], e[10]).normalize();
      if (Math.abs(this._climbScan.y) > 0.5) continue;        // a floor, not a face

      // Signed distance to the plane: positive is the front side, which is the
      // only side a one-sided plane can be climbed from. A crawler has no wall
      // collision, so it walks right up to the plane and can end up flush with
      // it — a few centimetres past is still "against the face", not "behind
      // it", and `_updateClimb` snaps it back out to `CLIMB.gap`.
      mesh.getWorldPosition(this._climbAnchor);
      const d = this._climbPoint
        .copy(this.position)
        .sub(this._climbAnchor)
        .dot(this._climbScan);
      if (d < -0.25 || d > CLIMB.reach) continue;

      // The point on the face at the crawler's own height, and the same point
      // again one step further along the crawl: the first says "in reach", the
      // second says "there is still wall that way".
      this._climbPoint
        .copy(this.position)
        .addScaledVector(this._climbScan, -d);
      // Standing on the ledge above a face puts the feet exactly on its boundary
      // row, where worldToCell is a coin flip. Ask 5 cm into the face instead,
      // or a crawler could never come DOWN a face it is standing above.
      if (!surface.worldToCell(this._climbPoint)) {
        this._climbPoint.y += 0.05 * toward;
        if (!surface.worldToCell(this._climbPoint)) continue;
      }

      this._climbProbe.copy(this._climbPoint);   // kept apart: worldToCell reuses
      this._climbProbe.y += CLIMB.verticalGap * toward;   // its own scratch, not this one
      if (!surface.worldToCell(this._climbProbe)) continue;

      const speed = this._climbSpeed(surface, this._climbPoint);
      if (speed <= bestSpeed) continue;

      best = surface;
      bestSpeed = speed;
      this._climbNormal.copy(this._climbScan);
    }

    this._climbFace = best;
    return best;
  }

  /**
   * How fast it can climb this face, read off the paint under `point`.
   *
   * `climbable` is the SURFACE flag the player's own wall climb reads, so the
   * crawler and the player agree about what green means by construction rather
   * than by two constants that happen to match.
   */
  _climbSpeed(surface, point) {
    return surface.surfaceAtWorld(point).climbable ? CLIMB.green : CLIMB.grey;
  }

  /** Take hold of `face`. Clears the walk, which does not apply on a wall. */
  _beginClimb(face) {
    this._climbing = true;
    this._falling = false;
    this._fallVel = 0;
    this._climbFace = face;
    this._vel.set(0, 0, 0);
  }

  /**
   * Off the wall — by choice or by paint.
   *
   * One path for every way a climb ends, because they all have the same
   * consequence: it is falling, and it has to climb again. That is what makes
   * pinning one halfway up worth the shot even though the pin itself does no
   * damage.
   */
  _detach() {
    if (!this._climbing && !this._falling) return;
    this._climbing = false;
    this._climbFace = null;
    this._falling = true;
    this._fallVel = 0;
    this._vel.set(0, 0, 0);
  }

  /**
   * Fall until there is floor. Gravity is its own (CLIMB.gravity) rather than the
   * player's: this is a body dropping off a wall, not a jump.
   *
   * The floor is found with the same probe the walk uses, which is what keeps a
   * fallen crawler on its own island — the probe is handed the level's floors, so
   * a gap reads as no ground and it keeps falling.
   */
  _fall(dt) {
    this._fallVel = Math.min(CLIMB.maxFall, this._fallVel + CLIMB.gravity * dt);
    this.position.y -= this._fallVel * dt;

    const ground = this._probe.down(this.position);
    if (ground && this.position.y <= ground.y + 0.02) {
      this.position.y = ground.y;
      this._falling = false;
      this._fallVel = 0;
    }
  }

  /**
   * One frame on the wall, or in the air after leaving it.
   *
   * It climbs TOWARD the player's height and never past it: the goal is the ledge
   * they are standing on, not the top of the wall. Two ways to let go — arriving
   * at their level, or being in drop range above them, which is the crawler's
   * attack: the fall is the damage, delivered by contact on the way down.
   */
  _updateClimb(dt, playerPos) {
    if (this._falling) {
      this._fall(dt);
      return;
    }

    // No valid player means no target height to climb to. Let go rather than
    // read `.y` off nothing: a crawler with nowhere to go belongs on the floor.
    if (!playerPos || !Number.isFinite(playerPos.y)) {
      this._detach();
      return;
    }

    // A pin that is still ticking keeps a climber off the wall for its whole
    // duration: the green hit already detached it, and this stops it grabbing
    // the same face again a frame later.
    if (this._pinnedTimer > 0) {
      this._pinnedTimer -= dt;
      this._detach();
      return;
    }

    const face = this._climbFace;
    if (!face) {
      this._detach();
      return;
    }

    face.mesh.updateWorldMatrix(true, false);
    const e = face.mesh.matrixWorld.elements;
    this._climbNormal.set(e[8], e[9], e[10]).normalize();

    // Hold the body CLIMB.gap off the face, so climbing does not walk it into
    // the wall it is holding.
    face.mesh.getWorldPosition(this._climbAnchor);
    const d = this._climbPoint
      .copy(this.position)
      .sub(this._climbAnchor)
      .dot(this._climbNormal);
    this.position.addScaledVector(this._climbNormal, CLIMB.gap - d);

    // Paint at the body's own height, read every frame: painting the face grey
    // halfway up visibly slows the climb, which is the whole "your route is its
    // route" point made legible.
    this._climbPoint
      .copy(this.position)
      .addScaledVector(this._climbNormal, -CLIMB.gap);
    // Which way this frame's crawl is going: up to a player above, down to one
    // below. Read once, used by the edge fallback and by the step itself.
    const toward = playerPos.y > this.position.y ? 1 : -1;
    if (!face.worldToCell(this._climbPoint)) {
      // Standing on the ledge above a face, the feet sit exactly on its top
      // boundary row, where worldToCell is a coin flip. Ask 5 cm into the face
      // before calling it off the wall, or a descent ends on its first frame.
      this._climbPoint.y += 0.05 * toward;
      if (!face.worldToCell(this._climbPoint)) {
        this._detach();          // ran out of wall (the top, or off the side)
        return;
      }
    }
    const speed = this._climbSpeed(face, this._climbPoint);

    const dy = playerPos.y - this.position.y;
    this.position.y += toward * Math.min(Math.abs(dy), speed * dt);

    // Face the wall. A bare yaw for the same reason the ground turn is one: it
    // is six operations against lookAt's world matrix and quaternion inverse.
    this.mesh.rotation.y = Math.atan2(-this._climbNormal.x, -this._climbNormal.z);

    // Let go on arrival, or just above the player and close enough for the fall
    // to land on them.
    //
    // The height is capped at `CLIMB.dropRange` on purpose. Uncapped, a crawler
    // at the top of a tall face is already "above and close" the moment the
    // player stands at its foot — so it would let go on the first frame and the
    // descent the design is asking for ("it should come down that face, faster
    // than over grey") would never be seen. Capped, the crawl down the wall is
    // the travel and the last 2.5 m is the attack.
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const close = dx * dx + dz * dz <= CLIMB.dropRange * CLIMB.dropRange;
    const above = this.position.y - playerPos.y;
    const inDropRange = above > 0.2 && above <= CLIMB.dropRange;
    if (Math.abs(dy) < 0.15 || (inDropRange && close)) this._detach();
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

    // Awareness (#109) first, because everything below is conditional on it: an
    // enemy that has not seen you has no target to walk at and nothing to shoot
    // at. Keeping it here, once, is what stops the attack half and the movement
    // half from disagreeing about whether you exist.
    this._updateAwareness(dt, playerPos);

    // GRAB (#115). Ahead of the attack, not after it, and that ordering is the
    // feature: a crawler with a face in reach and the player on another level
    // climbs instead of shooting. Put this after `_updateAttack` and the 12 m
    // attackRange wins every time — the crawler winds up at the bottom of the
    // wall forever, and the climb only ever happens when you are already too
    // close to shoot.
    //
    // `climbsGreen` is the flag this reads. On the same floor it walks like
    // everything else: climbing is a shortcut to somewhere above or below you,
    // not a movement mode.
    //
    // A committed windup and a pin are both respected — the swing lands and the
    // root holds, and the grab is retried next frame.
    if (this.config.climbsGreen && !this._climbing && !this._falling
      && this._windupTimer <= 0 && this._pinnedTimer <= 0
      && playerPos && Number.isFinite(playerPos.y)
      && Math.abs(playerPos.y - this.position.y) > CLIMB.verticalGap
      && this._findFace(playerPos)) {
      this._beginClimb(this._climbFace);
      this._applyKnockback(dt);
      return;
    }

    // Attack telegraph (#40). Runs for every living enemy, movers or not. While
    // winding up the enemy plants its feet so the tell reads; knockback from a
    // red hit still carries it.
    this._updateAttack(dt, playerPos);
    if (this._windupTimer > 0) {
      this._applyKnockback(dt);
      return;
    }

    // RECOVER (#76) — the opening beat. The charge is over, so the enemy plants
    // itself: no steering, no re-alerting, whatever the player does. Damage is
    // deliberately NOT gated: `takeColourHit` has no state guard, and contact
    // damage stays on `config.contactDamage` read by player.checkEnemyContact,
    // so both behave exactly as they did before. Knockback still carries it.
    if (this._recoverTimer > 0) {
      this._recoverTimer -= dt;
      this._vel.set(0, 0, 0);
      this._applyKnockback(dt);
      return;
    }

    if (!this.config.canMove) return;

    // --- climbing (#115) -----------------------------------------------------
    // Ahead of the walk and of the pin, because a crawler on a face is not on the
    // ground: `_probe.down` finds nothing mid-face, so every rule below would
    // either refuse the step or freeze it against the wall. A crawler that was
    // just knocked off the wall is FALLING rather than pinned, and the pin timer
    // is read inside `_updateClimb` for exactly that reason.
    if (this.config.climbsGreen && (this._climbing || this._falling)) {
      this._updateClimb(dt, playerPos);
      this._applyKnockback(dt);
      return;
    }

    // Green pin: movement stops, threat does not (settled rule). The knockback
    // from a red hit can still carry it while pinned, so apply that first.
    if (this._pinnedTimer > 0) {
      this._pinnedTimer -= dt;
      this._applyKnockback(dt);
      return;
    }

    // Dormant: it does not know there is anything to walk toward. It still comes
    // to a stop rather than freezing mid-stride with momentum on it, because a
    // body that resumes at its old speed the instant it spots you reads as a
    // glitch rather than as noticing. Knockback still applies — being flung by
    // red does not require being aware.
    if (this._awareness === "dormant") {
      const braking = Math.max(0, 1 - 8 * dt);
      this._vel.x *= braking;
      this._vel.z *= braking;
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

    // A SEARCHING enemy walks to where it last SAW you, not to where you are.
    // That one substitution is the whole of "being hunted is only frightening if
    // the hunter is fallible": steering, the slide, the island-edge rule below
    // are all untouched and cannot tell the difference — which is exactly why a
    // search cannot quietly turn back into homing.
    const target = this._awareness === "search" ? this._lastKnown : playerPos;
    this._toPlayer.copy(target).sub(this.position);
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
    const holding = !icy && (
      (this.config.stopDistance > 0 && dist < this.config.stopDistance)
      // A search stops when it REACHES the place, not when it reaches you. It
      // has no idea where you are any more — that is the state.
      || (this._awareness === "search" && dist < AWARENESS.arrive)
    );

    // ARRIVAL is the end of a charge (#76). The Charger stops ON the player
    // (#39), and standing glued to them is exactly the "immediately back on you"
    // problem — so the stop is also where the opening begins. `_startRecovery`
    // ignores this when nothing was charging, so simply loitering next to an
    // idle Charger does not freeze it forever.
    if (holding && this._recovery > 0) this._startRecovery();

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
    //
    // It also refuses a step DOWN more than `ENEMY_NAV.maxStepDown`. Without that
    // second rule an enemy walk off the edge of any raised platform and drops to
    // whatever is below — which is what the shooters on island C's pillars did
    // (#39). The probe only ever asked "is there a floor", never "is it the same
    // floor I am on".
    const nextGround = this._probe.down(this._next);
    if (nextGround && nextGround.y >= this.position.y - ENEMY_NAV.maxStepDown) {
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

      if (this._recovery > 0) this._trackCharge(dt);
    } else {
      // Refused: stop pushing into the void. Against a wall, a ledge or a drop
      // that is also the end of the charge (#76) — hitting something is the tell
      // the player reads before the opening, so it must not be a free retry.
      this._vel.set(0, 0, 0);
      if (this._recovery > 0) this._startRecovery();
    }

    this._applyKnockback(dt);
  }

  /**
   * Charge bookkeeping (#76). Runs once per frame the enemy actually moved, and
   * only for configs that have a `recovery`. Ends the charge on distance or on
   * time; arrival and impact are handled in `_tick`.
   *
   * The budget is per-charge, not per-life: standing still clears it, so every
   * new charge starts with the full allowance.
   */
  _trackCharge(dt) {
    const speed = Math.sqrt(this._vel.x * this._vel.x + this._vel.z * this._vel.z);
    if (speed < MIN_CHARGE_SPEED) {
      this._chargeTime = 0;
      this._chargeDistance = 0;
      return;
    }

    this._chargeTime += dt;
    this._chargeDistance += speed * dt;

    if (this._chargeTime >= CHARGE_TIME || this._chargeDistance >= CHARGE_DISTANCE) {
      this._startRecovery();
    }
  }

  /**
   * Hand over the opening: stand still and take it for `config.recovery` seconds.
   * Idempotent, and a no-op when no charge is in flight — that is what stops the
   * arrival and impact exits from re-arming the timer every frame.
   */
  _startRecovery() {
    if (this._recovery <= 0) return;
    if (this._chargeTime <= 0 && this._chargeDistance <= 0) return;
    this._recoverTimer = this._recovery;
    this._chargeTime = 0;
    this._chargeDistance = 0;
    this._vel.set(0, 0, 0);
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
   * Reaction is skipped entirely for a `config.noProcs` enemy (#77): damage and
   * tint only. See the turret's config entry for why.
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

    // A hit wakes a dormant enemy: no free kills.
    this.sleeping = false;

    // Feedback first, so a killing hit still reads as coloured.
    this._tintTarget.setHex(PAINT[name].hex);
    this._tintTimer = TINT_FADE;
    this._setColour(this._tintTarget);

    this.hp -= damage;

    // #77 — status procs belong to the ENEMY, not to the colour. A `noProcs`
    // enemy (the turret, the game's designated matrix gap) takes the damage and
    // the tint and nothing else. One flag read in front of the whole chain, not
    // a check inside each branch: a future fourth proc then has to opt out as
    // well, rather than quietly applying to a turret because its author never
    // knew the turret existed.
    //
    // The tint above stays unconditional on purpose — the shot has to read as
    // the colour you fired, even when the colour buys you no reaction.
    if (!this.config.noProcs) {
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

      // Every colour's reaction is "off the wall" for a climber (#115). Green
      // roots it mid-face and it drops; blue freezes it and it drops; red throws
      // it and it drops. One line, because the consequence is the same for all
      // three and the wall is where it was safe.
      if (this._climbing) this._detach();
    }

    if (this.hp <= 0) this._die();

    return true;
  }

  /**
   * Colourless damage: a trap, a fall, anything that is not paint.
   *
   * WHY THIS EXISTS RATHER THAN REUSING `takeColourHit`. That method applies a
   * blue/red/green proc, and it rejects `grey` outright -- so a spike pit would
   * either invent a status the hit never earned or silently do nothing. Traps
   * and environmental kills need damage with no status, which is this method.
   *
   * Added from the levels lane for PRD F1 ("red knockback into a pit must
   * kill"); the enemies lane owns this file and should review the shape.
   *
   * @param {number} damage
   * @returns {boolean} whether the hit landed
   */
  takeDamage(damage) {
    if (!this.alive || !(damage > 0)) return false;
    this.sleeping = false;   // a trap that hurts you also wakes you
    this.hp -= damage;
    if (this.hp <= 0) this._die();
    return true;
  }

  /**
   * The one death path. Both a paint kill and a colourless kill end here, so the
   * corpse cannot behave differently depending on what killed it.
   */
  _die() {
    this.alive = false;
    // A dead enemy never lands its attack: cancel the windup. The colour is
    // left alone so the killing hit still reads as coloured.
    this._windupTimer = 0;
    // And it is off the wall (#115): `_tick` stops running the moment it dies,
    // so a climber left holding a face would hang there until the corpse is
    // disposed. Clearing the state is what makes a shot on the wall kill it
    // rather than pin a body to the wall.
    this._climbing = false;
    this._falling = false;
    this._climbFace = null;
    this.mesh.scale.setScalar(1);
    setTimeout(() => this.dispose(), KILL_FLASH_MS);
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

  /** True while the enemy is in the post-charge opening and cannot re-alert (#76). */
  get recovering() {
    return this._recoverTimer > 0;
  }

  /** "dormant" | "alert" | "search" — see `_updateAwareness`. */
  get awareness() {
    return this._awareness;
  }

  /** Where it last saw the player. Only meaningful while searching. */
  get lastKnown() {
    return this._lastKnown;
  }

  /**
   * Decide whether this enemy knows where the player is (#109).
   *
   * The three states and the one sentence that separates them:
   *   Dormant — has not seen you. Walks at nothing, attacks nothing.
   *   Alert   — sees you now. Walks at you, attacks you.
   *   Search  — saw you, then lost you. Walks at the last known position.
   *
   * The rules, in the order they are applied, each for a reason:
   *
   * 1. A shot reveals you. Firing sets Alert for `fireAlert` seconds even while
   *    submerged — that is the restriction that keeps stealth fair, so it is
   *    checked BEFORE the submerge radius rather than after. It still needs line
   *    of sight and it still needs to be inside the standing radius: a gunshot
   *    is loud, but it is not a map marker.
   *
   * 2. Being seen needs the radius AND the sight line. The radius halves while
   *    you are submerged, which is the whole of partial stealth.
   *
   * 3. Losing sight does not forget you. Alert -> Search remembers the position
   *    for `forget` seconds, and that memory is what `_tick` walks to.
   *
   * 4. Forgetting drops to Dormant. Six seconds is the dial from the design
   *    note: too short and the stealth is pointless, too long and the state is
   *    noise.
   *
   * The turret never gets here: `ignoresStealth` short-circuits it into a
   * permanent Alert, which is what "tracks regardless, it is a machine" means.
   *
   * Movement is NOT decided here. This only writes the state and the memory.
   */
  _updateAwareness(dt, playerPos) {
    if (!playerPos || !Number.isFinite(playerPos.x) || !Number.isFinite(playerPos.z)) return;

    if (this.config.ignoresStealth) {
      this._awareness = "alert";
      this._lastKnown.copy(playerPos);
      this._forgetTimer = AWARENESS.forget;
      return;
    }

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // 1. A shot fired since this enemy last looked.
    if (PLAYER_SIGNAL.shots !== this._seenShots) {
      this._seenShots = PLAYER_SIGNAL.shots;
      if (dist <= AWARENESS.radius && this._canSee(playerPos)) {
        this._fireTimer = AWARENESS.fireAlert;
        this._lastKnown.copy(playerPos);
      }
    }
    if (this._fireTimer > 0) this._fireTimer -= dt;

    // 2. Seen, or not.
    const reach = PLAYER_SIGNAL.submerged ? AWARENESS.submergedRadius : AWARENESS.radius;
    if (dist <= reach && this._canSee(playerPos)) {
      this._awareness = "alert";
      this._lastKnown.copy(playerPos);
      this._forgetTimer = AWARENESS.forget;
      return;
    }

    // 3. Known because it just fired at you, even though you are out of sight.
    if (this._fireTimer > 0) {
      this._awareness = "alert";
      return;
    }

    // 4. Lost you. Start looking where it last saw you.
    if (this._awareness === "alert") {
      this._awareness = "search";
      this._forgetTimer = AWARENESS.forget;
      return;
    }

    // 5. Give up.
    if (this._awareness === "search") {
      this._forgetTimer -= dt;
      if (this._forgetTimer <= 0) this._awareness = "dormant";
    }
  }

  /**
   * Is there a clear sight line to `playerPos`? (#109)
   *
   * A single ray at eye height from this enemy to the player, tested against the
   * walls only, and stopped just short of the player's own position so that the
   * surface they are standing on cannot occlude them from the inside.
   *
   * An empty blocker list means open ground, which is TRUE rather than false: in
   * a level with no walls there is nothing to hide behind, and reporting "cannot
   * see" there would make every enemy in a bare test level blind.
   *
   * Allocation-free; the raycaster, vectors and hit array are built once.
   */
  _canSee(playerPos) {
    if (this._blockers.length === 0) return true;

    // Raycasting reads `matrixWorld`, and in a headless run NOTHING refreshes it:
    // the renderer does that once per frame in the browser, so the walls are
    // correct there and identically wrong everywhere else. A level built a
    // moment ago still has every wall at the origin with an identity matrix,
    // which makes a three-metre sight line "hit" nine of them at once and leaves
    // every enemy in the test suite permanently blind. `true` walks up the
    // parents because it is the level's ROOT that was never updated, not the
    // wall.
    //
    // Cost is per check, not per frame, and only for enemies already inside a
    // detection radius — the ones for whom the answer matters.
    for (let i = 0; i < this._blockers.length; i++) {
      this._blockers[i].updateWorldMatrix(true, false);
    }

    this._eye.set(this.position.x, this.position.y + AWARENESS.eyeHeight, this.position.z);
    this._look.set(playerPos.x, playerPos.y + AWARENESS.eyeHeight, playerPos.z);
    this._sight.subVectors(this._look, this._eye);
    const d = this._sight.length();
    if (!(d > 0.5)) return true;          // nose to nose: nothing can be between
    this._sight.divideScalar(d);

    this._raycaster.set(this._eye, this._sight);
    this._raycaster.far = d - 0.25;       // the player is not behind themselves
    this._hits.length = 0;
    this._raycaster.intersectObjects(this._blockers, false, this._hits);
    return this._hits.length === 0;
  }

  /**
   * Begin an attack windup. Returns false if the enemy is dead, already
   * winding up, or still cooling down from its last attack.
   * The attack itself lands when the windup ends — see `onAttack`.
   * Anything that attacks (shooting, a charge, a drain) should go through this.
   */
  startTelegraph() {
    // Recovery is the opening: re-alerting inside the window would delete the
    // beat the window exists to create (#76).
    if (!this.alive || this._windupTimer > 0 || this._attackCooldown > 0
      || this._recoverTimer > 0) return false;
    this._windupTotal = this.config.windup ?? DEFAULT_WINDUP;
    this._windupTimer = this._windupTotal;
    this._vel.set(0, 0, 0);          // plant: the tell has to read
    audio.play("telegraph");
    return true;
  }

  _updateAttack(dt, playerPos) {
    if (this._attackCooldown > 0) this._attackCooldown -= dt;

    // THE OPENING (#115): a crawler holding a face cannot shoot. That is the
    // trade for being able to follow you up a wall — and the reason the answer
    // to it halfway up is a shot rather than a dodge. It also means a climb can
    // never be turned into a firing position, which would make the wall a
    // turret with legs.
    if (this._climbing) return;

    if (this._windupTimer <= 0) {
      // Enemies with an attackRange start their own windup once the player is
      // inside it. Guard the argument like update() does: a non-Vector3 gives NaN.
      // An enemy only winds up at something it is aware of (#109). Note the
      // windup itself is NOT cut short by losing awareness: a committed swing
      // still lands, which is what makes breaking line of sight a dodge rather
      // than an undo button.
      const range = this.config.attackRange;
      if (range && playerPos && this._awareness === "alert") {
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