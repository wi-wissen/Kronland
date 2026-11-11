// "New" badge of the library: a pack counts as new while it was added recently (catalog field `added`, YYYY-MM-DD)
// and the player has not opened it yet. What was opened is remembered on this device (kv store 'seen').

/** How long after `added` a pack still counts as new (days). */
export const NEW_DAYS = 30;

const KEY = 'seen';
const DAY = 86_400_000;

/** Days from a YYYY-MM-DD date to `today` (also YYYY-MM-DD), or NaN if one of them is not a date. */
export function daysBetween(added, today) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(added ?? '') || !re.test(today ?? '')) return NaN;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${added}T00:00:00Z`)) / DAY);
}

/** Is `added` recent (not in the future, at most NEW_DAYS ago)? */
export function isRecent(added, today, days = NEW_DAYS) {
  const d = daysBetween(added, today);
  return d >= 0 && d <= days;
}

/** Today as YYYY-MM-DD (UTC). */
export const todayString = (now = new Date()) => now.toISOString().slice(0, 10);

/**
 * Does the entry carry the "New" badge: recently added and not opened yet?
 * @param {{ id: string, added?: string }} entry @param {Record<string, boolean>} seenIds @param {string} today
 */
export const isNewEntry = (entry, seenIds, today) => !!entry.added && !seenIds[entry.id] && isRecent(entry.added, today);

/**
 * Remembered ids of opened packs.
 * @param {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<void> }} kv
 * @param {Record<string, boolean>} [state] reactive object the UI reads (id -> true)
 */
export function createSeen(kv, state = {}) {
  return {
    state,
    /** Read the remembered ids. */
    async load() {
      try {
        const ids = await kv.get(KEY);
        if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') state[id] = true;
      } catch { /* nothing remembered: everything recent counts as new */ }
    },
    has: (id) => !!state[id],
    /** The player opened this entry. */
    async mark(id) {
      if (state[id]) return;
      state[id] = true;
      try { await kv.set(KEY, Object.keys(state)); } catch { /* kept in memory only */ }
    },
    /** @param {{ id: string, added?: string }} entry @param {string} today */
    isNew: (entry, today) => isNewEntry(entry, state, today),
  };
}
