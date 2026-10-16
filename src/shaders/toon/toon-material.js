import * as THREE from 'three';
// Height fog, shared with the paint material so the maths lives in one place.
import { createFogHeightUniforms, FOG_HEIGHT_PARS, FOG_HEIGHT_FRAGMENT } from '../fog-height.js';

const toonVertexShader = `
  // declares the fog varying behind #ifdef USE_FOG
  #include <fog_pars_vertex>

  varying vec3 vNormal;

  // height fog needs to know how HIGH this pixel is, in world space
  varying vec3 vWorldPos;

  void main() {
    // THE INSTANCE TRANSFORM IS NOT FREE, and this shader used to be missing it.
    //
    // three.js applies instanceMatrix inside its own project_vertex chunk,
    // behind #ifdef USE_INSTANCING. A custom ShaderMaterial that builds its own
    // mvPosition — which this one does, so that fog_vertex has the view-space
    // depth it needs — replaces that chunk and therefore loses the instance
    // transform entirely.
    //
    // The failure is completely silent. USE_INSTANCING is still defined, the
    // draw call is still issued, and the renderer still reports every triangle;
    // the only symptom is that ALL instances render on top of each other at the
    // mesh's own origin. L1's decor is 377 InstancedMesh instances, so it looked
    // like one tree floating in an empty level instead of a dressed forest.
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif

    // The normal has to take the same transform, or a rotated instance is lit as
    // though it were not rotated. Same order as three.js's <defaultnormal_vertex>:
    // instance first, then the normal matrix.
    vec3 localNormal = normal;
    #ifdef USE_INSTANCING
      localNormal = mat3(instanceMatrix) * localNormal;
    #endif
    vNormal = normalize(normalMatrix * localNormal);

    vWorldPos = (modelMatrix * localPosition).xyz;

    // fog needs view-space depth, and modelViewMatrix is already view space,
    // so mvPosition falls out for free here
    vec4 mvPosition = modelViewMatrix * localPosition;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const toonFragmentShader = `
  precision highp float;

  uniform vec3 uColour;
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // declares the fog uniforms plus vFogDepth behind #ifdef USE_FOG
  #include <fog_pars_fragment>
  // adds uFogFloor / uFogCeil for the height term
  ${FOG_HEIGHT_PARS}

  void main() {
    float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);

    float band;
    if (diffuse > 0.7) band = 1.0;
    else if (diffuse > 0.3) band = 0.6;
    else band = 0.35;

    gl_FragColor = vec4(uColour * band, 1.0);

    // From #41: linear -> output colour space. This has to come BEFORE the fog,
    // which is the order three.js's own materials use (colorspace_fragment,
    // then fog_fragment). three.js feeds fogColor in OUTPUT space, so mixing it
    // into a still-linear value would blend two different scales.
    #include <colorspace_fragment>

    // last, so it fades what we already wrote
    ${FOG_HEIGHT_FRAGMENT}
  }
`;

export function createToonMaterial(hexColour, lightDir = new THREE.Vector3(0.5, 1.0, 0.3)) {
  // Fog uniforms have to live on the material: three.js writes fogColor /
  // fogNear / fogFar / fogDensity into them every frame from scene.fog, and a
  // missing one throws. Cloned so two materials never share one uniform object.
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  uniforms.uColour   = { value: new THREE.Color(hexColour) };
  uniforms.uLightDir = { value: lightDir.clone().normalize() };
  // ours rather than three.js's, so added by hand -- same rule as above
  Object.assign(uniforms, createFogHeightUniforms());

  return new THREE.ShaderMaterial({
    vertexShader: toonVertexShader,
    fragmentShader: toonFragmentShader,
    // without this, three.js never defines USE_FOG and every fog include
    // above compiles to nothing
    fog: true,
    uniforms,
  });
}

const outlineVertexShader = `
  #include <fog_pars_vertex>

  uniform float uThickness;

  // height fog needs world height here too, so the black rim fades with the
  // enemy it wraps instead of staying solid
  varying vec3 vWorldPos;

  void main() {
    vec3 inflated = position + normal * uThickness;

    // same missing instance transform as the toon shader above, same silent
    // failure — see the long note there before removing this
    vec4 localPosition = vec4(inflated, 1.0);
    #ifdef USE_INSTANCING
      localPosition = instanceMatrix * localPosition;
    #endif

    vWorldPos = (modelMatrix * localPosition).xyz;

    vec4 mvPosition = modelViewMatrix * localPosition;
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const outlineFragmentShader = `
  #include <fog_pars_fragment>

  varying vec3 vWorldPos;

  ${FOG_HEIGHT_PARS}

  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);

    // an unfogged black rim would stay black in the distance while the enemy
    // it wraps fades out
    ${FOG_HEIGHT_FRAGMENT}
  }
`;

export function createOutlineMesh(sourceMesh, thickness = 0.03) {
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  uniforms.uThickness = { value: thickness };
  Object.assign(uniforms, createFogHeightUniforms());

  const material = new THREE.ShaderMaterial({
    vertexShader: outlineVertexShader,
    fragmentShader: outlineFragmentShader,
    fog: true,
    uniforms,
    side: THREE.BackSide,
  });

  const outline = new THREE.Mesh(sourceMesh.geometry, material);
  outline.name = 'outline';
  return outline;
}

export function addOutline(mesh, thickness = 0.03) {
  const outline = createOutlineMesh(mesh, thickness);
  mesh.add(outline);
  return outline;
}

export function removeOutline(mesh) {
  const outline = mesh.getObjectByName('outline');
  if (outline) {
    outline.geometry.dispose();
    outline.material.dispose();
    mesh.remove(outline);
  }
}

export const GREY_TOON = 0x94949c;

export function createGreyToonMaterial() {
  return createToonMaterial(GREY_TOON);
}