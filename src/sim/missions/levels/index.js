// Bundled levels: one folder per level with scenario.json, .py files and assets/ (docs/SKRIPTE.md#level-ordner).
// New level: create a folder – it is found automatically. Kind 'adventure' appears under "Lernabenteuer",
// kind 'mission' under the script missions, 'campaign' and 'tutorial' are chapters of the campaign (registry.js);
// `order` sorts them.
// Vite (game, tests) bundles the files; plain Node (scripts/) reads the folders from disk.

import { packLevel } from '../../scripting/scenario.js';

/** 'folder/file' → text of all scenario.json and .py files. */
function readFolders() {
  const fs = process.getBuiltinModule('node:fs');
  const root = new URL('./', import.meta.url);
  const out = {};
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(new URL(`${dir.name}/`, root))) {
      if (/\.(json|py)$/.test(f)) out[`${dir.name}/${f}`] = fs.readFileSync(new URL(`${dir.name}/${f}`, root), 'utf8');
    }
  }
  return out;
}

const RAW = import.meta.env
  ? Object.fromEntries(Object.entries(import.meta.glob('./*/*.{json,py}', { query: '?raw', import: 'default', eager: true })).map(([k, v]) => [k.slice(2), v]))
  : readFolders();

const folders = {};
for (const key of Object.keys(RAW).sort()) {
  const [dir, file] = key.split('/');
  (folders[dir] ??= {})[file] = RAW[key];
}

const byOrder = (a, b) => (a.order ?? 100) - (b.order ?? 100) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** All bundled levels, packed (every section carries its code), with the folder name in `folder`. */
export const LEVELS = Object.entries(folders)
  .filter(([, files]) => files['scenario.json'])
  .map(([dir, files]) => ({ ...packLevel(JSON.parse(files['scenario.json']), (name) => files[name]), folder: dir }));

/** Coding adventures in order. */
export const ADVENTURES = LEVELS.filter((s) => s.kind === 'adventure').sort(byOrder);

/** Scenarios that are played like missions (Python instead of a mission file). */
export const SCRIPT_MISSIONS = LEVELS.filter((s) => s.kind === 'mission').sort(byOrder);

export const SCENARIOS = [...ADVENTURES, ...SCRIPT_MISSIONS];

/** Campaign chapters and the tutorial that are level folders (the registry merges them with the mission files). */
export const CAMPAIGN_LEVELS = LEVELS.filter((s) => s.kind === 'campaign' || s.kind === 'tutorial').sort(byOrder);
