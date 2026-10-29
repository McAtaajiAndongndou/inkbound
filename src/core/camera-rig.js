import * as THREE from 'three';
import { PLAYER, CAMERA, SUBMERGE} from '../config.js';

/**
 * Three camera modes, which is most of the Viewing rubric on its own:
 *   - third person  (default, orbits behind the player)
 *   - first person  (V, or hold right mouse = ADS in the CoD layer)
 *   - orthographic minimap, rendered to a corner viewport
 */
export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.normalFov,
      aspect,
      0.1,
      400
    );

    this.minimap = new THREE.OrthographicCamera(-22, 22, 22, -22, 0.1, 120);
    this.minimap.position.set(0, 60, 0);
    this.minimap.lookAt(0, 0, 0);
    this.minimap.rotation.z = 0;

    this.firstPerson = false;
    this.freeFirstPerson = false;
    this.aiming = false;

    this.distance = CAMERA.tpvDistance;
    this.shoulder = CAMERA.tpvShoulder;

    this._offset = new THREE.Vector3();
    this._target = new THREE.Vector3();
  }

  toggle() {
    this.freeFirstPerson = !this.freeFirstPerson;
    this.firstPerson = this.freeFirstPerson || this.aiming;
  }

  setAiming(aiming){
    this.aiming = aiming;
    this.firstPerson = this.freeFirstPerson || this.aiming;
  }

  updateFov(dt){
    const targetFov = this.aiming ? CAMERA.adsFov : CAMERA.normalFov;
    
    const change = Math.min(1,CAMERA.adsTransitionSpeed*dt);

    this.camera.fov += (targetFov - this.camera.fov) * change;
    this.camera.updateProjectionMatrix();
  }

  update(player, dt= 1/60) {
    this.updateFov(dt);

    const { position, yaw, pitch } = player;

    if (this.firstPerson) {
      this.camera.position.set(
        position.x,
        position.y + PLAYER.eyeHeight,
        position.z,
      );
    } else {
      // orbit behind the player. pitch is clamped in the player (see look()),
      // so both camera and aim agree on how far up/down we can look.
      this._offset.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch) + CAMERA.tpvHeight,
        Math.cos(yaw) * Math.cos(pitch),
      ).multiplyScalar(this.distance);

      this.camera.position.copy(position).add(this._offset);
      this.camera.position.x += Math.cos(yaw) * this.shoulder;
      this.camera.position.z -= Math.sin(yaw) * this.shoulder;

      // Never let the camera dip below the player's feet. This is the fix
      // for "the camera can look beneath the character" (#34).
      const minY = position.y + CAMERA.minHeightAboveFeet;
      if (this.camera.position.y < minY) this.camera.position.y = minY;
      // #108 — lower the camera while submerged, so the player reads as "in"
      // the paint rather than over it. Applied AFTER the height clamp: a
      // submerged player's feet are the surface, and "in the surface" means
      // below it, deliberately. The clamp is for the standing case; this is
      // the exception that proves the rule.
      if (player.submerged) {
        this.camera.position.y -= SUBMERGE.cameraOffset;
      }
    }

    // #108 — while submerged, tilt the aim point down a little, so the whole
    // frame reads as "crouched". The camera does not just lower; it aims
    // along a lower angle too.
    const lookHeight = player.submerged
      ? PLAYER.eyeHeight - SUBMERGE.maxAngle
      : PLAYER.eyeHeight;
    this._target.set(
      position.x - Math.sin(yaw) * 12,
      position.y + lookHeight + Math.tan(pitch) * 12,
      position.z - Math.cos(yaw) * 12,
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