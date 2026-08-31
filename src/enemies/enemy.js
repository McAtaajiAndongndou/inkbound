// OWNER: D (Enemies & Combat)
// ONE enemy class with flags. Do NOT write five separate classes.
//
//   Sprayer      = base
//   Charger      = canShoot:false, speed x1.6
//   Wall-crawler = canClimb:true
//   Turret       = canMove:false, range x2
//   Drainer      = drainsPaint:true, health x0.4, speed x1.2
//
// Difficulty comes from armour rules (see config/tuning.js), not HP inflation.
export class Enemy {
  constructor(opts) { throw new Error('TODO: D'); }
  // takePaint(colourId) -> applies BODY_EFFECTS, checks armour/combo
  // update(dt)
  // dispose()
}
