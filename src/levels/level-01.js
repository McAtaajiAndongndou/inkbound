import * as THREE from 'three';
import { PaintSurface } from '../paint/paint-surface.js';

/**
 * Level 1 blockout — "Mission", the learning level.
 *
 * Grey primitives on purpose. Layout first, looks later.
 * Every level exports the same shape: { group, surfaces, dispose }.
 * That contract is what lets the game swap levels without leaking memory.
 */
export function buildLevel1() {
  const group = new THREE.Group();
  const surfaces = [];

  // ---- main floor --------------------------------------------------------
  const floor = new PaintSurface({ width: 40, height: 40, cells: 3 });
  floor.mesh.rotation.x = -Math.PI / 2;
  floor.mesh.receiveShadow = true;
  floor.isFloor = true;
  group.add(floor.mesh);
  surfaces.push(floor);

  // ---- raised platform (jump onto it, or bounce off red paint) ----------
  const platform = new PaintSurface({ width: 10, height: 10, cells: 3 });
  platform.mesh.rotation.x = -Math.PI / 2;
  platform.mesh.position.set(-11, 3, -8);
  platform.isFloor = true;
  group.add(platform.mesh);
  surfaces.push(platform);

  // ---- climbable wall (paint it green, then hold W into it) -------------
  const wall = new PaintSurface({ width: 12, height: 9, cells: 3 });
  wall.mesh.position.set(0, 4.5, -19.9);
  wall.isFloor = false;
  group.add(wall.mesh);
  surfaces.push(wall);

  // ---- ledge at the top of the wall, so climbing goes somewhere ---------
  const ledge = new PaintSurface({ width: 12, height: 6, cells: 3 });
  ledge.mesh.rotation.x = -Math.PI / 2;
  ledge.mesh.position.set(0, 9, -17);
  ledge.isFloor = true;
  group.add(ledge.mesh);
  surfaces.push(ledge);

  // ---- non-paintable scenery: shared geometry + material, one of each ----
  const pillarGeo = new THREE.BoxGeometry(1.6, 6, 1.6);
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x3f3f4a, roughness: 0.85 });
  const pillarPositions = [
    [8, 3, -4], [12, 3, 4], [-6, 3, 6], [4, 3, 10], [-14, 3, 12],
  ];
  for (const [x, y, z] of pillarPositions) {
    const pillar = new THREE.Mesh(pillarGeo, greyMat);
    pillar.position.set(x, y, z);
    pillar.castShadow = true;
    group.add(pillar);
  }

  const scenery = { pillarGeo, greyMat };

  return {
    group,
    surfaces,
    spawn: new THREE.Vector3(0, 2, 12),

    /** REQUIRED. Removing a mesh does not free GPU memory. */
    dispose() {
      for (const s of surfaces) s.dispose();
      scenery.pillarGeo.dispose();
      scenery.greyMat.dispose();
      group.clear();
    },
  };
}
