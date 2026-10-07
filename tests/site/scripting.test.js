// Scripting reference (website scripting/): every command of the language and the game API is documented in both
// languages with an example, and every example still works – Python examples in the VM, game examples in a test
// scenario, the worked adventure solutions win their adventure. So the reference cannot drift from the code.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BUILTINS, METHODS, MODULES } from '../../src/script/builtins.js';
import { API_DOC, CLASS_METHODS, CLASS_PROPS } from '../../src/sim/scripting/api.js';
import { PY_DOC, EXAMPLES, ERRORS, WORKED, BASICS, BASICS_ANCHOR, refExample, refAnchor } from '../../src/ui/script/reference.js';
import { DOCS, introSections, referenceModel, documentedNames, runExample, errorInfo } from '../../src/site/scripting/content.js';
import { COMMANDS, commandDoc, allCommandDocs } from '../../src/ui/script/commandDocs.js';
import { createScenarioSim, createMissionSim } from '../../src/sim/missions/runtime.js';
import { has } from '../../src/i18n/index.js';

const LANGS = ['de', 'en'];
const ALL = [...API_DOC.map((e) => ({ ...e, py: false })), ...PY_DOC.map((e) => ({ ...e, py: true }))];

/** Test map for the game examples: castle, serfs, a troop, trees, piles, places goal/camp/gate, computer opponent and bandits. */
function sandbox(sections) {
  return createScenarioSim({
    format: 'kronland-scenario', version: 1, id: 'reference', kind: 'adventure',
    world: { base: 'flat', width: 48, height: 48, fog: false, starts: [{ x: 12, y: 12 }, { x: 38, y: 38 }],
      places: { goal: { x: 18, y: 14, r: 1 }, camp: { x: 34, y: 14, r: 5 }, gate: { x: 26, y: 14, r: 3 } } },
    players: [
      { kind: 'human', hero: 'nelia', hq: true, serfs: 2, techs: ['conscription', 'construction'], stock: { gold: 1500, clay: 1500, wood: 1500, stone: 1500, iron: 500, sulfur: 200 } },
      { kind: 'ai', hero: 'malvor' }, { kind: 'bandits' },
    ],
    sections: [
      { id: 'setup', level: 'mission', code: 'spawn(HUMAN, "sword1", place("goal"))\nplant_trees((22, 20), 8, 3)\nadd_pile("stone", 16, 18)\n' },
      ...sections,
    ],
  });
}

/** Run code as a player program or mission script on the test map; returns the script errors. */
function runInGame(code, level, ticks = 300) {
  const sections = level === 'mission'
    ? [{ id: 'mission', level: 'mission', code }, { id: 'player', level: 'player', editable: true, code: '' }]
    : [{ id: 'player', level: 'player', editable: true, code: '' }];
  const sim = sandbox(sections);
  if (level !== 'mission') sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
  for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step();
  return sim.mission.script.state.errors.map((e) => `${e.kind} ${e.code} ${JSON.stringify(e.params)} line ${e.line}`);
}

describe('Scripting reference: coverage', () => {
  const names = documentedNames();

  it('every built-in function, module member and method is documented', () => {
    const missing = [];
    for (const n of Object.keys(BUILTINS)) if (!names.has(n)) missing.push(n);
    for (const [mod, list] of Object.entries(MODULES)) for (const n of list) if (!names.has(`${mod}.${n}`)) missing.push(`${mod}.${n}`);
    for (const [type, methods] of Object.entries(METHODS)) for (const m of Object.keys(methods)) if (!names.has(`${type}.${m}`)) missing.push(`${type}.${m}`);
    expect(missing).toEqual([]);
  });

  it('every method of the game objects has an entry to link to', () => {
    const model = referenceModel('de');
    const anchors = new Set(model.flatMap((s) => s.entries.map((e) => e.anchor)));
    const classes = model.find((s) => s.group === 'classes').classes;
    expect(classes.map((c) => c.name)).toEqual(Object.keys(CLASS_METHODS));
    for (const c of classes) for (const m of c.methods) expect(anchors.has(m.href.slice(1)), `${c.name}.${m.name} → ${m.href}`).toBe(true);
  });

  it.each(LANGS)('every entry has a description, an example and (game API) a short help text (%s)', (lang) => {
    for (const e of ALL) {
      const doc = DOCS[lang].entries[e.name];
      expect(doc?.d, `${lang} ${e.name}`).toBeTruthy();
      expect(doc.r, `${lang} ${e.name} returns`).toBeTruthy();
      expect(refExample(e.name, lang), `${lang} ${e.name} example`).toBeTruthy();
      if (!e.py) expect(has(`script.api.${e.name}`), `script.api.${e.name}`).toBe(true);
    }
    for (const k of Object.keys(DOCS[lang].entries)) expect(ALL.some((e) => e.name === k), `unknown entry ${k}`).toBe(true);
    for (const k of Object.keys(EXAMPLES)) expect(ALL.some((e) => e.name === k), `example without entry ${k}`).toBe(true);
  });

  it('German and English texts have the same structure', () => {
    const shape = (d) => ({
      groups: Object.keys(d.groups).sort(), titles: Object.keys(d.groupTitles).sort(), classes: Object.keys(d.classes).sort(),
      props: Object.keys(d.props).sort(), labels: Object.keys(d.labels).sort(),
      entries: Object.fromEntries(Object.entries(d.entries).map(([k, v]) => [k, { p: v.p.map((p) => p[0]), h: v.h?.map((p) => p[0]) ?? null }])),
    });
    expect(shape(DOCS.en)).toEqual(shape(DOCS.de));
  });

  it('every property of the game objects and every class is explained', () => {
    for (const lang of LANGS) {
      for (const p of Object.values(CLASS_PROPS).flat()) expect(DOCS[lang].props[p], `${lang} ${p}`).toBeTruthy();
      for (const c of Object.keys(CLASS_METHODS)) expect(DOCS[lang].classes[c], `${lang} ${c}`).toBeTruthy();
    }
  });

  it('typical errors have a message in both languages', () => {
    for (const [name, codes] of Object.entries(ERRORS)) {
      expect(ALL.some((e) => e.name === name), name).toBe(true);
      for (const c of codes) {
        if (c !== 'err.script.game') expect(has(c), `${name}: ${c}`).toBe(true);
        for (const lang of LANGS) expect(errorInfo(c, lang).kind, c).toMatch(/^[A-Z]\w+(Error|Iteration)$/);
      }
    }
  });
});

describe('Command docs as data (reference page and code editor)', () => {
  it.each(LANGS)('every command has signature, short text, anchor and address; stable anchors (%s)', (lang) => {
    const docs = allCommandDocs(lang);
    expect(docs.length).toBe(API_DOC.length + PY_DOC.length);
    for (const d of docs) {
      expect(d.anchor, d.name).toBe(d.name);
      expect(d.url, d.name).toBe(`./scripting/#${d.name}`);
      expect(d.short.length, `${lang} ${d.name}`).toBeGreaterThan(5);
      expect(d.short, d.name).not.toMatch(/\bz\.$/);
      expect(d.description && d.returns && d.example, d.name).toBeTruthy();
      for (const p of d.params) expect(p.name && p.type && p.text, `${d.name} ${p.name}`).toBeTruthy();
    }
    // Names explained in another entry lead there; unknown names give null
    expect(commandDoc('max', lang).name).toBe('min');
    expect(commandDoc('str.lower', lang).anchor).toBe('str.upper');
    expect(commandDoc('nonsense', lang)).toBeNull();
    expect(new Set(COMMANDS.map((c) => c.name)).size).toBe(COMMANDS.length);
  });
});

describe('Scripting reference: examples work', () => {
  it.each(LANGS)('Python examples run in the VM without errors and print something (%s)', (lang) => {
    for (const e of PY_DOC) {
      const r = runExample(refExample(e.name, lang), lang);
      expect(r.error, `${lang} ${e.name}`).toBeNull();
      expect(r.output.length, `${lang} ${e.name}`).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)('Python blocks in the chapters run without errors (%s)', (lang) => {
    const html = introSections(lang).map((s) => s.html).join('\n');
    expect(html).not.toContain('ref-out err');
    expect((html.match(/class="ref-out"/g) ?? []).length).toBeGreaterThan(10);
  });

  it.each(LANGS)('game examples run on a test map without script errors (%s)', (lang) => {
    const failed = [];
    for (const e of API_DOC) {
      const errs = runInGame(refExample(e.name, lang), e.level);
      if (errs.length) failed.push(`${e.name}: ${errs.join('; ')}`);
    }
    expect(failed).toEqual([]);
  });

  it('player-level examples only use player commands', () => {
    // A mission-only name in a player example would be a NameError – runInGame runs them as player programs
    for (const e of API_DOC.filter((x) => x.level === 'player')) {
      expect(runInGame(refExample(e.name, 'de'), 'player', 5).filter((x) => x.startsWith('NameError')), e.name).toEqual([]);
    }
  });

  for (const [id, w] of Object.entries(WORKED)) {
    it(`worked example ${id}`, () => {
      for (const lang of LANGS) {
        const code = refExample(id, lang);
        if (w.adventure) {
          const sim = createMissionSim(w.adventure);
          sim.step();
          sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
          for (let i = 0; i < 4000 && !sim.mission.state.result; i++) sim.step();
          expect(sim.mission.script.state.errors.filter((e) => e.level === 'player'), `${id} ${lang}`).toEqual([]);
          expect(sim.mission.state.result, `${id} ${lang}`).toMatchObject({ won: true });
        } else {
          expect(runInGame(code, w.level, 600), `${id} ${lang}`).toEqual([]);
        }
      }
    });
  }
});

describe('Scripting reference: page', () => {
  it.each(LANGS)('chapters, sections and internal links fit together (%s)', (lang) => {
    const chapters = introSections(lang, '../');
    expect(chapters.map((c) => c.id)).toEqual(['intro', 'editor', 'run', 'language', 'missing', 'errors', 'examples']);
    const ref = referenceModel(lang, '../');
    const ids = new Set([
      ...chapters.flatMap((c) => [c.id, ...c.subs.map((h) => h.id)]),
      ...ref.flatMap((s) => [s.id, ...s.entries.map((e) => e.anchor), ...(s.classes ?? []).map((c) => c.id)]),
    ]);
    const html = [...chapters.map((c) => c.html), ...ref.flatMap((s) => [s.intro, ...s.entries.flatMap((e) => [e.html, e.returns, ...e.params.map((p) => p.html)])])].join('\n');
    const links = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const l of links) expect(ids.has(l), `#${l}`).toBe(true);
    // The in-game help links its basics to chapter anchors, its commands to entry anchors
    for (const b of BASICS) expect(ids.has(refAnchor(b.name)), b.name).toBe(true);
    for (const e of API_DOC) expect(ids.has(refAnchor(e.name)), e.name).toBe(true);
    expect(Object.keys(BASICS_ANCHOR).sort()).toEqual(BASICS.map((b) => b.name).sort());
    // No placeholder left, no unrendered Markdown
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });

  it.each(LANGS)('Wikipedia links point to the page language, parentheses encoded (%s)', (lang) => {
    const src = readFileSync(`src/site/scripting/intro.${lang}.md`, 'utf8');
    const wiki = [...src.matchAll(/\]\((https:\/\/(\w+)\.wikipedia\.org\/wiki\/([^)\s]+))\)/g)];
    expect(wiki.length).toBeGreaterThanOrEqual(15);
    for (const [, url, l, title] of wiki) {
      expect(l, url).toBe(lang);
      expect(title, url).not.toMatch(/[()\s]/);
    }
  });
});
