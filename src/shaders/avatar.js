import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER } from '../config.js';

const MODEL_URL = './assets/soldier-swat.glb';
const CLIP_PREFIX = 'CharacterArmature|';

function disposeNode(o) {
  if (o.geometry) o.geometry.dispose();
  if (o.skeleton) o.skeleton.dispose();
  if (o.material) {
    if (o.material.map) o.material.map.dispose();
    o.material.dispose();
  }
}

export class Avatar {
  constructor(parent, onLoad = null) {
    this.parent = parent;
    this.onLoad = onLoad;
    this.root = new THREE.Group();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.disposed = false;

    parent.add(this.root);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => this._onLoaded(gltf),
      undefined,
      (err) => console.error('avatar load failed', err),
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
    this.play('Idle', 0);
    this.onLoad?.();
  }

  play(name, fade = 0.2) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  setMoving(moving) {
    this.play(moving ? 'Run' : 'Idle');
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
    this.parent.remove(this.root);
    this.root.traverse(disposeNode);
  }
}