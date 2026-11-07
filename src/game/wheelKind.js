// Wheel events come from three sources that look alike: a mouse wheel (notches), a touchpad swipe with two fingers
// (small continuous steps, often sideways too) and a touchpad pinch (the browser sends a wheel with Ctrl).
// The browser does not tell which, so this is a heuristic; the setting `wheelDevice` overrides it. Pure, no DOM.

/** A touchpad stays a touchpad for this long after its last event (inertia events are small and slow). */
export const HOLD_MS = 600;
/** Mouse wheel notches are at least this big (Chrome: 100, Windows scaling 120) and whole numbers. */
export const NOTCH_PX = 50;

/**
 * @param {{ deltaX: number, deltaY: number, deltaMode: number, ctrlKey?: boolean }} e wheel event
 * @param {'auto'|'mouse'|'touchpad'} mode setting
 * @param {{ pad: boolean, at: number }} state remembered between calls (own object per input)
 * @param {number} now time in ms
 * @returns {'pinch'|'mouse'|'touchpad'}
 */
export function wheelKind(e, mode, state, now) {
  if (e.ctrlKey) return 'pinch';
  if (mode === 'mouse') return 'mouse';
  if (mode === 'touchpad') return 'touchpad';
  // Firefox sends lines or pages for a mouse wheel
  if (e.deltaMode !== 0) { state.pad = false; return 'mouse'; }
  const dy = Math.abs(e.deltaY), dx = Math.abs(e.deltaX);
  const notch = dx === 0 && dy >= NOTCH_PX && Number.isInteger(e.deltaY);
  const small = dy > 0 && dy < NOTCH_PX;
  if (dx > 0 || small || (dy > 0 && !Number.isInteger(e.deltaY))) { state.pad = true; state.at = now; return 'touchpad'; }
  // a big whole step: a mouse, unless a touchpad swipe is going on right now
  if (notch && state.pad && now - state.at < HOLD_MS) { state.at = now; return 'touchpad'; }
  if (notch) state.pad = false;
  return state.pad ? 'touchpad' : 'mouse';
}
