// Per-command documentation as one importable data module – for the reference page (src/site/scripting/) and the
// code editor (tooltips, Ctrl/Cmd+click → reference). Plain data, no HTML: descriptions keep their Markdown
// (`code`, **bold**). Anchor ids are the command names (nelia.step, len, str.split …) and stay stable.
// The long texts (docs/de.js, docs/en.js) are ~60 kB per language; the editor may import this module lazily.

import { API_DOC } from '../../sim/scripting/api.js';
import { t, has } from '../../i18n/index.js';
import { PY_DOC, ERRORS, refExample, refAnchor, refUrl } from './reference.js';
import de from './docs/de.js';
import en from './docs/en.js';

export const DOCS = { de, en };

/** Every documented command: game API first, then Python (name, sig, group, level, also). */
export const COMMANDS = [
  ...API_DOC.map((e) => ({ name: e.name, sig: e.sig, group: e.group, level: e.level, also: e.also ?? [], py: false })),
  ...PY_DOC.map((e) => ({ name: e.name, sig: e.sig, group: e.group, level: 'player', also: e.also ?? [], py: true })),
];

const BY_NAME = new Map();
for (const c of COMMANDS) for (const n of [c.name, ...c.also]) if (!BY_NAME.has(n)) BY_NAME.set(n, c);

/**
 * @typedef {{ name: string, sig: string, anchor: string, url: string, group: string, level: 'player'|'mission',
 *   py: boolean, also: string[], short: string, description: string,
 *   params: { name: string, type: string, text: string }[], handlerArgs: { name: string, type: string, text: string }[],
 *   returns: string, example: string|null, errors: string[] }} CommandDoc
 */

/**
 * Documentation of a command in a language. Also finds names explained together with another (max → min,
 * str.lower → str.upper). Unknown names: null.
 * @param {string} name e.g. 'nelia.step', 'len', 'str.split'
 * @param {'de'|'en'} [lang]
 * @returns {CommandDoc|null}
 */
export function commandDoc(name, lang = 'de') {
  const c = BY_NAME.get(name);
  if (!c) return null;
  const d = (DOCS[lang] ?? DOCS.de).entries[c.name] ?? {};
  const row = ([n, type, text]) => ({ name: n, type, text });
  return {
    name: c.name,
    sig: c.sig,
    anchor: refAnchor(c.name),
    url: refUrl(c.name),
    group: c.group,
    level: c.level,
    py: c.py,
    also: c.also,
    short: has(`script.api.${c.name}`) ? t(`script.api.${c.name}`, null, lang) : firstSentence(d.d ?? ''),
    description: d.d ?? '',
    params: (d.p ?? []).map(row),
    handlerArgs: (d.h ?? []).map(row),
    returns: d.r ?? '',
    example: refExample(c.name, lang),
    errors: ERRORS[c.name] ?? [],
  };
}

/** All command docs of a language (order of the reference). */
export const allCommandDocs = (lang = 'de') => COMMANDS.map((c) => commandDoc(c.name, lang));

/** First sentence of a Markdown text (short description for Python entries without an i18n short text). */
function firstSentence(md) {
  const s = md.replace(/\s+/g, ' ').trim().replace(/(z|d|u)\. (B|h|a)\./g, '$1.\u00a0$2.');
  const m = /^(.+?[.!?])(?= [A-ZÄÖÜ„“"`*]|$)/.exec(s);
  return m ? m[1] : s;
}
