// Milestones for the blog: key figures per article, source links and placeholders {{name}} of the texts, all
// from docs/milestones.json (figures filled in by scripts/milestones.mjs, times Europe/Berlin).

import MILESTONES from '../../../docs/milestones.json';

export { MILESTONES };

/** Public repository of the project (source links of the articles). */
export const REPO_URL = 'https://github.com/wi-wissen/Kronland';

/** Numbers that are not in milestones.json (as of the last milestone; `npm test` counts the Vitest tests). */
export const STATIC_STATS = { vitestTests: 924 };

const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const SHORT = {
  de: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const L = (lang) => (lang === 'en' ? 'en' : 'de');

/**
 * Split a timestamp from the JSON file (local time is in the text, e.g. 2026-10-03T11:51:52+02:00).
 * @param {string} iso
 */
export function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso ?? '');
  if (!m) throw new Error(`Unreadable timestamp: ${iso}`);
  return { y: Number(m[1]), mo: Number(m[2]) - 1, d: Number(m[3]), time: m[4] ? `${m[4]}:${m[5]}` : '', day: `${m[1]}-${m[2]}-${m[3]}` };
}

/** „3. Oktober 2026, 11:51 Uhr“ / „3 October 2026, 11:51“ (without a time only the date). */
export function longDate(iso, lang) {
  const p = parts(iso);
  const de = L(lang) === 'de';
  const date = de ? `${p.d}. ${MONTHS.de[p.mo]} ${p.y}` : `${p.d} ${MONTHS.en[p.mo]} ${p.y}`;
  if (!p.time) return date;
  return de ? `${date}, ${p.time} Uhr` : `${date}, ${p.time}`;
}

/** Short time span: "3. Okt. · 12:07–12:08", across days "3. Okt. 19:46 – 4. Okt. 02:45". */
export function spanText(a, b, lang) {
  const l = L(lang);
  const p = parts(a);
  const q = parts(b);
  const dm = (x) => (l === 'de' ? `${x.d}. ${SHORT.de[x.mo]}` : `${x.d} ${SHORT.en[x.mo]}`);
  if (p.day !== q.day) return `${dm(p)} ${p.time} – ${dm(q)} ${q.time}`;
  return p.time === q.time ? `${dm(p)} · ${p.time}` : `${dm(p)} · ${p.time}–${q.time}`;
}

/** Minutes between two timestamps (with time zone). */
export const minutesBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);

/** Calendar days from a to b (both counted). */
export function calendarDays(a, b) {
  const p = parts(a);
  const q = parts(b);
  return Math.round((Date.UTC(q.y, q.mo, q.d) - Date.UTC(p.y, p.mo, p.d)) / 86400000) + 1;
}

const fmt = (n, lang) => Number(n).toLocaleString(L(lang) === 'de' ? 'de-DE' : 'en-GB');

/** Key figures of the whole project. */
export function totals(ms = MILESTONES) {
  const first = ms[0];
  const last = ms[ms.length - 1];
  return {
    start: first.date_start,
    end: last.date_end,
    days: calendarDays(first.date_start, last.date_end),
    milestones: ms.length,
    vitestCases: last.tests_vitest,
    e2eCases: last.tests_e2e,
  };
}

/** Placeholders {{name}} of the blog texts. */
export function blogVars(lang, ms = MILESTONES) {
  const t = totals(ms);
  return {
    start: longDate(t.start, lang),
    end: longDate(t.end, lang),
    days: fmt(t.days, lang),
    milestones: fmt(t.milestones, lang),
    vitestCount: fmt(STATIC_STATS.vitestTests, lang),
    vitestCases: fmt(t.vitestCases, lang),
    e2eCases: fmt(t.e2eCases, lang),
  };
}

/** Milestone for an ID (article name = milestone ID). */
export function milestone(id, ms = MILESTONES) {
  const i = ms.findIndex((m) => m.id === id);
  return i < 0 ? null : { ...ms[i], n: i + 1, total: ms.length };
}

/**
 * Source links of a milestone: the commit itself and the whole project at that state. Without a commit
 * (field `commit` empty) both point to the current state of main.
 * @param {{ commit?: string }} m
 */
export function sourceLinks(m) {
  const c = m?.commit;
  return c ? { commit: `${REPO_URL}/commit/${c}`, tree: `${REPO_URL}/tree/${c}` } : { commit: `${REPO_URL}/tree/main`, tree: `${REPO_URL}/tree/main` };
}
