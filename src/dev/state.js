// Developer mode: switches and options (small, in the main bundle). The actual tools
// (src/dev/DevTools.js, src/ui/dev/DevPanel.vue) are only loaded on demand when switched on.
//
// Activation: settings → "Developer mode", URL `?dev=1` (or the older `?debug=1`),
// keyboard shortcut F3 or Ctrl+Shift+D. The browser remembers options ('kronland-dev').

import { reactive } from 'vue';

const KEY = 'kronland-dev';

/** Default settings of the tools. */
export const DEV_DEFAULTS = {
  /** panel expanded */
  open: true,
  /** tab in the panel: render | path | grid | units | about */
  tab: 'render',
  /** "Stats for nerds" at the top left */
  stats: true,
  /** wireframe per object group */
  wire: { terrain: false, buildings: false, figures: false, water: false, nature: false },
  /** 'wire' = edges only, 'overlay' = edges over the normal image */
  wireMode: 'overlay',
  /** colour LOD levels (LOD0 green, LOD1 yellow, LOD2 red, LOD3 violet) */
  lodColors: false,
  /** path of the selected figure */
  path: true,
  /** A* search: open and closed list */
  search: true,
  /** colour connected walkable regions */
  regions: false,
  /** playback speed of the A* animation (steps per second) */
  playSpeed: 30,
  /** grid overlay: none | walk | height | build | vision | territory */
  grid: 'none',
  /** draw tile borders in the grid */
  gridLines: true,
  /** figure info: off | selected | all */
  labels: 'selected',
  /** explanatory texts in the panel */
  explain: true,
};

function load() {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

/** Is the mode requested via URL (?dev=1, ?debug=1)? */
export function devRequested(search = globalThis.location?.search ?? '') {
  try {
    const q = new URLSearchParams(search);
    return q.get('dev') === '1' || q.get('debug') === '1';
  } catch { return false; }
}

/**
 * Restrict saved values to known keys and types.
 * @param {any} saved
 */
export function sanitizeDev(saved) {
  const out = structuredClone(DEV_DEFAULTS);
  if (!saved || typeof saved !== 'object') return out;
  for (const [k, def] of Object.entries(DEV_DEFAULTS)) {
    const v = saved[k];
    if (v === undefined) continue;
    if (typeof def === 'object') { for (const w of Object.keys(def)) if (typeof v?.[w] === 'boolean') out[k][w] = v[w]; }
    else if (typeof v === typeof def) out[k] = v;
  }
  if (!['none', 'walk', 'height', 'build', 'vision', 'territory'].includes(out.grid)) out.grid = 'none';
  if (!['off', 'selected', 'all'].includes(out.labels)) out.labels = 'selected';
  if (!['wire', 'overlay'].includes(out.wireMode)) out.wireMode = 'overlay';
  out.playSpeed = Math.min(400, Math.max(1, Math.round(out.playSpeed)));
  return out;
}

const saved = load();

/**
 * Reactive state. `on`: mode active; the remaining fields are options of the tools.
 * @type {typeof DEV_DEFAULTS & { on: boolean }}
 */
export const devState = reactive({ ...sanitizeDev(saved), on: saved.on === true || devRequested() });

/** Save options (without runtime values). */
export function saveDev() {
  const out = { on: devState.on };
  for (const k of Object.keys(DEV_DEFAULTS)) out[k] = devState[k];
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(out)); } catch { /* private mode */ }
}

/** Mode on/off (remembered). */
export function setDevMode(on) {
  devState.on = !!on;
  saveDev();
}

/** Reset all options to default (mode stays on). */
export function resetDev() {
  Object.assign(devState, structuredClone(DEV_DEFAULTS));
  saveDev();
}

/**
 * Keyboard shortcut for the mode: F3 or Ctrl+Shift+D (Cmd+Shift+D on the Mac).
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean }} e
 */
export function isDevHotkey(e) {
  if (e.key === 'F3' && !e.ctrlKey && !e.altKey && !e.metaKey) return true;
  return !!((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'D' || e.key === 'd'));
}
