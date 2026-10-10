// Library model: everything the player can play as one list of series, whether it is built in or comes from a
// source/server pack (src/net). Pure functions without Vue or network, so tests and the UI share them.
//
//   Series  = a story, a course row, a pack ... with levels, difficulty, play time and the player's status
//   Kinds   = 'first' (first steps), 'stories', 'code' (programming), the tabs of the library
//
// Status of a level: 'locked' | 'open' | 'running' (a save game exists) | 'done'.
// Button of a level: running -> "Weiterspielen", done -> "Nochmal spielen", open -> "Spielen", locked -> none.

import { CAMPAIGN, TUTORIAL_ID, getMission } from '../sim/missions/registry.js';
import { ADVENTURES, SCRIPT_MISSIONS, courseNumber } from '../sim/missions/levels/index.js';

export const KINDS = ['first', 'stories', 'code'];
export const DIFFICULTIES = ['easy', 'normal', 'hard'];
/** Play time buckets (minutes, upper bound excluded): under 30, 30-59, 60 and more. */
export const DURATIONS = [
  { id: 'short', max: 30 },
  { id: 'medium', min: 30, max: 60 },
  { id: 'long', min: 60 },
];
export const STATUSES = ['open', 'running', 'done'];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n) => ROMAN[n] ?? String(n);

/** Bucket id of a play time in minutes, or null if unknown. */
export function durationOf(minutes) {
  if (!Number.isFinite(minutes)) return null;
  return DURATIONS.find((d) => (d.min === undefined || minutes >= d.min) && (d.max === undefined || minutes < d.max))?.id ?? null;
}

/** Which button a level row shows. @param {string} state */
export const actionOf = (state) => (state === 'running' ? 'continue' : state === 'done' ? 'again' : state === 'open' ? 'play' : null);

/**
 * @typedef {Object} Level
 * @property {string} id
 * @property {{de:string,en:string}|string} title
 * @property {any} [summary]
 * @property {'locked'|'open'|'running'|'done'} state
 * @property {string} [label] chapter / mission number ("III", "I.2")
 * @property {number} [best] best time in ticks
 * @property {'easy'|'normal'|'hard'} [difficulty]
 * @property {number} [minutes]
 * @property {string} [lockReason] i18n key
 */

/**
 * @typedef {Object} Series
 * @property {string} id
 * @property {'first'|'stories'|'code'} kind
 * @property {any} title bilingual text
 * @property {any} [summary]
 * @property {'easy'|'normal'|'hard'} [difficulty]
 * @property {number} [minutes]
 * @property {string} [added]
 * @property {'builtin'|'pack'} source
 * @property {'open'|'locked'} access
 * @property {Level[]} levels built in: all levels; packs: filled in when opened
 * @property {number} count number of levels
 * @property {number} doneCount
 * @property {'open'|'running'|'done'} status
 * @property {any} [entry] catalog entry (packs)
 */

function levelState(id, { done, running, unlocked = true }) {
  if (running.has(id)) return 'running';
  if (done[id]) return 'done';
  return unlocked ? 'open' : 'locked';
}

function summarize(series) {
  const levels = series.levels;
  const doneCount = levels.filter((l) => l.state === 'done').length;
  const running = levels.some((l) => l.state === 'running');
  return { ...series, count: levels.length, doneCount, status: running || (doneCount > 0 && doneCount < levels.length) ? 'running' : doneCount === levels.length && levels.length ? 'done' : 'open' };
}

const mk = (def, ctx, extra = {}) => ({
  id: def.id,
  title: def.title,
  summary: def.summary ?? undefined,
  state: levelState(def.id, { done: ctx.progress.done, running: ctx.running, ...extra }),
  best: ctx.progress.done[def.id]?.best,
  difficulty: def.difficulty ?? undefined,
  minutes: def.minutes ?? undefined,
  ...extra,
});

/** Sum of the known play times, or undefined if no level has one. */
const sumMinutes = (levels) => { const m = levels.map((l) => l.minutes).filter(Number.isFinite); return m.length ? m.reduce((a, b) => a + b, 0) : undefined; };
/** Difficulty of a series: the average of its levels, rounded. */
function averageDifficulty(levels) {
  const r = levels.map((l) => DIFFICULTIES.indexOf(l.difficulty)).filter((i) => i >= 0);
  return r.length ? DIFFICULTIES[Math.round(r.reduce((a, b) => a + b, 0) / r.length)] : undefined;
}

/**
 * The built-in series.
 * @param {{ progress: { done: Record<string, { best: number }>, tutorial?: boolean }, running?: Set<string>, t: (key: string, params?: any, lang?: string) => string,
 *   unlocked: (progress: any, id: string) => boolean }} ctx running: ids of missions with a save game
 * @returns {Series[]}
 */
export function builtinSeries({ progress, running = new Set(), t, unlocked }) {
  const both = (key, params) => ({ de: t(key, params, 'de'), en: t(key, params, 'en') });
  const c = { progress: { ...progress, done: { ...progress.done, ...(progress.tutorial ? { [TUTORIAL_ID]: { best: 0 } } : {}) } }, running };
  /** @type {Series[]} */
  const out = [];
  const series = (s) => out.push(summarize({ source: 'builtin', access: 'open', ...s, difficulty: s.difficulty ?? averageDifficulty(s.levels), minutes: s.minutes ?? sumMinutes(s.levels) }));

  const tdef = getMission(TUTORIAL_ID);
  const tutorial = tdef ? mk(tdef, c) : null;
  if (tutorial) series({ id: 'first-steps', kind: 'first', title: both('lib.series.first'), summary: both('lib.series.firstSub'), levels: [tutorial] });

  series({
    id: 'campaign', kind: 'stories', title: both('lib.series.campaign'), summary: both('lib.series.campaignSub'),
    levels: CAMPAIGN.map((m, i) => ({ ...mk(m, c, { unlocked: unlocked(progress, m.id) }), label: roman(i + 1), lockReason: 'lib.lock.previous' })),
  });

  const rows = new Map();
  for (const a of ADVENTURES) {
    const no = courseNumber(a.id);
    const row = no?.row ?? 0;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push({ ...mk(a, c), label: no?.label ?? '' });
  }
  for (const [row, levels] of [...rows].sort((a, b) => a[0] - b[0])) {
    series({
      id: row ? `course-${row}` : 'adventures', kind: 'code',
      title: row ? both('adv.row', { n: roman(row), title: t(`adv.row${row}`) }) : both('lib.series.adventures'),
      summary: both('lib.series.courseSub'), levels,
    });
  }
  if (SCRIPT_MISSIONS.length) {
    series({ id: 'script-missions', kind: 'code', title: both('adv.missions'), summary: both('lib.series.scriptSub'), levels: SCRIPT_MISSIONS.map((m) => mk(m, c)) });
  }
  return out;
}

/**
 * Series from catalog entries (packs of sources and the server). The levels come later, when a pack is opened.
 * @param {Array<any>} entries catalog entries @param {{ done: Record<string, any> }} d loadDone() of src/net/progress.js ("<pack>/<level>")
 * @param {Set<string>} [running] ids of missions with a save game
 * @returns {Series[]}
 */
export function packSeries(entries, doneKeys = {}, running = new Set()) {
  return entries.map((e) => {
    const done = Object.keys(doneKeys).filter((k) => k.startsWith(`${e.id}/`)).length;
    const count = e.levels ?? 0;
    const anyRunning = [...running].some((id) => id.startsWith?.(`${e.id}/`));
    return {
      id: e.id, kind: KINDS.includes(e.kind) ? e.kind : 'stories', title: e.title, summary: e.summary, difficulty: e.difficulty, minutes: e.minutes, added: e.added,
      source: 'pack', access: e.access, link: e.link, own: !!e.own, preview: e.preview ?? null, levels: [], count, doneCount: done, entry: e,
      status: anyRunning || (done > 0 && done < count) ? 'running' : count && done >= count ? 'done' : 'open',
    };
  });
}

/**
 * Filter by kind, difficulty, play time, status and search text; entries without a value for an active filter drop out.
 * @param {Series[]} list
 * @param {{ kind?: string, difficulty?: string[], duration?: string[], status?: string[], query?: string }} f
 * @param {(x: any) => string} text resolves a bilingual text
 */
export function filterSeries(list, f = {}, text = (x) => (typeof x === 'string' ? x : x?.de ?? '')) {
  const q = (f.query ?? '').trim().toLowerCase();
  return list.filter((s) => {
    if (f.kind && f.kind !== 'all' && s.kind !== f.kind) return false;
    if (f.difficulty?.length && !f.difficulty.includes(s.difficulty)) return false;
    if (f.duration?.length && !f.duration.includes(durationOf(s.minutes))) return false;
    if (f.status?.length && !f.status.includes(s.status)) return false;
    if (q && !`${text(s.title)} ${text(s.summary)}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Counts per kind for the tabs (after the other filters). @param {Series[]} list */
export function countByKind(list) {
  const out = { all: list.length };
  for (const k of KINDS) out[k] = list.filter((s) => s.kind === k).length;
  return out;
}

/** Counts per value of one filter group, without applying that group itself. */
export function facetCounts(list, f, group, values) {
  const without = { ...f, [group]: [] };
  const base = filterSeries(list, without);
  const get = { difficulty: (s) => s.difficulty, duration: (s) => durationOf(s.minutes), status: (s) => s.status }[group];
  return Object.fromEntries(values.map((v) => [v, base.filter((s) => get(s) === v).length]));
}

/**
 * Sort: recommended = running first, then new, then open, done last; stable within the groups (built-in order, then packs).
 * @param {Series[]} list @param {(s: Series) => boolean} isNew
 */
export function sortRecommended(list, isNew = () => false) {
  const rank = (s) => (s.access === 'locked' ? 4 : s.status === 'running' ? 0 : isNew(s) ? 1 : s.status === 'open' ? 2 : 3);
  return list.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}

/**
 * The level the big button of a series points to: the running one, otherwise the first open one, otherwise the first.
 * @param {Level[]} levels @returns {Level|null}
 */
export function nextLevel(levels) {
  return levels.find((l) => l.state === 'running') ?? levels.find((l) => l.state === 'open') ?? levels.find((l) => l.state === 'done') ?? null;
}

/**
 * Where a mission id belongs, for the saves list and the "continue" card: series, kind, level label.
 * Built-in missions only; null for everything else (pack levels, own levels).
 * @param {string|null} id @param {Series[]} series
 */
export function locate(id, series) {
  for (const s of series) {
    const level = s.levels.find((l) => l.id === id);
    if (level) return { series: s, level, index: s.levels.indexOf(level) };
  }
  return null;
}

/**
 * "Weiterspielen" target: the newest save game of each mission id.
 * @param {Array<{ mission: string|null, savedAt: string }>} entries @returns {Map<string, any>}
 */
export function latestByMission(entries) {
  const out = new Map();
  for (const e of entries) {
    if (!e.mission) continue;
    const old = out.get(e.mission);
    if (!old || String(e.savedAt) > String(old.savedAt)) out.set(e.mission, e);
  }
  return out;
}

/** Relative time as key + number: { key: 'time.now'|'time.min'|'time.hour'|'time.day'|'time.date', n } */
export function ago(iso, now = Date.now()) {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || Date.parse(iso) === 0) return { key: 'time.unknown', n: 0 };
  const min = Math.floor(ms / 60_000);
  if (min < 1) return { key: 'time.now', n: 0 };
  if (min < 60) return { key: 'time.min', n: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { key: 'time.hour', n: h };
  const d = Math.floor(h / 24);
  if (d < 30) return { key: 'time.day', n: d };
  return { key: 'time.date', n: 0 };
}

/**
 * What a save game is, in the player's words: kind, title and a second line.
 * @param {{ mode: string, mission: string|null, seed: number, players: number, name: string, tick: number, auto?: boolean }} e save entry
 * @param {Series[]} series built-in series
 * @param {{ t: (key: string, params?: any) => string, tr: (x: any) => string, defaultName: (e: any) => string }} io
 * @returns {{ kind: 'stories'|'code'|'first'|'free'|'level', title: string, subtitle: string, custom: boolean }}
 */
export function describeSave(e, series, { t, tr, defaultName }) {
  let d;
  if (e.mode === 'mission') {
    const loc = locate(e.mission, series);
    if (loc) {
      const lvl = tr(loc.level.title);
      const label = loc.series.kind === 'stories' ? t('lib.chapter', { n: loc.level.label }) : loc.series.kind === 'code' && loc.level.label ? t('adv.lesson', { n: loc.level.label }) : '';
      d = { kind: loc.series.kind, title: tr(loc.series.title), subtitle: [label, lvl].filter(Boolean).join(' · ') };
    } else d = { kind: 'level', title: e.name, subtitle: '' };
  } else {
    const n = Math.max(0, (e.players ?? 1) - 1);
    d = { kind: 'free', title: t('sv.kind.free'), subtitle: t(n === 0 ? 'sv.free.sub0' : n === 1 ? 'sv.free.sub1' : 'sv.free.sub', { n, seed: e.seed }) };
  }
  // A name the player typed himself replaces the title; the default name only repeats the details
  const custom = !e.auto && !!e.name && e.name !== defaultName(e) && d.kind !== 'level';
  return custom ? { kind: d.kind, title: e.name, subtitle: [d.title, d.subtitle].filter(Boolean).join(' · '), custom } : { ...d, custom: false };
}
