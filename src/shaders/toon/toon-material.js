import * as THREE from 'three';

const toonVertexShader = `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const toonFragmentShader = `
  precision highp float;

  uniform vec3 uColour;
  uniform vec3 uLightDir;

  varying vec3 vNormal;

  void main() {
    float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);

    float band;
    if (diffuse > 0.7) band = 1.0;
    else if (diffuse > 0.3) band = 0.6;
    else band = 0.35;

    gl_FragColor = vec4(uColour * band, 1.0);
  }
`;

export function createToonMaterial(hexColour, lightDir = new THREE.Vector3(0.5, 1.0, 0.3)) {
  return new THREE.ShaderMaterial({
    vertexShader: toonVertexShader,
    fragmentShader: toonFragmentShader,
    uniforms: {
      uColour: { value: new THREE.Color(hexColour) },
      uLightDir: { value: lightDir.clone().normalize() },
    },
  });
}

const outlineVertexShader = `
  uniform float uThickness;

  void main() {
    vec3 inflated = position + normal * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
  }
`;

const outlineFragmentShader = `
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

export function createOutlineMesh(sourceMesh, thickness = 0.03) {
  const material = new THREE.ShaderMaterial({
    vertexShader: outlineVertexShader,
    fragmentShader: outlineFragmentShader,
    uniforms: {
      uThickness: { value: thickness },
    },
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