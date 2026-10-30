// OWNER: E (Levels)
import * as THREE from 'three';
import { LAST_COLOUR, PAINT, PAINT_IDS } from '../config.js';
import * as kit from './level-kit.js';

/**
 * The Siphon (#100): Last Colour's final exam. Not an enemy and not a health
 * bar — a machine taken apart with three colours, in the order the campaign
 * taught them (docs/levels/03-last-colour.md, R5; docs/enemies/algorithms.md).
 *
 *   intake  blue freezes it     one plate, low on the south face
 *   arms    green pins each     three plates on beams, thrashing up and down
 *   core    red knocks it in    one plate, high on the south face
 *
 * A plate is solved by the SHARE of it painted in its colour (the vent's rule,
 * paint-vent.js), read through the public paint API. Damage does nothing, and a
 * wrong colour is only paint to shoot over: no phase can soft-lock.
 *
 * EVERY PHASE: reveal → open → solved.
 *   reveal   the target appears and its frame pulses in the colour it wants;
 *            it refuses paint (wiped every frame). The tell before the test.
 *   open     it takes paint; the frame keeps pulsing until it is solved.
 * A target does not exist before its phase — stowed below the world, out of
 * every paint ray and wall test (the gates' trick) — so nothing can be done
 * out of order or painted in advance.
 *
 * THE LEAK: as a phase opens, the Siphon spills a pool of that phase's colour
 * at its foot. Standing in it refills the tank (it is player paint), so a
 * player who arrives dry can still finish: the exam tests knowledge, not ink.
 *
 * Plates are PaintSurfaces made by the kit, so they are in `level.surfaces`
 * (the gun's ray list) from load. Frames, vanes, beams and the shutter are
 * MeshBasic/MeshToon, so nothing joins the `uLightDir` pass — except the
 * plates, which are paint material: the level re-runs the light pass after
 * building the Siphon (AGENTS rule 5). All of it is under the level root (rule 6).
 */
const STOWED = -100;
const NORMALS = { '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0] };
const COLOUR_OF = { intake: 'blue', arm: 'green', core: 'red' };

export class Siphon {
  /**
   * @param {object} level   the LayoutLevel (root, surfaces, layout cells)
   * @param {object} spec
   * @param {object[]} spec.targets  layout targets: { id, pos, face }
   * @param {number[]} spec.spill    [x, z] centre of the leak on the floor
   * @param {THREE.Object3D} [spec.beacon]  the mast's beacon; it dies at the end
   * @param {() => void} spec.onDone        called once, when the finale ends
   */
  constructor(level, { targets, spill, beacon = null, onDone }) {
    this.cfg = LAST_COLOUR.siphon;
    this.level = level;
    this.spill = spill;
    this.beacon = beacon;
    this.onDone = onDone;
    this.phase = 'dormant';   // dormant → intake → arms → core → finale → done
    this.clock = 0;
    this._t = 0;
    this._pt = new THREE.Vector3();

    this.targets = targets.map((t, i) => this._build(t, i));
    this.byKind = (kind) => this.targets.filter((t) => t.kind === kind);
    this._shutter();
    for (const t of this.targets) this._stow(t);
  }

  /** One plate, its frame, and (for an arm) its beam; (for the intake) its vanes. */
  _build(spec, seed) {
    const cfg = this.cfg;
    const kind = spec.id.includes('intake') ? 'intake' : spec.id.includes('arm') ? 'arm' : 'core';
    const size = cfg[kind].size;
    const n = new THREE.Vector3(...NORMALS[spec.face]);
    const attach = new THREE.Vector3(...spec.pos);
    const home = attach.clone().addScaledVector(n, kind === 'arm' ? cfg.arm.reach : 0.1);
    const h = size / 2;
    const opts = { yBase: home.y - h, yTop: home.y + h, cells: this.level.layout.cells };
    const surf = n.x
      ? kit.face(this.level, { ...opts, x: home.x, zMin: home.z - h, zMax: home.z + h, normalX: n.x })
      : kit.face(this.level, { ...opts, z: home.z, xMin: home.x - h, xMax: home.x + h, normalZ: n.z });
    surf.siphon = spec.id;
    surf.layoutId = spec.id;

    // The frame: a coloured backing just behind the plate, wider by the margin.
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 2 * cfg.frameMargin, size + 2 * cfg.frameMargin),
      new THREE.MeshBasicMaterial({ color: cfg.dim, side: THREE.DoubleSide }),
    );
    frame.quaternion.copy(surf.mesh.quaternion);
    this.level.root.add(frame);

    const t = { id: spec.id, kind, colour: COLOUR_OF[kind], surf, frame, n, attach, home, solved: false, seed };

    if (kind === 'arm') {
      t.beam = new THREE.Mesh(
        new THREE.BoxGeometry(1, cfg.arm.beam, cfg.arm.beam),
        new THREE.MeshToonMaterial({ color: LAST_COLOUR.props.pipe }),
      );
      if (!n.x) t.beam.rotation.y = Math.PI / 2;   // the unit box runs along x
      this.level.root.add(t.beam);
    }
    if (kind === 'intake') {
      t.vanes = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: cfg.vane });
      for (const r of [0, Math.PI / 2]) {
        const vane = new THREE.Mesh(new THREE.BoxGeometry(size * 0.95, 0.18, 0.05), mat);
        vane.rotation.z = r;
        t.vanes.add(vane);
      }
      t.vanes.quaternion.copy(surf.mesh.quaternion);
      this.level.root.add(t.vanes);
    }
    return t;
  }

  /** The grey plate over the core until phase three: you see where it is, not what it is. */
  _shutter() {
    const core = this.byKind('core')[0];
    const size = this.cfg.core.size + 2 * this.cfg.frameMargin;
    this.shutter = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, 0.2),
      new THREE.MeshToonMaterial({ color: LAST_COLOUR.props.barrier }),
    );
    this.shutter.position.copy(core.home).addScaledVector(core.n, 0.2);
    this.shutterY = this.shutter.position.y;
    this.level.root.add(this.shutter);
  }

  _stow(t) {
    t.surf.mesh.position.y = STOWED - 10 * t.seed;   // each its own depth: two stowed plates never share a plane
    t.frame.visible = false;
    if (t.beam) t.beam.visible = false;
    if (t.vanes) t.vanes.visible = false;
  }

  /** Put a target at height `y` (arms move; everything else sits at home). */
  _place(t, y = t.home.y) {
    t.surf.mesh.position.set(t.home.x, y, t.home.z);
    t.surf.mesh.updateMatrixWorld();
    t.frame.position.set(t.home.x, y, t.home.z).addScaledVector(t.n, -0.03);
    t.frame.visible = true;
    if (t.vanes) {
      t.vanes.position.set(t.home.x, y, t.home.z).addScaledVector(t.n, 0.08);
      t.vanes.visible = true;
    }
    if (t.beam) {
      const len = this.cfg.arm.reach;
      t.beam.scale.x = len;
      t.beam.position.copy(t.attach).addScaledVector(t.n, len / 2);
      t.beam.position.y = y;
      t.beam.visible = true;
    }
  }

  /** Remove every drop of paint from a plate. */
  _wipe(t) {
    t.surf.drain(t.surf.mesh.getWorldPosition(this._pt), this.cfg[t.kind].size, Infinity);
  }

  /** Share of the plate's sample grid that is `colour`. */
  share(t, colour = t.colour) {
    const k = this.cfg.samples;
    const { width, height } = t.surf.mesh.geometry.parameters;
    const want = PAINT_IDS[colour];
    let hits = 0;
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        this._pt.set(((i + 0.5) / k - 0.5) * width, ((j + 0.5) / k - 0.5) * height, 0);
        t.surf.mesh.localToWorld(this._pt);
        if (t.surf.paintIdAtWorld(this._pt) === want) hits++;
      }
    }
    return hits / (k * k);
  }

  /** The leak: a pool of `colour` on the floor at the Siphon's foot. */
  _leak(colour) {
    const [cx, cz] = this.spill;
    const r = this.cfg.spillRadius;
    const p = new THREE.Vector3();
    for (let x = cx - r; x <= cx + r; x += 1) {
      for (let z = cz - r; z <= cz + r; z += 1) {
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        p.set(x, 0, z);
        const floor = this.level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y) < 1e-6 && s.worldToCell(p));
        floor?.splat(p, colour, 0.8);
      }
    }
  }

  _enter(phase) {
    this.phase = phase;
    this._t = 0;
    if (phase === 'finale' || phase === 'done') return;
    const kind = phase === 'arms' ? 'arm' : phase;
    for (const t of this.byKind(kind)) {
      this._place(t);
      this._wipe(t);
    }
    this._leak(COLOUR_OF[kind]);
  }

  get revealing() { return this._t < this.cfg.revealFor; }

  /** @param {boolean} ready  the Core is clear: the exam may begin */
  update(dt, ready) {
    this.clock += dt;
    this._t += dt;
    const cfg = this.cfg;

    if (this.phase === 'dormant') {
      if (ready) this._enter('intake');
      return;
    }
    if (this.phase === 'done') return;
    if (this.phase === 'finale') {
      const core = this.byKind('core')[0];
      const k = Math.min(1, this._t / cfg.finaleFor);
      const sink = k * k * cfg.knockDepth;
      const at = core.home.clone().addScaledVector(core.n, -sink);
      core.surf.mesh.position.copy(at);
      core.frame.position.copy(at).addScaledVector(core.n, -0.03);
      if (this.beacon) this.beacon.visible = Math.sin(this._t * 30) > 0 && k < 0.6;
      if (k >= 1) {
        this.phase = 'done';
        if (this.beacon) this.beacon.visible = false;
        this.onDone?.();
      }
      return;
    }

    const kind = this.phase === 'arms' ? 'arm' : this.phase;
    const live = this.byKind(kind);
    if (kind === 'core') this.shutter.position.y = this.shutterY + Math.min(1, this._t / cfg.revealFor) * cfg.core.shutterRise;

    for (const t of live) {
      if (kind === 'arm' && !t.solved) {
        this._place(t, t.home.y + cfg.arm.thrashAmp * Math.sin(this.clock * cfg.arm.thrashRate + t.seed * 2.1));
      }
      if (t.vanes && !t.solved) t.vanes.rotateZ(cfg.intake.vaneSpin * dt);

      if (this.revealing) {
        this._wipe(t);
      } else if (!t.solved && this.share(t) >= cfg.need) {
        t.solved = true;
      }
      // The frame: its colour pulsing while it waits, then what solving it looks like.
      const pulse = Math.sin(this.clock * cfg.pulseRate) > 0;
      const hex = t.solved
        ? (kind === 'intake' ? cfg.frost : kind === 'arm' ? cfg.dim : PAINT.red.hex)
        : (pulse ? PAINT[t.colour].hex : cfg.dim);
      t.frame.material.color.setHex(hex);
    }

    if (!this.revealing && live.every((t) => t.solved)) {
      this._enter(kind === 'intake' ? 'arms' : kind === 'arm' ? 'core' : 'finale');
    }
  }
}
