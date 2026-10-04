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
