// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// Paint ids are ALSO the indices written into the paint data texture.
// 0 = grey (unpainted). Do not reorder without updating the shader.
export const PAINT_IDS = { grey: 0, blue: 1, red: 2, green: 3 };

// `grey` is not a paint colour, it is the ABSENCE of one: the colour of the
// world before the player paints it. It is read by the ground shader
// (uColours[0]) and by the HUD's ammo bar, so it is one value with one meaning.
export const PAINT = {
  grey: { id: 0, hex: 0x585e54, name: "Grey" },
  blue: { id: 1, hex: 0x3aa7ff, name: "Ice" },
  red: { id: 2, hex: 0xff4d5a, name: "Bounce" },
  green: { id: 3, hex: 0x4ee08a, name: "Grip" },
};

// Colour -> physics. This object IS the game.
//   friction    how fast ground speed bleeds away (per second)
//   traction    multiplier on PLAYER.accel while standing here (low = can't turn)
//   speedScale  how much extra speed this surface grants. You keep a BOOST after
//               you leave, and a lower value never takes a boost away (red's 1.0
//               means "no boost", not "back to base"). See #52.
//
//               EXCEPTION: grey is a LIVE modifier, not an accumulator. Being on
//               dead ground slows you now and stops the moment you step off it.
//   restitution > 0 makes the surface a trampoline (see PLAYER.minBounce)
//   climbable   walls of this colour can be climbed
//   standSlow   LIVE speed multiplier while standing on this surface. Not
//               sticky — drops the frame you leave. This is how grey penalises
//               you without being erased by the first blue patch you touch (#74).
export const SURFACE = {
  grey: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: false, standSlow: 0.6 },
  blue: { friction: 0.4, traction: 0.5, speedScale: 1.6, restitution: 0.0, climbable: false, standSlow: 1.0 }, // ice
  red: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.9, climbable: false, standSlow: 1.0 }, // bounce
  green: { friction: 14.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: true, standSlow: 1.0 }, // grip + climb
};

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  accel: 55,
  airAccel: 12,
  maxSpeed: 7,
  jumpSpeed: 8.5,
  gravity: -26,
  climbSpeed: 4.5,
  climbPushThreshold: 0.25,
  wallJumpPush: 3.5,
  eyeHeight: 1.5,
  minBounce: 15,
  lookSensitivity: 0.0022,
  killY: -20,
  adsSensitivityMultiplier: 0.6,
  adsSpeedMultiplier: 0.5,

  // jump feel (#33)
  coyoteTime: 0.1,
  jumpBufferTime: 0.12,

  // collision tolerances
  groundProbeLift: 0.5,
  groundProbeRange: 6,
  groundSnap: 0.02,
  bounceClearance: 0.05,
};

// Camera rig (#34). TPV is the default; FPV is the V toggle / ADS target.
export const CAMERA = {
  tpvDistance: 5.0,
  tpvShoulder: 0.9,
  tpvHeight: 0.45,

  pitchMin: -0.42,         // ~-24 deg down
  pitchMax: 0.55,          // ~+31 deg up
  minHeightAboveFeet: 1.1, // camera never dips below player.position.y + this

  adsFov: 45,
  normalFov: 70,
  adsTransitionSpeed: 10,
};

export const HEALTH = {
  max: 100,
  hurtCooldown: 0.8,
  contactRange: 1.0,
  contactHeight: 1.7,
};

export const TRAP = {
  amber: 0xd98a2b,
  bed: 0x1c1a17,
  spike: {
    damage: 15,
    cooldown: 1.0,
  },
};

export const PAINT_GUN = {
  range: 30,
  radius: 1.4,
  cost: 4,
  fireDelay: 0.14,
  hipSpread: 0.025,
  adsSpread: 0.005,
  refillRate: 8,
};

// Dry out (#75). The player is dry when the tank is empty and no cell under
// them is theirs. This declares the loss rather than leaving them stuck.
export const DRY_OUT = {
  warningBelow: 0.25,   // tank % under which the HUD pulses the ammo bar
  graceTime: 1.0,       // seconds of continuous dry state before the run ends
};

export const AUDIO = {
  volume: 0.6,
};

export const OPTIONS = {
  sensitivityMin: 0.25,
  sensitivityMax: 3,
};

export const PAINT_GRID = {
  level1Cells: 4,
};

export const ENEMY_NAV = {
  maxStepDown: 1.0,
};

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: 100,
  2: 60,
  3: 80,
};

export const ENEMY = {
  sprayer: {
    hp: 40, speed: 2.5, canShoot: true, canMove: true, climbsGreen: false,
    drainsPaint: false, contactDamage: 10,
    windup: 0.6, attackRange: 12, attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
  charger: {
    hp: 30, speed: 5.0, canShoot: false, canMove: true, climbsGreen: false,
    drainsPaint: false, contactDamage: 25,
    windup: 0.5, attackCooldown: 3,
    stopDistance: HEALTH.contactRange + 0.2,
  },
  wallCrawler: {
    hp: 45, speed: 3.0, canShoot: true, canMove: true, climbsGreen: true,
    drainsPaint: false, contactDamage: 10,
    windup: 0.6, attackRange: 12, attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
  turret: {
    hp: 70, speed: 0, canShoot: true, canMove: false, climbsGreen: false,
    drainsPaint: false, contactDamage: 0,
    windup: 0.8, attackRange: 15, attackCooldown: 3,
  },
  drainer: {
    hp: 20, speed: 4.0, canShoot: false, canMove: true, climbsGreen: false,
    drainsPaint: true, contactDamage: 5,
    windup: 0.5, attackRange: 3, attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
};

export const DEFENCE = {
  1: { requiredColour: null, combo: [] },
  2: { requiredColour: "red", combo: [] },
  3: { requiredColour: null, combo: ["blue", "red"] },
};