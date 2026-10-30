import * as THREE from 'three';
import { FROST } from '../../config.js';
import { FROST_SCENE } from './frost-material.js';

/**
 * FROST PASS (#196): the scene copy that frost shells refract.
 *
 * Once a frame, before the main render:
 *   1. is any frost shell visible AND inside the camera's frustum?
 *   2. no  -> do nothing at all (no render, uRefract = 0). The effect is free
 *            whenever nothing is frozen on screen.
 *   3. yes -> hide the shells, render the scene into a WebGLRenderTarget at
 *            FROST.sceneScale of the screen, show them again. The shells then
 *            sample that texture in the main pass.
 *
 * Shells register themselves with trackShell() (the enemy does, when it builds
 * one) so this never walks the scene graph.
 *
 * Dispose contract (AGENTS rule 6): dispose() frees the target. main.js calls
 * it when a level unloads; the next shell on screen builds a fresh one.
 */

/** Every live frost shell mesh. An array, so the per-frame loops make no iterator. */
export const frostShells = [];

export function trackShell(mesh) {
  if (!frostShells.includes(mesh)) frostShells.push(mesh);
}
export function untrackShell(mesh) {
  const i = frostShells.indexOf(mesh);
  if (i >= 0) frostShells.splice(i, 1);
}

const _frustum = new THREE.Frustum();
const _viewProj = new THREE.Matrix4();
const _size = new THREE.Vector2();
const _p = new THREE.Vector3();
const _sphere = new THREE.Sphere();
// Screen discs of the visible shells this frame: x, y (NDC), radius (NDC), distance.
const MAX_ICE = 16;
const _ice = new Float32Array(MAX_ICE * 4);

/** True if the mesh and every ancestor are visible (a dead enemy hides its body). */
function shown(mesh) {
  for (let o = mesh; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class FrostPass {
  constructor({ scale = FROST.sceneScale } = {}) {
    this.scale = scale;
    this.target = null;
    this.renders = 0;      // scene copies made, for the tests and the PR numbers
    this._hidden = [];     // shells hidden for the copy, reused
  }

  /** Any tracked shell visible and on screen for `camera`? */
  anyOnScreen(camera) {
    if (frostShells.length === 0) return false;
    camera.updateMatrixWorld();
    _viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProj);
    for (let i = 0; i < frostShells.length; i++) {
      const mesh = frostShells[i];
      if (!shown(mesh)) continue;
      mesh.updateWorldMatrix(true, false);
      if (_frustum.intersectsObject(mesh)) return true;
    }
    return false;
  }

  /**
   * Make the scene copy if a shell is on screen. Returns true if it rendered.
   * Call immediately before the main render, with the same scene and camera.
   */
  render(renderer, scene, camera) {
    if (!this.anyOnScreen(camera)) {
      FROST_SCENE.uRefract.value = 0;
      return false;
    }
    renderer.getDrawingBufferSize(_size);
    this.setSize(_size.x, _size.y);

    // What the copy leaves out, and why it is cheap (measured in Last Colour:
    // a full second render was +7 ms, almost all of it CPU):
    //   - the shells themselves — the ice must not refract itself
    //   - every enemy that is NOT frozen. Skinned GLB enemies were ~4 ms of
    //     every render; a frozen enemy stays, because the body bending inside
    //     its own ice is the point. One behind the ice is lost from the copy,
    //     which at a 0.05 UV bend nobody can read.
    //   - the shadow pass and the scene's matrix walk: the copy reuses the
    //     shadow map and world matrices the main render keeps up to date
    //     (stale by at most a frame, inside an image that is bent anyway).
    //   ...EXCEPT an enemy standing behind a shell on screen: the ice replaces
    //   what is behind it with the copy, so leaving that one out would make it
    //   invisible through the ice. Each unfrozen enemy is projected and kept if
    //   it is farther than a shell and inside that shell's screen disc.
    const ice = this._iceDiscs(camera);
    const hidden = this._hidden;
    hidden.length = 0;
    for (let i = 0; i < frostShells.length; i++) {
      const shell = frostShells[i];
      if (shell.visible) {
        shell.visible = false;
        hidden.push(shell);
        continue;
      }
      const body = shell.parent;
      if (!body || !body.visible || this._behindIce(body, camera, ice)) continue;
      body.visible = false;
      hidden.push(body);
    }
    const previous = renderer.getRenderTarget();
    const shadows = renderer.shadowMap;
    const autoShadows = shadows ? shadows.autoUpdate : false;
    const autoMatrices = scene.matrixWorldAutoUpdate;
    if (shadows) shadows.autoUpdate = false;
    scene.matrixWorldAutoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    if (shadows) shadows.autoUpdate = autoShadows;
    scene.matrixWorldAutoUpdate = autoMatrices;
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;

    this.renders += 1;
    FROST_SCENE.uSceneTex.value = this.target.texture;
    FROST_SCENE.uRefract.value = 1;
    return true;
  }

  /** Fill _ice with the screen discs of visible shells; returns how many. */
  _iceDiscs(camera) {
    const k = 1 / Math.tan(THREE.MathUtils.degToRad((camera.fov ?? 60) / 2));
    let n = 0;
    for (let i = 0; i < frostShells.length && n < MAX_ICE; i++) {
      const shell = frostShells[i];
      if (!shell.visible || !shown(shell)) continue;
      if (!shell.geometry.boundingSphere) shell.geometry.computeBoundingSphere();
      _sphere.copy(shell.geometry.boundingSphere).applyMatrix4(shell.matrixWorld);
      const d = _sphere.center.distanceTo(camera.position);
      _p.copy(_sphere.center).project(camera);
      _ice[n * 4] = _p.x;
      _ice[n * 4 + 1] = _p.y;
      _ice[n * 4 + 2] = (_sphere.radius * k) / Math.max(d, 0.01);
      _ice[n * 4 + 3] = d;
      n++;
    }
    return n;
  }

  /** Is `body` on screen behind one of the `count` ice discs? */
  _behindIce(body, camera, count) {
    if (count === 0) return false;
    _p.setFromMatrixPosition(body.matrixWorld);
    _p.y += FROST.bodyRadius;   // the body's middle, not its feet
    const d = _p.distanceTo(camera.position);
    _p.project(camera);
    const reach = (FROST.bodyRadius / Math.max(d, 0.01)) / Math.tan(THREE.MathUtils.degToRad((camera.fov ?? 60) / 2));
    for (let i = 0; i < count; i++) {
      if (d < _ice[i * 4 + 3]) continue;
      const dx = _p.x - _ice[i * 4];
      const dy = _p.y - _ice[i * 4 + 1];
      const r = _ice[i * 4 + 2] + reach;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  /**
   * Size the copy for a `width` x `height` px drawing buffer. Called on window
   * resize, and by render() itself, so a resize is never missed. Builds the
   * target on first use.
   */
  setSize(width, height) {
    FROST_SCENE.uResolution.value.set(width, height);
    const w = Math.max(1, Math.floor(width * this.scale));
    const h = Math.max(1, Math.floor(height * this.scale));
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
      this.target.texture.name = 'frost-scene';
    } else if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
    }
  }

  /** Free the target (level unload). The next shell on screen rebuilds it. */
  dispose() {
    if (this.target) {
      if (FROST_SCENE.uSceneTex.value === this.target.texture) FROST_SCENE.uSceneTex.value = null;
      this.target.dispose();
      this.target = null;
    }
    FROST_SCENE.uRefract.value = 0;
  }
}
