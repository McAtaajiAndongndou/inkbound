// OWNER: E (Levels)
//
// Decor: everything that dresses the level and wakes up when you paint it.
//
// Trees, rocks, grass, bushes, flowers, stumps — one system, not six. The rule
// the whole thing exists to serve is the game's premise, stated plainly:
//
//   THE WORLD IS GREY, AND PAINTING THE GROUND BRINGS BACK THE COLOUR.
//
// So every prop stands on a paint surface, reads the paint under itself through
// the SAME API the player's physics uses, and takes that colour. Nothing here is
// decoration that ignores you: the environment is the feedback.
//
// Steps 2–5 of LEVEL-1-FOREST-POLISH.md, generalised past "trees" once the goal
// turned out to be the whole environment.
//
// Four rules, all of them in the test file:
//
//   1. Decor is DECORATION. It never becomes a PaintSurface. The moment one does,
//      the player controller treats it as a wall to collide with and a floor to
//      stand on, and a bush can block the Gap 1 jump or pin the player against
//      the Charger.
//   2. Shapes and materials are SHARED. A prop is recoloured by pointing it at a
//      different SHARED material — never by cloning one per instance.
//   3. Every prop stands ON a floor. There is no ground outside the corridor, so
//      a prop placed out there floats over the void, which players notice
//      immediately now the gaps are not filled with fog colour.
//   4. The real models are OPTIONAL. `build()` always produces a complete dressed
//      level out of code-built shapes; `loadModels()` upgrades it in place. A
//      failed download leaves a level, not a hole.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAINT, ID_TO_NAME } from '../paint/paint-surface.js';
import { createToonMaterial } from '../shaders/toon/toon-material.js';

/**
 * The palette and the reaction budget. Tune NUMBERS here, not code.
 *
 * `tint` is the colour of a prop in a world with no paint in it: a drained
 * grey-green, not a neutral grey, so the un-painted world still looks like
 * something that USED to be alive.
 *
 * `paintMix` deliberately stops short of the paint colour. At full saturation
 * the world looks repainted from a tin rather than coming back to life, and it
 * competes with the ground, which is where the physics story actually lives.
 */
export const DECOR = {
  base: 0x413c36,     // bark, wood, stems — stays dark whatever the paint
  tint: 0x4f5a4d,     // leaves, moss, grass, stone — takes the paint
  paintMix: 0.55,

  reactRadius: 15,     // metres; props past this keep whatever colour they had
  reactInterval: 0.25, // seconds between refreshes

  // How long the code-built props stay HIDDEN while the real models load.
  //
  // The fallback exists so a failed download can never leave a bare level, but
  // showing it DURING a normal load was wrong: on every restart the player saw
  // cones and blobs for a few hundred milliseconds and then watched them turn
  // into trees. Now it is hidden, and only revealed once this much time has
  // passed without the models arriving — so a normal load never shows it at all,
  // and a failed or hung one still gets a dressed level.
  fallbackDelay: 0.4,  // seconds of level time, not wall clock
};

/**
 * Which materials STAY NEUTRAL.
 *
 * A prop's parts are split in two: parts matching this pattern keep the base
 * colour, everything else takes the paint. That is what gives a stump a dark
 * trunk and blue moss, and a bush with berries blue leaves and its own berries
 * — rather than a prop that is one flat colour.
 *
 * Read off the MATERIAL name, because mesh names carry no useful information.
 */
const BASE_PART = /bark|trunk|wood|stem|berry/i;

/**
 * One entry per kind of prop. A kind is a model set, a size, a fallback shape
 * and its own scatter density — because grass and a tree are not the same
 * problem. Grass wants to be small, dense and right up against the route; a
 * tree wants to be large, sparse and out of the way.
 *
 * The models are the real **Quaternius Stylized Nature MegaKit** (CC0), 30 of
 * its 68 glTF models, packed from `.gltf` + `.bin` into texture-free `.glb` by
 * `tools/gltf-to-gltf.mjs`. Picked for the JOB rather than for completeness:
 *
 *   - Every model is normalised to this kind's `height` because there is no
 *     usable size in the files. The pack's native heights run from 0.1 (a
 *     pebble) to 18.9 (a twisted tree) — 189x apart — and every one of them has
 *     a different pivot.
 *   - Vertex counts run from 14 (a petal) to 15,647 (a twisted tree), so the
 *     heavy models are used SPARINGLY and the heavy kinds scatter wider. The
 *     MegaKit's trees are 3-5x the vertex cost of the models they replaced.
 *   - DeadTree is bark-only. It has no leaf material, so nothing matches
 *     BASE_PART and the whole tree takes the paint — which is the right read for
 *     this game: paint is what brings the dead world back.
 *
 * `step` / `spacing` / `edge` / `inset` are the scatter:
 *   step     metres between candidate positions along the corridor
 *   spacing  no two props of this kind closer than this
 *   edge     never closer than this to the route centre line
 *   inset    never this close to an island's edge
 *   seed     fixed, so the same level is dressed identically every run
 */
export const KINDS = {
  tree: {
    models: [
      './assets/megakit/CommonTree_1.glb',
      './assets/megakit/CommonTree_3.glb',
      './assets/megakit/CommonTree_5.glb',
      './assets/megakit/Pine_4.glb',
      './assets/megakit/Pine_5.glb',
    ],
    maxVariants: 5,
    height: 3.4,
    fallback: 'tree',
    scale: [0.8, 1.25],
    step: 1.1, spacing: 1.35, edge: 3.4, inset: 0.8, seed: 0x5eed1e,
  },

  // The corrupted landmarks: gnarled, 16-19m native, and by far the heaviest
  // models in the pack (14-15k vertices each). Sparse and big on purpose — a
  // handful of silhouettes against the haze, not a species.
  twistedTree: {
    models: [
      './assets/megakit/TwistedTree_1.glb',
      './assets/megakit/TwistedTree_3.glb',
    ],
    maxVariants: 2,
    height: 6.5,
    fallback: 'tree',
    scale: [0.85, 1.2],
    step: 4.5, spacing: 4.0, edge: 5.0, inset: 1.0, seed: 0x7a17e5,
  },

  // Dead silhouettes, 9-13m native, bark only, so they take the paint whole.
  deadTree: {
    models: [
      './assets/megakit/DeadTree_1.glb',
      './assets/megakit/DeadTree_3.glb',
    ],
    maxVariants: 2,
    height: 5.0,
    fallback: 'tree',
    scale: [0.85, 1.2],
    step: 3.4, spacing: 2.8, edge: 4.2, inset: 0.9, seed: 0xdead11,
  },

  bush: {
    models: [
      './assets/megakit/Bush_Common.glb',
      './assets/megakit/Bush_Common_Flowers.glb',
    ],
    maxVariants: 2,
    height: 1.3,
    fallback: 'blob',
    scale: [0.75, 1.3],
    step: 1.8, spacing: 1.5, edge: 2.4, inset: 0.8, seed: 0xbeef01,
  },

  rock: {
    models: [
      './assets/megakit/Rock_Medium_1.glb',
      './assets/megakit/Rock_Medium_2.glb',
      './assets/megakit/Rock_Medium_3.glb',
    ],
    maxVariants: 3,
    height: 0.8,
    fallback: 'blob',
    scale: [0.6, 1.4],
    step: 2.2, spacing: 1.9, edge: 2.2, inset: 0.8, seed: 0x0c1a11,
  },

  // Pebbles are 0.1-0.2m native: pure ground detail, and cheap (100-300
  // vertices), so they are allowed to be dense and close to the route.
  pebble: {
    models: [
      './assets/megakit/Pebble_Round_1.glb',
      './assets/megakit/Pebble_Round_3.glb',
      './assets/megakit/Pebble_Square_1.glb',
      './assets/megakit/Pebble_Square_5.glb',
    ],
    maxVariants: 4,
    height: 0.22,
    fallback: 'blob',
    scale: [0.7, 1.6],
    step: 1.3, spacing: 0.9, edge: 1.6, inset: 0.6, seed: 0x9e11e5,
  },

  grass: {
    models: [
      './assets/megakit/Grass_Common_Short.glb',
      './assets/megakit/Grass_Common_Tall.glb',
      './assets/megakit/Grass_Wispy_Short.glb',
      './assets/megakit/Grass_Wispy_Tall.glb',
    ],
    maxVariants: 4,
    height: 0.7,
    // EVERY grass model gets its OWN target height, and this is the whole point
    // of the change. The pack ships these as Short/Tall pairs, and normalising
    // all four to a single number threw that away: four different models
    // rendered at identical sizes, which reads as one model repeated and made
    // the ground cover look like a uniform hedge.
    //
    // These values are what makes a forest floor: ankle-height common grass for
    // the bulk of it, a taller wispy variant to break up the silhouette.
    heights: {
      Grass_Common_Short: 0.3,
      Grass_Common_Tall: 0.8,
      Grass_Wispy_Short: 0.4,
      Grass_Wispy_Tall: 0.72,
    },
    fallback: 'tuft',
    scale: [0.7, 1.4],
    // grass is the one kind that MAY come close to the route: a corridor with no
    // ground cover at its edges reads as a corridor, not a forest floor
    step: 0.8, spacing: 0.6, edge: 1.5, inset: 0.7, seed: 0x6a55e5,
  },

  flower: {
    models: [
      './assets/megakit/Flower_3_Group.glb',
      './assets/megakit/Flower_4_Group.glb',
      './assets/megakit/Flower_4_Single.glb',
    ],
    maxVariants: 3,
    height: 0.9,
    fallback: 'tuft',
    scale: [0.7, 1.2],
    step: 2.4, spacing: 1.6, edge: 2.0, inset: 0.8, seed: 0xf10e12,
  },

  plant: {
    models: [
      './assets/megakit/Fern_1.glb',
      './assets/megakit/Plant_1.glb',
      './assets/megakit/Clover_2.glb',
    ],
    maxVariants: 3,
    height: 0.8,
    fallback: 'tuft',
    scale: [0.7, 1.3],
    step: 1.6, spacing: 1.1, edge: 1.8, inset: 0.7, seed: 0x9ee0aa,
  },

  // Mushroom_Laetiporus is deliberately NOT here, and it is the one model the
  // pack's own polycount rules out: 1,806 vertices for a 45cm bracket fungus is
  // 3,216 triangles PER INSTANCE, heavier than a whole tree in the set that
  // preceded these. It is a browse-the-pack-and-love-it model, not a scatter
  // model. Mushroom_Common is 555 vertices and does the same job.
  mushroom: {
    models: [
      './assets/megakit/Mushroom_Common.glb',
    ],
    maxVariants: 1,
    height: 0.45,
    fallback: 'blob',
    scale: [0.7, 1.3],
    step: 2.6, spacing: 2.0, edge: 2.0, inset: 0.8, seed: 0x5a11a5,
  },
};

/**
 * The shared palette, one material per colour, built once for the WHOLE level.
 *
 * Shared across kinds on purpose: a blue bush and a blue tree must be the same
 * blue, or "the world comes back to colour" reads as several different colours.
 *
 * Mixing happens here rather than in `update()` for the same reason the reaction
 * loop is allocation-free: this runs once, that would run forever.
 */
export function createDecorPalette() {
  const dull = new THREE.Color(DECOR.tint);

  const tint = { grey: createToonMaterial(DECOR.tint) };
  for (const name of ['blue', 'red', 'green']) {
    const mixed = dull.clone().lerp(new THREE.Color(PAINT[name].hex), DECOR.paintMix);
    tint[name] = createToonMaterial(mixed.getHex());
  }

  return { base: createToonMaterial(DECOR.base), tint };
}

/**
 * A tiny deterministic PRNG (mulberry32).
 *
 * Math.random is not an option: the test suite would then assert on a different
 * level every run, and a reload would visibly reshuffle it. Same reasoning as
 * `createMistTexture` in the level, which builds its noise out of integer
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

export class Decor {
  /**
   * @param {THREE.Object3D} parent the level's root, so dispose() frees it
   * @param {object} options
   * @param {string} options.kind       key into KINDS — for messages and names
   * @param {object} options.config     the KINDS entry
   * @param {object} options.palette    the level's shared decor palette
   * @param {Array}  [options.hand]     hand-written placements, from the level
   */
  constructor(parent, { kind, config, palette, hand = [] }) {
    this.parent = parent;
    this.kind = kind;
    this.config = config;
    this.hand = hand;

    // Two groups, because the upgrade has to be able to hide one and not the
    // other. `fallback` is always populated; `models` starts empty.
    this.root = new THREE.Group();
    this.root.name = `decor-${kind}`;
    this.fallback = new THREE.Group();
    this.models = new THREE.Group();
    this.root.add(this.fallback, this.models);
    this.parent.add(this.root);

    this.palette = palette;

    this.props = [];      // position, colour and floor — no meshes
    this.geometries = []; // every geometry this kind owns, so dispose() can free it

    this.variants = [];   // baked model shapes, filled by loadModels()
    this.buckets = [];    // instanced draw calls, one per variant per material
    this.disposed = false;
    this.modelCount = 0;
    this.pending = null;  // the in-flight load, so a test or a reload can await it

    this._sinceCheck = 0;
    this._sinceBuild = 0;
    // true once the fallback's fate is decided: either the models arrived, or
    // `fallbackDelay` passed without them. See the note on DECOR.fallbackDelay.
    this._settled = false;

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
   * Build this kind out of code shapes.
   *
   * This is not a placeholder that gets replaced — it is the dressed level. The
   * models are an upgrade on top. That ordering is the whole reason a failed
   * download cannot leave the level looking bare.
   *
   * @param {import('../paint/paint-surface.js').PaintSurface[]} floors walkable only
   */
  build(floors) {
    // The code shapes are built, but NOT shown yet — see DECOR.fallbackDelay.
    // Nothing is visible for the first fraction of a second, and in the common
    // case the models land first and the fallback is never seen at all.
    if (this.config.models.length > 0) this.fallback.visible = false;

    for (const spot of this._spots(floors)) {
      // The floor this prop stands on, resolved ONCE. A prop never moves, so the
      // floor under it never changes: this turns what would be a per-frame probe
      // into a per-prop lookup.
      this._base.set(spot.x, spot.y, spot.z);
      const floor = this._floorUnder(floors);

      const prop = {
        x: spot.x, y: spot.y, z: spot.z,
        rotY: spot.rotY, scale: spot.scale,
        hand: spot.hand,
        // null is a real answer: a prop over a gap has no floor, and the test
        // fails on it. Keeping the null means update() degrades to "leave it
        // grey" instead of throwing every heartbeat.
        floor,
        paintName: 'grey',
        mesh: null,      // the code-built fallback, hidden once models arrive
        parts: null,     // its tint parts, whose MATERIAL is swapped
        variant: -1,
        bucket: null,    // the instanced draw call the tint currently sits in
        baseSlot: -1,    // and its slot in each of the two bucket families
        tintSlot: -1,
      };

      this._buildFallback(prop);
      this.props.push(prop);
    }

    return this.props;
  }

  /**
   * The hand-written table plus the scatter, in one list.
   *
   * Order matters: hand-placed props go first and the scatter treats them as
   * obstacles, so the deliberate framing the level author chose is never
   * squeezed out by the noise that fills in around it.
   */
  _spots(floors) {
    const { step, spacing, edge, inset, scale, seed } = this.config;
    const spots = this.hand.map((entry) => ({
      x: entry.x, y: entry.y, z: entry.z, scale: entry.scale ?? 1, rotY: 0, hand: true,
    }));

    const random = createRandom(seed);
    const gap2 = spacing * spacing;

    for (const floor of floors) {
      const halfWidth = floor.width / 2;
      const zCentre = floor.mesh.position.z;
      const zMin = zCentre - floor.height / 2 + inset;
      const zMax = zCentre + floor.height / 2 - inset;

      // The band this kind may use, on both sides of the route. On the narrow
      // platform it collapses to a thin strip against the edge, which is right:
      // the platform is a ledge, not a meadow.
      const outer = halfWidth - inset;
      const inner = Math.min(edge, outer);
      if (outer <= inner) continue;

      for (let z = zMin; z <= zMax; z += step) {
        for (const side of [-1, 1]) {
          const x = side * (inner + random() * (outer - inner));
          const jitteredZ = z + (random() - 0.5) * step;

          if (jitteredZ < zMin || jitteredZ > zMax) continue;

          let crowded = false;
          for (let i = 0; i < spots.length; i++) {
            // only compare against props at the SAME height: islands B and the
            // platform above it overlap in z, and without this an island prop
            // would push a prop six metres above it out of the level.
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
            scale: scale[0] + random() * (scale[1] - scale[0]),
            rotY: random() * Math.PI * 2,
            hand: false,
          };

          // belt and braces: the floor's OWN "is this point on this surface"
          // API, the same one the paint gun uses. The band maths above should
          // make this unreachable, and the test would catch it if it ever let a
          // floating prop through.
          this._base.set(spot.x, spot.y, spot.z);
          if (floor.worldToCell(this._base) === null) continue;

          spots.push(spot);
        }
      }
    }

    return spots;
  }

  /**
   * The code-built stand-in for one prop: a `base` part that stays dark and a
   * `tint` part that takes the paint.
   *
   * One shape per kind, kept deliberately crude — these exist so the level is
   * complete without a single download, and they are hidden the moment the real
   * models arrive.
   */
  _buildFallback(prop) {
    const group = new THREE.Group();
    group.userData.decor = true;          // the tests find props by walking root
    group.userData.decorKind = this.kind;

    const { base, tint } = this._fallbackGeometries();
    const tintParts = [];

    if (base) {
      const mesh = new THREE.Mesh(base, this.palette.base);
      group.add(mesh);
    }
    if (tint) {
      const mesh = new THREE.Mesh(tint, this.palette.tint.grey);
      group.add(mesh);
      tintParts.push(mesh);
    }

    group.position.set(prop.x, prop.y, prop.z);
    group.rotation.y = prop.rotY;
    group.scale.setScalar(prop.scale);
    this.fallback.add(group);

    prop.mesh = group;
    prop.parts = tintParts;
  }

  /** Cached per kind: two geometries, shared by every prop of that kind. */
  _fallbackGeometries() {
    if (this._fallbackCache !== undefined) return this._fallbackCache;

    let pair;
    switch (this.config.fallback) {
      case 'tree': {
        const canopy = new THREE.ConeGeometry(1.5, 3.2, 7);
        const trunk = new THREE.CylinderGeometry(0.22, 0.28, 1.6, 6);
        trunk.translate(0, 0.8, 0);                  // half the trunk's height
        canopy.translate(0, 1.6 + 1.6, 0);           // trunk top + half the canopy
        pair = { base: trunk, tint: canopy };
        break;
      }
      case 'tuft': {
        // three crossed blades, thin: reads as ground cover from any angle
        const blades = [];
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.ConeGeometry(0.18, 1.0, 4);
          blade.translate(0, 0.5, 0);
          blade.rotateY((i * Math.PI) / 3);
          blade.translate((i - 1) * 0.12, 0, 0);
          blades.push(blade);
        }
        pair = { base: null, tint: mergeGeometries(blades) };
        break;
      }
      case 'blob':
      default: {
        // one lumpy shape, squashed flat on the bottom so it sits on the ground
        const blob = new THREE.IcosahedronGeometry(0.6, 0);
        blob.scale(1, 0.7, 1);
        blob.translate(0, 0.4, 0);
        pair = { base: null, tint: blob };
        break;
      }
    }

    this.geometries.push(...Object.values(pair).filter(Boolean));
    this._fallbackCache = pair;
    return pair;
  }

  /** Nearest floor under the last `this._base` set. */
  _floorUnder(floors) {
    for (let i = 0; i < floors.length; i++) {
      if (floors[i].worldToCell(this._base) !== null) return floors[i];
    }
    return null;
  }

  /**
   * The height to bake one model to: its own if the kind lists a `heights`
   * entry, otherwise the kind's single `height`.
   *
   * This exists because "normalise everything to one size" and "make four
   * variants look like four variants" are in direct conflict for anything the
   * pack ships as a size family — grass and trees both come as Short/Tall or
   * small/large pairs, and flattening them is what turns a varied forest floor
   * into a uniform hedge.
   */
  _heightFor(url) {
    const byName = this.config.heights;
    if (!byName) return this.config.height;

    const file = url.slice(url.lastIndexOf('/') + 1).replace(/\.glb$/, '');
    return byName[file] ?? this.config.height;
  }

  // -------------------------------------------------------------------------
  // The real models
  // -------------------------------------------------------------------------

  /**
   * Upgrade this kind to real .glb props, in place.
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
   *      fallback decor and never touches the network.
   *
   * Nothing awaits this. A kind that has already been disposed drops the result
   * on the floor — pressing R while a download is in flight would otherwise
   * attach props to a dead level, where they leak and stay on screen.
   */
  async loadModels(load) {
    this.pending = this._load(load);
    return this.pending;
  }

  async _load(load) {
    try {
      const files = await Promise.all(this.config.models.map((url) => load(url)));

      if (this.disposed) {         // the level died while we were loading
        disposeScenes(files);
        return 0;
      }

      const variants = [];
      // `files` is in the same order as `config.models`, which is what lets each
      // model carry its own target height (see KINDS.grass.heights).
      for (let i = 0; i < files.length; i++) {
        const height = this._heightFor(this.config.models[i]);
        for (const variant of collectVariants(files[i])) {
          if (variants.length >= this.config.maxVariants) break;
          variants.push(bakeVariant(variant, height, this.geometries));
        }
      }

      if (this.disposed || variants.length === 0) {
        // nothing came back — no point making the player wait out the delay
        this._giveUpOnModels();
        return 0;
      }

      this.variants = variants;
      this._buildInstances();
      this.fallback.visible = false;
      this.modelCount = this.props.length;
      return variants.length;
    } catch (err) {
      // Deliberately non-fatal. A level with code shapes is a level; a level that
      // threw out of an unawaited promise is a black screen. The message and not
      // the Error: six failures at load would otherwise print six stack traces
      // and bury the real output.
      console.warn(`[Decor:${this.kind}] model load failed, keeping the fallback props: ${err?.message ?? err}`);
      this._giveUpOnModels();
      return 0;
    }
  }

  /**
   * No models are coming. Show the code shapes NOW rather than waiting out
   * `fallbackDelay`, which exists only to cover a load that is still PENDING.
   *
   * Guarded on `disposed`: a level that died mid-load must not be handed visible
   * geometry on its way out.
   */
  _giveUpOnModels() {
    if (this.disposed) return;
    this._settled = true;
    this.fallback.visible = true;
  }

  /**
   * One InstancedMesh per variant per colour for the tint, plus one per variant
   * for the base.
   *
   * WHY IT IS SPLIT BY COLOUR — worth being explicit, because the plan flagged it
   * as a blocker. Per-instance colour needs `instanceColor`, and the toon shader
   * is custom and does not read it. The alternatives were to change Lethabo's
   * shader (another lane) or to drop per-prop colour on the models (which would
   * delete the whole point of the system).
   *
   * Neither is necessary: the colour already lives in a shared material, so a
   * prop changes colour by MOVING to a different InstancedMesh that renders the
   * same geometry with a different material. The cost is one draw call per colour
   * per variant — fixed, whatever the instance count. The base parts share one
   * material that never changes, so they are one call per variant, not four.
   */
  _buildInstances() {
    const colours = Object.keys(this.palette.tint);

    for (const variant of this.variants) {
      const bucketSet = {};

      if (variant.base) {
        bucketSet.base = this._newBucket(variant.base, this.palette.base, 'base', 'baseSlot');
      }
      for (const colour of colours) {
        if (variant.tint) {
          bucketSet[colour] = this._newBucket(variant.tint, this.palette.tint[colour], colour, 'tintSlot');
        }
      }

      this.buckets.push(bucketSet);
    }

    // Hand out variants round-robin so the mix along the corridor is even, rather
    // than "all the pines at the start". Every prop starts grey.
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      prop.variant = i % this.variants.length;

      const bucketSet = this.buckets[prop.variant];
      // TWO bucket families per prop, and they need SEPARATE slot numbers: a prop
      // in base slot 3 is not necessarily in tint slot 3, and sharing one field
      // would corrupt both free lists.
      if (bucketSet.base) this._add(prop, bucketSet.base);
      if (bucketSet.grey) {
        this._add(prop, bucketSet.grey);
        // Every prop starts grey, and this is what tells `_apply` that it is on
        // the instanced path rather than the fallback one.
        prop.bucket = bucketSet.grey;
      }
    }
  }

  /**
   * A draw call, with a SWAP-REMOVE free list.
   *
   * `count` is only ever raised to the number of props actually in the bucket, so
   * a colour nothing is using costs nothing to draw. When a prop leaves, the last
   * live instance is moved into the hole rather than leaving a zero-scaled
   * instance behind — a hidden instance still runs its vertex shader.
   */
  _newBucket(geometry, material, kind, slotField) {
    const mesh = new THREE.InstancedMesh(geometry, material, this.props.length);
    mesh.count = 0;
    mesh.name = `decor-${this.kind}-${kind}`;
    // Frustum culling stays ON, and this is worth understanding before anyone
    // "optimises" it away. An InstancedMesh culls against ITS OWN bounding
    // sphere, which starts as the base geometry's — one prop at the origin — so
    // out of the box it is either always-in or always-out, and the tempting fix
    // is `frustumCulled = false`. That is a trap: it makes every one of the 377
    // props in this level be submitted every frame no matter where the camera
    // points. three.js can compute the real sphere by unioning each instance's
    // (computeBoundingSphere does exactly that), so `_add` and `_remove` call it
    // whenever membership changes and the culler gets the truth.
    this.models.add(mesh);

    return {
      mesh, material, kind, slotField, live: 0,
      slots: new Array(this.props.length),
    };
  }

  _add(prop, bucket) {
    const index = bucket.live;
    bucket.live += 1;
    bucket.slots[index] = prop;
    prop[bucket.slotField] = index;

    this._writeInstance(bucket, index, prop);
    bucket.mesh.count = bucket.live;
    bucket.mesh.instanceMatrix.needsUpdate = true;
    // only the first `count` instances are real, so the sphere has to be
    // recomputed AFTER the count moves
    bucket.mesh.computeBoundingSphere();
  }

  /** Swap the prop out of a bucket without leaving a dead instance behind. */
  _remove(prop, bucket) {
    const slot = prop[bucket.slotField];
    const last = bucket.live - 1;
    const moved = bucket.slots[last];

    bucket.slots[slot] = moved;
    moved[bucket.slotField] = slot;
    bucket.live = last;

    if (moved !== prop) this._writeInstance(bucket, slot, moved);
    bucket.mesh.count = last;
    bucket.mesh.instanceMatrix.needsUpdate = true;
    // the prop that left may have been the outlier that grew this bucket's
    // sphere; without this the bucket keeps culling as if it were still there
    bucket.mesh.computeBoundingSphere();
  }

  _writeInstance(bucket, index, prop) {
    this._position.set(prop.x, prop.y, prop.z);
    this._quaternion.setFromAxisAngle(this._axisY, prop.rotY);
    // Both the code shapes and the GLB variants are modelled from the ground up
    // after baking, so the instance scale IS the prop scale.
    this._scale.setScalar(prop.scale);
    this._matrix.compose(this._position, this._quaternion, this._scale);
    bucket.mesh.setMatrixAt(index, this._matrix);
  }

  // -------------------------------------------------------------------------
  // The reaction
  // -------------------------------------------------------------------------

  /**
   * Decide the fallback's fate, once, after `fallbackDelay` seconds of level
   * time.
   *
   * Driven by the level's own update loop rather than a `setTimeout`, for the
   * usual reasons in this codebase: no timer to leak, nothing keeping a Node
   * test process alive, and the clock only runs when the game does. A level that
   * is disposed before the delay elapses simply never reveals anything.
   */
  _settle(dt) {
    if (this._settled || this.disposed) return;
    this._sinceBuild += dt;
    if (this._sinceBuild < DECOR.fallbackDelay) return;

    this._settled = true;
    // only if the models have not arrived — if they have, `_load` already hid
    // this and there is nothing to do
    if (this.modelCount === 0) this.fallback.visible = true;
  }

  /**
   * The level's per-frame entry point.
   *
   * Two independent jobs, and the settle check runs FIRST because it is about
   * the level becoming visible while the reaction is about paint:
   *   - decide whether the fallback props come out (see `_settle`)
   *   - re-colour whatever the player has painted near (see `_react`)
   */
  update(dt, playerPosition) {
    this._settle(dt);
    return this._react(dt, playerPosition);
  }

  /**
   * Re-colour the props near the player from the paint they are standing on.
   *
   * Returns how many changed, which is what the tests assert on — a "did anything
   * happen" signal is worth more than a silent void here.
   */
  _react(dt, playerPosition) {
    this._sinceCheck += dt;
    if (this._sinceCheck < DECOR.reactInterval) return 0;
    this._sinceCheck = 0;

    const r2 = DECOR.reactRadius * DECOR.reactRadius;
    let changed = 0;

    // indexed loop: `for...of` allocates an iterator object per call, and this
    // runs on a heartbeat for the whole life of the level.
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i];
      if (!prop.floor) continue;

      // Distance in XZ only: a prop on the platform above the player is still
      // "near" in the way a player means it, and y would make a tall level look
      // like sparse cover.
      const dx = prop.x - playerPosition.x;
      const dz = prop.z - playerPosition.z;
      if (dx * dx + dz * dz > r2) continue;

      const name = ID_TO_NAME[prop.floor.paintIdAtWorld(this._base.set(prop.x, prop.y, prop.z))];
      if (name === prop.paintName) continue;

      this._apply(prop, name);
      changed += 1;
    }

    return changed;
  }

  /**
   * Point the prop at a different shared material.
   *
   * The two branches are the whole reason placement does not own meshes: the
   * fallback swaps the MATERIAL on its tint meshes, the models move the prop to
   * another bucket. Everything above this line is identical.
   */
  _apply(prop, name) {
    prop.paintName = name;

    if (prop.bucket) {
      const next = this.buckets[prop.variant][name];
      if (next && next !== prop.bucket) {
        this._remove(prop, prop.bucket);
        this._add(prop, next);
        prop.bucket = next;
      }
      return;
    }

    if (prop.parts) {
      for (const part of prop.parts) part.material = this.palette.tint[name];
    }
  }

  dispose() {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Model baking
// ---------------------------------------------------------------------------

/**
 * Pull the individual props out of a loaded model file, as base/tint geometry
 * sources.
 *
 * GROUPING RULE: a prop is one parent node holding its primitives. That is how
 * FBX2glTF exports a multi-primitive mesh — the glTF mesh carries several
 * primitives, so three.js hands back a Group named after the node with one child
 * Mesh per primitive.
 *
 * The obvious first attempt — walk up to the topmost ancestor below the scene —
 * is WRONG, and wrong in a way that looks fine: every mesh in a file that packs
 * several models (the tree packs do) shares one topmost ancestor, so all of them
 * collapse into a single "variant" dozens of primitives wide.
 *
 * Which primitive is base and which is tint is read off the MATERIAL name; see
 * BASE_PART.
 */
export function collectVariants(gltf) {
  const byProp = new Map();

  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;

    const key = object.parent ?? gltf.scene;
    if (!byProp.has(key)) byProp.set(key, []);
    byProp.get(key).push(object);
  });

  const variants = [];
  for (const meshes of byProp.values()) {
    let base = meshes.filter((m) => BASE_PART.test(m.material?.name ?? ''));
    let tint = meshes.filter((m) => !base.includes(m));

    // EVERY prop must be paintable. A model whose parts are all "base" material
    // names — `log.glb` is Wood + LightWood, both of them — would otherwise get a
    // base and no tint, never be handed a bucket, and sit grey for the whole
    // level. That is the one thing this system exists to prevent, so when there
    // is nothing to tint, the whole prop becomes the tint.
    if (tint.length === 0) {
      tint = meshes;
      base = [];
    }

    variants.push({
      base: base.length ? base : null,
      tint: tint.length ? tint : null,
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
 * Bake one variant into a usable, shared pair of shapes.
 *
 * Three things have to be undone, and every one is an artefact of the export
 * rather than anything the modeller intended:
 *
 *   1. **The strip offset.** In a packed file one variant sits at x = 176.
 *      Applied as-is, the prop stands 176 metres to the side of its own position.
 *   2. **The unit scale and the Z-up node rotation.** Both live on the node, not
 *      the mesh, so the geometry alone looks tiny and sideways. `rocks.glb` is
 *      0.30 units tall and `rock-large.glb` is 7.67: there is no usable number in
 *      either, which is why every variant is normalised to the kind's height.
 *   3. **The pivot.** Every variant has its origin somewhere different, one at
 *      y = -0.32 and another at 0. Nothing can be placed on the ground until the
 *      base is at y = 0 and it is centred on the origin.
 *
 * The same matrix is applied to both parts, so a prop's dark part and its tinted
 * part cannot end up in different places. And the parts are MERGED: a bush with
 * three leaf primitives is one draw call, not three.
 *
 * @param {THREE.BufferGeometry[]} into the kind's geometry list, so dispose() frees them
 */
function bakeVariant(variant, height, into) {
  const parts = [variant.base, variant.tint].filter(Boolean).flat();

  const box = worldBounds(parts);

  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;

  // final = scale x recentre, applied OUTSIDE each mesh's own world matrix: that
  // matrix is where the strip offset and the unit scale live.
  const normalise = new THREE.Matrix4()
    .makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale));

  const bake = (meshes) => {
    if (!meshes) return null;

    const baked = meshes.map((mesh) => {
      // position + normal only. This is a flat-toon art direction, so UVs are
      // never sampled; and a matching attribute set is what lets several
      // primitives merge into one geometry.
      const geometry = clean(mesh.geometry);
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalise, mesh.matrixWorld));
      return geometry;
    });

    const merged = baked.length > 1 ? mergeGeometries(baked) : baked[0];
    if (merged !== baked[0]) for (const g of baked) g.dispose();

    merged.computeBoundingSphere();
    into.push(merged);
    return merged;
  };

  const baked = { base: bake(variant.base), tint: bake(variant.tint) };

  // the source geometry is dead once it is baked — do not leave tens of
  // thousands of vertices of GPU buffers behind for every rejected variant
  for (const mesh of parts) mesh.geometry.dispose();
  return baked;
}

/** position + normal, and indexed, so any two primitives can be merged. */
function clean(geometry) {
  const out = geometry.clone();
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  return out.index ? out : out.toNonIndexed();
}

/**
 * The true world-space bounds of some meshes — every VERTEX, not the box corners.
 *
 * This is not the same thing, and the difference is not academic.
 * `Box3.setFromObject` transforms the geometry's bounding box by the world
 * matrix, which is only correct when that matrix has no rotation. These exports
 * are Z-up models rotated into Y-up, so the corner-transformed box is strictly
 * larger than the model. Sizing a prop from it makes the prop slightly too small,
 * and — worse — centring from it leaves every prop a few millimetres off its own
 * origin, which the model test catches.
 */
function worldBounds(meshes) {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(point);
    }
  }

  return box;
}
