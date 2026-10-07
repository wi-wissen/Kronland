// Link previews: Open Graph tags per page, own values per blog article, preview image present.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { pageMeta, pageUrl, readMeta, OG_IMAGE } from '../../scripts/vite-social-meta.js';
import { articleMeta, blogSlugs } from '../../scripts/vite-blog-pages.js';

const HTML = `<!doctype html><html><head>
    <meta name="description" content="Bauen &amp; kämpfen" />
    <title>Kronland – Spielen</title>
  </head><body></body></html>`;
const SITE = 'https://example.org/';

describe('Open Graph', () => {
  it('page addresses from the HTML file', () => {
    expect(pageUrl('index.html', SITE)).toBe('https://example.org/');
    expect(pageUrl('play/index.html', SITE)).toBe('https://example.org/play/');
    expect(pageUrl('blog/about/index.html', SITE)).toBe('https://example.org/blog/about/');
  });

  it('tags from title and description, absolute image', () => {
    const out = pageMeta(HTML, { url: SITE + 'play/' }, SITE);
    expect(readMeta(out)).toEqual({ title: 'Kronland – Spielen', description: 'Bauen & kämpfen' });
    expect(out).toContain('<meta property="og:title" content="Kronland – Spielen" />');
    expect(out).toContain('<meta property="og:description" content="Bauen &amp; kämpfen" />');
    expect(out).toContain(`<meta property="og:image" content="${SITE}${OG_IMAGE.path}" />`);
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(out).toContain(`<link rel="canonical" href="${SITE}play/" />`);
  });

  it('a second pass replaces the block (blog article copies)', () => {
    const page = pageMeta(HTML, { url: SITE + 'blog/' }, SITE);
    const art = pageMeta(page, { title: 'Ein "Artikel"', description: 'Teaser', url: SITE + 'blog/x/', type: 'article' }, SITE);
    expect(art.match(/og:title/g)).toHaveLength(1);
    expect(art).toContain('<title>Ein &quot;Artikel&quot;</title>');
    expect(art).toContain('content="article"');
    expect(art).toContain(`content="${SITE}blog/x/"`);
    expect(art).not.toContain(`content="${SITE}blog/"`);
  });

  it('every blog article has title and teaser; preview image is 1200×630 JPEG', () => {
    for (const slug of blogSlugs()) {
      const m = articleMeta(slug);
      expect(m.title, slug).toBeTruthy();
      expect(m.teaser, slug).toBeTruthy();
    }
    const file = 'public/' + OG_IMAGE.path;
    expect(existsSync(file)).toBe(true);
    const buf = readFileSync(file);
    expect(buf[0]).toBe(0xff); expect(buf[1]).toBe(0xd8);
    expect(buf.length).toBeLessThan(250_000);
  });
});
