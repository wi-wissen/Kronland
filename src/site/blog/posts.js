// Blog: articles as Markdown per language in posts/<name>.de.md and posts/<name>.en.md, each with a header
// (front matter) between `---` lines:
//
//   ---
//   title: Title of the article
//   date: 2026-10-06
//   teaser: One or two sentences for the overview.
//   milestone: true             (optional: article for a milestone, name = ID in docs/milestones.json)
//   pinned: true                (optional: comes before all others, e.g. "What it is about")
//   ---
//
// New article = two new files; overview (blog/) and article page (blog/<name>/) appear on their own
// (pages at build time: scripts/vite-blog-pages.js). Order: pinned first, then by date ascending – the
// overview reads like the history of the project, new articles go at the end.
// Chapters as in the manual: `## Title {#same-id}` in both languages.

import { renderMarkdown } from '../markdown.js';
import { blogVars } from './milestones.js';

const FILES = import.meta.glob('./posts/*.md', { query: '?raw', import: 'default', eager: true });

/** Allowed names (address blog/<name>/). */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Separate header and text of a Markdown file.
 * @param {string} raw
 * @returns {{ meta: Record<string, string>, body: string }}
 */
export function parseFrontMatter(raw) {
  const text = String(raw ?? '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { meta, body: text.slice(m[0].length) };
}

/**
 * All articles from the files: pinned first, then by date (oldest first).
 * @param {Record<string, string>} [files] path → content (for tests)
 * @returns {{ slug: string, date: string, pinned: boolean, milestone: boolean, langs: Record<string, { title: string, teaser: string, body: string }> }[]}
 */
export function loadPosts(files = FILES) {
  const bySlug = new Map();
  for (const [path, raw] of Object.entries(files)) {
    const m = /([^/]+)\.(de|en)\.md$/.exec(path);
    if (!m || !SLUG.test(m[1])) continue;
    const { meta, body } = parseFrontMatter(raw);
    const post = bySlug.get(m[1]) ?? { slug: m[1], date: '', pinned: false, milestone: false, langs: {} };
    post.langs[m[2]] = { title: meta.title ?? m[1], teaser: meta.teaser ?? '', date: meta.date ?? '', body };
    if (meta.date && (!post.date || m[2] === 'de')) post.date = meta.date;
    if (meta.pinned === 'true') post.pinned = true;
    if (meta.milestone === 'true') post.milestone = true;
    bySlug.set(m[1], post);
  }
  const key = (p) => Date.parse(p.date) || 0;
  return [...bySlug.values()].sort((a, b) => (b.pinned - a.pinned) || (key(a) - key(b)) || a.slug.localeCompare(b.slug));
}

export const POSTS = loadPosts();

/** Article in one language (if that language is missing, the other). */
export function postIn(post, lang) {
  return post.langs[lang] ?? post.langs.de ?? post.langs.en;
}

/** Article name from the address: …/blog/<name>/ or …/blog/?post=<name>. */
export function slugFromLocation(loc = globalThis.location) {
  const path = /\/blog\/([^/]+)\/(?:index\.html)?$/.exec(loc?.pathname ?? '');
  if (path && SLUG.test(path[1])) return path[1];
  const q = new URLSearchParams(loc?.search ?? '').get('post');
  return q && SLUG.test(q) ? q : null;
}

/**
 * Split the article text into chapters (##) and render them. Placeholder {{name}}: key figures of the project's history (milestones.js).
 * @param {{ body: string }} text @param {string} lang @param {string} base path to the website root
 */
export function postSections(text, lang, base = './') {
  const vars = blogVars(lang);
  return text.body.split(/^(?=## )/m).filter((p) => p.trim()).map((p) => {
    const { html, headings } = renderMarkdown(p, { vars, base });
    const h2 = headings.find((h) => h.level === 2) ?? { id: 'intro', text: '' };
    return { id: h2.id, title: h2.text, html };
  });
}
