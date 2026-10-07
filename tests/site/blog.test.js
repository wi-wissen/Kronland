// Blog and milestones: docs/milestones.json in order (one commit on main per milestone), every milestone with an
// article in DE and EN, source links, article loader, addresses of the article pages.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import MILESTONES from '../../docs/milestones.json';
import { POSTS, loadPosts, parseFrontMatter, postIn, postSections, slugFromLocation } from '../../src/site/blog/posts.js';
import { blogVars, totals, spanText, longDate, calendarDays, sourceLinks, REPO_URL } from '../../src/site/blog/milestones.js';
import { blogSlugs, articleHtml } from '../../scripts/vite-blog-pages.js';
import STRINGS from '../../src/site/strings.js';

const ROOT = resolve(import.meta.dirname, '../..');
const SHA = /^[0-9a-f]{40}$/;
const t = (iso) => Date.parse(iso);

describe('Milestones (docs/milestones.json)', () => {
  it('10 to 20 milestones with unique ids, titles, summaries and a commit field', () => {
    expect(MILESTONES.length).toBeGreaterThanOrEqual(10);
    expect(MILESTONES.length).toBeLessThanOrEqual(20);
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
    for (const m of MILESTONES) {
      for (const k of ['title_de', 'title_en', 'summary_de', 'summary_en']) expect(m[k], `${m.id}.${k}`).toMatch(/\S{3}/);
      expect(typeof m.commit, m.id).toBe('string');
      if (m.commit) expect(m.commit, m.id).toMatch(SHA);
      for (const k of ['files_changed', 'insertions', 'deletions', 'tests_vitest', 'tests_e2e']) expect(m[k], `${m.id}.${k}`).toBeGreaterThanOrEqual(0);
    }
    const commits = MILESTONES.map((m) => m.commit).filter(Boolean);
    expect(new Set(commits).size).toBe(commits.length);
  });

  it('times ascending', () => {
    for (const [i, m] of MILESTONES.entries()) {
      expect(t(m.date_start), m.id).toBeLessThanOrEqual(t(m.date_end));
      expect(t(m.work_start), m.id).toBeLessThanOrEqual(t(m.date_start));
      if (i) expect(t(MILESTONES[i - 1].date_end), m.id).toBeLessThanOrEqual(t(m.date_start));
    }
  });

  // Only once the commits are filled in and present (CI may clone shallow): in milestone order on main's first-parent chain
  const filled = MILESTONES.every((m) => m.commit);
  let chain = null;
  if (filled) {
    try {
      execFileSync('git', ['cat-file', '-e', `${MILESTONES[0].commit}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
      chain = execFileSync('git', ['rev-list', '--first-parent', '--reverse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
    } catch { chain = null; }
  }
  it.skipIf(!chain)('each milestone is one commit on main, in order (git)', () => {
    const at = MILESTONES.map((m) => chain.indexOf(m.commit));
    for (const [i, a] of at.entries()) expect(a, MILESTONES[i].id).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('metrics and time values', () => {
    const s = totals();
    expect(s.milestones).toBe(MILESTONES.length);
    expect(s.days).toBe(calendarDays(MILESTONES[0].date_start, MILESTONES.at(-1).date_end));
    expect(calendarDays('2026-10-03T11:51:52+02:00', '2026-10-06T19:12:10+02:00')).toBe(4);
    expect(longDate('2026-10-03T11:51:52+02:00', 'de')).toBe('3. Oktober 2026, 11:51 Uhr');
    expect(longDate('2026-10-03T11:51:52+02:00', 'en')).toBe('3 October 2026, 11:51');
    expect(spanText('2026-10-03T12:07:52+02:00', '2026-10-03T12:08:15+02:00', 'de')).toBe('3. Okt. · 12:07–12:08');
    expect(spanText('2026-10-03T19:46:00+02:00', '2026-10-04T02:45:00+02:00', 'en')).toBe('3 Oct 19:46 – 4 Oct 02:45');
  });

  it('source links: commit and tree of the milestone, main without a commit', () => {
    expect(REPO_URL).toBe('https://github.com/wi-wissen/Kronland');
    const sha = 'a'.repeat(40);
    expect(sourceLinks({ commit: sha })).toEqual({ commit: `${REPO_URL}/commit/${sha}`, tree: `${REPO_URL}/tree/${sha}` });
    expect(sourceLinks({ commit: '' })).toEqual({ commit: `${REPO_URL}/tree/main`, tree: `${REPO_URL}/tree/main` });
    for (const k of ['blog.src.commit', 'blog.src.tree']) {
      expect(STRINGS.de[k], k).toBeTruthy();
      expect(STRINGS.en[k], k).toBeTruthy();
    }
    expect(STRINGS.de['blog.src.commit']).toBe('Code dieses Meilensteins');
    expect(STRINGS.de['blog.src.tree']).toBe('Projekt zu diesem Stand');
    const vue = readFileSync(resolve(ROOT, 'src/site/blog/Blog.vue'), 'utf8');
    expect(vue).toContain('data-testid="blog-src-commit"');
    expect(vue).toContain('data-testid="blog-src-tree"');
  });
});

describe('Blog', () => {
  it('every milestone has an article in DE and EN, dated at its end', () => {
    for (const m of MILESTONES) {
      const post = POSTS.find((p) => p.slug === m.id);
      expect(post, m.id).toBeTruthy();
      expect(post.milestone).toBe(true);
      for (const lang of ['de', 'en']) {
        const text = post.langs[lang];
        expect(text, `${m.id}.${lang}`).toBeTruthy();
        expect(text.title).toBe(m[`title_${lang}`]);
        expect(text.date).toBe(m.date_end);
        expect(text.teaser.length).toBeGreaterThan(20);
      }
    }
  });

  it('order: pinned intro, then the milestones in order', () => {
    expect(POSTS[0].slug).toBe('about');
    expect(POSTS[0].pinned).toBe(true);
    expect(POSTS.filter((p) => p.milestone).map((p) => p.slug)).toEqual(MILESTONES.map((m) => m.id));
  });

  it('no pull request numbers or pull requests in articles and summaries', () => {
    const texts = [
      ...POSTS.flatMap((p) => Object.entries(p.langs).map(([lang, x]) => [`${p.slug}.${lang}`, `${x.title}\n${x.teaser}\n${x.body}`])),
      ...MILESTONES.flatMap((m) => ['de', 'en'].map((l) => [`milestone ${m.id}.${l}`, `${m[`title_${l}`]}\n${m[`summary_${l}`]}`])),
    ];
    for (const [where, s] of texts) {
      expect(s, where).not.toMatch(/#\d+/);
      expect(s, where).not.toMatch(/pull request/i);
      expect(s, where).not.toMatch(/\bPRs?\b/);
    }
  });

  it('all articles: same chapters in both languages, no open placeholders', () => {
    for (const post of POSTS) {
      const de = postSections(post.langs.de, 'de', '../../');
      const en = postSections(post.langs.en, 'en', '../../');
      expect(de.length, post.slug).toBeGreaterThanOrEqual(3);
      expect(en.map((s) => s.id), post.slug).toEqual(de.map((s) => s.id));
      for (const s of [...de, ...en]) expect(s.html, `${post.slug}#${s.id}`).not.toMatch(/\{\{|undefined/);
    }
    const intro = postSections(postIn(POSTS[0], 'de'), 'de', '../../').map((s) => s.html).join('');
    expect(intro).toContain(blogVars('de').days);
    expect(intro).toContain('Rückblick');
    expect(intro).toContain('href="../../manual/#licenses"');
    expect(postSections(postIn(POSTS[0], 'en'), 'en', '../../').map((s) => s.html).join('')).toContain('hindsight');
  });

  it('images in articles exist under public/ (convention: public/blog/<article>/…)', () => {
    for (const post of POSTS) {
      for (const [lang, text] of Object.entries(post.langs)) {
        for (const m of text.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
          const src = m[1];
          if (/^[a-z]+:/i.test(src)) continue;
          expect(existsSync(resolve(ROOT, 'public', src)), `${post.slug}.${lang}: ${src}`).toBe(true);
          if (src.startsWith('blog/')) expect(src.split('/')[1], `${post.slug}.${lang}: ${src}`).toBe(post.slug);
        }
      }
    }
  });

  it('front matter, sorting and missing language', () => {
    expect(parseFrontMatter('---\ntitle: "A: B"\ndate: 2026-10-06\n---\n\n## X {#x}\n')).toEqual({ meta: { title: 'A: B', date: '2026-10-06' }, body: '\n## X {#x}\n' });
    const posts = loadPosts({
      './posts/b.de.md': '---\ntitle: B\ndate: 2026-10-05\n---\n## B {#b}',
      './posts/a.de.md': '---\ntitle: A\ndate: 2026-10-04T10:00:00+02:00\n---\n## A {#a}',
      './posts/a.en.md': '---\ntitle: A en\ndate: 2026-10-04T10:00:00+02:00\n---\n## A {#a}',
      './posts/z.de.md': '---\ntitle: Z\ndate: 2026-12-01\npinned: true\n---\n## Z {#z}',
      './posts/Ungültig.de.md': '---\ntitle: X\n---',
    });
    expect(posts.map((p) => p.slug)).toEqual(['z', 'a', 'b']);
    expect(postIn(posts[2], 'en').title).toBe('B');
  });

  it('addresses of the article pages', () => {
    expect(slugFromLocation({ pathname: '/blog/simulation-core/', search: '' })).toBe('simulation-core');
    expect(slugFromLocation({ pathname: '/kronland/blog/campaign/index.html', search: '' })).toBe('campaign');
    expect(slugFromLocation({ pathname: '/blog/', search: '?post=economy' })).toBe('economy');
    expect(slugFromLocation({ pathname: '/blog/index.html', search: '' })).toBe(null);
    expect(blogSlugs()).toEqual(POSTS.map((p) => p.slug).sort());
    expect(articleHtml('<script src="../assets/a.js"></script><link href="../favicon.ico"><a href="https://x/../y">'))
      .toBe('<script src="../../assets/a.js"></script><link href="../../favicon.ico"><a href="https://x/../y">');
    const html = readFileSync(resolve(ROOT, 'blog/index.html'), 'utf8');
    expect(html).toContain("'../../' : '../'");
  });

  it('website texts of the blog in both languages', () => {
    for (const k of ['nav.blog', 'blog.title', 'blog.lead', 'blog.milestone', 'blog.fact.testsVal', 'home.learn.blog']) {
      expect(STRINGS.de[k], k).toBeTruthy();
      expect(STRINGS.en[k], k).toBeTruthy();
    }
  });
});
