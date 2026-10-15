// OWNER: E (Levels)
//
// The forest: one shared set of shapes, placed by a hand-written table, and
// re-coloured from the paint grid so the trees wake up where the player paints.
//
// Steps 2 and 3 of LEVEL-1-FOREST-POLISH.md, with the hooks step 5 (instanced
// models) needs already in place.
//
// Three rules this module exists to keep true, all of them in the test file:
//
//   1. Trees are DECORATION. They never become a PaintSurface. The moment one
//      does, the player controller treats it as a wall to collide with and a
//      floor to stand on, and a tree can block the Gap 1 jump or pin the player
//      against the Charger.
//   2. Shapes and materials are SHARED. Nineteen trees cost two geometries and
//      a handful of materials, not thirty-eight. Lab hardware is the constraint
//      (DESIGN.md:133), and this is the difference between free and a frame-rate
//      problem.
//   3. A tree is re-coloured by swapping which SHARED material it points at —
//      never by cloning a material per tree. That is why the canopy palette is
//      built up front and handed out by name.
import * as THREE from 'three';
import { PAINT, ID_TO_NAME } from '../paint/paint-surface.js';
import { createToonMaterial } from '../shaders/toon/toon-material.js';

/**
 * Tree appearance. Tune NUMBERS here, not code.
 *
 * The canopy is NOT one colour. A canopy the same colour as its trunk reads as
 * a single bland shape, which is exactly what the first pass looked like.
 *
 * The painted canopies deliberately stop SHORT of the paint colour (see
 * PAINT_MIX): at full saturation the forest looks repainted from a tin rather
 * than woken up, and it competes with the ground, which is where the physics
 * story actually lives.
 */
export const FOREST = {
  bark: 0x413c36,

  // The drained canopy — the colour of a tree in a world with no paint in it.
  canopy: 0x4f5a4d,

  // How far each painted canopy is mixed from `canopy` toward `PAINT[name].hex`.
  // Grey is not in here: unpainted IS `canopy`, so mixing it toward itself would
  // be a no-op with extra arithmetic.
  paintMix: 0.55,

  // Reaction budget. Painting is checked on a hearbeat rather than per frame,
  // and only for trees near the player: 19 trees at 4 Hz is nothing, 19 trees at
  // 60 Hz for a change that is imperceptible between two frames is waste.
  reactRadius: 15,     // metres; trees past this keep whatever colour they had
  reactInterval: 0.25, // seconds between refreshes
};

/**
 * The canopy palette, one shared material per paint colour, built once.
 *
 * Mixing happens here rather than in `update()` for the same reason the probe
 * is allocation-free: this runs once, that would run forever.
 */
function createCanopyPalette() {
  const dull = new THREE.Color(FOREST.canopy);

  const palette = { grey: createToonMaterial(FOREST.canopy) };
  for (const name of ['blue', 'red', 'green']) {
    const mixed = dull.clone().lerp(new THREE.Color(PAINT[name].hex), FOREST.paintMix);
    palette[name] = createToonMaterial(mixed.getHex());
  }
  return palette;
}

export class Forest {
  /**
   * @param {THREE.Object3D} parent  the level's root, so dispose() frees it
   * @param {Array} placement        the level's hand-written tree table
   */
  constructor(parent, placement) {
    this.parent = parent;
    this.placement = placement;

    this.root = new THREE.Group();
    this.parent.add(this.root);

    this.trees = [];
    this.canopy = createCanopyPalette();
    this.bark = createToonMaterial(FOREST.bark);

    // Every material this module owns, in one flat list, so the level can point
    // them all at the sun in `_lightDirection()`. Custom shaders do not read
    // scene lights, so a material missing from this list is lit from
    // createToonMaterial's own default direction and quietly disagrees with the
    // ground (#57).
    this.materials = [this.bark, ...Object.values(this.canopy)];

    this._sinceCheck = 0;

    // reused every refresh — never allocate in a loop
    this._base = new THREE.Vector3();
  }

  /**
   * Build the trees. Takes the WALKABLE surfaces so each tree can be tied to the
   * floor it stands on exactly once, at build time.
   *
   * Why not probe every frame: a tree never moves, so the floor under it never
   * changes. Resolving it once turns a per-frame raycast into a per-tree lookup.
   * Floors are filtered by `isFloor` for the same reason the enemy spawner does —
   * the wall is a PaintSurface too, and a tree standing on the wall would be a
   * tree inside the wall.
   *
   * @param {import('../paint/paint-surface.js').PaintSurface[]} floors
   */
  build(floors) {
    // TWO shared shapes, reused by every tree.
    const canopyGeo = new THREE.ConeGeometry(1.5, 3.2, 7);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.6, 6);
    this.geometries = [canopyGeo, trunkGeo];

    for (const { x, y, z, scale } of this.placement) {
      const tree = new THREE.Group();
      tree.userData.tree = true;      // the tests find trees by walking root

      const trunk = new THREE.Mesh(trunkGeo, this.bark);
      trunk.position.y = 0.8;                 // half the trunk's height
      tree.add(trunk);

      const canopy = new THREE.Mesh(canopyGeo, this.canopy.grey);
      canopy.position.y = 1.6 + 1.6;          // trunk top + half the canopy
      tree.add(canopy);

      tree.position.set(x, y, z);
      tree.scale.setScalar(scale);
      this.root.add(tree);

      // The floor this tree stands on, resolved once. `worldToCell` is the
      // level's OWN "is this point on this surface" API — the same one the paint
      // gun and the physics probe use — so the colour a tree reads can never
      // drift away from the colour the player is standing on.
      this._base.set(x, y, z);
      const floor = this._floorUnder(floors);

      this.trees.push({
        mesh: tree,
        canopy,
        // null is a real answer: a tree placed over a gap has no floor, and the
        // forest test fails on it. Keeping the null means update() degrades to
        // "leave it grey" instead of throwing every heartbeat.
        floor,
        paintName: 'grey',
      });
    }

    return this.trees;
  }

  /** Nearest floor under the last `this._base` set. */
  _floorUnder(floors) {
    for (let i = 0; i < floors.length; i++) {
      if (floors[i].worldToCell(this._base) !== null) return floors[i];
    }
    return null;
  }

  /**
   * Re-colour the trees near the player from the paint they are standing on.
   *
   * `elapsed` is not needed: the heartbeat is an accumulator, so a restart or a
   * frame hitch cannot make the forest catch up by checking 40 times in a row.
   */
  update(dt, playerPosition) {
    this._sinceCheck += dt;
    if (this._sinceCheck < FOREST.reactInterval) return 0;
    this._sinceCheck = 0;

    const r2 = FOREST.reactRadius * FOREST.reactRadius;
    let changed = 0;

    // indexed loop: `for...of` allocates an iterator object per call, and this
    // runs on a heartbeat for the whole life of the level.
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      if (!tree.floor) continue;

      // Distance in XZ only: a tree on the platform above the player is still
      // "near" in the way a player means it, and y would make a tall level look
      // like sparse forest.
      const p = tree.mesh.position;
      const dx = p.x - playerPosition.x;
      const dz = p.z - playerPosition.z;
      if (dx * dx + dz * dz > r2) continue;

      const name = ID_TO_NAME[tree.floor.paintIdAtWorld(p)];
      if (name === tree.paintName) continue;

      tree.paintName = name;
      tree.canopy.material = this.canopy[name];
      changed += 1;
    }

    return changed;
  }
}
