// Building packs: levels with their files become the hash-named files of the pack format (docs/SERVER.md).
// Used by the editor ("Save to server", serverPacks.js) and by scripts/build-pack.mjs (static sources).
// Pure functions without network or JSON imports, so Node can run them too.

import { sha256Hex } from './hash.js';
import { ASSET_TYPES, extOf } from '../levels/assets.js';

/**
 * Rename the media a level uses to their SHA-256 and rewrite its references (assets/<name> -> assets/<sha>.<ext>).
 * Files the level does not mention are left out.
 * @param {any} scenario @param {Map<string, Blob>} files 'assets/x.png' -> file
 * @returns {Promise<{ scenario: any, media: Record<string, { type: string, bytes: number }>, uploads: Array<{ name: string, blob: Blob }> }>}
 */
export async function hashMedia(scenario, files) {
  let json = JSON.stringify(scenario);
  const media = {}, uploads = [];
  // longest names first: "assets/a.png" must not eat the start of "assets/a.png2.png"
  for (const [path, blob] of [...files].sort((a, b) => b[0].length - a[0].length)) {
    const ext = extOf(path);
    if (!ASSET_TYPES[ext] || !json.includes(path)) continue;
    const name = `${await sha256Hex(new Uint8Array(await blob.arrayBuffer()))}.${ext === 'jpeg' ? 'jpg' : ext}`;
    json = json.split(path).join(`assets/${name}`);
    media[name] = { type: ASSET_TYPES[ext], bytes: blob.size };
    uploads.push({ name, blob });
  }
  return { scenario: JSON.parse(json), media, uploads };
}

/** {de, en} from a text, a half-filled text or nothing. */
export function bothLanguages(t, fallback = '') {
  const o = typeof t === 'string' ? { de: t, en: t } : t ?? {};
  return { de: o.de ?? o.en ?? fallback, en: o.en ?? o.de ?? fallback };
}

/**
 * Files of a pack from levels: pack.json and every level and media file named after its SHA-256.
 * @param {{ id: string, title: any, summary?: any, author?: string, license?: string, minClient?: string, kind?: string, difficulty?: string, minutes?: number }} info
 * @param {Array<{ scenario: any, files?: Map<string, Blob> }>} levels
 * @returns {Promise<{ manifest: string, hash: string, files: Map<string, Uint8Array|Blob>, pack: any }>}
 */
export async function buildPackFiles(info, levels) {
  const files = new Map(), media = {};
  const list = [];
  for (const l of levels) {
    const h = await hashMedia(l.scenario, l.files ?? new Map());
    const bytes = new TextEncoder().encode(JSON.stringify(h.scenario));
    const file = `${await sha256Hex(bytes)}.json`;
    files.set(file, bytes);
    list.push({ id: h.scenario.id, file });
    Object.assign(media, h.media);
    for (const u of h.uploads) files.set(u.name, u.blob);
  }
  const preview = Object.keys(media).find((n) => /\.(png|jpe?g|webp)$/.test(n));
  const pack = {
    format: 'kronland-pack', version: 1, id: info.id, title: bothLanguages(info.title, info.id),
    ...(info.summary ? { summary: bothLanguages(info.summary) } : {}),
    ...(info.author ? { author: info.author } : {}), ...(info.license ? { license: info.license } : {}),
    ...(info.minClient ? { minClient: info.minClient } : {}),
    ...(info.kind ? { kind: info.kind } : {}), ...(info.difficulty ? { difficulty: info.difficulty } : {}), ...(Number.isInteger(info.minutes) ? { minutes: info.minutes } : {}),
    ...(preview ? { preview } : {}), levels: list, ...(Object.keys(media).length ? { media } : {}),
  };
  const manifest = JSON.stringify(pack, null, 2) + '\n';
  return { manifest, hash: await sha256Hex(manifest), files, pack };
}
