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
    this.root.add(model);
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
        if (this.airborne) this._playOrIdle(this._airClip(this._airKind), ANIM.airBlend);
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

  setArmed(armed) {
    this.armed = armed;
    if (this.airborne || this._landing || this._accent) return;   // they own the body
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
    if (this.airborne || this._landing || this._accent) return;
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
    return this.airborne || this._landing;
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
    // A shot in flight is not a reason to keep the legs still: swap to the variant
    // that matches the new ground speed instead of waiting the accent out (#124).
    // A flinch is the one accent that DOES hold the body — being hit staggers you.
    if (changed && this._accent && this._accentKind === 'fire') {
      this.fire();
      return;
    }
    if (this.airborne || this._landing || this._accent) return;
    this.play(this._locomotionClip());
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
    if (!grounded) {
      const kind = verticalSpeed > ANIM.riseSpeed ? 'jump' : 'fall';
      // Re-decide only when the answer CHANGES: this runs at frame rate and
      // reset() would restart the clip 60 times a second.
      if (this.airborne && this._airKind === kind) return;
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
    if (wasAirborne) this._land();
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
    this._landClipName = name;
    this.play(name, ANIM.airBlend);
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
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
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
    if (this.mixer) this.mixer.update(dt);
    // The #124 watchdog: an accent that has run its length is over, whether or
    // not the mixer said so. This is the guarantee behind "no clip can leave the
    // avatar stuck in a pose if its state ends early".
    if (this._accent && (this._accentLeft -= dt) <= 0) this._endAccent();
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