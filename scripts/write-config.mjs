// Writes public/kronland.config.json from the environment (docs/SERVER.md#konfiguration), used by the Pages workflow:
//   KRONLAND_SERVER   base URL of the server, e.g. https://api.example.org
//   KRONLAND_SOURCES  further catalog.json addresses, separated by comma or whitespace
// Nothing set = no file is written and the game runs without server (stage 0). Without arguments it writes to
// public/; `node scripts/write-config.mjs <path>` writes elsewhere.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** @param {Record<string, string|undefined>} env @returns {object|null} config document, or null if nothing is set */
export function configFromEnv(env) {
  const server = (env.KRONLAND_SERVER ?? '').trim().replace(/\/+$/, '');
  const sources = (env.KRONLAND_SOURCES ?? '').split(/[\s,]+/).filter(Boolean);
  if (!server && !sources.length) return null;
  const ok = (u) => /^https?:\/\/[^\s]+$/.test(u);
  if (server && !ok(server)) throw new Error(`KRONLAND_SERVER is not an http(s) address: ${server}`);
  const bad = sources.find((s) => !ok(s));
  if (bad) throw new Error(`KRONLAND_SOURCES contains no http(s) address: ${bad}`);
  return { format: 'kronland-config', version: 1, ...(server ? { server } : {}), sources: [...new Set(sources)] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = configFromEnv(process.env);
  if (!doc) console.log('write-config: KRONLAND_SERVER/KRONLAND_SOURCES not set, no configuration written (stage 0)');
  else {
    const out = resolve(process.argv[2] ?? 'public/kronland.config.json');
    writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`write-config: ${out}`);
  }
}
