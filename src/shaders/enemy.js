import * as THREE from 'three';
import { ENEMY, PAINT_IDS } from '../config.js';
import { createToonMaterial, addOutline } from './toon/toon-material.js';

export class Enemy {
  constructor(scene, spawnPos = new THREE.Vector3(), type = "sprayer") {
    const cfg = ENEMY[type];

    this.type = type;
    this.hp = cfg.hp;
    this.speed = cfg.speed;
    this.alive = true;

    this._toPlayer = new THREE.Vector3();
    this._knockback = new THREE.Vector3();
    this._pinnedTimer = 0;
    this._slipTimer = 0;

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

    group.userData.enemy = this;

    return group;
  }

  update(dt, playerPos) {
    if (!this.alive) return;

    if (this._pinnedTimer > 0) {
      this._pinnedTimer -= dt;
      return;
    }

    this._toPlayer.copy(playerPos).sub(this.mesh.position);
    this._toPlayer.y = 0;
    const dist = this._toPlayer.length();

    let speed = this.speed;
    if (this._slipTimer > 0) {
      this._slipTimer -= dt;
      speed *= 0.3;
    }

    if (dist > 0.001) {
      this._toPlayer.normalize();
      this.mesh.position.addScaledVector(this._toPlayer, speed * dt);
      this.mesh.lookAt(
        this.mesh.position.x + this._toPlayer.x,
        this.mesh.position.y,
        this.mesh.position.z + this._toPlayer.z,
      );
    }

    if (this._knockback.lengthSq() > 0.0001) {
      this.mesh.position.addScaledVector(this._knockback, dt);
      this._knockback.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
  }

  takeColourHit(colour, damage = 10, sourcePos = null) {
    if (!this.alive) return;

    this.hp -= damage;

    if (colour === PAINT_IDS.blue) {
      this._slipTimer = 1.5;
    } else if (colour === PAINT_IDS.red) {
      this._knockback.copy(this.mesh.position);
      if (sourcePos) {
        this._knockback.sub(sourcePos);
      } else {
        this._knockback.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }
      this._knockback.y = 0;
      this._knockback.normalize().multiplyScalar(6);
    } else if (colour === PAINT_IDS.green) {
      this._pinnedTimer = 1.5;
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.dispose();
    }
  }

  dispose() {
    this.mesh.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this._scene.remove(this.mesh);
  }
}
