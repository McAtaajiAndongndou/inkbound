// OWNER: E (Levels)
//
// LAST COLOUR — the layout, as data. Version 2 (29 Oct 2026).
//
// The single source of truth for the level's shape, read by the massing model,
// the design-doc diagrams, and the level itself (see ascent.js for why). Its
// physics checks are tests/last-colour-layout.test.js.
//
// THREE SPATIAL IDEAS CARRY THE LEVEL:
//
//   1. THE SIPHON IS THE GOAL YOU CAN SEE. Lift, hangar, corridor and Core sit
//      on one north–south axis (x 0), so the Siphon is in frame from the lift
//      door onward — straight down the corridor, through the gate fields.
//   2. HIGH GROUND IS THE ONLY SAFE PAINT. Drainers, Stalkers and Chargers
//      cannot climb (`climbsGreen: false`), so a raised platform is paint
//      nothing can eat. Every arena floor point is within a 5 s walk of a
//      climb up to one (tested) — the design doc's "paintable pocket" rule.
//      Wave three's turrets are what take that safety away.
//   3. THE NEXT WAVE IS VISIBLE. Wave bays sit behind gate fields; wave three
//      waits, dormant, behind wave two.
//
// AXES. x east, y up, z SOUTH. The player arrives in the south (+z) by the
// Ascent's supply lift and walks north (−z) to the Siphon.
// BOXES are [x0, x1, y0, y1, z0, z1], metres, axis-aligned.
import { PAINT_GRID } from '../../config.js';

/** Solid rock, steel and concrete. `top: true` means a walkable top. */
const solids = [
  // --- R0 The Lift Landing — the arrival, 3 m above the hangar floor ----------
  // A one-way vantage ("a vista with a one-way entrance", LDB): a 3 m drop in,
  // and a green strip (or a red bounce) back up — so it is also a paint pocket.
  { id: 'landing', room: 'R0', box: [-6, 6, 0, 3, 78, 90], top: true, lips: { '-z': 0.3 } },
  { id: 'shaft-w', box: [-8, -6, 0, 12, 78, 92], kind: 'wall' },
  { id: 'shaft-e', box: [6, 8, 0, 12, 78, 92], kind: 'wall' },
  { id: 'shaft-n', box: [-6, 6, 0, 12, 90, 92], kind: 'wall' },

  // --- R1 The Hangar — 48 x 38 m, wave one: six Drainers -----------------------
  { id: 'hangar-floor', room: 'R1', box: [-24, 24, -2, 0, 40, 78], top: true },
  { id: 'hangar-w', box: [-26, -24, 0, 12, 40, 78], kind: 'wall' },
  { id: 'hangar-e', box: [24, 26, 0, 12, 40, 78], kind: 'wall' },
  { id: 'hangar-s-w', box: [-26, -8, 0, 12, 78, 80], kind: 'wall' },
  { id: 'hangar-s-e', box: [8, 26, 0, 12, 78, 80], kind: 'wall' },
  { id: 'hangar-n-w', box: [-26, -6, 0, 12, 38, 40], kind: 'wall' },
  { id: 'hangar-n-e', box: [6, 26, 0, 12, 38, 40], kind: 'wall' },
  // Gantries along both long walls: the hangar's safe paint.
  { id: 'gantry-w', room: 'R1', box: [-24, -18, 0, 5, 44, 74], top: true, kind: 'pocket', lips: { '+x': 0.3 } },
  { id: 'gantry-e', room: 'R1', box: [18, 24, 0, 5, 44, 74], top: true, kind: 'pocket', lips: { '-x': 0.3 } },
  // A control booth by the corridor mouth: the third pocket, so the north end
  // of the floor is in reach of one too.
  { id: 'booth', room: 'R1', box: [4, 10, 0, 3.5, 42, 46], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  // Containers: cover, 4.6 m — above a red bounce, never a perch.
  { id: 'container-1', room: 'R1', box: [-14, -8, 0, 4.6, 62, 65], kind: 'cover' },
  { id: 'container-2', room: 'R1', box: [8, 14, 0, 4.6, 52, 55], kind: 'cover' },
  { id: 'container-3', room: 'R1', box: [-10, -4, 0, 4.6, 50, 52], kind: 'cover' },

  // --- R2 The Corridor — 12 x 50 m, two turrets and a Charger -----------------
  { id: 'corridor-floor', room: 'R2', box: [-6, 6, -2, 0, -10, 40], top: true },
  // Walls are 10 m: the walkway (4 m) plus a red bounce (4.33) must not clear them.
  { id: 'corridor-w-s', box: [-8, -6, 0, 10, 18, 38], kind: 'wall' },
  { id: 'corridor-w-n', box: [-8, -6, 0, 10, -8, 12], kind: 'wall' },
  { id: 'corridor-e', box: [6, 8, 0, 10, -8, 38], kind: 'wall' },
  // The alcove: turret T2's nest, a recess in the west wall.
  { id: 'alcove-floor', room: 'R2', box: [-12, -6, -2, 0, 12, 18], top: true },
  { id: 'alcove-back', box: [-14, -12, 0, 10, 10, 20], kind: 'wall' },
  { id: 'alcove-n', box: [-12, -8, 0, 10, 10, 12], kind: 'wall' },
  { id: 'alcove-s', box: [-12, -8, 0, 10, 18, 20], kind: 'wall' },
  // The flanking walkway along the east wall, 4 m up: the way past both turrets
  // — and over the laser grid (trap pass), which only reaches 3 m.
  { id: 'walkway', room: 'R2', box: [2, 6, 0, 4, -6, 36], top: true, lips: { '-x': 0.3 } },
  { id: 'pillar-s', room: 'R2', box: [-4, -2, 0, 10, 26, 28], kind: 'cover' },
  { id: 'pillar-n', room: 'R2', box: [-4, -2, 0, 10, 4, 6], kind: 'cover' },
  // Turret T1's platform at the corridor's far end, beside the Core door.
  { id: 't1-platform', room: 'R2', box: [-6, -2, 0, 3, -10, -6], top: true },

  // --- R3 The Core — 52 x 52 m, waves two and three, the Siphon ---------------
  { id: 'core-floor', room: 'R3', box: [-26, 26, -2, 0, -62, -10], top: true },
  { id: 'core-s-w', box: [-28, -6, 0, 14, -10, -8], kind: 'wall' },
  { id: 'core-s-e', box: [6, 28, 0, 14, -10, -8], kind: 'wall' },
  { id: 'core-w-s', box: [-28, -26, 0, 14, -30, -10], kind: 'wall' },
  { id: 'core-w-n', box: [-28, -26, 0, 14, -64, -42], kind: 'wall' },
  { id: 'core-e-s', box: [26, 28, 0, 14, -30, -10], kind: 'wall' },
  { id: 'core-e-n', box: [26, 28, 0, 14, -64, -42], kind: 'wall' },
  { id: 'core-n-w', box: [-26, -6, 0, 14, -64, -62], kind: 'wall' },
  { id: 'core-n-e', box: [6, 26, 0, 14, -64, -62], kind: 'wall' },
  // The ring balcony, 5 m up and 6 m deep, broken only at the three bay mouths
  // and the entrance. Every piece is a pocket: nothing that eats paint climbs.
  { id: 'balcony-sw', room: 'R3', box: [-26, -6, 0, 5, -16, -10], top: true, kind: 'pocket', lips: { '-z': 0.3 } },
  { id: 'balcony-se', room: 'R3', box: [6, 26, 0, 5, -16, -10], top: true, kind: 'pocket', lips: { '-z': 0.3 } },
  { id: 'balcony-w-s', room: 'R3', box: [-26, -20, 0, 5, -30, -16], top: true, kind: 'pocket', lips: { '+x': 0.3 } },
  { id: 'balcony-w-n', room: 'R3', box: [-26, -20, 0, 5, -56, -42], top: true, kind: 'pocket' },
  { id: 'balcony-e-s', room: 'R3', box: [20, 26, 0, 5, -30, -16], top: true, kind: 'pocket', lips: { '-x': 0.3 } },
  { id: 'balcony-e-n', room: 'R3', box: [20, 26, 0, 5, -56, -42], top: true, kind: 'pocket' },
  { id: 'balcony-nw', room: 'R3', box: [-26, -6, 0, 5, -62, -56], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  { id: 'balcony-ne', room: 'R3', box: [6, 26, 0, 5, -62, -56], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  // The Siphon: 10 x 10 x 22 m in the middle of the room. Architecture and cover
  // during the waves; the final exam after (#100, src/levels/siphon.js).
  { id: 'siphon', room: 'R3', box: [-5, 5, 0, 22, -41, -31], kind: 'siphon' },
  // Floor cover: two low walls (hop them) and two blocks (fight round them).
  { id: 'core-low-wall-w', room: 'R3', box: [-14, -8, 0, 1, -24, -23.4], kind: 'cover' },
  { id: 'core-low-wall-e', room: 'R3', box: [8, 14, 0, 1, -24, -23.4], kind: 'cover' },
  { id: 'core-block-w', room: 'R3', box: [-16, -12, 0, 4.6, -50, -46], kind: 'cover' },
  { id: 'core-block-e', room: 'R3', box: [12, 16, 0, 4.6, -50, -46], kind: 'cover' },

  // --- Wave bays: the west and east bays hold waves two and three; the north
  // bay is Big Arm's (#99). Each behind a gate field the player can see into.
  { id: 'bay-w-floor', room: 'R3', box: [-34, -26, -2, 0, -42, -30], top: true, kind: 'bay' },
  { id: 'bay-w-back', box: [-36, -34, 0, 10, -44, -28], kind: 'wall' },
  { id: 'bay-w-n', box: [-34, -28, 0, 10, -44, -42], kind: 'wall' },
  { id: 'bay-w-s', box: [-34, -28, 0, 10, -30, -28], kind: 'wall' },
  { id: 'bay-e-floor', room: 'R3', box: [26, 34, -2, 0, -42, -30], top: true, kind: 'bay' },
  { id: 'bay-e-back', box: [34, 36, 0, 10, -44, -28], kind: 'wall' },
  { id: 'bay-e-n', box: [28, 34, 0, 10, -44, -42], kind: 'wall' },
  { id: 'bay-e-s', box: [28, 34, 0, 10, -30, -28], kind: 'wall' },
  { id: 'bay-n-floor', room: 'R3', box: [-6, 6, -2, 0, -74, -62], top: true, kind: 'bay' },
  { id: 'bay-n-back', box: [-8, 8, 0, 14, -76, -74], kind: 'wall' },
  { id: 'bay-n-w', box: [-8, -6, 0, 14, -74, -64], kind: 'wall' },
  { id: 'bay-n-e', box: [6, 8, 0, 14, -74, -64], kind: 'wall' },
];

/** Paintable climb strips — the ways up to the pockets. Everything else is steel. */
const strips = [
  { id: 'landing-return', room: 'R0', face: '-z', at: 78, span: [-2, 2], y: [0, 3], note: 'Back up to the landing' },
  { id: 'gantry-w-climb', room: 'R1', face: '+x', at: -18, span: [56, 60], y: [0, 5], note: 'West gantry' },
  { id: 'gantry-e-climb', room: 'R1', face: '-x', at: 18, span: [56, 60], y: [0, 5], note: 'East gantry' },
  { id: 'booth-climb', room: 'R1', face: '+z', at: 46, span: [6, 8], y: [0, 3.5], note: 'The booth' },
  { id: 'walkway-climb', room: 'R2', face: '-x', at: 2, span: [32, 36], y: [0, 4], note: 'Onto the flanking walkway' },
  { id: 'balcony-sw-climb', room: 'R3', face: '-z', at: -16, span: [-12, -8], y: [0, 5], note: 'South-west balcony' },
  { id: 'balcony-se-climb', room: 'R3', face: '-z', at: -16, span: [8, 12], y: [0, 5], note: 'South-east balcony' },
  { id: 'balcony-w-climb', room: 'R3', face: '+x', at: -20, span: [-26, -22], y: [0, 5], note: 'West balcony' },
  { id: 'balcony-e-climb', room: 'R3', face: '-x', at: 20, span: [-26, -22], y: [0, 5], note: 'East balcony' },
  { id: 'balcony-nw-climb', room: 'R3', face: '+z', at: -56, span: [-16, -12], y: [0, 5], note: 'North-west balcony' },
  { id: 'balcony-ne-climb', room: 'R3', face: '+z', at: -56, span: [12, 16], y: [0, 5], note: 'North-east balcony' },
];

/**
 * Gates: full-height fields that drop when their rule holds (layout-level.js).
 * The wave bays open as you enter the Core, so wave two pours in; wave three is
 * already standing behind it, and waits 8 s after wave two is gone. Big Arm's
 * gate pulses for 12 s once wave three is gone, then drops (decision 1: the
 * pacing never dropped, so these are the two breaths).
 */
const gates = [
  { id: 'gate-corridor', box: [-6, 6, 0, 10, 39.8, 40.2], opens: 'cleared:R1.1' },
  { id: 'gate-bay-w', box: [-26.2, -25.8, 0, 10, -42, -30], opens: 'enter:R3' },
  { id: 'gate-bay-e', box: [25.8, 26.2, 0, 10, -42, -30], opens: 'enter:R3' },
  { id: 'gate-bay-n', box: [-6, 6, 0, 14, -62.2, -61.8], opens: 'cleared:R3.3+12' },
];

/**
 * Trap zones. The crusher is built (crusher.js, polish pass 1); the laser grid
 * is cut to BACKLOG Parked (the crusher is the trap with a rhythm). Not geometry.
 */
const traps = [
  { id: 'cargo-crusher', room: 'R2', kind: 'crusher', box: [-6, 2, 0, 10, 22, 24], note: 'Fixed rhythm. Cross in the gap, or blue-slide under. The walkway passes beside it.' },
  { id: 'laser-grid', planned: true, room: 'R2', kind: 'laser', box: [-6, 6, 0, 3, 0, 1], note: 'Never through. Red bounce over (4.33 > 3), or the walkway at 4 m passes above it.' },
];

/**
 * Props — the Corp prop kit (#56, polish pass 1), built by prop-kit.js. Not
 * geometry: no collision, no paint, so enemies path exactly as before. Grey
 * machinery; the amber lamps are the one colour. Keep-outs are tested: off
 * every strip and route point, and nothing on an arena floor above 1.2 m.
 * Each room is dressed differently, so the three read as three places:
 *   hangar    crate stacks and jersey barriers — a cargo bay
 *   corridor  pipe runs on both walls and a rail on the walkway — a service duct
 *   Core      lamps over every bay gate, overhead pipes, barriers at the mouths
 */
const props = [
  // --- R1 The Hangar: cargo ------------------------------------------------
  ...[[-17, 46], [-17, 47.3], [-15.7, 46], [16, 66], [16, 67.3], [-17, 70], [14.6, 74]].map(([x, z], i) => ({
    id: `hangar-crate-${i + 1}`, room: 'R1', kind: 'crate', box: [x, x + 1.2, 0, 1.2, z, z + 1.2],
  })),
  { id: 'hangar-barrier-w', room: 'R1', kind: 'barrier', box: [-14, -11, 0, 0.9, 76, 76.6] },
  { id: 'hangar-barrier-e', room: 'R1', kind: 'barrier', box: [11, 14, 0, 0.9, 76, 76.6] },
  { id: 'hangar-barrier-n', room: 'R1', kind: 'barrier', box: [-4, -1, 0, 0.9, 43, 43.6] },
  { id: 'hangar-pipe-w', room: 'R1', kind: 'pipe', box: [-23.9, -23.3, 9, 9.6, 40, 78] },
  { id: 'hangar-pipe-e', room: 'R1', kind: 'pipe', box: [23.3, 23.9, 9, 9.6, 40, 78] },

  // --- R2 The Corridor: a service duct --------------------------------------
  { id: 'corridor-pipe-e-lo', room: 'R2', kind: 'pipe', box: [5.5, 5.9, 7, 7.4, -8, 38] },
  { id: 'corridor-pipe-e-hi', room: 'R2', kind: 'pipe', box: [5.3, 5.9, 8.2, 8.8, -8, 38] },
  { id: 'corridor-pipe-w-s', room: 'R2', kind: 'pipe', box: [-5.9, -5.3, 8.2, 8.8, 20, 38] },
  { id: 'corridor-pipe-w-n', room: 'R2', kind: 'pipe', box: [-5.9, -5.3, 8.2, 8.8, -8, 10] },
  { id: 'walkway-rail', room: 'R2', kind: 'rail', box: [2.05, 2.15, 4.95, 5.05, -4, 31] },

  // --- R3 The Core: lamps over the bay gates are the waves' tell ------------
  // West and east bays: blink through wave three's 8 s breath.
  { id: 'lamp-bay-w-n', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [-26, -25.5, 10.5, 11.3, -43.2, -42.4] },
  { id: 'lamp-bay-w-s', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [-26, -25.5, 10.5, 11.3, -29.6, -28.8] },
  { id: 'lamp-bay-e-n', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [25.5, 26, 10.5, 11.3, -43.2, -42.4] },
  { id: 'lamp-bay-e-s', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [25.5, 26, 10.5, 11.3, -29.6, -28.8] },
  // North bay: blinks with Big Arm's 12 s gate pulse.
  { id: 'lamp-bay-n-w', room: 'R3', kind: 'light', rule: 'cleared:R3.3+12', box: [-7.2, -6.4, 12, 12.8, -62, -61.5] },
  { id: 'lamp-bay-n-e', room: 'R3', kind: 'light', rule: 'cleared:R3.3+12', box: [6.4, 7.2, 12, 12.8, -62, -61.5] },
  { id: 'core-pipe-n-w', room: 'R3', kind: 'pipe', box: [-26, -6, 11, 11.6, -61.9, -61.3] },
  { id: 'core-pipe-n-e', room: 'R3', kind: 'pipe', box: [6, 26, 11, 11.6, -61.9, -61.3] },
  { id: 'core-pipe-s-w', room: 'R3', kind: 'pipe', box: [-26, -6, 11, 11.6, -10.7, -10.1] },
  { id: 'core-pipe-s-e', room: 'R3', kind: 'pipe', box: [6, 26, 11, 11.6, -10.7, -10.1] },
  { id: 'core-barrier-w', room: 'R3', kind: 'barrier', box: [-18, -17.4, 0, 0.9, -39, -36] },
  { id: 'core-barrier-e', room: 'R3', kind: 'barrier', box: [17.4, 18, 0, 0.9, -36, -33] },
  { id: 'core-crate-w', room: 'R3', kind: 'crate', box: [-17.4, -16.2, 0, 1.2, -48.6, -47.4] },
  { id: 'core-crate-e', room: 'R3', kind: 'crate', box: [16.2, 17.4, 0, 1.2, -48.6, -47.4] },
];

/**
 * Not walkable: things to see. The Siphon's three phase targets (below) are
 * where src/levels/siphon.js builds the intake, the arms and the core (#100).
 */
const landmarks = [
  // The Siphon's mast and beacon, 27 m up. The Siphon itself (22 m) is in view
  // from the lift only down the corridor's axis, 120 m off, where it reads as
  // nothing (massing review, 29 Oct). The beacon clears the hangar's 12 m wall
  // from anywhere on the landing (tested) — the overlook shows the goal over
  // the wall. From the hangar floor it is down the corridor axis only.
  { id: 'siphon-mast', box: [-1, 1, 22, 26, -37, -35], beacon: [0, 27, -36] },
];
// `face` is the side of the Siphon the plate looks out of (src/levels/siphon.js).
const targets = [
  { id: 'siphon-intake', pos: [0, 3, -30.8], face: '+z', note: 'Phase 1 — blue freezes it' },
  { id: 'siphon-arm-w', pos: [-5.2, 8, -36], face: '-x', note: 'Phase 2 — green pins it' },
  { id: 'siphon-arm-e', pos: [5.2, 8, -36], face: '+x', note: 'Phase 2 — green pins it' },
  { id: 'siphon-arm-n', pos: [0, 8, -41.2], face: '-z', note: 'Phase 2 — green pins it' },
  { id: 'siphon-core', pos: [0, 16, -30.8], face: '+z', note: 'Phase 3 — red knocks it into the machine' },
];
/** The leak (#100): where the Siphon spills each phase's colour, [x, z] on the Core floor. */
const spill = [0, -26];

/** Enemies. `planned` ones (Big Arm) are placed but not spawned until they exist. */
const enemies = [
  // Wave one — the hangar: six Drainers, nothing else (#96).
  ...[[-12, 70], [12, 70], [-14, 48], [14, 46], [-6, 58], [6, 62]].map(([x, z], i) => ({
    id: `w1-drainer-${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R1', wave: 1, wake: 'enter:R1',
  })),
  // The corridor: two turrets and one Charger, no waves (#97).
  { id: 'c-turret-1', type: 'turret', pos: [-4, 3, -8], room: 'R2', wave: 1, wake: 'always' },
  { id: 'c-turret-2', type: 'turret', pos: [-10, 0, 15], room: 'R2', wave: 1, wake: 'always' },
  { id: 'c-charger', type: 'charger', pos: [0, 0, 30], room: 'R2', wave: 1, wake: 'enter:R2' },
  // Wave two — the Core: eight Drainers, two Chargers, the first Stalker (#98).
  // Split across the west and east bays; the Stalker comes from the east alone.
  ...[[-28, -40], [-28, -37], [-28, -34], [-28, -31]].map(([x, z], i) => ({
    id: `w2-drainer-w${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 2, wake: 'enter:R3',
  })),
  ...[[28, -40], [28, -37], [28, -34], [28, -31]].map(([x, z], i) => ({
    id: `w2-drainer-e${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 2, wake: 'enter:R3',
  })),
  { id: 'w2-charger-w', type: 'charger', pos: [-30, 0, -36], room: 'R3', wave: 2, wake: 'enter:R3' },
  { id: 'w2-charger-e', type: 'charger', pos: [30, 0, -38], room: 'R3', wave: 2, wake: 'enter:R3' },
  { id: 'w2-stalker', type: 'stalker', pos: [30, 0, -33], room: 'R3', wave: 2, wake: 'enter:R3' },
  // Wave three — waiting, visible, at the back of the same bays; plus two
  // turrets on the north balcony that take the high ground's safety away.
  ...[[-33, -40], [-33, -36], [-33, -32]].map(([x, z], i) => ({
    id: `w3-drainer-w${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 3, wake: 'cleared:R3.2+8',
  })),
  ...[[33, -40], [33, -36], [33, -32]].map(([x, z], i) => ({
    id: `w3-drainer-e${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 3, wake: 'cleared:R3.2+8',
  })),
  { id: 'w3-charger-w', type: 'charger', pos: [-31, 0, -41], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-charger-e', type: 'charger', pos: [31, 0, -31], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-turret-nw', type: 'turret', pos: [-23, 5, -59], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-turret-ne', type: 'turret', pos: [23, 5, -59], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  // Big Arm (#99, src/enemies/boss.js): the Core's fourth wave, out of the
  // north bay when its gate drops. Room R3, so "the Core is clear" — which the
  // Siphon waits for — includes it. The bay floor is part of R3.
  { id: 'big-arm', type: 'bigArm', pos: [0, 0, -68], room: 'R3', wave: 4, wake: 'cleared:R3.3+12' },
  // The two Drainers it calls in phase 2. They exist from load (the paint gun
  // takes its target list once), dormant and visible at the back of the bay;
  // `summon` is a rule nothing satisfies, so only Big Arm (or a hit) wakes them.
  { id: 'ba-drainer-w', type: 'drainer', pos: [-3.5, 0, -72], room: 'R3', wave: 5, wake: 'summon' },
  { id: 'ba-drainer-e', type: 'drainer', pos: [3.5, 0, -72], room: 'R3', wave: 5, wake: 'summon' },
];

/** Routes. The main route walks the floor; the flank takes the walkway. */
const routes = {
  main: [
    [0, 3, 86], [0, 3, 79], [0, 0, 74], [0, 0, 41], [0, 0, 30], [0, 0, 0], [0, 0, -9.5],
    [0, 0, -24], [0, 0, -29],
  ],
  flank: [[0, 0, 38], [1.5, 0, 34], [4, 4, 34], [4, 4, -5], [3, 0, -8]],
};

/**
 * Rooms. Big Arm and the Siphon are beats in the Core, listed so the pacing
 * chart shows them; both are `planned` (their mechanics are #99 and #100).
 * Travel is MEASURED from routes; fight and dwell seconds are ESTIMATES.
 */
const rooms = [
  { id: 'R0', name: 'Lift Landing', act: 1, intensity: 1, fightSeconds: 0, dwellSeconds: 5,
    eye: { pos: [0, 4.5, 86], target: [0, 8, -36] },
    question: 'Where is it?' },
  { id: 'R1', name: 'The Hangar', act: 1, intensity: 7, fightSeconds: 75,
    eye: { pos: [0, 4.5, 78.6], target: [0, 0, 52] },
    question: 'Why is my ground disappearing?' },
  { id: 'R2', name: 'The Corridor', act: 2, intensity: 6, fightSeconds: 45,
    eye: { pos: [0, 1.5, 39], target: [0, 3, -8] },
    question: 'Can I fight without room to repaint?' },
  // dwell: the 8 s breath between waves two and three (decision 1).
  { id: 'R3', name: 'The Core', act: 2, intensity: 9, fightSeconds: 180, dwellSeconds: 8,
    eye: { pos: [0, 1.5, -9.5], target: [0, 8, -36] },
    question: 'Can I hold ground and fight at the same time?' },
  // dwell: the 12 s warning while Big Arm's gate pulses (decision 1).
  { id: 'R4', name: 'Big Arm', act: 3, intensity: 10, fightSeconds: 90, dwellSeconds: 12,
    eye: { pos: [-23, 6.5, -20], target: [0, 2, -66] },
    question: 'Can you beat it by understanding it, not by shooting it?' },
  { id: 'R5', name: 'The Siphon', act: 3, intensity: 8, fightSeconds: 60,
    eye: { pos: [0, 1.5, -24], target: [0, 10, -36] },
    question: 'Do you know the order?' },
];

/**
 * The win volume is the OBJECTIVE MARKER at the intake. The win itself is the
 * Siphon's (#100): its exam begins once `requires` is clear, and the level
 * wins when phase three is done (Level03.scriptedWin, src/levels/siphon.js).
 */
const win = { box: [-3, 3, -0.5, 3, -31, -28], requires: 'R3' };

/** What the design tools need that is not geometry (see ascent.js). */
const doc = {
  planBounds: [-40, 40, -80, 94],
  goal: { label: 'the Siphon', point: [0, 11, -31] },
  sections: [
    { id: 'a', axis: 'x', at: 0, from: 94, to: -78, top: 26, title: 'SECTION A — north–south through x 0: lift, hangar, corridor, the Core, the Siphon, the Big Arm bay' },
    { id: 'b', axis: 'z', at: -36, from: -38, to: 38, top: 26, title: 'SECTION B — west–east through z −36: the wave bays, the balconies, the Siphon' },
    { id: 'c', axis: 'z', at: 20, from: -16, to: 12, top: 14, title: 'SECTION C — west–east through z 20: the corridor, its alcove, the flanking walkway' },
  ],
  views: [
    { name: 'overview', label: 'Overview (from the south-east)', pos: [70, 75, 115], target: [0, 2, 12], fov: 55, caption: 'One axis, south to north: lift, hangar, corridor, the Core — and the Siphon at the end of it.' },
    { name: 'top', label: 'Top-down plan', pos: [0, 260, 8.01], target: [0, 0, 8], fov: 40, caption: 'Plan view. Floors are coloured by room.' },
    { name: 'core', label: 'The Core from above', pos: [46, 48, -2], target: [0, 2, -36], fov: 55, caption: 'The Core: the Siphon in the middle, the ring balcony, the three wave bays behind their gates.' },
    { name: 'corridor', label: 'The corridor from above', pos: [22, 26, 48], target: [0, 2, 14], fov: 55, caption: 'The corridor: the alcove turret, the pillars, the cargo crusher and the flanking walkway beside it.' },
  ],
};

/** Paint on the floor at load. None: the spawn pad was removed (Renda, 30 Oct). */
const prepaint = [];

/**
 * Curves (#198, src/levels/curves.js). No collision, like the props.
 *
 *   tank   the Siphon's tank: a lathe on its roof, round the mast. Low and
 *          domed so the beacon still clears it from every room's eye (tested)
 *   vats   two lathe vats on the Core's north wall-tops, outside the arena
 *   hoses  from the tank down to each vat, sagging over the Core at 17 m+
 *   cables runs across the hangar's roof line. Their z avoids 44-56, where
 *          the R0/R1 eyes' line to the beacon passes at cable height, and
 *          68+, where the mission intro's camera flies in (both tested)
 *
 * Profiles are [radius, height] from the bottom up.
 */
const curves = {
  tank: { at: [0, 22, -36], profile: [[0.9, 0], [2.6, 0.2], [2.6, 1.1], [2.0, 1.7], [0.9, 2.1]] },
  vats: {
    at: [[-27, 14, -63], [27, 14, -63]],
    profile: [[0.4, 0], [2.0, 0.3], [2.2, 1.0], [2.2, 4.0], [1.6, 4.8], [0.6, 5.2]],
  },
  hoses: [
    { points: [[-2.0, 23, -37.5], [-26, 19.4, -62]], sag: 3 },
    { points: [[2.0, 23, -37.5], [26, 19.4, -62]], sag: 3 },
  ],
  cables: [58, 62, 66].map((z) => ({ points: [[-23.6, 11.6, z], [23.6, 11.6, z]], sag: 1.2 })),
};

/**
 * The dressing pass (docs/levels/dressing-pass.md, src/levels/dressing.js).
 * Set pieces you cannot paint, never on the arena floor and never colliding.
 * Keep-outs are tested (tests/dressing.test.js): off every strip and route
 * point, out of every room eye's view of the beacon and the intro camera's path.
 *
 *   walls    ribs every 6 m from 3 m over the floor at their foot, and a cornice
 *            on every wall top — computed from the walls above, so they follow
 *   pipes    a second high run and a cable tray along the hangar's and the
 *            Core's long walls, 9-12 m
 *   trusses  the hangar's roof frame at 12 m: structure, no lid (open decision 2),
 *            so the sky stays. Full spans only at z 64+, where the intro camera
 *            has dropped below them; further north they stop 9 m short of the
 *            axis, which is where the beacon lines and the intro run
 *   skyline  the facility outside: dark blocks and two stacks past the Core,
 *            sunk below the floor so they rise out of the dark. Lower than the
 *            Siphon's mast (27 m), which stays the tallest thing
 */
const lamps = props.filter((p) => p.kind === 'light').map((p) => p.box);
const near = (a, b, m) => a[0] - m < b[1] && a[1] + m > b[0] && a[2] - m < b[3] && a[3] + m > b[2] && a[4] - m < b[5] && a[5] + m > b[4];

/** One roof truss across the hangar at `z`, from x `x0` to `x1`: chords, posts every 4 m, diagonals between. */
function truss(z, x0, x1) {
  const [lo, hi] = [12.3, 14.2];   // bottom chord sits on the cornice; 1.9 m deep
  const out = [
    { kind: 'truss', room: 'R1', box: [x0, x1, lo, lo + 0.3, z - 0.15, z + 0.15] },
    { kind: 'truss', room: 'R1', box: [x0, x1, hi - 0.3, hi, z - 0.15, z + 0.15] },
  ];
  const bays = Math.round((x1 - x0) / 4);
  const step = (x1 - x0) / bays;
  const rise = hi - lo - 0.6;
  const slant = Math.atan2(rise, step);
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * step;
    out.push({ kind: 'truss', room: 'R1', box: [x - 0.1, x + 0.1, lo + 0.3, hi - 0.3, z - 0.1, z + 0.1] });
    if (i === bays) continue;
    const len = Math.hypot(rise, step);
    const cx = x + step / 2;
    out.push({ kind: 'truss', room: 'R1', box: [cx - len / 2, cx + len / 2, (lo + hi) / 2 - 0.08, (lo + hi) / 2 + 0.08, z - 0.08, z + 0.08], tilt: [0, 0, i % 2 ? slant : -slant] });
  }
  return out;
}

/**
 * Story clusters: one per room, each a landmark you can name. Out of reach (the
 * line, the rack and the cage hang 3.5 m+ over the floor) or low (the crates).
 *   R0  a delivery of pill crates waiting at the lift, Corp-stencilled
 *   R1  a dead pill production line on the north wall, and the Corp's pill
 *       sign over the corridor door
 *   R2  a specimen rack over the corridor: failed test subjects in glass. The
 *       last tube is empty and its glass is gone
 *   R3  a gantry along the north wall-top between the vats, striped
 *   R4  Big Arm's containment cage over its bay, the bars bent out
 *   R5  pipes from the Siphon's corners down into the floor
 */
const STRIPE = 0.6;   // rad: a hazard stripe's lean
const stripes = (x0, x1, y0, y1, z0, z1, step) => Array.from({ length: Math.floor((x1 - x0) / step) }, (_, i) => {
  const x = x0 + (i + 0.5) * step;
  return { kind: 'stencil', box: [x - step / 5, x + step / 5, y0, y1, z0, z1], tilt: [0, 0, STRIPE] };
});
const pillCrates = [
  // [x, y, z]: the corner of each 1.2 x 0.6 x 1.2 crate. Two layers: 1.2 m, the floor rule.
  [3.4, 3, 88.6], [4.6, 3, 88.6], [3.4, 3, 87.4], [4.6, 3, 87.4], [3.4, 3.6, 88.6], [4.6, 3.6, 88.6], [4.0, 3.6, 87.4],
  [-5.8, 3, 80.4], [-5.8, 3, 81.6], [-5.8, 3.6, 81.0],
];
const R1_LINE = { x: [-23, -9], z: 40, bed: 5.4 };
const RACK_TUBES = [28.3, 29.7, 31.1, 32.5, 33.9];
const CAGE_BARS = [-3.6, -2.8, -2.0, -1.2, 1.2, 2.0, 2.8, 3.6];
const SIPHON_CORNERS = [[-5, -41], [5, -41], [-5, -31], [5, -31]];
const clusters = [
  // --- R0: the delivery ------------------------------------------------------
  ...pillCrates.flatMap(([x, y, z]) => [
    { kind: 'crate', room: 'R0', box: [x, x + 1.2, y, y + 0.6, z, z + 1.2] },
    { kind: 'sign', room: 'R0', box: [x + 0.3, x + 0.9, y + 0.2, y + 0.4, z - 0.03, z + 0.02] },
  ]),
  // --- R1: the production line, on wall brackets (no legs: the floor is the arena) --
  { kind: 'machine', room: 'R1', box: [R1_LINE.x[0], R1_LINE.x[1], R1_LINE.bed, R1_LINE.bed + 0.4, 40.1, 41.5] },
  { kind: 'belt', room: 'R1', box: [R1_LINE.x[0], R1_LINE.x[1], R1_LINE.bed + 0.4, R1_LINE.bed + 0.5, 40.2, 41.4] },
  ...R1_LINE.x.map((x) => ({ kind: 'drum', room: 'R1', box: [x - 0.3, x + 0.3, R1_LINE.bed, R1_LINE.bed + 0.5, 40.1, 41.5] })),
  ...[-22, -19, -16, -13, -10].flatMap((x) => [
    { kind: 'machine', room: 'R1', box: [x - 0.1, x + 0.1, R1_LINE.bed - 0.2, R1_LINE.bed, 40, 41.5] },
    { kind: 'machine', room: 'R1', box: [x - 0.08, x + 0.08, R1_LINE.bed - 1.1, R1_LINE.bed - 0.9, 39.85, 41.6], tilt: [-0.7, 0, 0] },
  ]),
  // Two hoppers over the belt, each on a neck.
  ...[-20, -15.5].flatMap((x) => [
    { kind: 'machine', room: 'R1', box: [x - 1, x + 1, 7, 8.8, 40.1, 41.7] },
    { kind: 'drum', room: 'R1', box: [x - 0.35, x + 0.35, R1_LINE.bed + 0.6, 7, 40.55, 41.25] },
  ]),
  // The capping machine at the end, three capping heads under its hood.
  { kind: 'machine', room: 'R1', box: [-12.6, -9.4, 7, 8.2, 40.1, 41.9] },
  { kind: 'panel', room: 'R1', box: [-12.6, -9.4, R1_LINE.bed + 0.5, 7, 40.1, 40.4] },
  ...[-12, -11, -10].map((x) => ({ kind: 'drum', room: 'R1', box: [x - 0.2, x + 0.2, R1_LINE.bed + 0.9, 7, 40.75, 41.15] })),
  // Pills left on the belt when it stopped: grey, like everything it made.
  ...[-22.2, -21.3, -18.4, -17.5, -14.2, -13.4].flatMap((x, i) => [
    { kind: 'pill', room: 'R1', box: [x, x + 0.42, R1_LINE.bed + 0.5, R1_LINE.bed + 0.68, 40.5 + (i % 2) * 0.4, 40.68 + (i % 2) * 0.4] },
  ]),
  // The Corp's sign over the corridor door: a lintel, a panel, the pill, stripes.
  { kind: 'machine', room: 'R1', box: [-6, 6, 10, 11, 38.5, 40] },
  { kind: 'panel', room: 'R1', box: [-2.6, 2.6, 10.1, 10.9, 40, 40.08] },
  { kind: 'sign', room: 'R1', box: [-1.1, 1.1, 10.3, 10.7, 40.06, 40.16] },
  ...stripes(-5.8, -2.8, 10.15, 10.85, 40, 40.06, 0.6),
  ...stripes(2.8, 5.8, 10.15, 10.85, 40, 40.06, 0.6),

  // --- R2: the specimen rack ---------------------------------------------------
  { kind: 'panel', room: 'R2', box: [-6, -5.9, 3.4, 7.8, 28, 35.2] },
  { kind: 'machine', room: 'R2', box: [-6, -4.9, 7.2, 7.8, 28, 35.2] },
  { kind: 'machine', room: 'R2', box: [-6, -4.9, 3.4, 4.0, 28, 35.2] },
  ...RACK_TUBES.slice(0, -1).flatMap((z, i) => [
    { kind: 'glass', room: 'R2', box: [-5.85, -4.95, 4.0, 7.2, z, z + 0.9] },
    { kind: 'specimen', room: 'R2', box: [-5.6, -5.2, 4.2, 5.9 + (i % 2) * 0.3, z + 0.25, z + 0.65] },
    { kind: 'specimen', room: 'R2', box: [-5.55, -5.25, 5.9 + (i % 2) * 0.3, 6.25 + (i % 2) * 0.3, z + 0.3, z + 0.6] },
  ]),
  // The last tube: broken, empty. Something got out.
  { kind: 'glass', room: 'R2', box: [-5.85, -4.95, 4.0, 4.6, RACK_TUBES.at(-1), RACK_TUBES.at(-1) + 0.9] },

  // --- R3: the gantry between the vats, on the north wall-top -----------------
  { kind: 'deck', room: 'R3', box: [-25, 25, 14.35, 14.55, -64.8, -61.6] },
  ...[-61.7, -64.7].map((z) => ({ kind: 'rail', room: 'R3', box: [-25, 25, 15.35, 15.45, z - 0.05, z + 0.05] })),
  ...Array.from({ length: 17 }, (_, i) => -24 + i * 3).flatMap((x) => [-61.7, -64.7].map((z) => (
    { kind: 'rail', room: 'R3', box: [x - 0.05, x + 0.05, 14.55, 15.4, z - 0.05, z + 0.05] }))),
  { kind: 'panel', room: 'R3', box: [-25, 25, 14.05, 14.35, -61.65, -61.55] },
  ...stripes(-25, 25, 14.07, 14.33, -61.56, -61.5, 1.2),

  // --- R4: Big Arm's cage, on the north bay's back wall ------------------------
  { kind: 'machine', room: 'R4', box: [-4.2, 4.2, 12.4, 13, -74, -72.2] },
  { kind: 'machine', room: 'R4', box: [-4.2, 4.2, 7, 7.6, -74, -72.2] },
  ...CAGE_BARS.map((x) => ({ kind: 'bar', room: 'R4', box: [x - 0.07, x + 0.07, 7.6, 12.4, -72.47, -72.33] })),
  // The two middle bars, bent out from the bottom; the two between, gone.
  ...[-0.4, 0.4].map((x) => ({ kind: 'bar', room: 'R4', box: [x - 0.07, x + 0.07, 8, 12.8, -71.6, -71.46], tilt: [-0.45, 0, x * 0.6] })),

  // --- R5: the Siphon's pipes, down its corners into the floor -----------------
  ...SIPHON_CORNERS.flatMap(([x, z]) => [
    { kind: 'pipe', room: 'R5', mount: 'siphon', box: [x - 0.4, x + 0.4, 0, 18, z - 0.4, z + 0.4] },
    // ...and its elbow out into the floor drain, under the 1.2 m rule.
    { kind: 'pipe', room: 'R5', box: [...[x + Math.sign(x) * 0.4, x + Math.sign(x) * 1.4].sort((a, b) => a - b), 0, 0.6, z - 0.3, z + 0.3] },
  ]),
];

const dressing = {
  // Ribs stay off the lamps and out from behind the clusters.
  walls: {
    skip: (box) => lamps.some((l) => near(box, l, 0.5))
      || clusters.some((c) => c.kind !== 'pipe' && near(box, c.box, 0.1)),
  },
  items: [
    ...clusters,
    // --- Wall breakup: high pipe runs and cable trays -----------------------
    ...[-1, 1].flatMap((s) => [
      { kind: 'pipe', room: 'R1', box: [s * 23.65 - 0.25, s * 23.65 + 0.25, 10.9, 11.4, 40, 78] },
      { kind: 'tray', room: 'R1', box: s < 0 ? [-24, -23.2, 10.2, 10.35, 40, 78] : [23.2, 24, 10.2, 10.35, 40, 78] },
      { kind: 'pipe', room: 'R3', box: [s * 25.6 - 0.25, s * 25.6 + 0.25, 9.2, 9.7, -64, -42] },
      { kind: 'pipe', room: 'R3', box: [s * 25.6 - 0.25, s * 25.6 + 0.25, 9.2, 9.7, -30, -10] },
      { kind: 'tray', room: 'R3', box: s < 0 ? [-26, -25.2, 8.4, 8.55, -64, -42] : [25.2, 26, 8.4, 8.55, -64, -42] },
      { kind: 'tray', room: 'R3', box: s < 0 ? [-26, -25.2, 8.4, 8.55, -30, -10] : [25.2, 26, 8.4, 8.55, -30, -10] },
    ]),
    // --- The hangar's roof trusses -------------------------------------------
    ...[64, 70, 76].flatMap((z) => truss(z, -24, 24)),
    ...[46, 52, 58].flatMap((z) => [...truss(z, -24, -9), ...truss(z, 9, 24)]),
    // --- Skyline: the facility outside ---------------------------------------
    // North, close behind the Core so they clear its 14 m wall from the R3 eye;
    // off the axis, where the Siphon would hide them anyway.
    { kind: 'block', box: [-46, -16, -40, 24, -100, -78] },
    { kind: 'block', box: [16, 44, -40, 22, -96, -78] },
    { kind: 'block', box: [-12, 12, -40, 25, -134, -112] },
    // Plant rooms on the roofs, so the skyline is not one straight edge.
    { kind: 'block', box: [-40, -34, 24, 26, -90, -84] },
    { kind: 'block', box: [30, 36, 22, 25.5, -88, -82] },
    { kind: 'block', box: [-96, -62, -40, 18, -64, -30] },
    { kind: 'block', box: [62, 92, -40, 20, -76, -40] },
    { kind: 'block', box: [56, 84, -40, 15, 20, 64] },
    { kind: 'block', box: [-84, -56, -40, 17, 10, 52] },
    { kind: 'stack', box: [-31, -26, -40, 26.5, -92, -87] },
    { kind: 'stack', box: [24, 28.5, -40, 26, -106, -101.5] },
  ],
};

export const LAST_COLOUR = {
  id: 'last-colour', name: 'Last Colour', cells: PAINT_GRID.level3Cells, prepaint,
  solids, slabs: [], strips, kerbs: [], landmarks, gates, traps, props, targets, spill, enemies, routes, rooms, win, doc,
  curves, dressing,
};
