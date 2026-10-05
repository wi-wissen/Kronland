// Audio settings: volumes per bus and mute.
// Stored in localStorage under 'kronland-audio' (JSON). A settings UI can
// - call setAudioSetting()/setAudioSettings() or
// - write the key itself and then fire the window event 'kronland-settings'.
// The AudioEngine listens to 'kronland-settings' (and 'storage' for other tabs) and takes over the values.

export const AUDIO_SETTINGS_KEY = 'kronland-audio';
export const SETTINGS_EVENT = 'kronland-settings';

/** @typedef {'off'|'short'|'normal'|'long'} MusicPause */
/** @typedef {'off'|'rare'|'often'} BarkMode */
/** @typedef {{ master: number, music: number, sfx: number, ambient: number, ui: number, muted: boolean, musicPause: MusicPause, barks: BarkMode }} AudioSettings */

/** @type {AudioSettings} */
export const AUDIO_DEFAULTS = Object.freeze({ master: 0.8, music: 0.6, sfx: 0.8, ambient: 0.7, ui: 0.7, muted: false, musicPause: 'normal', barks: 'rare' });

const BARK_MODES = ['off', 'rare', 'often'];

/** Silence between two peace pieces (build, winter) in seconds [min, max]; only ambience in between. */
export const MUSIC_PAUSES = Object.freeze({ off: [2, 4], short: [20, 45], normal: [60, 120], long: [150, 300] });

export const VOLUME_KEYS = /** @type {const} */ (['master', 'music', 'sfx', 'ambient', 'ui']);

/** German labels for a settings UI (player-visible). */
export const AUDIO_LABELS = { master: 'Gesamt', music: 'Musik', sfx: 'Effekte', ambient: 'Umgebung', ui: 'Oberfläche', muted: 'Stumm', musicPause: 'Musikpausen', barks: 'Sprüche der Figuren' };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Check raw values (from storage or event) and fill in defaults.
 * @param {any} raw
 * @param {AudioSettings} [base]
 * @returns {AudioSettings}
 */
export function normalizeSettings(raw, base = AUDIO_DEFAULTS) {
  const out = { ...base };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of VOLUME_KEYS) {
    const v = Number(raw[k]);
    if (raw[k] !== undefined && raw[k] !== null && Number.isFinite(v)) out[k] = clamp01(v > 1 ? v / 100 : v);
  }
  // The game settings call the effects bus "effects"
  const fx = Number(raw.effects);
  if (raw.sfx === undefined && raw.effects !== undefined && raw.effects !== null && Number.isFinite(fx)) out.sfx = clamp01(fx > 1 ? fx / 100 : fx);
  if (typeof raw.muted === 'boolean') out.muted = raw.muted;
  else if (typeof raw.mute === 'boolean') out.muted = raw.mute;
  if (typeof raw.musicPause === 'string' && raw.musicPause in MUSIC_PAUSES) out.musicPause = raw.musicPause;
  if (BARK_MODES.includes(raw.barks)) out.barks = raw.barks;
  return out;
}

/**
 * Apply the content of a 'kronland-settings' event to the current values.
 * Accepts { audio: {...} }, { master, music, ... } directly or { key: 'audio.music', value }.
 * @param {AudioSettings} current
 * @param {any} detail
 * @returns {AudioSettings|null} new values or null if the event concerns nothing audible
 */
export function applySettingsDetail(current, detail) {
  if (!detail || typeof detail !== 'object') return null;
  if (detail.audio && typeof detail.audio === 'object') return normalizeSettings(detail.audio, current);
  if (typeof detail.key === 'string') {
    let k = detail.key.replace(/^audio[.:/]/, '');
    if (k === 'effects') k = 'sfx';
    if (k === 'muted' || k === 'mute') return normalizeSettings({ muted: !!detail.value }, current);
    if (k === 'musicPause') return normalizeSettings({ musicPause: detail.value }, current);
    if (k === 'barks') return normalizeSettings({ barks: detail.value }, current);
    if (VOLUME_KEYS.includes(/** @type {any} */ (k))) return normalizeSettings({ [k]: detail.value }, current);
    return null;
  }
  const touches = [...VOLUME_KEYS, 'effects', 'muted', 'mute', 'musicPause', 'barks'].some((k) => k in detail);
  return touches ? normalizeSettings(detail, current) : null;
}

/** Access to localStorage that does not throw in Node, private windows and with blocked storage. */
export const safeStorage = {
  get(key) { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
  set(key, v) { try { globalThis.localStorage?.setItem(key, v); return true; } catch { return false; } },
};

/** @returns {AudioSettings} */
export function loadAudioSettings(storage = safeStorage) {
  const raw = storage.get(AUDIO_SETTINGS_KEY);
  if (!raw) return { ...AUDIO_DEFAULTS };
  try { return normalizeSettings(JSON.parse(raw)); } catch { return { ...AUDIO_DEFAULTS }; }
}

/** @param {AudioSettings} s */
export function saveAudioSettings(s, storage = safeStorage) {
  return storage.set(AUDIO_SETTINGS_KEY, JSON.stringify(normalizeSettings(s)));
}

/** Send an event to all listeners (AudioEngine, settings UI); source 'audio' prevents loops. */
export function broadcastAudioSettings(settings) {
  try {
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { audio: settings, source: 'audio' } }));
    }
  } catch { /* without window: nothing to do */ }
}

/**
 * For the settings UI: set several values, save and announce them.
 * @param {Partial<AudioSettings>} patch
 * @returns {AudioSettings}
 */
export function setAudioSettings(patch) {
  const next = normalizeSettings(patch, loadAudioSettings());
  saveAudioSettings(next);
  broadcastAudioSettings(next);
  return next;
}

/** Set one value, e.g. setAudioSetting('music', 0.4) or setAudioSetting('muted', true). */
export function setAudioSetting(key, value) { return setAudioSettings({ [key]: value }); }

/** Current values (from storage). */
export function getAudioSettings() { return loadAudioSettings(); }
