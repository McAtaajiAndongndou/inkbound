import * as THREE from 'three';
import { PAINT_WET } from '../config.js';
import { PAINT_ENV } from './paint-material.js';

/**
 * SKY PROBE (#194): the cube map wet paint reflects.
 *
 * A CubeCamera photographs the level's sky in six directions into a small cube
 * render target, and every paint material samples it through ONE shared
 * uniform (PAINT_ENV). That is an environment map, the classic way to fake a
 * reflection without tracing anything.
 *
 * It renders ONLY the level's `atmosphere` group (the sky dome and its mist),
 * by passing that group to the cube camera as the thing to draw. Two reasons
 * it is the group and not the scene with a layer mask:
 *   - the level's root is not in the scene yet while load() runs, and
 *   - the sky is all a puddle of paint should mirror; the walls would cost
 *     six full scene renders for a reflection nobody can read at 64 px.
 *
 * It renders once when built and again only when something calls refresh()
 * (the dynamic sky, #197, when its colours have moved). Never per frame.
 *
 * Dispose contract (AGENTS rule 6): dispose() frees the render target and
 * hands the shared uniform back to "no sky", if it is still ours.
 */
export class SkyProbe {
  /**
   * @param {object} opts
   * @param {THREE.Object3D} opts.atmosphere  the level's sky group
   * @param {THREE.WebGLRenderer} [opts.renderer]  absent in node tests: then
   *        nothing renders and the paint simply has no sky to mirror
   * @param {number} [opts.size]  px per cube face
   */
  constructor({ atmosphere, renderer = null, size = PAINT_WET.envSize }) {
    this.atmosphere = atmosphere;
    this.renderer = renderer;
    this.target = new THREE.WebGLCubeRenderTarget(size, { generateMipmaps: false });
    this.camera = new THREE.CubeCamera(PAINT_WET.envNear, PAINT_WET.envFar, this.target);
    this.camera.position.set(0, PAINT_WET.envHeight, 0);
    this.renders = 0;
    this.refresh();
  }

  /** Re-photograph the sky. Cheap (a dome and a few quads), but not per frame. */
  refresh() {
    if (!this.renderer || !this.atmosphere) return;
    // The dome may be hidden (the minimap pass, the viewer's fog toggle).
    const visible = this.atmosphere.visible;
    this.atmosphere.visible = true;
    this.camera.update(this.renderer, this.atmosphere);
    this.atmosphere.visible = visible;
    this.renders += 1;
    PAINT_ENV.uEnvMap.value = this.target.texture;
    PAINT_ENV.uEnvOn.value = 1;
  }

  dispose() {
    if (PAINT_ENV.uEnvMap.value === this.target.texture) {
      PAINT_ENV.uEnvMap.value = null;
      PAINT_ENV.uEnvOn.value = 0;
    }
    this.target.dispose();
    this.renderer = null;
  }
}
