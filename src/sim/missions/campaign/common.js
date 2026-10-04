// Shorthands for mission files.

/** Bilingual text. */
export const t = (de, en) => ({ de, en });

/** Dialogue action. */
export const say = (speaker, de, en) => ({ type: 'dialog', speaker, text: { de, en } });

/** Furthest reachable settlement spot in the surroundings (for build-up missions). */
export function farSpot(ctx, minD, maxD) {
  const { sim, api } = ctx;
  const hq = ctx.hqCenter();
  let best = null, bd = -1;
  for (const s of sim.spots) {
    const d = api.dist(s, hq);
    if (d < minD || d > maxD || !sim.map.rectFree(s.x, s.y, 4, 4, 1 | 2)) continue;
    if (d > bd) { bd = d; best = s; }
  }
  return best;
}

/**
 * Free spot, reachable (from `o.from`), for a village or camp near `near`: searches first tightly with a lot of
 * free space, then further and with less free space (the maps differ strongly per seed).
 */
export function site(ctx, near, o = {}) {
  const { sim, api } = ctx;
  for (const [maxR, clear] of [[10, 3], [16, 3], [16, 2], [24, 2], [30, 1]]) {
    const p = api.findOpen(sim, near.x, near.y, { ...o, maxR, clear });
    if (p) return p;
  }
  return null;
}
