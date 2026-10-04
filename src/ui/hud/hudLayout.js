// Pure helper functions for the game UI (without DOM, tested with Vitest).

/** Share of the diameter taken up by the longer map edge in the round minimap.
 *  Slightly more than the inscribed square (0.707): only the outermost corners (mostly water) lie under the frame. */
export const MAP_FILL = 0.86;

/**
 * Fit the map (w × h tiles) centred into a round area of diameter d (pixels).
 * @returns {{ s: number, ox: number, oy: number, w: number, h: number }} scale and offset
 */
export function fitRound(d, w, h, fill = MAP_FILL) {
  const s = (d * fill) / Math.max(1, w, h);
  return { s, ox: (d - w * s) / 2, oy: (d - h * s) / 2, w, h };
}

/** Pixel in the minimap → tile coordinate (clamped to the map). */
export function toTile(m, px, py) {
  const x = (px - m.ox) / m.s, y = (py - m.oy) / m.s;
  return { x: Math.max(0, Math.min(m.w, x)), y: Math.max(0, Math.min(m.h, y)) };
}

/**
 * Build menu without tabs: build options by group in fixed order, empty groups are dropped.
 * @param {{ type: string, category: string }[]} options
 * @param {string[]} categories
 */
export function groupBuildOptions(options, categories) {
  return categories
    .map((id) => ({ id, items: options.filter((o) => o.category === id) }))
    .filter((g) => g.items.length);
}

/**
 * Which resources are missing for the cost (for the red marking in the top bar).
 * @param {[string, number][]|null} cost
 * @param {Record<string, number>} have
 * @returns {Record<string, number>} resource → required amount, only missing ones
 */
export function missing(cost, have) {
  const out = {};
  for (const [r, n] of cost ?? []) if (n > (have[r] ?? 0)) out[r] = n;
  return out;
}

/** Icon for a selection (portrait, head of the command panel). */
export function selectionIcon(s) {
  if (!s) return 'crown';
  if (s.kind === 'building') return 'b-' + s.type;
  if (s.kind === 'serfs') return 'serf';
  if (s.kind === 'army') return s.heroes.length && !s.groups.length ? 'hero-' + s.heroes[0].hero : s.groups.length ? 'u-' + s.groups[0].line : 'militia';
  if (s.kind === 'foreign') {
    if (s.entity === 'ruin') return 'fire';
    if (s.hero) return 'hero-' + s.hero;
    if (s.entity === 'leader' && s.unit) return 'u-' + s.unit.replace(/\d+$/, '');
    return s.entity === 'worker' ? 'worker' : s.entity === 'unit' ? 'serf' : 'skull';
  }
  return 'info';
}

/** Painted portrait (public/portraits/) for own serfs and workers, otherwise null (then icon). */
export function selectionPortrait(s, base = '/') {
  if (!s) return null;
  if (s.kind === 'serfs') return base + 'portraits/serf.webp';
  if (s.kind === 'foreign' && s.owner === 0 && s.entity === 'worker') return base + 'portraits/worker.webp';
  return null;
}

/** Common word endings of German building names: a narrow tile may break there. */
const TAILS = ['gießerei', 'kraftwerk', 'macherei', 'macher', 'zentrum', 'schule', 'hütte', 'mühle', 'grube', 'platz', 'turm', 'haus', 'hof', 'werk', 'lager', 'rad'];

/**
 * Insert soft hyphens (U+00AD) into long words at word joints so names wrap cleanly in narrow
 * tiles ("Lehm-grube" instead of "Lehmgrub-e"). Short words stay unchanged.
 */
export function softHyphens(name, min = 9) {
  return name.split(' ').map((w) => {
    if (w.length < min || w.includes('\u00ad')) return w;
    const lw = w.toLowerCase();
    for (const t of TAILS) {
      const i = lw.lastIndexOf(t);
      if (i >= 3 && i + t.length === lw.length) return w.slice(0, i) + '\u00ad' + w.slice(i);
    }
    return w;
  }).join(' ');
}
