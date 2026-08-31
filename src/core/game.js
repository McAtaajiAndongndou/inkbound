// OWNER: A (Core)
// Owns the renderer, the clock, the fixed-step loop and the active level.
// Nothing else should call renderer.render() — this is the only place.

import * as THREE from 'three';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,      // rubric: 3D Effects explicitly lists antialiasing
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

    this.currentLevel = null;
    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
  }

  async init() {
    window.addEventListener('resize', this._onResize);
    this._onResize();

    // --- TEMPORARY smoke-test scene. Delete once level-01 loads. ---
    // This exists so we can build + deploy on day one and prove the
    // server pipeline works before any real content exists.
    this.scene.background = new THREE.Color(0x1a1a1e);
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8888aa, roughness: 0.6 })
    );
    cube.castShadow = true;
    this.scene.add(cube);
    this.smokeTestCube = cube;

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3, 5, 2);
    key.castShadow = true;
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0x404050, 1.5));

    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 0, 0);
    // --- end smoke test ---
  }

  start() {
    this.renderer.setAnimationLoop(this._tick);
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  async loadLevel(LevelClass) {
    // Rubric: "restart without refreshing the page" + memory discipline.
    // Every level MUST implement dispose(). See docs/conventions.md.
    if (this.currentLevel) {
      this.currentLevel.dispose();
      this.currentLevel = null;
    }
    this.currentLevel = new LevelClass(this);
    await this.currentLevel.load();
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05); // clamp: no huge steps after a stall

    if (this.smokeTestCube) {
      this.smokeTestCube.rotation.x += dt * 0.6;
      this.smokeTestCube.rotation.y += dt * 0.9;
    }

    if (this.currentLevel) this.currentLevel.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
