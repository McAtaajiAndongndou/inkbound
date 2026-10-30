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

    // #225: the point the third-person camera follows, damped toward the
    // player's position by a critically damped spring. The ORBIT (yaw, pitch)
    // and the aim point both hang off it, so aim never lags the mouse.
    this._pivot = null;
    this._pivotVel = new THREE.Vector3();
    // #225: camera collision against `colliders` (the level's surfaces).
    this.colliders = [];
    this._raycaster = new THREE.Raycaster();
    this._hits = [];
    this._shoulderPt = new THREE.Vector3();
    this._toCam = new THREE.Vector3();
    this._pull = 0;           // m a wall has pulled the camera in: in at once, eased back out
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

  /** The level's surfaces, for camera collision (#225). Main sets it on every load. */
  setColliders(meshes) {
    this.colliders = meshes ?? [];
  }

  /** Forget the follow: the next update snaps to the player (a load, a respawn). */
  snap() {
    this._pivot = null;
    this._pull = 0;
  }

  /**
   * One step of a critically damped spring from `this._pivot` toward `target`
   * (the "SmoothDamp" of Game Programming Gems 4): no overshoot, no lag past
   * `followTime`, and it carries its velocity, so a run reads smooth.
   */
  _follow(target, dt) {
    if (!this._pivot || this._pivot.distanceToSquared(target) > CAMERA.snapDistance ** 2) {
      (this._pivot ??= new THREE.Vector3()).copy(target);
      this._pivotVel.set(0, 0, 0);
      return;
    }
    if (!(dt > 0)) return;
    const omega = 2 / CAMERA.followTime;
    const x = omega * dt;
    const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    for (const axis of ['x', 'y', 'z']) {
      const change = this._pivot[axis] - target[axis];
      const temp = (this._pivotVel[axis] + omega * change) * dt;
      this._pivotVel[axis] = (this._pivotVel[axis] - omega * temp) * k;
      this._pivot[axis] = target[axis] + (change + temp) * k;
    }
  }

  /**
   * Pull the camera in front of the first collider between the shoulder and
   * where it wants to be (#225). In is instant — a frame behind a wall shows
   * its inside — and out eases, so a pillar sliding past does not pump it.
   */
  _collide(dt) {
    const cam = this.camera.position;
    this._toCam.subVectors(cam, this._shoulderPt);
    const want = this._toCam.length();
    if (!(want > 1e-6)) return;
    this._toCam.divideScalar(want);

    let allowed = want;
    if (this.colliders.length > 0) {
      this._raycaster.set(this._shoulderPt, this._toCam);
      this._raycaster.far = want;
      this._hits.length = 0;
      this._raycaster.intersectObjects(this.colliders, false, this._hits);
      if (this._hits.length > 0) {
        allowed = Math.max(CAMERA.collisionMin, this._hits[0].distance - CAMERA.collisionRadius);
      }
    }

    // Ease the PULL, not the distance: the orbit changes the distance too, and
    // easing that would make turning the mouse lag. No wall, no pull, no lag.
    const pull = want - allowed;
    if (pull > this._pull) this._pull = pull;
    else if (dt > 0) this._pull += (pull - this._pull) * (1 - Math.exp(-dt / CAMERA.collisionEaseOut));
    if (this._pull < 1e-4) this._pull = 0;

    cam.copy(this._shoulderPt).addScaledVector(this._toCam, want - this._pull);
  }

  toggle() {
    this.freeFirstPerson = !this.freeFirstPerson;
    this.firstPerson = this.freeFirstPerson || this.aiming;
  }

  setAiming(aiming){
    this.aiming = aiming;
    this.firstPerson = this.freeFirstPerson || this.aiming;
  }

  updateFov(dt, player){
    // #225: third person is wider than first, and wider again while submerged
    // and moving, so the swim reads fast. Aiming and free first person keep theirs.
    const speed = player?.velocity ? Math.hypot(player.velocity.x, player.velocity.z) : 0;
    const swimming = player?.submerged && speed > 0.5;
    const targetFov = this.aiming ? CAMERA.adsFov
      : this.firstPerson ? CAMERA.normalFov
      : CAMERA.tpvFov + (swimming ? CAMERA.submergeFovBoost : 0);

    const change = Math.min(1,CAMERA.adsTransitionSpeed*dt);

    this.camera.fov += (targetFov - this.camera.fov) * change;
    this.camera.updateProjectionMatrix();
  }

  update(player, dt= 1/60) {
    this.updateFov(dt, player);

    const { yaw, pitch } = player;
    // #225: third person follows a damped pivot; first person stays on the eye
    // (a lagging eye is sickening), and keeps the pivot in step for the switch.
    this._follow(player.position, this.firstPerson ? 0 : dt);
    if (this.firstPerson) this._pivot.copy(player.position);
    const position = this._pivot;

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

      // #225: from the shoulder (eye height, offset to the shoulder side), so
      // the player's own body never counts as the wall.
      this._shoulderPt.set(
        position.x + Math.cos(yaw) * this.shoulder,
        position.y + PLAYER.eyeHeight,
        position.z - Math.sin(yaw) * this.shoulder,
      );
      this._collide(dt);
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