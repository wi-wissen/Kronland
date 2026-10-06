#!/usr/bin/env node
// Milestones: docs/milestones.json lists them in order, each maps to exactly one commit on main (field
// `commit`). Maintained by hand: id, titles, summaries, `commit` and the times (date_start/date_end = period of
// the milestone, work_start = start of the work on it). From the commit the script computes the diffstat and the
// test cases and rewrites docs/MEILENSTEINE.md. Without `commit` the stored figures stay as they are.
//
//   node scripts/milestones.mjs             # check, recompute figures, write both files
//   node scripts/milestones.mjs --check     # only check, write nothing
//   node scripts/milestones.mjs --ref main  # branch other than origin/main

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const JSON_PATH = resolve(ROOT, 'docs/milestones.json');
const MD_PATH = resolve(ROOT, 'docs/MEILENSTEINE.md');
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const REPO_URL = 'https://github.com/wi-wissen/Kronland';
/** Field order in milestones.json. */
const FIELDS = ['id', 'title_de', 'title_en', 'commit', 'date_start', 'date_end', 'work_start', 'files_changed', 'insertions', 'deletions',
  'tests_vitest', 'tests_vitest_added', 'tests_e2e', 'tests_e2e_added', 'summary_de', 'summary_en'];

const args = process.argv.slice(2);
const check = args.includes('--check');
const ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'origin/main';

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, TZ: 'Europe/Berlin' } }).trim();
const lines = (s) => (s ? s.split('\n') : []);

/** Test cases in the source (`it('…'`/`test('…'`) – Vitest under tests/, Playwright under e2e/. */
function countTests(rev) {
  if (!rev) return { vitest: 0, e2e: 0 };
  const count = (re, ...paths) => {
    let raw = '';
    try { raw = git('grep', '-c', '-E', re, rev, '--', ...paths); } catch { return 0; } // no matches: exit 1
    return lines(raw).reduce((s, l) => s + Number(l.split(':').pop()), 0);
  };
  const name = String.raw`(\.[a-zA-Z]+\([^)]*\))?\(['"` + '`]';
  return {
    vitest: count(String.raw`^\s*(it|test)` + name, 'tests/*.test.js', 'tests/**/*.test.js'),
    e2e: count(String.raw`^\s*test` + name, 'e2e/*.spec.js'),
  };
}

/** Figures of one milestone commit compared to its parent. */
function compute(commit) {
  const parent = lines(git('rev-list', '--parents', '-n1', commit))[0].split(' ')[1] ?? null;
  const stat = git('diff', '--shortstat', parent ?? EMPTY_TREE, commit);
  const num = (re) => Number(re.exec(stat)?.[1] ?? 0);
  const a = countTests(parent);
  const b = countTests(commit);
  return {
    files_changed: num(/(\d+) files? changed/),
    insertions: num(/(\d+) insertions?/),
    deletions: num(/(\d+) deletions?/),
    tests_vitest: b.vitest, tests_vitest_added: b.vitest - a.vitest, tests_e2e: b.e2e, tests_e2e_added: b.e2e - a.e2e,
  };
}

const ms = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const problems = [];
const ids = new Set();
for (const [i, m] of ms.entries()) {
  if (ids.has(m.id)) problems.push(`${m.id}: duplicate id`);
  ids.add(m.id);
  if (!(Date.parse(m.work_start) <= Date.parse(m.date_start) && Date.parse(m.date_start) <= Date.parse(m.date_end))) problems.push(`${m.id}: times not ascending`);
  if (i && Date.parse(ms[i - 1].date_end) > Date.parse(m.date_start)) problems.push(`${m.id}: starts before the end of ${ms[i - 1].id}`);
}

// Commits: in the order of the milestones on the first-parent chain of `ref`, each exactly once
const filled = ms.filter((m) => m.commit);
let chain = [];
if (filled.length) {
  chain = lines(git('rev-list', '--first-parent', '--reverse', ref));
  const index = new Map(chain.map((c, i) => [c, i]));
  let last = -1;
  for (const m of filled) {
    const c = git('rev-parse', `${m.commit}^{commit}`);
    if (c !== m.commit) problems.push(`${m.id}: commit must be the full SHA (${c})`);
    const at = index.get(c);
    if (at === undefined) problems.push(`${m.id}: ${m.commit.slice(0, 7)} is not on the first-parent chain of ${ref}`);
    else if (at <= last) problems.push(`${m.id}: commit lies before the one of the previous milestone`);
    else last = at;
    const when = git('log', '-1', '--date=iso-strict-local', '--format=%cd', c);
    if (Date.parse(when) !== Date.parse(m.date_end)) console.warn(`Note: ${m.id}: commit date ${when} differs from date_end ${m.date_end}.`);
  }
  if (last >= 0 && last < chain.length - 1) console.warn(`Note: ${chain.length - 1 - last} newer commits on ${ref} do not belong to any milestone yet.`);
}
if (filled.length && filled.length < ms.length) console.warn(`Note: ${ms.length - filled.length} milestones without commit – their figures stay as stored.`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const out = ms.map((m) => {
  const r = { ...m, ...(m.commit ? compute(m.commit) : {}) };
  return Object.fromEntries(FIELDS.map((k) => [k, r[k] ?? (k === 'commit' ? '' : 0)]));
});

const day = (iso) => { const [d, t] = iso.split('T'); const [y, mo, dd] = d.split('-'); return `${Number(dd)}.${Number(mo)}.${y} ${t.slice(0, 5)}`; };
/** Period; on the same day the date appears only once: "3.10.2026 12:07–12:08". */
const span = (a, b) => (a === b ? day(a) : a.slice(0, 10) === b.slice(0, 10) ? `${day(a)}–${b.slice(11, 16)}` : `${day(a)} – ${day(b)}`);
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
const code = (m) => (m.commit ? `[\`${m.commit.slice(0, 7)}\`](${REPO_URL}/commit/${m.commit})` : '–');
console.log(out.map((m, i) => `${String(i + 1).padStart(2)} ${m.title_de.padEnd(62)} ${day(m.date_end)}  ${m.commit ? m.commit.slice(0, 7) : '(no commit)'}`).join('\n'));
if (check) process.exit(0);

writeFileSync(JSON_PATH, `${JSON.stringify(out, null, 2)}\n`);

const md = [
  '# Meilensteine',
  '',
  'Die Entstehung von Kronland in Abschnitten (Zeiten Europe/Berlin). Jeder Meilenstein entspricht genau einem Commit',
  'auf `main`. Maschinenlesbar: [milestones.json](milestones.json); auf der Website hat jeder Meilenstein einen',
  'Blog-Artikel (`blog/<id>/`, Text in `src/site/blog/posts/<id>.de.md` und `.en.md`) mit Links zum Code des',
  'Meilensteins und zum Projekt in diesem Stand.',
  '',
  'Pflege: In `milestones.json` `id`, Titel, Zusammenfassungen, Zeiten und `commit` (volle SHA auf `main`) eintragen,',
  'dann `node scripts/milestones.mjs` (prüft die Reihenfolge, berechnet geänderte Zeilen und Testfälle aus dem Commit',
  'und schreibt diese Datei neu). `tests/site/blog.test.js` prüft Reihenfolge, Artikel und – sobald `commit`',
  'gesetzt ist – die Zuordnung zu `main`.',
  '',
  `Stand: ${out.length} Meilensteine, ${day(out[0].work_start)} bis ${day(out[out.length - 1].date_end)}.`,
  '',
  '| # | Meilenstein | Beginn | Ende | Commit |',
  '|---|---|---|---|---|',
  ...out.map((m, i) => `| ${i + 1} | ${m.title_de} | ${day(m.date_start)} | ${day(m.date_end)} | ${code(m)} |`),
  '',
  ...out.flatMap((m, i) => [
    `## ${i + 1}. ${m.title_de}`,
    '',
    `${span(m.date_start, m.date_end)} (Arbeit ab ${day(m.work_start)}) · ${m.files_changed} Dateien, +${m.insertions} / −${m.deletions} Zeilen`
      + ` · Commit ${code(m)}`,
    '',
    `Testfälle im Quelltext: Vitest ${m.tests_vitest} (${signed(m.tests_vitest_added)}), Playwright ${m.tests_e2e} (${signed(m.tests_e2e_added)})`
      + ` · Blog: \`blog/${m.id}/\``,
    '',
    m.summary_de,
    '',
  ]),
].join('\n');
writeFileSync(MD_PATH, md);
console.log('written: docs/milestones.json, docs/MEILENSTEINE.md');
