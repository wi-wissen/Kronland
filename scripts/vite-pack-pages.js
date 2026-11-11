// Vite plugin: one static page per open level pack of the configured sources, plus a sitemap (docs/SERVER.md).
// Reads public/kronland.config.json (server and sources), loads every catalog, and writes
//   level/<pack id>/index.html   title, summary, preview and a link into the game (play/?play=<id>)
//   sitemap-levels.xml           the addresses of these pages
// Unreachable or broken sources are skipped with a warning - the build never fails because of them. Without
// server and sources (the default) the plugin does nothing.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pageUrl, socialTags, SITE_URL } from './vite-social-meta.js';

const CONFIG = resolve(import.meta.dirname, '../public/kronland.config.json');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Catalog addresses of a configuration file (server first); unusable content gives an empty list. */
export function configSources(path = CONFIG) {
  try {
    if (!existsSync(path)) return [];
    const c = JSON.parse(readFileSync(path, 'utf8'));
    const list = [];
    if (typeof c.server === 'string' && /^https?:\/\//.test(c.server)) list.push(`${c.server.replace(/\/$/, '')}/catalog.json`);
    for (const s of Array.isArray(c.sources) ? c.sources : []) if (typeof s === 'string' && /^https?:\/\//.test(s) && !list.includes(s)) list.push(s);
    return list;
  } catch { return []; }
}

const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const isText = (t) => t && typeof t.de === 'string' && typeof t.en === 'string';

/**
 * Light check of a catalog for page generation (the game checks it fully against the schema, src/net/catalog.js;
 * this file stays free of that import so the Vite config does not load JSON schemas): open entries with an id
 * and titles, addresses made absolute. Anything else is dropped.
 */
export function parseCatalog(json, base) {
  if (json?.format !== 'kronland-catalog' || json.version !== 1 || !Array.isArray(json.packs)) throw new Error('not a kronland-catalog');
  const abs = (u) => { try { return u ? new URL(u, base).href : null; } catch { return null; } };
  const packs = json.packs
    .filter((p) => p && typeof p.id === 'string' && ID.test(p.id) && isText(p.title) && p.access === 'open' && typeof p.manifest === 'string')
    .map((p) => ({ id: p.id, title: p.title, summary: isText(p.summary) ? p.summary : null, levels: Number.isInteger(p.levels) ? p.levels : 0, access: 'open', preview: abs(p.preview) }));
  return { name: json.name ?? null, packs };
}

/**
 * Open packs of all sources, the first source wins for an id. Failing sources are reported through `warn`.
 * @param {string[]} sources @param {{ fetch?: typeof fetch, warn?: (msg: string) => void, timeout?: number }} [env]
 */
export async function collectPacks(sources, { fetch: f = globalThis.fetch, warn = console.warn, timeout = 10_000 } = {}) {
  const seen = new Set(), packs = [];
  const results = await Promise.all(sources.map(async (url) => {
    try {
      const res = await f(url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { url, catalog: parseCatalog(await res.json(), url) };
    } catch (e) {
      warn(`[kronland:pack-pages] source skipped: ${url} (${e.message})`);
      return null;
    }
  }));
  for (const r of results) {
    if (!r) continue;
    for (const p of r.catalog.packs) if (p.access === 'open' && !seen.has(p.id)) { seen.add(p.id); packs.push({ ...p, source: r.url, sourceName: r.catalog.name }); }
  }
  return packs;
}

/** HTML of the page of one pack (self-contained, German and English). */
export function packPageHtml(p, site = SITE_URL) {
  const url = pageUrl(`level/${p.id}/index.html`, site);
  const title = `${p.title.de} – Kronland`;
  const summary = p.summary?.de || p.summary?.en || '';
  const play = `../../play/?play=${encodeURIComponent(p.id)}`;
  const block = (lang, label, open) => `<section lang="${lang}"><h2>${esc(p.title[lang])}</h2>${p.summary?.[lang] ? `<p>${esc(p.summary[lang])}</p>` : ''}<p><a class="play" href="${esc(play)}">${open}</a></p></section>`;
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(summary)}" />
    ${socialTags({ title, description: summary, url }, site)}
    <style>
      body { margin: 0; font: 1rem/1.5 system-ui, sans-serif; background: #1a221e; color: #f3e9d2; }
      main { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
      img { max-width: 100%; border-radius: 0.5rem; }
      h1 { font-size: 2rem; margin: 0 0 0.5rem; color: #f3c85e; }
      h2 { font-size: 1.25rem; margin: 1.5rem 0 0.25rem; }
      a { color: #f3c85e; }
      a.play { display: inline-block; padding: 0.625rem 1.25rem; border-radius: 0.5rem; background: #9c3b28; color: #fbeedd; text-decoration: none; font-weight: 700; }
      small { color: #b9b19c; }
    </style>
  </head>
  <body>
    <main>
      <p><a href="../../">Kronland</a></p>
      <h1>${esc(p.title.de)}</h1>
      ${p.preview ? `<img src="${esc(p.preview)}" alt="" loading="lazy" />` : ''}
      ${block('de', 'Deutsch', 'Im Spiel öffnen')}
      ${block('en', 'English', 'Open in the game')}
      <p><small>${p.levels ? `${p.levels} Level / levels · ` : ''}${esc(p.id)}</small></p>
    </main>
  </body>
</html>
`;
}

export function sitemapXml(packs, site = SITE_URL) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${packs.map((p) => `  <url><loc>${esc(pageUrl(`level/${p.id}/index.html`, site))}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export default function packPages({ config = CONFIG } = {}) {
  return {
    name: 'kronland:pack-pages',
    async generateBundle() {
      const sources = configSources(config);
      if (!sources.length) return;
      try {
        const packs = await collectPacks(sources, { warn: (m) => this.warn(m) });
        for (const p of packs) this.emitFile({ type: 'asset', fileName: `level/${p.id}/index.html`, source: packPageHtml(p) });
        if (packs.length) this.emitFile({ type: 'asset', fileName: 'sitemap-levels.xml', source: sitemapXml(packs) });
      } catch (e) {
        this.warn(`[kronland:pack-pages] skipped: ${e.message}`);
      }
    },
  };
}
