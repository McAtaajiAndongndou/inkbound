// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// #194 — wet paint. The paint map doubles as a HEIGHT map: its painted mask,
// filtered smooth, is a blob's thickness; the gradient of that thickness bends
// the normal, and the bent normal drives a Blinn-Phong gloss and a Fresnel
// reflection of the level's sky. Painted cells only: Corp grey stays matte.
export const PAINT_WET = {
  bumpStrength: 0.9,     // how hard a blob's rim tilts the normal (height units per texel)
  noiseScale: 0.18,      // amplitude of the value noise on a blob's top, so it is not flat
  noiseFreq: 0.7,        // noise cells per paint cell
  shininess: 48,         // Blinn-Phong exponent: tight, wet highlights
  specular: 0.4,         // highlight strength on fully painted ground (0.55 washed red to pink at the mirror angle)
  fresnelPower: 5,       // Schlick's exponent: 5 is the textbook value
  fresnelBase: 0.04,     // F0, reflectance head-on (water ≈ 0.02, plastic 0.04)
  reflectStrength: 0.35, // CAP on how much sky replaces paint colour (readability rule)
  envSize: 64,           // px per face of the sky probe's cube map
  envNear: 0.5,          // the probe camera's clip planes, metres
  envFar: 1000,
  envHeight: 2,          // m above the origin the probe looks out from (the dome is centred there)
};

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
//   standSlow   LIVE speed multiplier, applied only while standing on this
//               surface. Unlike speedScale this is not sticky: it applies this
//               frame and drops the moment you leave. This is how grey penalises
//               you without being erased by the first blue patch you touch (#74).
//               1.0 = no penalty.
//   restitution > 0 makes the surface a trampoline (see PLAYER.minBounce)
//   climbable   walls of this colour can be climbed
export const SURFACE = {
  grey: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: false, standSlow: 0.6 }, // Corrupt Corp's territory — live penalty (#74)
  blue: { friction: 0.4, traction: 0.5, speedScale: 1.6, restitution: 0.0, climbable: false, standSlow: 1.0 }, // ice: slide, hard to steer
  red: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.9, climbable: false, standSlow: 1.0 }, // bounce
  green: { friction: 14.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: true, standSlow: 1.0 }, // grip + climb
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

// Avatar animation state machine (#82).
//
// The blends are deliberately short. The pose has to swap on the FRAME the
// physics does, or the avatar spends the first tenth of a jump still running —
// which is the bug this exists to fix, reintroduced as a fade. 0.1 s is the
// ceiling the issue sets; the air blend goes under it because falling has no
// anticipation to it.
export const ANIM = {
  blend: 0.1,     // ground transitions: idle <-> run
  airBlend: 0.08, // into and out of jump / fall / land
  riseSpeed: 0.1, // m/s of upward velocity that counts as RISING, not falling
  climbBlend: 0.12,
  climbCycle: 0.9,
  landMinTime: 0.18,

  // #124 — the combat poses. Three fades, each for a different job:
  //   aimBlend  raising and lowering the gun. Slower than a step so the body does
  //             not snap, fast enough that the pose still tracks the button.
  //   fireBlend short on purpose: a shot that faded in over 0.1 s would read as a
  //             pose change rather than as a reaction to the trigger.
  //   hitBlend  a flinch arrives faster than it leaves, which is the reason only
  //             the way IN is here — the way out reuses `blend`.
  aimBlend: 0.12,
  fireBlend: 0.04,
  hitBlend: 0.06,

  // #124 — the viewmodel bob. The first-person gun sways sideways as the player
  // walks; the numbers are deliberately small, because a viewmodel that swings
  // reads as the camera being loose rather than as the player having weight.
  viewBob: 0.012,       // metres at full stride
  viewBobSpeed: 9,      // radians of sway per second
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
  // #186 — enemies are solid, so a big body holds you at PLAYER.radius + its
  // bodyRadius. The touch range per enemy is max(contactRange, that + this), so
  // pressing against Big Arm (1.0 m apart) is not decided by float error.
  contactSlack: 0.2,
};

// An enemy's body (#186, #187): a vertical cylinder. Solid to the player (the
// player is pushed out, the enemy is not moved) and to other enemies. `chest`
// is the height an enemy's wall test is made at. A config may override the
// radius with `bodyRadius` (Big Arm). Was a local constant in enemy.js.
export const ENEMY_BODY = { radius: 0.4, chest: 0.9 };

// Enemies push each other apart (#187), once a frame after they have all moved,
// so a wave reads as a crowd you can count rather than one stacked silhouette.
// Horizontal circles of each body's radius; each takes half the overlap unless
// the other is immovable (frozen, pinned, sleeping, Big Arm).
export const ENEMY_SEPARATION = {
  heightTolerance: 1.2,   // m; pairs further apart vertically don't touch
};

// #126 — ONE danger colour for the whole game (DECISIONS.md): attack
// telegraphs, trap warnings, incoming fire. Amber is chosen precisely because
// it is not a paint colour, so nothing the player can paint is ever a warning
// and nothing dangerous ever shares a colour with something helpful.
export const DANGER = {
  amber: 0xffe600,
};

// #196 — frost shell refraction (src/shaders/frost/). FrostPass renders the
// scene without the shells at `sceneScale` of the screen while any shell is on
// screen; the shell samples it offset by its own normal.
export const FROST = {
  refractStrength: 0.05, // screen-UV offset per unit of view-space normal, head-on
  crackKink: 0.012,      // extra offset on a crack facet, so the facets break the image
  sceneScale: 0.33,      // the scene copy's size as a fraction of the screen. 0.5 measured +2.1 ms in Last Colour, so the issue's fallback
  tint: 0.25,            // how much ice blue is mixed into what the shell shows
  fullCover: 0.55,       // uOpacity at which the shell fully takes over the view (BLUE_FREEZE.shellOpacity)
  glowUnder: 0.5,        // how much the rim glow is dimmed where the refraction shows
  bodyRadius: 0.9,       // m, an enemy's half-height: kept in the copy if this close behind ice on screen
};

// #195 — point lights the custom shaders can see (src/shaders/point-lights.js).
// A FIXED pool: the nearest `slots` sources to the camera are lit, the rest
// wait. The scene's light count never changes, so three.js never recompiles.
export const POINT_LIGHTS = {
  slots: 4,
  falloff: 2,             // (1 - (d/range)^2)^falloff: 1 at the source, 0 at range, smooth both ends
  defaultRange: 6,        // m, when a source names none
  decay: 1,               // the real THREE.PointLights' own decay, for built-in materials
  builtinIntensity: 1.5,  // candela per unit of source intensity on the real lights (6 blew the GLB bodies out to flat amber)
  flickerRate: 9,         // rad/s of a flickering source's wobble
  telegraphIntensity: 1.6, // an enemy's wind-up at the END of its tell (it swells up to this)
  telegraphRange: 5,      // m
};

// "Here", never "this hurts" (DECISIONS, the Ascent 30 Oct; polish audit P0-5):
// the cold-white Corp work light. Goal beacons, floodlights and an opened
// gate's light all wear it, so nothing that only marks a place borrows amber
// (danger) or a paint colour (a physics rule).
export const MARKER = {
  white: 0xe6eeff,
};

// The encounter gates' look, Outskirts' and the layout levels' alike (polish
// audit P0-5). The field was PAINT.red's family: the biggest red object in
// Outskirts, teaching "red is a wall" in a game where red is bounce. It is now
// the Corp's grey-violet: not a paint colour, and not amber either, because a
// field blocks you and never hurts you. Opening turns the lock bar white
// ("the way is here"), not paint green (which means climb).
export const GATE = {
  field: 0x8579a8,     // Corp grey-violet: hostile, artificial, none of the paint hues
  lock: 0x6d6290,      // the lock bar over a sealed door: the field's colour, darker, so it reads solid
  open: MARKER.white,  // the lock bar once the arena is clear
  concrete: 0x6b6f73,  // Outskirts' gate frames: the Corp's deader grey
  fieldOpacity: 0.42,
  fieldScroll: 0.55,   // texture drift per second, so a live barrier looks alive
  fieldFade: 1.8,      // opacity per second once the arena clears
  barSink: 1.5,        // m/s the lock bar sinks into its lintel once the field is gone
  barDrop: 1.2,        // m it sinks: buried in the lintel, out of the Ledge's look-back frame
  layoutOpacity: 0.35, // the layout levels' field, and the pulse round it while a breath counts down
  layoutPulse: 0.3,
};

// #156 — how a SEALED (unpaintable) face reads before anyone shoots it.
//
// A wall that refuses paint and a wall that takes it used to be drawn
// identically: the same grey grid, so the only way to find a climb was to shoot
// and see where the green stuck. The difference is TEXTURE, never colour
// (issue #156 design note, ADR-0002 "grey is Corrupt Corp's"): a sealed face
// keeps the same grey, but its grid is broken into panels with dark seams and
// a rivet at every seam corner. Nothing here introduces a hue, so nothing here
// can ever be mistaken for a paint colour or for the danger amber.
//
// All four numbers live in PANEL space, where one unit is one panel — a panel
// is `panelsPerSquare` to a visible grid square. Tune here.
export const SEALED = {
  panelsPerSquare: 2,   // panels across one visible grid square
  seamDepth: 0.22,      // fraction a seam line darkens the panel face
  seamWidth: 0.06,      // seam line half-width, panel space
  rivetRadius: 0.05,    // rivet dot radius, panel space
  rivetLift: 0.12,      // fraction a rivet brightens the panel face
};

// Traps: authored meshes plus ONE damage-volume helper (`docs/DECISIONS.md`,
// 2026-10-24). This block is not a trap table -- each level still owns the shape
// it hurts you with. It holds only the numbers a hazard would otherwise hardcode,
// and the colours that make a hazard legible.
export const TRAP = {
  // The trap warning IS the game-wide danger amber -- one value, defined once
  // in DANGER, not a second amber chosen per system.
  amber: DANGER.amber,
  bed: 0x1c1a17,       // the dark recess, so the spikes read against the floor

  // Polish audit (Traps): a trap you cannot hear does not exist for you. Every
  // trap sound is played at the trap and fades with distance
  // (src/levels/trap-sound.js): full inside `near`, silent past `far`.
  hearing: { near: 6, far: 28 },
  // Camera trauma (0..1) a heavy trap adds when it lands next to you, scaled by
  // the same distance fade. Handed to `game.shake` (core's camera rig).
  shake: { crusher: 0.35, catwalk: 0.25 },

  spike: {
    damage: 15,        // a hit, not a kill: seven of them at full health
    cooldown: 1.0,     // seconds between hits on the SAME target, not per frame
  },

  // The paint vent (Outskirts, island C): erupts on grey, goes dead on your paint.
  // One eruption is one hit: the cooldown only runs while the column stands, so
  // it equals `erupt`.
  vent: {
    damage: 20,
    cooldown: 1.0,
    rest: 2.0,         // seconds idle between eruptions
    tell: 0.8,         // seconds of amber pulse before it erupts — the tell
    erupt: 1.0,        // seconds the column stands and hurts
    height: 3.0,       // the column, and the hurting region above the grate
    coverage: 0.5,     // share of the grate that must be player paint to kill it
    // Polish audit: at rest a flat outline read as a landing pad. A raised rim,
    // slats and a grey wisp make it a machine between eruptions.
    rimHeight: 0.22,   // the grate's raised lip above the floor
    rimWidth: 0.28,
    slats: 5,          // bars across the opening, so it reads as a grate
    wisp: 0x9a9f9c,    // Corp-grey vapour leaking at rest: live, not amber
    wispOpacity: 0.3,
    wispRise: 0.7,     // m/s the idle wisp drifts up before it loops
    wispHeight: 1.6,   // how high a wisp climbs before it fades out
  },

  // The Primer's spike pit (R6, #101). It teaches "this place is dangerous"
  // without killing (issue #79): a hit never takes the last `spare` health.
  pit: {
    spare: 1,          // health a pit hit always leaves behind
    spikeHeight: 0.3,  // how far a spike pokes through the floor
    // How high above the floor the pit hurts (quality plan B3). It was the
    // layout box's full 1 m, so a jump (apex ~1.4 m) still clipped it on take-off
    // and landing. Only the spikes hurt: the tips, plus a little for the feet.
    hurtHeight: 0.4,
    spikeRows: 4,      // across the pit's depth (z), a spike every ~1 m
    sag: 0.07,         // radians the edge boards tilt toward the pit: the tell
    bedOpacity: 0.45,  // the dark recess; see-through so blue paint still reads
  },
};

// The spawn pad (polish audit; grey's 0.6 slow, #74, is settled and unchanged).
// Grey is the whole level at load, so every level's first minute was spent at
// 4.2 m/s and its first impression was "this game is slow". A square of the
// player's paint under the spawn makes the first steps fast, so stepping off it
// is felt as a loss. Green: it grips (blue would slide you off, red would bounce
// you), and you can submerge in it.
export const SPAWN_PAD = {
  colour: 'green',
  half: 2.5,           // metres from the spawn to the pad's edge: a 5 m square
};

// Outskirts' grey-world mood (polish pass 1). DRAINED, NOT DARK: a pale, bleached
// overcast with low contrast, so the grey reads as colour taken away rather than
// as a night scene. The level file explains what each band does.
// #197 — the dynamic sky (src/levels/mood.js). Each outdoor level's sky starts
// on its mood's `drained` palette and warms to its own colours as territory
// grows: k = smoothstep(from, to, coverage), where coverage is the HUD's number
// (the mean of surface.coverage() over every surface).
//
// from/to are NOT the issue's 0.05/0.5. Measured on the built levels, painting
// EVERY paintable floor reaches a coverage of only 0.31-0.37 (walls and sealed
// faces count too), so 0.5 could never be reached and the sky would never
// finish restoring. 0.02 starts the warm-up with the first island; 0.2 is most
// of a level's floor. See docs/DECISIONS.md, "Dynamic sky thresholds".
export const SKY = {
  from: 0.02,
  to: 0.2,
  rate: 2,              // 1/s: how fast the shown sky eases toward its target (~1 s to settle)
  scansPerSecond: 2,    // territory re-scans per second — never per frame
  finale: 2.5,          // s: the Siphon's destruction restores the sky within this
  refreshStep: 0.02,    // re-photograph the wet paint's sky (#194) when k moves this much
};

export const OUTSKIRTS = {
  // The goal you can see (campaign flow, 30 Oct): a mast and beacon just past
  // the back of the extraction ledge (y 12, z −45), the same landmark the
  // Ascent's lift tower and Last Colour's Siphon carry. Behind the ledge, so it
  // is never in the walk; it has no collider.
  beacon: { x: 0, z: -46.5, mastFrom: 0, top: 19.5, mastColour: 0x4a5058, colour: MARKER.white },
  // Polish audit (Enemies 5): island B is the Sprayer's first appearance, so it
  // wakes alone and B's two Chargers this many seconds later (a hit wakes one at once).
  sprayerFirst: 3,
  mood: {
    horizon: 0x9ba1a6,   // the haze; matches the sky's horizon band and the mist
    zenith:  0x4d5560,   // overhead: washed out, not navy
    void:    0x1a1c21,   // below the horizon: the pits stay dark
    // #197: where the sky starts — Corp grey, near PAINT.grey — before the
    // islands are painted. The colours above are the RESTORED sky.
    drained: { horizon: 0x6c706a, zenith: 0x3f433f, void: 0x191a18 },
    fogNear: 8,
    fogFar:  46,
    fillColour: 0xb4bcc2,
    fillIntensity: 0.55,
  },

  // The toxic waste. Muted from lime (0x86b32d) in polish pass 1: lime was the
  // most saturated colour in an unpainted frame and sat close to green paint
  // (PAINT.green), so the poison out-shouted the player's paint. A sickly olive
  // reads as poison, not as paint.
  waste: {
    colour: 0x5e6431,    // polish audit: darker, less yellow, so it never reads as the vent's amber
    emissive: 0x171a06,  // a little self-lit, so it still reads as something not to touch
  },

  // The Ledge reveal: reaching the extraction ledge re-reads every prop in the
  // level, and a prop within `radius` of the player's paint takes that colour.
  reveal: {
    radius: 2.5,         // metres from the prop to the nearest paint that counts
    ring: 8,             // samples on that circle, plus the prop's own spot
  },
};

// The Primer's mood and dressing (polish pass 1). Borrowed from Outskirts'
// drained overcast and nudged WARM: this is the rebels' own course, so its air
// is dusty daylight, not the Corp's bleach. Same rules as OUTSKIRTS.mood: fog
// matches the horizon band, never the whole sky (see src/levels/mood.js).
export const PRIMER = {
  mood: {
    horizon: 0xa59f94,   // warm dust haze
    zenith:  0x56606b,
    void:    0x1c1b1a,
    fogNear: 10,         // clears the TPV camera; a room is ~12-30 m deep
    fogFar:  58,         // the next room is hazy, the one after is gone
    fillColour: 0xc4bdb0,
    fillIntensity: 0.55,
  },
  // Training-course dressing: lane markings are chalk, NOT paint — cream is
  // none of the three paint colours, so a marking never reads as ice or bounce.
  dressing: {
    chalk: 0xd9cfb6,
    lineWidth: 0.15,
    crate: 0x8a6a45,     // rebel timber
    // Polish audit: the course read as one debug texture with no focal point.
    lamp: 0xffd2a0,      // warm tungsten: the rebels' light. Not amber (danger), not a paint colour
    glow: 0.6,           // the soft halo round a lamp (additive), so it reads as LIT, not as a sticker
    glowSize: 3.4,       // m across a hero lamp's halo; a lead lamp's is 1.5x
    floorGrid: 2,        // floor grid squares are this many times a wall's: floor and wall stop being one texture
  },
};

// Last Colour (polish pass 1): the Corp facility's mood, prop kit and crusher.
export const LAST_COLOUR = {
  // Sickly amber interior (#125): the haze is the colour of old warning lamps.
  mood: {
    horizon: 0x6e5c3c,   // amber haze, dimmed: the far end of a room goes brown
    zenith:  0x2b2721,
    void:    0x141210,
    // #197: drained Corp grey; the Siphon pulls the sky back here while its
    // exam runs, and its destruction restores the amber above.
    drained: { horizon: 0x5a5c58, zenith: 0x262725, void: 0x121312 },
    fogNear: 14,         // clears the TPV camera; the hangar is 38 m deep
    fogFar:  72,         // the Core's far wall (52 m) is hazy, never gone
    fillColour: 0xd9a650,
    fillIntensity: 0.5,
  },
  // Props are GREY ONLY: colourless machinery nobody maintains. Colour belongs
  // to the player; the one exception is the amber warning light (DANGER.amber).
  props: {
    crate: 0x5d5f62,
    barrier: 0x8a8c8f,
    pipe: 0x46494d,
    rail: 0x6c6f73,
    lightOff: 0x4a4430,  // an amber lamp that is not lit
    rock: 0x5b6066,      // the Ascent's scree (the kit is shared): a cold rock grey, darker than its faces
    // A Corp work light: cold white, NOT amber. Amber means "this hurts"
    // across the campaign; a floodlight only says "here", so it marks a route.
    floodlight: MARKER.white,
    blinkRate: 6,        // rad/s: the warning lamps' on/off rhythm
    maxFloorHeight: 1.2, // no prop on an arena floor hides a Drainer at 20 m
  },
  // The cargo crusher in the corridor (#33): a fixed rhythm, read off the lamp.
  crusher: {
    period: 3.6,         // seconds per cycle
    downFor: 1.2,        // seconds of each cycle the head is down (the beat)
    warnFor: 0.7,        // seconds before the drop the lamp blinks (the tell)
    damage: 40,          // a hard hit, not a kill: three beats from full
    cooldown: 1.0,
    headHeight: 2.4,     // the head's own height; it rises to the box's top
    hurtHeight: 2.2,     // the hurting region, from the floor up
  },
  // The Siphon (#100): the final exam. Three phases, one colour each, read by
  // the share of a plate in that colour — never by damage (docs/levels/03-last-colour.md, R5).
  siphon: {
    revealFor: 2.0,      // seconds a target shows its colour and refuses paint: the tell before the test
    need: 0.5,           // share of a plate's samples in the right colour that solves it
    samples: 4,          // a samples x samples grid per plate; one centred shot covers 12 of 16
    pulseRate: 8,        // rad/s: the frame's pulse while a target is open
    frameMargin: 0.35,   // metres the coloured frame shows round each plate
    intake: { size: 3, vaneSpin: 6 },
    arm: { size: 2, reach: 3, beam: 0.5, thrashAmp: 1.6, thrashRate: 2.2 },
    core: { size: 2.5, shutterRise: 3.2 },
    spillRadius: 3.5,    // the pool of the phase's colour it leaks at its foot (the refill, and a second tell)
    finaleFor: 2.5,      // seconds the core takes to sink into the machine before the win
    knockDepth: 2.5,     // metres it sinks
    frost: 0xe8f6ff,     // a frozen intake's frame
    dim: 0x3a3d42,       // a frame between pulses, and a solved arm's
    vane: 0x2e3135,
  },
};

// The Ascent (polish pass 1): cold dawn, the collapsing catwalk (#102), and the
// base on the horizon.
export const ASCENT = {
  // Cold dawn (#125): thin, clear mountain air. The fog is FAR, because this
  // level is about seeing the goal — the lift beacon is 76 m from the trailhead
  // and has to read the whole climb. Same sun as every level (the scene light is
  // core's), so the dawn is the sky and the fill, not a moved sun.
  mood: {
    horizon: 0xc9c2c4,   // pale rose-grey: first light, nothing warm yet
    zenith:  0x4c5c74,   // cold slate blue overhead
    void:    0x1d2129,   // the drop below the ridges
    // #197: drained Corp grey at the trailhead; the climb paints it back.
    drained: { horizon: 0x7a7d78, zenith: 0x474a47, void: 0x1b1c1b },
    fogNear: 30,         // the room you are in is crisp
    fogFar:  170,        // the far side of the mountain is haze, the tower is not
    fillColour: 0x9fb4d6,
    fillIntensity: 0.6,
    skyRadius: 450,      // past the base (~245 m), so the dome is behind it
  },
  // The collapsing catwalk (#102): "can you cross before it drops?"
  catwalk: {
    // A segment goes this long after you first step on it, whether or not you
    // are still there. At PLAYER.maxSpeed a 4 m segment takes 0.57 s, so a run
    // always makes it and a stop to shoot never does.
    delay: 0.9,
    reformAfter: 5,      // seconds until a fallen segment is back (the scree-return climb takes longer)
    shake: 0.05,         // metres of jitter while it is going: the tell
    flashOpacity: 0.55,  // the amber flash over the walking surface; see-through so paint still reads
    fallGravity: 26,     // m/s² the falling slab drops with (PLAYER.gravity's size)
    fallFor: 1.2,        // seconds the falling slab is drawn before it hides
    standBand: 0.35,     // feet within this above a segment count as standing on it
  },
  // The base: a silhouette on the summit horizon, unfogged so it stays a shape
  // against the dawn instead of dissolving into it.
  base: { silhouette: 0x262b35 },
};

// #198 — curves and surfaces of revolution (src/levels/curves.js). Colours are
// the Corp's existing pipe greys: a cable is machinery, not a new colour.
export const CURVES = {
  radius: 0.08,          // m, a cable's default thickness
  sag: 1.5,              // m, how far a cable dips at the middle of each span
  sagSamples: 8,         // parabola samples per span (even: the midpoint is one)
  segmentsPerMetre: 1.5, // tube segments along the curve
  radialSegments: 6,
  latheSegments: 16,     // around a vat or tank: few, and flat-shaded on purpose
  colour: LAST_COLOUR.props.pipe,
  hoseRadius: 0.22,      // the Siphon's hoses are fatter than a power line
  hoseColour: LAST_COLOUR.props.rail,
  vatColour: LAST_COLOUR.props.barrier,
};

// The dressing pass (docs/levels/dressing-pass.md, src/levels/dressing.js):
// set pieces off the arena floor. GREY ONLY — colour belongs to the player,
// amber means danger and marker white means "here", so neither is decoration.
// The one accent is Corp signage in the gates' grey-violet (GATE.field).
// Every kind is { colour, shape, look }: see dressing.js for the shapes and looks.
const SILHOUETTE = 0x1a1b1d;   // darker than every drained horizon: a shape against the sky
export const DRESSING = {
  glassOpacity: 0.22,
  // Wall breakup (Last Colour): a rib every `spacing` m, from `above` m over the
  // top at its foot to the wall top, and a lip along every wall top.
  walls: {
    spacing: 6,
    above: 3,
    rib: { width: 0.6, depth: 0.3 },
    cornice: { out: 0.35, depth: 0.3, rise: 0.35 },
  },
  kinds: {
    // Wall breakup
    rib:      { colour: 0x3e4145, shape: 'box', look: 'toon' },
    cornice:  { colour: 0x6c6f73, shape: 'box', look: 'toon' },
    truss:    { colour: 0x3a3d41, shape: 'box', look: 'toon' },
    tray:     { colour: 0x55585c, shape: 'box', look: 'toon' },
    pipe:     { colour: LAST_COLOUR.props.pipe, shape: 'round', look: 'toon' },
    // Skyline: the facility outside, unlit and unfogged like the Ascent's base
    block:    { colour: SILHOUETTE, shape: 'box', look: 'silhouette' },
    stack:    { colour: SILHOUETTE, shape: 'round', look: 'silhouette' },
    // The Ascent's distant range: a shade lighter than its base (ASCENT.base),
    // so the nearer base still reads in front of the farther mountains.
    range:    { colour: 0x4a4f57, shape: 'lump', look: 'silhouette' },
    strata:   { colour: 0x5c5a55, shape: 'box', look: 'toon' },   // rock bands: a warm stone, so they read as rock, not as slots
    // Story clusters
    crate:    { colour: LAST_COLOUR.props.crate, shape: 'box', look: 'toon' },
    machine:  { colour: 0x4f5256, shape: 'box', look: 'toon' },
    belt:     { colour: 0x2e3135, shape: 'box', look: 'toon' },
    drum:     { colour: 0x5a5d61, shape: 'round', look: 'toon' },
    pill:     { colour: 0x9a9c9e, shape: 'capsule', look: 'toon' },   // drained pills: grey, like everything the Corp makes
    stencil:  { colour: GATE.field, shape: 'box', look: 'toon' },      // Corp signage: the one accent
    sign:     { colour: GATE.field, shape: 'capsule', look: 'toon' },  // the pill icon, on a panel
    panel:    { colour: 0x3a3d41, shape: 'box', look: 'toon' },
    board:    { colour: 0x8a8c8f, shape: 'box', look: 'toon' },      // a billboard's face: bleached Corp grey
    glass:    { colour: 0xaab4b8, shape: 'round', look: 'glass' },
    specimen: { colour: 0x2b2d30, shape: 'capsule', look: 'toon' },    // a failed test subject, a shadow in the tube
    deck:     { colour: 0x55585c, shape: 'box', look: 'toon' },
    rail:     { colour: LAST_COLOUR.props.rail, shape: 'round', look: 'toon' },
    bar:      { colour: LAST_COLOUR.props.pipe, shape: 'round', look: 'toon' },
    grate:    { colour: 0x2a2c2e, shape: 'box', look: 'toon' },
    concrete: { colour: GATE.concrete, shape: 'box', look: 'toon' },
    flag:     { colour: 0x7d7f82, shape: 'box', look: 'toon' },       // a Corp flag, bleached grey
    // The Primer's rebel stencils: chalk, the rebels' own mark (PRIMER.dressing.chalk)
    chalk:     { colour: PRIMER.dressing.chalk, shape: 'box', look: 'toon' },
    chalkPill: { colour: PRIMER.dressing.chalk, shape: 'capsule', look: 'toon' },
  },
  // At most this many extra draw calls per level (the doc's budget).
  maxDrawCalls: 15,
};

// #198 — lights the levels place in the point-light pool (#195). At most four
// are lit at once (the nearest), so each one means something: amber is a live
// trap (danger, #126), marker white is the goal, grey-violet is the Siphon,
// warm tungsten is the Primer's way on.
export const PLACED_LIGHTS = {
  trap: { colour: DANGER.amber, intensity: 1.2, range: 6, rest: 0.35 },   // rest: share while armed but idle
  beacon: { colour: MARKER.white, intensity: 1.0, range: 12 },
  siphon: { colour: GATE.field, intensity: 1.4, range: 16, pulseRate: 2.5, drainRate: 6 },
  lamp: { colour: PRIMER.dressing.lamp, intensity: 0.9, range: 7 },
};

export const PAINT_GUN = {
  range: 30,
  radius: 1.4,
  cost: 4,
  fireDelay: 0.14,
  hipSpread: 0.025,
  adsSpread: 0.005,
  refillRate: 8,

  damage: 10,
  splashRadius: 1.4,
  splashFraction: 0.5,
};

// Starting master volume (0..1). The options menu overrides it per player.
export const AUDIO = {
  volume: 0.6,
  pitchVariance: 0.06,   // +-6% detune on every play (polish audit P1-3): no machine-gun blips
};

// #199 — adaptive synthesised music (src/audio/music.js). Three layers: the
// Corp drone (always on; its filter closes as territory grows), the colour
// arpeggio (gain follows territory, a voice per colour fired) and the combat
// drums (in while fighting, out combatHold s after). Each level has its own key
// and tempo. `fullAt` matches SKY.to: the sky and the music read the same
// territory number and arrive at "restored" together (DECISIONS, 30 Oct).
export const MUSIC = {
  volume: 0.6,            // the Music slider's default (0..1)
  duck: 0.3,              // the music drops by this share under the sergeant's lines
  duckRelease: 0.6,       // s to come back up after a line
  fullAt: 0.2,            // territory at which the colour layer is at full gain
  combatFadeIn: 1.0,      // s from silent to full drums once a fight starts
  combatHold: 3,          // s the drums keep going after the fight ends
  combatFadeOut: 2,       // s from full to silent after the hold
  clearMinFight: 2,       // s a fight must last before its end earns the clear stinger
  lookAhead: 0.12,        // s of notes scheduled ahead on the Web Audio clock
  smoothing: 0.05,        // s time constant for layer gain changes
  filterSmoothing: 0.8,   // s time constant for the drone's filter
  droneOpen: 900,         // Hz: the drone's cutoff on an unpainted level — cold and present
  droneClosed: 180,       // Hz: at full territory the Corp hum sinks under the colour
  droneDetune: 0.006,     // the slow beat between the drone's two saws
  gains: { drone: 0.05, colour: 0.18, combat: 0.22, stinger: 0.07 },
  voices: { green: 0.35, blue: 0.22, red: 0.4, kick: 0.9, snare: 0.35 },
  // Scale-degree indices per eighth note; past the scale's end wraps an octave up.
  pattern: [0, 1, 2, 4, 5, 4, 2, 1],
  // Semitone chords above the root an octave up: rising on a clear, falling
  // on a death, IV-V-I on the win.
  stingers: {
    clear: [[0, 4, 7, 12]],
    death: [[7, 3, 0, -5]],
    win: [[5, 9, 12], [7, 11, 14], [0, 4, 7, 12]],
  },
  stingerStep: 0.32,      // s between a stinger's chords
  stingerSpread: 0.06,    // s between a chord's notes (a strum, not a block)
  stingerLength: 0.9,     // s each stinger note rings
  // Each level's key (root Hz) and tempo (BPM): four levels, four sounds.
  levels: {
    primer: { root: 220.0, tempo: 92, scale: [0, 2, 4, 7, 9] },          // A major pentatonic: the training ground is friendly
    outskirts: { root: 196.0, tempo: 100, scale: [0, 3, 5, 7, 10] },      // G minor pentatonic
    ascent: { root: 164.81, tempo: 108, scale: [0, 2, 3, 7, 9] },         // E, dorian-ish: the climb lifts
    'last-colour': { root: 174.61, tempo: 124, scale: [0, 1, 5, 7, 8] },  // F, phrygian edge: the Corp's home
    default: { root: 196.0, tempo: 100, scale: [0, 3, 5, 7, 10] },
  },
};

// Player feedback cues (polish audit P0-4, P1-6, Q1, Q3): the layer that tells
// the player what happened. Read by src/ui/feedback.js; drawn by the HUD.
export const FEEDBACK = {
  hurtFade: 0.6,         // s the hurt vignette takes to clear
  hurtArcFade: 1.2,      // s the damage-direction arc stays (CoD's indicator)
  hurtFromAge: 0.25,     // s a recorded hit source counts as "this hit's"
  refillTick: 0.11,      // s between refill bubbles while the tank fills
  refillRise: 0.9,       // the bubble's pitch rises by this much from empty to full
  stepInterval: 0.36,    // s between grey footsteps at a walk
  stepMinSpeed: 1.2,     // m/s you must be moving for a footstep
  submergeTint: 0.4,     // opacity of the screen edge in your ground colour while submerged
  greyEdge: 0.22,        // opacity of the desaturated edge while you stand on grey
};

// Options-menu ranges. Sensitivity is a multiplier on PLAYER.lookSensitivity.
export const OPTIONS = {
  sensitivityMin: 0.25,
  sensitivityMax: 3,
};

export const PAINT_GRID = {
  level0Cells: 4,   // the Primer: the same density every level uses
  level1Cells: 4,
  level2Cells: 4,   // the Ascent: same density, so a splat is the same size on every face
  level3Cells: 4,   // Last Colour: same again — a Drainer eats the same cells everywhere
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
  // How fast an enemy falls when it is over a floor far below its feet — i.e.
  // something (knockback, a blue slip) carried it off a ledge. Not a physics
  // system: enemies have no gravity, and this only runs when the ground under
  // them is more than `maxStepDown` below, which normal walking never allows.
  fallSpeed: 18,
};

// Awareness (#109). The shared substrate from `docs/enemies/algorithms.md`
// § Awareness — Dormant / Alert / Search, and the numbers that separate them.
//
// These are DETECTION numbers, not attack numbers. `ENEMY.*.attackRange` still
// decides when a shot is fired; this decides whether the enemy knows there is
// anything to shoot at, which is why the radii here are larger than every
// attack range in the game.
//
// Every enemy uses this. The turret is the one exception and it is declared as
// data (`ENEMY.turret.ignoresStealth`) rather than checked by name, because a
// machine that tracks you through a wall for a reason is a rule, and a rule
// spelled `type === 'turret'` is a rule hidden in a conditional.
export const AWARENESS = {
  radius: 16,          // m, against a standing (dry or wet) player
  submergedRadius: 7,  // m, against a submerged player — halved, not zero
  fireAlert: 3,        // s of Alert bought by firing, regardless of submerge
  forget: 6,           // s a last known position is remembered, then Dormant
  arrive: 1.2,         // m: close enough to the last known position to stop
  eyeHeight: 1.4,      // m above the feet — the height a sight line is drawn at
};

// Wall-crawler climbing (#115). From `docs/enemies/algorithms.md` § Wall-crawler.
//
// The two speeds are the whole feature: a wall-crawler on a face you painted
// green is FASTER than the 4.5 m/s you climb at, and on bare grey it is slower.
// That is the design's "your route is its route" — painting green to get up
// somewhere is always a decision with a cost, because the thing that follows you
// up the same face does it quicker.
//
// The speeds live here rather than on `ENEMY.wallCrawler` because they are read
// off the PAINT under the crawler every frame, not off the enemy. It can start a
// climb on grey and finish it on green: the face is the object being read, which
// is the same rule the player's own climb follows.
export const CLIMB = {
  grey: 3.5,        // m/s up, down or sideways on an unpainted face
  green: 5.0,       // m/s on green — faster than the player's PLAYER.climbSpeed
  reach: 1.6,       // m: how far in front of itself it can grab a face
  gap: 0.4,         // m kept between the body and the face, so it is not inside it
  verticalGap: 1.0, // m: the player has to be this much higher/lower to be worth climbing to
  dropRange: 2.5,   // m: close enough to the player (and above) to let go
  gravity: 18,      // m/s² accelerating a fallen crawler — its own, not the player's
  maxFall: 14,      // m/s cap, so a long drop cannot tunnel through a floor in one step
};

// Stalker (#120). The second enemy whose speed is a property of the GROUND
// rather than of itself — the wall-crawler above was the first, for climbing.
//
// WHY THE GROUND: the Stalker punishes you for being WET. Every other enemy in
// the game punishes you for being dry; this one is fast inside the territory you
// painted and slow on grey, so the counterplay is to give up your own ground and
// walk on the boring stuff. That only works if the difference is brutal rather
// than a tweak — a stalker merely "slightly slower" on grey reads as noise, and
// the player never deduces the rule (the design note is explicit: never tell
// them).
//
// The speeds live here, not on `ENEMY.stalker`, for the same reason CLIMB does:
// they are read off the paint under the crawler every frame. It can start a
// chase on green and finish it on grey.
//
// `lungeWindup` is the telegraph, and it is the whole counterplay: the heading is
// captured when the telegraph ENDS, so a sidestep during those 0.4 s makes it
// commit to empty ground. `lungeRecovery` is what that miss costs it.
//
// Ratios worth checking against PLAYER.maxSpeed (7.0): 6.0 on your paint means a
// SPRINTING player still outruns it, and 2.0 on grey means a WALKING one does.
// If the manual check reads wrong, this pair is the dial.
export const STALKER = {
  paintSpeed: 6.0,      // m/s on anything the player has painted
  greySpeed: 2.0,       // m/s on unpainted ground
  lungeWindup: 0.4,     // s of telegraph before it commits
  lungeSpeed: 7.5,      // m/s during the commitment — faster than it can run
  lungeTime: 0.5,       // s committed; reach is speed x time, 3.75 m
  lungeRecovery: 0.8,   // s planted after a MISS. A hit costs it nothing but time
  lookahead: 2.5,       // m: how far ahead it sniffs the ground for paint
  fan: [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9], // rad, in preference order
};

// Level tank sizes, keyed by REGISTRY ID (#155) — the same string a level uses
// everywhere else (`primer`, `outskirts`, `ascent`, `last-colour`). A numeric
// key is how this bug happened: `1` looked like "the default" rather than
// "Outskirts", and every level got Outskirts' 100.
//
// A fifth level must add its own entry — `tests/tank-per-level.test.js` walks
// `LEVELS` and fails if one is missing, so a new level cannot ship with an
// accidental fallback.
export const AMMO = {
  primer: 100,          // tutorial: same as Outskirts, explicitly
  outskirts: 100,       // plentiful
  ascent: 60,           // starved — 15 shots, every room tuned against it
  'last-colour': 80,    // contested
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
    // The ground it turns grey, in metres, WHERE ITS SHOT LANDS (#107).
    // Zero/absent means it never touches the grid — which is every other
    // enemy here except the Drainer, whose grey comes from eating instead.
    greyRadius: 1.5,
    contactDamage: 10,
    attackDamage: 10,   // per shot; wired to player.takeDamage in main.js
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,  // unused while `reload` is set below — the reload IS the gap
    // #118 — the THIRD beat, and this enemy's whole counterplay
    // (docs/enemies/algorithms.md § Sprayer): AIM 0.6 s -> FIRE a burst of 3 ->
    // RELOAD 1.2 s, and the reload is the window that makes it punishable
    // rather than merely survivable.
    //
    // The Sprayer is also the territory enemy — each shot greys the ground —
    // so the reload is the moment you can safely step onto grey and repaint.
    // If the window is shorter than one splat plus a step back to cover, the
    // Drainer and the Sprayer together become a death spiral (the design note,
    // verbatim).
    //
    // For an enemy that declares `reload`, it REPLACES `attackCooldown` as the
    // gap: both would stack into a second wait with no tell on it, and the
    // point is one readable opening, not two silent ones.
    burst: 3,           // shots per burst
    burstGap: 0.12,     // s between shots INSIDE a burst (a burst, not a trickle)
    reload: 1.2,        // s of opening after the burst — THE window to repaint
    // #185 — m/s of its pellet. 12 m / 22 m/s = 0.55 s of flight: a sidestep on
    // paint clears it, on grey only if you moved on the wind-up. See ENEMY_SHOT.
    shotSpeed: 22,
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
    // #76: the third beat. A charge ends by arriving on the player, by a wall or
    // ledge, by 8 m travelled or by 2 s committed (enemy.js), and then the
    // Charger stands still and takes full damage for this long. That turns the
    // fight into bait -> dodge -> punish. If the window feels too generous,
    // shorten THIS before touching anything else; if it still feels unfair, the
    // windup is too short — not the recovery.
    recovery: 1.2,
  },
  wallCrawler: {
    hp: 45,
    speed: 3.0,
    canShoot: true,
    canMove: true,
    climbsGreen: true,
    drainsPaint: false,
    contactDamage: 10,
    attackDamage: 10,   // same as the Sprayer: one wound-up shot
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,
    shotSpeed: 22,      // #185 — the Sprayer's pellet
    stopDistance: HEALTH.contactRange + 0.2,
  },
  turret: {
    hp: 70,
    speed: 0,
    canShoot: true,
    canMove: false,
    climbsGreen: false,
    drainsPaint: false,
    // A machine does not get fooled by paint (#109). It never searches, never
    // goes dormant, and is not halved by submerging: it tracks you whenever you
    // are inside its attackRange. Out of scope for the enemies lane to change —
    // this flag is how the rule is stated, not how the turret is built.
    ignoresStealth: true,
    contactDamage: 0,
    attackDamage: 12,   // the hardest single shot: it is the positioning tax
    windup: 0.8,
    attackRange: 15,
    attackCooldown: 3,
    // #185 — faster than the Sprayer's: 15 m in 0.5 s, after a 0.8 s lock. Strafe
    // or break line of sight, as its spec says.
    shotSpeed: 30,
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
  // THE TERRITORY EATER (#80). `drainsPaint` was a flag with no behaviour until
  // the drain below it existed; these are the numbers behind it.
  //
  // WHY IT EXISTS AT ALL: paint is positive feedback — the player paints, gets
  // faster and better armed, and the arena becomes theirs. Left alone that makes
  // the climax trivial, so one enemy has to take it back.
  //
  //   drainRadius    how far it reaches. A cell outside this is a cell it is NOT
  //                  touching, which is a rule, not an optimisation: the manual
  //                  check is "watch the patch shrink from the enemy outward".
  //                  1.6 m is one paint splat (PAINT_GUN.radius 1.4) plus a step.
  //   drainRate      painted cells per second, at 4 cells/m (PAINT_GRID.level1Cells)
  //                  that is 16 / 16 = 1 m² of painted ground per second. This is
  //                  the difficulty dial for the whole final level: tune it LAST,
  //                  once the waves exist, and write the number down in ENEMIES.md.
  //   huntRadius     the player this close interrupts the feed: it stands up.
  //   resumeRadius   ...and it only lies back down past this. The 6 m gap between
  //                  the two is deliberate hysteresis — one threshold would flip
  //                  the posture every other frame on the boundary.
  drainer: {
    hp: 20,
    speed: 4.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: true,
    drainRadius: 1.6,   // metres it can reach into the grid
    drainRate: 16,      // painted cells eaten per second (1 m²/s at 4 cells/m)
    huntRadius: 8,      // player closer than this -> stands up and hunts
    resumeRadius: 14,   // player further than this -> back down to feed
    contactDamage: 5,
    windup: 0.5,
    attackRange: 3,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },

  // BIG ARM (#99): Last Colour's arena boss (DECISIONS 2026-10-06: "L3 = zombies
  // + Big Arm"; 2026-10-30 for the design). Built in src/enemies/boss.js.
  //
  // DAMAGE DOES NOT KILL IT. `hp` counts COMBOS LEFT: blue freeze → green pin →
  // red knockdown, landed three times, one per phase. Each phase entry below
  // overrides the top-level numbers while that phase runs.
  bigArm: {
    hp: 3,
    speed: 1.6,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 20,
    // #186 — its model is 1.5× the soldiers' (2.4 m vs 1.6 m): a boss you can
    // clip into is not a boss.
    bodyRadius: 0.6,
    attackDamage: 30,     // a slam that lands
    windup: 1.0,          // the slam's tell (algorithms.md: 1.0 s)
    attackRange: 4.0,     // it starts a slam with you inside this
    attackCooldown: 2.5,
    stopDistance: 2.6,
    slamRadius: 4.0,      // the grey it leaves, and the reach of the hit
    slamReach: 1.5,       // metres in front of it the slam lands
    pinFor: 3.0,          // combo step 2: seconds on one knee, waiting for red
    downFor: 2.5,         // combo step 3: seconds flat before the next phase
    grab: { range: 2.6, windup: 0.6, cooldown: 4.0, damage: 15, pull: 9 },
    phases: [
      {},                                                                   // 1: slow, the slam
      { speed: 2.6, windup: 0.9, attackCooldown: 2.0, grabs: true },        // 2: faster, the grab, two Drainers
      { speed: 3.2, windup: 0.7, attackCooldown: 0.4, grabs: true, ignoresPaint: true }, // 3: enraged
    ],
  },

  // THE STALKER (#120). The only enemy that attacks the loop from the other
  // side: it is fast on YOUR paint and slow on grey, so the escape is to give up
  // your own territory. See the STALKER block above for the speeds and the lunge.
  //
  // Three flags carry the whole identity:
  //   surfaceSpeed  its speed comes from the ground, not from `speed` below
  //   prefersPaint it steers to stay inside your territory, even when a grey
  //                 line would be shorter — the preference has to be visible or
  //                 the speed rule looks like a random fast thing
  //   lunges        its telegraph is a lunge, not a shot (`_commitLunge`)
  //
  // `speed` is only a fallback for anything reading a single number (gait, the
  // charge tracker); the walk speed is `_moveSpeed`.
  //
  // NO `noProcs`: freeze, pin and knockback all work on it, as they do on
  // everything except the turret — tests/turret-no-procs.test.js pins that
  // turret-only exemption and would fail if this block opted out.
  //
  // NO stealth or fade anywhere: the design note is that an enemy which is both
  // faster than you and invisible where you feel safe is unfairness, not tension.
  stalker: {
    hp: 30,
    speed: STALKER.greySpeed,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    surfaceSpeed: true,
    prefersPaint: true,
    lunges: true,
    contactDamage: 20,
    // The telegraph IS the lunge windup, and the range is exactly "close enough
    // to arrive": reach (speed x time) plus contact range. Bigger and it commits
    // from a distance it cannot cover, which reads as a bug rather than a miss.
    windup: STALKER.lungeWindup,
    attackRange: STALKER.lungeSpeed * STALKER.lungeTime + HEALTH.contactRange,
    attackCooldown: 1.8,
    stopDistance: HEALTH.contactRange + 0.2,
  },
};
// Enemy grey conversion (#107).
//
// Grey is a FACTION COLOUR (ADR-0002), not the absence of paint: an enemy taking
// ground is the gun's operation run in reverse. This block is the shape of that
// operation for enemies that do it at RANGE. The radius is NOT here — it is per
// enemy (`ENEMY.sprayer.greyRadius`) because a rifle and a slam should not share
// one number, and Big Arm's slam will carry its own wider one in its own entry
// when `boss.js` stops being a stub.
//
// HOW THE IMPACT IS FOUND, because that is the whole of the issue: the shot is a
// RAY from the enemy's muzzle to the ground the player is standing on, and the
// FIRST surface that ray reaches is the one that greys. That single "first hit
// wins" rule is what stops the conversion passing through a wall or through a
// raised floor — and it means an unpaintable gate in the way eats the shot
// instead of letting it through to the ground behind it.
//
// RATE: there is no separate timer. The enemy already has an attack cooldown
// (2.5 s for the Sprayer), so one attack is one splat and nothing here can
// outpace the thing that triggers it.
// Enemy attack pacing and death (polish audit, Enemies 2-4).
export const ENEMY_ATTACK = {
  tokens: 2,            // ranged enemies winding up or firing at once, per level
  meleeReach: 5,        // an attackRange at or under this is melee: no token needed
  // The telegraph whine is heard by distance: full inside `near`, silent past `far`.
  telegraphHearing: { near: 6, far: 15 },
  // The death burst: drops of the killing colour (death-burst.js).
  burst: {
    count: 14,
    size: 0.12,         // m, a drop's radius
    speed: 3.2,         // m/s outward
    lift: 3.5,          // m/s upward
    gravity: 18,
    height: 0.9,        // m above the feet the drops leave from
    life: 0.45,         // s, the same as the corpse's sink
  },
};

export const GREY_IMPACT = {
  muzzleHeight: 1.2, // metres above the enemy's feet the ray starts at
  reach: 2,          // metres past the target it keeps looking, so the target cell is tested
};

// Enemy pellets (#185, DECISIONS 2026-10-30 "Enemy shots are pellets").
//
// A ranged enemy (one whose ENEMY entry has a `shotSpeed`) no longer lands its
// shot when the wind-up ends: it FIRES a pellet that flies, can be dodged, is
// stopped by the first surface it reaches and greys where it lands. Melee is
// unchanged. Built in src/enemies/enemy-shots.js — one pool per level.
//
// The dodge maths, at the Sprayer's 12 m range and 22 m/s: 0.55 s of flight. On
// paint (7 m/s) a sidestep covers 3.8 m; on grey (4.2 m/s) 2.3 m, enough only if
// you react on the wind-up. Grey makes you easier to hit — painting is defence.
export const ENEMY_SHOT = {
  radius: 0.15,        // m; visible at 12 m without hiding the player
  gravity: 4,          // m/s² of drop, so it reads as ink, not a bullet. The aim compensates.
  rangeFactor: 1.5,    // it expires after flying attackRange × this
  spentDrop: 4,        // m; a spent pellet greys the surface this far below it (none over a pit)
  spreadDeg: 1.5,      // random cone, half-angle, per pellet
  aimHeight: 1.0,      // m above the player's feet: the chest, where they stand AT THE SHOT
  trailLength: 0.7,    // m of amber streak behind it
  trailOpacity: 0.55,
  rimScale: 1.3,       // the amber rim shell, as a multiple of `radius`
  colour: 0x3b3b42,    // dark Corp grey; the amber (DANGER.amber) carries the "this hurts"
  poolSize: 48,        // pellets alive at once, per level; the oldest is reused past this
};

// Difficulty = new rules, not bigger health bars.
export const DEFENCE = {
  1: { requiredColour: null, combo: [] },
  2: { requiredColour: "red", combo: [] },
  3: { requiredColour: null, combo: ["blue", "red"] },
};

export const BLUE_FREEZE = {
  hitsToFreeze: 3,
  buildupWindow: 2.0,
  critWindow: 2.0,
  armDelay: 0.25,
  criticalMultiplier: 3,
  buildupDamageScale: 0.4,
  shellRadius: 0.72,
  shellHeight: 0.95,
  shellOpacity: 0.55,
  buildupOpacity: 0.12,
};

// Dry out (#75). The player is dry when the tank is empty and no cell under
// them is theirs. This declares the loss rather than leaving them stuck.
export const DRY_OUT = {
  warningBelow: 0.25,   // tank % under which the HUD pulses the ammo bar
  graceTime: 1.0,       // seconds of continuous dry state before the run ends
};

// Submerge (#108). The commitment half of the loop: standing on your own paint
// refills you slowly and you can still fire; submerging is faster to move
// through, faster to refill, and you CANNOT FIRE.
//
// The trade is the whole feature. Without it, paint is just a resource. With
// it, "do I stay standing or do I commit?" is the question every fight asks.
//
// All numbers live here so the tuning dial is one file.
export const SUBMERGE = {
  key: 'ShiftLeft',          // hold this key to submerge (coordinate with team)
  speedMultiplier: 1.4,      // faster than normal walking — the reward for committing
  refillMultiplier: 4,       // 4× the base PAINT_GUN.refillRate: 32/s, a full tank in 3.1 s (polish audit; was 3)
  cameraOffset: 0.9,         // metres the TPV camera drops, so you read as "in" the paint
  maxAngle: 1.1,             // radians — how far the camera tilts down while submerged
};
// Submerged form (polish audit, Q1; shaders/avatar.js). The body squashes into
// the paint, a blob of its colour marks the spot, rings ripple in and out.
export const SWIM = {
  squash: 0.15,        // the body's height scale when under
  spread: 1.3,         // and its width, so it reads as a puddle, not a short soldier
  rate: 16,            // per second: how fast it sinks and rises (exponential ease)
  blobRadius: 0.55,    // m, the paint blob where the body went in
  blobHeight: 0.16,
  blobOpacity: 0.85,
  rings: 5,            // ripple rings in the pool
  rippleMax: 1.6,      // m, the entry / exit ring's final radius
  rippleLife: 0.5,     // s a ring lives
  rippleOpacity: 0.7,
  wakeEvery: 0.16,     // s between wake rings while moving under
  wakeSize: 0.7,       // m, a wake ring's final radius
};

// Hit-stop (polish audit P1-1): seconds the simulation freezes, rendering on.
export const HIT_STOP = {
  kill: 0.04,       // any kill
  shatter: 0.08,    // the blue freeze-shatter crit: the game's best combo
  combo: 0.12,      // a Big Arm combo step landing
};

// Camera shake as trauma (polish audit P1-2): events add trauma 0..1, the
// shake is trauma squared, decaying linearly. Never on firing.
export const SHAKE = {
  decay: 1.6,          // trauma per second
  frequency: 22,       // how fast the shudder moves
  maxOffset: 0.3,      // metres, at full trauma
  maxRoll: 0.06,       // radians of roll at full trauma
  maxAngle: 0.035,     // radians of pitch wobble at full trauma
  kickDecay: 14,       // the hurt flinch's exponential decay, per second
  hurt: 0.35,          // medium: you were hit
  hurtKick: 0.045,     // radians the camera flinches up on a hit (P0-4)
  redBounce: 0.18,     // small: a hard landing on red flings you
  redBounceFall: 6,    // m/s of fall before a red landing counts as hard
  slam: 0.85,          // large: Big Arm's slam, at its centre
  slamRange: 16,       // metres over which the slam's shake fades to nothing
};

// Death returns colour (polish audit P1-4): a killed enemy bursts into a splat
// of the colour that killed it, as player paint — a kill becomes a refill pool.
export const DEATH_SPLAT = {
  radius: 1.8,
};

// Mantle (#157). A green climb ends by pulling the player onto the top
// surface — the missing move every climbing game has. Automatic, not a
// button: the player is already pushing into the wall, and a second input at
// the top is the clumsy moment this removes.
//
// Green stays the gate. A mantle replaces only the last ~0.85 m of a climb
// (the wall-contact test is at chest height, so the feet stop ~0.85 m short
// of the top), so it makes climbing SMOOTHER, not easier — the paint cost is
// unchanged. The reach below is the tune that decides how forgiving the
// last metre is.
export const MANTLE = {
  reach: 1.0,       // how far below the wall's top edge the feet must be for mantle to fire
  inward: 0.6,      // how far onto the top surface the player ends up
  duration: 0.25,   // seconds of the lift; instant enough that it never feels slow
};

// --- PAINTSTREAK (#131, PRD C7) ----------------------------------------------
// The reward for playing the loop well. New ground and kills fill a gauge, in
// that order of weight; doing several kinds of thing at once fills it faster
// than repeating one. A full gauge is spent (never auto-fired) on one large
// splat at your feet that claims the zone and stuns what stands in it.
//
// Target: a full gauge in ~90-120 s of normal varied play. Under a minute and
// it is a spammable button; much over three and nobody ever sees it. These are
// first numbers from arithmetic, not from a playtest — tune them here.
export const PAINTSTREAK = {
  key: 'KeyQ',               // spend. Unbound elsewhere (input.js, menu controls)
  max: 100,                  // the gauge; only a FULL gauge can be spent

  // Fill sources. Coverage is counted in newly painted cells: one splat claims
  // ~25 cells of fresh ground, so ~0.5 points a splat before variety.
  cellsPerPoint: 50,
  pointsPerKill: 3,          // a kill is worth ~6 splats of new ground: less than painting overall
  sampleInterval: 0.25,      // s between coverage scans — it is a grid scan, like the HUD's

  // Variety. Each channel — paint, kill, traverse — counts as "active" for
  // varietyWindow seconds after it last happened. Fill is multiplied by
  // 1 + varietyBonus × (active channels − 1): ×1 for one thing, ×2 for all three.
  // Traversal only ever counts toward variety; it fills nothing by itself.
  varietyWindow: 8,
  varietyBonus: 0.5,
  traverseSpeed: 3,          // m/s of horizontal movement that counts as traversing

  // The spend.
  zoneRadius: 6,             // m — the splat at your feet
  zoneHeight: 2.5,           // m above/below your feet a floor or enemy must be to count
  stunTime: 2.5,             // s an enemy in the zone stands still and cannot attack
  stunColour: DANGER.amber,  // the one danger amber (#126), not a second value
};

// ---------------------------------------------------------------------------
// Mission intro (docs/mission-intro.md, PRD G4). One eased camera move from the
// level's goal back to the player's own view while the title card types out.
// The camera lands ON the play camera, so handover has no cut.
export const MISSION_INTRO = {
  moveTime: 5,       // s, goal → player
  fadeOut: 0.4,      // s, the card fades as control lands (matches style.css)
  cap: 6,            // s, never longer than this from load to control
  typeSpeed: 40,     // characters per second
  linePause: 0.15,   // s between title-card lines
  frameClamp: 0.1,   // s, the longest frame the intro counts in full (real time, not the game's 0.05)
};
