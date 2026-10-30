// OWNER: E (Levels)
import { audio } from '../audio/audio-manager.js';
import { TRAP } from '../config.js';

/**
 * How loud a trap is from where the player stands (polish audit, Traps).
 *
 * Full volume inside `TRAP.hearing.near`, silent past `far`, a straight fade
 * between. A crusher on the far side of the hangar must not clank in your ear,
 * and a trap you cannot hear does not exist for you when it is next to you.
 *
 * @param {{x:number,y:number,z:number}} source
 * @param {{x:number,y:number,z:number}|null|undefined} listener
 * @returns {number} 0..1
 */
export function hearingGain(source, listener) {
  if (!listener) return 1;
  const { near, far } = TRAP.hearing;
  const d = Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z);
  if (d <= near) return 1;
  if (d >= far) return 0;
  return 1 - (d - near) / (far - near);
}

/**
 * Play `name` at the trap's position, scaled by distance. The gain rides as
 * `audio.play`'s option; an AudioManager that ignores it still plays the sound.
 * Returns the gain, so a caller can scale its camera shake by the same amount.
 */
export function playAt(name, source, listener) {
  const gain = hearingGain(source, listener);
  if (gain > 0) audio.play(name, { gain });
  return gain;
}
