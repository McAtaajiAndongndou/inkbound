// OWNER: E (Levels)
//
// The level kit: the building blocks every level is made of.
//
// These started life as private methods on Level01 (`_platform`, `_face`,
// `_pillar`, …). The roadmap's rule was "a shared kit only once the same helper
// has been written twice", and The Ascent is that second time, so they moved
// here unchanged. Level01 now calls these; its own `_face` etc. are one-liners.
//
// THE ONE RULE OF THIS WORLD'S GEOMETRY: everything the player touches is a
// PaintSurface, and a PaintSurface is a ZERO-THICKNESS plane. A floor is one
// plane. A wall is one plane. A "solid" block is four side planes and a top —
// nothing drawn twice, nothing coplanar (that was the z-fighting, #39), and the
// grid IS the object rather than being laid on top of one.
//
// Every helper takes the level first and adds what it builds to `level.root`
// and `level.surfaces`, so the base `dispose()` frees it. `cells` is the paint
// grid density; each level passes its own.
import * as THREE from 'three';
import { PaintSurface } from '../paint/paint-surface.js';
import { Enemy } from '../enemies/enemy.js';
import { ENEMY_CLASSES } from '../enemies/boss.js';
import { ENEMY } from '../config.js';

/**
 * A walkable, horizontal surface with its own footprint.
 *
 * `mark` tags the surface with the band of ground it belongs to (`tower`,
 * `shoulder`, …). Not decoration: the decor scatter assumes a floor's centre
 * line is at x = 0, so a prop handed the wrong floor is placed in mid-air.
 * Levels choose which marks the scatter may use.
 */
export function platform(level, { y = 0, zMin, zMax, xMin, xMax, mark, cells }) {
  const s = new PaintSurface({ width: xMax - xMin, height: zMax - zMin, cells });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set((xMin + xMax) / 2, y, (zMin + zMax) / 2);
  s.mesh.receiveShadow = true;
  s.isFloor = true;
  if (mark) s[mark] = true;
  level.root.add(s.mesh);
  level.surfaces.push(s);
  return s;
}

/**
 * One vertical face: the paint grid standing up.
 *
 * Facing +z by default. `normalX` (±1) turns it a quarter turn to face ±x;
 * `normalZ: -1` turns it round to face −z. The player's wall resolver reads the
 * normal off the mesh quaternion, so the facing is not cosmetic: a face turned
 * the wrong way pushes the player INTO the block instead of out of it.
 *
 * `unpaintable` makes it a solid nobody can paint — and since painting green is
 * what makes a wall climbable, an unpaintable wall is an unclimbable one.
 */
export function face(level, {
  yBase, yTop, z = 0, x = 0, xMin, xMax, zMin, zMax,
  unpaintable = false, normalX = 0, normalZ = 0, cells,
}) {
  const width = normalX ? zMax - zMin : xMax - xMin;
  const s = new PaintSurface({ width, height: yTop - yBase, cells, unpaintable });

  if (normalX) {
    s.mesh.rotation.y = normalX * Math.PI / 2;
    s.mesh.position.set(x, (yBase + yTop) / 2, (zMin + zMax) / 2);
  } else if (normalZ < 0) {
    s.mesh.rotation.y = Math.PI;
    s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
  } else {
    s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
  }

  s.isFloor = false;
  level.root.add(s.mesh);
  level.surfaces.push(s);
  return s;
}

/** An unpaintable band of wall facing +z. Rock is the one thing paint cannot change. */
export function rock(level, { xMin, xMax, yBase, yTop, z, cells }) {
  return face(level, { yBase, yTop, z, xMin, xMax, unpaintable: true, cells });
}

/**
 * A column with three climbable sides (front +z, and ±x) and an overhanging top.
 * The back is left open because a pillar leans on a wall; use `block` for one
 * that stands free.
 *
 * THE OVERHANG IS LOAD-BEARING. A green climb cannot top out on its own: contact
 * is tested at chest height, the climber loses the wall with their feet short of
 * the top, and the jump off is pushed AWAY from the face. The top has to reach
 * past the side or the climb lands on nothing. Measured minimum 0.3 m; Outskirts
 * uses 1 m. A pillar with a flush top is unclimbable however much paint is on it.
 *
 * `yBase` is the floor the pillar stands on (0 in Outskirts; a terrace height
 * on the Ascent). `y` is the height of its top, in world space.
 */
export function pillar(level, {
  xMin, xMax, zMin, zMax, y, yBase = 0, overhang = 0, overhangBack = 0,
  unpaintable = false, mark = 'tower', cells,
}) {
  face(level, { yBase, yTop: y, z: zMax, xMin, xMax, unpaintable, cells });
  for (const [x, normalX] of [[xMin, -1], [xMax, 1]]) {
    face(level, { yBase, yTop: y, x, zMin, zMax, unpaintable, normalX, cells });
  }
  return platform(level, {
    y, zMin: zMin - overhangBack, zMax: zMax + overhang,
    xMin: xMin - overhang, xMax: xMax + overhang,
    mark, cells,
  });
}

/**
 * A free-standing block: a pillar with its fourth (−z) side closed. Without
 * that face the open side is a room you can walk into, under a roof that is a
 * one-sided plane — invisible from below.
 *
 * The top overhangs the back as well, because a free-standing block can be
 * climbed from all four sides. (A pillar's back is against a wall, so it never
 * needed one; the Ascent's raised half was the first paintable block, and the
 * top-out test caught its back face stranding the climber.)
 */
export function block(level, spec) {
  const top = pillar(level, { ...spec, overhangBack: spec.overhang ?? 0 });
  face(level, {
    yBase: spec.yBase ?? 0, yTop: spec.y, z: spec.zMin,
    xMin: spec.xMin, xMax: spec.xMax,
    unpaintable: spec.unpaintable ?? false, normalZ: -1, cells: spec.cells,
  });
  return top;
}

/**
 * The win volume and the faint box that shows where it is.
 * Returns the Box3; the level assigns it to `this.extraction`.
 */
export function extractionZone(level, min, max) {
  const box = new THREE.Box3(min.clone(), max.clone());
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  box.getCenter(marker.position);
  level.root.add(marker);
  return box;
}

/**
 * Point every custom-shaded material at the sun (AGENTS.md rule 5).
 *
 * The paint, toon and outline shaders do not read scene lights; each carries
 * its own `uLightDir`. Two nearly-equal defaults is exactly what drifts apart,
 * so every level sets them from one vector. Call it LAST in load(), after every
 * surface and every decor material exists — a material built after this call
 * is lit from somewhere the ground is not.
 */
export function aimCustomShading(surfaces, materials, sunDir) {
  const dir = new THREE.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize();
  for (let i = 0; i < surfaces.length; i++) {
    const uniform = surfaces[i].material.uniforms?.uLightDir;
    if (uniform) uniform.value.copy(dir);
  }
  for (const material of materials) {
    material.uniforms?.uLightDir?.value.copy(dir);
  }
  return dir;
}

/**
 * Build the enemies from a spawn table: `{ type, x, y, z, sleeping?, wakeOn? }`.
 *
 * Attached under `level.root`, so dispose frees them. Floors and walls are split
 * by `isFloor`: the AI stands on floors and collides with walls, and a wall in
 * the floor list is a floor you stand on top of.
 *
 * Guarded: a throw here would silently leave `enemies` empty, which looks exactly
 * like "the enemies are just not there yet". It logs and returns empty instead,
 * so the level still loads.
 *
 * Returns `{ enemies, sleepers }`; a sleeper is `{ enemy, wakeOn }` and it is the
 * level's job to decide what `wakeOn` means and when to call `enemy.wake()`.
 */
export function spawnEnemies(level, specs, label = 'level') {
  const enemies = [];
  const sleepers = [];
  try {
    const floors = level.surfaces.filter((s) => s.isFloor);
    const walls = level.surfaces.filter((s) => !s.isFloor);
    for (const spec of specs) {
      // A type with its own class (Big Arm) is built by it; every other type
      // is an `Enemy` with its config.
      const Kind = ENEMY_CLASSES[spec.type] ?? Enemy;
      const enemy = new Kind({
        position: new THREE.Vector3(spec.x, spec.y, spec.z),
        config: ENEMY[spec.type] ?? ENEMY.sprayer,
        parent: level.root,
        floors,
        walls,
        sleeping: spec.sleeping === true,
      });
      enemies.push(enemy);
      if (spec.sleeping) sleepers.push({ enemy, wakeOn: spec.wakeOn, wakeDelay: spec.wakeDelay ?? 0 });
    }
  } catch (err) {
    console.error(`[${label}] enemy spawn failed, running without enemies:`, err);
    return { enemies: [], sleepers: [] };
  }
  return { enemies, sleepers };
}

/**
 * Paint a floor rect at load: `rect` is [x0, x1, z0, z1] at floor height `y`.
 * Splatted on a grid fitted to the rect — spacing at most 1 m — with a 0.75 m
 * radius, just over half a cell's diagonal, so the corners are covered. (A
 * fixed 1 m grid left the far edge of the Primer's 2.5 m red pad bare.)
 */
export function paintRect(level, rect, y, colour) {
  const point = new THREE.Vector3();
  const [x0, x1, z0, z1] = rect;
  const nx = Math.ceil(x1 - x0);
  const nz = Math.ceil(z1 - z0);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      point.set(x0 + (x1 - x0) * (i + 0.5) / nx, y, z0 + (z1 - z0) * (j + 0.5) / nz);
      const floor = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - y) < 1e-6 && s.worldToCell(point));
      floor?.splat(point, colour, 0.75);
    }
  }
}

