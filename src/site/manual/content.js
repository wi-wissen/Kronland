// Manual content: Markdown per language (de.md, en.md) with placeholders from the game data (vars.js),
// split into chapters (##). New chapters: add a heading `## Title {#same-id}` to both files.

import { renderMarkdown } from '../markdown.js';
import { manualVars } from './vars.js';
import de from './de.md?raw';
import en from './en.md?raw';
import credits from '../../../CREDITS.md?raw';

const SOURCES = { de, en };

/** Screenshots that have a small version `<name>-small.webp` (scripts/site-screens.py). */
export const SMALL_SHOTS = ['settlement', 'combat', 'winter', 'fog', 'phone', 'slope', 'developer'];
const small = (src) => {
  const m = /^site\/([\w-]+)\.webp$/.exec(src);
  return m && SMALL_SHOTS.includes(m[1]) ? `site/${m[1]}-small.webp` : null;
};

/**
 * Split the manual into chapters (##) and render them.
 * @param {string} lang @param {string} base path to the website root
 */
export function manualSections(lang, base = './') {
  const vars = manualVars(lang, credits);
  const src = SOURCES[lang] ?? SOURCES.de;
  const parts = src.split(/^(?=## )/m).filter((p) => p.trim());
  return parts.map((p) => {
    const { html, headings } = renderMarkdown(p, { vars, base, small });
    const h2 = headings.find((h) => h.level === 2) ?? { id: 'intro', text: '' };
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    return { id: h2.id, title: h2.text, html, subs: headings.filter((h) => h.level === 3), plain };
  });
}

