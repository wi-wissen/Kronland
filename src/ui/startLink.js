// Start links: game start as an address (?seed=…&ai=…, ?mission=…, ?level=<address of a .zip or level folder>).
// Pure functions without browser access,
// so Vitest can check the round trip. A link always describes only the START of a map
// (seed, opponent, hero, fog or mission), never the running game. See docs/ARCHITEKTUR.md#url-parameter.
import { HERO_IDS } from '../sim/data/units.js';

/** Largest seed in the link (integer, positive; the start menu offers 1–999999). */
export const MAX_SEED = 2147483647;

const DIFFICULTIES = ['easy', 'normal', 'hard'];
const FOG_OFF = ['off', '0', 'no', 'false'];
/** Parameters that only concern rendering/debugging: they stay in the address bar, never in the shared link. */
export const LOCAL_PARAMS = ['quality', 'nature', 'dev', 'debug', 'no-models', 'config'];

/**
 * @typedef {{ kind: 'free', seed: number, difficulty: 'easy'|'normal'|'hard', players: number, hero: string, fog: boolean }} FreeStart
 * @typedef {{ kind: 'mission', id: string, seed?: number }} MissionStart
 * @typedef {{ kind: 'level', url: string }} LevelStart a level from another server (.zip or folder)
 * @typedef {FreeStart | MissionStart | LevelStart} Start
 */

/** Address of a level in a link: http(s) or a path on this site, at most 2000 characters. */
export function cleanLevelUrl(v) {
  const s = String(v ?? '').trim();
  if (!s || s.length > 2000) return undefined;
  if (/^[a-z][\w+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return undefined;
  return s;
}

/** Integer seed 1…MAX_SEED or undefined. @param {any} v */
export function cleanSeed(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 1 && n <= MAX_SEED ? n : undefined;
}

/**
 * Bring the start of a free game to valid values (unknown/invalid → default).
 * @param {any} o @returns {FreeStart}
 */
export function normalizeFree(o = {}) {
  const players = Math.trunc(Number(o.players));
  return {
    kind: 'free',
    seed: cleanSeed(o.seed) ?? 1,
    difficulty: DIFFICULTIES.includes(o.difficulty) ? o.difficulty : 'normal',
    players: Number.isFinite(players) ? Math.min(4, Math.max(2, players)) : 2,
    hero: HERO_IDS.includes(o.hero) ? o.hero : HERO_IDS[0],
    fog: o.fog !== false,
  };
}

/**
 * Canonical query (without "?") for a game start.
 * Free game: seed, ai, players, hero always; fog=off only without fog. Mission: mission, seed only if it
 * differs from the mission's fixed seed (the caller passes it in that case).
 * @param {Start} start
 */
export function buildStartLink(start) {
  if (start?.kind === 'level') return new URLSearchParams({ level: start.url }).toString();
  if (start?.kind === 'mission') {
    const q = new URLSearchParams({ mission: String(start.id) });
    const seed = cleanSeed(start.seed);
    if (seed !== undefined) q.set('seed', String(seed));
    return q.toString();
  }
  const f = normalizeFree(start);
  const q = new URLSearchParams({ seed: String(f.seed), ai: f.difficulty, players: String(f.players), hero: f.hero });
  if (!f.fog) q.set('fog', 'off');
  return q.toString();
}

/**
 * Read the query. Result null: no direct start (normal start menu).
 * Unknown mission without seed → null; unknown mission with seed → free game with this seed.
 * @param {string|URLSearchParams} search e.g. location.search
 * @param {{ hasMission?: (id: string) => boolean }} [opts]
 * @returns {(Start & { noAssets: boolean }) | null}
 */
export function parseStartLink(search, { hasMission = () => true } = {}) {
  let q;
  try { q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search ?? '')); } catch { return null; }
  const noAssets = q.has('no-models');
  const level = cleanLevelUrl(q.get('level'));
  if (level) return { kind: 'level', url: level, noAssets };
  const id = q.get('mission');
  if (id && hasMission(id)) {
    const seed = cleanSeed(q.get('seed'));
    return { kind: 'mission', id, ...(seed !== undefined ? { seed } : {}), noAssets };
  }
  if (!q.has('seed')) return null;
  const fog = q.get('fog');
  return {
    ...normalizeFree({
      seed: q.get('seed'),
      difficulty: q.get('ai') ?? undefined,
      players: q.get('players') ?? undefined,
      hero: q.get('hero') ?? undefined,
      fog: fog === null ? true : !FOG_OFF.includes(fog.trim().toLowerCase()),
    }),
    noAssets,
  };
}

/**
 * Address bar for a game start: canonical query plus the local parameters of the previous address
 * (graphics level, developer mode …), so a reload keeps the same setting.
 * @param {string} pathname @param {string} oldSearch @param {string|null} link canonical query or null (no link)
 */
export function addressFor(pathname, oldSearch, link) {
  const old = new URLSearchParams(oldSearch ?? '');
  const q = new URLSearchParams(link ?? '');
  for (const k of LOCAL_PARAMS) if (old.has(k) && !q.has(k)) q.set(k, old.get(k));
  const s = q.toString().replace(/=(?=&|$)/g, '');
  return s ? `${pathname}?${s}` : pathname;
}

/**
 * Complete, shareable link to the game. base: address of the game page (resolved from siteUrl('play/')).
 * @param {string} base e.g. 'https://example.org/kronland/play/' @param {string} link canonical query
 */
export function shareUrl(base, link) {
  const u = new URL(base);
  u.search = link ? `?${link}` : '';
  u.hash = '';
  return u.toString();
}
