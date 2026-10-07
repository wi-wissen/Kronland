// Layout of the code panel (ScriptPanel.vue) – pure, testable (tests/ui/splitLayout.test.js).
//   split: desktop/tablet landscape – game left, program right, draggable divider, collapsible to a strip.
//   sheet: phone (portrait or small) – program as a full-screen sheet, "watch game" mode while it runs.

/** localStorage key: { frac, collapsed } */
export const SPLIT_KEY = 'kronland-code-split';
/** Default share of the window width for the program */
export const SPLIT_DEFAULT = 0.46;
/** Narrowest program panel (px) */
export const PANEL_MIN = 340;
/** Game area that always stays visible next to the panel (px) */
export const GAME_MIN = 420;
/** Width of the collapsed strip "‹ Program" (px) */
export const STRIP_W = 36;

/**
 * Which layout fits the window: phones and portrait tablets get the sheet, everything else the split screen.
 * @param {number} w window width (CSS px) @param {number} h window height
 * @returns {'split'|'sheet'}
 */
export function layoutMode(w, h) {
  return w < 760 || h < 560 || (h > w && w < 1024) ? 'sheet' : 'split';
}

/**
 * Panel width within limits: at least PANEL_MIN, the game keeps at least GAME_MIN (if the window allows both).
 * @param {number} px desired width @param {number} total window width
 */
export function clampWidth(px, total) {
  const max = Math.max(PANEL_MIN, total - GAME_MIN);
  const v = Number.isFinite(px) ? px : total * SPLIT_DEFAULT;
  return Math.round(Math.min(max, Math.max(PANEL_MIN, v)));
}

/**
 * Width in pixels the panel takes up in the split screen (collapsed: only the strip).
 * @param {{ frac: number, collapsed: boolean }} split @param {number} total window width
 */
export function panelWidth(split, total) {
  return split.collapsed ? STRIP_W : clampWidth(split.frac * total, total);
}

/**
 * Share of the window after dragging the divider to clientX (panel is on the right).
 * @param {number} clientX @param {number} total
 */
export function fracFromPointer(clientX, total) {
  return clampWidth(total - clientX, total) / Math.max(1, total);
}

/** Read stored split settings (broken or missing values → defaults). */
export function loadSplit(storage = globalThis.localStorage) {
  let v = null;
  try { v = JSON.parse(storage?.getItem(SPLIT_KEY) ?? 'null'); } catch { v = null; }
  const frac = typeof v?.frac === 'number' && v.frac > 0.05 && v.frac < 0.95 ? v.frac : SPLIT_DEFAULT;
  return { frac, collapsed: v?.collapsed === true };
}

/** Store split settings (private mode: silently not). */
export function saveSplit(split, storage = globalThis.localStorage) {
  try { storage?.setItem(SPLIT_KEY, JSON.stringify({ frac: Math.round(split.frac * 1000) / 1000, collapsed: !!split.collapsed })); } catch { /* private mode */ }
}
