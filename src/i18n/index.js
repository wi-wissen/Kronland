// UI translation: dictionaries de.js/en.js with flat keys ('menu.newGame'),
// t(key, params) and a reactive current language (Vue-reactive, but also works without Vue).
// The simulation stays language-independent: it delivers IDs and codes, names only arise here.
// Mission texts remain bilingual objects { de, en } and go through tr().

import { reactive } from 'vue';
import de from './de.js';
import en from './en.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { TECHS } from '../sim/data/technologies.js';
import { BUILDING_TECHS } from '../sim/data/buildingTechs.js';
import { RANK_NAMES } from '../sim/data/experience.js';
import { UNITS, HEROES } from '../sim/data/units.js';

export const LANGS = ['de', 'en'];
export const DICTS = { de, en };
const KEY = 'kronland-lang';

function readLang() {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return LANGS.includes(v) ? v : 'de';
  } catch {
    return 'de';
  }
}

/** Reactive state: components that call t() in the template re-render on language change. */
export const i18n = reactive({ lang: readLang() });

/** Current language ('de' | 'en'). */
export const currentLang = () => i18n.lang;

/**
 * Set the language, remember it (localStorage 'kronland-lang') and update <html lang>.
 * @param {string} lang
 * @returns {boolean} saved
 */
export function setLang(lang) {
  if (!LANGS.includes(lang)) return false;
  i18n.lang = lang;
  try { if (globalThis.document) document.documentElement.lang = lang; } catch { /* without DOM */ }
  try { globalThis.localStorage?.setItem(KEY, lang); return true; } catch { return false; }
}

const fill = (s, params) => (params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m)) : s);

/** Is there a key (in any language)? */
export const has = (key) => key in de || key in en;

/**
 * Text for a key. If it is missing in the language, German applies, otherwise the key itself.
 * @param {string} key
 * @param {Record<string, any>} [params] placeholders {name}
 * @param {string} [lang]
 */
export function t(key, params, lang = i18n.lang) {
  const s = DICTS[lang]?.[key] ?? de[key] ?? key;
  return fill(s, params);
}

/**
 * Bilingual object { de, en } (missions) or finished string.
 * @param {string|{de?:string,en?:string}|null|undefined} text
 * @param {string} [lang]
 * @param {Record<string, any>} [vars]
 */
export function tr(text, lang = i18n.lang, vars = null) {
  if (text == null) return '';
  const s = typeof text === 'string' ? text : (text[lang] ?? text.de ?? text.en ?? '');
  return fill(s, vars);
}

// ---------- Names from the game data ----------
// Keys: building.<type>.<level>, tech.<id>, unit.<id>, line.<id>, res.<id>, prof.<id>,
// weather.<state>, blessing.<id>, hero.<id>.title, ability.<id>, tdesc.<id> (building technology),
// rank.<stars> (experience). If a key is missing
// (e.g. new data from other modules), the German name from the data file appears.

const orData = (key, fallback, params) => (has(key) ? t(key, params) : (fallback ?? key));

/** Building name of a level (0-based). */
export const buildingName = (type, level = 0) =>
  orData(`building.${type}.${level}`, BUILDINGS[type]?.levels[level]?.name ?? BUILDINGS[type]?.levels[0]?.name ?? type);
export const techName = (id) => orData(`tech.${id}`, TECHS[id]?.name ?? BUILDING_TECHS[id]?.name);
/** Short effect of a building technology. */
export const techDesc = (id) => orData(`tdesc.${id}`, BUILDING_TECHS[id]?.desc ?? '');
/** Rank of a captain by stars (0–5). */
export const rankName = (stars) => orData(`rank.${stars}`, RANK_NAMES[stars] ?? String(stars));
export const unitName = (id) => orData(`unit.${id}`, UNITS[id]?.name);
export const lineName = (id) => orData(`line.${id}`, id);
export const resName = (id) => orData(`res.${id}`, id);
/**
 * Key for a figure by sex: for 'f' the feminine form `<key>.f`, if present
 * (sex from src/render/variants.js figureSex).
 * @param {string} key @param {'m'|'f'|null|undefined} sex
 */
export const sexKey = (key, sex) => (sex === 'f' && has(`${key}.f`) ? `${key}.f` : key);
/** Profession name, with sex 'f' in feminine form (Bäuerin, Schmiedin …). */
export const profName = (id, sex) => orData(sexKey(`prof.${id}`, sex), id);
export const weatherName = (id) => orData(`weather.${id}`, id);
export const blessingName = (id) => orData(`blessing.${id}`, id);
export const heroTitle = (id) => orData(`hero.${id}.title`, HEROES[id]?.title);
export const heroName = (id) => HEROES[id]?.name ?? id;
export const abilityName = (id) => orData(`ability.${id}`, id);

/** Parameters of a reason that must be translated themselves (IDs → names). */
const TOKEN_WORDS = new Set(['NEWLINE', 'EOF', 'INDENT', 'DEDENT']);

function nameParams(params) {
  if (!params) return params;
  const out = { ...params };
  if (params.tech) out.tech = techName(params.tech);
  if (params.building) out.building = buildingName(params.building, params.level ?? 0);
  if (params.res) out.res = resName(params.res);
  if (params.line) out.line = lineName(params.line);
  if (params.unit) out.unit = unitName(params.unit);
  // Parser tokens in words: "found: end of line" instead of "found: NEWLINE"
  if (TOKEN_WORDS.has(params.got)) out.got = t(`script.token.${params.got.toLowerCase()}`);
  return out;
}

/**
 * Turn a simulation rejection or blocking reason into text.
 * Accepts codes ('err.popLimit'), { code, params } and (legacy) finished texts.
 * @param {string|{code:string, params?:Record<string, any>}|null|undefined} reason
 * @param {Record<string, any>} [params]
 */
export function reasonText(reason, params) {
  if (!reason) return '';
  const code = typeof reason === 'string' ? reason : reason.code;
  const p = params ?? (typeof reason === 'string' ? undefined : reason.params);
  return has(code) ? t(code, nameParams(p)) : code;
}

/**
 * Turn a script-language error into text: "NameError in Zeile 3: Den Namen „wod“ kenne ich nicht. Meintest du „wood“?"
 * @param {{code: string, kind: string, params?: any, line?: number}} e error as JSON (ScriptError.toJSON)
 * @param {{ section?: string, line?: number }} [where] section and line in the editor (otherwise e.line)
 * @returns {{ title: string, text: string }}
 */
export function scriptErrorText(e, where = {}) {
  if (!e) return { title: '', text: '' };
  const p = e.params ?? {};
  const variant = p.what ?? p.feature;
  const key = variant && has(`${e.code}.${variant}`) ? `${e.code}.${variant}` : e.code;
  let text;
  let suggestion = p.suggestion;
  if (e.code === 'err.script.game' && p.reason) {
    const rp = { ...(p.reasonParams ?? {}) };
    if (rp.what && has(`script.tile.${rp.what}`)) rp.what = t(`script.tile.${rp.what}`);
    suggestion = suggestion ?? rp.suggestion;
    text = reasonText(p.reason, rp);
  } else text = has(key) ? t(key, nameParams(p)) : e.code;
  if (suggestion) text += ' ' + t('err.script.suggest', { name: suggestion });
  const line = where.line ?? e.line;
  const title = where.section
    ? t('err.script.whereSection', { kind: e.kind, section: where.section, line })
    : line ? t('err.script.where', { kind: e.kind, line }) : e.kind;
  return { title, text: text.trim() };
}

/** Vue plugin: $t, $tr, $reason and $lang in all components (Options API). */
export const I18nPlugin = {
  install(app) {
    Object.assign(app.config.globalProperties, {
      $t: (key, params) => t(key, params),
      $tr: (text, vars) => tr(text, i18n.lang, vars),
      $reason: (r, p) => reasonText(r, p),
      $i18n: i18n,
    });
  },
};
