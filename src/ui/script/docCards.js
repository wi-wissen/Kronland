// Doc cards for the code editor (hover, long-press, help list): command data from commandDocs.js with
// Markdown rendered to HTML. Loaded lazily (docsLoader.js) – the texts are ~60 kB per language.

import { commandDoc, COMMANDS, DOCS } from './commandDocs.js';
import { renderMarkdown } from '../../site/markdown.js';

/** Inline Markdown → HTML (without the surrounding paragraph). Trusted texts from src/ui/script/docs/. */
const inline = (s) => renderMarkdown(s ?? '', {}).html.replace(/^\s*<p>|<\/p>\s*$/g, '');

/** Is the name documented (also names explained together with another, e.g. max → min)? */
export const isKnown = (name) => commandDoc(name, 'de') !== null;

/**
 * Card data for a command, or null.
 * @param {string} name @param {'de'|'en'} lang
 */
export function cardFor(name, lang) {
  const c = commandDoc(name, lang);
  if (!c) return null;
  const D = DOCS[lang] ?? DOCS.de;
  return {
    name: c.name,
    sig: c.sig,
    group: D.groupTitles?.[c.group] ?? c.group,
    level: c.level,
    shortHtml: inline(c.short),
    descHtml: inline(c.description),
    params: c.params.map((p) => ({ name: p.name, type: p.type, html: inline(p.text) })),
    returnsHtml: c.returns ? inline(c.returns) : '',
    example: c.example,
    url: c.url,
    labels: D.labels,
  };
}

/**
 * All commands for the help list: { name, sig, group, groupTitle, short, level } in the order of the reference.
 * @param {'de'|'en'} lang
 */
export function commandList(lang) {
  const D = DOCS[lang] ?? DOCS.de;
  return COMMANDS.map((c) => {
    const d = commandDoc(c.name, lang);
    return { name: c.name, sig: c.sig, group: c.group, groupTitle: D.groupTitles?.[c.group] ?? c.group, short: d.short, level: c.level, py: c.py };
  });
}
