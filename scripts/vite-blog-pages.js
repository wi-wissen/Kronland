// Vite plugin: article pages of the blog. Each article has its own address blog/<name>/ but is the same page as
// the overview (blog/index.html, src/site/blog/): the page reads the name from the address.
// - Build: for each article from src/site/blog/posts/<name>.<de|en>.md writes a copy of the finished blog/index.html
//   to blog/<name>/index.html, relative references one level deeper. The service worker picks them up like any page.
// - Dev server: blog/<name>/ serves blog/index.html.
// A new article therefore only needs its Markdown files (docs/WEBSITE.md).

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pageMeta, pageUrl } from './vite-social-meta.js';

const POSTS_DIR = resolve(import.meta.dirname, '../src/site/blog/posts');
const NAME = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(de|en)\.md$/;

/** Names of all articles (from the file names). */
export function blogSlugs(dir = POSTS_DIR) {
  return [...new Set(readdirSync(dir).map((f) => NAME.exec(f)?.[1]).filter(Boolean))].sort();
}

/** HTML of the overview for an article one folder level deeper: relative references (../…) get one more ../. */
export function articleHtml(html) {
  return html.replace(/(\s(?:src|href)=")\.\.\//g, '$1../../');
}

/** Title and teaser of an article from the front matter of its German Markdown file (link previews). */
export function articleMeta(slug, dir = POSTS_DIR) {
  const src = readFileSync(resolve(dir, `${slug}.de.md`), 'utf8');
  const head = /^---\n([\s\S]*?)\n---/.exec(src)?.[1] ?? '';
  const field = (k) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(head)?.[1]?.trim();
  return { title: field('title'), teaser: field('teaser') };
}

export default function blogPages() {
  return {
    name: 'kronland:blog-pages',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^(.*\/blog\/)([a-z0-9-]+)\/(?:index\.html)?(\?.*)?$/.exec(req.url ?? '');
        if (m && blogSlugs().includes(m[2])) req.url = `${m[1]}index.html${m[3] ?? ''}`;
        next();
      });
    },
    generateBundle(options, bundle) {
      const page = bundle['blog/index.html'];
      if (!page) return;
      const source = articleHtml(String(page.source));
      for (const slug of blogSlugs()) {
        // own link preview per article: its title and teaser
        const { title, teaser } = articleMeta(slug);
        const html = pageMeta(source, { title: title ? `${title} – Kronland` : undefined, description: teaser, url: pageUrl(`blog/${slug}/index.html`), type: 'article' });
        this.emitFile({ type: 'asset', fileName: `blog/${slug}/index.html`, source: html });
      }
    },
  };
}
