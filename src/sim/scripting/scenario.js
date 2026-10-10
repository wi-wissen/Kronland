// Scenarios: missions, coding adventures and self-built worlds in one common format.
// A level is a folder (scenario.json, .py files, assets/) or the same folder as a .zip; packed, every section
// carries its code. A scenario becomes a mission definition for the mission runtime (runtime.js);
// its Python sections are executed by the ScriptHost. Format: docs/SKRIPTE.md.

export const SCENARIO_FORMAT = 'kronland-scenario';
/** Current version: texts inline in Python, end rule in `end`, sections from files. Older versions do not load. */
export const SCENARIO_VERSION = 2;
/** How a level ends: by its objectives (all primary done, castle lost) or only by victory()/defeat(). */
export const END_RULES = ['objectives', 'script'];
/** Difficulty of a level (optional field `difficulty`; library filter). */
export const LEVEL_DIFFICULTIES = ['easy', 'normal', 'hard'];

import { assetPathOk } from '../../paths.js';
import { BALANCE } from '../data/balance.js';
import { scenarioGoals, scenarioSteps } from './outline.js';

/** Who leaves tracks (world.tracks.who): everyone, nobody (only tracks set by the mission) or only heroes. */
export const TRACK_WHO = ['all', 'none', 'heroes'];

/** Visibility of a section in the code panel. */
export const VISIBILITY = ['open', 'collapsed', 'hidden'];

/** Limits for scenarios from files and other people (map size, players, code length …). */
export const SCENARIO_LIMITS = { mapSize: 256, players: 8, sections: 32, code: 200_000, text: 4000, worlds: 6 };
const KEY_RE = /^[A-Za-z][\w-]{0,63}$/;
/** File name of a section in a level folder (no sub-folders). */
export const SECTION_FILE_RE = /^[A-Za-z][\w-]{0,63}\.py$/;
const isText = (v) => typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string'));
const textLength = (v) => (typeof v === 'string' ? v.length : Math.max(0, ...Object.values(v).map((x) => x.length)));

/**
 * Check a scenario. Returns a list of problems (empty = fine).
 * @param {any} s
 * @returns {string[]}
 */
export function validateScenario(s) {
  const out = [];
  if (!s || typeof s !== 'object') return ['not an object'];
  if (s.format !== SCENARIO_FORMAT) out.push(`format must be "${SCENARIO_FORMAT}"`);
  if (s.version !== SCENARIO_VERSION) out.push(`version ${s.version} is not supported`);
  if (s.end !== undefined && !END_RULES.includes(s.end)) out.push(`end must be ${END_RULES.join(' or ')}`);
  if (s.reset !== undefined && typeof s.reset !== 'boolean') out.push('reset must be true or false');
  if (s.difficulty !== undefined && !LEVEL_DIFFICULTIES.includes(s.difficulty)) out.push(`difficulty must be ${LEVEL_DIFFICULTIES.join(', ')}`);
  if (s.minutes !== undefined && !(Number.isInteger(s.minutes) && s.minutes >= 1 && s.minutes <= 6000)) out.push('minutes must be a whole number from 1 to 6000');
  if (typeof s.id !== 'string' || !/^[\w-]+$/.test(s.id)) out.push('id missing or contains invalid characters');
  if (!Array.isArray(s.players) || !s.players.length) out.push('players missing');
  else if (s.players[0].kind !== 'human') out.push('players[0] must be the human');
  else if (s.players.length > SCENARIO_LIMITS.players) out.push(`at most ${SCENARIO_LIMITS.players} players`);
  if (s.sections !== undefined && !Array.isArray(s.sections)) out.push('sections must be a list');
  if ((s.sections ?? []).length > SCENARIO_LIMITS.sections) out.push(`at most ${SCENARIO_LIMITS.sections} sections`);
  for (const k of ['title', 'summary', 'briefing', 'victoryText', 'defeatText']) if (s[k] !== undefined && s[k] !== null && !isText(s[k])) out.push(`${k} must be a text`);
  for (const k of ['victoryTexts', 'defeatTexts', 'debriefs']) {
    for (const [r, v] of Object.entries(s[k] ?? {})) if (!KEY_RE.test(r) || !isText(v) || textLength(v) > SCENARIO_LIMITS.text) out.push(`${k}.${r.slice(0, 40)} must be a text`);
  }
  const names = (v) => Array.isArray(v) && v.length <= 200 && v.every((x) => typeof x === 'string' && KEY_RE.test(x));
  if (s.available !== undefined && !(s.available && names(s.available.buildings ?? []) && names(s.available.techs ?? []))) out.push('available must list buildings and techs');
  if (s.shafts !== undefined && !names(s.shafts)) out.push('shafts must be a list of resources');
  const speakers = s.speakers ?? {};
  if (Object.keys(speakers).length > 100) out.push('at most 100 speakers');
  for (const [k, sp] of Object.entries(speakers)) {
    const ok = KEY_RE.test(k) && sp && typeof sp === 'object' && isText(sp.name ?? '')
      && (sp.portrait === undefined || (assetPathOk(sp.portrait) && /\.(png|jpe?g|webp)$/i.test(sp.portrait)))
      && (sp.color === undefined || /^#[0-9a-f]{6}$/i.test(sp.color));
    if (!ok) out.push(`speakers.${k.slice(0, 40)}: name, portrait (assets/….png) and color (#rrggbb)`);
  }
  for (const k of Object.keys(s.world?.places ?? {})) if (!KEY_RE.test(k)) out.push(`world.places: invalid name "${k.slice(0, 40)}"`);
  for (const k of ['width', 'height', 'size']) {
    const v = s.world?.[k];
    if (v !== undefined && !(Number.isInteger(v) && v >= 8 && v <= SCENARIO_LIMITS.mapSize)) out.push(`world.${k} must be 8…${SCENARIO_LIMITS.mapSize}`);
  }
  for (const [i, sec] of (s.sections ?? []).entries()) {
    if (typeof sec.id !== 'string') out.push(`sections[${i}].id missing`);
    if (sec.file !== undefined && !(typeof sec.file === 'string' && SECTION_FILE_RE.test(sec.file))) out.push(`sections[${i}].file must be a name like world.py`);
    if (typeof sec.code !== 'string') out.push(sec.file ? `sections[${i}]: file ${String(sec.file).slice(0, 40)} missing` : `sections[${i}].code missing`);
    else if (sec.code.length > SCENARIO_LIMITS.code) out.push(`sections[${i}].code too long`);
    if (sec.level && !['mission', 'player'].includes(sec.level)) out.push(`sections[${i}].level invalid`);
    if (sec.visibility && !VISIBILITY.includes(sec.visibility)) out.push(`sections[${i}].visibility invalid`);
  }
  const ids = (s.sections ?? []).map((x) => x.id);
  if (new Set(ids).size !== ids.length) out.push('duplicate section ids');
  out.push(...validateWorlds(s.worlds));
  const w = s.world ?? {};
  if (w.terrain && (!w.terrain.heights || !w.terrain.flags)) out.push('world.terrain incomplete');
  if (w.tracks !== undefined) {
    const t = w.tracks;
    const ok = t && typeof t === 'object' && !Array.isArray(t)
      && (t.mode === undefined || BALANCE.ground.tracks.modes.includes(t.mode))
      && (t.threshold === undefined || (Number.isInteger(t.threshold) && t.threshold >= 1 && t.threshold <= BALANCE.ground.tracks.max))
      && (t.fade === undefined || t.fade === 0)
      && (t.who === undefined || TRACK_WHO.includes(t.who));
    if (!ok) out.push(`world.tracks: mode ${BALANCE.ground.tracks.modes.join('/')}, threshold 1…${BALANCE.ground.tracks.max}, who ${TRACK_WHO.join('/')} (fade only 0 = mode permanent)`);
  }
  return out;
}

/**
 * Worlds of a level (docs/SKRIPTE.md#welten): `[{ id, title?, seed? }]`, 1 … SCENARIO_LIMITS.worlds entries with
 * unique ids. No field = one world.
 * @returns {string[]} problems
 */
export function validateWorlds(worlds) {
  if (worlds === undefined || worlds === null) return [];
  if (!Array.isArray(worlds) || !worlds.length) return ['worlds must be a non-empty list'];
  const out = [];
  if (worlds.length > SCENARIO_LIMITS.worlds) out.push(`at most ${SCENARIO_LIMITS.worlds} worlds`);
  const seen = new Set();
  for (const [i, w] of worlds.entries()) {
    if (!w || typeof w !== 'object' || Array.isArray(w)) { out.push(`worlds[${i}] must be an object`); continue; }
    if (typeof w.id !== 'string' || !KEY_RE.test(w.id) || w.id.length > 32) out.push(`worlds[${i}].id: letters, digits, _ and -, at most 32`);
    else if (seen.has(w.id)) out.push(`worlds: duplicate id "${w.id}"`);
    else seen.add(w.id);
    if (w.title !== undefined && !(isText(w.title) && textLength(w.title) <= 80)) out.push(`worlds[${i}].title must be a short text`);
    if (w.seed !== undefined && !(Number.isInteger(w.seed) && w.seed >= 0 && w.seed <= 0x7fffffff)) out.push(`worlds[${i}].seed must be an integer 0…2147483647`);
  }
  return out;
}

/** Worlds of a scenario (valid ones only); an empty list for a level with one world. */
export const worldsOf = (s) => (Array.isArray(s?.worlds) && !validateWorlds(s.worlds).length ? s.worlds : []);

/**
 * Folder → packed scenario: every section gets the code of its file. Sections without a readable file
 * keep `code` undefined, which validateScenario reports.
 * @param {any} json content of scenario.json
 * @param {(name: string) => string|null|undefined} read text of a file in the folder
 */
export function packLevel(json, read) {
  const s = structuredClone(json);
  for (const sec of s.sections ?? []) {
    if (sec && typeof sec.file === 'string' && typeof sec.code !== 'string' && SECTION_FILE_RE.test(sec.file)) {
      const code = read(sec.file);
      if (typeof code === 'string') sec.code = code.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    }
  }
  return s;
}

/**
 * Packed scenario → folder: scenario.json without code plus one .py file per section (for the .zip).
 * @param {any} s packed scenario
 * @returns {{ json: any, files: Record<string, string> }}
 */
export function unpackLevel(s) {
  const json = structuredClone(s), files = {};
  for (const sec of json.sections ?? []) {
    let name = typeof sec.file === 'string' && SECTION_FILE_RE.test(sec.file) ? sec.file : `${String(sec.id).replace(/[^\w-]/g, '_')}.py`;
    if (!/^[A-Za-z]/.test(name)) name = `s_${name}`;
    for (let n = 2; Object.hasOwn(files, name); n++) name = name.replace(/(_\d+)?\.py$/, `_${n}.py`);
    files[name] = sec.code ?? '';
    sec.file = name;
    delete sec.code;
  }
  return { json, files };
}

/** End rule of a scenario: by its objectives unless `end` says otherwise. */
export const endRuleOf = (s) => s.end ?? 'objectives';

/**
 * Scenario → mission definition for the mission runtime (runtime.js).
 * @param {any} s scenario JSON
 */
export function scenarioToDef(s) {
  const world = s.world ?? {};
  return {
    id: s.id,
    order: s.order ?? 100,
    kind: s.kind ?? 'mission',
    difficulty: s.difficulty ?? null,
    minutes: s.minutes ?? null,
    title: s.title ?? { de: s.id, en: s.id },
    summary: s.summary ?? null,
    briefing: s.briefing ?? null,
    victoryText: s.victoryText ?? { de: 'Geschafft!', en: 'Well done!' },
    defeatText: s.defeatText ?? { de: 'Leider verloren.', en: 'Defeat.' },
    victoryTexts: s.victoryTexts ?? {},
    defeatTexts: s.defeatTexts ?? {},
    debrief: s.debrief ?? null,
    debriefs: s.debriefs ?? {},
    end: endRuleOf(s),
    // Objectives read from the code (menus show them before the start)
    goals: scenarioGoals(s),
    // Guided steps read from the code (the step card shows "step n of total")
    steps: scenarioSteps(s),
    noDefeat: !!s.noDefeat,
    available: s.available ? { buildings: s.available.buildings ?? [], techs: s.available.techs ?? [] } : undefined,
    shafts: s.shafts,
    landmarks: s.landmarks,
    next: s.next ?? null,
    seed: world.seed ?? s.seed ?? 1,
    size: world.size ?? 64,
    // Worlds of the level (normal case and edge cases): the switcher and „Prüfen“ in the code panel
    worlds: worldsOf(s),
    world: {
      base: world.base ?? (world.terrain ? 'terrain' : 'generate'),
      seed: world.seed, size: world.size, width: world.width, height: world.height,
      terrain: world.terrain ?? null, starts: world.starts ?? null,
    },
    fog: world.fog ?? s.fog ?? true,
    // Tracks: { mode (fixes the game option), threshold, who } – otherwise the rules and the setting of the player
    tracks: world.tracks ?? null,
    vision: world.vision ?? (world.startReveal ? { startReveal: world.startReveal } : undefined),
    weatherCycle: s.weatherCycle,
    players: s.players,
    scenario: s,
  };
}

/** Game settings for the simulation: castle yes/no per player. */
export const playerSetupOf = (def) => def.players.filter((p) => p.kind !== 'bandits' && p.kind !== 'village').map((p) => ({ hq: p.hq !== false }));

/**
 * Empty scenario for the editor.
 * @param {{ id?: string, size?: number }} [o]
 */
export function emptyScenario(o = {}) {
  return {
    format: SCENARIO_FORMAT,
    version: SCENARIO_VERSION,
    id: o.id ?? 'custom-world',
    kind: o.kind ?? 'adventure',
    end: 'objectives',
    title: { de: 'Eigene Welt', en: 'My world' },
    summary: { de: '', en: '' },
    world: { base: 'flat', size: o.size ?? 32, fog: false, places: {} },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'world', file: 'world.py', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false, code: '# Weltaufbau: plant_trees(…), add_pile(…), make_place(…)\n' },
      { id: 'mission', file: 'mission.py', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false, code: '# Ziele: objective("ziel", lambda: …, de="…") – sind alle Hauptziele erfüllt, ist die Mission gewonnen\n@on_start\ndef intro():\n    say("nelia", de="Los geht\'s!", en="Here we go!")\n' },
      { id: 'player', file: 'player.py', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true, code: 'nelia.step()\n' },
    ],
  };
}
