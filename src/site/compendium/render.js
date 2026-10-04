// Compendium tables as HTML text. The compendium has several thousand cells; as Vue components the build
// would be noticeably slow. All texts come from the game's own data and are escaped anyway.
import { escapeHtml } from '../markdown.js';
import { iconHtml } from '../icons.js';

/**
 * A cell (see generate.js) as HTML.
 * @param {any} c @param {{ res: (id: string) => string }} names
 */
export function cellHtml(c, names) {
  if (c == null) return '';
  if (typeof c !== 'object') return escapeHtml(c);
  if (c.cost) {
    const e = Object.entries(c.cost).filter(([, n]) => n);
    if (!e.length) return '–';
    return `<span class="w-cost">${e.map(([r, n]) => `<span class="w-res" title="${escapeHtml(names.res(r))}">${iconHtml(r)}<span class="num">${n}</span><span class="sr-only"> ${escapeHtml(names.res(r))}</span></span>`).join('')}</span>`;
  }
  if (c.list) return `<span class="w-list">${c.list.map((x) => cellHtml(x, names)).join(', ')}</span>`;
  const icon = c.icon ? iconHtml(c.icon) : '';
  const cls = c.cls ? ` ${escapeHtml(c.cls)}` : '';
  if (c.href) return `<a href="${escapeHtml(c.href)}" class="w-link${cls}">${icon}${escapeHtml(c.t)}</a>`;
  return `<span class="w-t${cls}">${icon}${escapeHtml(c.t ?? '')}</span>`;
}

/** Table (block of type 'table') as HTML. */
export function tableHtml(b, names) {
  const num = (k) => (b.cols[k]?.num ? ' class="num"' : '');
  const head = b.cols.map((c, k) => `<th scope="col"${num(k)}>${escapeHtml(c.label)}</th>`).join('');
  const rows = b.rows.map((r) => `<tr${r.id ? ` id="${escapeHtml(r.id)}"` : ''}>${r.cells.map((c, k) => (k === 0
    ? `<th scope="row">${cellHtml(c, names)}</th>`
    : `<td${num(k)}>${cellHtml(c, names)}</td>`)).join('')}</tr>`).join('');
  return `<table${b.id ? ` id="${escapeHtml(b.id)}" data-testid="compendium-table-${escapeHtml(b.id)}"` : ''}>${b.caption ? `<caption>${escapeHtml(b.caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Fact sheet (block of type 'facts') as HTML. */
export function factsHtml(b, names) {
  return b.items.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${cellHtml(value, names)}</dd></div>`).join('');
}
