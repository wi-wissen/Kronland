// File manifest: public/audio/manifest.json lists available audio files (e.g. from Stable Audio).
// If a file or the manifest is missing, the game plays the synthesised sound or the generative music.
// Pure functions (resolving, selecting) are testable in Node; loading happens in AudioEngine.
//
// Format (see docs/AUDIO.md):
// {
//   "version": 1,
//   "music": { "build": ["music/build-1.ogg", "music/build-2.ogg"], "battle": "music/battle.ogg", "menu": [] },
//   "sfx":   { "chop": ["sfx/chop-1.ogg", "sfx/chop-2.ogg"], "coin": { "files": ["sfx/coin.ogg"], "gain": 0.8 } },
//   "ambient": { "summer": "ambient/summer.ogg", "rain": "ambient/rain.ogg" }
// }

export const MANIFEST_URL = 'audio/manifest.json';
export const CATEGORIES = /** @type {const} */ (['music', 'sfx', 'ambient']);
const EXT = /\.(ogg|oga|mp3|m4a|aac|wav|webm|opus|flac)$/i;

/** @typedef {{ files: string[], gain: number, loop?: boolean }} ManifestEntry */
/** @typedef {{ music: Record<string, ManifestEntry>, sfx: Record<string, ManifestEntry>, ambient: Record<string, ManifestEntry> }} Manifest */

/** Empty manifest (everything synthetic). @returns {Manifest} */
export const emptyManifest = () => ({ music: {}, sfx: {}, ambient: {} });

/** Path in the manifest → URL (base = audio/ folder relative to the page, see src/paths.js); only relative paths inside audio/ are allowed. */
export function resolvePath(p, base = 'audio/') {
  if (typeof p !== 'string') return null;
  const s = p.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!s || s.includes('..') || /^[a-z]+:/i.test(s) || s.startsWith('/') || !EXT.test(s)) return null;
  const b = base.endsWith('/') ? base : base + '/';
  return b + (s.startsWith('audio/') ? s.slice(6) : s);
}

/**
 * Validate and normalise raw JSON. Invalid entries are silently discarded.
 * @param {any} raw
 * @param {string} [base] URL prefix of the audio files (default 'audio/', matching Vite base './')
 * @returns {Manifest}
 */
export function parseManifest(raw, base = 'audio/') {
  const out = emptyManifest();
  if (!raw || typeof raw !== 'object') return out;
  for (const cat of CATEGORIES) {
    const sec = raw[cat];
    if (!sec || typeof sec !== 'object') continue;
    for (const [name, v] of Object.entries(sec)) {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) continue;
      let list = [], gain = 1, loop;
      if (typeof v === 'string') list = [v];
      else if (Array.isArray(v)) list = v;
      else if (v && typeof v === 'object') {
        list = Array.isArray(v.files) ? v.files : typeof v.file === 'string' ? [v.file] : [];
        if (Number.isFinite(Number(v.gain))) gain = Math.max(0, Math.min(4, Number(v.gain)));
        if (typeof v.loop === 'boolean') loop = v.loop;
      }
      const files = list.map((p) => resolvePath(p, base)).filter(Boolean);
      if (files.length) out[cat][name] = loop === undefined ? { files, gain } : { files, gain, loop };
    }
  }
  return out;
}

/**
 * Find the entry for a sound: exact name, then fallback names (e.g. 'clash' for 'clashHeavy').
 * @param {Manifest} m @param {'music'|'sfx'|'ambient'} cat @param {string} name @param {string[]} [fallbacks]
 * @returns {ManifestEntry|null}
 */
export function lookup(m, cat, name, fallbacks = []) {
  const sec = m?.[cat];
  if (!sec) return null;
  for (const n of [name, ...fallbacks]) if (sec[n]?.files?.length) return sec[n];
  return null;
}

/**
 * Pick a file from an entry without repeating the last one played (if possible).
 * @param {ManifestEntry} entry @param {() => number} rnd @param {string|null} [last]
 */
export function pickFile(entry, rnd, last = null) {
  const f = entry.files;
  if (f.length === 1) return f[0];
  const pool = last ? f.filter((x) => x !== last) : f;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

/** All files named in the manifest (for preloading). @param {Manifest} m */
export function allFiles(m) {
  const s = new Set();
  for (const cat of CATEGORIES) for (const e of Object.values(m[cat])) for (const f of e.files) s.add(f);
  return [...s];
}
