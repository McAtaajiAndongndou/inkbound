import * as THREE from 'three';
import { PAINT } from '../config.js';
// Height fog lives in shaders/fog-height.js, shared with the toon and outline
// materials so the maths is not written out three times.
import { createFogHeightUniforms, FOG_HEIGHT_PARS, FOG_HEIGHT_FRAGMENT } from './fog-height.js';

/**
 * ONE custom ShaderMaterial for every paintable surface.
 *
 * How it works, so everyone can explain it in the demo:
 *
 *  - Paint state is stored in a small DataTexture, one texel per grid cell.
 *    The RED channel holds the paint id (0 grey, 1 blue, 2 red, 3 green).
 *  - The VERTEX shader passes UVs through and computes world position so the
 *    fragment stage can do distance work and lighting.
 *  - The FRAGMENT shader samples that texture, picks the matching colour from
 *    a uniform array, and adds:
 *      * a "wet edge" rim where a painted cell meets an unpainted one
 *      * a slow pulse driven by uTime so painted ground breathes
 *      * a grid line so the play space is readable
 *  - Because paint lives in a TEXTURE, not in geometry, the whole floor is
 *    ONE mesh, ONE material and ONE draw call no matter how much you paint.
 *
 * Uniforms driven by time and game state = the "alive rather than static"
 * requirement in the rubric.
 */

const vertexShader = /* glsl */ `
  // declares the fog varying (vFogDepth) behind #ifdef USE_FOG
  #include <fog_pars_vertex>

  varying vec2  vUv;
  varying vec3  vWorldPos;
  varying vec3  vNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal   = normalize(mat3(modelMatrix) * normal);

    // fog measures distance in VIEW space, so the vertex shader has to keep
    // a mvPosition around for <fog_vertex> to read. This is the one line that
    // changes: viewMatrix * worldPos, then project that.
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uPaintMap;   // r channel = paint id / 255
  uniform vec2      uGridSize;   // cells across, cells down
  uniform vec3      uColours[4]; // grey, blue, red, green
  uniform float     uTime;
  uniform vec3      uLightDir;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // declares the fog uniforms + vFogDepth behind #ifdef USE_FOG
  #include <fog_pars_fragment>
  // adds uFogFloor / uFogCeil for the height term
  ${FOG_HEIGHT_PARS}

  // read the paint id stored at a given cell
  float paintIdAt(vec2 uv) {
    return floor(texture2D(uPaintMap, uv).r * 255.0 + 0.5);
  }

  vec3 colourFor(float id) {
    if (id < 0.5) return uColours[0];
    if (id < 1.5) return uColours[1];
    if (id < 2.5) return uColours[2];
    return uColours[3];
  }

  void main() {
    float id      = paintIdAt(vUv);
    vec3  base    = colourFor(id);
    bool  painted = id > 0.5;

    // --- wet edge -------------------------------------------------------
    // compare against neighbouring cells; if they differ we are on a border
    vec2 texel = 1.0 / uGridSize;
    float edge = 0.0;
    edge += abs(paintIdAt(vUv + vec2( texel.x, 0.0)) - id);
    edge += abs(paintIdAt(vUv + vec2(-texel.x, 0.0)) - id);
    edge += abs(paintIdAt(vUv + vec2(0.0,  texel.y)) - id);
    edge += abs(paintIdAt(vUv + vec2(0.0, -texel.y)) - id);
    edge = clamp(edge, 0.0, 1.0);

    // --- pulse ----------------------------------------------------------
    // painted ground breathes; dead ground does not
    float pulse = painted ? 0.06 * sin(uTime * 2.0 + vWorldPos.x * 0.6 + vWorldPos.z * 0.6) : 0.0;

    // --- grid lines -----------------------------------------------------
    vec2 cell = fract(vUv * uGridSize);
    float line = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
    float grid = smoothstep(0.0, 0.06, line);

    // --- simple diffuse lighting ---------------------------------------
    float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
    float light   = 0.35 + 0.65 * diffuse;

    vec3 colour = base * (light + pulse);
    colour = mix(colour * 0.55, colour, grid);          // darken grid lines
    colour += vec3(edge) * (painted ? 0.35 : 0.12);      // bright wet rim

    gl_FragColor = vec4(colour, 1.0);

    // linear -> output colour space, exactly as #41 did for the toon material.
    // It is not just about matching the enemies: three.js feeds fogColor in
    // OUTPUT space, so without this the fog below would mix an sRGB value into a
    // still-linear one and the ground would fade toward the haze at a different
    // rate than the enemies standing on it. Order matches three.js's own
    // materials: colorspace_fragment, then fog_fragment.
    #include <colorspace_fragment>

    // must come last: it mixes gl_FragColor.rgb toward fogColor using
    // vFogDepth and how high off the floor this pixel is
    ${FOG_HEIGHT_FRAGMENT}
  }
`;

/**
 * Build the DataTexture that stores paint state for a grid.
 * cols/rows are cell counts, not pixels.
 */
export function createPaintMap(cols, rows) {
  const data = new Uint8Array(cols * rows * 4); // RGBA, we only use R
  const texture = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return { texture, data, cols, rows };
}

export function createPaintMaterial(paintMap) {
  // Fog needs its own uniforms (fogColor / fogNear / fogFar / fogDensity) to
  // exist ON the material, because three.js writes into them every frame from
  // scene.fog (refreshFogUniforms). A missing one throws.
  //
  // Clone them rather than spreading THREE.UniformsLib.fog directly, so two
  // surfaces never share one uniform object.
  //
  // DO NOT reach for UniformsUtils.merge() to fold our own uniforms in: it
  // CLONES values, and cloning uPaintMap's texture would leave PaintSurface
  // flipping needsUpdate on a texture the GPU is no longer reading. Paint
  // would silently stop appearing. Add ours by hand instead.
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

  uniforms.uPaintMap = { value: paintMap.texture };
  uniforms.uGridSize = { value: new THREE.Vector2(paintMap.cols, paintMap.rows) };
  uniforms.uColours  = {
    value: [
      new THREE.Color(PAINT.grey.hex),
      new THREE.Color(PAINT.blue.hex),
      new THREE.Color(PAINT.red.hex),
      new THREE.Color(PAINT.green.hex),
    ],
  };
  uniforms.uTime     = { value: 0 };
  uniforms.uLightDir = { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() };

  // Height fog uniforms. These are OURS, so they are not in UniformsLib.fog and
  // have to be added by hand like the others above -- the same rule, for the
  // same reason: they must exist on this material and must not be shared.
  Object.assign(uniforms, createFogHeightUniforms());

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    // `fog: true` is what makes three.js define USE_FOG and feed the uniforms.
    // Without it the #includes above compile to nothing and nothing changes.
    fog: true,
    uniforms,
  });
}
