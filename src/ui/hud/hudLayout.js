// Pure helper functions for the game UI (without DOM, tested with Vitest).
import { PORTRAITS } from '../icons/index.js';
import { assetPath } from '../../paths.js';
import { sexKey } from '../../i18n/index.js';

/** Share of the side length taken up by the longer map edge in the minimap. The minimap is square
 *  like the map (only slightly rounded corners), so the map fills it completely – nothing lies under the frame. */
export const MAP_FILL = 1;

/** Corner radius of the minimap as a share of the side length (matches --r-lg of the panels). */
export const MAP_CORNER = 0.06;

/**
 * Fit the map (w × h tiles) centred into a square area with side length d (pixels).
 * @returns {{ s: number, ox: number, oy: number, w: number, h: number }} scale and offset
 */
export function fitMap(d, w, h, fill = MAP_FILL) {
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
 * Do the groups of the two-row build menu wrap into a further line? (measured tops of the groups in px)
 * @param {number[]} tops
 */
export function groupsWrap(tops) {
  return tops.some((t) => Math.abs(t - tops[0]) > 2);
}

/**
 * Layout of the build menu: 'wide' = all groups in two tile rows side by side (large screens),
 * 'tabs' = one tab per group with only its buildings (medium widths where they would wrap, phone).
 * Not measured yet (wraps = null) counts as wide so it can be measured.
 * @param {{ compact: boolean, wraps: boolean|null }} o
 * @returns {'wide'|'tabs'}
 */
export function buildMenuLayout({ compact, wraps }) {
  if (compact) return 'tabs';
  return wraps ? 'tabs' : 'wide';
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

/** Professions with their own portrait per sex (scripts/portraits.py: worker-<profession>.webp, worker-<profession>-f.webp). */
export const WORKER_PORTRAITS = ['farmer', 'scholar', 'miner', 'brickmaker', 'sawyer', 'mason', 'smith', 'alchemist', 'treasurer', 'priest', 'trader', 'weatherman'];

/**
 * Sex of a serf selection for the portrait: all the same → that one, mixed → the majority
 * (tie: male). The title names mixed groups in the plural ("3 serfs").
 * @param {{ count: number, female?: number, sex?: 'm'|'f'|null }} s
 */
export function serfsSex(s) {
  if (s.sex) return s.sex;
  return (s.female ?? 0) * 2 > s.count ? 'f' : 'm';
}

/**
 * Painted portrait (public/portraits/) for heroes, own serfs and workers, otherwise null (then icon).
 * Serfs and workers matching the sex of the drawn figure (s.sex, see Engine.sexOf).
 */
export function selectionPortrait(s, base = '/') {
  if (!s) return null;
  const hero = s.kind === 'army' && s.heroes.length && !s.groups.length ? s.heroes[0].hero : s.kind === 'foreign' ? s.hero : null;
  if (hero && PORTRAITS[`hero-${hero}`]) return base + assetPath(PORTRAITS[`hero-${hero}`]);
  if (s.kind === 'serfs') return base + assetPath(serfsSex(s) === 'f' ? 'portraits/serf-f.webp' : 'portraits/serf.webp');
  if (s.kind === 'foreign' && s.owner === 0 && s.entity === 'worker') {
    const f = s.sex === 'f' ? '-f' : '';
    return base + assetPath(WORKER_PORTRAITS.includes(s.prof) ? `portraits/worker-${s.prof}${f}.webp` : 'portraits/worker.webp');
  }
  return null;
}

/**
 * Title of a serf selection: a single figure by sex ("1 serf"), several in the plural
 * ("3 serfs" – also for mixed groups).
 */
export function serfsTitle(s, t) {
  return s.count === 1 ? t(sexKey('serfs.one', s.sex)) : t('serfs.count', { n: s.count });
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

/** From this amount the resource bar shows short forms ("50k"); the exact value is given by the tooltip. */
export const SHORT_AMOUNT = 10000;

/**
 * Amount in short form for the resource bar: unchanged below `limit`, above it with thousand/million abbreviation.
 * It is rounded down (never show more than available): 12 345 → "12.3k", 50 000 → "50k", 123 456 → "123k".
 * @param {number} n
 * @param {{ limit?: number, dec?: string, k?: string, m?: string }} [o] decimal separator and abbreviations (from i18n)
 */
export function shortAmount(n, { limit = SHORT_AMOUNT, dec = ',', k = 'k', m = 'M' } = {}) {
  const v = Math.floor(Number(n) || 0);
  if (Math.abs(v) < limit) return String(v);
  const sign = v < 0 ? '-' : '', a = Math.abs(v);
  const [unit, sfx] = a >= 1e6 ? [1e6, m] : [1e3, k];
  const x = a / unit;
  // below 100 one decimal place (rounded down), otherwise whole number; ",0" is dropped
  const body = x < 100 ? String(Math.floor(x * 10) / 10) : String(Math.floor(x));
  return sign + body.replace('.', dec) + sfx;
}

/**
 * Width of the resource bar in pixels if its entries are distributed over `rows` rows
 * (row by row as in the CSS grid, the widest entry counts per column).
 * @param {number[]} widths width of the individual entries
 * @param {number} gap gap between the entries
 * @param {number} pad inner padding left + right
 */
export function resBarWidth(widths, gap, pad, rows = 1) {
  const cols = Math.ceil(widths.length / rows);
  let w = pad + gap * Math.max(0, cols - 1);
  for (let c = 0; c < cols; c++) {
    let max = 0;
    for (let r = 0; r < rows; r++) max = Math.max(max, widths[r * cols + c] ?? 0);
    w += max;
  }
  return w;
}

/**
 * Arrangement of the top bar on desktop: the crest should stand exactly centred in the same row.
 * 'one' – resources in one row; 'two' – resources in two rows so the crest stays in the row;
 * 'tight' – even that is not enough, the crest gets its own row.
 * @param {{ widths: number[], gap: number, pad: number, sys: number, crest: number, barGap: number, width: number }} m
 * @returns {'one'|'two'|'tight'}
 */
export function topbarMode({ widths, gap, pad, sys, crest, barGap, width }) {
  const fits = (res) => 2 * Math.max(res, sys) + crest + 2 * barGap <= width;
  if (fits(resBarWidth(widths, gap, pad, 1))) return 'one';
  if (fits(resBarWidth(widths, gap, pad, 2))) return 'two';
  return 'tight';
}

/**
 * Text key of the diplomacy of a foreign selection (relationOf from src/game/relation.js), null for own
 * and nature. Bandits are called bandits, regardless of the diplomatic standing.
 * @param {{ rel: string, bandits?: boolean }|null|undefined} r
 */
export function relationKey(r) {
  if (!r) return null;
  if (r.bandits) return 'foreign.bandits';
  return { allied: 'foreign.ally', neutral: 'foreign.neutral', hostile: 'foreign.enemy' }[r.rel] ?? null;
}

/**
 * Display name of a foreign selection (hero, unit, serf …); t/name are $t and $name of the UI.
 * @param {any} s selection kind 'foreign'
 */
export function foreignName(s, t, name) {
  if (s.entity === 'ruin') return t('sys.ruin') + (s.type ? ' · ' + name.building(s.type, s.level ?? 0) : '');
  if (s.hero) return name.hero(s.hero);
  // a single figure by sex (s.sex): profession, troop type (singular) or serf
  if (s.entity === 'worker' && s.prof) return name.prof(s.prof, s.sex);
  if (s.entity === 'soldier' && s.figure) return t(sexKey('figure.' + s.figure, s.sex));
  if (s.unit) return name.unit(s.unit);
  return t(sexKey('foreign.' + (s.entity === 'unit' ? 'serf' : s.entity in { worker: 1, hero: 1, soldier: 1 } ? s.entity : 'unit'), s.sex));
}
