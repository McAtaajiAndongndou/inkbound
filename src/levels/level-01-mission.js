// OWNER: E (Levels)
// L1 — "OUTSKIRTS". Forest island-hopping, the pillars setpiece, generous paint.
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
  spawn: { x: 0, y: 2, z: 21 },

  islands: {
    // A is the only island that grew BACKWARD (18 -> 26, issue 011). The route's
    // far edge stays at z 8, so Gap 1 and every jump number measured against it
    // are untouched; the extra eight metres are behind the old spawn, which is
    // the only direction this island had left to expand without re-tuning the
    // fight that comes after it.
    A: { zMin: 8,   zMax: 26  },  // start — the vantage: spawn, nothing else
    B: { zMin: -7,  zMax: 4.5 },  // middle — deep: Charger fight + blue run-up
    C: { zMin: -24, zMax: -16 },  // arena — then the stair tower behind its door
  },

  // --- the ascent (#39 #6, third revision — Renda's pillars) -----------------
  //
  // "I wanted the first platform to be on the left, then you paint its roof red to
  //  bounce over the gap to the second platform which will be on the right ...
  //  they must be square pillars ... you must feel like you actually climbed up to
  //  the first pillar and that the bounce felt like a risk to get to the second ...
  //  then you must climb up again to reach the extraction, no shortcuts."
  //
  //   hall, ground floor (y 0)
  //     │  GREEN — paint a SIDE of the pillar, any of three you can reach
  //     ▼
  //   PILLAR 1, left  (y 5.0)      · you paint the ROOF red yourself
  //     │  RED BOUNCE across the gap — 2.0 m of lift, ~4.5 m of travel
  //     ▼
  //   PILLAR 2, right (y 7.0)      · two shooters
  //     │  GREEN up the back wall — the rock band blocks everywhere else
  //     ▼
  //   extraction (y 10)
  //
  // WHY SQUARE PILLARS. Renda: "so that you can shoot the paint on their sides from
  // multiple angles". A wide deck has one face you can reach; a pillar has three,
  // and which one you paint is the player's choice. They are columns with a
  // CAPITAL — the top deck overhangs the base by 2 m on the three climbable sides,
  // and that overhang is not decoration: a green climb cannot top out on its own
  // (see LIP below), so the floor above a face has to stick out past it. A flush
  // pillar would be unclimbable no matter how much paint you put on it.
  //
  // THE ARITHMETIC THAT SETS THE GAP, and it is the tightest number in the level:
  //
  //   The player runs across the roof at ~4.6 m/s (accel 55 against friction 10),
  //   and a bounce off red leaves the ground for ~1.0 s with 2 m to climb. They are
  //   NOT limited to 4.6 m/s in the air: `PLAYER.airAccel` is 12 and the speed cap
  //   is 7, so they accelerate mid-flight to ~7 and the bounce carries ~6.6 m.
  //
  //   A red splat has a 1.4 m radius, so the player LEAVES THE GROUND 1.4 m before
  //   the splat's centre — they bounce off its near edge, not the middle. So the
  //   usable strip of roof is the ~5 m nearest the inner edge, and the gap is set
  //   to 3 m so that strip is comfortably wide. Painting red further back than that
  //   means a shorter launch and a short bounce, which is a fair thing to lose.
  //
  //   A jump cannot substitute for the bounce, and not because of the width: the
  //   second pillar is 2.0 m HIGHER, and a jump reaches 1.39 m. Height, not
  //   distance, is what makes it bounce-only at any gap.
  //
  //   Blue paint on the roof first stretches the same bounce past 11 m, which is
  //   the Gap 2 lesson reused — and the second pillar's landing is deliberately
  //   wide so that a long bounce still lands on it.
  ascent: {
    // The hall behind the door. The pillars stand in it, and the gap between them
    // is over the FLOOR, not over a pit: a missed bounce drops you to the ground
    // and costs you the climb again, rather than ending the run.
    vestibule: { zMin: -40, zMax: -24 },

    // 6 x 6 bases against the back wall, with a 1 m CORNICE on the climbable sides.
    // Flush at the back, where the wall is.
    //
    // The cornice used to be 2.5 m, which Renda read — correctly — as "floors
    // stretching out of them". It is now as small as it can safely be: a green climb
    // cannot top out on its own, so the deck above a face MUST reach past it, but a
    // measured sweep of a bare pillar face puts the real minimum at 0.3 m — the
    // ground probe reaches 0.5 m below the player's feet and snaps them up as they
    // pass it, so the deck only has to be under them a frame or two after the
    // jump-off. 1 m is three times that, and reads as a moulding.
    //
    // ONLY THE LEFT PILLAR IS PAINTABLE (Renda: "the right platform shouldn't be
    // paintable"). It is the climbing pillar; the right one is reached by the bounce
    // and nothing else, which is what keeps the bounce from being optional. Its
    // sides are still colliders — they are solid, you just cannot paint them.
    pillar1: { xMin: -8.5, xMax: -2.5, zMin: -40, zMax: -34, y: 5.0, overhang: 1.0 },
    pillar2: { xMin: 2.5, xMax: 8.5, zMin: -40, zMax: -34, y: 7.0, overhang: 1.0, unpaintable: true },

    // The back wall. The base is rock, so nothing on the ground floor can be
    // climbed to skip a pillar — including the back wall itself.
    base: { yBase: 0, yTop: 7, z: -40, xMin: -11, xMax: 11 },
    // ...and above it, the last climb — five metres of it (Renda: "the extraction
    // wall should be made taller so that you actually climb it"). The rock band
    // leaves the right-hand end paintable, which is the part standing in front of
    // the pillar you land on.
    rock: { yBase: 7, yTop: 12, z: -40, xMin: -11, xMax: 4 },
    green: { yBase: 7, yTop: 12, z: -40, xMin: 4, xMax: 11 },
  },

  // The win zone: the back of the extraction ledge.
  extraction: { zMin: -45, zMax: -42.5 },

  // The extraction ledge, at the top. Its lip overhangs the last climb by 2.4 m
  // (-40 -> -37.6), which is what a climb needs: the top-out jump is pushed AWAY
  // from the face, so it lands back from where it started and the floor has to be
  // under it.
  ledge: { y: 12, zMin: -45, zMax: -37.6 },

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

  // A is intentionally EMPTY: no enemy, no hazard, no deck. Its job is the view —
  // B's deck and Sprayer are visible across Gap 1, so the player arrives at the
  // first fight with a plan. See `docs/levels/01-outskirts.md`, "Island A — the
  // vantage", for the playtest that removed the deck, the Charger and the pit.
  //

  // NO BEACONS (#39). There used to be four free-floating unlit boxes here —
  // blue, red and two green — marking where the player was meant to paint what.
  // Two of them hung in mid-air over a gap with nothing under them, and Renda
  // read them, fairly, as leftover gate furniture: "remove the floating coloured
  // marker boxes".
  //
  // If the tower turns out not to explain itself in playtest, the fix is NOT to
  // put them back. DESIGN.md is explicit that guidance should be environmental,
  // and a box floating in the void is the opposite of that. The diegetic options
  // are a green stain already on the climb face, a drain-pipe running up it, or
  // the sound the field makes — all of which say "this wall is part of the machine
  // you paint" without a signpost.

  // DESIGN.md teaching beats, not just spawn points:
  //   Charger  — island B. 5 m/s, 25 contact. The answer is paint BLUE: it
  //              slides straight past. That patch is also the Gap 2 run-up.
  //   Charger  — island C. Rushes you the moment you land, which is what makes
  //              the arena unavoidable now the exit is a door rather than a
  //              launch you could paint past.
  //   Sprayer  — island C. Ranged pressure while you fight the Charger.
  //   Sprayer x2 — on the RIGHT pillar's top, which is where the bounce puts you.
  //              These are the shooters Renda asked for (#39 #6): you land among
  //              them, and the bounce is the only way up.
  //
  // Spawns are a starting hint, not a hold: there is no aggro radius, so enemies
  // walk at the player from load and freeze where the next step would fall off.
  spawns: [
    // island A — NOTHING. The entry is a vantage, not a fight (playtest, 24 Oct).
    // The first enemy is the first thing past Gap 1.
    { x: 4,   y: 0,   z: -1,   type: 'charger' },
    { x: -4,  y: 0,   z: -21,  type: 'charger' },
    { x: 0,   y: 0,   z: -19,  type: 'sprayer' },
    { x: 5,   y: 7.0, z: -37,  type: 'sprayer' },
    { x: 7.5, y: 7.0, z: -36,  type: 'sprayer' },
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
    // ABOVE the waste (-0.45), not below it. The shelves were at -0.6 when the
    // waste sat at -1.1; raising the river to shin height would have drowned the
    // forest, so they came up with it. Still lower than the corridor, which is the
    // point — the causeway, the flood plain either side of it, and the water.
    y: -0.2,
    // Runs the level's full depth. It has to reach past the extraction ledge
    // (z -45) or the world simply stops being drawn at the point the player is
    // standing at the end of the mission — and the waste trenches are derived
    // from this, so they follow it automatically.
    zMin: -47,
    zMax: 28,
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
  // WHY IT IS FLUSH AND NOT LOWER. At -1.1 the surface sat below the level's bottom
  // edge as the player reads it: you looked DOWN into a pit with goop at the bottom
  // instead of ACROSS a channel you are expected to jump. Renda: "it isn't making it
  // look like a river you have to jump over."
  //
  // At -0.45 it was still wrong, for a subtler reason, and this is the number that
  // matters: "when I stand on the edge of an island I can see underneath the next
  // island and the green river loses its impact." Every island and shelf in this
  // level is a ZERO-THICKNESS plane, so any drop at a lip leaves an unfilled sliver
  // of void at the edge — and a river 45 cm down turned that sliver into a visible
  // gap you could see the world through. 10 cm is a bank you cannot see past.
  // Renda: "it must be the same height as the top of the floor (it can be slightly
  // lower)".
  //
  // `tuck` is the other half of the same fix and it is the half that would not have
  // been guessed: the slabs have to pass UNDER the floors either side, not stop at
  // their edges. Where the water stops exactly at a lip, the sliver shows void;
  // where it continues 2.5 m underneath, the same sliver shows water. The river is
  // visible where the floor is not.
  y: -0.10,
  tuck: 2.5,
  colour: 0x86b32d,    // toxic green, in the same drained family as the dead ground
  emissive: 0x1d2c07,  // a little self-lit, so it reads as something you should not touch
  wave: 0.05,          // crests peak at -0.02: below the floor, above the shelves
  bob: 0.03,
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
  // The gate frames are the only structure left in the level — everything else is
  // a PaintSurface. See `_gate`.
  concrete: 0x6b6f73,

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
    // The ground floor behind the door. NOT marked `tower`, so the forest comes back
    // here, framing the pillars the way it frames every other island (#39: "reintroduce
    // the forest past the gate of island c, just on the sides like the other islands").
    this._floor(L1.ascent.vestibule.zMin, L1.ascent.vestibule.zMax, 0);

    this._ascent();
    this._shoulders();
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
    // Island C's watches the ARENA FLOOR only — the two that rush you. The two
    // shooters up the right-hand pillar are NOT part of it (Renda: "the gate should
    // open after killing the two enemies on island c"). They did not need to be: a
    // gate is there to stop you RUNNING PAST a fight, and you cannot run past
    // something standing on the only landing you can bounce to.
    this.gateB = this._gate({
      contains: (p) => this._inIsland('B', p),
      z: L1.islands.B.zMin, yBase: 0, yTop: L1.gates.B.yTop,
    });
    this.gateC = this._gate({
      contains: (p) => this._inIsland('C', p),
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
    const tuck = WASTE.tuck;

    // Every rectangle is EXPANDED by `tuck` into the floors it sits between. See
    // WASTE.tuck: a slab that stops at a lip leaves a sliver of void at the edge of
    // a zero-thickness floor, and that sliver is what "I can see underneath the
    // next island" was.
    const holes = [
      { xMin: -inner - tuck, xMax: inner + tuck, zMin: L1.islands.B.zMax - tuck, zMax: L1.islands.A.zMin + tuck },
      { xMin: -inner - tuck, xMax: inner + tuck, zMin: L1.islands.C.zMax - tuck, zMax: L1.islands.B.zMin + tuck },
      { xMin: -outer, xMax: -inner + tuck, zMin: shelf.zMin, zMax: shelf.zMax },
      { xMin: inner - tuck, xMax: outer, zMin: shelf.zMin, zMax: shelf.zMax },
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
   * The ascent (#39 #6, revised) — see the `ascent` block in L1 for the route and
   * for why every number is what it is. This builds four kinds of thing:
   *
   *   FLOOR    a walkable PaintSurface at a height. `_platform` for the off-centre
   *            ones on the +x side, `_face` for the vertical climb panels.
   *   ROCK     `_rock`, the unpaintable band. The level's first obstacle that is
   *            not a colour question.
   *   PILLAR   `_pillar`, a column with three climbable sides and a capital.
   *   STRUCTURE the concrete the player sees. Plain `MeshToonMaterial` meshes, so
   *            they read the SCENE lights and need no `uLightDir` wiring, unlike
   *            every custom-shaded surface. They exist because a PaintSurface is a
   *            ZERO-THICKNESS plane — fine for a floor you stand on, useless for
   *            anything meant to read as a solid object.
   */
  /**
   * The ascent (#39 #6, revised) — see the `ascent` block in L1 for the route and
   * for why every number is what it is.
   *
   * EVERYTHING HERE IS A PAINTSURFACE AND NOTHING ELSE. Renda: "why can't you use
   * the same mesh for the platform, a grid for the sides and for the top, no need to
   * have any extra stuff." He was right, and the concrete that used to be here was
   * causing two problems at once:
   *
   *   - Z-FIGHTING. A deck is a PaintSurface plane at exactly y, and the slab drawn
   *     under it had its TOP FACE at exactly y too. Two coplanar surfaces, fighting.
   *     Every solid in this file had that shape of bug available to it.
   *   - It read as structure laid on top of a grid rather than AS the grid, which is
   *     what everything else in this world is. Islands are grid planes with nothing
   *     under them; a pillar made of grid planes is the same thing stood on end.
   *
   * So a pillar is three side planes and a top plane. The rock is a plane. The ledge
   * is a plane. Nothing is drawn twice, and nothing is coplanar with anything.
   */
  _ascent() {
    const a = L1.ascent;

    this._pillar(a.pillar1);
    this._pillar(a.pillar2);

    // --- the back wall --------------------------------------------------------
    this._rock(a.base);
    this._rock(a.rock);
    this._face(a.green);

    // --- the extraction ledge -------------------------------------------------
    this._platform({
      y: L1.ledge.y, zMin: L1.ledge.zMin, zMax: L1.ledge.zMax,
      xMin: -L1.corridorHalf, xMax: L1.corridorHalf, mark: 'tower',
    });
  }

  /**
   * One square pillar — three side planes and a top plane, and nothing else.
   *
   * Three sides, not four, because the back is against the wall. Renda: "make the
   * platforms pillar like, so that you can shoot the paint on their sides from
   * multiple angles." Which side you paint is the player's choice, and each is a
   * separate PaintSurface with its own paint grid, so painting one does not light up
   * another. `unpaintable` turns that off, which is how the right-hand pillar is a
   * solid box you cannot climb (Renda: "the right platform shouldn't be
   * paintable") — it is reached by the bounce and by nothing else.
   *
   * THE CORNICE IS LOAD-BEARING, not ornament. A green climb cannot top out on its
   * own — contact is tested at chest height, so the climber loses the wall with their
   * feet 0.85 m short and has to jump, and that jump is pushed AWAY from the face.
   * So the top plane has to reach past the side plane, or the climb lands on nothing.
   * A pillar with a flush top is unclimbable no matter how much paint you put on it.
   * Measured minimum: 0.3 m. Ours is 1 m, which is also small enough to read as a
   * moulding rather than as a floor laid on the box (Renda's original complaint).
   */
  _pillar({ xMin, xMax, zMin, zMax, y, overhang, unpaintable = false }) {
    // --- the three sides ------------------------------------------------------
    // Front (normal +z), then the two sides (normals -x and +x). The side panels
    // are the same primitive rotated a quarter turn; `_resolveWalls` reads the
    // normal off the mesh quaternion, so a rotated panel pushes out correctly.
    for (const spec of [{ z: zMax, xMin, xMax }]) {
      this._face({ yBase: 0, yTop: y, z: spec.z, xMin: spec.xMin, xMax: spec.xMax, unpaintable });
    }

    for (const [x, normalX] of [[xMin, -1], [xMax, 1]]) {
      this._face({ yBase: 0, yTop: y, x, zMin, zMax, unpaintable, normalX });
    }

    // --- the top, overhanging every side it can be climbed from --------------
    this._platform({
      y, zMin, zMax: zMax + overhang,
      xMin: xMin - overhang, xMax: xMax + overhang,
      mark: 'tower',
    });
  }

  /**
   * A band of UNPAINTABLE wall — the obstacle, and the reason the last climb can
   * only be used from one side.
   *
   * Painting a wall green is what makes it climbable (`rules.climbable`), so a wall
   * that cannot be painted is a wall that cannot be climbed: "normally we have to
   * use green to get up to extraction, but what if it ... [were] blocked by a rocks
   * or something that stops u from using green". One flag, and it is the same flag
   * the gates use — see `paint-surface.js`.
   *
   * It is the paint grid, standing there, ungreyable. No rock geometry: the grid IS
   * the wall, the same way the ground is the grid — which is also what removed the
   * last of the Z-fighting (facets drawn in FRONT of a plane that was still there).
   * It reads as the Corp's material because it is the one surface in the level the
   * player can never change.
   */
  _rock({ xMin, xMax, yBase, yTop, z }) {
    return this._face({ yBase, yTop, z, xMin, xMax, unpaintable: true });
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
   * corridor: the pillars' tops and the forest shelves. `_floor` assumes the
   * corridor's centre line.
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

  /**
   * One vertical climb face: the paint grid standing up.
   *
   * Same primitive as everything else that collides — a PaintSurface — and the ONLY
   * thing on a wall. `unpaintable` makes it a solid you cannot paint, which is what
   * stops a wall being climbable.
   *
   * `normalX` rotates it a quarter turn so the same helper serves the pillars' side
   * faces. `_resolveWalls` reads the normal off the mesh quaternion, so a rotated
   * panel pushes the player out correctly — no special case anywhere.
   */
  _face({ yBase, yTop, z = 0, x = 0, xMin, xMax, zMin, zMax, unpaintable = false, normalX = 0 }) {
    const width = normalX ? zMax - zMin : xMax - xMin;
    const s = new PaintSurface({ width, height: yTop - yBase, cells: L1.cells, unpaintable });

    if (normalX) {
      s.mesh.rotation.y = normalX * Math.PI / 2;
      s.mesh.position.set(x, (yBase + yTop) / 2, (zMin + zMax) / 2);
    } else {
      s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
    }

    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);
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

    // Lock bar above the door. A wide bar rather than a marker box: it is part of
    // the doorway, not a signpost telling you to paint something.
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
