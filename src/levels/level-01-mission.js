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
import { Decor, KINDS, createDecorPalette } from './decor.js';

/**
 * Layout numbers, named so the blockout is iterable — tune here, re-test.
 * Full-width corridor (x −11…11) so no gate can be bypassed sideways.
 *
 * Route (z runs +18 → −36): start island → jump Gap 1 → island B (Charger,
 * blue run-up) → [gate B: clear island B] → blue + RED PAD super jump over
 * Gap 2 → island C (arena: Charger + Sprayer rush you) → [gate C: clear the
 * arena AND the tower] → jump onto the stair tower's first deck (two Shooters
 * waiting behind the block) → green-climb deck 2 → green-climb deck 3 →
 * extraction.
 */
const L1 = {
  // WIDENED from 8 to 11 (#39 #5): 16 m was narrow enough that the foliage on
  // both edges closed over the route, and an enemy walking up the middle
  // disappeared behind bushes long before it reached you. Widening gives the
  // fight room to happen in the open. It is nearly free: the scatter walks z and
  // picks one x per side per step, so a wider band spreads the SAME number of
  // props over more ground rather than adding props.
  corridorHalf: 11,           // full width 22
  cells: PAINT_GRID.level1Cells,
  spawn: { x: 0, y: 2, z: 13 },

  islands: {
    A: { zMin: 8,   zMax: 18  },  // start — spawn + fall respawn land here
    B: { zMin: -7,  zMax: 4.5 },  // middle — deep: Charger fight + blue run-up
    C: { zMin: -24, zMax: -16 },  // arena — then the stair tower behind its door
  },

  // --- the ascent (#39 #6) ---------------------------------------------------
  //
  // WHAT THIS REPLACES, AND WHY.
  //
  // Island C used to end in a red pad that launched you up THROUGH a platform
  // slab. Nothing in this engine has ceiling collision, so "up through its own
  // floor" was not a bug in the pad — it was the only way that platform could
  // ever be reached. Above it stood a full-width green wall, and above THAT an
  // extraction ledge which hung five metres out over the arena, because the
  // climb needed somewhere to land. Renda saw that overhang as "a mini platform
  // with trees on it extending out of the extraction point" (#4) — and it was
  // load-bearing, not decoration. So #4 could not be fixed without moving the
  // climb, which is what this is.
  //
  // Now: a stair tower against the +x wall, behind the arena's door. The ledge
  // is gone — the top of the tower IS the extraction. Four things fall out of
  // that: nothing hangs over the arena, the fight is unavoidable because the
  // door is the only way on, the two shooters get a real firing position to
  // hold, and going AROUND the block on the first deck is how you reach the
  // second climb rather than climbing in a straight line.
  //
  // THE NUMBERS THAT DRIVE THE SHAPE, all of them forced rather than chosen:
  //
  //   rise = 2.5   A jump reaches 8.5^2 / (2 * 26) = 1.39 m, so 2.5 m cannot be
  //                jumped and MUST be green-climbed. This is the number that
  //                makes the paint the route instead of a shortcut.
  //   lip  = 2.6   A green climb cannot top out on its own. Wall contact is
  //                tested at chest height (position.y + 0.85), so the climber
  //                loses the wall with their feet ~0.85 m BELOW the deck they
  //                were heading for, and every climb therefore ends in a jump.
  //                `lip` is the floor that jump lands on, and it has to beat
  //                PLAYER.wallJumpPush * airtime (~2.3 m in the worst case,
  //                because the jump-off always pushes you AWAY from the face).
  //   no lip on deck 1, because the head clearance under a lip is
  //                `rise - PLAYER.height` = 0.8 m at 2.5 m and NEGATIVE at 1.2 m:
  //                a 1.2 m deck with an overhang would slice through a 1.7 m
  //                player at chest height. That is why the first deck is the
  //                jumpable one and the only one without an overhang.
  //
  // So deck 1 is the "platform you jump up onto" Renda described, and decks 2
  // and 3 are the green climbs that make the tower a climb rather than a lift.
  tower: {
    // Hugs the +x wall, so the corridor stays open down the tower's left and the
    // structure reads as built against the side rather than plugging the route.
    xMin: 2.5,
    xMax: 11,

    deck1: { y: 1.2, zMin: -31,   zMax: -27   },   // JUMP up (1.2 < 1.39 m). No lip.
    deck2: { y: 3.7, zMin: -34,   zMax: -28.4 },   // green climb; 2.6 m lip over deck 1
    deck3: { y: 6.2, zMin: -37,   zMax: -31.4 },   // green climb; 2.6 m lip over deck 2

    // The y0 floor the tower stands on, and the way in. One floor rather than a
    // stub, so a player who walks the wrong way along it finds lake and the edge
    // of the world rather than a hole in the level.
    vestibule: { zMin: -37, zMax: -24 },

    face1: { yBase: 0,   yTop: 1.2, z: -27 },
    face2: { yBase: 1.2, yTop: 3.7, z: -31 },
    face3: { yBase: 3.7, yTop: 6.2, z: -34 },

    // The block you go AROUND on deck 1. It spans x 5.5..9 of a deck that runs
    // x 2.5..11, so the way past is the three clear metres on its left — around,
    // not through. Deck 1 is 4 m deep on purpose: a block plus a metre and a half
    // of standing room behind it for the two shooters.
    //
    // It is the one surface in the level that cannot be painted (`unpaintable`
    // in paint-surface.js) and that is the point of it: painting it green would
    // let you climb straight over instead of walking round, which is the entire
    // job it has. It is also the first thing in the game that is a PHYSICAL
    // obstacle rather than a colour question — DESIGN.md wants that beat (cf. the
    // L2 turret), and L1 needs one before L2 can lean on it.
    block: { xMin: 5.5, xMax: 9, yBase: 1.2, yTop: 3.7, z: -28.4 },
  },

  // The win zone: the BACK of deck 3. A Box3, checked against the player's
  // position, so it covers the full corridor width — nothing can reach the
  // x < 2.5 half of that box on foot, because deck 3 is not there.
  extraction: { zMin: -37, zMax: -34.5 },

  // Encounter gates (#37 island B, #56 island C): an arena's exit stays sealed
  // until that arena is clear, so the fight has to be won rather than run past.
  //
  // Both are full-width VERTICAL panels — the only barrier the engine stops
  // (see `_gate()`). `yTop` is taller than a red bounce
  // (minBounce 15 -> apex ≈4.3 m) so neither can be hopped.
  //
  // Island C's is now the tower's DOORWAY, sitting on the arena floor at island
  // C's own back edge. It was on the platform lip before, which is why it read
  // as a pane standing in mid-air: there was no floor, no frame and no doorway
  // around it. Now it is framed, and there is a wall of structure either side.
  gates: {
    B: { yTop: 6 },    // island B's front edge — seals the way to Gap 2
    C: { yTop: 7 },    // island C's back edge, at the foot of the tower
  },

  beacons: [                  // colour-coded to the paint each step asks for
    { colour: 'blue',  x: 0, y: 2,   z: -4.5 },    // island B — the blue run-up
    { colour: 'red',   x: 0, y: 2,   z: -11.5 },   // Gap 2 — the launch colour
    { colour: 'green', x: 6, y: 1.4, z: -28.5 },   // deck 1 — the first climb
    { colour: 'green', x: 6, y: 4.1, z: -31.5 },   // deck 2 — the second climb
  ],

  // DESIGN.md teaching beats, not just spawn points:
  //   Charger  — island B. 5 m/s, 25 contact. The answer is paint BLUE: it
  //              slides straight past. That patch is also the Gap 2 run-up.
  //   Charger  — island C. Rushes you the moment you land, which is what makes
  //              the arena unavoidable now the exit is a door rather than a
  //              launch you could paint past.
  //   Sprayer  — island C. Ranged pressure while you fight the Charger.
  //   Sprayer x2 — on deck 1, behind the block. These are the shooters Renda
  //              asked for (#39 #6): they have the height and you have to kill
  //              them to cross the deck, which is what makes ADS worth using.
  //
  // Spawns are a starting hint, not a hold: there is no aggro radius, so enemies
  // walk at the player from load and freeze where the next step would fall off.
  spawns: [
    { x: 4,   y: 0,   z: -1,    type: 'charger' },
    { x: -4,  y: 0,   z: -21,   type: 'charger' },
    { x: 0,   y: 0,   z: -19,   type: 'sprayer' },
    { x: 6,   y: 1.2, z: -30.4, type: 'sprayer' },
    { x: 8.5, y: 1.2, z: -30.4, type: 'sprayer' },
  ],

  // --- the world beyond the causeway (#39 #10) -------------------------------
  //
  // The forest could never leave the corridor, because decor only stands on a
  // floor and there were 22 m of floor. These are the shelves either side of it —
  // the ground the `backdrop` kind stands on.
  //
  // Two things about them are load-bearing rather than scenic:
  //
  //   LOWER (y −0.6). The corridor's x edges have no walls, so a shelf level with
  //   it would be a way around both gates. 0.6 m is not a gameplay barrier, but it
  //   makes "this is not the route" legible at a glance: the corridor becomes a
  //   causeway over a drowned forest rather than a wide room.
  //
  //   UNREACHABLE, which the gap does. A jump covers 4.6 m and a blue jump 7.3 m
  //   (measured in `tests/speed-cap.test.js`), so 8 m of lake cannot be crossed
  //   from either side. If anything ever reduces that jump distance, these stop
  //   being scenery and become a skip — that is the number to check first.
  shouldShelf: {
    gap: 8,        // metres of lethal lake between the corridor edge and the shelf
    width: 20,
    y: -0.6,
    zMin: -41,
    zMax: 20,
  },

  // The TREES. Hand-placed, because the rules are not geometric:
  //
  //   - every tree must stand ON a floor. A tree over a gap floats, and that is
  //     the one thing about the mist-free gaps a player will notice instantly.
  //     `tests/level-01-decor.test.js` checks this for every entry.
  //   - keep x away from 0. The route runs down the middle of the corridor.
  //     The corridor is 22 m wide now (#39 #5), so the framing moved out with it
  //     — trees at +/-8 to 9.5 frame the path from further back and leave a
  //     wider, clearer middle for the fights.
  //   - trees do not collide (see `_decor()`), so they can never block the Gap 1
  //     jump or trap the player against the Charger.
  //   - `scale` gives size variety for free. Nothing else changes per tree.
  //
  // All of them are on y 0. The platform and the ledge they used to frame are
  // gone with the ascent rework (#39 #6) — the tower decks carry no decor at
  // all, deliberately: `decor.js` scatters around the CENTRE LINE of a floor and
  // the decks are off-centre, so a scattered prop there would sit in mid-air.
  // See `_decorFloors`.
  //
  // The other kinds — bush, rock, grass, flower, stump — have no table here.
  // Their placement is scatter, configured in `decor.js` KINDS, because they are
  // ground cover: their job is density and distribution, not framing a route.
  tree: [
    // island A — the approach, and a backdrop behind the spawn
    { x: -8.0, y: 0, z: 17.0, scale: 1.3 },
    { x: -9.0, y: 0, z: 13.0, scale: 1.0 },
    { x: -8.5, y: 0, z:  9.5, scale: 0.85 },
    { x:  8.0, y: 0, z: 16.0, scale: 1.15 },
    { x:  9.0, y: 0, z: 11.0, scale: 0.95 },

    // island B — the Charger arena. Edge trees only, so the fight stays readable.
    { x: -9.0, y: 0, z:  3.0, scale: 1.2 },
    { x: -8.5, y: 0, z: -1.5, scale: 0.9 },
    { x: -9.0, y: 0, z: -5.5, scale: 1.05 },
    { x:  9.5, y: 0, z:  2.0, scale: 1.1 },
    { x:  8.5, y: 0, z: -3.5, scale: 0.95 },
    { x:  9.0, y: 0, z: -6.0, scale: 1.25 },

    // island C — the arena. Left of the tower's footprint (x >= 2.5 is structure).
    { x: -8.5, y: 0, z: -17.5, scale: 1.0 },
    { x: -9.5, y: 0, z: -21.0, scale: 1.3 },
    { x: -8.0, y: 0, z: -23.5, scale: 0.9 },
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

  // Distance fog. Tightened from 12/60 once the decor landed, and the reason is
  // worth recording: 60 was tuned against a corridor that was mostly EMPTY,
  // because the instanced props were not rendering at all. With the forest
  // actually in the level, a far plane of 60 means the far half of the corridor
  // is barely touched and the woods read as crisp, not as somewhere you are
  // standing inside. 48 puts the back wall (43 from the spawn) at ~95% haze.
  //
  // `fogNear` still clears the TPV camera's 6.5 offset, so the player never fogs.
  fogNear: 9,
  fogFar:  48,

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

/**
 * THE TOXIC WASTE in the chasms (#39 #9, reworked).
 *
 * WHAT CHANGED AND WHY. The first version was ONE translucent sheet spanning the
 * whole level footprint, with a dark bed underneath it to stop you seeing through.
 * Renda: "I only want it over the gaps, it shouldn't be transparent". Both halves
 * of that are right, and the second is the one that mattered: a translucent
 * surface over a black void reads as a grey smear, which is why it needed a second
 * opaque mesh underneath just to be legible. One OPAQUE surface needs no bed, and
 * reads as a solid thing rather than as a filter over nothing.
 *
 * It is now exactly the holes and nothing else — computed from the level's own
 * layout rather than from numbers written here, so moving an island moves its pool:
 *
 *   - the two GAPS, the jumps
 *   - the two TRENCHES either side of the causeway, which the forest shelves
 *     stand across (#39 #10). Not one of the jumps, but the same chasm: leaving
 *     them black would make the shelves float over a void.
 *
 * NO DOWNLOAD, deliberately. The art direction is flat toon and this project
 * strips textures out of every model it ships (tools/strip-glb-textures.mjs) —
 * a downloaded toxic-waste texture would be the one textured surface in the game,
 * and would need attribution to match. `createWasteSurface` builds a low-poly,
 * flat-shaded, gently rippling slab instead: a handful of vertices, no texture, no
 * licence, and it shades with the scene's sun like everything else. If it ever
 * wants more detail the upgrade is a code-built noise map like the mist's, not an
 * asset.
 *
 * The surface sits 1.1 m below the floor and NOT at the bottom of the pit, because
 * the point is that you can SEE it under your feet. Push it down and it stops being
 * a threat you notice and becomes a floor you fall towards.
 *
 * It is NOT lethal on touch: it does not collide, and `PLAYER.killY` (−20) is still
 * what kills you. The waste is the signpost; the void is the damage. That split is
 * deliberate — a kill volume per pool would also have to explain why the EDGE of
 * the pool is safe to stand next to.
 */
const WASTE = {
  y: -1.1,
  colour: 0x86b32d,    // toxic green, in the same drained family as the dead ground
  emissive: 0x1d2c07,  // a little self-lit, so it reads as something you should not touch
  wave: 0.16,          // metres of ripple, under the 0.5 m to the shelves
  bob: 0.035,
  bobSpeed: 0.7,
};

/**
 * A rippling slab of waste, built in code.
 *
 * Integer-frequency sines rather than `Math.random`, for the same reason
 * `createMistTexture` uses them: the level is then identical every run, and nothing
 * shimmers between reloads. Displacement is in local Z, which the mesh's
 * `rotation.x = -PI/2` turns into world Y — so this is height, not depth.
 */
function createWasteSurface(width, depth, amplitude) {
  const geo = new THREE.PlaneGeometry(
    width, depth,
    Math.max(2, Math.round(width / 2)),
    Math.max(2, Math.round(depth / 2)),
  );

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const h = Math.sin(x * 0.55 + y * 0.31) * amplitude
            + Math.sin(x * 0.23 - y * 0.71) * amplitude * 0.6;
    pos.setZ(i, h);
  }
  pos.needsUpdate = true;

  // FACETED, which on this material has to be done by splitting the vertices
  // rather than by asking for it: `MeshToonMaterial` has no `flatShading` option
  // in three r169 (setting it only prints a warning and does nothing). Dropping
  // the index and recomputing normals gives every triangle its own, which is the
  // same result and works on any material. A rippled surface needs the facets —
  // smoothly interpolated normals make it look like a painted floor again.
  const faceted = geo.toNonIndexed();
  geo.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

/**
 * The tower's look: concrete, undersides, and the drain field's colour (#39 #6,
 * #3). Numbers and colours only, so the structure can be re-tuned without
 * touching `_tower()`.
 *
 * The concrete is a cold, drained grey — deliberately NOT the grey-green of the
 * ground and foliage. Everything the Corrupt Corp built is a different, deader
 * material from the world it is standing on, and the tower is the first
 * structure big enough for that to read.
 */
const TOWER = {
  concrete: 0x6b6f73,
  underside: 0x4a4e52,
  slab: 0.45,          // how thick a deck's slab looks
  column: 0.9,
  parapet: 0.9,
  blockDepth: 1.2,
  block: 0x7c8185,
  field: 0xff3b46,     // the drain field, in PAINT.red's family so it reads as hostile
  fieldOpacity: 0.42,
  fieldScroll: 0.55,   // texture drift per second, so a live barrier looks alive
  fieldFade: 1.8,      // opacity per second once the arena clears
};

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
    this._floor(L1.tower.vestibule.zMin, L1.tower.vestibule.zMax, 0);

    this._tower();
    this._shoulders();
    this._beacons();
    this._extraction();
    this._mood();
    this._waste();
    this._light();
    this._decor();

    this.spawn.set(L1.spawn.x, L1.spawn.y, L1.spawn.z);

    this.spawnPoints = L1.spawns.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this._spawnEnemies();

    // Gates go up after the enemies exist so each one can take its own watch
    // list. A gate waits only on the enemies that SPAWN inside its own arena:
    // island C's must not hold island B's gate shut, or the other way round.
    //
    // An arena is a PREDICATE, not an island key (#39 #6). Island C's door has to
    // wait on the two shooters standing on the tower as well as the two on the
    // arena floor, and the shooters are not on island C — they are up the tower,
    // which no z-range on the island table describes.
    this.gateB = this._gate({
      contains: (p) => this._inIsland('B', p),
      z: L1.islands.B.zMin, yBase: 0, yTop: L1.gates.B.yTop,
    });
    this.gateC = this._gate({
      contains: (p) => this._inIsland('C', p) || this._inTower(p),
      z: L1.islands.C.zMin, yBase: 0, yTop: L1.gates.C.yTop,
    });
    this.gates = [this.gateB, this.gateC];

    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      gate.watch = this.enemies.filter((e) => gate.contains(e.position));
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
   * The toxic waste, exactly where the holes are (#39 #9). See WASTE.
   *
   * The rectangles are DERIVED from the level's own layout — the island table and
   * the shelf table — rather than written as numbers here, so an island that moves
   * takes its pool with it. Four slabs, tiled so there is no gap between them:
   *
   *   gap 1   the jump off island A
   *   gap 2   the jump off island B
   *   trench  the void either side of the causeway, under the forest shelves
   */
  _waste() {
    this.waste = new THREE.Group();
    // Its OWN group under root, NOT inside `atmosphere`. That distinction is
    // load-bearing: `atmosphere` means "air" (the sky dome and the mist sheets),
    // and `tests/level-contract.test.js` reads that group to assert the MIST stops
    // before the spawn island. Waste left in there would be measured as mist.
    this.root.add(this.waste);
    this._wasteTime = 0;

    // One material for every slab: it never changes, so four slabs cost one.
    const material = new THREE.MeshToonMaterial({
      color: WASTE.colour,
      emissive: WASTE.emissive,
    });

    const inner = L1.corridorHalf;
    const outer = inner + L1.shouldShelf.gap;
    const shelf = L1.shouldShelf;

    const holes = [
      { xMin: -inner, xMax: inner, zMin: L1.islands.B.zMax, zMax: L1.islands.A.zMin },
      { xMin: -inner, xMax: inner, zMin: L1.islands.C.zMax, zMax: L1.islands.B.zMin },
      { xMin: -outer, xMax: -inner, zMin: shelf.zMin, zMax: shelf.zMax },
      { xMin: inner, xMax: outer, zMin: shelf.zMin, zMax: shelf.zMax },
    ];

    this.wasteSlabs = [];
    for (const hole of holes) {
      const mesh = new THREE.Mesh(
        createWasteSurface(hole.xMax - hole.xMin, hole.zMax - hole.zMin, WASTE.wave),
        material,
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        (hole.xMin + hole.xMax) / 2,
        WASTE.y,
        (hole.zMin + hole.zMax) / 2,
      );
      this.waste.add(mesh);
      this.wasteSlabs.push({ mesh, y: WASTE.y });
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
   * was why the test never noticed. The palette is now walked instead, which
   * covers every kind of decor at once.
   *
   * Called at the END of load(), after the gates and the decor exist. Both are
   * built late — miss one and its faces are lit from a different direction than
   * the floor they stand on.
   */
  _lightDirection() {
    const dir = new THREE.Vector3(
      MOOD.sunDir[0], MOOD.sunDir[1], MOOD.sunDir[2],
    ).normalize();
    this.sunDir = dir;   // kept: future code (telegraphs, reactions) wants it

    for (let i = 0; i < this.surfaces.length; i++) {
      const uniform = this.surfaces[i].material.uniforms.uLightDir;
      if (uniform) uniform.value.copy(dir);
    }

    // the decor, which is custom-shaded too and was the miss described above
    for (const material of this.decorMaterials) {
      material.uniforms.uLightDir.value.copy(dir);
    }
  }

  /**
   * The decor: trees, bushes, rocks, grass, flowers, stumps.
   *
   * One `Decor` per kind, each an instance of the same machinery with its own
   * model set, size and scatter density. Trees differ from grass only in their
   * numbers, not in their code — which is the point: the paint reaction, the
   * instancing and the fallback are written once and every kind gets them.
   *
   * The palette is built ONCE and shared by every kind, so a blue bush and a blue
   * tree are the same blue. Per-kind palettes would make "the world comes back to
   * colour" read as several different colours.
   */
  _decor() {
    this.palette = createDecorPalette();

    // One flat list for `_lightDirection()`: custom shaders do not read scene
    // lights, so a material missing from here is lit from createToonMaterial's
    // own default direction and quietly disagrees with the ground (#57).
    this.decorMaterials = [this.palette.base, ...Object.values(this.palette.tint)];

    this.decor = {};
    for (const [kind, config] of Object.entries(KINDS)) {
      // Only walkable surfaces — see Decor.build. The wall is a PaintSurface too,
      // and a prop that "stands on" the wall stands inside it. `config.band` picks
      // WHICH ground: the corridor, or the forest shelves outside it (#39 #10).
      const floors = this._decorFloors(config.band);

      const props = new Decor(this.root, {
        kind, config, palette: this.palette, hand: L1[kind] ?? [],
      });
      props.build(floors);

      // A kind that overrides its unpainted colour owns a material the shared
      // palette does not know about (stone is not foliage — see DECOR.stone).
      // It has to be added here or it is lit from the shader's own default
      // direction instead of the sun, which is the exact bug `_lightDirection`
      // exists to prevent. Duplicates in this list are harmless: copying the same
      // direction twice is idempotent.
      this.decorMaterials.push(props.unpaintedMaterial);

      // Step 4: upgrade to the real .glb props. NOT awaited, and deliberately so
      // — `main.js` does not await load(), so the level is playable immediately
      // and each kind swaps itself in when its files arrive. A failed load leaves
      // the code shapes standing; see Decor.loadModels.
      if (this.game.loadGLB) props.loadModels(this.game.loadGLB);

      this.decor[kind] = props;
    }

    return this.decor;
  }

  /**
   * The floors the DECOR SCATTER may use, by BAND.
   *
   * Two separate reasons a floor must be kept out of the route kinds:
   *
   * 1. THE TOWER DECKS would be scattered onto if they were not excluded, and
   *    `Decor._spots` scatters around a floor's CENTRE LINE and treats that as a
   *    world x. The decks sit off to one side at x 2.5..11, so a prop on one is
   *    placed as if the deck were centred on x = 0 — standing in mid-air beside
   *    the tower. The "every prop stands on a floor" test cannot catch that,
   *    because it asks whether ANY floor covers the point and every deck overlaps
   *    the vestibule in x/z.
   *
   * 2. THE FOREST SHELVES should be dressed by `backdrop` ONLY. A corridor kind
   *    scattered across them would put trees in the lake between the two, since
   *    the shelf bands are built from the shelf's own centre line.
   *
   * So the structure and the far shelves are separated by band rather than by
   * accident, and a kind declares which band it belongs to (`KINDS[kind].band`).
   */
  _decorFloors(band = 'route') {
    if (band === 'backdrop') {
      return this.surfaces.filter((s) => s.isFloor && s.shoulder);
    }
    return this.surfaces.filter((s) => s.isFloor && !s.tower && !s.shoulder);
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

    // The waste breathes, so it reads as a liquid rather than as a painted floor.
    // A phase per slab keeps the four from pumping in lockstep.
    this._wasteTime += dt;
    for (let i = 0; i < this.wasteSlabs.length; i++) {
      const slab = this.wasteSlabs[i];
      slab.mesh.position.y = slab.y + Math.sin(this._wasteTime * WASTE.bobSpeed + i * 1.7) * WASTE.bob;
    }

    // The decor wakes up where the player paints. Each kind runs its own
    // heartbeat (see Decor.update) rather than reading the grid every frame.
    for (const props of Object.values(this.decor)) {
      props.update(dt, player.position);
    }

    // Encounter gates: an arena's exit opens the moment that arena is clear.
    // The field is animated either way — drifting static while it holds you, and
    // a fade-out once it drops, so the door visibly dies rather than blinking out.
    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      if (!gate.open && this._arenaCleared(gate)) this._openGate(gate);

      const mat = gate.curtain.material;
      if (!gate.open) {
        const map = mat.map;
        const oy = map.offset.y + TOWER.fieldScroll * dt;
        map.offset.y = oy >= 1 ? oy - 1 : oy;
      } else if (gate.curtain.visible) {
        const opacity = mat.opacity - TOWER.fieldFade * dt;
        if (opacity <= 0) {
          gate.curtain.visible = false;   // done: stop drawing it at all
          mat.opacity = 0;
        } else {
          mat.opacity = opacity;
        }
      }
    }

    // Extraction fires the win exactly once, guarded by `_complete` — and only
    // once island C is clear. The gate is unpaintable now (#39), so it cannot be
    // climbed over, but this check stays: it is the win condition, and it should
    // not depend on a barrier's collision being correct.
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
    // Tells any model load still in flight that its level is gone, so it drops
    // the result instead of attaching decor to a dead level (the "R race").
    for (const props of Object.values(this.decor ?? {})) props.dispose();
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

  /**
   * The stair tower (#39 #6) — see the `tower` block in L1 for why it exists and
   * what every number in it is doing. This builds four kinds of thing:
   *
   *   FLOOR    a walkable PaintSurface at a height. `_deck` for the off-centre
   *            ones on the +x side, `_face` for the vertical climb faces, and
   *            `_block` for the one obstacle you cannot paint.
   *   STRUCTURE the concrete the player sees: pillars, deck slabs' undersides,
   *            the gate frames. Plain `MeshToonMaterial` meshes, which means they
   *            read the SCENE lights (main.js's sun and this level's fill) and
   *            need no `uLightDir` wiring, unlike every custom-shaded surface.
   *
   * The structure meshes exist because a PaintSurface is a ZERO-THICKNESS plane.
   * That is fine for a floor you stand on and hopeless for anything the player is
   * meant to read as a solid object, so every solid here is drawn with a box and
   * collided with a plane.
   */
  _tower() {
    const t = L1.tower;

    // --- the walkable decks ---------------------------------------------------
    this._deck(t.deck1);
    this._deck(t.deck2);
    this._deck(t.deck3);

    // --- the climb faces ------------------------------------------------------
    for (const face of [t.face1, t.face2, t.face3]) {
      this._face({ ...face, xMin: t.xMin, xMax: t.xMax });
    }

    // --- the block on deck 1 --------------------------------------------------
    // `_block` puts the collider on the box's FRONT face itself; no offset here.
    this._block(t.block);

    // --- the concrete you can see --------------------------------------------
    const concrete = new THREE.MeshToonMaterial({ color: TOWER.concrete });
    const dark = new THREE.MeshToonMaterial({ color: TOWER.underside });

    for (const deck of [t.deck1, t.deck2, t.deck3]) {
      // a slab under each deck, so a deck is a storey rather than a floating sheet
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(
          t.xMax - t.xMin,
          TOWER.slab,
          deck.zMax - deck.zMin,
        ),
        dark,
      );
      slab.position.set(
        (t.xMin + t.xMax) / 2,
        deck.y - TOWER.slab / 2,
        (deck.zMin + deck.zMax) / 2,
      );
      this.root.add(slab);
    }

    // Support columns down the tower's open (+x-facing) edge, so the decks read
    // as carried rather than cantilevered out of nowhere.
    for (const z of [t.deck1.zMax - 0.4, t.deck3.zMin + 0.4]) {
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(TOWER.column, t.deck3.y, TOWER.column),
        concrete,
      );
      column.position.set(t.xMin + TOWER.column / 2, t.deck3.y / 2, z);
      this.root.add(column);
    }

    // A parapet along the back of the extraction deck. Doing nothing but reading
    // as the end of the walkway — without it the win zone looks like the place
    // the world stops.
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(t.xMax - t.xMin, TOWER.parapet, 0.8),
      concrete,
    );
    parapet.position.set(
      (t.xMin + t.xMax) / 2,
      t.deck3.y + TOWER.parapet / 2,
      t.deck3.zMin + 0.4,
    );
    this.root.add(parapet);
  }

  /**
   * The two forest shelves either side of the corridor (#39 #10). See
   * `L1.shouldShelf` for why they exist and why they are lower and unreachable.
   *
   * Marked `shoulder` so `_decorFloors` can hand the right band of ground to the
   * right kind of prop: the corridor kinds dress the route, and only `backdrop`
   * dresses these.
   */
  _shoulders() {
    const s = L1.shouldShelf;
    const inner = L1.corridorHalf + s.gap;
    const outer = inner + s.width;

    for (const side of [-1, 1]) {
      this._platform({
        y: s.y,
        zMin: s.zMin,
        zMax: s.zMax,
        xMin: side === 1 ? inner : -outer,
        xMax: side === 1 ? outer : -inner,
        mark: 'shoulder',
      });
    }
  }

  /**
   * A walkable surface with its own footprint, for anything that is not the
   * corridor: the tower decks (against the +x wall) and the forest shelves (well
   * outside it) both need one. `_floor` assumes the corridor's centre line.
   *
   * `mark` tags the surface with the band of ground it belongs to, which is what
   * `_decorFloors` reads. It is not decoration on the object: the decor scatter
   * assumes a floor's centre line is at x = 0 (see `_decorFloors`), so getting a
   * prop onto the wrong one is a silent mid-air placement.
   */
  _platform({ y, zMin, zMax, xMin, xMax, mark }) {
    const s = new PaintSurface({ width: xMax - xMin, height: zMax - zMin, cells: L1.cells });
    s.mesh.rotation.x = -Math.PI / 2;
    s.mesh.position.set((xMin + xMax) / 2, y, (zMin + zMax) / 2);
    s.mesh.receiveShadow = true;
    s.isFloor = true;
    s[mark] = true;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /** The tower's decks: `_platform` pinned to the tower's footprint. */
  _deck({ y, zMin, zMax, xMin = L1.tower.xMin, xMax = L1.tower.xMax }) {
    return this._platform({ y, zMin, zMax, xMin, xMax, mark: 'tower' });
  }

  /**
   * One vertical climb face: the green-climbable panel on the front of a deck.
   *
   * Same primitive as everything else that collides — a PaintSurface standing up,
   * normal pointing at the player. Unlike a gate it is PAINTABLE, because being
   * paint is its entire job.
   */
  _face({ yBase, yTop, z, xMin, xMax }) {
    const s = new PaintSurface({ width: xMax - xMin, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /**
   * The block you walk around on deck 1 — the level's first obstacle that is not
   * a colour answer (#39 #3, #6).
   *
   * It has to be unpaintable or it is not an obstacle: painting a wall green makes
   * it climbable, and this thing is 2.5 m tall, so green would turn "walk around
   * it" into "hop over it". That is the constraint the whole `unpaintable` flag
   * was added for.
   *
   * The collision panel sits on the box's FRONT face rather than through its
   * middle, so the player stops at the edge they can see. A box collided with by a
   * plane through its centre lets you walk half a metre into the wall.
   */
  _block({ xMin, xMax, yBase, yTop, z }) {
    const s = new PaintSurface({
      width: xMax - xMin, height: yTop - yBase, cells: L1.cells, unpaintable: true,
    });
    s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
    s.mesh.visible = false;      // the box below is what the player sees
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(xMax - xMin, yTop - yBase, TOWER.blockDepth),
      new THREE.MeshToonMaterial({ color: TOWER.block }),
    );
    box.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z - TOWER.blockDepth / 2);
    this.root.add(box);

    // A band across the top so the block reads as deliberate at a glance. It is
    // the only thing on the tower that does not match, and it should not.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(xMax - xMin + 0.2, 0.25, TOWER.blockDepth + 0.2),
      new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
    );
    band.position.set((xMin + xMax) / 2, yTop + 0.12, z - TOWER.blockDepth / 2);
    this.root.add(band);

    return s;
  }

  /**
   * One encounter gate (#37 island B, #56 island C, reskinned for #39 #3): a
   * full-width barrier seals its arena's exit until the arena is clear, so the
   * fight has to be won rather than run past.
   *
   * WHY IT LOOKED WRONG BEFORE. It WAS a bare PaintSurface — an upright pane
   * wearing the floor's own grey grid — with a red bar over it and nothing around
   * it. Standing in the open corridor it read as a bug, because nothing in the
   * frame explained it. Renda: "too in the way and feel out of place".
   *
   * What it is now: the collider is still exactly the same primitive (see below),
   * but it is INVISIBLE, and the player sees a drain field — a drifting red static
   * sheet strung between two concrete pillars with a lintel over the top, and a
   * lock bar that goes red -> green. The fiction is the one DESIGN.md already
   * gives us: Corrupt Corp's soldiers project a field that holds you while they
   * are alive, and it dies with the last of them. That is why it is a door that
   * drops rather than a wall that was always there.
   *
   * THREE THINGS THAT ARE NOT STYLE CHOICES:
   *
   *   1. It must be VERTICAL. `_resolveWalls` (player.js) pushes the player out
   *      along x/z and never resolves y, so a horizontal panel is pass-through and
   *      seals nothing. A gate can only ever block a horizontal route.
   *
   *   2. It must be UNPAINTABLE, and that is new (#39). Every wall in this game is
   *      a PaintSurface and every PaintSurface was paintable, so a player who
   *      painted this green could climb over the top of it. Previously that was
   *      tolerated because the far side "leads nowhere"; island C's door is the
   *      exception — its far side is the route to the win — so `_gate()` doc
   *      comments used to lean on `_arenaCleared` alone to enforce it. Now the
   *      bypass is closed at the source instead of being papered over.
   *
   *   3. The panel must still be a PaintSurface, because that is the only thing
   *      that collides. `visible = false` on its mesh costs nothing: collision
   *      reads the transform and never the visibility.
   */
  _gate({ contains, z, yBase, yTop }) {
    const s = new PaintSurface({
      width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells, unpaintable: true,
    });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.mesh.visible = false;      // the curtain below is what the player sees
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);

    // --- the doorway ----------------------------------------------------------
    const concrete = new THREE.MeshToonMaterial({ color: TOWER.concrete });
    const frame = new THREE.Group();
    const pillarW = 1.6;

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(pillarW, yTop - yBase + 1.2, 1.8),
        concrete,
      );
      pillar.position.set(side * (L1.corridorHalf - pillarW / 2), (yBase + yTop) / 2, z);
      frame.add(pillar);
    }

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(L1.corridorHalf * 2, 1.2, 1.8),
      concrete,
    );
    lintel.position.set(0, yTop + 0.6, z);
    frame.add(lintel);
    this.root.add(frame);

    // --- the drain field ------------------------------------------------------
    // The same code-built, DOM-free texture as the mist and the lake, so there is
    // nothing to download and nothing to allocate per restart. White RGB with all
    // the variation in alpha, which is why it reads as turbulent static rather
    // than a flat pane.
    const map = createMistTexture(64);
    map.repeat.set(4, 2);
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(L1.corridorHalf * 2 - pillarW * 2, yTop - yBase),
      new THREE.MeshBasicMaterial({
        map,
        color: TOWER.field,
        transparent: true,
        opacity: TOWER.fieldOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    curtain.position.set(0, (yBase + yTop) / 2, z);
    this.root.add(curtain);

    // Lock bar above the door. A wide bar, not the 0.7x2.2x0.7 beacon shape:
    // the beacons mean "paint this colour", and this is not one of those.
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
    );
    light.position.set(0, yTop + 1.8, z);
    this.root.add(light);

    return { contains, surface: s, light, curtain, frame, open: false, watch: [] };
  }

  /**
   * An arena releases its gate when every enemy in it is dead OR has left it.
   *
   * The second case is the soft-lock guard #37 asks for: a red hit flings an
   * enemy with no gravity (`enemy.js` `_applyKnockback`), so a Charger knocked
   * into a gap floats out there alive forever. Waiting only on `alive` would
   * shut the level down permanently.
   *
   * "Left it" is now the gate's own `contains` predicate rather than an island
   * key (#39 #6) — island C's arena has to take in the tower as well as the
   * island, and no z-range on the island table describes the tower.
   */
  _arenaCleared(gate) {
    return gate.watch.every((e) => !e.alive || !gate.contains(e.position));
  }

  /** Is a world point on island `key` (A, B, C)? Slack at the edges so "on the lip" counts. */
  _inIsland(key, p) {
    const { zMin, zMax } = L1.islands[key];
    return p.z >= zMin - 0.5 && p.z <= zMax + 0.5 && Math.abs(p.x) <= L1.corridorHalf + 0.5;
  }

  /**
   * Is a world point on the stair tower? The far half of island C's gate watches
   * this as well as the island itself.
   *
   * `vestibule` and the deck footprints are all inside `tower.xMin..xMax` and
   * `deck3.zMin..C.zMin`, so this is one box rather than a footprint per deck —
   * an enemy cannot be inside that box without being on the structure.
   */
  _inTower(p) {
    const t = L1.tower;
    return p.z <= L1.islands.C.zMin + 0.5
      && p.z >= t.deck3.zMin - 0.5
      && p.x >= t.xMin - 0.5
      && p.x <= t.xMax + 0.5;
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

  /**
   * The win volume (Box3) at the back of the tower's top deck, plus a faint white
   * marker box showing it.
   *
   * The box spans the full corridor width even though the deck does not, and that
   * is free: the x < `tower.xMin` half of it is six metres above a floor the
   * player can only reach on foot, so nothing can be inside it there.
   */
  _extraction() {
    const { zMin, zMax } = L1.extraction;
    const y = L1.tower.deck3.y;
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
