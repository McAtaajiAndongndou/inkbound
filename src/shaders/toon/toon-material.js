import * as THREE from 'three';

const toonVertexShader = `
  // declares the fog varying behind #ifdef USE_FOG
  #include <fog_pars_vertex>

  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // fog needs view-space depth, and modelViewMatrix is already view space,
    // so mvPosition falls out for free here
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const toonFragmentShader = `
  precision highp float;

  uniform vec3 uColour;
  uniform vec3 uLightDir;

  varying vec3 vNormal;

  // declares the fog uniforms plus vFogDepth behind #ifdef USE_FOG
  #include <fog_pars_fragment>

  void main() {
    float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);

    float band;
    if (diffuse > 0.7) band = 1.0;
    else if (diffuse > 0.3) band = 0.6;
    else band = 0.35;

    gl_FragColor = vec4(uColour * band, 1.0);

    // last, so it fades what we already wrote
    #include <fog_fragment>
  }
`;

export function createToonMaterial(hexColour, lightDir = new THREE.Vector3(0.5, 1.0, 0.3)) {
  // Fog uniforms have to live on the material: three.js writes fogColor /
  // fogNear / fogFar / fogDensity into them every frame from scene.fog, and a
  // missing one throws. Cloned so two materials never share one uniform object.
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  uniforms.uColour   = { value: new THREE.Color(hexColour) };
  uniforms.uLightDir = { value: lightDir.clone().normalize() };

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

  void main() {
    vec3 inflated = position + normal * uThickness;

    vec4 mvPosition = modelViewMatrix * vec4(inflated, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const outlineFragmentShader = `
  #include <fog_pars_fragment>

  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);

    // an unfogged black rim would stay black in the distance while the enemy
    // it wraps fades out
    #include <fog_fragment>
  }
`;

export function createOutlineMesh(sourceMesh, thickness = 0.03) {
  const uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  uniforms.uThickness = { value: thickness };

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