import * as THREE from 'three';
import { PAINT, SEALED, PAINT_WET } from '../config.js';
// Height fog lives in shaders/fog-height.js, shared with the toon and outline
// materials so the maths is not written out three times.
import { createFogHeightUniforms, FOG_HEIGHT_PARS, FOG_HEIGHT_FRAGMENT } from './fog-height.js';
// The point-light pool's uniforms and pointLighting() (#195), shared with toon.
import { POINT_LIGHTS_PARS, addPointLightUniforms } from './point-lights.js';

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
 *
 * WET PAINT (#194) — the paint map is also a HEIGHT MAP:
 *
 *  - height   the painted mask (id > 0) filtered smooth across the four nearest
 *             cells, plus a little value noise: 1 inside a blob, falling to 0
 *             at its edge. That is the blob's thickness.
 *  - normal   the gradient of that height (dh/du, dh/dv) tilts the surface
 *             normal along the plane's tangent and bitangent. A blob's rim now
 *             slopes, so light catches it: a height map turned into a bump map.
 *  - gloss    Blinn-Phong specular from the SAME uLightDir as the diffuse
 *             (AGENTS rule 5), on painted cells only.
 *  - mirror   the level's sky, from SkyProbe's cube map, sampled along the
 *             reflected view ray and weighted by Schlick's Fresnel: sky at a
 *             grazing angle, the paint's own colour head-on. Capped by
 *             PAINT_WET.reflectStrength so blue never reads as sky grey.
 *
 * Grey gets none of it. Corp's world is dry; colour is alive and wet.
 */

/**
 * The sky the paint reflects, shared by EVERY paint material on purpose: one
 * SkyProbe per level writes its cube map here, and every surface reads it.
 * (The opposite of the per-material rule for the other uniforms — this one is
 * level-wide state, and sharing is what makes it one write instead of a walk.)
 * `uEnvOn` is 0 until a probe has rendered, so paint is never mixed toward the
 * black of an empty cube map.
 */
export const PAINT_ENV = {
  uEnvMap: { value: null },
  uEnvOn: { value: 0 },
};

/** A config number as a GLSL float literal (`48` must be written `48.0000`). */
const glsl = (n) => n.toFixed(4);

// --- the wet-paint maths in JS (#194) ---------------------------------------
// The same formulas the fragment shader runs, so a test can pin them without a
// GPU. Change one, change both.

const smooth = (f) => f * f * (3 - 2 * f);

/**
 * Paint thickness `h` and its gradient (in texels) at fractional position
 * (fx, fy) between four cell centres whose painted masks are a (0,0), b (1,0),
 * d (0,1) and e (1,1). The shader's paintHeight() without the noise.
 */
export function paintHeight(a, b, d, e, fx, fy) {
  const wx = smooth(fx);
  const wy = smooth(fy);
  const lerp = (p, q, t) => p + (q - p) * t;
  return {
    h: lerp(lerp(a, b, wx), lerp(d, e, wx), wy),
    du: lerp(b - a, e - d, wy) * 6 * fx * (1 - fx),
    dv: lerp(d - a, e - b, wx) * 6 * fy * (1 - fy),
  };
}

/**
 * The Blinn-Phong highlight the shader adds: `n`, `l` (to the light) and `v`
 * (to the eye) are unit vectors as [x, y, z]; `wet` is 0 on grey, 1 on paint.
 */
export function wetSpecular(n, l, v, wet) {
  const h = [l[0] + v[0], l[1] + v[1], l[2] + v[2]];
  const len = Math.hypot(h[0], h[1], h[2]) || 1;
  const nh = Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / len);
  const facing = n[0] * l[0] + n[1] * l[1] + n[2] * l[2] >= 0 ? 1 : 0;
  return Math.pow(nh, PAINT_WET.shininess) * facing * PAINT_WET.specular * wet;
}

/** Schlick's Fresnel times the readability cap: how much sky replaces paint. */
export function wetReflection(cosV, wet) {
  const c = Math.min(1, Math.max(0, cosV));
  const f0 = PAINT_WET.fresnelBase;
  return (f0 + (1 - f0) * Math.pow(1 - c, PAINT_WET.fresnelPower)) * PAINT_WET.reflectStrength * wet;
}

const vertexShader = /* glsl */ `
  // declares the fog varying (vFogDepth) behind #ifdef USE_FOG
  #include <fog_pars_vertex>

  varying vec2  vUv;
  varying vec3  vWorldPos;
  varying vec3  vNormal;
  varying vec3  vTangent;   // world direction of +u  (#194)
  varying vec3  vBitangent; // world direction of +v

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal   = normalize(mat3(modelMatrix) * normal);
    // A PaintSurface is a PlaneGeometry: u runs along local +x, v along +y.
    // Those are the axes the height gradient is measured in.
    vTangent   = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vBitangent = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));

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
  uniform float     uGridStep;   // paint cells per VISIBLE grid square
  uniform float     uUnpaintable; // 1 = sealed face (#156), 0 = open ground
  uniform vec3      uColours[4]; // grey, blue, red, green
  uniform float     uTime;
  uniform vec3      uLightDir;
  uniform samplerCube uEnvMap;   // the level's sky (SkyProbe, #194)
  uniform float     uEnvOn;      // 0 until the probe has rendered
  uniform float     uWet;        // 0..1 gloss + reflection strength

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying vec3 vBitangent;

  ${POINT_LIGHTS_PARS}

  // declares the fog uniforms + vFogDepth behind #ifdef USE_FOG
  #include <fog_pars_fragment>
  // adds uFogFloor / uFogCeil for the height term
  ${FOG_HEIGHT_PARS}

  // read the paint id stored at a given cell
  float paintIdAt(vec2 uv) {
    return floor(texture2D(uPaintMap, uv).r * 255.0 + 0.5);
  }

  // 1 if the cell under uv is painted, 0 if grey
  float paintedAt(vec2 uv) {
    return step(0.5, paintIdAt(uv));
  }

  // --- wet paint: height (#194) --------------------------------------------
  // A cheap value noise, so the top of a blob is not a flat plateau.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // Paint thickness at uv and its gradient in TEXELS: xy = (dh/du, dh/dv), z = h.
  //
  // The four nearest cell centres' painted masks, blended with smoothstepped
  // bilinear weights. Smoothstep rather than linear so the slope is 0 in the
  // middle of a blob and peaks on its rim — and the derivative is analytic,
  // so the gradient costs the same four fetches and nothing more.
  // paintHeight() in this file is the same maths in JS, for the tests.
  vec3 paintHeight(vec2 uv) {
    vec2 p  = uv * uGridSize - 0.5;          // texel-centre coordinates
    vec2 i0 = floor(p);
    vec2 f  = p - i0;
    vec2 texel = 1.0 / uGridSize;
    vec2 c  = (i0 + 0.5) * texel;
    float a = paintedAt(c);
    float b = paintedAt(c + vec2(texel.x, 0.0));
    float d = paintedAt(c + vec2(0.0, texel.y));
    float e = paintedAt(c + texel);
    vec2 w  = f * f * (3.0 - 2.0 * f);
    vec2 dw = 6.0 * f * (1.0 - f);
    float h = mix(mix(a, b, w.x), mix(d, e, w.x), w.y);
    vec2 g  = vec2(mix(b - a, e - d, w.y) * dw.x,
                   mix(d - a, e - b, w.x) * dw.y);

    // Noise rides on top of the paint only (scaled by h), so grey stays flat.
    vec2 q  = uv * uGridSize * ${glsl(PAINT_WET.noiseFreq)};
    float n0 = valueNoise(q);
    float nx = valueNoise(q + vec2(0.5, 0.0)) - n0;
    float ny = valueNoise(q + vec2(0.0, 0.5)) - n0;
    float amp = ${glsl(PAINT_WET.noiseScale)} * h;
    g += amp * vec2(nx, ny) * 2.0 * ${glsl(PAINT_WET.noiseFreq)};
    return vec3(g, h + amp * n0);
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
    // The VISIBLE grid is deliberately coarser than the paint grid.
    //
    // Paint resolution and readability are two different problems that used to
    // share one number. At 4 cells per metre the paint needs a cell every 25cm,
    // but a 25cm line grid is 64 lines across a 16m corridor -- graph paper, not
    // a readable play space, which is what this grid is for.
    //
    // uGridStep is how many paint cells make one visible square. The line width
    // is divided by the same step so the lines keep a constant width in WORLD
    // units; without that, coarsening the grid would also fatten it.
    vec2 cell = fract(vUv * uGridSize / uGridStep);
    float line = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
    float grid = smoothstep(0.0, 0.06 / uGridStep, line);

    // --- wet paint: the bent normal (#194) --------------------------------
    // Height map -> normal: tilt the surface normal against the height's
    // gradient along the plane's own u and v axes.
    vec3 hgt = paintHeight(vUv);
    float wet = clamp(hgt.z, 0.0, 1.0) * uWet;   // how much of this pixel is wet paint
    vec3 nGeo = normalize(vNormal);
    vec3 n = normalize(nGeo - ${glsl(PAINT_WET.bumpStrength)} * (hgt.x * normalize(vTangent) + hgt.y * normalize(vBitangent)));
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // --- simple diffuse lighting ---------------------------------------
    // The bent normal shades the paint too, so a blob's rim reads as a rim.
    float diffuse = max(dot(n, L), 0.0);
    float light   = 0.35 + 0.65 * diffuse;

    // The pool's point lights (#195): an amber wind-up lights the floor
    // around the enemy, through the bent normal like the sun.
    vec3 colour = base * (light + pulse) + base * pointLighting(n, vWorldPos);
    // 0.75 rather than 0.55: a guide, not a cage. The old value was tuned when
    // there was nothing else on the floor for the lines to compete with.
    colour = mix(colour * 0.75, colour, grid);
    colour += vec3(edge) * (painted ? 0.35 : 0.12);      // bright wet rim

    // --- wet paint: gloss and sky (#194) ----------------------------------
    // Blinn-Phong: the half-vector between light and eye. Painted cells only
    // (wet is 0 on grey), and never on a face turned away from the sun.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), ${glsl(PAINT_WET.shininess)}) * step(0.0, dot(nGeo, L));
    colour += vec3(spec * ${glsl(PAINT_WET.specular)} * wet);

    // Schlick's Fresnel: little reflection head-on, a lot at a grazing angle.
    float cosV = clamp(dot(n, V), 0.0, 1.0);
    float fresnel = ${glsl(PAINT_WET.fresnelBase)} + (1.0 - ${glsl(PAINT_WET.fresnelBase)}) * pow(1.0 - cosV, ${glsl(PAINT_WET.fresnelPower)});
    vec3 sky = textureCube(uEnvMap, reflect(-V, n)).rgb;
    colour = mix(colour, sky, fresnel * ${glsl(PAINT_WET.reflectStrength)} * wet * uEnvOn);

    // --- sealed panels (#156) -------------------------------------------
    // An unpaintable face is Corrupt Corp's SEALED panel, not open ground: the
    // visible grid is broken up into smaller panels with a dark seam along
    // every edge and a rivet at every corner. The difference from a paintable
    // face is TEXTURE and only texture — same grey in, same grey out, just
    // shaded — so it can never be mistaken for a paint colour or for amber.
    // Paintable faces skip this entirely: with uUnpaintable = 0 the branch
    // does nothing, so painted cells look exactly as they did before.
    if (uUnpaintable > 0.5) {
      vec2 panels = fract(vUv * uGridSize / uGridStep * ${SEALED.panelsPerSquare.toFixed(1)});
      vec2 corner = min(panels, 1.0 - panels);           // distance to nearest seam axis
      float seam  = 1.0 - smoothstep(0.0, ${SEALED.seamWidth.toFixed(3)}, min(corner.x, corner.y));
      float rivet = 1.0 - smoothstep(${SEALED.rivetRadius.toFixed(3)}, ${(SEALED.rivetRadius * 2).toFixed(3)}, length(corner));
      colour *= 1.0 - ${SEALED.seamDepth.toFixed(3)} * seam;
      colour += ${SEALED.rivetLift.toFixed(3)} * rivet;
    }

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

export function createPaintMaterial(paintMap, gridCells = 4, unpaintable = false) {
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
  // How many PAINT cells make one VISIBLE grid square. PaintSurface works this
  // out so that one square is one world metre -- see the note there.
  uniforms.uGridStep = { value: Math.max(1, gridCells) };
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
  // #156 — the sealed-face flag. Set at build time and never touched again:
  // which faces are paintable is level data, not something a frame can change.
  uniforms.uUnpaintable = { value: unpaintable ? 1 : 0 };
  // #194 wet paint. uEnvMap/uEnvOn are the SHARED level-wide objects (see
  // PAINT_ENV); uWet is this surface's own (a sealed face is never wet).
  uniforms.uEnvMap = PAINT_ENV.uEnvMap;
  uniforms.uEnvOn  = PAINT_ENV.uEnvOn;
  uniforms.uWet    = { value: unpaintable ? 0 : 1 };
  // #195 — the point-light pool's arrays, shared by reference like uEnvMap.
  addPointLightUniforms(uniforms);

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
