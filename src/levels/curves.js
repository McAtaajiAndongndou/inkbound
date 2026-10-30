// OWNER: E (Levels)
//
// Curves and surfaces of revolution (#198): the set dressing that stops a level
// reading as stacked boxes.
//
//   cable()   a hose, a power line or a haul cable: a TubeGeometry swept along
//             a CatmullRomCurve3 that sags between its points like a hanging
//             rope (a parabola is close enough to a catenary at these spans)
//   cables()  every cable of one level merged into ONE mesh: twenty tubes would
//             otherwise be twenty draw calls
//   lathe()   a LatheGeometry — one profile of points spun round the y axis —
//             for vats and tanks, instead of stacked cylinders
//
// Built-in MeshToonMaterial throughout: it reads scene lights (and the point
// light pool's real lights, #195), so nothing joins the `uLightDir` pass
// (AGENTS rule 5). Everything goes under `level.root`, so the dispose walk
// frees it (rule 6).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CURVES } from '../config.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * A sagging tube through `points` ([x, y, z] or Vector3).
 *
 * Between each pair of points the cable dips by `sag` metres at the middle,
 * along a parabola sampled CURVES.sagSamples times (always including the
 * midpoint, so the dip is exact there), and a CatmullRomCurve3 runs smoothly
 * through every sample.
 * @returns {THREE.TubeGeometry} — its curve is `geometry.parameters.path`
 */
export function cable(points, radius = CURVES.radius, sag = CURVES.sag) {
  const n = CURVES.sagSamples;   // even, so t = 0.5 is a sample
  const path = [];
  for (let i = 0; i < points.length - 1; i++) {
    _a.set(...toArray(points[i]));
    _b.set(...toArray(points[i + 1]));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const p = _a.clone().lerp(_b, t);
      p.y -= sag * 4 * t * (1 - t);
      path.push(p);
    }
  }
  path.push(new THREE.Vector3(...toArray(points[points.length - 1])));
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  const segments = Math.max(8, Math.round(curve.getLength() * CURVES.segmentsPerMetre));
  return new THREE.TubeGeometry(curve, segments, radius, CURVES.radialSegments, false);
}

/**
 * A level's cables as one mesh — one draw call however many there are.
 * `specs` are `{ points, radius?, sag? }`. The merged geometry is marked
 * `userData.mergedFrom = 'TubeGeometry'` (merging loses the class), with how
 * many it holds, so a test can still see what it is made of.
 */
export function cables(level, specs, colour, name = 'cables') {
  const tubes = specs.map((s) => cable(s.points, s.radius, s.sag));
  const geometry = tubes.length === 1 ? tubes[0] : mergeGeometries(tubes);
  if (tubes.length > 1) for (const t of tubes) t.dispose();
  geometry.userData.mergedFrom = 'TubeGeometry';
  geometry.userData.count = tubes.length;
  // Smooth: a cable is a curve, and the curve is the point (the Corp's
  // machinery is the flat-shaded part, #198).
  const mesh = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({ color: colour }));
  mesh.name = name;
  level.root.add(mesh);
  return mesh;
}

/**
 * Flat-shade a material (#198). Set as a PROPERTY, not a constructor option:
 * MeshToonMaterial has no `flatShading` of its own, so `setValues` would drop
 * it with a warning — but three.js's program cache reads `material.flatShading`
 * for every material, and the toon shader's normal chunk honours FLAT_SHADED
 * (face normals from screen-space derivatives). Toon bands, hard facets.
 */
export function flat(material) {
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

/**
 * A surface of revolution: `profile` is [[radius, y], ...] from the bottom up.
 * Flat-shaded: vats and tanks are Corp machinery (#198, flat versus smooth).
 */
export function lathe(profile, colour) {
  const geometry = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    CURVES.latheSegments,
  );
  return new THREE.Mesh(geometry, flat(new THREE.MeshToonMaterial({ color: colour })));
}

function toArray(p) {
  return Array.isArray(p) ? p : [p.x, p.y, p.z];
}
