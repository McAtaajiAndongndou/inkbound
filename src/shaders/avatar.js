import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER } from '../config.js';

const MODEL_URL = './assets/soldier-swat.glb';
const CLIP_PREFIX = 'CharacterArmature|';

const HAND_BONE = 'Wrist-R';
const HAND_ROTATION = new THREE.Euler(1.557,0.042, 1.393);
const HAND_OFFSET = new THREE.Vector3(0,0.08,0);
const CLIPS = {
  unarmed: {idle: 'Idle', move: 'Run'},
  armed: {idle: 'Idle_Gun_Pointing', move: 'Run_Shoot'},
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

    this.model = model;
    this.root.add(model);
    this._createHandSlot();
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

  _locomotionClip() {
    const set = this.armed ? CLIPS.armed : CLIPS.unarmed;
    return this.moving ? set.move : set.idle;
  }

  setArmed(armed) {
    this.armed = armed;
    this.play(this._locomotionClip());
  }


  play(name, fade = 0.2) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  setMoving(moving) {
    this.moving = moving;
    this.play(this._locomotionClip());
  }

  die() {
    this.play('Death', 0.1);
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
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