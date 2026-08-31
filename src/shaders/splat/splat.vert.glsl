// OWNER: C (Shaders)
// Passes UV and world position through to the fragment stage so the splat
// buffer can be sampled in the right space.
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
