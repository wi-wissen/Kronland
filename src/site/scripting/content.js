// Scripting reference: page model from the single sources
//   - API_DOC, CLASS_METHODS, CLASS_PROPS (src/sim/scripting/api.js) – game API,
//   - PY_DOC, EXAMPLES, ERRORS, WORKED (src/ui/script/reference.js) – Python part, examples, errors,
//   - commandDocs.js (texts in src/ui/script/docs/) – per-command data, intro.de.md / intro.en.md – chapters.
// Python examples (```py in the chapters, all PY_DOC examples) run in the real VM; the page shows their output.

import { renderMarkdown, escapeHtml } from '../markdown.js';
import { runToEnd, highlightRanges, ERROR_KINDS, BUDGET_LIMITS } from '../../script/index.js';
import { API_DOC, CLASS_METHODS, CLASS_PROPS } from '../../sim/scripting/api.js';
import { BUDGET } from '../../sim/scripting/host.js';
import { TICKS_PER_SECOND } from '../../sim/fixed.js';
import { SCENARIOS } from '../../sim/missions/levels/index.js';
import { PY_DOC, API_GROUPS, PY_GROUPS, WORKED, refExample } from '../../ui/script/reference.js';
import { t, has, scriptErrorText, i18n } from '../../i18n/index.js';
import { DOCS, commandDoc } from '../../ui/script/commandDocs.js';
import introDe from './intro.de.md?raw';
import introEn from './intro.en.md?raw';

export { DOCS };
const INTRO = { de: introDe, en: introEn };

/** Icons of the sections in the sidebar. */
const GROUP_ICONS = {
  flow: 'time', hero: 'hero-nelia', world: 'map', village: 'castle', story: 'scroll', events: 'hint', goals: 'objective',
  power: 'crown', terrain: 'edit', const: 'player', classes: 'target',
  pyfunc: 'mode-adventure', pymath: 'scale', pyrandom: 'dice', pystr: 'edit', pylist: 'all', pydict: 'load',
};

/** Code → HTML with the colours of the in-game editor (tk-* classes). */
export function highlight(src) {
  let out = '', at = 0;
  for (const r of highlightRanges(src)) {
    if (r.from > at) out += escapeHtml(src.slice(at, r.from));
    out += `<span class="tk-${r.cls}">${escapeHtml(src.slice(r.from, r.to))}</span>`;
    at = r.to;
  }
  return out + escapeHtml(src.slice(at));
}

const fmtInt = (n, lang) => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB');

/**
 * Run a pure Python example in the VM (as on the page).
 * @returns {{ output: string, error: string|null }}
 */
export function runExample(code, lang = i18n.lang) {
  const r = runToEnd(code, { seed: 1, budget: 2_000_000 });
  if (!r.error) return { output: r.output, error: null };
  const prev = i18n.lang;
  i18n.lang = lang;
  try {
    const e = scriptErrorText(r.error);
    return { output: r.output, error: `${e.title}: ${e.text}` };
  } finally { i18n.lang = prev; }
}

/** Example code as a highlighted block (with output for Python examples). */
function codeBlock(code, { run = false, lang } = {}) {
  const pre = `<pre class="ref-code"><code>${highlight(code.replace(/\n+$/, ''))}</code></pre>`;
  if (!run) return pre;
  const r = runExample(code, lang);
  const L = DOCS[lang].labels;
  const out = r.error ? `${r.output}${r.error}` : r.output || L.noOutput;
  return `${pre}<div class="ref-out${r.error ? ' err' : ''}"><span class="ref-out-label">${L.output}</span><pre><code>${escapeHtml(out.replace(/\n$/, ''))}</code></pre></div>`;
}

/** Placeholders of the chapters. */
function introVars(lang) {
  const adv = SCENARIOS.filter((s) => s.kind === 'adventure').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const q = lang === 'de' ? ['„', '“'] : ['“', '”'];
  const vars = {
    ticks: TICKS_PER_SECOND,
    budgetPlayer: fmtInt(BUDGET.player, lang),
    budgetMission: fmtInt(BUDGET.mission, lang),
    budgetSetup: fmtInt(BUDGET.setup, lang),
    syncLimit: fmtInt(BUDGET_LIMITS.syncLimit, lang),
    maxDepth: BUDGET_LIMITS.maxDepth,
    adventures: adv.map((s) => `${q[0]}${s.title[lang] ?? s.title.de}${q[1]} (${(s.learn?.[lang] ?? s.learn?.de ?? []).join(', ')})`).join('; '),
  };
  return vars;
}

/**
 * Chapters before the reference: Markdown with code blocks. ```py blocks run and get an output box.
 * @param {string} lang @param {string} base path to the website root
 */
export function introSections(lang, base = './') {
  const vars = introVars(lang);
  const blocks = [];
  const keep = (html) => { blocks.push(html); return `\n\n\u0002${blocks.length - 1}\u0002\n\n`; };
  let src = INTRO[lang] ?? INTRO.de;
  // Worked examples {{ex_<id>}} → code block
  src = src.replace(/\{\{ex_(\w+)\}\}/g, (m, id) => (WORKED[id] ? keep(codeBlock(refExample(id, lang), { lang })) : m));
  src = src.replace(/^```(\w*)\n([\s\S]*?)^```\s*$/gm, (m, kind, code) => keep(codeBlock(code, { run: kind === 'py', lang })));
  const parts = src.split(/^(?=## )/m).filter((p) => p.trim());
  return parts.map((p) => {
    let { html, headings } = renderMarkdown(p, { vars, base });
    html = html.replace(/<p>\u0002(\d+)\u0002<\/p>/g, (m, i) => blocks[Number(i)]);
    const h2 = headings.find((h) => h.level === 2) ?? { id: 'intro', text: '' };
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    return { id: h2.id, title: h2.text, html, subs: headings.filter((h) => h.level === 3), plain };
  });
}

/** Inline Markdown (descriptions) → HTML. */
const md = (s, base) => renderMarkdown(s ?? '', { base }).html;

/** Error code → { kind, text } in a language (placeholders become “…”). */
export function errorInfo(code, lang) {
  const L = DOCS[lang].labels;
  if (code === 'err.script.game') return { kind: 'GameError', text: L.gameReason };
  const kind = code.startsWith('script.game.') ? 'GameError' : ERROR_KINDS[code.replace(/^err\.script\./, '').split('.')[0]] ?? 'RuntimeError';
  const text = has(code) ? t(code, null, lang).replace(/\{\w+\}/g, '…').replace(/…\./g, '…') : code;
  return { kind, text };
}

/** One reference entry (data from commandDoc, rendered to HTML). */
function entry(e, lang, base, py) {
  const c = commandDoc(e.name, lang);
  const ex = c.example === null ? null : { code: c.example, html: highlight(c.example), ...(py ? runExample(c.example, lang) : {}) };
  const inline = (text) => md(text, base).replace(/^<p>|<\/p>$/g, '');
  return {
    name: c.name,
    anchor: c.anchor,
    sig: c.sig,
    level: c.level,
    py,
    also: c.also,
    short: c.short,
    html: md(c.description, base),
    params: c.params.map((p) => ({ name: p.name, type: p.type, html: inline(p.text) })),
    handler: c.handlerArgs.length ? c.handlerArgs.map((p) => [p.name, p.type, p.text]) : null,
    returns: c.returns ? inline(c.returns) : '',
    example: ex,
    errors: c.errors.map((code) => ({ code, ...errorInfo(code, lang) })),
    plain: `${c.name} ${c.sig} ${c.description}`.toLowerCase(),
  };
}

/** Game objects: classes with properties and methods. */
function classesSection(lang) {
  const C = DOCS[lang].classes, P = DOCS[lang].props;
  const METHOD_DOC = {
    distance_to: 'obj.distance_to', contains: 'place.contains', kill: 'obj.kill', work_on: 'serf.work_on', chop: 'serf.chop', attack: 'troop.attack',
    hold: 'troop.hold', defend: 'troop.hold', upgrade: 'building.upgrade', change_weather: 'building.change_weather', can_change_weather: 'building.change_weather', start_talking: 'npc.stop_talking', stop_talking: 'npc.stop_talking', right: 'nelia.left',
  };
  // Every figure (hero, serf, troop) shares the basic commands, explained once under nelia.…
  const methodLink = (cls, m) => METHOD_DOC[m] ?? `nelia.${m}`;
  const classes = Object.keys(CLASS_METHODS).map((cls) => ({
    id: `cls-${cls}`,
    name: cls,
    text: C[cls] ?? '',
    props: (CLASS_PROPS[cls] ?? []).map((p) => ({ name: p, text: P[p] ?? '' })),
    methods: [...CLASS_METHODS[cls].player.map((m) => ({ name: m, mission: false })), ...CLASS_METHODS[cls].mission.map((m) => ({ name: m, mission: true }))]
      .map((m) => ({ ...m, href: `#${methodLink(cls, m.name)}` })),
  }));
  return {
    id: 'ref-classes', group: 'classes', title: DOCS[lang].groupTitles.classes, icon: GROUP_ICONS.classes,
    intro: md(C.intro), common: { label: C.common, props: CLASS_PROPS.common.map((p) => ({ name: p, text: P[p] ?? '' })) },
    classes, entries: [],
  };
}

/**
 * The reference: one section per group with one entry per command.
 * @param {string} lang @param {string} [base]
 */
export function referenceModel(lang, base = './') {
  const D = DOCS[lang];
  const group = (id, list, py) => ({
    id: `ref-${id}`, group: id, title: D.groupTitles[id], icon: GROUP_ICONS[id], intro: md(D.groups[id], base),
    entries: list.filter((e) => e.group === id).map((e) => entry(e, lang, base, py)),
  });
  const api = API_GROUPS.map((g) => group(g, API_DOC, false));
  const py = PY_GROUPS.map((g) => group(g, PY_DOC, true));
  return [...api, classesSection(lang), ...py];
}

/** All names the reference explains (entries and their `also`), for tests. */
export const documentedNames = () => new Set([...API_DOC, ...PY_DOC].flatMap((e) => [e.name, ...(e.also ?? [])]));
