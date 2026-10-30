// OWNER: D (Enemies & Combat)
// A raycast that hits a surface from either side (#220).
//
// three.js raycasting honours `material.side`, and a PaintSurface is a
// one-sided plane: a floor faces up, so a ray from BELOW passes through it as
// if it were not there. That is right for drawing (nobody sees a floor's
// underside) and wrong for anything solid — a Wall-crawler under a deck shot
// the player standing on it, and saw them through it.
//
// The flip is synchronous and restored before returning, so the renderer never
// sees a two-sided paint material. The list of flipped materials is reused:
// pellets cast every frame.
import * as THREE from 'three';

const flipped = [];

/** `raycaster.intersectObjects(meshes, false, hits)`, with every face two-sided. */
export function intersectTwoSided(raycaster, meshes, hits) {
  flipped.length = 0;
  for (let i = 0; i < meshes.length; i++) {
    const mat = meshes[i].material;
    if (mat && !Array.isArray(mat) && mat.side === THREE.FrontSide) {
      mat.side = THREE.DoubleSide;
      flipped.push(mat);
    }
  }
  try {
    raycaster.intersectObjects(meshes, false, hits);
  } finally {
    for (let i = 0; i < flipped.length; i++) flipped[i].side = THREE.FrontSide;
    flipped.length = 0;
  }
  return hits;
}
