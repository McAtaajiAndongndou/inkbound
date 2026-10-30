import * as THREE from 'three';
import { FROST } from '../../config.js';

// Frost shell: a see-through ice bubble that reads from range.
//   rim     bright where the surface turns away from the camera (fresnel)
//   cracks  diagonal bands across the shell, like ice facets
//   pulse   a slow shimmer, so a frozen enemy looks charged, not static
// uOpacity is the overall strength (0..1); the enemy raises it per blue hit.
//
// REFRACTION (#196). While a shell is on screen, FrostPass renders the scene
// WITHOUT the shells into a half-resolution texture (uSceneTex). The shell
// samples it at its own screen position, offset by its view-space normal: the
// image bends most where you look straight through the ice, and the Fresnel
// rim takes over at the edges. The crack bands kink the offset too, so the
// facets break the picture like real ice. With no shell on screen the pass
// renders nothing, uRefract is 0, and the shell is the additive glow it was.

/**
 * The scene copy every frost shell reads. Shared by reference: FrostPass
 * writes one texture and one resolution, and every shell sees them.
 */
export const FROST_SCENE = {
  uSceneTex: { value: null },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uRefract: { value: 0 },
};

const glsl = (n) => n.toFixed(4);

const frostVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = -mvPosition.xyz;
    vObjPos = position;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const frostFragmentShader = `
  precision highp float;

  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uTime;
  uniform sampler2D uSceneTex;   // the scene without the shells (#196)
  uniform vec2 uResolution;      // drawing-buffer size in px, for gl_FragCoord
  uniform float uRefract;        // 1 while FrostPass rendered uSceneTex this frame

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  void main() {
    vec3 n = normalize(vNormal);
    float fresnel = 1.0 - abs(dot(n, normalize(vViewDir)));
    float rim = pow(fresnel, 2.0);
    float cracks = step(0.55, fract(vObjPos.y * 5.0 + vObjPos.x * 3.0 + uTime * 0.25));
    float pulse = 0.85 + 0.15 * sin(uTime * 6.0);

    float strength = (0.25 + 0.75 * rim + 0.2 * cracks) * pulse * uOpacity;
    vec3 colour = mix(uColour, vec3(1.0), rim * 0.6);
    vec3 glow = colour * clamp(strength, 0.0, 1.0);

    // --- refraction (#196) ----------------------------------------------
    // Bend most head-on (1 - fresnel); a crack facet kinks the offset.
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    vec2 bend = n.xy * (${glsl(FROST.refractStrength)} * (1.0 - fresnel)
                      + ${glsl(FROST.crackKink)} * cracks);
    vec3 behind = texture2D(uSceneTex, clamp(screenUV + bend, 0.001, 0.999)).rgb;
    // Ice tints what it bends; how much of the view the shell takes over
    // follows its strength, so a half-built shell refracts half as much.
    vec3 seen = mix(behind, uColour, ${glsl(FROST.tint)});
    float cover = clamp(uOpacity / ${glsl(FROST.fullCover)}, 0.0, 1.0) * uRefract;

    // Premultiplied "over": rgb is added, alpha is how much of the background
    // the shell replaces. With cover 0 this is exactly the old additive glow.
    gl_FragColor = vec4(seen * cover + glow * (1.0 - cover * ${glsl(FROST.glowUnder)}), cover);
    #include <colorspace_fragment>
  }
`;

export function createFrostMaterial(hexColour, opacity = 0.5) {
  return new THREE.ShaderMaterial({
    vertexShader: frostVertexShader,
    fragmentShader: frostFragmentShader,
    uniforms: {
      uColour: { value: new THREE.Color(hexColour) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      // #196 — shared with FrostPass (see FROST_SCENE), by reference.
      uSceneTex: FROST_SCENE.uSceneTex,
      uResolution: FROST_SCENE.uResolution,
      uRefract: FROST_SCENE.uRefract,
    },
    transparent: true,
    depthWrite: false,
    // ONE, ONE_MINUS_SRC_ALPHA: premultiplied over. alpha 0 adds (the glow),
    // alpha 1 replaces (the refracted view) — one blend mode does both.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
