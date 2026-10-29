import * as THREE from 'three';

// Frost shell: a see-through ice bubble that reads from range.
//   rim     bright where the surface turns away from the camera (fresnel)
//   cracks  diagonal bands across the shell, like ice facets
//   pulse   a slow shimmer, so a frozen enemy looks charged, not static
// uOpacity is the overall strength (0..1); the enemy raises it per blue hit.

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

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vObjPos;

  void main() {
    float fresnel = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
    float rim = pow(fresnel, 2.0);
    float cracks = step(0.55, fract(vObjPos.y * 5.0 + vObjPos.x * 3.0 + uTime * 0.25));
    float pulse = 0.85 + 0.15 * sin(uTime * 6.0);

    float strength = (0.25 + 0.75 * rim + 0.2 * cracks) * pulse * uOpacity;
    vec3 colour = mix(uColour, vec3(1.0), rim * 0.6);

    gl_FragColor = vec4(colour, clamp(strength, 0.0, 1.0));
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
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}