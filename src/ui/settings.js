// Game settings: small reactive store with get/set and change event.
// Stored in localStorage 'kronland-settings' (language additionally in 'kronland-lang', graphics in quality.js).
// Other modules (audio, renderer) read here with get() and listen via onChange() or the
// window event 'kronland-settings' (detail: { key, value }).

import { reactive } from 'vue';
import { i18n, setLang } from '../i18n/index.js';
import { setQuality } from '../render/quality.js';
import { setPlayerColors, PLAYER_COLOR_IDS } from '../render/playerColors.js';

const KEY = 'kronland-settings';
const QUALITY_KEY = 'kronland.quality';

/**
 * @typedef {Object} Settings
 * @property {'de'|'en'} lang
 * @property {'auto'|'low'|'medium'|'high'} quality
 * @property {number} master overall volume 0…1
 * @property {number} music music 0…1
 * @property {number} effects effects 0…1
 * @property {number} uiScale UI size 0.9…1.3
 * @property {boolean} edgeScroll move the camera at the screen edge (mouse)
 * @property {boolean} hints show help texts in the panels
 * @property {boolean} labels short labels under the icons (build, command and quick bar)
 * @property {boolean} speech read dialogues aloud (MP3 of the scenario or the browser's speech synthesis)
 * @property {boolean} dialogCamera during dialogues the camera moves close to the speaking figure
 * @property {boolean} autosave save automatically (save slot "Autosave")
 * @property {boolean} muted sound off (all sounds, music and voices)
 * @property {'off'|'short'|'normal'|'long'} musicPause pause between two peaceful music pieces
 * @property {number} playerColor colour of the human (index in PLAYER_COLOR_IDS: 0 blue, 1 red, 2 green, 3 ochre); applies from the next game start
 * @property {'off'|'rare'|'often'} barks how often figures say something when selected and on commands
 * @property {boolean} menuMotion moving title backdrop in the menus (MenuBackdrop.vue; never with "reduce motion")
 */

/** Touch device without a fine pointer (phone, tablet): labels are on by default there. */
const coarse = () => { try { return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false; } catch { return false; } };

/** @type {Omit<Settings, 'lang'|'quality'>} */
export const DEFAULTS = { master: 0.8, music: 0.6, effects: 0.8, uiScale: 1, edgeScroll: true, hints: true, labels: coarse(), speech: true, dialogCamera: true, autosave: true, muted: false, musicPause: 'normal', playerColor: 0, barks: 'rare', menuMotion: true };

export const MUSIC_PAUSE_OPTIONS = ['off', 'short', 'normal', 'long'];
export const BARK_OPTIONS = ['off', 'rare', 'often'];

const LIMITS = { master: [0, 1], music: [0, 1], effects: [0, 1], uiScale: [0.9, 1.3] };

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') return v;
  } catch { /* blocked or broken */ }
  return {};
}

function storedQuality() {
  try {
    const q = globalThis.localStorage?.getItem(QUALITY_KEY);
    return q === 'low' || q === 'medium' || q === 'high' ? q : 'auto';
  } catch { return 'auto'; }
}

function sanitize(key, value) {
  if (key in LIMITS) {
    const n = Number(value);
    const [lo, hi] = LIMITS[key];
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : DEFAULTS[key];
  }
  if (key === 'playerColor') { const n = Number(value); return Number.isInteger(n) && n >= 0 && n < PLAYER_COLOR_IDS.length ? n : DEFAULTS.playerColor; }
  if (key === 'musicPause') return MUSIC_PAUSE_OPTIONS.includes(value) ? value : DEFAULTS.musicPause;
  if (key === 'barks') return BARK_OPTIONS.includes(value) ? value : DEFAULTS.barks;
  if (key === 'edgeScroll' || key === 'hints' || key === 'labels' || key === 'speech' || key === 'dialogCamera' || key === 'autosave' || key === 'muted' || key === 'menuMotion') return !!value;
  return value;
}

const saved = load();
const initial = {};
for (const k of Object.keys(DEFAULTS)) initial[k] = k in saved ? sanitize(k, saved[k]) : DEFAULTS[k];

/** Reactive state (read only; change via set()). @type {Settings} */
export const settings = reactive({ ...initial, lang: i18n.lang, quality: storedQuality() });

const target = typeof EventTarget !== 'undefined' ? new EventTarget() : null;

function persist() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = settings[k];
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(out)); } catch { /* private mode */ }
}

/** Read a value. @template {keyof Settings} K @param {K} key @returns {Settings[K]} */
export function get(key) {
  return key === 'lang' ? i18n.lang : settings[key];
}

/**
 * Set a value, store it and report the change.
 * @param {keyof Settings} key
 * @param {any} value
 */
export function set(key, value) {
  if (key === 'lang') {
    if (!setLang(value) && i18n.lang !== value) return;
    settings.lang = i18n.lang;
  } else if (key === 'quality') {
    try { setQuality(value); } catch { return; }
    settings.quality = value;
  } else if (key in DEFAULTS) {
    settings[key] = sanitize(key, value);
    persist();
  } else return;
  if (key === 'uiScale') applyUiScale();
  const detail = { key, value: get(key) };
  target?.dispatchEvent(new CustomEvent('change', { detail }));
  try { globalThis.dispatchEvent?.(new CustomEvent('kronland-settings', { detail })); } catch { /* without DOM */ }
}

/** All values (copy). @returns {Settings} */
export const getAll = () => ({ ...settings, lang: i18n.lang });

/**
 * Listen for changes. @param {(detail: {key: string, value: any}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onChange(fn) {
  const h = (e) => fn(e.detail);
  target?.addEventListener('change', h);
  return () => target?.removeEventListener('change', h);
}

/** Set the UI size as a CSS variable (all HUD dimensions are in rem). */
export function applyUiScale() {
  try { document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale)); } catch { /* without DOM */ }
}

/**
 * Apply the chosen player colour for rendering (at game start, before the models are loaded).
 * Rendering only: the simulation and its state hash stay untouched.
 * @param {number} [human] player number of the human
 */
export function applyPlayerColor(human = 0) {
  setPlayerColors({ human, color: settings.playerColor });
}
