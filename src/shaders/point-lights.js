import * as THREE from 'three';
import { POINT_LIGHTS } from '../config.js';

/**
 * POINT LIGHTS THE CUSTOM SHADERS CAN SEE (#195).
 *
 * AGENTS rule 5: the paint and toon materials do their own lighting from one
 * `uLightDir`, so a plain THREE.PointLight lights almost nothing in this game.
 * This pool closes that gap with a FIXED number of slots:
 *
 *   - anything registers a light source with add() and gets a handle back
 *     (an enemy's wind-up, the vent, a beacon — #198 places the level ones)
 *   - each frame, update(camera) picks the `slots` nearest active sources to
 *     the camera and writes them into shared uniform arrays that every paint
 *     and toon material reads (uPointPos / uPointColour / uPointRange)
 *   - the same picks drive `slots` real THREE.PointLights, so built-in
 *     materials (the crusher head, the GLB models) agree with the shaders
 *
 * The light COUNT never changes. Unused slots get intensity 0 rather than being
 * removed: three.js recompiles every built-in material whenever the number of
 * lights in the scene changes, which would stutter mid-fight.
 *
 * Nothing is allocated per frame: sources come from a free list, and the sort
 * reuses one array.
 */

const SLOTS = POINT_LIGHTS.slots;

/**
 * The uniforms every custom material shares, by reference — one write per
 * frame reaches every surface (the same idea as the paint's PAINT_ENV).
 * `uPointColour` is colour × intensity, so an unused slot is black.
 */
export const POINT_LIGHT_UNIFORMS = {
  uPointPos: { value: Array.from({ length: SLOTS }, () => new THREE.Vector3()) },
  uPointColour: { value: Array.from({ length: SLOTS }, () => new THREE.Vector3()) },
  uPointRange: { value: new Array(SLOTS).fill(1) },
};

/**
 * The falloff the shaders use, in JS for the tests: 1 at the source, a smooth
 * curve down to exactly 0 at `range`, and 0 beyond it.
 */
export function pointFalloff(distance, range) {
  const x = Math.min(1, Math.max(0, 1 - (distance * distance) / (range * range)));
  return Math.pow(x, POINT_LIGHTS.falloff);
}

/** GLSL head: the uniform arrays and pointLighting(). Goes after the uniforms. */
export const POINT_LIGHTS_PARS = /* glsl */ `
  uniform vec3  uPointPos[${SLOTS}];
  uniform vec3  uPointColour[${SLOTS}];
  uniform float uPointRange[${SLOTS}];

  // Sum of the pool's lights at a world point: colour x Lambert x falloff.
  // pointFalloff() in shaders/point-lights.js is the same curve in JS.
  vec3 pointLighting(vec3 n, vec3 worldPos) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${SLOTS}; i++) {
      vec3  d    = uPointPos[i] - worldPos;
      float dist = length(d);
      float r    = max(uPointRange[i], 0.0001);
      float x    = clamp(1.0 - (dist * dist) / (r * r), 0.0, 1.0);
      float att  = pow(x, ${POINT_LIGHTS.falloff.toFixed(4)});
      float lambert = max(dot(n, d / max(dist, 0.0001)), 0.0);
      sum += uPointColour[i] * lambert * att;
    }
    return sum;
  }
`;

/** Point a material's uniforms at the shared arrays. */
export function addPointLightUniforms(uniforms) {
  uniforms.uPointPos = POINT_LIGHT_UNIFORMS.uPointPos;
  uniforms.uPointColour = POINT_LIGHT_UNIFORMS.uPointColour;
  uniforms.uPointRange = POINT_LIGHT_UNIFORMS.uPointRange;
  return uniforms;
}

export class PointLightPool {
  constructor(slots = SLOTS) {
    this.slots = slots;
    this.sources = [];        // active handles
    this._free = [];          // released handles, reused by add()
    // The sort buffers: candidate indices and their squared distances. Typed
    // arrays, grown in add() and never per frame — a distance stored on a
    // source object boxed a fresh number every frame (caught by the test).
    this._picks = new Int32Array(8);
    this._dist = new Float64Array(8);
    this._time = 0;
    this.lights = [];
    for (let i = 0; i < slots; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, POINT_LIGHTS.decay);
      light.castShadow = false;
      light.name = `point-light-pool-${i}`;
      this.lights.push(light);
    }
    this._parent = null;
  }

  /** Put the pool's lights in the scene ONCE. They stay for the game's life. */
  attach(parent) {
    if (this._parent === parent) return;
    for (const light of this.lights) parent.add(light);
    this._parent = parent;
  }

  /**
   * Register a light source. `position` is copied; move it later through
   * `handle.position`. `owner` lets a level drop all of its sources at once.
   * @returns the handle: { position, colour, intensity, range, flicker, owner }
   */
  add({ position, colour, intensity = 1, range = POINT_LIGHTS.defaultRange, flicker = 0, owner = null }) {
    const source = this._free.pop() ?? { position: new THREE.Vector3(), colour: new THREE.Color() };
    source.position.copy(position);
    source.colour.set(colour);
    source.intensity = intensity;
    source.range = range;
    source.flicker = flicker;
    source.owner = owner;
    source.active = true;
    this.sources.push(source);
    if (this.sources.length > this._picks.length) {
      this._picks = new Int32Array(this._picks.length * 2);
      this._dist = new Float64Array(this._dist.length * 2);
    }
    return source;
  }

  remove(source) {
    if (!source || !source.active) return;
    source.active = false;
    const i = this.sources.indexOf(source);
    if (i >= 0) this.sources.splice(i, 1);
    this._free.push(source);
  }

  /** Drop every source `owner` registered (a level on dispose). */
  removeOwner(owner) {
    for (let i = this.sources.length - 1; i >= 0; i--) {
      if (this.sources[i].owner === owner) this.remove(this.sources[i]);
    }
    if (this.sources.length === 0) this._blank(0);
  }

  /** Drop everything and blank the uniforms. */
  clear() {
    while (this.sources.length) this.remove(this.sources[this.sources.length - 1]);
    this._blank(0);
  }

  /**
   * Pick the nearest `slots` lit sources to the camera and write them out.
   * Call once a frame, before rendering. `dt` drives the optional flicker.
   */
  update(camera, dt = 0) {
    this._time += dt;
    const eye = camera.position;
    const picks = this._picks;
    const dist = this._dist;
    let count = 0;
    for (let i = 0; i < this.sources.length; i++) {
      const s = this.sources[i];
      if (s.intensity <= 0) continue;
      picks[count] = i;
      dist[i] = s.position.distanceToSquared(eye);
      count++;
    }
    // Insertion sort: a handful of sources, no comparator closure, no garbage.
    for (let i = 1; i < count; i++) {
      const k = picks[i];
      let j = i - 1;
      while (j >= 0 && dist[picks[j]] > dist[k]) { picks[j + 1] = picks[j]; j--; }
      picks[j + 1] = k;
    }

    const pos = POINT_LIGHT_UNIFORMS.uPointPos.value;
    const col = POINT_LIGHT_UNIFORMS.uPointColour.value;
    const range = POINT_LIGHT_UNIFORMS.uPointRange.value;
    const n = Math.min(this.slots, count);
    for (let i = 0; i < n; i++) {
      const s = this.sources[picks[i]];
      const flicker = s.flicker > 0 ? 1 - s.flicker * (0.5 + 0.5 * Math.sin(this._time * POINT_LIGHTS.flickerRate + i * 1.7)) : 1;
      const k = s.intensity * flicker;
      pos[i].copy(s.position);
      col[i].set(s.colour.r * k, s.colour.g * k, s.colour.b * k);
      range[i] = s.range;
      const light = this.lights[i];
      light.position.copy(s.position);
      light.color.copy(s.colour);
      light.intensity = k * POINT_LIGHTS.builtinIntensity;
      light.distance = s.range;
    }
    this._blank(n);
    return n;
  }

  /** Zero every slot from `from` on: intensity 0, never removed. */
  _blank(from) {
    const col = POINT_LIGHT_UNIFORMS.uPointColour.value;
    for (let i = from; i < this.slots; i++) {
      col[i].set(0, 0, 0);
      this.lights[i].intensity = 0;
    }
  }
}

/** The game's one pool. main.js attaches it to the scene and updates it. */
export const pointLights = new PointLightPool();
