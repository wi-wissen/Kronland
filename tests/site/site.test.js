// Website: Markdown renderer, manual (both languages structured the same, images present), texts, paths.
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderMarkdown, slugify } from '../../src/site/markdown.js';
import { manualSections } from '../../src/site/manual/content.js';
import { manualVars, creditsMarkdown } from '../../src/site/manual/vars.js';
import STRINGS from '../../src/site/strings.js';
import { siteRoot, siteUrl } from '../../src/paths.js';
import { pageLinks } from '../../src/site/site.js';
import { atlasCss, iconHtml } from '../../src/site/icons.js';
import { ATLAS_INDEX } from '../../src/ui/icons/atlas.js';

describe('Markdown', () => {
  it('headings with anchor, lists, tables, notes, images, inline', () => {
    const src = [
      '## Titel {#eigene-id}', '', 'Text mit **fett**, *kursiv*, `code` und [[Esc]] und [Link](compendium/#b-farm).', '',
      '- eins', '  - unter', '- zwei', '', '1. a', '2. b', '',
      '| A | B |', '|---|---:|', '| x | 1 |', '', '> **Tipp:** so', '', '![Bild](site/x.webp)', '', '### Unter Überschrift',
    ].join('\n');
    const { html, headings } = renderMarkdown(src, { base: '../' });
    expect(headings.map((h) => h.id)).toEqual(['eigene-id', 'unter-ueberschrift']);
    expect(html).toContain('<strong>fett</strong>');
    expect(html).toContain('<em>kursiv</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<kbd>Esc</kbd>');
    expect(html).toContain('href="../compendium/#b-farm"');
    expect(html).toMatch(/<ul><li>eins<ul><li>unter<\/li><\/ul><\/li><li>zwei<\/li><\/ul>/);
    expect(html).toContain('<ol><li>a</li><li>b</li></ol>');
    expect(html).toContain('<td class="num">1</td>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<figure><img src="../site/x.webp"');
  });

  it('escapes HTML and fills placeholders', () => {
    const { html } = renderMarkdown('a <script>x</script> {{n}} {{missing}}', { vars: { n: 42 } });
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('42');
    expect(html).toContain('{{missing}}');
  });

  it('code blocks stay verbatim with indentation', () => {
    const { html, headings } = renderMarkdown('```\nfor i in range(3):\n    # kein Titel\n    hero.step() < 2\n```\nDanach');
    expect(html).toContain('<pre><code>for i in range(3):\n    # kein Titel\n    hero.step() &lt; 2</code></pre>');
    expect(headings).toEqual([]);
    expect(html).toContain('<p>Danach</p>');
  });

  it('anchor from umlauts', () => { expect(slugify('Größe & Übersicht')).toBe('groesse-uebersicht'); });
});

describe('Manual', () => {
  const de = manualSections('de', '../');
  const en = manualSections('en', '../');

  it('both languages have the same chapters (same anchors)', () => {
    expect(de.length).toBeGreaterThanOrEqual(15);
    expect(en.map((s) => s.id)).toEqual(de.map((s) => s.id));
    for (const id of ['getting-started', 'controls', 'interface', 'bridges', 'slope', 'saving', 'coding', 'developer-mode', 'faq', 'licenses']) expect(de.map((s) => s.id)).toContain(id);
  });

  it('all placeholders filled, acknowledgements included', () => {
    for (const s of [...de, ...en]) expect(s.html, s.id).not.toMatch(/\{\{\w+\}\}/);
    expect(de.find((s) => s.id === 'licenses').html).toContain('KayKit');
    expect(creditsMarkdown('# T\n\n## A\n[x](docs/A.md) [y](https://e.org)')).toBe('### A\nx [y](https://e.org)');
  });

  it('numbers come from the game data', () => {
    const v = manualVars('de');
    expect(v.paydaySec).toBe(120);
    expect(v.taxTable.split('\n').length).toBe(2 + 5);
    expect(v.campaignList.split('\n').length).toBe(6);
  });

  it('used images are in public/site', () => {
    const imgs = new Set([...de, ...en].flatMap((s) => [...s.html.matchAll(/(?:src="|srcset="|, )\.\.\/(site\/[^"\s]+)/g)].map((x) => x[1])));
    expect([...imgs].some((p) => p.endsWith('-small.webp'))).toBe(true);
    expect(imgs.size).toBeGreaterThan(3);
    for (const p of imgs) expect(existsSync(resolve('public', p)), p).toBe(true);
  });
});

describe('Website images', () => {
  it('home page: every gallery image exists large and small, texts present', () => {
    const src = readFileSync(resolve('src/site/home/Home.vue'), 'utf8');
    const shots = JSON.parse(/shots: (\[[^\]]+\])/.exec(src)[1].replace(/'/g, '"'));
    expect(shots).toContain('slope');
    expect(shots).toContain('developer');
    for (const n of [...shots, 'hero']) expect(existsSync(resolve('public/site', `${n}.webp`)), n).toBe(true);
    for (const n of shots) {
      expect(existsSync(resolve('public/site', `${n}-small.webp`)), n).toBe(true);
      for (const l of ['de', 'en']) expect(STRINGS[l][`home.shot.${n}`], `${l} ${n}`).toBeTruthy();
    }
  });

  it('images are small enough (WebP, gallery ≤ 120 kB, large ≤ 300 kB)', () => {
    const dir = resolve('public/site');
    const files = readdirSync(dir);
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      expect(f, f).toMatch(/\.webp$/);
      const kb = statSync(resolve(dir, f)).size / 1024;
      expect(kb, f).toBeLessThanOrEqual(f.endsWith('-small.webp') ? 120 : 300);
    }
  });
});

describe('Website texts and paths', () => {
  afterEach(() => { delete globalThis.KRONLAND_ROOT; });

  it('DE and EN have the same keys without empty values', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.de).sort());
    for (const l of ['de', 'en']) for (const [k, v] of Object.entries(STRINGS[l])) expect(v, `${l} ${k}`).toBeTruthy();
  });

  it('base URL to the website root', () => {
    expect(siteRoot()).toBe('./');
    expect(siteUrl('models/')).toBe('./models/');
    globalThis.KRONLAND_ROOT = '..';
    expect(siteRoot()).toBe('../');
    expect(siteUrl('/audio/manifest.json')).toBe('../audio/manifest.json');
    expect(siteUrl('./sw.js')).toBe('../sw.js');
  });
});

describe('Website addresses', () => {
  it('English paths: manual/ and compendium/', () => {
    expect(pageLinks('../')).toEqual({ home: '../', play: '../play/', manual: '../manual/', compendium: '../compendium/' });
    for (const p of ['manual', 'compendium']) expect(existsSync(resolve(p, 'index.html')), p).toBe(true);
  });

  it('all pages are in the Vite configuration', () => {
    const cfg = readFileSync(resolve('vite.config.js'), 'utf8');
    for (const p of ['play', 'manual', 'compendium']) expect(cfg).toContain(`'${p}/index.html'`);
  });
});

describe('Website icons', () => {
  it('coloured icons come from the game atlas, UI icons stay masks', () => {
    expect(ATLAS_INDEX.gold).toBeDefined();
    expect(atlasCss('gold', 'icons/symbols.webp')).toMatch(/^background-image:url\(&quot;icons\/symbols\.webp&quot;\);background-size:1200% 800%;background-position:0% 0%$/);
    expect(iconHtml('gold')).toContain('class="ico atlas"');
    expect(iconHtml('weather-winter')).toContain('class="ico atlas"');
    expect(atlasCss('play')).toBeNull();
    expect(iconHtml('play')).toContain('ico glyph');
  });
});
