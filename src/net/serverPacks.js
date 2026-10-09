// Own packs on the server for the world editor: "Save to server" (upload media, PUT the pack with its level) and
// "open own packs". Media are renamed to their SHA-256 (the pack format wants hash names) and the level's
// references are rewritten accordingly.

import { hashMedia, bothLanguages } from './packBuild.js';
import { NetError } from './errors.js';

export const PACK_FORMAT = 'kronland-pack';

/** Short random id of an own pack: 7 characters, lower case and digits (the server decides whether it is free). */
export function newPackId(random = (a) => globalThis.crypto.getRandomValues(a)) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(random(new Uint8Array(7)), (b) => chars[b % chars.length]).join('');
}

/**
 * Pack document for PUT /api/v1/packs/{id} from the editor's level and its files.
 * @param {any} scenario @param {Map<string, Blob>} files 'assets/x.png' -> file @param {string} id
 * @returns {Promise<{ doc: any, uploads: Array<{ name: string, blob: Blob }> }>}
 */
export async function buildDocument(scenario, files, id, version = '1.0.0') {
  const { scenario: level, media, uploads } = await hashMedia(scenario, files);
  const doc = {
    format: PACK_FORMAT, version: 1, id, title: bothLanguages(level.title, level.id), summary: bothLanguages(level.summary, ''),
    minClient: version, levels: [{ id: level.id, scenario: level }], ...(uploads.length ? { media } : {}),
  };
  return { doc, uploads };
}

/**
 * Save the level as a pack with one level on the server.
 * @param {ReturnType<typeof import('./api.js').createApi>} api
 */
export async function saveToServer(api, scenario, files, id) {
  const { doc, uploads } = await buildDocument(scenario, files, id);
  for (const { name, blob } of uploads) {
    const form = new FormData();
    form.append('file', blob, name);
    await api.post(`/api/v1/packs/${id}/media`, form);
  }
  await api.put(`/api/v1/packs/${id}`, doc);
  return { id, levels: doc.levels.length };
}

/**
 * Own pack for the editor: its first level and media.
 * @returns {Promise<{ id: string, scenario: any, files: Map<string, Blob> }>}
 */
export async function loadOwnPack(api, id) {
  const doc = await api.get(`/api/v1/packs/${id}`);
  const level = doc?.levels?.[0];
  if (!level?.scenario) throw new NetError('packs.err.schema', { path: '/levels/0', detail: 'no level' });
  const files = new Map();
  for (const [name, info] of Object.entries(doc.media ?? {})) {
    const res = await api.fetch(new URL(name, doc.mediaBase ?? `${api.server}/api/v1/packs/${id}/files/`).href);
    if (res.ok) files.set(`assets/${name}`, new Blob([await res.arrayBuffer()], { type: info.type }));
  }
  return { id: doc.id, scenario: level.scenario, files };
}
