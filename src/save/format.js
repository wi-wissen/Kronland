// Save format (file and save slot): a readable JSON envelope around the simulation state.
//
//   { format: 'kronland-save', formatVersion: 1, gameVersion: '1.0.0',
//     meta: { name, savedAt, tick, mode, mission, seed, players, fog }, state: { …saveGame() } }
//
// The envelope is deliberately separate from the simulation state (src/sim/serialize.js): meta serves the
// list and the file name, state is what the simulation needs. Older formats are lifted step by step to the
// current formatVersion via MIGRATIONS when read.

import { version as GAME_VERSION } from '../../package.json';
import { loadGame, SAVE_VERSION } from '../sim/serialize.js';
import { getMission, CAMPAIGN, TUTORIAL_ID } from '../sim/missions/registry.js';
import { tr } from '../i18n/index.js';
import { SCENARIO_VERSION } from '../sim/scripting/scenario.js';

export const FORMAT = 'kronland-save';
export const FORMAT_VERSION = 1;
export { GAME_VERSION };
/** Largest import file (bytes). Real saves are 0.2–2 MB. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

/** Error with i18n key (saves.err.*) and placeholders for the message. */
export class SaveError extends Error {
  /** @param {string} code i18n key @param {Record<string, any>} [params] @param {unknown} [cause] */
  constructor(code, params = {}, cause = undefined) {
    super(code);
    this.name = 'SaveError';
    this.code = code;
    this.params = params;
    if (cause) this.cause = cause;
  }
}

/**
 * @typedef {Object} SaveMeta
 * @property {string} name display name
 * @property {string} savedAt ISO timestamp
 * @property {number} tick game time in ticks (100 ms)
 * @property {'free'|'mission'} mode
 * @property {string|null} mission mission ID
 * @property {number} seed
 * @property {number} players
 * @property {boolean} fog
 */

/**
 * Read metadata from a simulation state (saveGame()).
 * @param {any} state @returns {Omit<SaveMeta, 'name'|'savedAt'>}
 */
export function describeState(state) {
  return {
    tick: state.tick | 0,
    mode: state.mission ? 'mission' : 'free',
    mission: state.mission?.id ?? null,
    seed: state.seed,
    players: state.players?.length ?? 0,
    fog: !!state.vision?.enabled,
  };
}

/** Game time (ticks) as h:mm:ss or m:ss. */
export function playTime(ticks) {
  const s = Math.max(0, Math.floor(ticks / 10));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Short label of the game mode: "Mission 2", "Tutorial", "Free game seed 42".
 * @param {{ mode: string, mission: string|null, seed: number }} meta
 * @param {(key: string, params?: any) => string} t
 */
export function modeLabel(meta, t) {
  if (meta.mode === 'mission') {
    if (meta.mission === TUTORIAL_ID) return t('saves.mode.tutorial');
    const no = CAMPAIGN.findIndex((m) => m.id === meta.mission);
    return no >= 0 ? t('saves.mode.mission', { n: no + 1 }) : t('saves.mode.missionId', { id: meta.mission });
  }
  return t('saves.mode.free', { seed: meta.seed });
}

/** Suggestion for the name of a new save game: "Mission 2 – 0:42:10". */
export const defaultSaveName = (meta, t) => `${modeLabel(meta, t)} – ${playTime(meta.tick)}`;

/**
 * Build an envelope around a simulation state.
 * @param {any} state result of saveGame()
 * @param {{ name: string, savedAt?: Date|string }} info
 */
export function createSaveDoc(state, { name, savedAt = new Date() }) {
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    gameVersion: GAME_VERSION,
    meta: { name: String(name), savedAt: new Date(savedAt).toISOString(), ...describeState(state) },
    state,
  };
}

/**
 * Migrations: MIGRATIONS[v] lifts a document from format version v to v + 1.
 * Version 0 is the earlier "bare" save game (only saveGame(), without envelope), as it was stored up to
 * phase 9 under localStorage 'kronland-save-1'.
 * New format version: raise FORMAT_VERSION, add MIGRATIONS[old version], write a test.
 * @type {Record<number, (doc: any) => any>}
 */
export const MIGRATIONS = {
  0: (state) => ({
    format: FORMAT,
    formatVersion: 1,
    gameVersion: 'unknown',
    meta: { name: '', savedAt: new Date(0).toISOString(), ...describeState(state) },
    state,
  }),
};

/** Determine the format version of a parsed object (throws on foreign data). */
export function detectVersion(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new SaveError('saves.err.wrongFormat');
  if (doc.format === FORMAT) {
    const v = doc.formatVersion;
    if (!Number.isInteger(v) || v < 1) throw new SaveError('saves.err.broken', { detail: 'formatVersion' });
    return v;
  }
  // Old save without envelope
  if (doc.format === undefined && isInt(doc.version) && doc.version >= 1 && doc.map && Array.isArray(doc.entities)) return 0;
  throw new SaveError('saves.err.wrongFormat');
}

/**
 * Lift to the current format version.
 * @param {any} doc @param {Record<number, (d: any) => any>} [migrations] (replaceable for tests)
 * @param {number} [target]
 */
export function migrate(doc, migrations = MIGRATIONS, target = FORMAT_VERSION) {
  let v = detectVersion(doc);
  if (v > target) throw new SaveError('saves.err.newer', { v, max: target, game: doc.gameVersion ?? '?' });
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new SaveError('saves.err.broken', { detail: `migration ${v}` });
    doc = step(doc);
    if (doc?.formatVersion !== v + 1) throw new SaveError('saves.err.broken', { detail: `migration ${v}` });
    v++;
  }
  return doc;
}

const isInt = (n) => Number.isInteger(n);
const isStr = (s) => typeof s === 'string';

/**
 * Check the structure (after migrate). Throws SaveError('saves.err.broken', { detail }) with the first error.
 * Only checks what is needed for loading; whether the simulation really starts from it is shown by checkLoadable().
 */
export function validateDoc(doc) {
  const fail = (detail) => { throw new SaveError('saves.err.broken', { detail }); };
  if (!doc.meta || typeof doc.meta !== 'object') fail('meta');
  const s = doc.state;
  if (!s || typeof s !== 'object') fail('state');
  // Saves from an older game version (e.g. with the earlier heroes) can no longer be continued
  if (isInt(s.version) && s.version < SAVE_VERSION) throw new SaveError('saves.err.outdated');
  if (s.version !== SAVE_VERSION) fail('state.version');
  if (!isInt(s.tick) || s.tick < 0) fail('state.tick');
  if (!isInt(s.seed)) fail('state.seed');
  if (!isInt(s.nextId)) fail('state.nextId');
  if (s.rng === undefined || s.rng === null) fail('state.rng');
  const m = s.map;
  if (!m || !isInt(m.width) || !isInt(m.height) || m.width < 8 || m.height < 8 || m.width > 1024 || m.height > 1024) fail('state.map');
  for (const k of ['heights', 'flags', 'owner']) if (!isStr(m[k])) fail('state.map.' + k);
  if (!Array.isArray(s.players) || s.players.length < 1 || s.players.length > 8) fail('state.players');
  for (const p of s.players) if (!p || typeof p !== 'object' || !p.stock || !Array.isArray(p.techs)) fail('state.players');
  if (!Array.isArray(s.entities)) fail('state.entities');
  for (const e of s.entities) if (!e || !isInt(e.id) || !isStr(e.kind)) fail('state.entities');
  if (s.mission && !getMission(s.mission.id)) throw new SaveError('saves.err.unknownMission', { id: String(s.mission.id) });
  // A mission that moved from a mission file into a level folder (Python): old saves carry no scenario to go on with
  const def = s.mission ? getMission(s.mission.id) : null;
  if (def?.scenario && !s.mission.scenario && !s.mission.custom) throw new SaveError('saves.err.missionChanged', { title: tr(def.title) });
  // A level of an older scenario format (version 1: text table) cannot go on
  const sc = s.mission?.scenario;
  if (sc && sc.version !== SCENARIO_VERSION) throw new SaveError('saves.err.missionChanged', { title: tr(sc.title ?? def?.title ?? String(s.mission.id)) });
  return doc;
}

/** Trial load: finds broken map data (Base64), missing fields etc. */
export function checkLoadable(doc) {
  try { loadGame(doc.state); } catch (e) {
    if (e instanceof SaveError) throw e;
    throw new SaveError('saves.err.broken', { detail: String(e?.message ?? e).slice(0, 80) }, e);
  }
  return doc;
}

/**
 * Read the text of a file or save slot: JSON → migration → check.
 * @param {string} text
 * @param {string} text @param {{ deep?: boolean }} [opts] deep: additionally trial load (on import)
 */
export function parseSaveText(text, { deep = false } = {}) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new SaveError('saves.err.notJson', {}, e); }
  const doc = validateDoc(migrate(raw));
  if (!isStr(doc.meta.name)) doc.meta.name = '';
  if (!isStr(doc.meta.savedAt) || Number.isNaN(Date.parse(doc.meta.savedAt))) doc.meta.savedAt = new Date(0).toISOString();
  // Always refresh metadata from the state (hand-edited files should not confuse the list)
  Object.assign(doc.meta, describeState(doc.state));
  return deep ? checkLoadable(doc) : doc;
}

/**
 * As JSON text: readable (indented, good for teaching) or compact.
 * @param {any} doc @param {{ compact?: boolean }} [opts]
 */
export function stringifyDoc(doc, { compact = false } = {}) {
  return compact ? JSON.stringify(doc) : JSON.stringify(doc, null, 2) + '\n';
}

/**
 * File name for the export: kronland-<name>-<YYYY-MM-DD>.json
 * @param {string} name @param {Date} [date]
 */
export function exportFileName(name, date = new Date()) {
  const slug = String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/g, '') || 'savegame';
  const pad = (n) => String(n).padStart(2, '0');
  return `kronland-${slug}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
