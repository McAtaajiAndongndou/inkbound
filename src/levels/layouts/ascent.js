// OWNER: E (Levels)
//
// THE ASCENT — the layout, as data. Version 2 (29 Oct 2026): the spiral.
//
// This file is the single source of truth for the level's shape. Three things
// read it, and none of them may hold a second copy of any number here:
//
//   1. docs/levels/massing/massing.html?layout=ascent — the 3D massing model
//   2. docs/levels/massing/render-diagrams.mjs ascent — the plan, side views and pacing
//      chart in docs/levels/02-the-ascent.md
//   3. src/levels/level-02-ascent.js — the playable level (once rebuilt)
//
// That is the fix for "the sketch was fine and the build sucked": the build
// and the drawings come from the same numbers, so they cannot disagree.
// tests/ascent-layout.test.js checks this data against the player's physics.
//
// AXES. x is east, y is up, z is SOUTH. The player starts in the far south
// (+z) and spirals up the mountain: south face → east canyon → north face →
// west ledge → summit.
//
// BOXES are [x0, x1, y0, y1, z0, z1], metres, axis-aligned.
import { PAINT_GRID } from '../../config.js';

/** Solid rock. `top: true` means its top face is walkable floor. */
const solids = [
  // --- R0 Trailhead — the arrival plateau --------------------------------------
  { id: 'trailhead', room: 'R0', box: [-20, 20, -2, 0, 48, 80], top: true },

  // --- R1 The Staged Climb — two 6 m faces and a rest ledge --------------------
  { id: 'rest-ledge', room: 'R1', box: [-4, 4, 0, 6, 48, 51.5], top: true, lips: { '+z': 0.3 } },

  // --- R2 Terrace One — the south shelf ----------------------------------------
  { id: 'terrace-one', room: 'R2', box: [-18, 18, 0, 12, 24, 48], top: true, lips: { '+z': 0.3, '+x': 0.3 } },
  { id: 't1-cover-a', room: 'R2', box: [-10, -6, 12, 16.6, 32, 35], kind: 'cover' },
  { id: 't1-cover-b', room: 'R2', box: [6, 10, 12, 16.6, 37, 40], kind: 'cover' },
  { id: 't1-low-wall', room: 'R2', box: [-3, 3, 12, 13, 30, 30.6], kind: 'cover' },

  // --- The core: the mountain itself, stepped so it tapers ----------------------
  // A single 48 x 48 x 40 box read as a crate in the massing model. The lower
  // core stops at 24 m — a shoulder wave 1 starts on, 12 m above Terrace One —
  // and the peak above it is narrower, set back on the west where the ledge
  // and the final climb need its face.
  { id: 'core-low', room: 'R2', box: [-24, 24, 0, 24, -24, 24], top: true, kind: 'shoulder' },
  { id: 'core-high', room: 'R7', box: [-24, 12, 24, 40, -24, 18], top: true, lips: { '-x': 0.3 } },

  // --- R3 The Catwalk — east canyon, over the scree ------------------------------
  { id: 'scree-south', room: 'R3', box: [18, 38, 0, 4, 24, 44], top: true, kind: 'catch' },
  { id: 'scree-canyon', room: 'R3', box: [24, 38, 0, 4, -8, 24], top: true, kind: 'catch' },
  // The vista (Open decision 1, 29 Oct): rest pillar 1 widened into a kerbed
  // balcony. It is 30 m from turret t0 — out of its 15 m reach — so it is the one
  // safe stop between the two biggest fights: refill, and look back over Terrace
  // One and up the canyon at what is coming. Pillar 2 could not be the breather:
  // it sits inside t0's ring.
  { id: 'vista', room: 'R3', box: [30, 38, 4, 12, 30, 38], top: true },
  { id: 'rest-pillar-2', room: 'R3', box: [30, 34, 4, 12, 2, 6], top: true },
  { id: 'foot', room: 'R4', box: [28, 38, 4, 12, -8, 2], top: true },

  // --- R4 Terrace Two — the east massif ---------------------------------------
  { id: 'terrace-two', room: 'R4', box: [38, 66, 0, 20, -32, 6], top: true, lips: { '-x': 0.3 } },
  { id: 't2-high-deck', room: 'R4', box: [52, 66, 20, 24, -32, -16], top: true },
  { id: 't2-step-1', room: 'R4', box: [62, 66, 20, 21, -10, -7], top: true, kind: 'step' },
  { id: 't2-step-2', room: 'R4', box: [62, 66, 20, 22, -13, -10], top: true, kind: 'step' },
  { id: 't2-step-3', room: 'R4', box: [62, 66, 20, 23, -16, -13], top: true, kind: 'step' },
  { id: 't2-pocket-rock', room: 'R4', box: [44, 48, 20, 24.6, -24, -20], kind: 'cover' },
  // The first massing pass left the arena an empty flat under three turrets —
  // exposure, not a decision. A low wall and a rock split it into lanes, so
  // "paint in the open or behind cover" is a real choice.
  { id: 't2-low-wall', room: 'R4', box: [42, 50, 20, 21, -12, -11.4], kind: 'cover' },
  { id: 't2-rock', room: 'R4', box: [54, 58, 20, 24.6, -10, -6], kind: 'cover' },

  // --- R5 The North Face — three switchback legs, the chain up the middle ------
  { id: 'leg-1', room: 'R5', box: [-24, 38, 0, 20, -40, -24], top: true },
  { id: 'leg-1-east', room: 'R5', box: [38, 44, 0, 20, -40, -32], top: true },
  { id: 'leg-2', room: 'R5', box: [-24, 29, 20, 26, -34, -24], top: true },
  { id: 'leg-3', room: 'R5', box: [-31, 29, 26, 32, -29, -24], top: true },
  // Leg 1 → leg 2: five 1.2 m steps rising west.
  { id: 's12-1', room: 'R5', box: [-9, -6, 20, 21.2, -40, -34], top: true, kind: 'step' },
  { id: 's12-2', room: 'R5', box: [-12, -9, 20, 22.4, -40, -34], top: true, kind: 'step' },
  { id: 's12-3', room: 'R5', box: [-15, -12, 20, 23.6, -40, -34], top: true, kind: 'step' },
  { id: 's12-4', room: 'R5', box: [-18, -15, 20, 24.8, -40, -34], top: true, kind: 'step' },
  { id: 's12-5', room: 'R5', box: [-21, -18, 20, 26, -40, -34], top: true, kind: 'step' },
  // Leg 2 → leg 3: five 1.2 m steps rising east.
  { id: 's23-1', room: 'R5', box: [14, 17, 26, 27.2, -34, -29], top: true, kind: 'step' },
  { id: 's23-2', room: 'R5', box: [17, 20, 26, 28.4, -34, -29], top: true, kind: 'step' },
  { id: 's23-3', room: 'R5', box: [20, 23, 26, 29.6, -34, -29], top: true, kind: 'step' },
  { id: 's23-4', room: 'R5', box: [23, 26, 26, 30.8, -34, -29], top: true, kind: 'step' },
  { id: 's23-5', room: 'R5', box: [26, 29, 26, 32, -34, -29], top: true, kind: 'step' },

  // --- R6 The Ledge — a free ridge on the west face, catch shelf below ----------
  { id: 'west-catch', room: 'R6', box: [-36, -24, 0, 26, -34, 24], top: true, kind: 'catch' },
  { id: 'ledge', room: 'R6', box: [-31, -26, 26, 32, -24, 12], top: true },
  { id: 'ledge-landing', room: 'R6', box: [-31, -24, 26, 32, 12, 18], top: true },
];

/** Thin walkable things that are not the top of a solid: catwalk segments, pads. */
const slabs = [
  // Catwalk span 1, east from Terrace One: three 4 m segments.
  ...[18, 22, 26].map((x, i) => ({ id: `span-1-${i + 1}`, room: 'R3', kind: 'catwalk', y: 12, x: [x, x + 4], z: [30, 34] })),
  // Catwalk span 2, north along the canyon: six 4 m segments.
  ...[26, 22, 18, 14, 10, 6].map((z, i) => ({ id: `span-2-${i + 1}`, room: 'R3', kind: 'catwalk', y: 12, x: [30, 34], z: [z, z + 4] })),
  // The chain: two pads off the north face. Bounce 1 is off your own red on leg 1.
  // `scaffold`: Corp scaffold platforms (Open decision 2) — posts down to the leg
  // below, so the chain reads from R5's entrance 41 m away. Props pass.
  { id: 'pad-1', room: 'R5', kind: 'pad', y: 24, x: [-2, 2], z: [-36, -34], scaffold: true },
  { id: 'pad-2', room: 'R5', kind: 'pad', y: 28, x: [-2, 2], z: [-31, -29], scaffold: true },
  // The lift cage floor on the summit.
  { id: 'lift', room: 'R8', kind: 'lift', y: 40.2, x: [-3, 3], z: [12, 18] },
];

/**
 * Paintable climb strips. Everything else is rock and refuses paint.
 * `face` is the direction the climber faces FROM (the face's outward normal).
 */
const strips = [
  { id: 'face-a', room: 'R1', face: '+z', at: 51.5, span: [-3, 3], y: [0, 6], note: 'Stage 1' },
  { id: 'face-b', room: 'R1', face: '+z', at: 48, span: [-3, 3], y: [6, 12], note: 'Stage 2' },
  { id: 'scree-return', room: 'R3', face: '+x', at: 18, span: [36, 40], y: [4, 12], note: 'Back up from the scree' },
  { id: 'foot-climb', room: 'R4', face: '-x', at: 38, span: [-6, 0], y: [12, 20], note: 'Under turret fire' },
  { id: 'final-climb', room: 'R6', face: '-x', at: -24, span: [13, 17], y: [32, 40], note: 'The last of your tank' },
];

/**
 * Low edges you can see and jump, but do not walk off by accident. Where two
 * meet at a corner one is trimmed, so they touch rather than overlap — an
 * overlap builds as two walls in one plane.
 */
const kerbs = [
  { id: 'th-w', box: [-20, -19.4, 0, 1, 48, 79.4] },
  { id: 'th-e', box: [19.4, 20, 0, 1, 48, 79.4] },
  { id: 'th-s', box: [-20, 20, 0, 1, 79.4, 80] },
  { id: 't1-w', box: [-18, -17.4, 12, 13, 24, 47.4] },
  { id: 't1-s-w', box: [-18, -4, 12, 13, 47.4, 48] },
  { id: 't1-s-e', box: [4, 18, 12, 13, 47.4, 48] },
  { id: 't1-e-n', box: [17.4, 18, 12, 13, 24, 30] },
  { id: 't1-e-s', box: [17.4, 18, 12, 13, 40, 47.4] },
  { id: 't2-s', box: [38, 66, 20, 21, 5.4, 6] },
  // Leg 3's south edge, where it overhangs the core shoulder (y 24, 8 m down,
  // a dead end) and, past x 24, the void. (A first version put this kerb on
  // leg 2, which is under leg 3 there — the build test caught it inside rock.)
  { id: 'leg3-s', box: [12, 29, 32, 33, -24.6, -24] },
  { id: 't2-e', box: [65.4, 66, 20, 21, -7, 5.4] },
  // The vista balcony: kerbed on its three open sides.
  { id: 'vista-e', box: [37.4, 38, 12, 13, 30.6, 37.4] },
  { id: 'vista-s', box: [30, 38, 12, 13, 37.4, 38] },
  { id: 'vista-n', box: [34, 38, 12, 13, 30, 30.6] },
  { id: 'vista-w', box: [30, 30.6, 12, 13, 34, 37.4] },
];

/** Not walkable: things to see. */
const landmarks = [
  // The lift tower. Its beacon is the goal you can see from the trailhead.
  { id: 'lift-tower', box: [-3, 3, 43, 56, 12, 18], beacon: [0, 57, 15] },
  // Corrupt Corp's base on the north-west horizon, seen from the summit.
  { id: 'the-base', box: [-210, -150, 0, 34, -190, -140] },
];

/**
 * Enemies. `wake` is when it starts: on entering a room, or when a wave dies.
 * Turrets never sleep. Cast: wall-crawler + turret (DECISIONS 2026-10-06) plus
 * the ledge Chargers from the original design.
 */
const enemies = [
  { id: 'e1-w1-a', type: 'wallCrawler', pos: [-10, 24, 21], room: 'R2', wave: 1, wake: 'enter:R2' },
  { id: 'e1-w1-b', type: 'wallCrawler', pos: [10, 24, 21], room: 'R2', wave: 1, wake: 'enter:R2' },
  // Wave 2 waits, dormant and VISIBLE, at the trailhead's edges — off the
  // walking line. Shoot them now (paint you need for the climb) or leave them,
  // and they come up YOUR green faces behind you once wave 1 dies.
  { id: 'e1-w2-a', type: 'wallCrawler', pos: [-15, 0, 60], room: 'R2', wave: 2, wake: 'cleared:R2.1' },
  { id: 'e1-w2-b', type: 'wallCrawler', pos: [15, 0, 60], room: 'R2', wave: 2, wake: 'cleared:R2.1' },
  { id: 't0', type: 'turret', pos: [40, 20, 3], room: 'R4', wave: 1, wake: 'always' },
  { id: 't1', type: 'turret', pos: [59, 24, -24], room: 'R4', wave: 1, wake: 'always' },
  { id: 't2', type: 'turret', pos: [50, 20, -30], room: 'R4', wave: 1, wake: 'always' },
  { id: 'e2-a', type: 'wallCrawler', pos: [30, 4, -2], room: 'R4', wave: 1, wake: 'enter:R4' },
  { id: 'e2-b', type: 'wallCrawler', pos: [34, 4, 14], room: 'R4', wave: 1, wake: 'enter:R4' },
  { id: 'r5-a', type: 'wallCrawler', pos: [-14, 26, -31.5], room: 'R5', wave: 1, wake: 'enter:R5' },
  { id: 'r5-b', type: 'wallCrawler', pos: [20, 32, -26.5], room: 'R5', wave: 1, wake: 'enter:R5' },
  { id: 'c1', type: 'charger', pos: [-28.5, 32, 0], room: 'R6', wave: 1, wake: 'enter:R6' },
  { id: 'c2', type: 'charger', pos: [-27.5, 32, 15], room: 'R6', wave: 2, wake: 'cleared:R6.1' },
];

/** Routes, as waypoints on the floor. The main route is the slow, safe way. */
const routes = {
  main: [
    [0, 0, 74], [0, 0, 52], [0, 6, 49.5], [0, 12, 47.5], [0, 12, 36], [18, 12, 32], [34, 12, 34], [32, 12, 30],
    [32, 12, 4], [33, 12, -3], [38.5, 20, -3], [50, 20, -8], [41, 20, -28], [41, 20, -37],
    [-6, 20, -37], [-21, 26, -37], [-20, 26, -31.5], [14, 26, -31.5], [29, 32, -31.5],
    [27, 32, -26.5], [-28.5, 32, -26.5], [-28.5, 32, 15], [-24.5, 32, 15], [-23, 40, 15],
    [-10, 40, 12], [0, 40, 12],
  ],
  // The chain: bounce off your own red on leg 1, two pads, land on leg 3.
  chain: [[0, 20, -38.5], [0, 24, -35], [0, 28, -30], [0, 32, -26.5]],
};

/**
 * Rooms, in order. `eye` is the "what you see" frame on arrival.
 * Travel time is MEASURED from `routes` by render-diagrams.mjs; `fightSeconds`
 * and `dwellSeconds` (standing still on purpose: refilling, taking in a view)
 * are design ESTIMATES for a first-timer, and the doc labels them as such.
 */
const rooms = [
  { id: 'R0', name: 'Trailhead', act: 1, intensity: 1, fightSeconds: 0,
    eye: { pos: [0, 1.5, 76], target: [0, 32, 12] },
    question: 'Where am I going?' },
  { id: 'R1', name: 'The Staged Climb', act: 1, intensity: 2, fightSeconds: 0, dwellSeconds: 6,
    eye: { pos: [0, 1.5, 60], target: [0, 7, 48] },
    question: 'Can I get up there on one tank?' },
  { id: 'R2', name: 'Terrace One', act: 2, intensity: 8, fightSeconds: 75,
    eye: { pos: [0, 13.5, 46.5], target: [0, 20, 24] },
    question: 'Will you paint a route something else can use?' },
  { id: 'R3', name: 'The Catwalk', act: 2, intensity: 3, fightSeconds: 0, dwellSeconds: 12,
    // Aimed up the canyon: aimed at the Foot, the view line ran through the
    // core's north-east corner (the viewer's view-line test caught it).
    eye: { pos: [20, 13.5, 32], target: [34, 14, 14] },
    question: 'Can you cross before it drops — and while you are watched?' },
  { id: 'R4', name: 'Terrace Two', act: 2, intensity: 9, fightSeconds: 90,
    eye: { pos: [40, 21.5, -3], target: [58, 23, -22] },
    question: 'Can you make paint where you are being watched?' },
  { id: 'R5', name: 'The North Face', act: 3, intensity: 6, fightSeconds: 30,
    eye: { pos: [41, 21.5, -37], target: [-6, 25, -36] },
    question: 'Will you commit to the chain, or take the long way?' },
  { id: 'R6', name: 'The Ledge', act: 3, intensity: 8, fightSeconds: 40,
    eye: { pos: [-28.5, 33.5, -22], target: [-28.5, 32, 16] },
    question: 'How do you beat a Charger with nowhere to sidestep?' },
  { id: 'R7', name: 'Summit', act: 3, intensity: 1, fightSeconds: 0, dwellSeconds: 10,
    eye: { pos: [-20, 41.5, 14], target: [-180, 20, -165] },
    question: 'Why are we doing this?' },
  { id: 'R8', name: 'Supply Lift', act: 3, intensity: 0, fightSeconds: 0,
    eye: { pos: [0, 41.5, 4], target: [0, 45, 15] },
    question: '—' },
];

/**
 * The win: the lift cage (#95), on the far side of the summit from where you
 * arrive, so you get the view first. It leaves once the ledge (R6) is clear.
 */
const win = { box: [-3, 3, 39.7, 43.2, 12, 18], requires: 'R6' };

/**
 * What the design tools need that is not geometry: the plan's extent, the
 * section cuts, the massing model's camera views, the goal every sightline is
 * measured to, and the alternative route the pacing chart compares.
 */
const doc = {
  planBounds: [-42, 72, -48, 84],
  goal: { label: 'the lift tower', point: [0, 50.8, 18] },
  altRoute: { route: 'chain', replaces: 'R5', extraSeconds: 7, paintSeconds: 3 },
  offMap: { from: [-30, -38], to: [-40, -46], label: 'the base, ~200 m NW' },
  sections: [
    { id: 'a', axis: 'x', at: 0, from: 84, to: -46, title: 'SECTION A — north–south through x 0: trailhead, staged climb, Terrace One, the core, the chain' },
    { id: 'b', axis: 'z', at: 0, from: -42, to: 70, title: 'SECTION B — west–east through z 0: the ledge and its catch, the core, the canyon, the Foot, Terrace Two' },
    { id: 'c', axis: 'z', at: 32, from: -26, to: 44, top: 26, title: 'SECTION C — west–east through z 32: Terrace One, catwalk span 1, the scree that catches a fall' },
  ],
  views: [
    { name: 'overview', label: 'Overview (from the south-east)', pos: [110, 95, 120], target: [10, 18, -5], fov: 55, caption: 'The whole spiral: south face → east canyon → north face → west ledge → summit.' },
    { name: 'top', label: 'Top-down plan', pos: [12, 230, 21], target: [12, 0, 20], fov: 40, caption: 'Plan view. Floors are coloured by room.' },
    { name: 'north', label: 'From the north (the chain)', pos: [10, 45, -110], target: [5, 22, -30], fov: 50, caption: 'The north face: three switchback legs, the chain straight up the middle.' },
    { name: 'west', label: 'From the west (the ledge)', pos: [-110, 50, 10], target: [-26, 28, 0], fov: 50, caption: 'The ledge: a free ridge with a catch shelf 6 m below it.' },
  ],
};

export const ASCENT = {
  id: 'ascent', name: 'The Ascent', cells: PAINT_GRID.level2Cells,
  solids, slabs, strips, kerbs, landmarks, enemies, routes, rooms, win, doc,
};
