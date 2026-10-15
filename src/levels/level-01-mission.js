// OWNER: E (Levels)
// L1 — "THE BRIEFING". Linear corridor mission, objective markers, extraction point.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: it is the only level with
// generous paint. The player is LEARNING that colour changes physics.
// Enemies: Sprayer, Charger. No armour. Low count.
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { PaintSurface } from '../paint/paint-surface.js';
import { PAINT, ENEMY, PAINT_GRID } from '../config.js';
import { Enemy } from '../enemies/enemy.js';
import { Forest } from './forest.js';

/**
 * Layout numbers, named so the blockout is iterable — tune here, re-test.
 * Full-width corridor (x −8…8) so no gate can be bypassed sideways.
 *
 * Route (z runs +18 → −30): start island → jump Gap 1 → island B (Charger,
 * blue run-up) → [gate B: clear island B] → blue + RED PAD super jump over
 * Gap 2 → island C (Sprayer + Charger, red pad) → red launch onto the
 * platform → [gate C: clear island C] → green climb the wall → extraction.
 */
const L1 = {
  corridorHalf: 8,            // full width 16
  cells: PAINT_GRID.level1Cells,
  spawn: { x: 0, y: 2, z: 13 },

  islands: {
    A: { zMin: 8,   zMax: 18  },  // start — spawn + fall respawn land here
    B: { zMin: -7,  zMax: 4.5 },  // middle — deep: Charger fight + blue run-up
    C: { zMin: -24, zMax: -16 },  // red pad → platform
  },

  platform: { zMin: -23, zMax: -17, y: 4, width: 8 },  // red required (jump apex 1.39m)
  wall:     { yBase: 4, yTop: 9, z: -24 },             // green required, full width
  ledge:    { zMin: -30, zMax: -19, y: 9 },            // walkable; protrudes so the wall jump-off lands
  extraction: { zMin: -30, zMax: -24 },                // win zone (back of the ledge, past the wall)

  // Encounter gates (#37 island B, #56 island C): an arena's exit stays sealed
  // until that arena is clear, so the fight has to be won rather than run past.
  //
  // Both are full-width VERTICAL panels — the only barrier the engine stops
  // (see `_gate()`), which is why island C's sits on the platform lip rather
  // than over the launch. `yTop` is taller than a red bounce
  // (minBounce 15 -> apex ≈4.3 m) so neither can be hopped.
  gates: {
    B: { yTop: 6 },    // island B's front edge — seals the way to Gap 2
    C: { yTop: 10 },   // the platform lip, from y 4 — seals the way to the wall
  },

  beacons: [                  // colour-coded to the paint each gate asks for
    { colour: 'blue',  x: 0, y: 2,    z: -4.5 },   // island B — the blue run-up
    { colour: 'red',   x: 0, y: 2,    z: -11.5 },  // Gap 2 — the launch colour
    { colour: 'red',   x: 0, y: 5,    z: -17 },    // platform
    { colour: 'green', x: 0, y: 10.5, z: -24 },    // wall
  ],

  // DESIGN.md teaching beats, not just spawn points:
  //   Charger  — island B. 5 m/s, 25 contact. The answer is paint BLUE: it
  //              slides straight past. That patch is also the Gap 2 run-up.
  //   Sprayer  — island C. Slower (10 damage) pressure while you paint red.
  //   Charger  — island C, a second one (#36). A 2.5 m/s enemy is not pressure
  //              — you outrun it without trying — so the red paint both island C
  //              tasks need was free. This one asks island B's question again:
  //              paint blue, or eat 25 while you stand still?
  // Spawns are a starting hint, not a hold: there is no aggro radius, so enemies
  // walk at the player from load and freeze where the next step would fall off.
  // Where they start only sets the line they take to that edge — which is how
  // the two on island C end up flanking it.
  spawns: [
    { x: 4,  y: 0, z: -1,  type: 'charger' },
    { x: -4, y: 0, z: -21, type: 'sprayer' },
    { x: 5,  y: 0, z: -22, type: 'charger' },
  ],

  // The forest. Hand-placed, because the rules are not geometric:
  //
  //   - every tree must stand ON a floor. A tree over a gap floats, and that is
  //     the one thing about the mist-free gaps a player will notice instantly.
  //     `tests/level-01-forest.test.js` checks this for every entry.
  //   - keep x away from 0. The route runs down the middle of the corridor, and
  //     trees sit at +/-5.5 to 6.5 so they frame the path without standing in it.
  //   - trees do not collide (see `_forest()`), so they can never block the Gap 1
  //     jump or trap the player against the Charger.
  //   - `scale` gives size variety for free. Nothing else changes per tree.
  //
  // y is the floor the tree stands on: 0 for the islands, 4 for the platform,
  // 9 for the extraction ledge.
  forest: [
    // island A — the approach, and a backdrop behind the spawn
    { x: -6.0, y: 0, z: 17.0, scale: 1.3 },
    { x: -6.5, y: 0, z: 13.0, scale: 1.0 },
    { x: -5.5, y: 0, z:  9.5, scale: 0.85 },
    { x:  6.0, y: 0, z: 16.0, scale: 1.15 },
    { x:  6.5, y: 0, z: 11.0, scale: 0.95 },

    // island B — the Charger arena. Edge trees only, so the fight stays readable.
    { x: -6.5, y: 0, z:  3.0, scale: 1.2 },
    { x: -6.0, y: 0, z: -1.5, scale: 0.9 },
    { x: -6.5, y: 0, z: -5.5, scale: 1.05 },
    { x:  6.5, y: 0, z:  2.0, scale: 1.1 },
    { x:  6.0, y: 0, z: -3.5, scale: 0.95 },
    { x:  6.5, y: 0, z: -6.0, scale: 1.25 },

    // island C — the Sprayer's ground
    { x: -6.0, y: 0, z: -17.5, scale: 1.0 },
    { x: -6.5, y: 0, z: -21.0, scale: 1.3 },
    { x:  6.5, y: 0, z: -18.5, scale: 0.9 },
    { x:  6.0, y: 0, z: -22.5, scale: 1.15 },

    // the platform and the ledge above it — the world does not stop at y 0
    { x: -3.0, y: 4, z: -21.0, scale: 0.8 },
    { x:  3.0, y: 4, z: -19.0, scale: 0.8 },
    { x: -6.0, y: 9, z: -28.0, scale: 1.1 },
    { x:  6.0, y: 9, z: -26.0, scale: 1.0 },
  ],
};

/**
 * The mood palette. Tune NUMBERS here, not code.
 *
 * The important idea: fog colour must match the HORIZON, not the whole
 * background. An earlier attempt set `scene.background` to the fog colour,
 * which is wrong for two reasons:
 *
 *   1. The background is not all fog. Sky above the horizon is thin air, and
 *      the pits below it are not foggy at all — so painting all of it the fog
 *      colour makes the whole screen a flat plate that can never receive fog.
 *      That reads as a grey filter over the screen, not as atmosphere.
 *   2. A background colour is a single value that never varies with distance.
 *      Fog's entire job is to vary with distance. They cannot be the same
 *      thing and both be right.
 *
 * So the sky is a three-band gradient (dome, below) and only its horizon band
 * matches the fog. Distant geometry then dissolves into the horizon, while the
 * sky above it and the pits below it stay their own colour.
 */
const MOOD = {
  horizon: 0x8a93a3,   // the haze: what distance fades toward. Matches the sky's horizon band.
  zenith:  0x232a38,   // drained sky overhead — deliberately NOT the haze colour
  void:    0x12141b,   // below the horizon: the pits are dark, not foggy
  fogNear: 12,         // beyond the TPV camera's 6.5 offset, so the player never fogs
  fogFar:  60,

  // Where the drifting mist sheets lie. They are CENTRED on mistZ and
  // mistLength is their full length, so these two numbers decide which parts of
  // the corridor look misty. The texture fades out over the outer fifth of each
  // end, so visible mist really starts about 20% in from the edge.
  //
  // -13 / 42 puts that fade edge exactly on island A's far edge (z = 8), which
  // is what keeps the whole spawn island clear. That is deliberate: the spawn is
  // where the player learns jump distance, and Gap 1 is the weakest jump in the
  // level, so mist there is difficulty rather than atmosphere.
  mistZ: -13,
  mistLength: 42,

  // The direction the world is lit from, as ONE value. It mirrors the sun in
  // main.js (`sun.position.set(18, 30, 12)`), and both the ground and the props
  // now read it, so they cannot disagree (#57).
  //
  // Why the level carries a copy at all: the paint shader and the toon shader
  // are custom and do NOT read scene lights. Each carries its own `uLightDir`
  // uniform. The paint shader's built-in default is already very close to this
  // vector, so matching it is about making drift impossible rather than about a
  // big visible change today.
  sunDir: [18, 30, 12],

  // The fill light. Cold, and from the opposite side to the sun so props get
  // some shape back without flattening the sun's direction.
  //
  // HONEST SCOPE: this only affects meshes using three.js's OWN lit materials.
  // In L1 today that is just the player. The ground, the gates and the enemies
  // all use custom shaders that ignore scene lights entirely — they read
  // `sunDir` through their uniforms instead. So this light is close to
  // invisible right now, and it starts earning its place when the animated GLB
  // characters land (#49, #50), which must use built-in materials.
  fillColour: 0x9fb0bb,
  fillIntensity: 0.45,

  // The trees are NOT here. Their colours and their reaction to paint are the
  // forest module's business (`./forest.js`), because they are not mood: the
  // canopy changes while you play, and the sky does not.
};
// Deliberately NOT here: the HEIGHT of the mist. That is FOG_FLOOR / FOG_CEIL
// in src/shaders/fog-height.js, because it has to reach three materials
// (paint, toon, outline) and the enemies, not just this level's surfaces.

/** GLSL's smoothstep, for the sky gradient. Kept local: this is its only user. */
function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * A soft mist alpha map, built in code.
 *
 * Constraints that shaped this, all of them real:
 *
 *  - NO DOM. `tests/level-contract.test.js` calls `load()` under `node --test`
 *    with no `document`, so a CanvasTexture would throw and take the whole
 *    suite with it. A DataTexture built from arithmetic works in both.
 *  - NO Math.random. Integer-frequency sine stacks are identical every run, so
 *    nothing shimmers between reloads and the texture is reproducible.
 *  - Edge falloff baked in. Alpha eases to 0 at all four borders, so the slab
 *    has no hard rectangle edge AND scrolling it wraps seamlessly: the band
 *    that wraps in is already transparent.
 *  - White RGB + varying ALPHA, bound as `map` — not `alphaMap`. `dispose()`
 *    frees `material.map` but not `material.alphaMap`, so alphaMap would leak
 *    one texture per mist layer per restart, which is what the Phase 5 leak
 *    gate exists to catch.
 */
function createMistTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const TAU = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // three octaves of smooth noise; integer frequencies so it would tile
      let n = 0;
      n += Math.sin((u * 3 + v * 2) * TAU) * 0.34;
      n += Math.sin((u * 7 - v * 5) * TAU) * 0.20;
      n += Math.sin((u * 13 + v * 11) * TAU) * 0.11;

      // centre on "half mist", then ease so the sheet has real holes in it
      let a = 0.5 + n;
      a = a * a * (3 - 2 * a);

      // fade to nothing at the borders (see note above)
      const edge = smoothstep(0, 0.20, u) * smoothstep(0, 0.20, 1 - u)
                 * smoothstep(0, 0.20, v) * smoothstep(0, 0.20, 1 - v);

      const value = Math.round(Math.min(1, Math.max(0, a * edge)) * 255);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = value;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Level01 extends LevelBase {
  async load() {
    for (const { zMin, zMax } of Object.values(L1.islands)) {
      this._floor(zMin, zMax, 0);
    }
    this._floor(L1.platform.zMin, L1.platform.zMax, L1.platform.y, L1.platform.width);
    this._floor(L1.ledge.zMin, L1.ledge.zMax, L1.ledge.y);

    this._wall();
    this._beacons();
    this._extraction();
    this._mood();
    this._light();
    this._forest();

    this.spawn.set(L1.spawn.x, L1.spawn.y, L1.spawn.z);

    this.spawnPoints = L1.spawns.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this._spawnEnemies();

    // Gates go up after the enemies exist so each one can take its own watch
    // list. A gate waits only on the enemies that SPAWN inside its own arena:
    // island C's pair must not hold island B's gate shut, or the other way
    // round. `z` and `yBase` come from the layout, never repeated as numbers.
    this.gateB = this._gate({
      arena: 'B', z: L1.islands.B.zMin, yBase: 0, yTop: L1.gates.B.yTop,
    });
    this.gateC = this._gate({
      arena: 'C', z: L1.platform.zMin, yBase: L1.platform.y, yTop: L1.gates.C.yTop,
    });
    this.gates = [this.gateB, this.gateC];

    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      gate.watch = this.enemies.filter((e) => this._inIsland(gate.arena, e.position));
    }

    // Last, once EVERY surface exists — the gates are built just above, and they
    // are paint surfaces too. Miss them and the gate faces would be lit from a
    // different direction than the floor they stand on.
    this._lightDirection();
  }

  /**
   * The level owns its mood: the sky, the distance haze, and the mist that sits
   * on the ground. Three separate things, deliberately not collapsed into one.
   *
   * Lessons from the two failed attempts, kept because both looked plausible:
   *
   *   1. The original bug was `near`, not the colour. main.js sets
   *      Fog(0x0f0f16, 45, 110) app-wide, but L1 is only ~48 units from spawn
   *      to the back ledge, so a near plane at 45 never engaged and nothing was
   *      ever fogged. No colour change could have fixed that.
   *
   *   2. Fog colour ≠ background colour. Setting them equal makes the sky a
   *      flat plate that can never receive fog — a grey filter over the whole
   *      screen. Fog has to match the HORIZON specifically, which is what the
   *      sky dome's haze band is for. See MOOD.
   *
   *   3. Fog tints geometry only; it has no volume. However it is tuned it can
   *      never put mist IN THE AIR or ON THE FLOOR. That needs geometry, which
   *      is why `_groundFog()` exists.
   *
   * Lane note: both helpers are plain meshes owned by the level, so this stays
   * inside `levels/`. The sky is vertex-coloured rather than a ShaderMaterial
   * specifically to avoid adding a file under `shaders/` (Lethabo's lane). If
   * the sky later wants a real shader, that is the handover point.
   */
  _mood() {
    // Everything here is "air" rather than level geometry: the sky dome and the
    // mist sheets. Grouped so main.js can hide the whole lot in one line for the
    // minimap pass — fog is not useful in a top-down map, and without this the
    // sheets render as a grey wash straight over the level.
    this.atmosphere = new THREE.Group();
    this.root.add(this.atmosphere);

    this._sky();
    this.game.scene.fog = new THREE.Fog(MOOD.horizon, MOOD.fogNear, MOOD.fogFar);
    // Base clear colour only; the dome covers it. This is what shows if a
    // camera ever clips the dome — the minimap's far plane, for instance.
    this.game.scene.background = new THREE.Color(MOOD.void);
    this._groundFog();
  }

  /**
   * A gradient sky dome — the piece that lets fog have its own colour.
   *
   * Three vertex-coloured bands: dark below the horizon, haze at it, drained
   * dark above it. Vertex colours rather than a fragment shader because 32x20
   * segments is plenty for a gradient, and it keeps a custom shader out of
   * `shaders/`.
   *
   * `fog: false` is load-bearing. The dome sits at radius 200, far past
   * fogFar, so with fog enabled the entire sky would be 100% fogged and would
   * collapse straight back into the flat plate we are trying to avoid.
   *
   * `depthWrite: false` so a 200-unit sphere can never occlude real geometry.
   */
  _sky() {
    const R = 200;
    const geo = new THREE.SphereGeometry(R, 32, 20);
    const horizon = new THREE.Color(MOOD.horizon);
    const zenith = new THREE.Color(MOOD.zenith);
    const below = new THREE.Color(MOOD.void);
    const c = new THREE.Color();

    const pos = geo.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // 0 at the bottom pole, 1 at the top. The horizon sits at 0.5.
      const ny = (pos.getY(i) / R + 1) / 2;
      // The haze band is deliberately BROAD. The wall and the gates sit about
      // 11 degrees above the horizon, which is ~0.6 here. A narrow band would
      // leave them fogged to pale grey but silhouetted against dark sky — the
      // "painted gate" artefact all over again.
      const up = smoothstep(0.50, 0.80, ny);
      const down = 1 - smoothstep(0.30, 0.50, ny);
      c.copy(horizon).lerp(zenith, up).lerp(below, down);
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));

    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }));
    this.atmosphere.add(sky);
    return sky;
  }

  /**
   * Drifting mist sheets just above floor level — the "fog on the ground".
   *
   * A horizontal quad seen from a camera ~2 m up reads as a haze band lying
   * along the floor and receding into the distance, which is what ground fog
   * actually looks like. Three layers at different heights, opacities and
   * speeds give parallax, so the mist drifts rather than sliding as one sheet.
   *
   * The quads are wider and longer than the corridor on purpose: the texture's
   * baked edge falloff fades the mist out well before the geometry's edge, so
   * the quad's real outline is never visible.
   *
   * Spanning the gaps is intentional — fog pooling in the chasms is the point.
   * Where they sit along the corridor is MOOD.mistZ / MOOD.mistLength, and the
   * fade is tuned to stop before the spawn island; see the note on MOOD.
   */
  _groundFog() {
    this.mist = [];
    const tint = new THREE.Color(MOOD.horizon);

    const layers = [
      { y: 0.35, opacity: 0.30, speed: 0.010 },
      { y: 0.70, opacity: 0.22, speed: -0.016 },
      { y: 1.05, opacity: 0.15, speed: 0.022 },
    ];

    for (const layer of layers) {
      const map = createMistTexture(128);
      map.offset.set(layer.y * 0.13, layer.y * 0.29);   // desync the layers

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(L1.corridorHalf * 2 + 6, MOOD.mistLength),
        new THREE.MeshBasicMaterial({
          map,
          color: tint,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, layer.y, MOOD.mistZ);
      this.atmosphere.add(mesh);
      this.mist.push({ map, speed: layer.speed });
    }
  }

  /**
   * The level's own light rig.
   *
   * Read the MOOD note first: the ground and the enemies are custom shaders and
   * do NOT read scene lights, so this fill only reaches meshes using three.js's
   * own lit materials — today that is just the player. It is here because #57
   * asks for it, and because it is what the animated GLB characters will read
   * (#49, #50), not because it changes much on screen right now.
   *
   * Added to `this.root` like every other level object, so it is removed with
   * the level instead of quietly stacking up on every restart.
   */
  _light() {
    const fill = new THREE.DirectionalLight(MOOD.fillColour, MOOD.fillIntensity);
    // Opposite side to the sun and a little lower, so props get some shape back
    // without flattening the sun's own direction.
    fill.position.set(-18, 12, -12);
    // The sun is the only shadow caster. A second shadow map is a cost we do not
    // need for a light that is meant to be soft.
    fill.castShadow = false;
    this.root.add(fill);
    return fill;
  }

  /**
   * Point every custom-shaded surface at the same sun the scene uses (#57).
   *
   * This is the item that actually matters for "the ground and the props are lit
   * from the same side", because the ground does not read scene lights at all —
   * it reads its own `uLightDir` uniform, and its default is only *nearly* the
   * sun's vector. Two nearly-equal numbers is exactly the kind of thing that
   * drifts apart over three levels, so it is set from one place now.
   *
   * The FOREST used to be missed here, and that was a real bug rather than a
   * tidy-up: `createToonMaterial`'s own default is (0.5, 1.0, 0.3), which
   * normalises to (0.431, 0.863, 0.259), and the sun normalises to
   * (0.485, 0.808, 0.323). Not the same direction — so every tree in the level
   * was lit from somewhere the ground was not, and the surface-only walk below
   * was why the test never noticed. The forest now hands over its materials and
   * the loop covers them too.
   *
   * Called at the END of load(), after the gates and the forest exist. Both are
   * built late — miss one and its faces are lit from a different direction than
   * the floor they stand on.
   */
  _lightDirection() {
    const dir = new THREE.Vector3(
      MOOD.sunDir[0], MOOD.sunDir[1], MOOD.sunDir[2],
    ).normalize();
    this.sunDir = dir;   // kept: future code (telegraphs, tree reactions) wants it

    for (let i = 0; i < this.surfaces.length; i++) {
      const uniform = this.surfaces[i].material.uniforms.uLightDir;
      if (uniform) uniform.value.copy(dir);
    }

    // the trees, which are custom-shaded too and were the miss described above
    for (let i = 0; i < this.forest.materials.length; i++) {
      this.forest.materials[i].uniforms.uLightDir.value.copy(dir);
    }
  }

  /**
   * The forest.
   *
   * The shapes, the materials and the reaction to paint live in `./forest.js`
   * — this method is only the wiring: hand it the placement table and the
   * walkable floors, and hang it off `this.root` so dispose() frees it.
   *
   * The placement table is the design; the module is the machinery. That split
   * is what lets step 5 (instanced GLB models) change how a tree is drawn
   * without moving a single tree.
   */
  _forest() {
    this.forest = new Forest(this.root, L1.forest);

    // Only walkable surfaces — see Forest.build. The wall is a PaintSurface too,
    // and a tree that "stands on" the wall stands inside it.
    this.forest.build(this.surfaces.filter((s) => s.isFloor));

    return this.forest.trees.map((t) => t.mesh);
  }

  update(dt, player) {
    // Pass the position, not the player: Enemy.update does arithmetic on what
    // it receives, and a Player object has no x/y/z.
    // indexed loop: `for...of` allocates an iterator object per call until V8
    // optimises it away, and this runs every frame.
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(dt, player.position);
    }

    // Drift the ground mist. This moves the texture OFFSET, not the mesh, so it
    // is one matrix update per layer and allocates nothing — the same
    // discipline as the enemy loop above, which has its own allocation test.
    // Offsets wrap into 0..1 so a long session cannot drift into float rubble.
    for (let i = 0; i < this.mist.length; i++) {
      const m = this.mist[i];
      const step = m.speed * dt;
      const ox = m.map.offset.x + step;
      const oy = m.map.offset.y + step * 0.4;
      m.map.offset.x = ox >= 1 ? ox - 1 : (ox < 0 ? ox + 1 : ox);
      m.map.offset.y = oy >= 1 ? oy - 1 : (oy < 0 ? oy + 1 : oy);
    }

    // The forest wakes up where the player paints. It runs its own heartbeat
    // (see Forest.update) rather than reading the grid every frame.
    this.forest.update(dt, player.position);

    // Encounter gates: an arena's exit opens the moment that arena is clear.
    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      if (!gate.open && this._arenaCleared(gate)) this._openGate(gate);
    }

    // Extraction fires the win exactly once, guarded by `_complete` — and only
    // once island C is clear. Its panel can be green-climbed over (see
    // `_gate()`), so the panel alone cannot be the enforcement; this can.
    if (!this._complete && this.extraction && this.extraction.containsPoint(player.position)
        && this._arenaCleared(this.gateC)) {
      this._complete = true;
      this.game.onWin?.();
    }
  }

  /**
   * Attach enemies under `this.root`, not `game.scene`, so the base traverse
   * in dispose() frees them along with everything else.
   *
   * Still guarded: a throw here would silently produce an empty `enemies`
   * array, which looks exactly like "the enemies are just not there yet".
   */
  _spawnEnemies() {
    try {
      // Only walkable surfaces — the probe treats every entry as a floor to
      // stand on, and a wall in that list would be a floor you stand on top of.
      const floors = this.surfaces.filter((s) => s.isFloor);

      for (const { x, y, z, type } of L1.spawns) {
        const config = ENEMY[type] ?? ENEMY.sprayer;
        this.enemies.push(
          new Enemy({
            position: new THREE.Vector3(x, y, z),
            config,
            parent: this.root,
            floors,
          }),
        );
      }
    } catch (err) {
      console.error('[Level01] enemy spawn failed, running without enemies:', err);
      this.enemies = [];
    }
  }

  dispose() {
    // Enemies may own GPU resources not attached to `root` — free them first,
    // then let the base traverse dispose every mesh/material/texture under root.
    for (const enemy of this.enemies) enemy.dispose?.();
    super.dispose();
  }

  /** A flat, walkable paint surface on the XZ plane. `height` is world Z depth. */
  _floor(zMin, zMax, y = 0, width = L1.corridorHalf * 2) {
    const s = new PaintSurface({ width, height: zMax - zMin, cells: L1.cells });
    s.mesh.rotation.x = -Math.PI / 2;
    s.mesh.position.set(0, y, (zMin + zMax) / 2);
    s.mesh.receiveShadow = true;
    s.isFloor = true;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /** The hard gate: a full-width vertical panel, climbable only when green. */
  _wall() {
    const { yBase, yTop, z } = L1.wall;
    const s = new PaintSurface({ width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /**
   * One encounter gate (#37 island B, #56 island C): a full-width vertical panel
   * seals its arena's exit until the arena is clear, so the fight has to be won
   * rather than run past.
   *
   * It is a paint surface because that is the only thing that collides (see
   * `_resolveWalls`). It is deliberately NOT a paint puzzle: painting it
   * changes nothing that gets you through. That is the L1 version of "not
   * every obstacle is a colour answer" (cf. the L2 turret).
   *
   * VERTICAL on purpose, and that is a hard constraint, not a preference:
   * `_resolveWalls` (player.js) pushes the player out along x/z and never
   * resolves y, so a horizontal panel is pass-through and seals nothing. A gate
   * can therefore only block a *horizontal* route. Consequence here: the red
   * launch off island C is vertical, so it cannot be gated at all — island C's
   * gate has to sit one step further along, on the platform lip.
   *
   * Corollary worth knowing before moving either gate: a panel is climbable
   * once it is painted green (climbing only needs `rules.climbable`, and
   * `PaintSurface` has no unpaintable option), so a determined player can go
   * over the top. #37 was allowed that — it leads nowhere. Island C's gate is
   * the first whose far side is the win, which is why the win also waits on
   * `_arenaCleared(this.gateC)`: a check that cannot be climbed.
   */
  _gate({ arena, z, yBase, yTop }) {
    const s = new PaintSurface({ width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);

    // Lock light above the door. A wide bar, not the 0.7x2.2x0.7 beacon shape:
    // the beacons mean "paint this colour", and this is not one of those.
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
    );
    light.position.set(0, yTop + 1, z);
    this.root.add(light);

    return { arena, surface: s, light, open: false, watch: [] };
  }

  /**
   * An arena releases its gate when every enemy in it is dead OR has left it.
   *
   * The second case is the soft-lock guard #37 asks for: a red hit flings an
   * enemy with no gravity (`enemy.js` `_applyKnockback`), so a Charger knocked
   * into a gap floats out there alive forever. Waiting only on `alive` would
   * shut the level down permanently.
   */
  _arenaCleared(gate) {
    return gate.watch.every((e) => !e.alive || !this._inIsland(gate.arena, e.position));
  }

  /** Is a world point on island `key` (A, B, C)? Slack at the edges so "on the lip" counts. */
  _inIsland(key, p) {
    const { zMin, zMax } = L1.islands[key];
    return p.z >= zMin - 0.5 && p.z <= zMax + 0.5 && Math.abs(p.x) <= L1.corridorHalf + 0.5;
  }

  /**
   * Open the door by dropping it below the world. Collision is positional —
   * `_resolveWalls` reads the mesh's current transform every frame — so moving
   * the panel is what opens it; hiding it would not. y=-100 is below
   * `PLAYER.killY`, so no player can ever be inside the panel's height range.
   */
  _openGate(gate) {
    gate.open = true;
    gate.surface.mesh.position.y = -100;
    gate.light.material.color.setHex(PAINT.green.hex);
  }

  /** Minimal unlit beacons, colour-coded to the paint they ask for. Shared geo + material. */
  _beacons() {
    const geo = new THREE.BoxGeometry(0.7, 2.2, 0.7);
    const mats = {
      blue:  new THREE.MeshBasicMaterial({ color: PAINT.blue.hex }),
      red:   new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
      green: new THREE.MeshBasicMaterial({ color: PAINT.green.hex }),
    };
    for (const { colour, x, y, z } of L1.beacons) {
      const m = new THREE.Mesh(geo, mats[colour]);
      m.position.set(x, y, z);
      this.root.add(m);
    }
  }

  /** The win volume (Box3) + a faint white marker box on the extraction ledge. */
  _extraction() {
    const { zMin, zMax } = L1.extraction;
    const y = L1.ledge.y;
    const min = new THREE.Vector3(-L1.corridorHalf, y - 1, zMin);
    const max = new THREE.Vector3(L1.corridorHalf, y + 2, zMax);
    this.extraction = new THREE.Box3(min, max);

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    marker.position.set(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    );
    this.root.add(marker);
  }
}
