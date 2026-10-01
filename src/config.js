// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// Paint ids are ALSO the indices written into the paint data texture.
// 0 = grey (unpainted). Do not reorder without updating the shader.
export const PAINT_IDS = { grey: 0, blue: 1, red: 2, green: 3 };

export const PAINT = {
  grey: { id: 0, hex: 0x5a5a66, name: "Dead" },
  blue: { id: 1, hex: 0x3aa7ff, name: "Ice" },
  red: { id: 2, hex: 0xff4d5a, name: "Bounce" },
  green: { id: 3, hex: 0x4ee08a, name: "Grip" },
};

// Colour -> physics. This object IS the game.
//   friction    how fast ground speed bleeds away (per second)
//   traction    multiplier on PLAYER.accel while standing here (low = can't turn)
//   speedScale  multiplier on PLAYER.maxSpeed while standing here
//   restitution > 0 makes the surface a trampoline (see PLAYER.minBounce)
//   climbable   walls of this colour can be climbed
export const SURFACE = {
  grey: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: false },
  blue: { friction: 0.4, traction: 0.5, speedScale: 1.6, restitution: 0.0, climbable: false }, // ice: slide, hard to steer
  red: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.9, climbable: false }, // bounce
  green: { friction: 14.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: true }, // grip + climb
};

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  accel: 55, // ground acceleration
  airAccel: 12,
  maxSpeed: 7,
  jumpSpeed: 8.5,
  gravity: -26,
  climbSpeed: 4.5,
  climbPushThreshold: 0.25, // how directly you must push into a green wall to climb (0..1)
  wallJumpPush: 3.5, // jumping off a climb pushes you this fast away from the wall
  eyeHeight: 1.5,
  minBounce: 15, // red is a trampoline: standing on it launches you (~4.3m)
  lookSensitivity: 0.0022,
  killY: -20, // fall below this and you respawn

  // collision tolerances
  groundProbeLift: 0.5, // ground probe starts this far above the feet
  groundProbeRange: 6, // how far below that it looks for a floor
  groundSnap: 0.02, // within this of the floor counts as landed
  bounceClearance: 0.05, // lift off red by this so the bounce does not re-hit
};

// Player health. Enemies deal their ENEMY.*.contactDamage on touch.
export const HEALTH = {
  max: 100,
  hurtCooldown: 0.8,  // seconds of invulnerability after a hit, so contact is not 60 hits/sec
  contactRange: 1.0,  // enemy centre within this (horizontal) distance of the player = touching
  contactHeight: 1.7, // ...and within this vertical distance
};

export const PAINT_GUN = {
  range: 30,
  radius: 1.4, // splat radius in world units
  cost: 4, // ammo per shot
  fireDelay: 0.14, // seconds
};

export const PAINT_GRID = {
  level1Cells: 4,
};

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: { tank: 100 },
  2: { tank: 60 },
  3: { tank: 80 },
};

// One enemy class, five configs. Not five systems. (Week 2.)
export const ENEMY = {
  sprayer: {
    hp: 40,
    speed: 2.5,
    canShoot: true,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 10,
  },
  charger: {
    hp: 30,
    speed: 5.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 25,
  },
  wallCrawler: {
    hp: 45,
    speed: 3.0,
    canShoot: true,
    canMove: true,
    climbsGreen: true,
    drainsPaint: false,
    contactDamage: 10,
  },
  turret: {
    hp: 70,
    speed: 0,
    canShoot: true,
    canMove: false,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 0,
  },
  drainer: {
    hp: 20,
    speed: 4.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: true,
    contactDamage: 5,
  },
};

// Difficulty = new rules, not bigger health bars.
export const DEFENCE = {
  1: { requiredColour: null, combo: [] },
  2: { requiredColour: "red", combo: [] },
  3: { requiredColour: null, combo: ["blue", "red"] },
};
