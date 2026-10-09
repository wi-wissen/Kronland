// What a level contains, read from its Python code without running it: menus, editor and tools show the
// objectives of a level ("Ziele") before it starts, just as the voice tools collect its dialogue lines.
// Only literal arguments count – objective("homes", …, de="Baue 2 Wohnhäuser") – everything computed stays unknown.

import { parse } from '../../script/parser.js';

/** Visit every node of a syntax tree. */
function walk(node, visit) {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  visit(node);
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, visit);
}

/** Calls of the given functions in the mission sections of a scenario. */
function calls(scenario, names) {
  const out = [];
  for (const sec of scenario.sections ?? []) {
    if ((sec.level ?? 'mission') !== 'mission' || typeof sec.code !== 'string') continue;
    let tree;
    try { tree = parse(sec.code); } catch { continue; }
    walk(tree, (n) => { if (n.type === 'Call' && n.func?.type === 'Name' && names.includes(n.func.id)) out.push(n); });
  }
  return out;
}

const literal = (n) => (n?.type === 'Const' && (typeof n.value === 'string' || typeof n.value === 'boolean' || n.value === null) ? n.value : undefined);

/** Text node → text: "…" or {"de": "…", "en": "…"}; anything computed → undefined. */
function textOf(n) {
  if (typeof literal(n) === 'string') return literal(n);
  if (n?.type !== 'Dict') return undefined;
  const o = {};
  n.keys.forEach((k, i) => { if (typeof literal(k) === 'string' && typeof literal(n.values[i]) === 'string') o[literal(k)] = literal(n.values[i]); });
  return Object.keys(o).length ? o : undefined;
}

/**
 * Objectives of a level in the order of the code: { id, text, primary, hidden }.
 * @param {any} scenario packed scenario
 */
export function scenarioGoals(scenario) {
  const seen = new Set(), out = [];
  for (const node of calls(scenario, ['objective'])) {
    const kw = Object.fromEntries(node.keywords.filter((k) => k.name).map((k) => [k.name, k.value]));
    const id = literal(node.args[0] ?? kw.id);
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    let text;
    if (kw.de || kw.en) {
      text = {};
      if (typeof literal(kw.de) === 'string') text.de = literal(kw.de);
      if (typeof literal(kw.en) === 'string') text.en = literal(kw.en);
    } else text = textOf(kw.text ?? node.args[2]);
    if (typeof text === 'string' && scenario.texts && Object.hasOwn(scenario.texts, text)) text = scenario.texts[text];
    const primary = literal(kw.primary ?? node.args[3]);
    const hidden = literal(kw.hidden ?? node.args[4]);
    out.push({ id, text: text && (typeof text === 'string' || Object.keys(text).length) ? text : id, primary: primary !== false, hidden: hidden === true });
  }
  return out;
}

/** Keyword arguments of a call by name. */
const keywords = (node) => Object.fromEntries(node.keywords.filter((k) => k.name).map((k) => [k.name, k.value]));

/** Text of a say() call: de=/en= keywords, otherwise the literal (or dict) argument at `pos`. */
function callText(node, pos, kw) {
  if (kw.de || kw.en) {
    const t = {};
    if (typeof literal(kw.de) === 'string') t.de = literal(kw.de);
    if (typeof literal(kw.en) === 'string') t.en = literal(kw.en);
    return Object.keys(t).length ? t : undefined;
  }
  return textOf(kw.text ?? node.args[pos]);
}

/**
 * Dialogue lines of a level in the order of the code: { speaker, text } with text "…" or {de, en}. The voice tools
 * (scripts/asset-gen/voice.mjs) record them; a test checks that every line of the bundled missions has its recording.
 * Only say() with a literal speaker and literal texts counts.
 * @param {any} scenario packed scenario
 */
export function scenarioLines(scenario) {
  const out = [];
  for (const node of calls(scenario, ['say'])) {
    const kw = keywords(node);
    const speaker = literal(node.args[0] ?? kw.speaker);
    const text = callText(node, 1, kw);
    if (typeof speaker === 'string' && text !== undefined) out.push({ speaker, text });
  }
  return out;
}

/**
 * Guided steps of a level (step()) in the order of the code: { id, title }. The step card counts them.
 * @param {any} scenario packed scenario
 */
export function scenarioSteps(scenario) {
  const seen = new Set(), out = [];
  for (const node of calls(scenario, ['step'])) {
    const kw = keywords(node);
    const id = literal(node.args[0] ?? kw.id);
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: textOf(kw.title) ?? null });
  }
  return out;
}
