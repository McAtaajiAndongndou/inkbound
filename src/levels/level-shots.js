// OWNER: E (Levels)
//
// Named camera shots for the level viewer (`src/levels/viewer.html`).
//
// WHY THIS EXISTS. Level bugs are spatial — a tree floating off a floor, a ledge
// out of jump range, a rock through a climb — and reading coordinates in code
// does not show them. The fix loop that kept failing was "I changed the number,
// it should work now" with nobody looking. A shot is a fixed place to look from,
// so the same view can be taken before a fix and after it, and compared.
//
// Two sources, merged in order:
//
//   1. AUTO shots, computed from the level package (spawn, floors, extraction),
//      so every level — stubs included — has something to look at on day one.
//   2. AUTHORED shots, from `static SHOTS` on the level class. The beats a design
//      doc names (a gap, a climb, an arena) deserve a shot each. Static, so the
//      level package that main.js reads gains no field.
//
// A shot is plain data: { name, label, position: [x,y,z], target: [x,y,z], fog? }.
//
// `fog: false` drops the fog AND the level's atmosphere group for that shot,
// exactly as main.js does for the minimap. Level fog is tuned for a camera at
// player height; from 30 m up the whole route renders fully fogged. Player-eye
// shots keep it, because there the fog is part of what is being judged.
import * as THREE from 'three';
import { spawnAim } from './level-base.js';

/** Eye height for the "what the player sees" shots. Close to the third-person rig. */
export const EYE_HEIGHT = 1.7;

/** Vertical field of view the viewer uses; the top shot fits the level to it. */
export const VIEWER_FOV = 60;

const box = new THREE.Box3();
const part = new THREE.Box3();

/**
 * The box around the ROUTE: walkable surfaces, minus backdrop. Floors, not
 * walls — a tall back wall would push the top shot so high the route turns into
 * a strip. Backdrop (`shoulder`, Outskirts' forest shelves) is out for the same
 * reason: it is scenery either side of the route, not somewhere the player goes.
 */
export function levelBounds(level) {
  level.root.updateMatrixWorld(true);
  box.makeEmpty();
  for (const s of level.surfaces) {
    if (!s.isFloor || s.shoulder) continue;
    part.setFromObject(s.mesh);
    box.union(part);
  }
  if (box.isEmpty()) box.setFromCenterAndSize(level.spawn, new THREE.Vector3(10, 1, 10));
  return box.clone();
}

const v = (p) => [round(p.x), round(p.y), round(p.z)];
const round = (n) => Math.round(n * 100) / 100;

/** Shots every level gets for free. */
export function autoShots(level) {
  const bounds = levelBounds(level);
  const centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const spawn = level.spawn.clone();

  // Where the route goes: toward the extraction if there is one, otherwise the
  // middle of the level. Flattened, so the spawn shot looks AHEAD, not down.
  const goal = level.extraction
    ? level.extraction.getCenter(new THREE.Vector3())
    : centre.clone();
  const ahead = new THREE.Vector3(goal.x - spawn.x, 0, goal.z - spawn.z);
  if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
  ahead.normalize();

  const eye = spawn.clone().setY(spawn.y + EYE_HEIGHT);
  // The level's own first-frame aim when it has one (spawnAim, as main.js
  // applies it), so this shot is the frame the player really starts on.
  const look = level.spawnLook
    ? (({ yaw, pitch }) => new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)))(spawnAim(spawn, level.spawnLook))
    : ahead;
  const shots = [
    {
      name: 'spawn',
      label: 'Spawn — player eye',
      position: v(eye),
      target: v(eye.clone().addScaledVector(look, 10)),
    },
  ];

  // Behind and above spawn, looking down the whole route. The "is this a level"
  // shot: if it reads as a blockout from here, it is one.
  const back = spawn.clone().addScaledVector(ahead, -12);
  back.y = bounds.max.y + Math.max(size.x, size.z) * 0.35;
  shots.push({ name: 'overview', label: 'Overview', position: v(back), target: v(centre), fog: false });

  // Straight down, high enough to fit the longer side in the frame. Nudged a
  // hair in z: an orbit camera looking exactly along its up axis spins.
  const half = Math.max(size.x, size.z) / 2;
  const height = half / Math.tan(THREE.MathUtils.degToRad(VIEWER_FOV / 2)) * 1.1;
  shots.push({
    name: 'top',
    label: 'Top-down',
    position: [round(centre.x), round(bounds.max.y + height), round(centre.z + 0.01)],
    target: v(centre),
    fog: false,
  });

  if (level.extraction) {
    // Back along the route and well above the goal: from 8 m and +4 the camera
    // sat inside Outskirts' tower and saw one wall.
    const from = goal.clone().addScaledVector(ahead, -16);
    from.y = goal.y + 10;
    shots.push({ name: 'extraction', label: 'Extraction', position: v(from), target: v(goal) });
  }

  return shots;
}

/** Auto shots, then the level's authored ones. A later name replaces an earlier one. */
export function levelShots(level) {
  const authored = level.constructor?.SHOTS ?? [];
  const byName = new Map();
  for (const shot of [...autoShots(level), ...authored]) byName.set(shot.name, shot);
  return [...byName.values()];
}
