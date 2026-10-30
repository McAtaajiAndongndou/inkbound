// OWNER: Core
// Game feel the polish audit found missing (P1-1, P1-2, P0-2): hit-stop, the
// camera's trauma, and the refill / dry-out step. Small, DOM-free and tested,
// so main.js only wires them.
import { HIT_STOP, PAINT_GUN, SUBMERGE, DRY_OUT, SHAKE } from '../config.js';

/**
 * Hit-stop (P1-1): freeze the simulation for a few frames on a kill, longer on
 * a freeze-shatter and longer again on a Big Arm combo step, while rendering
 * carries on. A kill that stops time for 40 ms reads as a hit; one that
 * resolves in a single frame reads as nothing.
 */
export class HitStop {
  constructor() {
    this.left = 0;
  }

  /** Stop for `seconds`. Overlapping stops do not add up: the longest wins. */
  trigger(seconds) {
    this.left = Math.max(this.left, seconds);
  }

  /** @param {'kill'|'shatter'|'combo'} kind */
  hit(kind) {
    this.trigger(HIT_STOP[kind] ?? 0);
  }

  get stopped() {
    return this.left > 0;
  }

  /** The step to simulate this frame: 0 while stopped, `dt` otherwise. */
  step(dt) {
    if (this.left > 0) {
      this.left = Math.max(0, this.left - dt);
      return 0;
    }
    return dt;
  }

  reset() {
    this.left = 0;
  }
}

/**
 * Camera trauma (P1-2, Squirrel Eiserloh's GDC talk): events ADD trauma (0..1),
 * it decays linearly, and the shake is trauma SQUARED, so small events barely
 * move the camera and big ones throw it. Never added by firing.
 */
export class Trauma {
  constructor() {
    this.value = 0;
    this.kickValue = 0;   // radians of upward kick, decaying fast (the hurt flinch)
    this._t = 0;
  }

  add(amount) {
    this.value = Math.min(1, this.value + Math.max(0, amount));
  }

  /** A short pitch flinch, on top of the shake (P0-4's "tiny camera kick"). */
  kick(radians) {
    this.kickValue = Math.max(this.kickValue, radians);
  }

  /**
   * Advance and return this frame's offsets: `{ x, y, roll, pitch }` in metres
   * and radians. Smooth pseudo-noise (summed sines at unrelated rates), so the
   * camera shudders rather than teleports between frames.
   */
  update(dt) {
    this._t += dt;
    const s = this.value * this.value;
    const t = this._t * SHAKE.frequency;
    const out = {
      x: SHAKE.maxOffset * s * noise(t, 1.0),
      y: SHAKE.maxOffset * s * noise(t, 2.3),
      roll: SHAKE.maxRoll * s * noise(t, 3.7),
      pitch: SHAKE.maxAngle * s * noise(t, 5.1) + this.kickValue,
    };
    this.value = Math.max(0, this.value - SHAKE.decay * dt);
    this.kickValue *= Math.exp(-SHAKE.kickDecay * dt);
    if (this.kickValue < 1e-4) this.kickValue = 0;
    return out;
  }

  reset() {
    this.value = 0;
    this.kickValue = 0;
  }
}

/** -1..1, smooth in t; `seed` decorrelates the axes. */
function noise(t, seed) {
  return (Math.sin(t * 1.0 + seed * 12.9) * 0.5
    + Math.sin(t * 2.17 + seed * 78.2) * 0.3
    + Math.sin(t * 4.31 + seed * 37.7) * 0.2);
}

/**
 * Refill and dry out, one frame (#75, #108, polish audit P0-2).
 *
 * THE P0-2 FIX: refill used to sit inside `if (player.onGround)`, and a player
 * on red is never `onGround` — the bounce deliberately leaves it false so
 * friction cannot eat the launch. So red, a third of your colours, never
 * refilled you. Refill now runs on any frame the feet TOUCHED the floor
 * (`player.touchedGround`, set by the bounce too), which is "standing in your
 * own paint" for a surface that will not let you stand.
 *
 * @param {object} player   onGround, touchedGround, dead, submerged, dry, dryTimer, kill()
 * @param {object} gun      ammo, maxAmmo
 * @param {boolean} onPlayerPaint  the paint under the player is theirs
 * @param {number} dt
 */
export function refillStep(player, gun, onPlayerPaint, dt) {
  const touching = !player.dead && (player.onGround || player.touchedGround);
  if (!touching) {
    player.dry = false;
    player.dryTimer = 0;
    return;
  }
  if (onPlayerPaint) {
    // Submerged refills SUBMERGE.refillMultiplier times faster: the "commit"
    // half of the trade — you cannot fire, but you come back up full.
    const mult = player.submerged ? SUBMERGE.refillMultiplier : 1;
    gun.ammo = Math.min(gun.maxAmmo, gun.ammo + PAINT_GUN.refillRate * mult * dt);
  }
  // Dry = empty tank AND no paint underfoot, for DRY_OUT.graceTime seconds.
  player.dry = gun.ammo <= 0 && !onPlayerPaint;
  if (player.dry) {
    player.dryTimer += dt;
    if (player.dryTimer >= DRY_OUT.graceTime) player.kill();
  } else {
    player.dryTimer = 0;
  }
}
