import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ANIM, PLAYER } from '../config.js';

const MODEL_URL = './assets/soldier-swat.glb';
const CLIP_PREFIX = 'CharacterArmature|';

const HAND_BONE = 'Wrist-R';
const HAND_ROTATION = new THREE.Euler(1.557,0.042, 1.393);
const HAND_OFFSET = new THREE.Vector3(0,0.08,0);
// #124. The armed set is FIVE poses, and the two that shipped as the defaults
// were the wrong two: `Idle_Gun_Pointing` is the aim pose and `Run_Shoot` is the
// shooting pose, so the player was permanently aiming and permanently firing.
// That is why "aiming is a FOV change with no body language" — there was nothing
// left for the body to say. The defaults are now the neutral ones and the
// pointing/shooting clips are the states that mean something.
const CLIPS = {
  unarmed: {idle: 'Idle', move: 'Run'},
  armed: {
    idle: 'Idle_Gun',            // gun held ready, not raised
    move: 'Run',
    aim: 'Idle_Gun_Pointing',    // #124 aiming, standing
    aimMove: 'Run_Shoot',        // #124 aiming, moving
    fire: 'Gun_Shoot',           // #124 the shot, standing
    fireMove: 'Run_Shoot',       // #124 the shot while moving
  },
};

/**
 * Hit reactions (#124), alternated so two consecutive hits do not look like one.
 *
 * `HitRecieve` is the clip the issue names; `HitRecieve_2` is its only sibling
 * and using it on every other hit is the difference between "pain" and "a GIF".
 */
const HIT_CLIPS = ['HitRecieve', 'HitRecieve_2'];

// #121. The jump clips are from the Quaternius Universal Animation Library, baked
// onto this rig ahead of time so they arrive named for the soldier's bones and
// register exactly like the model's own clips. This table is the one place that
// names them.
//
// The pack has no fall clip and no climb clip at all (recorded on #121), which is
// why there is no `fall` or `climb` entry here rather than a silent omission.
export const LIBRARY_CLIPS = {
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
};
const LIBRARY_FILE = './assets/player-jump.clips.json';

/**
 * Airborne clip names (#82), most specific first, first match wins.
 *
 * THIS IS THE ONE PLACE TO FIX THE NAMES. The player rig ships no jump, fall or
 * land clip of its own. `Jump_Start` and `Jump_Land` come from #121's library;
 * the pack has no fall clip, so falling holds `Jump_Loop`, the airborne loop it
 * does have. `Fall` stays first so a real fall clip would win if the rig ever
 * gets one, and `Jump` stays last as the one-clip-covers-both fallback the issue
 * allows. What the issue does NOT allow is a run cycle mid-air, which is why the
 * fallback when nothing matches is idle.
 */
const AIR_CLIPS = {
  jump: ['Jump_Start', 'Jump'],
  fall: ['Fall', 'Jump_Loop', 'Jump'],
  land: ['Land', 'Jump_Land'],
};

/**
 * Climb clips (#122). A real clip added to the rig later wins automatically
 * because it is listed here. There is NONE today (recorded on #121), so the avatar
 * uses the DOCUMENTED FALLBACK: `Idle_Neutral` as the base pose with a procedural
 * hand-over-hand overlay on top (see `_applyClimbPose`). Not `Jump_Loop` any more:
 * that is an airborne pose and read as falling up a wall.
 */
const CLIMB_CLIPS = ['Climb', 'Climb_Up', 'Climbing'];
const CLIMB_BASE = 'Idle_Neutral';

/**
 * Per-clip playback tuning for the baked library clips. They are long, slow clips
 * made for a game with root motion; here they must never lag behind the physics.
 *   Jump_Start: skip the crouch (the body has already left the ground), play once.
 *   Jump_Land : sped up and played once; moving cuts it short after landMinTime.
 */
const CLIP_TUNING = {
  Jump_Start: { once: true, timeScale: 1.6, startAt: 0.12 },
  Jump_Loop: { timeScale: 1 },
  Jump_Land: { once: true, timeScale: 2.0 },
};
const LIB_NAMES = new Set(Object.values(LIBRARY_CLIPS));

// Bones the rig pass touches. Looked up once, by the same punctuation-blind match
// the hand slot uses (three.js strips the dot: `UpperArm.L` becomes `UpperArmL`).
const RIG_BONES = [
  'Abdomen', 'Neck',
  'UpperArm.L', 'LowerArm.L', 'UpperArm.R', 'LowerArm.R',
  'UpperLeg.L', 'LowerLeg.L', 'UpperLeg.R', 'LowerLeg.R',
  'Foot.L', 'Foot.R',
];

// The baked library jump clips come out twisted on this rig (legs splayed, torso
// pitched, no foot or hip translation), and they also take the arms off the rifle.
// false = leave them unregistered: the avatar stays on the armed idle (rifle held)
// and the legs are posed procedurally in _applyAirPose. true = the old behaviour.
const USE_LIBRARY_AIR = false;

const LAND_TIME = 0.26;   // s the procedural land crouch lasts (scaled by impact)

// Procedural jump arc. The physics launches on the frame jump is pressed, so the
// anticipation crouch cannot come BEFORE take-off without delaying the jump. It is
// shown as the push-off instead: legs start bent and straighten over PUSH_TIME
// while the model is lowered so the boots stay down. Then the knees tuck up toward
// the apex, extend again on the way down, and the landing crouch is as deep as the
// fall was fast.
const PUSH_TIME = 0.1;        // s from crouched to fully extended at take-off
const TUCK_TIME = 0.32;       // s after take-off the knees are fully tucked
const PUSH_FADE = 0.03;       // s to blend into the push crouch (fast: no lag)
const FALL_BLEND = 0.18;      // s to unfold from tuck to the reaching fall pose
const LAND_HARD_SPEED = 14;   // m/s fall speed that earns the full-depth crouch
const LAND_MIN_DEPTH = 0.45;  // crouch depth for a small hop (0..1)
const LAND_RELEASE = 0.12;    // s to stand back up when the land beat is cut short

const AIR_LEG_OUT = 8;     // deg a thigh or shin may splay outward in the air
const LAND_MAX_LEAN = 40;  // deg the torso may pitch forward in a land crouch

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _qm = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();


function findBone(root, wanted){
  const clean = (s) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const target = clean(wanted);
  let found = null;
  root.traverse((o)=> {if (!found && o.isBone && clean(o.name) === target) found = o;});
  return found;
}

function disposeNode(o) {
  if (o.geometry) o.geometry.dispose();
  if (o.skeleton) o.skeleton.dispose();
  if (o.material) {
    if (o.material.map) o.material.map.dispose();
    o.material.dispose();
  }
}

export class Avatar {
  /**
   * @param {THREE.Object3D} parent usually the player's placeholder mesh
   * @param {Function|null} onLoad fired once the model is in the scene
   * @param {Function|null} onFail fired if the model never arrives, so the
   *                        caller can put its placeholder back on screen
   */
  constructor(parent, onLoad = null, onFail = null) {
    this.parent = parent;
    this.onLoad = onLoad;
    this.onFail = onFail;
    this.root = new THREE.Group();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.disposed = false;
    this.armed = false;
    this.moving = false;
    // #124. `aiming` is read from the same input the ADS camera uses, so the body
    // and the camera can never disagree about whether the gun is up.
    this.aiming = false;

    // A one-shot accent (a shot, or a hit reaction) that OWNS THE BODY until its
    // clip ends — the same idea as `_landing`, and for the same reason: `setMoving`
    // runs every frame and would otherwise cut the beat off on the next one.
    //   _accent      true while the beat is up
    //   _accentKind  'fire' | 'hit' — a shot yields to a change in ground speed,
    //                a flinch does not
    //   _accentName  which clip it is, so `finished` can be matched to it
    //   _accentLeft  seconds left on it — the watchdog for a beat whose clip ends
    //                without a `finished` event (missing clip, mixer reset, a
    //                state that ended early). Without it a clamped last frame can
    //                hold the avatar in a shooting pose for the rest of the run.
    this._accent = false;
    this._accentKind = null;
    this._accentName = null;
    this._accentLeft = 0;
    this._hits = 0;             // alternates the two hit reactions

    // Airborne state (#82). `airborne` is the physics truth as last reported,
    // `_landing` means a land beat is still playing and owns the body, so the
    // per-frame setMoving call cannot cut it off on the next frame.
    this.airborne = false;
    this._airKind = null;       // 'jump' | 'fall' — which airborne clip is up
    this._landing = false;
    this._landClipName = null;

    // Climb state (#122). No climb clip exists, so the pose is procedural: a phase
    // that advances with climb speed and a weight that fades the overlay in and out.
    this.climbing = false;
    this._climbSpeed = 0;
    this._climbPhase = 0;
    this._climbW = 0;

    // Rig pass. The baked library clips carry rotations only, but this soldier's
    // boots are separate bones driven by TRANSLATION, so in a jump, land or climb
    // pose the boots would stay where they stood while the legs fold. The rig pass
    // glues them back onto the shins.
    this._rig = null;
    this._feetFollow = false;
    this._baseY = 0;
    this._landAge = 0;

    this._air = { jump: 0, fall: 0, land: 0, push: 0 };   // procedural air pose weights
    this._airAge = 0;          // s since leaving the ground on a jump
    this._pushOff = false;     // jumped from the ground (true) or off a wall (false)
    this._fromWall = false;    // set when a climb ends, read by the next setAirborne
    this._peakFall = 0;        // most negative vertical speed this airtime, m/s
    this._landDepth = 1;       // 0..1, how deep the coming land crouch goes
    this._landTime = LAND_TIME;
    this._landOverlay = false; // procedural land crouch playing over locomotion
    

    this.handSlot = null;
    this.handGrip = null;
    this._pendingHand = [];

    parent.add(this.root);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => this._onLoaded(gltf),
      undefined,
      (err) => {
        console.error('avatar load failed', err);
        // Hand the placeholder back. Without this a failed model leaves the
        // player invisible forever, which is a worse bug than the pill (#39 #1).
        this.onFail?.();
      },
    );
  }

  _onLoaded(gltf) {
    if (this.disposed) {
      gltf.scene.traverse(disposeNode);
      return;
    }

    const model = gltf.scene;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? PLAYER.height / size.y : 1;

    model.scale.setScalar(scale);
    model.position.y = -PLAYER.height * 0.5 - box.min.y * scale;
    model.rotation.y = Math.PI;

    model.traverse((o) => {
      if (o.isMesh) {
        const old = o.material;
        o.material = new THREE.MeshToonMaterial({
          color: old.color ? old.color.clone() : 0xffffff,
          map: old.map || null,
        });
        o.castShadow = true;
        old.dispose();
      }
    });

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const name = clip.name.replace(CLIP_PREFIX, '');
      this.actions[name] = this.mixer.clipAction(clip);
    }
    if (this.actions.Death) {
      this.actions.Death.setLoop(THREE.LoopOnce, 1);
      this.actions.Death.clampWhenFinished = true;
    }
    // Fetched rather than bundled with the model: a slow or missing file must not
    // hold up the avatar appearing.
    this._loadLibraryClips();

    this.model = model;
    this._baseY = model.position.y;
    this.root.add(model);
    this._setupRig(model);
    this._createHandSlot();

    // The land beat ends when its CLIP ends, not on a timer. Mixer events are
    // the only thing that knows how long a clip is, and #82 is explicit that
    // nothing hand-rolled belongs here ("read the state, play the clip").
    this.mixer.addEventListener('finished', (e) => this._onFinished(e));

    this.play(this._locomotionClip(), 0);
    this.onLoad?.();
  }

  _createHandSlot() {
    const bone = findBone(this.model, HAND_BONE);
    if (!bone) {
      console.warn('avatar: hand bone not found');
      for (const o of this._pendingHand) this.root.add(o);
      this._pendingHand.length = 0;
      return;
    }

    this.root.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(this.root.matrixWorld).invert().multiply(bone.matrixWorld);
    const s = new THREE.Vector3();
    rel.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);

    this.handSlot = new THREE.Group();
    this.handSlot.scale.setScalar(s.x > 0 ? 1 / s.x : 1);
    bone.add(this.handSlot);

    this.handGrip = new THREE.Group();
    this.handGrip.position.copy(HAND_OFFSET);
    this.handGrip.rotation.copy(HAND_ROTATION);
    this.handSlot.add(this.handGrip);

    for (const o of this._pendingHand) this.handGrip.add(o);
    this._pendingHand.length = 0;
  }

  attachToHand(object) {
    if (this.handGrip) this.handGrip.add(object);
    else this._pendingHand.push(object);
  }

  detachFromHand(object) {
    const i = this._pendingHand.indexOf(object);
    if (i !== -1) this._pendingHand.splice(i, 1);
    object.removeFromParent();
  }

  /**
   * Registers the baked library clips (#121) so `play('Jump_Start')` works like
   * any other clip. Failure is not fatal: the avatar keeps the clips it has and
   * whatever state wanted a jump falls back to locomotion, which beats a
   * half-loaded character.
   */
  _loadLibraryClips() {
    if (!USE_LIBRARY_AIR) return;
    fetch(LIBRARY_FILE)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((list) => {
        if (this.disposed || !this.mixer) return;
        for (const raw of list) {
          const clip = THREE.AnimationClip.parse(raw);
          this.actions[clip.name] = this.mixer.clipAction(clip);
        }
        // The clips arrive after the avatar does, so a jump taken before this
        // point played the idle fallback. Re-play the state the player is
        // actually in rather than leaving them idling through the air.

        if (this.climbing) this._enterClimb();
        else if (this.airborne) this._playOrIdle(this._airClip(this._airKind), ANIM.airBlend);
      })
      .catch((err) => {
        console.warn(`[avatar] library clips unavailable (${err.message}) - jump states will use locomotion`);
      });
  }

  /**
   * Which clip the ground state asks for (#124).
   *
   * Four answers, not two: aiming changes the pose standing AND moving, and this
   * rig ships a clip for each. `aim`/`aimMove` are absent on the unarmed set, so
   * an unarmed avatar ignores the flag rather than falling through to a gun pose
   * it has no business playing.
   */
  _locomotionClip() {
    const set = this.armed ? CLIPS.armed : CLIPS.unarmed;
    if (this.moving) return (this.aiming && set.aimMove) || set.move;
    return (this.aiming && set.aim) || set.idle;
  }

  _idleClip() {
    return this.armed ? CLIPS.armed.idle : CLIPS.unarmed.idle;
  }

  /** First candidate for `kind` that this rig actually ships, or null. */
  _airClip(kind) {
    for (const name of AIR_CLIPS[kind]) if (this.actions[name]) return name;
    return null;
  }

  /**
   * A real climb clip, or null when the overlay should be used. Only a rig with no
   * `Idle_Neutral` to pose falls back to holding `Jump_Loop` (the old behaviour).
  */
  _climbClip(){
    for (const name of CLIMB_CLIPS) if (this.actions[name]) return name;
    if (!this.actions[CLIMB_BASE] && this.actions.Jump_Loop) return 'Jump_Loop';
    return null;
  }

  setArmed(armed) {
    this.armed = armed;
    if (this.airborne || this._landing || this.climbing || this._accent) return;   // the air state owns the body
    this.play(this._locomotionClip());
  }

  /**
   * Aim pose (#124). Called every frame with the same flag the ADS camera gets,
   * so raising the gun and raising the camera are one gesture.
   *
   * The early return is not an optimisation: `play()` is a no-op for the clip
   * already up, but this runs at frame rate and there is no reason to ask it 60
   * times a second.
   */
  setAiming(aiming) {
    if (this.aiming === aiming) return;
    this.aiming = aiming;
    if (this.airborne || this._landing || this.climbing || this._accent) return;
    this.play(this._locomotionClip(), ANIM.aimBlend);
  }

  /**
   * One shot (#124). A short accent, not a state: the legs keep doing whatever
   * they were doing, because a shot that stops you running reads as a stutter.
   *
   * That is why the moving answer is `Run_Shoot` and not `Gun_Shoot`: this rig
   * has no bone masks to layer a clip onto, so the only way to keep the legs
   * running is to play a clip that already has them running. The pack ships the
   * combination, so `Gun_Shoot` is used standing where the legs are idle anyway.
   */
  fire() {
    const set = this.armed ? CLIPS.armed : null;
    if (!set || this._ownsSpecial()) return;
    this._beat(this.moving ? set.fireMove : set.fire, ANIM.fireBlend, 'fire');
  }

  /** A hit landed (once per hit). Alternate the two reactions (#124). */
  hit() {
    if (this._ownsSpecial()) return;
    const name = HIT_CLIPS[this._hits++ % HIT_CLIPS.length];
    this._beat(this.actions[name] ? name : HIT_CLIPS[0], ANIM.hitBlend, 'hit');
  }

  /** True while a state with a better claim on the body is up. */
  _ownsSpecial() {
    return this.airborne || this._landing || this.climbing;
  }

  /**
   * Play `name` as a one-shot that owns the body until it ends (#124).
   *
   * Deliberately NOT `play()`: that returns early when the clip is already the
   * current one, so holding the trigger would fire the first shot and then show
   * nothing while the accent ran out. An accent restarts.
   */
  _beat(name, fade, kind) {
    const action = this.actions[name];
    if (!action) return;               // a rig without the clip just does not flinch

    action.setLoop(THREE.LoopOnce, 1);
    // NOT clamped: a clamped accent holds its last frame forever if its `finished`
    // event is ever missed, which is exactly the "stuck in a pose" failure #124
    // rules out. The watchdog below is the belt to this pair of braces.
    action.clampWhenFinished = false;
    action.reset().fadeIn(fade).play();
    if (this.current && this.current !== action) this.current.fadeOut(fade);
    this.current = action;

    this._accent = true;
    this._accentKind = kind;
    this._accentName = name;
    this._accentLeft = action.getClip().duration + fade;
  }

  /** End the accent and hand the body back to whatever state is current. */
  _endAccent() {
    if (!this._accent) return;
    this._accent = false;
    this._accentKind = null;
    this._accentName = null;
    this._accentLeft = 0;
    // A jump may have started while the accent was finishing; the air state wins
    // and `setAirborne` will put its own clip up. Only the ground state comes back.
    if (this._ownsSpecial()) return;
    this.play(this._locomotionClip(), ANIM.blend);
  }

  /**
   * Ground animation. Called every frame, which is why it must not fight the
   * air states: while airborne or landing, it only records the intent and gets
   * out of the way. Without that the very next frame after a jump would put the
   * run cycle back on, and the airborne pose would be a single frame long.
   */
  setMoving(moving) {
    const changed = this.moving !== moving;
    this.moving = moving;
    // Moving cuts a land beat short once its low point has passed, so landing
    // never makes the player wait for a clip while the physics lets them run.
    if (this._landing && moving && this._landAge >= ANIM.landMinTime) this._endLand();
    if (this.airborne || this._landing || this.climbing) return;

    // A shot in flight is not a reason to keep the legs still: swap to the variant
    // that matches the new ground speed instead of waiting the accent out (#124).
    // A flinch is the one accent that DOES hold the body — being hit staggers you.
    if (changed && this._accent && this._accentKind === 'fire') {
      this.fire();
      return;
    }

    if (this._accent) return;
    this.play(this._locomotionClip());
  }

  /**
   * Report whether the player is on a green wall (#122). Call every frame, BEFORE
   * setAirborne and setMoving: both defer to a climb that is already active.
   *
   * A read, not a simulation. Entering takes the body from any air state or
   * unfinished land beat; leaving lets the air and ground states pick the next
   * clip on the same frame, so a wall-jump exit lands on the jump clip and a
   * top-out lands on locomotion.
   *
   * @param {boolean} climbing       player.climbing
   * @param {number} [verticalSpeed] player.velocity.y, +up; negative plays the
   *                                 clip backwards, so up and down differ
  */
  setClimbing(climbing, verticalSpeed = 0) {
    this._climbSpeed = verticalSpeed;
    if (climbing) {
      if (!this.climbing) {
        this.climbing = true;
        this.airborne = false;
        this._airKind = null;
        this._landing = false;
        this._landClipName = null;
        this._climbPhase = 0;
        this._enterClimb();
      }
      const name = this._climbClip();
      if (name) this.actions[name].timeScale = verticalSpeed < -ANIM.riseSpeed ? -1 : 1;
      return;
    }

    if (this.climbing) {
      this.climbing = false;
      this._fromWall = true;   // a wall-jump has no floor to push off
      const name = this._climbClip();
      if (name) this.actions[name].timeScale = 1;
    }
  }

  /** A real climb clip if the rig has one, else the idle base the overlay poses. */
  _enterClimb() {
    this._playOrIdle(this._climbClip() ?? CLIMB_BASE, ANIM.airBlend);
  }

  /**
   * Report what the physics already knows (#82). Call every frame.
   *
   * This is a READ, not a simulation: nothing here integrates velocity or times
   * a fall. `grounded` comes from the player controller, `verticalSpeed` only
   * separates rising from falling so the two get different clips when the rig
   * has them.
   *
   * @param {boolean} grounded    player.onGround
   * @param {number} [verticalSpeed] player.velocity.y, +up
   */
  setAirborne(grounded, verticalSpeed = 0) {
    if (this.climbing) return;

    if (!grounded) {
      const kind = verticalSpeed > ANIM.riseSpeed ? 'jump' : 'fall';
      // remember the hardest fall speed so the landing crouch can match it
      this._peakFall = Math.min(this._peakFall ?? 0, verticalSpeed);
      // Re-decide only when the answer CHANGES: this runs at frame rate and
      // reset() would restart the clip 60 times a second.
      if (this.airborne && this._airKind === kind) return;
      if (!this.airborne) {
        // leaving the ground (or a wall): start the jump arc from the beginning
        this._airAge = 0;
        this._pushOff = kind === 'jump' && !this._fromWall;
        this._fromWall = false;
        this._landOverlay = false;   // jumping again: the crouch eases out
      }
      this.airborne = true;
      this._airKind = kind;
      this._landing = false;            // a new jump cancels an unfinished land
      this._landClipName = null;
      // ...and a shot or a flinch (#124): the air state owns the body from here,
      // so the accent must not be left believing it still does.
      this._accent = false;
      this._accentName = null;
      this._accentLeft = 0;
      this._playOrIdle(this._airClip(kind), ANIM.airBlend);
      return;
    }

    const wasAirborne = this.airborne;
    this.airborne = false;
    this._airKind = null;
    this._fromWall = false;
    if (wasAirborne) {
      // a hop barely bends the knees, a long drop sinks deep and takes longer
      const impact = THREE.MathUtils.clamp(-(this._peakFall ?? 0) / LAND_HARD_SPEED, 0, 1);
      this._landDepth = LAND_MIN_DEPTH + (1 - LAND_MIN_DEPTH) * impact;
      this._landTime = LAND_TIME * (0.8 + 0.5 * impact);
      this._land();
      // No land clip: _land() hands straight back to locomotion (the #82 contract),
      // so the crouch is an OVERLAY on top of idle/run with its own short timer.
      // Without this the procedural land pose never showed at all.
      if (!this._landClipName) {
        this._landOverlay = true;
        this._landAge = 0;
      }
    }
    this._peakFall = 0;
  }

  /**
   * The land beat: one shot, no loop, and the body is held for exactly as long
   * as the clip runs. `_endLand` fires from the mixer's `finished` event, so a
   * rig with no land clip simply goes straight back to locomotion.
   */
  _land() {
    const name = this._airClip('land');
    if (!name) {
      this._landing = false;
      this._playOrIdle(null, ANIM.airBlend);
      return;
    }

    const action = this.actions[name];
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    this._landing = true;
    this._landAge = 0;
    this._landClipName = name;
    this.play(name, ANIM.airBlend);  // CLIP_TUNING also speeds the library clip up
  }

  _endLand() {
    this._landing = false;
    this._landClipName = null;
    this.play(this._locomotionClip(), ANIM.airBlend);
  }

  /**
   * Mixer `finished` handler. A land beat and a combat accent (#124) both end
   * here; every other one-shot (Death) leaves both flags false, so it is ignored
   * rather than hijacking a corpse animation.
   */
  _onFinished(e) {
    if (this._landing && e.action === this.actions[this._landClipName]) {
      this._endLand();
      return;
    }
    if (this._accent && e.action === this.actions[this._accentName]) this._endAccent();
  }

  /**
   * Play `name`, or fall back to IDLE when this rig has no such clip.
   *
   * The fallback is idle rather than "whatever was playing" on purpose: leaving
   * the run cycle up reproduces the original bug — sprinting through the air.
   * Idle at least reads as "not running". It still matters now that #121 ships
   * the clips, because that file is fetched and can be missing or slow.
   */
  _playOrIdle(name, fade) {
    this.play(name && this.actions[name] ? name : this._idleClip(), fade);
  }

  play(name, fade = ANIM.blend) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset();
    const tune = CLIP_TUNING[name];
    if (tune) {
      next.setLoop(tune.once ? THREE.LoopOnce : THREE.LoopRepeat, tune.once ? 1 : Infinity);
      next.clampWhenFinished = !!tune.once;
      next.timeScale = tune.timeScale ?? 1;
      next.time = tune.startAt ?? 0;
    }
    next.fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
    this._feetFollow = LIB_NAMES.has(name);
  }

  die() {
    // A death is not an accent (#124): clearing these first means the watchdog
    // cannot hand the body back to a run cycle a third of a second later.
    this._accent = false;
    this._accentName = null;
    this._accentLeft = 0;
    this.play('Death', 0.1);
  }

  update(dt) {
    if (!this.mixer) return;
    // Undo last frame's overlay first. The mixer only rewrites bones the active
    // clip has tracks for; for the rest, an overlay applied on top of the last
    // frame's overlay would pile up and spin the body.
    this._restoreBase();
    this.mixer.update(dt);
    if (this._landing){
      this._landAge += dt;
      if (!this._landClipName && this._landAge >= this._landTime) this._endLand();
    }
    this._updateAccent(dt);
    this._snapshotBase();
    this._rigPass(dt);
  }

  _snapshotBase() {
    const rig = this._rig;
    if (!rig) return;
    for (const n of RIG_BONES) {
      const bone = rig.bones[n];
      if (bone) (rig.base[n] ??= { q: new THREE.Quaternion(), p: new THREE.Vector3() })
        .q.copy(bone.quaternion), rig.base[n].p.copy(bone.position);
    }
  }

  _restoreBase() {
    const rig = this._rig;
    if (!rig) return;
    for (const n of RIG_BONES) {
      const bone = rig.bones[n], b = rig.base[n];
      if (bone && b) { bone.quaternion.copy(b.q); bone.position.copy(b.p); }
    }
  }

  // ---------------------------------------------------------------------------
  // Rig pass: runs AFTER the mixer, so it can adjust what the clips just wrote.
  // ---------------------------------------------------------------------------

  /** Cache the bones and the rest-pose relationship between each shin and boot. */
  _setupRig(model) {
    const bones = {};
    for (const n of RIG_BONES) bones[n] = findBone(model, n);
    const hips = findBone(model, 'Hips');

    this.root.updateMatrixWorld(true);
    _m.copy(this.root.matrixWorld).invert();

    const feet = [];
    for (const side of ['L', 'R']) {
      const foot = bones[`Foot.${side}`];
      const shin = bones[`LowerLeg.${side}`];
      if (!foot || !shin) continue;
      const footPos = foot.getWorldPosition(new THREE.Vector3());
      const posInShin = footPos.clone().applyMatrix4(shin.matrixWorld.clone().invert());
      const rel = shin.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(foot.getWorldQuaternion(new THREE.Quaternion()));
      feet.push({ foot, shin, posInShin, rel, restY: footPos.applyMatrix4(_m).y });
    }
    this._rig = { bones, feet, hips, base: {} };
  }

  /**
   * Rotate `bone` by `deg` around a MODEL-space axis (+X left, +Y up, +Z forward),
   * on top of whatever pose the mixer left. Axis-independent on purpose: this rig's
   * bones have arbitrary local axes, model space does not.
   */
  _rot(bone, axis, deg) {
    if (!bone || !deg) return;
    _q1.setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg));
    this.model.getWorldQuaternion(_qm);
    bone.parent.getWorldQuaternion(_qp);
    // world rotation Rw = M R M^-1, then into the parent's frame: P^-1 Rw P
    _q2.copy(_qm).multiply(_q1).multiply(_q3.copy(_qm).invert());
    _q3.copy(_qp).invert().multiply(_q2).multiply(_qp);
    bone.quaternion.premultiply(_q3);
  }

  _rigPass(dt) {
    const rig = this._rig;
    if (!rig) return;

    // fade the climb overlay in and out; the phase only advances while climbing
    const procedural = this.climbing && !this._climbClip();
    const step = dt / ANIM.climbBlend;
    this._climbW = procedural
      ? Math.min(1, this._climbW + step)
      : Math.max(0, this._climbW - step);
    if (procedural) {
      const f = THREE.MathUtils.clamp(this._climbSpeed / PLAYER.climbSpeed, -1, 1);
      this._climbPhase += (Math.PI * 2 / ANIM.climbCycle) * f * dt;
    }

    const posing = this._climbW > 0;
    const air = this._stepAir(dt);
    const feet = this._feetFollow || posing || air;
    let sink = 0;

    if (posing || feet){
      this.model.updateMatrixWorld(true);
      if (posing) this._applyClimbPose(this._climbW);
      if (air) this._applyAirPose();
      if (!posing && !air && this._feetFollow) this._tidyAirPose();
      if (feet) sink = this._followFeet();
    }

    // plant the feet during a land beat or the take-off push: the knees bend but
    // nothing drops the hips, so the crouch would hover. Lower the model instead.
    const want = (this._landing || this._air.land > 0 || this._air.push > 0) ? sink : 0;
    const y = this._baseY - want;
    this.model.position.y += (y - this.model.position.y) * (1 - Math.exp(-dt * 30));
  }

  /**
   * Ease the procedural air weights toward the current state. Returns true while
   * any of them is non-zero. Land is read straight off its own envelope: a quick
   * drop into the crouch, then a slower recovery.
  */
  _stepAir(dt) {
    const a = this._air;
    const procedural = !this.climbing && !this._climbClip();
    const proceduralAir = procedural && this.airborne && !this._airClip(this._airKind);
    const target = {
      jump: proceduralAir && this._airKind === 'jump' ? 1 : 0,
      fall: proceduralAir && this._airKind === 'fall' ? 1 : 0,
    };

    if (this.airborne) this._airAge += dt;
    const pushing = proceduralAir && this._pushOff && this._airAge < PUSH_TIME;

    // Into the jump fast (the push must not lag the physics); tuck -> fall slower,
    // so the legs unfold over the apex instead of snapping straight.
    const inStep = dt / (pushing ? PUSH_FADE : ANIM.airBlend);
    const crossStep = dt / FALL_BLEND;
    a.jump = target.jump > a.jump ? Math.min(1, a.jump + inStep)
      : Math.max(0, a.jump - (target.fall ? crossStep : dt / ANIM.airBlend));
    a.fall = target.fall > a.fall ? Math.min(1, a.fall + (a.jump > 0 ? crossStep : dt / ANIM.airBlend))
      : Math.max(0, a.fall - dt / ANIM.airBlend);

    // push-off: 1 at take-off, 0 once the legs are straight
    a.push = pushing ? 1 - this._airAge / PUSH_TIME : 0;

    if (this._landOverlay && !this.climbing) {
      // quick drop into the crouch, then an eased (not linear) stand-up
      this._landAge += dt;
      const t = this._landAge;
      const T = this._landTime ?? LAND_TIME;
      const down = 0.06;
      const env = t < down ? t / down
        : 1 - THREE.MathUtils.smoothstep(t, down, T);
      // running out of a landing absorbs the impact but does not squat as deep
      a.land = env * (this._landDepth ?? 1) * (this.moving ? 0.7 : 1);
      if (t >= T) this._landOverlay = false;
    } else {
      this._landOverlay = false;
      // cut short by running: stand up over LAND_RELEASE instead of popping
      a.land = Math.max(0, a.land - dt / LAND_RELEASE);
    }
    return a.jump > 0 || a.fall > 0 || a.land > 0;
    
  }

  /**
   * Legs and torso for jump, fall and land, in model-space degrees on top of the
   * armed idle, so the arms stay holding the rifle. [thigh, shin] per side:
   * negative thigh = knee forward, positive shin = knee folded.
   */

  _applyAirPose() {
    const b = this._rig.bones;
    const { jump, fall, land, push } = this._air;
    const K = { L: [-42, 74], R: [-38, 68] };   // take-off: knees bent, loaded
    const E = { L: [8, 4], R: [10, 6] };        // push-off: legs driven straight
    const T = { L: [-64, 98], R: [-46, 80] };   // apex: knees tucked, left leads
    const F = { L: [-16, 24], R: [-8, 16] };    // falling: legs reach for the ground
    const C = { L: [-58, 96], R: [-52, 88] };   // landing: crouch, slightly staggered

    // Rising pose over time: crouch -> straight -> tuck. `push` runs 1 -> 0 over
    // PUSH_TIME, then `tuck` eases 0 -> 1 until TUCK_TIME.
    const tuck = THREE.MathUtils.smoothstep(this._airAge, PUSH_TIME, TUCK_TIME);
    const lerp = THREE.MathUtils.lerp;
    const rise = (side, i) => {
      const launch = lerp(E[side][i], K[side][i], push);   // crouch straightening
      return lerp(launch, T[side][i], push > 0 ? 0 : tuck);
    };

    for (const side of ['L', 'R']) {
      this._rot(b[`UpperLeg.${side}`], AX, rise(side, 0) * jump + F[side][0] * fall + C[side][0] * land);
      this._rot(b[`LowerLeg.${side}`], AX, rise(side, 1) * jump + F[side][1] * fall + C[side][1] * land);
    }

    // torso: leans into the push, curls a little in the tuck, opens on the way down
    const lean = (10 * push + 4 + 6 * tuck) * jump + 3 * fall + 18 * land;
    this._rot(b.Abdomen, AX, lean);
    this._rot(b.Neck, AX, -0.75 * lean);   // keep the eyes on the horizon
  }
  

  /**
   * The baked library clips were retargeted by copying rotations between two rigs
   * whose bones are rolled differently, so the legs come out splayed sideways and
   * the land crouch pitches the torso far forward. Limit both in model space; clips
   * that are already within the limits are untouched.
   */
  _tidyAirPose() {
    const rig = this._rig;
    const b = rig.bones;

    for (const [side, out] of [['L', 1], ['R', -1]]) {
      const thigh = b[`UpperLeg.${side}`];
      const shin = b[`LowerLeg.${side}`];
      const foot = rig.feet.find((f) => f.shin === shin);
      if (!thigh || !shin || !foot) continue;

      // thigh: hip -> knee, then shin: knee -> ankle
      this._limitAbduction(thigh, this._dir(thigh, shin), out, AIR_LEG_OUT);
      _v.copy(foot.posInShin);
      shin.updateWorldMatrix(true, false);
      _v.applyMatrix4(shin.matrixWorld);
      shin.getWorldPosition(_v2);
      this.model.worldToLocal(_v);
      this.model.worldToLocal(_v2);
      _v.sub(_v2);
      this._limitAbduction(shin, _v, out, AIR_LEG_OUT);
    }

    if (this._landing && b.Abdomen && b.Neck) {
      const hips = rig.hips;
      if (hips) {
        const d = this._dir(hips, b.Neck);
        const lean = THREE.MathUtils.radToDeg(Math.atan2(d.z, d.y));   // + = forward
        if (lean > LAND_MAX_LEAN) this._rot(b.Abdomen, AX, -(lean - LAND_MAX_LEAN));
      }
    }
  }

  /** Model-space direction from bone `a` to bone `b` (a fresh vector). */
  _dir(a, b) {
    const v = a.getWorldPosition(new THREE.Vector3());
    const w = b.getWorldPosition(new THREE.Vector3());
    this.model.worldToLocal(v);
    this.model.worldToLocal(w);
    return w.sub(v);
  }

  /** Swing `bone` about the model Z axis so `dir` leans outward by at most `maxDeg`. */
  _limitAbduction(bone, dir, out, maxDeg) {
    const angle = THREE.MathUtils.radToDeg(Math.atan2(dir.x * out, -dir.y));  // + = outward
    if (angle > maxDeg) this._rot(bone, AZ, -out * (angle - maxDeg));
  }

  /** Hand-over-hand climb. Angles are degrees in model space, scaled by weight `w`. */
  _applyClimbPose(w) {
    const b = this._rig.bones;
    const sL = Math.sin(this._climbPhase);    // left hand: +1 reaching high, -1 pulled down
    const sR = -sL;                           // right hand is half a cycle behind

    // spine: lean into the wall, twist so the reaching shoulder leads, look up
    this._rot(b.Abdomen, AX, 12 * w);
    this._rot(b.Abdomen, AY, -8 * sL * w);
    this._rot(b.Neck, AX, -22 * w);

    for (const [side, s, out] of [['L', sL, 1], ['R', sR, -1]]) {
      // arm: up and forward, a little wide; elbow folds as the hand pulls down
      this._rot(b[`UpperArm.${side}`], AX, -(138 + 30 * s) * w);
      this._rot(b[`UpperArm.${side}`], AZ, -14 * out * w);
      this._rot(b[`LowerArm.${side}`], AX, (35 - 25 * s) * w);

      // leg: cross-crawl, so each leg moves with the OPPOSITE arm. Thigh comes
      // forward and the knee folds on the lifted leg only.
      const l = -s;
      this._rot(b[`UpperLeg.${side}`], AX, -(22 + 24 * l) * w);
      this._rot(b[`LowerLeg.${side}`], AX, (28 + 40 * Math.max(0, l)) * w);
    }
  }

  /**
   * Glue each boot to its shin. Returns how far the lowest boot sits above its
   * standing height (>= 0), which the land beat uses to plant the feet.
   */
  _followFeet() {
    _m.copy(this.root.matrixWorld).invert();
    let lift = Infinity;
    for (const f of this._rig.feet) {
      const parent = f.foot.parent;
      f.shin.updateWorldMatrix(true, false);
      parent.updateWorldMatrix(true, false);

      _v.copy(f.posInShin).applyMatrix4(f.shin.matrixWorld);
      const y = _v.clone().applyMatrix4(_m).y;
      parent.worldToLocal(_v);
      f.foot.position.copy(_v);

      f.shin.getWorldQuaternion(_q1).multiply(f.rel);
      parent.getWorldQuaternion(_q2).invert().multiply(_q1);
      f.foot.quaternion.copy(_q2);

      // `y` already includes the current model drop, so add it back
      lift = Math.min(lift, y - f.restY + (this._baseY - this.model.position.y));
    }
    return Number.isFinite(lift) ? THREE.MathUtils.clamp(lift, 0, 0.45) : 0;
  }

  _updateAccent(dt) {
    // End an accent when its clip duration expires, even if the mixer
    // does not dispatch the finished event.
    if (this._accent && (this._accentLeft -= dt) <= 0) {
      this._endAccent();
    }
  }


  dispose() {
    this.disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.model) this.mixer.uncacheRoot(this.model);
    }
    this.handSlot?.removeFromParent();
    this._pendingHand.length = 0;
    this.parent.remove(this.root);
    this.root.traverse(disposeNode);
  }
}