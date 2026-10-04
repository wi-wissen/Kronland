// Paths to the site root (folder with models/, audio/, icons …), relative to the current page.
// The game lives under play/, with the start page/manual/compendium next to it. Each page sets, before its scripts,
// window.KRONLAND_ROOT (play/index.html: '../'); if missing, './' applies (page lives in the root).
// All paths stay relative so the build (Vite `base: './'`) can be hosted in any subfolder.

/** Prefix to the site root, always with a trailing '/' (e.g. '../' or './'). */
export function siteRoot() {
  const r = globalThis.KRONLAND_ROOT;
  if (typeof r === 'string' && r) return r.endsWith('/') ? r : `${r}/`;
  return './';
}

/**
 * Address of a file relative to the site root.
 * @param {string} path e.g. 'models/', 'audio/manifest.json'
 */
export function siteUrl(path) {
  return siteRoot() + String(path ?? '').replace(/^(\.\/|\/)+/, '');
}
