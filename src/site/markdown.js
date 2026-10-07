// Small Markdown renderer for manual and compendium texts (own, trusted content).
// Supports: headings (# … ####, anchor via {#id}), paragraphs, lists (also nested, 2 spaces),
// tables (|…|), quotes/notes (> …), horizontal rule (---), images (alone on a line → <figure>),
// code blocks (```, optionally ```lang file/path: language for simple highlighting, path as a label), **bold**, *italic*, `code`, [link](target), [[key]] → <kbd>, placeholders {{name}} from `vars`, \* escaped.
// Relative image and link targets are resolved against the website root (`base`), anchors (#…) stay.

import { assetPath } from '../paths.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

/** Anchor from a text (umlauts stay readable). */
export function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const isAbs = (u) => /^([a-z]+:|#|\/)/i.test(u);
/** Image relative to the root → URL (hashed file in the build, see src/paths.js). */
const imgSrc = (src, base) => (isAbs(src) ? src : base + assetPath(src));

function inline(s, opt) {
  const base = opt.base ?? '';
  const out = [];
  // Extract code spans first so nothing inside them is rendered
  s = s.replace(/`([^`]+)`/g, (m, c) => { out.push(`<code>${escapeHtml(c)}</code>`); return `\u0000${out.length - 1}\u0000`; });
  // Escaped characters (\*, \_, \[ …) stay literal
  s = s.replace(/\\([\\`*_[\]{}#|])/g, (m, c) => { out.push(escapeHtml(c)); return `\u0000${out.length - 1}\u0000`; });
  s = escapeHtml(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${imgSrc(src, base)}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<kbd>$1</kbd>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const ext = /^https?:/i.test(href);
    return `<a href="${isAbs(href) ? href : base + href}"${ext ? ' rel="noopener"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => out[Number(i)]);
}

// Simple syntax highlighting for code blocks with a language (```js, ```python, ```pseudo, ```bash):
// comments, strings, numbers and keywords become <span class="tk-…">. Without a language nothing changes.
const KEYWORDS = {
  js: 'async await break case catch class const continue default do else export extends false for from function if import in let new null of return static switch this throw true try typeof undefined while yield',
  python: 'and as break class continue def elif else False for from if import in is lambda None not or pass return True while with yield',
  pseudo: 'and bis do else end for function if not or repeat return then until while solange wenn dann sonst für jede jeden jedes in gib zurück funktion ende und oder nicht wiederhole',
  bash: 'cd do done echo export fi for if in then while',
};
const LANG_ALIAS = { javascript: 'js', mjs: 'js', py: 'python', sh: 'bash', shell: 'bash', pseudocode: 'pseudo' };
const COMMENT = { js: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`, python: '#[^\\n]*', bash: '#[^\\n]*', pseudo: String.raw`\/\/[^\n]*|#[^\n]*` };
const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + '`(?:[^`\\\\]|\\\\.)*`';
const NUMBER = String.raw`\b(?:0x[0-9a-f]+|\d[\d_]*(?:\.\d+)?)\b`;
const WORD = String.raw`[A-Za-zÄÖÜäöüß_$][\wÄÖÜäöüß$]*`;

/** Code → HTML with token spans (unknown language: only escaped). @param {string} code @param {string} lang */
export function highlight(code, lang) {
  const l = LANG_ALIAS[lang] ?? lang;
  if (!KEYWORDS[l]) return escapeHtml(code);
  const kw = new Set(KEYWORDS[l].split(' '));
  const re = new RegExp(`(${COMMENT[l]})|(${STRING})|(${NUMBER})|(${WORD})`, 'gi');
  let out = '', last = 0;
  for (const m of code.matchAll(re)) {
    out += escapeHtml(code.slice(last, m.index));
    last = m.index + m[0].length;
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : kw.has(m[4]) ? 'k' : null;
    out += cls ? `<span class="tk-${cls}">${escapeHtml(m[0])}</span>` : escapeHtml(m[0]);
  }
  return out + escapeHtml(code.slice(last));
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/**
 * Markdown → HTML.
 * @param {string} src
 * @param {{ vars?: Record<string, any>, base?: string, idPrefix?: string, small?: (src: string) => string|null }} [opt]
 * @returns {{ html: string, headings: { level: number, id: string, text: string }[] }}
 */
export function renderMarkdown(src, opt = {}) {
  const vars = opt.vars ?? {};
  const text = String(src ?? '').replace(/\r\n?/g, '\n')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  const lines = text.split('\n');
  const headings = [];
  const used = new Set();
  const html = [];
  let para = [];

  const flush = () => {
    if (!para.length) return;
    const p = para.join(' ').trim();
    para = [];
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(p);
    if (img) {
      const src = imgSrc(img[2], opt.base ?? '');
      // smaller version for narrow screens (opt.small returns its path or null)
      const small = opt.small?.(img[2]);
      const set = small ? ` srcset="${imgSrc(small, opt.base ?? '')} 720w, ${src} 1440w" sizes="(max-width: 760px) 100vw, 50rem"` : '';
      html.push(`<figure><img src="${src}"${set} alt="${escapeHtml(img[1])}" loading="lazy" decoding="async"><figcaption>${inline(img[1], opt)}</figcaption></figure>`);
    } else html.push(`<p>${inline(p, opt)}</p>`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

    // Code block: literal, indentation stays (Python)
    if (/^\s*```/.test(line)) {
      flush();
      const [, lang = '', file = ''] = /^\s*```\s*([\w-]*)\s*(.*?)\s*$/.exec(line) ?? [];
      const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      const pre = lang
        ? `<pre class="lang-${escapeHtml(lang)}"><code>${highlight(code.join('\n'), lang.toLowerCase())}</code></pre>`
        : `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
      html.push(file ? `<figure class="code"><figcaption>${escapeHtml(file)}</figcaption>${pre}</figure>` : pre);
      continue;
    }

    const h = /^(#{1,4})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      let id = (opt.idPrefix ?? '') + (h[3] ?? slugify(h[2]));
      while (used.has(id)) id += '-2';
      used.add(id);
      const inner = inline(h[2], opt);
      headings.push({ level, id, text: inner.replace(/<[^>]+>/g, '') });
      html.push(`<h${level} id="${id}">${inner}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html.push('<hr>'); continue; }

    if (/^\s*>/.test(line)) {
      flush();
      const block = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) block.push(lines[i++].replace(/^\s*>\s?/, ''));
      i--;
      html.push(`<blockquote>${renderMarkdown(block.join('\n'), { ...opt, idPrefix: undefined }).html}</blockquote>`);
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(':') ? ' class="num"' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      i--;
      // scrollable table: reachable by keyboard and labelled (column headers)
      const label = escapeHtml(head.map((c) => c.replace(/[*`[\]]/g, '')).join(' · '));
      html.push(`<div class="tbl-wrap" tabindex="0" role="region" aria-label="${label}"><table><thead><tr>`
        + head.map((c, k) => `<th scope="col"${align[k] ?? ''}>${inline(c, opt)}</th>`).join('')
        + '</tr></thead><tbody>'
        + rows.map((r) => `<tr>${r.map((c, k) => `<td${align[k] ?? ''}>${inline(c, opt)}</td>`).join('')}</tr>`).join('')
        + '</tbody></table></div>');
      continue;
    }

    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      // List with indentation (2 spaces per level) and continuation lines
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m) { items.push({ depth: Math.floor(m[1].length / 2), ordered: /\d/.test(m[2]), text: m[3] }); i++; continue; }
        if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].text += ` ${lines[i].trim()}`; i++; continue; }
        break;
      }
      i--;
      html.push(renderList(items, 0, opt).html);
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return { html: html.join('\n'), headings };
}

function renderList(items, start, opt) {
  const depth = items[start].depth;
  const tag = items[start].ordered ? 'ol' : 'ul';
  let out = `<${tag}>`;
  let i = start;
  while (i < items.length && items[i].depth >= depth) {
    if (items[i].depth > depth) {
      const sub = renderList(items, i, opt);
      out = out.replace(/<\/li>$/, `${sub.html}</li>`);
      i = sub.next;
      continue;
    }
    out += `<li>${inline(items[i].text, opt)}</li>`;
    i++;
  }
  return { html: `${out}</${tag}>`, next: i };
}
