// Pause hold: while the game is paused (pause button/Space, game menu, script debugger, error dialog,
// loading screen), music, ambience, game sounds and voices fade out and halt; on resume they fade back in
// and the music continues where it stopped. UI sounds (bus 'ui') stay audible. Pure rendering state:
// the simulation never sees any of it.

/** Fade length in seconds (linear ramp, no click). */
export const HOLD_FADE = 0.3;

/** Buses that fall silent while held (not 'ui': menu clicks keep sounding). */
export const HELD_BUSES = /** @type {const} */ (['music', 'sfx', 'ambient']);

/**
 * Should game audio be held? Paused game, except once it has ended (victory/defeat jingle must play).
 * @param {{ paused?: boolean, ended?: boolean, stopped?: boolean }} s
 */
export const shouldHold = (s) => !!s.paused && !s.ended && !s.stopped;

/** Gain of a held bus stage. @param {boolean} held */
export const holdGain = (held) => (held ? 0 : 1);

/**
 * Where a music file continues after a hold at audio time `at`.
 * @param {number} startsAt audio time at which offset 0 of the file plays (in the future during a pause between pieces)
 * @param {number} at audio time at which the music falls silent
 * @param {number} duration file length in seconds (0 = unknown)
 * @param {boolean} [loop]
 * @returns {{ offset: number, gap: number }|null} offset into the file and remaining wait; null = piece has finished
 */
export function holdPosition(startsAt, at, duration, loop = false) {
  if (startsAt >= at) return { offset: 0, gap: startsAt - at };
  let offset = at - startsAt;
  if (duration > 0 && loop) offset %= duration;
  if (duration > 0 && offset >= duration - 0.05) return null;
  return { offset, gap: 0 };
}
