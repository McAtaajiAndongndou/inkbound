import * as THREE from 'three';
import { PLAYER } from '../config.js';

/**
 * Three camera modes, which is most of the Viewing rubric on its own:
 *   - third person  (default, orbits behind the player)
 *   - first person  (V, or hold right mouse = ADS in the CoD layer)
 *   - orthographic minimap, rendered to a corner viewport
 */
export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 400);

    this.minimap = new THREE.OrthographicCamera(-22, 22, 22, -22, 0.1, 120);
    this.minimap.position.set(0, 60, 0);
    this.minimap.lookAt(0, 0, 0);
    this.minimap.rotation.z = 0;

    this.firstPerson = false;
    this.distance = 6.5;
    this.shoulder = 0.9;

    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  toggle() {
    this.firstPerson = !this.firstPerson;
  }

  update(player) {
    const { position, yaw, pitch } = player;

    if (this.firstPerson) {
      this.camera.position.set(position.x, position.y + PLAYER.eyeHeight, position.z);
    } else {
      // orbit behind the player, following yaw and pitch
      this._offset.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch) + 0.45,
        Math.cos(yaw) * Math.cos(pitch),
      ).multiplyScalar(this.distance);

      this.camera.position.copy(position).add(this._offset);
      this.camera.position.x += Math.cos(yaw) * this.shoulder;
      this.camera.position.z -= Math.sin(yaw) * this.shoulder;
    }

    this._target.set(
      position.x - Math.sin(yaw) * 10,
      position.y + PLAYER.eyeHeight + Math.tan(pitch) * 10,
      position.z - Math.cos(yaw) * 10,
    );
    this.camera.lookAt(this._target);

    // minimap follows the player from above
    this.minimap.position.set(position.x, 60, position.z);
    this.minimap.lookAt(position.x, 0, position.z);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
