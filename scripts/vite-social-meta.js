// Vite plugin: link previews for social media and messengers (Open Graph, Twitter cards) and the canonical address
// for every page. Title and description come from the page's own <title> and <meta name="description">; the
// preview image is public/og-image.jpg (scripts/og-image.mjs). Crawlers need absolute addresses, hence SITE_URL
// (GitHub Pages, docs/WEBSITE.md); another host sets KRONLAND_SITE_URL at build time.
// Blog articles get their own title and teaser in scripts/vite-blog-pages.js (pageMeta()).

/** Public address of the website (with trailing slash). */
export const SITE_URL = (process.env.KRONLAND_SITE_URL || 'https://kronland.wi7.net/').replace(/\/?$/, '/');
/** Preview image in the website root (without content hash: crawlers keep the address). */
export const OG_IMAGE = { path: 'og-image.jpg', width: 1200, height: 630, alt: 'Kronland' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Address of a page from its HTML file: 'play/index.html' → 'https://…/play/'. */
export function pageUrl(file, site = SITE_URL) {
  return site + file.replace(/^\/+/, '').replace(/(^|\/)index\.html$/, '$1');
}

/** Title and description of a page from its HTML. */
export function readMeta(html) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'Kronland';
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
  return { title: unesc(title), description: unesc(description) };
}

/** Meta tags (one per line) for title, description and address. */
export function socialTags({ title, description, url, type = 'website' }, site = SITE_URL) {
  const img = site + OG_IMAGE.path;
  const tags = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="Kronland" />`,
    `<meta property="og:locale" content="de_DE" />`,
    `<meta property="og:locale:alternate" content="en_US" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
  ];
  return tags.join('\n    ');
}

const BLOCK = /\n?\s*<!-- social -->[\s\S]*?<!-- \/social -->/;

/**
 * Write title, description and preview tags of a page into its HTML (replaces an existing block, so the blog can
 * give each article copy its own values).
 * @param {string} html @param {{ title?: string, description?: string, url: string, type?: string }} meta
 */
export function pageMeta(html, meta, site = SITE_URL) {
  const own = readMeta(html);
  const m = { title: meta.title ?? own.title, description: meta.description ?? own.description, url: meta.url, type: meta.type };
  let out = html.replace(BLOCK, '');
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`);
  if (/<meta name="description" content="[^"]*"/.test(out)) out = out.replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(m.description)}"`);
  return out.replace('</head>', `    <!-- social -->\n    ${socialTags(m, site)}\n    <!-- /social -->\n  </head>`);
}

export default function socialMeta() {
  return {
    name: 'kronland:social-meta',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = (ctx.path ?? '/index.html').replace(/^\//, '').replace(/(^|\/)$/, '$1index.html');
        return pageMeta(html, { url: pageUrl(file) });
      },
    },
  };
}
