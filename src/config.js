// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// Paint ids are ALSO the indices written into the paint data texture.
// 0 = grey (unpainted). Do not reorder without updating the shader.
export const PAINT_IDS = { grey: 0, blue: 1, red: 2, green: 3 };

export const PAINT = {
  grey:  { id: 0, hex: 0x5a5a66, name: 'Dead'   },
  blue:  { id: 1, hex: 0x3aa7ff, name: 'Ice'    },
  red:   { id: 2, hex: 0xff4d5a, name: 'Bounce' },
  green: { id: 3, hex: 0x4ee08a, name: 'Grip'   },
};

// Colour -> physics. This object IS the game.
export const SURFACE = {
  grey:  { friction: 10.0, restitution: 0.0, climbable: false },
  blue:  { friction: 0.4,  restitution: 0.0, climbable: false }, // ice: barely slows you
  red:   { friction: 10.0, restitution: 0.85, climbable: false }, // bounce
  green: { friction: 14.0, restitution: 0.0, climbable: true  }, // grip + climb
};

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  accel: 55,          // ground acceleration
  airAccel: 12,
  maxSpeed: 7,
  jumpSpeed: 8.5,
  gravity: -26,
  climbSpeed: 4.5,
  eyeHeight: 1.5,
};

export const PAINT_GUN = {
  range: 30,
  radius: 1.4,        // splat radius in world units
  cost: 4,            // ammo per shot
  fireDelay: 0.14,    // seconds
};

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: { tank: 100, refillRate: 14 },
  2: { tank: 60,  refillRate: 2  },
  3: { tank: 80,  refillRate: 6  },
};

// One enemy class, five configs. Not five systems. (Week 2.)
export const ENEMY = {
  sprayer:     { hp: 40, speed: 2.5, canShoot: true,  canMove: true,  climbsGreen: false, drainsPaint: false },
  charger:     { hp: 30, speed: 5.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: false },
  wallCrawler: { hp: 45, speed: 3.0, canShoot: true,  canMove: true,  climbsGreen: true,  drainsPaint: false },
  turret:      { hp: 70, speed: 0,   canShoot: true,  canMove: false, climbsGreen: false, drainsPaint: false },
  drainer:     { hp: 20, speed: 4.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: true  },
};

// Difficulty = new rules, not bigger health bars.
export const DEFENCE = {
  1: { requiredColour: null,  combo: [] },
  2: { requiredColour: 'red', combo: [] },
  3: { requiredColour: null,  combo: ['blue', 'red'] },
};
