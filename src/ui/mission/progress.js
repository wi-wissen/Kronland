// Campaign progress in the browser: unlocked missions and best times.
// localStorage may be missing or blocked – then only mission 1 counts as unlocked.

import { CAMPAIGN } from '../../sim/missions/registry.js';

const KEY = 'kronland-campaign-1';

/** @returns {{ done: Record<string, { best: number, optional: number }>, tutorial: boolean }} */
export function loadProgress() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === 'object' && p.done) return { done: p.done, tutorial: !!p.tutorial };
  } catch { /* blocked or broken */ }
  return { done: {}, tutorial: false };
}

function saveProgress(p) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}

/** Mission completed: remember best time (ticks) and fulfilled side goals. */
export function recordWin(id, ticks, optional = 0) {
  const p = loadProgress();
  if (id === 'tutorial') p.tutorial = true;
  else {
    const old = p.done[id];
    p.done[id] = { best: old ? Math.min(old.best, ticks) : ticks, optional: Math.max(old?.optional ?? 0, optional) };
  }
  saveProgress(p);
  return p;
}

/** Is a mission playable? The first always, otherwise if the previous one is done. */
export function isUnlocked(p, id) {
  const i = CAMPAIGN.findIndex((m) => m.id === id);
  if (i <= 0) return true;
  return !!p.done[CAMPAIGN[i - 1].id];
}

/** Ticks as mm:ss. */
export function formatTime(ticks) {
  const s = Math.floor(ticks / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
