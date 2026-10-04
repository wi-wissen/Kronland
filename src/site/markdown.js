// Small Markdown renderer for manual and compendium texts (own, trusted content).
// Supports: headings (# … ####, anchor via {#id}), paragraphs, lists (also nested, 2 spaces),
// tables (|…|), quotes/notes (> …), horizontal rule (---), images (alone on a line → <figure>),
// **bold**, *italic*, `code`, [link](target), [[key]] → <kbd>, placeholders {{name}} from `vars`, \* escaped.
// Relative image and link targets are resolved against the website root (`base`), anchors (#…) stay.

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

function inline(s, opt) {
  const base = opt.base ?? '';
  const out = [];
  // Extract code spans first so nothing inside them is rendered
  s = s.replace(/`([^`]+)`/g, (m, c) => { out.push(`<code>${escapeHtml(c)}</code>`); return `\u0000${out.length - 1}\u0000`; });
  // Escaped characters (\*, \_, \[ …) stay literal
  s = s.replace(/\\([\\`*_[\]{}#|])/g, (m, c) => { out.push(escapeHtml(c)); return `\u0000${out.length - 1}\u0000`; });
  s = escapeHtml(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${isAbs(src) ? src : base + src}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<kbd>$1</kbd>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const ext = /^https?:/i.test(href);
    return `<a href="${isAbs(href) ? href : base + href}"${ext ? ' rel="noopener"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => out[Number(i)]);
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
      const src = isAbs(img[2]) ? img[2] : (opt.base ?? '') + img[2];
      // smaller version for narrow screens (opt.small returns its path or null)
      const small = opt.small?.(img[2]);
      const set = small ? ` srcset="${isAbs(small) ? small : (opt.base ?? '') + small} 720w, ${src} 1440w" sizes="(max-width: 760px) 100vw, 50rem"` : '';
      html.push(`<figure><img src="${src}"${set} alt="${escapeHtml(img[1])}" loading="lazy" decoding="async"><figcaption>${inline(img[1], opt)}</figcaption></figure>`);
    } else html.push(`<p>${inline(p, opt)}</p>`);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

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
