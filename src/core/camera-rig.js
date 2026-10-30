import * as THREE from 'three';
import { PLAYER, CAMERA, SUBMERGE} from '../config.js';
import { Trauma } from './feel.js';

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

    // 0 = standing, 1 = fully submerged. Eased in update(), so the submerge
    // drop and aim dip glide instead of snapping (issue 079).
    this.submergeBlend = 0;

    // Polish audit P1-2: screen shake as trauma. Events add it; see feel.js.
    this.trauma = new Trauma();
  }

  /** Shake the camera: `amount` of trauma, 0..1 (SHAKE in config names the sizes). */
  addTrauma(amount) {
    this.trauma.add(amount);
  }

  /** A short upward flinch (the hurt kick, P0-4). */
  kick(radians) {
    this.trauma.kick(radians);
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

    const submergeTarget = player.submerged ? 1 : 0;
    const blendStep = Math.min(1, SUBMERGE.cameraBlendSpeed * dt);
    this.submergeBlend += (submergeTarget - this.submergeBlend) * blendStep;

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
      // the exception that proves the rule. Scaled by the blend (issue 079).
      this.camera.position.y -= SUBMERGE.cameraOffset * this.submergeBlend;
    }

    // #108 — while submerged, tilt the aim point down a little, so the whole
    // frame reads as "crouched". The camera does not just lower; it aims
    // along a lower angle too. Scaled by the blend (issue 079).
    const lookHeight = PLAYER.eyeHeight - SUBMERGE.maxAngle * this.submergeBlend;
    this._target.set(
      position.x - Math.sin(yaw) * 12,
      position.y + lookHeight + Math.tan(pitch) * 12,
      position.z - Math.cos(yaw) * 12,
    );
    this.camera.lookAt(this._target);

    // Shake AFTER the aim, so it rattles the view without moving where you aim
    // (the gun reads the camera, but trauma is gone in a fraction of a second).
    const shake = this.trauma.update(dt);
    if (shake.x || shake.y || shake.roll || shake.pitch) {
      this.camera.position.x += shake.x;
      this.camera.position.y += shake.y;
      this.camera.rotateZ(shake.roll);
      this.camera.rotateX(shake.pitch);
    }

    // minimap follows the player from above
    this.minimap.position.set(position.x, 60, position.z);
    this.minimap.lookAt(position.x, 0, position.z);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}