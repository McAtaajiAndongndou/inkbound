// OWNER: E (UI & Audio)
// The layer that tells the player what just happened (polish audit, 30 Oct).
//
// The systems were all there and none of them said so: getting hurt made no
// sound, submerging made no splash, the tank filled in silence, grey slowed you
// without a cue. This reads the state the game already keeps (player, gun) once
// a frame, turns CHANGES in it into sounds, and keeps the few numbers the HUD
// draws from (the hurt vignette, the damage arc, the screen-edge tint).
//
// DOM-free on purpose, so tests can step it. The HUD owns the elements.
import { DRY_OUT, FEEDBACK, PAINT } from '../config.js';
import { audio as defaultAudio } from '../audio/audio-manager.js';

export class FeedbackCues {
  /** @param {{ play(name: string, opts?: object): void }} [audio] */
  constructor(audio = defaultAudio) {
    this.audio = audio;
    this.reset();
  }

  /** Level load or restart: nothing carries over. */
  reset() {
    this._health = null;
    this._ammo = null;
    this._submerged = false;
    this._refillTimer = 0;
    this._stepTimer = 0;
    this._wasFull = true;
    this.hurt = 0;          // 0..1, the vignette's strength; jumps to 1 on a hit, fades out
    this.arc = 0;           // 0..1, the damage-direction arc's strength
    this.arcAngle = 0;      // radians, screen-relative: 0 = ahead, +PI/2 = to the right
    this.edge = null;       // { colour: '#rrggbb', alpha } — submerged tint or grey desaturation
  }

  /**
   * @param {number} dt
   * @param {object} state
   * @param {object} state.player   health, dead, submerged, currentColour, onGround,
   *                                velocity, yaw, position, optional lastHurtFrom/lastHurtAge
   * @param {object} state.gun      ammo, maxAmmo
   */
  update(dt, { player, gun }) {
    this.hurt = Math.max(0, this.hurt - dt / FEEDBACK.hurtFade);
    this.arc = Math.max(0, this.arc - dt / FEEDBACK.hurtArcFade);
    if (!player || !gun) return;

    // --- hurt (P0-4): a thud, the vignette, and where it came from ---------
    if (this._health !== null && player.health < this._health && !player.dead) {
      this.audio.play('hurt');
      this.hurt = 1;
      const from = player.lastHurtFrom;
      if (from && (player.lastHurtAge ?? 0) <= FEEDBACK.hurtFromAge) {
        this.arcAngle = screenAngle(player, from);
        this.arc = 1;
      }
    }
    this._health = player.health;

    // --- the tank (Q2, P1-6) ------------------------------------------------
    const max = gun.maxAmmo || 1;
    const fraction = gun.ammo / max;
    if (this._ammo !== null) {
      const prev = this._ammo / max;
      // Low ink: once, on the way down through the warning line.
      if (prev >= DRY_OUT.warningBelow && fraction < DRY_OUT.warningBelow && gun.ammo > 0) this.audio.play('lowInk');
      if (gun.ammo > this._ammo + 1e-6 && gun.ammo < max) {
        // Filling: a bubble every refillTick, its pitch rising with the tank.
        this._refillTimer -= dt;
        if (this._refillTimer <= 0) {
          this._refillTimer = FEEDBACK.refillTick;
          this.audio.play('refill', { pitch: 1 + fraction * FEEDBACK.refillRise });
        }
      } else {
        this._refillTimer = 0;
      }
      // Full: once, on arriving there from below (Splatoon's tank ding).
      if (gun.ammo >= max && !this._wasFull && this._ammo < gun.ammo) this.audio.play('tankFull');
    }
    this._wasFull = gun.ammo >= max;
    this._ammo = gun.ammo;

    // --- submerge (Q1): a splash in, a splash out, the edge in your colour ---
    if (!player.dead && player.submerged !== this._submerged) {
      this.audio.play(player.submerged ? 'submergeIn' : 'submergeOut');
    }
    this._submerged = !!player.submerged && !player.dead;

    // --- grey (Q3): sludge underfoot, the edge drained of colour -----------
    const v = player.velocity;
    const speed = v ? Math.sqrt(v.x * v.x + v.z * v.z) : 0;
    const onGrey = player.onGround && player.currentColour === 'grey' && !player.dead;
    if (onGrey && speed >= FEEDBACK.stepMinSpeed) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._stepTimer = FEEDBACK.stepInterval;
        this.audio.play('sludge');
      }
    } else {
      this._stepTimer = 0;   // the first step off paint squelches at once
    }

    if (this._submerged && PAINT[player.currentColour]) {
      this.edge = { colour: hex(PAINT[player.currentColour].hex), alpha: FEEDBACK.submergeTint };
    } else if (onGrey) {
      this.edge = { colour: hex(PAINT.grey.hex), alpha: FEEDBACK.greyEdge };
    } else {
      this.edge = null;
    }
  }
}

/**
 * Where `from` is around the player, as the angle the HUD arc points at:
 * 0 straight ahead, +PI/2 to the right, PI behind. Uses the player's own
 * convention, forward = (-sin yaw, -cos yaw).
 */
export function screenAngle(player, from) {
  const dx = from.x - player.position.x;
  const dz = from.z - player.position.z;
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  return Math.atan2(dx * rightX + dz * rightZ, dx * fwdX + dz * fwdZ);
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
