import * as THREE from 'three';
import { ENEMY } from '../config.js';
import { createToonMaterial, addOutline } from './toon/toon-material.js';

export class Enemy {
  constructor(scene, spawnPos = new THREE.Vector3(), type = 'sprayer') {
    const cfg = ENEMY[type];

    this.type = type;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.alive = true;

    this._toPlayer = new THREE.Vector3();

    this.mesh = this._buildMesh();
    this.mesh.position.copy(spawnPos);
    scene.add(this.mesh);

    this._scene = scene;
  }

  _buildMesh() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const bodyMat = createToonMaterial(0xe0703a);
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

    return group;
  }

  update(dt, playerPos) {
    if (!this.alive) return;

    this._toPlayer.copy(playerPos).sub(this.mesh.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    if (dist > 0.001) {
      this._toPlayer.normalize();
      this.mesh.position.addScaledVector(this._toPlayer, this.speed * dt);
      this.mesh.lookAt(
        this.mesh.position.x + this._toPlayer.x,
        this.mesh.position.y,
        this.mesh.position.z + this._toPlayer.z
      );
    }
  }

  takeColourHit(colour) {
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this._scene.remove(this.mesh);
  }
}