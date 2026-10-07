// Mouse cursors over the map: announce what a right click would do with the selection
// (axe on a tree, pickaxe on a pile, hammer on a construction site, sword on an enemy).
// Own drawings (32×32, same outline as the icon set), tool tilted with its head to the top left.

/** @typedef {'attack'|'chop'|'mine'|'build'} CursorKind */

const O = '#2b1d12';
const SW = `stroke="${O}" stroke-width="1.6" stroke-linejoin="round"`;
const STEEL = '#dfe4ea', WOOD = '#9a6a3c', GOLD = '#e0b54a';
const handle = (y, h) => `<rect x="14.5" y="${y}" width="3" height="${h}" rx="1" fill="${WOOD}" ${SW}/>`;

/** Tool drawn upright, turned so its head points to the top left; hot spot in cursor coordinates. */
const TOOLS = {
  attack: {
    hot: [5, 5],
    svg: `<path d="M16 1.5 19 5v15h-6V5z" fill="${STEEL}" ${SW}/><path d="M16 4v15" stroke="#fff" stroke-width="1" opacity="0.7"/>`
      + `<rect x="9" y="20" width="14" height="3" rx="1" fill="${GOLD}" ${SW}/>${handle(23, 6)}<circle cx="16" cy="30" r="1.8" fill="${GOLD}" ${SW}/>`,
  },
  chop: {
    hot: [7, 8],
    svg: `${handle(5, 26)}<path d="M14.5 5 7 2.5Q2.5 9 7 15.5L14.5 12z" fill="${STEEL}" ${SW}/><path d="M17.5 6h2.5v5h-2.5z" fill="${STEEL}" ${SW}/>`,
  },
  mine: {
    hot: [8, 8],
    svg: `${handle(8, 23)}<path d="M2.5 12Q16 1 29.5 12L27.5 13.5Q16 5.5 4.5 13.5z" fill="${STEEL}" ${SW}/><rect x="13.5" y="6" width="5" height="5" rx="1" fill="${WOOD}" ${SW}/>`,
  },
  build: {
    hot: [8, 8],
    svg: `${handle(10, 21)}<rect x="7" y="3" width="18" height="8" rx="1.5" fill="#8b8f97" ${SW}/><path d="M9 5h14" stroke="#fff" stroke-width="1" opacity="0.5"/>`,
  },
};

const cache = new Map();

/**
 * CSS cursor value for a cursor kind; null gives the normal pointer.
 * @param {CursorKind|null} kind
 */
export function cursorCss(kind) {
  const t = kind && TOOLS[kind];
  if (!t) return '';
  if (!cache.has(kind)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="rotate(-45 16 16)">${t.svg}</g></svg>`;
    cache.set(kind, `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${t.hot[0]} ${t.hot[1]}, pointer`);
  }
  return cache.get(kind);
}

/** All cursor kinds (tests, preview). */
export const CURSOR_KINDS = Object.keys(TOOLS);
