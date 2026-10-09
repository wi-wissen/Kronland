// Static pages for level packs at build time: configured sources, unreachable ones skipped, never fatal.
import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configSources, collectPacks, packPageHtml, sitemapXml } from '../../scripts/vite-pack-pages.js';
import { fixtureFetch, ORIGIN } from './helpers.js';

const cfg = (o) => { const f = join(mkdtempSync(join(tmpdir(), 'kcfg-')), 'c.json'); writeFileSync(f, JSON.stringify(o)); return f; };

describe('pack pages', () => {
  it('no sources (the shipped config) = nothing to do', () => {
    expect(configSources()).toEqual([]);
    expect(configSources('/does/not/exist.json')).toEqual([]);
    expect(configSources(cfg({ format: 'kronland-config', version: 1, sources: [] }))).toEqual([]);
  });

  it('server catalog first, then the sources; only http(s)', () => {
    const list = configSources(cfg({ server: 'https://api.example/', sources: ['https://a.example/catalog.json', 'ftp://x', 'https://api.example/catalog.json'] }));
    expect(list).toEqual(['https://api.example/catalog.json', 'https://a.example/catalog.json']);
  });

  it('collects open packs; unreachable and broken sources are skipped with a warning', async () => {
    const warn = vi.fn();
    const f = fixtureFetch({ '/broken.json': '{nope' });
    const packs = await collectPacks([`${ORIGIN}/catalog.json`, `${ORIGIN}/missing.json`, `${ORIGIN}/broken.json`], { fetch: f, warn });
    expect(packs.map((p) => p.id)).toEqual(['wi7.adventures-2']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('source skipped');
  });

  it('a network failure does not throw', async () => {
    const warn = vi.fn();
    const f = fixtureFetch(); f.state.down = true;
    expect(await collectPacks([`${ORIGIN}/catalog.json`], { fetch: f, warn })).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('page: title, escaped texts, link into the game; sitemap lists the address', async () => {
    const [pack] = await collectPacks([`${ORIGIN}/catalog.json`], { fetch: fixtureFetch(), warn: () => {} });
    pack.title = { de: 'A <b> & "B"', en: 'C' };
    const html = packPageHtml(pack, 'https://example.org/');
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;B&quot; – Kronland</title>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('href="../../play/?play=wi7.adventures-2"');
    expect(html).toContain('<link rel="canonical" href="https://example.org/level/wi7.adventures-2/" />');
    expect(html).toContain(pack.preview);
    expect(sitemapXml([pack], 'https://example.org/')).toContain('<loc>https://example.org/level/wi7.adventures-2/</loc>');
  });
});
