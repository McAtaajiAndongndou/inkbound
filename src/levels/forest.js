// OWNER: E (Levels)
//
// The forest: one shared set of shapes, placed by a hand-written table plus a
// deterministic scatter, and re-coloured from the paint grid so the trees wake
// up where the player paints.
//
// Steps 2, 3, 4 and 5 of LEVEL-1-FOREST-POLISH.md. All four live in one module
// because they are one system: how a tree is DRAWN (a cone, or a real model in
// an InstancedMesh) must not change WHEN it is recoloured, so the placement and
// the reaction are deliberately separated from the rendering.
//
// Four rules this module exists to keep true, all of them in the test file:
//
//   1. Trees are DECORATION. They never become a PaintSurface. The moment one
//      does, the player controller treats it as a wall to collide with and a
//      floor to stand on, and a tree can block the Gap 1 jump or pin the player
//      against the Charger.
//   2. Shapes and materials are SHARED. A tree is recoloured by pointing it at
//      a different SHARED material — never by cloning one per tree.
//   3. Every tree stands ON a floor. There is no ground outside the corridor, so
//      a tree placed out there floats over the void, and that is the first thing
//      a player notices now the gaps are not filled with fog colour.
//   4. The real models are OPTIONAL. `build()` always produces a complete forest
//      out of cones and cylinders; `loadModels()` upgrades it in place when the
//      .glb files arrive, and if they never do — offline, lab PC, a bad export —
//      the level still looks like a forest. Nothing about the level waits on a
//      download.
import * as THREE from 'three';
import { PAINT, ID_TO_NAME } from '../paint/paint-surface.js';
import { createToonMaterial } from '../shaders/toon/toon-material.js';

/**
 * Tree appearance. Tune NUMBERS here, not code.
 *
 * The canopy is NOT one colour. A canopy the same colour as its trunk reads as
 * a single bland shape, which is exactly what the first pass looked like.
 *
 * The painted canopies deliberately stop SHORT of the paint colour: at full
 * saturation the forest looks repainted from a tin rather than woken up, and it
 * competes with the ground, which is where the physics story actually lives.
 */
export const FOREST = {
  bark: 0x413c36,

  // The drained canopy — the colour of a tree in a world with no paint in it.
  canopy: 0x4f5a4d,

  // How far each painted canopy is mixed from `canopy` toward `PAINT[name].hex`.
  // Grey is not in here: unpainted IS `canopy`, so mixing it toward itself would
  // be a no-op with extra arithmetic.
  paintMix: 0.55,

  // Reaction budget. Painting is checked on a heartbeat rather than per frame,
  // and only for trees near the player: a hundred trees at 4 Hz is nothing, a
  // hundred trees at 60 Hz for a change that is imperceptible between two frames
  // is waste.
  reactRadius: 15,     // metres; trees past this keep whatever colour they had
  reactInterval: 0.25, // seconds between refreshes

  // --- step 4/5: the real models -------------------------------------------

  // Quaternius, CC0, via poly.pizza. Both are texture-stripped by
  // tools/strip-glb-textures.mjs — the art direction is flat toon, so the PNGs
  // would be decoded at load and then thrown away.
  //
  // They are FBX exports, which is worth knowing before trusting any number in
  // them: every tree is scaled x100, rotated into Y-up by its node, and the five
  // variants in each file are laid out in a STRIP along X at 172…221. None of
  // that is usable directly, so `_bakeVariant()` normalises each one.
  models: ['./assets/trees/pine.glb', './assets/trees/trees.glb'],

  // How many of the tree shapes in those files to actually use. Each variant
  // costs one draw call per paint colour, so this is the number that decides the
  // draw-call budget: 5 variants x 4 colours + 5 trunks = 25 calls for the whole
  // forest, whatever the tree count.
  maxVariants: 5,

  // The source models are between 4 and 8 metres tall and each has a different
  // pivot. Every one is normalised to this height with its base at y=0, so a
  // tree's scale is a design number and not an accident of the export.
  modelHeight: 3.4,

  // --- step 5: the scatter --------------------------------------------------

  // The hand-written table in the level frames the route. This fills in the rest
  // of the floor around it, deterministically — no Math.random, so a reload is
  // the same forest and a test can predict one.
  //
  // The density is capped by GEOMETRY, not by the renderer: trees must stand on
  // a floor, and L1's floors are a 16-wide corridor. There is no ground outside
  // it, so the forest cannot spill sideways. `spacing` is the knob that decides
  // how far it gets.
  scatter: {
    step: 1.1,       // metres between candidate positions along the corridor
    spacing: 1.35,   // no two trees closer than this
    edgeBand: 3.4,   // trees never closer than this to the route centre line
    inset: 0.8,      // and never this close to an island's edge
    minScale: 0.8,
    maxScale: 1.25,
    seed: 0x5eed1e,  // fixed: the same forest every run, byte for byte
  },
};

/**
 * The canopy palette, one shared material per paint colour, built once.
 *
 * Mixing happens here rather than in `update()` for the same reason the probe is
 * allocation-free: this runs once, that would run forever.
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

/**
 * A tiny deterministic PRNG (mulberry32).
 *
 * Math.random is not an option: the test suite would then assert on a different
 * forest every run, and a reload would visibly reshuffle the level. This is the
 * same reason `createMistTexture` in the level builds its noise out of integer
 * frequencies instead of random numbers.
 */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Forest {
  /**
   * @param {THREE.Object3D} parent  the level's root, so dispose() frees it
   * @param {Array} placement        the level's hand-written tree table
   */
  constructor(parent, placement) {
    this.parent = parent;
    this.placement = placement;

    // Two groups, because the upgrade has to be able to hide one and not the
    // other. `fallback` is always populated; `models` starts empty.
    this.root = new THREE.Group();
    this.fallback = new THREE.Group();
    this.models = new THREE.Group();
    this.root.add(this.fallback, this.models);
    this.parent.add(this.root);

    this.trees = [];                      // placement, colour and floor — no meshes
    this.canopy = createCanopyPalette();
    this.bark = createToonMaterial(FOREST.bark);

    // Every material this module owns, in one flat list, so the level can point
    // them all at the sun in `_lightDirection()`. Custom shaders do not read
    // scene lights, so a material missing from this list is lit from
    // createToonMaterial's own default direction and quietly disagrees with the
    // ground (#57).
    this.materials = [this.bark, ...Object.values(this.canopy)];

    // Owned here rather than by a tree, because the fallback cone and the real
    // model have to share them or the two would drift apart.
    this.geometries = [];

    this.variants = [];   // baked model shapes, filled by loadModels()
    this.buckets = [];    // instanced draw calls, one per variant per colour
    this.disposed = false;
    this.modelCount = 0;
    this.pending = null;  // the in-flight model load, so a test (or a reload) can await it

    this._sinceCheck = 0;

    // reused every refresh — never allocate in a loop
    this._base = new THREE.Vector3();
    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._axisY = new THREE.Vector3(0, 1, 0);
  }

  // -------------------------------------------------------------------------
  // Placement
  // -------------------------------------------------------------------------

  /**
   * Build the whole forest out of cones and cylinders.
   *
   * This is not a placeholder that gets replaced — it is the forest. The models
   * (below) are an upgrade on top. That ordering is the whole reason a failed
   * download cannot leave the level looking empty.
   *
   * @param {import('../paint/paint-surface.js').PaintSurface[]} floors walkable only
   */
  build(floors) {
    // TWO shared shapes, reused by every fallback tree.
    const canopyGeo = new THREE.ConeGeometry(1.5, 3.2, 7);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.6, 6);
    this.geometries.push(canopyGeo, trunkGeo);

    for (const spot of this._spots(floors)) {
      // The floor this tree stands on, resolved once. A tree never moves, so the
      // floor under it never changes: resolving it here turns what would be a
      // per-frame probe into a per-tree lookup.
      this._base.set(spot.x, spot.y, spot.z);
      const floor = this._floorUnder(floors);

      const tree = {
        x: spot.x,
        y: spot.y,
        z: spot.z,
        rotY: spot.rotY,
        scale: spot.scale,
        // null is a real answer: a tree over a gap has no floor, and the forest
        // test fails on it. Keeping the null means update() degrades to "leave it
        // grey" instead of throwing every heartbeat.
        floor,
        paintName: 'grey',
        mesh: null,     // the fallback cone, hidden once models arrive
        canopy: null,   // the fallback canopy mesh, whose MATERIAL is swapped
        variant: -1,
        bucket: null,   // the instanced draw call a tree's canopy currently sits in
        trunkSlot: -1,  // and its slot in each of the two buckets it occupies
        canopySlot: -1,
      };

      this._buildFallback(tree, canopyGeo, trunkGeo);
      this.trees.push(tree);
    }

    return this.trees;
  }

  /**
   * The hand-written table plus the scatter, in one list.
   *
   * Order matters: the hand-written trees are placed first and the scatter
   * respects them as obstacles, so the deliberate framing the level author chose
   * is never squeezed out by the noise that fills in around it.
   */
  _spots(floors) {
    const spots = [];

    for (const entry of this.placement) {
      spots.push({
        x: entry.x,
        y: entry.y,
        z: entry.z,
        scale: entry.scale,
        rotY: 0,
      });
    }

    const { step, spacing, edgeBand, inset, minScale, maxScale, seed } = FOREST.scatter;
    const random = createRandom(seed);
    const gap2 = spacing * spacing;

    for (const floor of floors) {
      const halfWidth = floor.width / 2;
      const zCentre = floor.mesh.position.z;
      const zMin = zCentre - floor.height / 2 + inset;
      const zMax = zCentre + floor.height / 2 - inset;

      // The band the scatter may use, on both sides of the route. `edgeBand` is
      // the "keep the route clear" bound; on the narrow platform it collapses to
      // a thin strip against the edge, which is correct — the platform is not a
      // forest, it is a ledge with a few trees on it.
      const outer = halfWidth - inset;
      const inner = Math.min(edgeBand, outer);
      if (outer <= inner) continue;

      for (let z = zMin; z <= zMax; z += step) {
        for (const side of [-1, 1]) {
          const x = side * (inner + random() * (outer - inner));
          const jitteredZ = z + (random() - 0.5) * step;

          if (jitteredZ < zMin || jitteredZ > zMax) continue;

          // never crowding something already placed
          let crowded = false;
          for (let i = 0; i < spots.length; i++) {
            // only compare against trees at the SAME height: islands B and the
            // platform above it overlap in z, and without this an island tree
            // would push a tree six metres above it out of the forest.
            if (Math.abs(spots[i].y - floor.mesh.position.y) > 1) continue;
            const dx = spots[i].x - x;
            const dz = spots[i].z - jitteredZ;
            if (dx * dx + dz * dz < gap2) { crowded = true; break; }
          }
          if (crowded) continue;

          const spot = {
            x,
            y: floor.mesh.position.y,
            z: jitteredZ,
            scale: minScale + random() * (maxScale - minScale),
            rotY: random() * Math.PI * 2,
          };

          // belt and braces: the floor's OWN "is this point on this surface"
          // API, the same one the paint gun uses. The band maths above should
          // make this unreachable, and the forest test would catch it if this
          // ever let a floating tree through.
          this._base.set(spot.x, spot.y, spot.z);
          if (floor.worldToCell(this._base) === null) continue;

          spots.push(spot);
        }
      }
    }

    return spots;
  }

  /** The fallback cone + cylinder for one tree. Cheap: the shapes are shared. */
  _buildFallback(tree, canopyGeo, trunkGeo) {
    const group = new THREE.Group();
    group.userData.tree = true;      // the tests find trees by walking root

    const trunk = new THREE.Mesh(trunkGeo, this.bark);
    trunk.position.y = 0.8;                 // half the trunk's height
    group.add(trunk);

    const canopy = new THREE.Mesh(canopyGeo, this.canopy.grey);
    canopy.position.y = 1.6 + 1.6;          // trunk top + half the canopy
    group.add(canopy);

    group.position.set(tree.x, tree.y, tree.z);
    group.scale.setScalar(tree.scale);
    this.fallback.add(group);

    tree.mesh = group;
    tree.canopy = canopy;
  }

  /** Nearest floor under the last `this._base` set. */
  _floorUnder(floors) {
    for (let i = 0; i < floors.length; i++) {
      if (floors[i].worldToCell(this._base) !== null) return floors[i];
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Step 4/5: the real models
  // -------------------------------------------------------------------------

  /**
   * Upgrade the forest to real .glb trees, in place.
   *
   * `load` is INJECTED rather than imported. Two reasons, and the second is the
   * important one:
   *
   *   1. Lane: `MECHANICS.md:196` puts the GLB/animation pipeline in `shaders/`.
   *      Importing GLTFLoader here would be a second loader to maintain.
   *      `main.js` owns the one loader and hands it in.
   *   2. Testability: `node --test` has no DOM and no server, so a level that
   *      dialled out to `./assets/...` on load would make noise in every test run
   *      and prove nothing. With no loader injected, the level builds its
   *      fallback forest and never touches the network. The model path is tested
   *      with a stub loader that returns real geometry and no files.
   *
   * Nothing awaits this. A level that has already been disposed drops the result
   * on the floor (see `disposed`) — pressing R while the download is in flight
   * would otherwise attach a forest to a dead level, where it leaks and stays on
   * screen. That is the "R race" the plan warns about.
   */
  async loadModels(load) {
    this.pending = this._load(load);
    return this.pending;
  }

  async _load(load) {
    try {
      const files = await Promise.all(FOREST.models.map((url) => load(url)));

      // the level died while we were loading — drop the result instead of
      // attaching a forest to a dead level, where it leaks and stays on screen
      if (this.disposed) {
        disposeScenes(files);
        return 0;
      }

      const variants = [];
      for (const gltf of files) {
        for (const variant of collectVariants(gltf)) {
          if (variants.length >= FOREST.maxVariants) break;
          variants.push(bakeVariant(variant, FOREST.modelHeight, this.geometries));
        }
      }

      if (this.disposed || variants.length === 0) return 0;

      this.variants = variants;
      this._buildInstances();
      this._paintFallbackHidden();
      return variants.length;
    } catch (err) {
      // Deliberately non-fatal. A level with cone trees is a level; a level that
      // threw out of an unawaited promise is a black screen.
      console.warn('[Forest] model load failed, keeping the fallback trees:', err);
      return 0;
    }
  }

  /**
   * One InstancedMesh per variant per paint colour, plus one per variant for the
   * trunks.
   *
   * WHY IT IS SPLIT BY COLOUR — this is the part the plan flags, and it is worth
   * being explicit. Per-instance colour needs `instanceColor`, and the toon
   * shader is custom and does not read it. The alternatives were to change
   * Lethabo's shader (another lane) or to drop per-tree colour on the models
   * (which would delete step 3 the moment step 5 landed).
   *
   * Neither is necessary: the colour already lives in a shared material, so a
   * tree changes colour by MOVING to a different InstancedMesh that renders the
   * same geometry with a different material. The cost is one draw call per
   * colour per variant, which is a fixed 25 calls for the whole forest whether
   * it holds twenty trees or two hundred — and the trunks share one material
   * that never changes, so they are one call per variant, not four.
   */
  _buildInstances() {
    const colours = Object.keys(this.canopy);

    for (let v = 0; v < this.variants.length; v++) {
      const variant = this.variants[v];
      const bucketSet = {};

      if (variant.trunk) {
        bucketSet.trunk = this._newBucket(variant.trunk, this.bark, 'trunk', 'trunkSlot');
      }
      for (const colour of colours) {
        if (variant.canopy) {
          bucketSet[colour] = this._newBucket(variant.canopy, this.canopy[colour], colour, 'canopySlot');
        }
      }

      this.buckets.push(bucketSet);
    }

    // Hand out variants round-robin so the mix along the corridor is even,
    // rather than "all the pines at the start". Every tree starts grey.
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      tree.variant = i % this.variants.length;

      const bucketSet = this.buckets[tree.variant];
      // TWO buckets per tree, and they need SEPARATE slot numbers: a tree in
      // trunk slot 3 is not necessarily in canopy slot 3, and sharing one field
      // would corrupt both free lists.
      if (bucketSet.trunk) this._add(tree, bucketSet.trunk);
      if (bucketSet.grey) {
        this._add(tree, bucketSet.grey);
        // Every tree starts grey, and this is what tells `_apply` that the tree
        // is on the instanced path rather than the fallback one.
        tree.bucket = bucketSet.grey;
      }
    }
  }

  /**
   * A draw call, with a SWAP-REMOVE free list.
   *
   * `count` is only ever raised to the number of trees actually in the bucket, so
   * a colour nothing is using costs nothing to draw. When a tree leaves, the last
   * live instance is moved into the hole rather than leaving a zero-scaled
   * instance behind — a hidden instance still runs its vertex shader.
   *
   * @param {string} slotField which field on the tree holds this bucket's slot.
   *   One per tree per bucket kind; see `_buildInstances`.
   */
  _newBucket(geometry, material, kind, slotField) {
    const mesh = new THREE.InstancedMesh(geometry, material, this.trees.length);
    mesh.count = 0;
    mesh.name = `forest-${kind}`;
    // InstancedMesh culls against the BASE geometry's bounding sphere, which is
    // one tree at the origin — so it would vanish the moment the camera left the
    // origin. Cheap to disable here; there are only a couple of dozen of these.
    mesh.frustumCulled = false;
    this.models.add(mesh);

    return {
      mesh, material, kind, slotField, live: 0,
      slots: new Array(this.trees.length),
    };
  }

  _add(tree, bucket) {
    const index = bucket.live;
    bucket.live += 1;
    bucket.slots[index] = tree;
    tree[bucket.slotField] = index;

    this._writeInstance(bucket, index, tree);
    bucket.mesh.count = bucket.live;
    bucket.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Swap the tree out of a bucket without leaving a dead instance behind. */
  _remove(tree, bucket) {
    const slot = tree[bucket.slotField];
    const last = bucket.live - 1;
    const moved = bucket.slots[last];

    bucket.slots[slot] = moved;
    moved[bucket.slotField] = slot;
    bucket.live = last;

    if (moved !== tree) this._writeInstance(bucket, slot, moved);
    bucket.mesh.count = last;
    bucket.mesh.instanceMatrix.needsUpdate = true;
  }

  _writeInstance(bucket, index, tree) {
    this._position.set(tree.x, tree.y, tree.z);
    this._quaternion.setFromAxisAngle(this._axisY, tree.rotY);
    // The fallback shapes are modelled from the ground up, and so are the GLB
    // variants after `bakeVariant` — so the instance scale IS the tree scale.
    this._scale.setScalar(tree.scale);
    this._matrix.compose(this._position, this._quaternion, this._scale);
    bucket.mesh.setMatrixAt(index, this._matrix);
  }

  /** The cones have done their job: the models are standing. */
  _paintFallbackHidden() {
    this.fallback.visible = false;
    this.modelCount = this.trees.length;
  }

  // -------------------------------------------------------------------------
  // Step 3: the reaction
  // -------------------------------------------------------------------------

  /**
   * Re-colour the trees near the player from the paint they are standing on.
   *
   * Returns how many trees changed, which is what the tests assert on — a
   * "did anything happen" signal is worth more than a silent void here.
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
      const dx = tree.x - playerPosition.x;
      const dz = tree.z - playerPosition.z;
      if (dx * dx + dz * dz > r2) continue;

      const name = ID_TO_NAME[tree.floor.paintIdAtWorld(this._base.set(tree.x, tree.y, tree.z))];
      if (name === tree.paintName) continue;

      this._apply(tree, name);
      changed += 1;
    }

    return changed;
  }

  /**
   * Point the tree at a different shared material.
   *
   * The two branches are the whole reason the placement table does not own
   * meshes: the fallback swaps the MATERIAL on one mesh, the models move the tree
   * to another bucket. Everything above this line is identical.
   */
  _apply(tree, name) {
    tree.paintName = name;

    if (tree.bucket) {
      const bucketSet = this.buckets[tree.variant];
      const next = bucketSet[name];
      if (next && next !== tree.bucket) {
        this._remove(tree, tree.bucket);
        this._add(tree, next);
        tree.bucket = next;
      }
      return;
    }

    if (tree.canopy) tree.canopy.material = this.canopy[name];
  }

  dispose() {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Model baking
// ---------------------------------------------------------------------------

/**
 * Pull the individual trees out of a loaded model file, as { trunk, canopy }
 * geometry sources.
 *
 * They are NOT single models: each file is a pack of five variants laid out in a
 * strip along X, parented to one root node.
 *
 * GROUPING RULE: a tree is one parent node holding its bark and leaf primitives.
 * That is how FBX2glTF exports a multi-primitive mesh — the glTF mesh carries two
 * primitives, so three.js hands back a Group named after the node with two child
 * Meshes underneath it.
 *
 * The obvious first attempt — walk up to the topmost ancestor below the scene —
 * is WRONG, and wrong in a way that looks fine: every mesh in the file has the
 * same topmost ancestor (`RootNode`), so all five trees collapse into one
 * "variant" ten primitives wide. Grouping by immediate parent is what actually
 * separates them.
 *
 * Which primitive is which is read off the MATERIAL name ("PineTree_Bark" /
 * "PineTree_Leaves"), because the mesh names are "PineTree_1…5" on both and
 * carry no information about the part.
 */
export function collectVariants(gltf) {
  const byVariant = new Map();

  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;

    const key = object.parent ?? gltf.scene;
    if (!byVariant.has(key)) byVariant.set(key, []);
    byVariant.get(key).push(object);
  });

  const variants = [];
  for (const meshes of byVariant.values()) {
    const trunk = meshes.filter((m) => /bark|trunk|wood/i.test(m.material?.name ?? ''));
    const canopy = meshes.filter((m) => !trunk.includes(m));

    variants.push({
      trunk: trunk.length ? trunk : null,
      canopy: canopy.length ? canopy : null,
    });
  }

  return variants;
}

/**
 * Free the raw parts of a loaded scene we decided not to use.
 *
 * Only reached on the dispose race: the geometries were never rendered, so there
 * is no GPU buffer to release, but the CPU-side arrays are tens of thousands of
 * vertices and the repo cares about restart leaks.
 */
function disposeScenes(files) {
  for (const gltf of files) {
    gltf.scene?.traverse((object) => {
      if (object.isMesh) object.geometry.dispose();
    });
  }
}

/**
 * Bake one strip variant into a usable, shared shape.
 *
 * Three things have to be undone, and every one of them is an artefact of the
 * FBX export rather than anything the modeller intended:
 *
 *   1. **The strip offset.** Variant `PineTree_4` sits at x = 176. Applied as-is,
 *      the tree stands 176 metres to the side of its own position.
 *   2. **The x100 scale and the Z-up node rotation.** Both live on the node, not
 *      the mesh, so the geometry alone looks tiny and sideways.
 *   3. **The pivot.** Every variant has its origin somewhere different — one has
 *      y from -0.24, another from 0. Nothing can be placed on the ground until
 *      the base is at y=0 and the trunk is centred on the origin.
 *
 * The same matrix is applied to the trunk and the canopy, so a tree's bark and
 * its leaves cannot end up in different places.
 *
 * @param {THREE.BufferGeometry[]} into the shared geometry list, so dispose() frees them
 */
function bakeVariant(variant, height, into) {
  const parts = [variant.trunk, variant.canopy].filter(Boolean).flat();

  const box = new THREE.Box3();
  for (const mesh of parts) {
    mesh.updateWorldMatrix(true, false);
    box.union(new THREE.Box3().setFromObject(mesh));
  }

  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;

  // final = scale x recentre, and it must be applied OUTSIDE each mesh's own
  // world matrix: that matrix is where the strip offset and the x100 live.
  const normalise = new THREE.Matrix4()
    .makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  const bake = (meshes) => {
    if (!meshes) return null;
    const geometry = meshes[0].geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalise, meshes[0].matrixWorld));
    geometry.computeBoundingSphere();
    into.push(geometry);
    return geometry;
  };

  const baked = { trunk: bake(variant.trunk), canopy: bake(variant.canopy) };

  // the source geometry is dead once it is baked — do not leave ~40k vertices of
  // GPU buffers behind for every variant that was rejected by maxVariants
  for (const mesh of parts) mesh.geometry.dispose();
  return baked;
}
