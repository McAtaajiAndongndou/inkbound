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

  // --- the ascent (#39 #6, revised to Renda's sketch) ------------------------
  //
  // THE ROUTE, in his words: "reach top here with green only then bounce to where
  // enemies are" ... "at the top of the side platform you can go around the
  // obstacle" ... extraction "up here like before".
  //
  //   arena (y 0)
  //     │  GREEN ONLY — 2.2 m is past a 1.39 m jump, so paint is the way up
  //     ▼
  //   lower deck (y 2.2)            · red pad at the back
  //     │  RED BOUNCE — 4.3 m of lift, the only way up
  //     ▼
  //   side platform (y 5.5)         · two shooters ... and the OBSTACLE
  //     │  walk AROUND the rock, then GREEN up
  //     ▼
  //   extraction (y 9.0)            "up here like before"
  //
  // WHAT REPLACES WHAT, because this is the third shape island C has had and the
  // two before it are why the numbers are what they are:
  //
  //   v1  a red pad that launched you up THROUGH a platform slab, then a green
  //       wall, then an extraction ledge hanging 5 m out over the arena. Nothing
  //       here has ceiling collision, so "up through its own floor" was not a bug
  //       in the pad — it was the only way that platform could ever be reached.
  //       Renda saw the ledge as "a mini platform with trees on it" (#4), and it
  //       was LOAD-BEARING: a green climb cannot top out on its own, so the ledge
  //       had to overhang the wall by more than the jump-off drift.
  //   v2  a stair tower: jump, climb, climb.  Renda's sketch instead wants the
  //       paint and the bounce to be the two steps, and wants the LAST climb
  //       blocked so the extraction can only be reached the long way round.
  //
  // THE NUMBERS THAT DRIVE THE SHAPE, all forced rather than chosen:
  //
  //   JUMP = 1.39 m   (8.5^2 / 2*26). Every rise is set against this.
  //   BOUNCE = 4.33 m (15^2 / 2*26). The one way from the lower deck to the side
  //                   platform, and why the lower deck cannot be a jump away.
  //   LIP = 2.1 m     A green climb NEVER tops out on its own: wall contact is
  //                   tested at chest height (position.y + 0.85), so the climber
  //                   loses the wall with their feet ~0.85 m BELOW the deck they
  //                   were heading for, and the climb ends in a jump. Whatever
  //                   that jump lands on must be under them, and the jump-off
  //                   pushes you AWAY from the face — so the floor above a climb
  //                   has to overhang it. `_face` callers set `deck.zMax` for it.
  //
  // The bounce is a fixed 4.33 m of LIFT; how far it carries you sideways is
  // whatever speed you ran onto the pad with, 3-7 m/s giving 0.6-2.4 m in the time
  // it takes to reach the side platform's height. So the side platform OVERLAPS
  // the lower deck in z — it has to, or a slow approach would fall short of it.
  ascent: {
    // The pedestal on the +x side. Doors from gate C, so the corridor's left stays
    // open and the structure reads as built against the wall.
    xMin: 2.5,
    xMax: 11,

    // Green only: 2.2 > 1.39. The lip overhangs `face1` by 2.1 m (-27 -> -24.9).
    lower: { y: 2.2, zMin: -34, zMax: -24.9 },
    face1: { yBase: 0, yTop: 2.2, z: -27 },

    // Reached by the bounce, and only by the bounce: nothing here is climbable
    // from the lower deck, and 3.3 m is two and a half jumps.
    //
    // Full width so the bounce cannot miss, and starting at z -29 — it OVERLAPS
    // the lower deck by five metres, and that overlap is the whole reason the pad
    // is reliable regardless of entry speed.
    //
    // The overlap is not cosmetic either, and this is the number that broke first:
    // the pad covers a 2.4 m radius, so the player steps onto red at z -30.6. If
    // the platform's edge were behind that, the bounce would launch from OUTSIDE
    // its footprint, the ground probe would find nothing above the lower deck to
    // land on, and the player would rise to the apex and drop straight back down.
    // Red is a trampoline, so they would then bounce again, forever.
    upper: { y: 5.5, zMin: -40, zMax: -29 },

    // THE OBSTACLE, and Renda's pick: an unpaintable band standing in the way up.
    // It spans all but the far +x end of the wall, so the climb you CAN use is
    // three metres of wall at the end you have to walk to — which is "go around
    // the obstacle" rather than "climb the wall in front of you".
    //
    // Lore to come (Renda: "we can give it a lore reason and reintroduce it in
    // future levels"), so it is named as a thing rather than described by what it
    // blocks: `rock` is the Corrupt Corp's own material, and the same material can
    // do the L2 turret's job without any new machinery.
    rock: { yBase: 5.5, yTop: 9, z: -40, xMin: -11, xMax: 2.5 },
    green: { yBase: 5.5, yTop: 9, z: -40, xMin: 2.5, xMax: 11 },

    // The base of that same wall, y 0 -> 5.5. Two jobs, and neither is optional:
    //   - it CLOSES the ground floor, so the vestibule is a room rather than a
    //     corridor that ends in a hole you fall into the void through.
    //   - it stops the obvious bypass. Without it, the ground floor's back wall
    //     would be a paintable surface, and painting it green would let you climb
    //     straight from the vestibule to the side platform — skipping the red pad
    //     entirely, which is the one step the whole layout exists to force.
    base: { yBase: 0, yTop: 5.5, z: -40, xMin: -11, xMax: 11 },

    // The y0 floor the whole thing stands on, behind the door. Runs the full
    // depth now, so the ground floor is bounded by the rock rather than by nothing.
    vestibule: { zMin: -40, zMax: -24 },

    // The red pad, painted onto the lower deck at build time. Painted rather than
    // a mesh because a red surface IS a trampoline — `SURFACE.red.restitution`
    // does the work, so a pad is literally paint. The plate under it is the only
    // extra geometry, and it is there so the pad reads as equipment rather than as
    // a spill.
    pad: { x: 6.75, z: -33, radius: 2.4 },
  },

  // The win zone: the back of the extraction ledge. A Box3 checked against the
  // player's position, so it spans the full corridor width.
  extraction: { zMin: -45, zMax: -42.5 },

  // The extraction ledge itself, at the height it had in the original design. The
  // lip overhangs the climb by 2.4 m (-40 -> -37.6), which is what a climb needs:
  // the top-out jump is pushed AWAY from the face, so it lands ~1.1 m back from
  // where it started and the floor has to be under it.
  ledge: { y: 9, zMin: -45, zMax: -37.6 },

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
  //   Sprayer x2 — on the side platform (y 5.5), which is the far side of the
  //              bounce. These are the shooters Renda asked for (#39 #6): you have
  //              to beat them to cross the platform, and the rock band means the
  //              only climb up is at the end you have to walk to.
  //
  // Spawns are a starting hint, not a hold: there is no aggro radius, so enemies
  // walk at the player from load and freeze where the next step would fall off.
  spawns: [
    { x: 4,   y: 0,   z: -1,   type: 'charger' },
    { x: -4,  y: 0,   z: -21,  type: 'charger' },
    { x: 0,   y: 0,   z: -19,  type: 'sprayer' },
    { x: 6,   y: 5.5, z: -36,  type: 'sprayer' },
    { x: 9,   y: 5.5, z: -37,  type: 'sprayer' },
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
  // WHY SUB-SHIN HEIGHT AND NOT 1.1 m DOWN. At −1.1 the surface was below the
  // level's bottom edge as the player reads it: you looked DOWN into a pit with
  // goop at the bottom, rather than ACROSS a channel you are expected to jump.
  // Renda: "the toxic waste is sitting below the plane's level which isn't making
  // it look like a river you have to jump over".
  //
  // At −0.45 the surface is at a standing player's shins. Look across a 9 m gap
  // and the far bank is visible just above the waterline, which is what a river
  // from a bridge actually looks like. The WAVE CREST must still clear the forest
  // shelves (see `L1.shouldShelf.y`, −0.2), or the trees stand in the water, which
  // is why the amplitude came down with the height.
  y: -0.45,
  colour: 0x86b32d,    // toxic green, in the same drained family as the dead ground
  emissive: 0x1d2c07,  // a little self-lit, so it reads as something you should not touch
  wave: 0.11,          // crests peak at -0.27, comfortably under the shelves
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

  // The rock the obstacle is cut from — deliberately a different substance from
  // the concrete, because it is not the Corrupt Corp's building, it is the world
  // they have been mining. Renda wants it to come back in later levels with a lore
  // reason, so it is named for itself rather than for what it blocks.
  rock: 0x5a4f43,
  rockDepth: 1.8,

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
    // The ground floor behind the door. Marked `tower` so the decor scatter skips
    // it, for two reasons: the upper deck covers most of it, so it is an interior
    // under a concrete slab; and the strip that is NOT covered is the run-up to
    // `face1`, where a tree at x >= 4.6 would stand directly in front of the wall
    // you are supposed to notice you can paint. Ground cover hiding the route is
    // exactly what #5 was about, and this is the one place it would matter most.
    const vestibule = this._floor(L1.ascent.vestibule.zMin, L1.ascent.vestibule.zMax, 0);
    vestibule.tower = true;

    this._ascent();
    this._shoulders();
    this._extraction();

    // Exposed so the level's own contract test can assert the pad's geometry
    // against the platform it has to land on (see `tests/level-contract.test.js`).
    this.pad = L1.ascent.pad;
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
      contains: (p) => this._inIsland('C', p) || this._inAscent(p),
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
   * The ascent (#39 #6, revised) — see the `ascent` block in L1 for the route and
   * for why every number is what it is. This builds four kinds of thing:
   *
   *   FLOOR    a walkable PaintSurface at a height. `_platform` for the off-centre
   *            ones on the +x side, `_face` for the vertical climb panels.
   *   ROCK     `_rock`, the unpaintable band. The level's first obstacle that is
   *            not a colour question.
   *   PAD      `_pad`, a painted red trampoline plus the plate that makes it read
   *            as equipment.
   *   STRUCTURE the concrete the player sees. Plain `MeshToonMaterial` meshes, so
   *            they read the SCENE lights and need no `uLightDir` wiring, unlike
   *            every custom-shaded surface. They exist because a PaintSurface is a
   *            ZERO-THICKNESS plane — fine for a floor you stand on, useless for
   *            anything meant to read as a solid object.
   */
  _ascent() {
    const a = L1.ascent;

    // --- the walkable floors --------------------------------------------------
    this._deck(a.lower);
    this._platform({
      y: a.upper.y, zMin: a.upper.zMin, zMax: a.upper.zMax,
      xMin: -L1.corridorHalf, xMax: L1.corridorHalf, mark: 'tower',
    });
    this._platform({
      y: L1.ledge.y, zMin: L1.ledge.zMin, zMax: L1.ledge.zMax,
      xMin: -L1.corridorHalf, xMax: L1.corridorHalf, mark: 'tower',
    });

    // --- the climb faces ------------------------------------------------------
    // Only these two are paintable. See `_rock`.
    this._face({ ...a.face1, xMin: a.xMin, xMax: a.xMax });
    this._face(a.green);

    // --- the obstacle ---------------------------------------------------------
    this._rock(a.rock);
    this._rock(a.base);

    // --- the pad --------------------------------------------------------------
    this._pad(a.pad, a.lower.y);

    // --- the concrete you can see --------------------------------------------
    const concrete = new THREE.MeshToonMaterial({ color: TOWER.concrete });
    const dark = new THREE.MeshToonMaterial({ color: TOWER.underside });

    // a slab under each deck, so a deck is a storey rather than a floating sheet
    const slabs = [
      { y: a.lower.y, zMin: a.lower.zMin, zMax: a.lower.zMax, xMin: a.xMin, xMax: a.xMax },
      { y: a.upper.y, zMin: a.upper.zMin, zMax: a.upper.zMax, xMin: -L1.corridorHalf, xMax: L1.corridorHalf },
      { y: L1.ledge.y, zMin: L1.ledge.zMin, zMax: L1.ledge.zMax, xMin: -L1.corridorHalf, xMax: L1.corridorHalf },
    ];
    for (const s of slabs) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(s.xMax - s.xMin, TOWER.slab, s.zMax - s.zMin),
        dark,
      );
      slab.position.set(
        (s.xMin + s.xMax) / 2,
        s.y - TOWER.slab / 2,
        (s.zMin + s.zMax) / 2,
      );
      this.root.add(slab);
    }

    // Support columns down the lower deck's open edge, so it reads as carried
    // rather than cantilevered out of nowhere.
    for (const z of [a.lower.zMax - 0.4, a.lower.zMin + 0.4]) {
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(TOWER.column, a.lower.y, TOWER.column),
        concrete,
      );
      column.position.set(a.xMin + TOWER.column / 2, a.lower.y / 2, z);
      this.root.add(column);
    }

    // A parapet along the back of the extraction ledge — without it the win zone
    // looks like the place the world stops.
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(L1.corridorHalf * 2, TOWER.parapet, 0.8),
      concrete,
    );
    parapet.position.set(0, L1.ledge.y + TOWER.parapet / 2, L1.ledge.zMin + 0.4);
    this.root.add(parapet);
  }

  /**
   * The red pad: paint a trampoline onto a floor and put a plate under it.
   *
   * It is PAINT, not a special mesh, and that is the point — `SURFACE.red`
   * already has `restitution`, so a red surface IS a trampoline and a pad is
   * literally just red ground. Nothing here needs to know how bouncing works.
   *
   * The plate is the only new geometry, and it exists so the pad reads as
   * equipment someone installed rather than as a spill: a thin unlit slab, so it
   * glows faintly against the drained concrete. It has no collision, so it can
   * never affect the bounce itself.
   */
  _pad({ x, z, radius }, y) {
    const deck = this.surfaces.find((s) => s.isFloor && s.tower
      && Math.abs(s.mesh.position.y - y) < 1e-6);
    // Fail loudly: a pad that lands on nothing is a route with a hole in it, and
    // the failure mode is "the level is unfinishable", which is worth a throw.
    if (!deck) throw new Error(`[Level01] no deck at y=${y} to paint the red pad onto`);

    if (!deck.splat(new THREE.Vector3(x, y, z), 'red', radius)) {
      throw new Error('[Level01] the red pad was painted onto a surface that refused it');
    }

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.06, 20),
      new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
    );
    plate.position.set(x, y + 0.03, z);
    this.root.add(plate);
    return deck;
  }

  /**
   * A band of UNPAINTABLE rock — the obstacle, and the reason the last climb can
   * only be used from one side.
   *
   * Painting a wall green is what makes it climbable (`rules.climbable`), so a
   * wall that cannot be painted is a wall that cannot be climbed: "normally we
   * have to use green to get up to extraction, but what if it ... [were] blocked
   * by a rocks or something that stops u from using green". One flag, and it is
   * the same flag the gates use — see `paint-surface.js`.
   *
   * Drawn as rock rather than concrete on purpose: this is the Corrupt Corp's own
   * material, and it should read as a different substance from everything they
   * built around it.
   */
  _rock({ xMin, xMax, yBase, yTop, z }) {
    const s = new PaintSurface({
      width: xMax - xMin, height: yTop - yBase, cells: L1.cells, unpaintable: true,
    });
    s.mesh.position.set((xMin + xMax) / 2, (yBase + yTop) / 2, z);
    s.mesh.visible = false;      // the rock mesh below is what the player sees
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);

    // FACETS rather than one slab, so it reads as a rock face and not as more of
    // the concrete every other wall here is made of. The pieces are deterministic
    // — fixed fractions and fixed bulges, no noise — so the level looks the same
    // every run, the same reasoning as `createMistTexture`.
    const w = xMax - xMin;
    const h = yTop - yBase;
    const rockMat = new THREE.MeshToonMaterial({ color: TOWER.rock });
    const pieces = [
      { f: 0.0, t: 0.34, bulge: 0.5 },
      { f: 0.3, t: 0.62, bulge: 0.9 },
      { f: 0.58, t: 0.78, bulge: 0.3 },
      { f: 0.74, t: 0.9, bulge: 0.7 },
      { f: 0.88, t: 1.0, bulge: 0.2 },
    ];
    for (const p of pieces) {
      const depth = TOWER.rockDepth * p.bulge;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w * (p.t - p.f), h, depth),
        rockMat,
      );
      // behind the collision plane, so the player is stopped by the face they see
      mesh.position.set(xMin + w * (p.f + p.t) / 2, (yBase + yTop) / 2, z - depth / 2);
      this.root.add(mesh);
    }

    return s;
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

  /** The lower deck: `_platform` pinned to the ascent's own footprint. */
  _deck({ y, zMin, zMax, xMin = L1.ascent.xMin, xMax = L1.ascent.xMax }) {
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
   * Is a world point on the ascent — the structure behind island C's door? The
   * far half of island C's gate watches this as well as the island itself, so the
   * two shooters up there are part of the same fight.
   *
   * One box rather than a footprint per deck: the lower deck, the upper deck and
   * the extraction ledge all sit inside `xMin..corridorHalf` and
   * `vestibule.zMin..C.zMin`, and an enemy cannot be inside that box without
   * being on the structure.
   */
  _inAscent(p) {
    return p.z <= L1.islands.C.zMin + 0.5
      && Math.abs(p.x) <= L1.corridorHalf + 0.5;
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
