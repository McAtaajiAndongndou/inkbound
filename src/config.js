// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// Paint ids are ALSO the indices written into the paint data texture.
// 0 = grey (unpainted). Do not reorder without updating the shader.
export const PAINT_IDS = { grey: 0, blue: 1, red: 2, green: 3 };

// `grey` is not a paint colour, it is the ABSENCE of one: the colour of the
// world before the player paints it. It is read by the ground shader
// (uColours[0]) and by the HUD's ammo bar, so it is one value with one meaning.
//
// It used to be 0x5a5a66 -- a blue-violet grey -- which was fine in isolation
// and wrong the moment the level had a forest in it: the drained decor is a
// grey-GREEN (DECOR.tint, 0x4f5a4d), so the floor read as a different world
// from the things standing on it. The plan flagged this in step 1 ("that is
// blue-grey, not forest grey") and it sat unaddressed because the instanced
// props were not rendering, so there was nothing for the floor to disagree with.
//
// 0x585e54 is the same drained family as the foliage, a little LIGHTER, so a
// rock slab (which uses the decor tint) still separates from the floor it lies
// on rather than disappearing into it.
export const PAINT = {
  grey: { id: 0, hex: 0x585e54, name: "Dead" },
  blue: { id: 1, hex: 0x3aa7ff, name: "Ice" },
  red: { id: 2, hex: 0xff4d5a, name: "Bounce" },
  green: { id: 3, hex: 0x4ee08a, name: "Grip" },
};

// Colour -> physics. This object IS the game.
//   friction    how fast ground speed bleeds away (per second)
//   traction    multiplier on PLAYER.accel while standing here (low = can't turn)
//   speedScale  how much extra speed this surface grants. You keep it after
//               you leave, and a lower one never takes it away (red's 1.0
//               means "no boost", not "back to base"). See #52.
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
  adsSensitivityMultiplier: 0.6,
  adsSpeedMultiplier: 0.5,

  // jump feel (#33)
  coyoteTime: 0.1,        // seconds after leaving a ledge you can still jump (~6 frames at 60fps)
  jumpBufferTime: 0.12,   // seconds before landing a jump press is remembered

  // collision tolerances
  groundProbeLift: 0.5, // ground probe starts this far above the feet
  groundProbeRange: 6, // how far below that it looks for a floor
  groundSnap: 0.02, // within this of the floor counts as landed
  bounceClearance: 0.05, // lift off red by this so the bounce does not re-hit
};

// Camera rig (#34). TPV is the default; FPV is the V toggle / ADS target.
export const CAMERA = {
  tpvDistance: 5.0,        // how far behind the player the third-person camera sits
  tpvShoulder: 0.9,        // right-vector offset, so the player does not block the view
  tpvHeight: 0.45,         // vertical offset above the player's chest

  // Tightened for #39 #8 — Renda: "I look at the sky or floor too easily".
  //
  // HOW THE RIG USES PITCH, because it is not the usual sign convention and it is
  // why the old range felt wrong: the camera's own height is
  // `(sin(pitch) + tpvHeight) * tpvDistance`, and the aim point is
  // `eyeHeight + tan(pitch) * 12`. So NEGATIVE pitch (looking down) puts the camera
  // BELOW the player while the aim point dives at the floor.
  //
  //   old max  1.20 rad = +69 deg up    -> the camera is flung 6.9 m overhead
  //                                        aiming nearly straight up
  //   old min -0.60 rad = -34 deg down  -> the camera is at foot level (the
  //                                        minHeightAboveFeet clamp below caught
  //                                        it) aiming steeply into the ground
  //
  // Both extremes degenerated, and 69 degrees up is far more sky than a
  // third-person shooter needs. The new range is a shooter's: roughly 24 degrees
  // down and 31 degrees up, which keeps the camera behind and above the player at
  // every angle instead of throwing it over the top or dropping it to the floor.
  pitchMin: -0.42,         // how far down the camera can look (radians, ~-24 deg)
  pitchMax: 0.55,          // how far up (radians, ~+31 deg)

  // Raised from 0.3 for the same reason, and this one is the bigger half of the
  // fix: 0.3 above the feet is a floor-skimming camera, and it is where a
  // look-down shot always ended up because the offset above goes negative long
  // before pitchMin does. 1.1 only ever engages on those extremes — at neutral
  // pitch the camera sits 2.25 m up — so it changes the down-look and nothing else.
  minHeightAboveFeet: 1.1, // camera never dips below player.position.y + this

  adsFov: 45,
  normalFov: 70,
  adsTransitionSpeed: 10,
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
  hipSpread: 0.025,
  adsSpread: 0.005,
};

// Starting master volume (0..1). The options menu overrides it per player.
export const AUDIO = {
  volume: 0.6,
};

// Options-menu ranges. Sensitivity is a multiplier on PLAYER.lookSensitivity.
export const OPTIONS = {
  sensitivityMin: 0.25,
  sensitivityMax: 3,
};

export const PAINT_GRID = {
  level1Cells: 4,
};

/**
 * Enemy movement rules that are not about one enemy type.
 *
 * `maxStepDown` — how far an enemy will step DOWN without refusing the move.
 *
 * The probe already refuses a step with NO floor under it, which is what keeps an
 * enemy on its island. It does not refuse a step onto a floor that happens to be
 * much lower, and that is a real hole: an enemy standing on a raised platform walks
 * straight off the edge and drops to whatever is below. Renda, on the two shooters
 * on island C's pillar: "yeah the shooters do walk off".
 *
 * One metre allows a kerb and refuses a storey, which is the distinction that
 * matters — and knockback still bypasses the probe entirely, so a red hit can still
 * fling an enemy off a ledge. That is deliberate (the environmental kill the design
 * asks for) and it is why this is a rule on WALKING rather than a leash.
 */
export const ENEMY_NAV = {
  maxStepDown: 1.0,
};

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: { tank: 100 },
  2: { tank: 60 },
  3: { tank: 80 },
};

// One enemy class, five configs. Not five systems. (Week 2.)
//
// windup / attackRange / attackCooldown drive the attack telegraph (#40).
//
// attackRange is for enemies that ATTACK FROM RANGE. `_updateAttack` starts a
// windup as soon as the player is inside it, and `startTelegraph` PLANTS the
// enemy while it winds up — which is right for a shooter and fatal for a
// charger. See the note on `charger` below.
export const ENEMY = {
  sprayer: {
    hp: 40,
    speed: 2.5,
    canShoot: true,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 10,
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },

  // NO attackRange, deliberately — and this is the one stat here that is not a
  // taste call.
  //
  // The Charger's attack IS its charge: `canShoot` is false, it deals
  // `contactDamage` on touch, and DESIGN.md's teaching beat for island B is
  // "paint blue and it slides straight past you". Giving it an attackRange of 8
  // meant it began winding up the moment the player got within 8m, and a windup
  // PLANTS the enemy (`this._vel.set(0, 0, 0)` in startTelegraph) — so it stood
  // still at range and never charged at all. Island B's Charger fight, the
  // level's main teaching beat, silently stopped happening.
  //
  // That was caught by `tests/level-contract.test.js` -> "on blue a Charger
  // commits to its heading and slides past a sidestep", which was failing on
  // main. The test drives the Charger for 30 frames and then reads its heading;
  // with the plant it never had one, so the heading was the zero vector.
  //
  // The Charger still telegraphed in spirit: a fast grey soldier in a committed
  // straight line is its own tell. If #40 wants a windup on it, the windup must
  // not stop the charge — a plant that discards momentum is the wrong primitive
  // for a chaser. windup/attackCooldown are left in place for that.
  charger: {
    hp: 30,
    speed: 5.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 25,
    windup: 0.5,
    attackCooldown: 3,
    // Melee: walk up and STOP at contact range rather than continuing through the
    // player and turning round. See the `holding` note in _tick (#39).
    stopDistance: HEALTH.contactRange + 0.2,
  },
  wallCrawler: {
    hp: 45,
    speed: 3.0,
    canShoot: true,
    canMove: true,
    climbsGreen: true,
    drainsPaint: false,
    contactDamage: 10,
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
  turret: {
    hp: 70,
    speed: 0,
    canShoot: true,
    canMove: false,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 0,
    windup: 0.8,
    attackRange: 15,
    attackCooldown: 3,
    // #77 — THE MATRIX GAP (ENEMIES.md). The turret is the one enemy that paint
    // does not solve: freeze, pin and knockback do nothing to it and the three
    // colours are just damage. The answer is line of sight and flanking, and
    // that only holds if the procs GENUINELY do nothing — a turret you can
    // freeze is just another enemy with a slower answer.
    //
    // `canMove: false` alone was not enough. Red's knockback is applied in the
    // windup branch too, so a red hit shoved a turret sideways mid-telegraph;
    // the flag is what makes the promise unconditional.
    noProcs: true,
  },
  drainer: {
    hp: 20,
    speed: 4.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: true,
    contactDamage: 5,
    windup: 0.5,
    attackRange: 3,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
};
// Difficulty = new rules, not bigger health bars.
export const DEFENCE = {
  1: { requiredColour: null, combo: [] },
  2: { requiredColour: "red", combo: [] },
  3: { requiredColour: null, combo: ["blue", "red"] },
};