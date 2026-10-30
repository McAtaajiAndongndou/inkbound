import * as THREE from "three";

import { DANGER, ENEMY_SHOT, GREY_IMPACT, PLAYER } from "../config.js";
import { intersectTwoSided } from "./two-sided.js";

const FACE_NORMAL = new THREE.Vector3();   // reused: a hit's world-space face normal

/**
 * Enemy pellets (#185; DECISIONS 2026-10-30 "Enemy shots are pellets").
 *
 * A ranged enemy's shot is a visible ball that flies. It can be dodged, it is
 * stopped by the first surface it reaches, and it greys the ground where it
 * lands — so even a miss costs you ground. `onAttack` keeps its meaning ("this
 * enemy's attack hit the player"): for a pellet it fires on contact, which is
 * why main.js did not have to change.
 *
 * ONE POOL PER LEVEL, found through the enemy's `parent` (the level's root), so
 * the levels did not have to be wired: `EnemyShots.for(parent)` makes it on the
 * first ranged enemy and every later one shares it. Meshes live under that
 * root, so they leave the scene with it and the level's dispose traverse frees
 * them; the pool also disposes itself when its last enemy does.
 *
 * WHO STEPS IT: every enemy calls `tick(this, ...)` at the top of its update,
 * and only the pool's current CLOCK enemy actually advances it — so the pellets
 * move exactly once per frame whatever the roster size, and a dead enemy's
 * pellets keep flying (Splatoon does the same) because the clock passes to the
 * next enemy still registered.
 *
 * NOTHING IS ALLOCATED PER SHOT OR PER FRAME. Pellets, their vectors, the
 * raycaster and its hit array are all built once. The materials are
 * MeshBasicMaterial, so they read no light and need no place in the level's
 * light-direction pass (AGENTS rule 5).
 *
 * THE HIT TEST IS SWEPT: at 30 m/s a pellet moves 0.5 m a frame, more than the
 * player's radius, so a point test would let it pass through. Each frame the
 * segment from last position to this one is tested against the surfaces (a
 * ray) and against the player's capsule (segment-to-segment distance), and the
 * nearer wins. A pellet that reaches a wall before the player stops at the wall.
 */

const POOLS = new WeakMap();   // parent Object3D -> EnemyShots
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const DEG = Math.PI / 180;
// Pellets are effects, not targets: the player's gun, sight lines and anything
// else that raycasts the level root must never pick one.
const noRaycast = () => {};

export class EnemyShots {
  /** The level's pool: made on first ask, shared after. */
  static for(parent) {
    let pool = POOLS.get(parent);
    if (!pool || pool.disposed) {
      pool = new EnemyShots(parent);
      POOLS.set(parent, pool);
    }
    return pool;
  }

  constructor(parent) {
    this.parent = parent;
    this.disposed = false;
    this.random = Math.random;   // swappable, so a test can turn the spread off
    this._enemies = new Set();   // registered enemies; the clock is one of them
    this._clock = null;

    const r = ENEMY_SHOT.radius;
    this._ballGeometry = new THREE.SphereGeometry(r, 10, 8);
    this._rimGeometry = new THREE.SphereGeometry(r * ENEMY_SHOT.rimScale, 10, 8);
    // A unit-length streak along +Y, its base at the origin; scaled and turned
    // per pellet to trail behind it.
    this._trailGeometry = new THREE.CylinderGeometry(r * 0.6, r * 0.15, 1, 6, 1, true);
    this._trailGeometry.translate(0, 0.5, 0);
    this._ballMaterial = new THREE.MeshBasicMaterial({ color: ENEMY_SHOT.colour });
    // The rim: an amber shell drawn from the inside only, so it shows as an
    // outline round the grey ball — grey alone vanishes against a grey world.
    this._rimMaterial = new THREE.MeshBasicMaterial({ color: DANGER.amber, side: THREE.BackSide });
    this._trailMaterial = new THREE.MeshBasicMaterial({
      color: DANGER.amber,
      transparent: true,
      opacity: ENEMY_SHOT.trailOpacity,
      depthWrite: false,
    });

    this.group = new THREE.Group();
    this.group.name = "enemy-shots";
    parent?.add?.(this.group);

    this.pellets = [];
    for (let i = 0; i < ENEMY_SHOT.poolSize; i++) {
      const mesh = new THREE.Mesh(this._ballGeometry, this._ballMaterial);
      const rim = new THREE.Mesh(this._rimGeometry, this._rimMaterial);
      const trail = new THREE.Mesh(this._trailGeometry, this._trailMaterial);
      mesh.raycast = noRaycast;
      rim.raycast = noRaycast;
      trail.raycast = noRaycast;
      mesh.add(rim);
      mesh.add(trail);
      mesh.visible = false;
      this.group.add(mesh);
      this.pellets.push({
        active: false,
        owner: null,
        mesh,
        trail,
        pos: mesh.position,           // alias, not a copy
        prev: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        travelled: 0,
        range: 0,
      });
    }
    this._next = 0;

    this._raycaster = new THREE.Raycaster();
    this._hits = [];
    this._seg = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._hitPoint = new THREE.Vector3();
    this._feet = new THREE.Vector3();
    this._trailDir = new THREE.Vector3();
  }

  /** Pellets in the air right now. */
  get activeCount() {
    let n = 0;
    for (let i = 0; i < this.pellets.length; i++) if (this.pellets[i].active) n++;
    return n;
  }

  register(enemy) {
    this._enemies.add(enemy);
  }

  /** An enemy is gone for good. The last one out disposes the pool. */
  release(enemy) {
    this._enemies.delete(enemy);
    if (this._clock === enemy) this._clock = null;
    if (this._enemies.size === 0) this.dispose();
  }

  /**
   * Called by every registered enemy, every frame. Only the clock enemy moves
   * the pellets, so they advance once per frame.
   */
  tick(enemy, dt, playerPos) {
    if (this.disposed) return;
    if (this._clock === null) this._clock = enemy;
    if (enemy !== this._clock) return;
    this.update(dt, playerPos);
  }

  /**
   * Fire one pellet from `muzzle` at `target`, at `speed`. Aimed so a target
   * that stays still is hit despite the drop; nothing leads a moving one.
   */
  fire(owner, muzzle, target, speed) {
    if (this.disposed || !(speed > 0)) return null;
    const p = this.pellets[this._next];
    this._next = (this._next + 1) % this.pellets.length;

    const dir = this._dir.subVectors(target, muzzle);
    const dist = dir.length();
    if (!(dist > 1e-4)) return null;
    dir.divideScalar(dist);

    // The spread: a small random cone, so a burst is three shots and not one.
    const spread = ENEMY_SHOT.spreadDeg * DEG;
    if (spread > 0) {
      const yaw = (this.random() * 2 - 1) * spread;
      const pitch = (this.random() * 2 - 1) * spread;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x = dir.x * cy + dir.z * sy;
      const z = -dir.x * sy + dir.z * cy;
      dir.set(x, dir.y + pitch, z).normalize();
    }

    p.vel.copy(dir).multiplyScalar(speed);
    // Drop compensation: over a flight of t = dist / speed the pellet falls
    // g·t²/2; launching it g·t/2 faster upward cancels that at the target.
    p.vel.y += 0.5 * ENEMY_SHOT.gravity * (dist / speed);

    // World matrices, once per shot: a level built a moment ago (every test,
    // and the first frame of a load) has never been rendered, so its surfaces
    // still sit at the origin — the same trap the sight line guards (#109).
    const meshes = owner._shotMeshes;
    for (let i = 0; i < meshes.length; i++) meshes[i].updateWorldMatrix(true, false);

    p.active = true;
    p.owner = owner;
    p.pos.copy(muzzle);
    p.prev.copy(muzzle);
    p.travelled = 0;
    p.range = (owner.config.attackRange ?? dist) * ENEMY_SHOT.rangeFactor;
    p.mesh.visible = true;
    p.trail.scale.set(1, 0.001, 1);
    return p;
  }

  update(dt, playerPos) {
    if (this.disposed || !(dt > 0)) return;
    const hasPlayer = playerPos && Number.isFinite(playerPos.x)
      && Number.isFinite(playerPos.y) && Number.isFinite(playerPos.z);

    for (let i = 0; i < this.pellets.length; i++) {
      const p = this.pellets[i];
      if (!p.active) continue;

      p.prev.copy(p.pos);
      p.vel.y -= ENEMY_SHOT.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);

      const seg = this._seg.subVectors(p.pos, p.prev);
      const len = seg.length();
      if (!(len > 1e-6)) continue;

      // --- surfaces: the first one along the segment ---
      let surfaceT = Infinity;
      let surfaceHit = null;
      const meshes = p.owner._shotMeshes;
      if (meshes.length > 0) {
        this._dir.copy(seg).divideScalar(len);
        this._raycaster.set(p.prev, this._dir);
        this._raycaster.far = len;
        this._hits.length = 0;
        // Two-sided (#220): a pellet rising into a floor's underside stops
        // there; a one-sided floor let it through to the player standing on it.
        intersectTwoSided(this._raycaster, meshes, this._hits);
        if (this._hits.length > 0) {
          surfaceHit = this._hits[0];
          surfaceT = surfaceHit.distance / len;
        }
      }

      // --- the player's capsule, along the same segment ---
      let playerT = Infinity;
      if (hasPlayer) {
        const t = segmentToAxis(p.prev, seg, playerPos, PLAYER.height,
          PLAYER.radius + ENEMY_SHOT.radius);
        if (t >= 0) playerT = t;
      }

      if (playerT <= surfaceT && playerT !== Infinity) {
        this._hitPoint.copy(p.prev).addScaledVector(seg, playerT);
        this._hitPlayer(p, playerPos);
        continue;
      }
      if (surfaceHit) {
        // From behind (the underside of a floor), the shot just stops: the
        // paint is on the other side, and greying it would grey the player's
        // floor from beneath.
        this._hitPoint.copy(surfaceHit.point);
        if (!surfaceHit.face || FACE_NORMAL.copy(surfaceHit.face.normal).transformDirection(surfaceHit.object.matrixWorld).dot(this._dir) < 0) {
          p.owner._greyImpact(this._hitPoint, surfaceHit.object.userData.paintSurface);
        }
        this._retire(p);
        continue;
      }

      p.travelled += len;
      if (p.pos.y < PLAYER.killY) {
        this._retire(p);
        continue;
      }
      if (p.travelled >= p.range) {
        this._spend(p);
        continue;
      }

      // The trail points back along the flight, and grows to its full length
      // over the first few frames rather than poking out of the muzzle.
      this._trailDir.copy(seg).divideScalar(-len);
      p.trail.quaternion.setFromUnitVectors(UP, this._trailDir);
      p.trail.scale.set(1, Math.min(ENEMY_SHOT.trailLength, p.travelled), 1);
    }
  }

  /**
   * A pellet touched the player: the attack landed. Grey the ground under
   * their feet as well, so a hit costs ground just as a miss does — the same
   * splat the shot made before pellets existed (#107).
   */
  _hitPlayer(p, playerPos) {
    const owner = p.owner;
    this._retire(p);
    if (owner.config.greyRadius && owner._shotMeshes.length > 0) {
      this._feet.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
      this._raycaster.set(this._feet, DOWN);
      this._raycaster.far = 0.5 + GREY_IMPACT.reach;
      this._hits.length = 0;
      this._raycaster.intersectObjects(owner._shotMeshes, false, this._hits);
      if (this._hits.length > 0) {
        owner._greyImpact(this._hits[0].point, this._hits[0].object.userData.paintSurface);
      }
    }
    owner.onAttack?.(owner);
  }

  /**
   * Out of range. The drop is gentle, so a pellet that missed on flat ground is
   * often still a metre up when its range runs out — and a miss must still cost
   * ground. A spent pellet falls straight down: if there is a surface within
   * `ENEMY_SHOT.spentDrop` below it, that greys; over a pit, nothing does.
   */
  _spend(p) {
    const owner = p.owner;
    this._retire(p);
    if (!owner.config.greyRadius || owner._shotMeshes.length === 0) return;
    this._raycaster.set(p.pos, DOWN);
    this._raycaster.far = ENEMY_SHOT.spentDrop;
    this._hits.length = 0;
    this._raycaster.intersectObjects(owner._shotMeshes, false, this._hits);
    if (this._hits.length > 0) {
      owner._greyImpact(this._hits[0].point, this._hits[0].object.userData.paintSurface);
    }
  }

  _retire(p) {
    p.active = false;
    p.owner = null;
    p.mesh.visible = false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = 0; i < this.pellets.length; i++) this._retire(this.pellets[i]);
    this.group.removeFromParent();
    this._ballGeometry.dispose();
    this._rimGeometry.dispose();
    this._trailGeometry.dispose();
    this._ballMaterial.dispose();
    this._rimMaterial.dispose();
    this._trailMaterial.dispose();
    this._enemies.clear();
    this._clock = null;
    if (POOLS.get(this.parent) === this) POOLS.delete(this.parent);
  }
}

/**
 * Where along segment `a + s·seg` (s in 0..1) it first comes within `radius`
 * of the vertical axis from `feet` up `height` — the player's capsule. Returns
 * that `s`, or -1 if it never does. Scalars only: nothing is allocated.
 *
 * The distance from a point moving in a straight line to a segment is convex
 * along the line, so a ternary search finds the nearest approach and a
 * bisection the entry point. A few dozen evaluations of a handful of
 * multiplies, once per pellet per frame.
 */
export function segmentToAxis(a, seg, feet, height, radius) {
  const rx = a.x - feet.x, ry = a.y - feet.y, rz = a.z - feet.z;
  const r2 = radius * radius;
  if (axisDist2(0, rx, ry, rz, seg, height) <= r2) return 0;

  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (axisDist2(m1, rx, ry, rz, seg, height) < axisDist2(m2, rx, ry, rz, seg, height)) hi = m2;
    else lo = m1;
  }
  const nearest = (lo + hi) * 0.5;
  if (axisDist2(nearest, rx, ry, rz, seg, height) > r2) return -1;

  // Inside at `nearest`, outside at 0: bisect for the entry.
  lo = 0;
  hi = nearest;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) * 0.5;
    if (axisDist2(mid, rx, ry, rz, seg, height) <= r2) hi = mid; else lo = mid;
  }
  return hi;
}

/** Squared distance from the point `s` along the segment to the axis 0..height. */
function axisDist2(s, rx, ry, rz, seg, height) {
  const x = rx + seg.x * s;
  const y = ry + seg.y * s;
  const z = rz + seg.z * s;
  const dy = y < 0 ? y : (y > height ? y - height : 0);
  return x * x + dy * dy + z * z;
}
