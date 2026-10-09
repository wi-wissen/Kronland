// SHA-256 as hex (Web Crypto: browser and Node 20+). Separate file so scripts can use it without the JSON imports of packs.js.
import { NetError } from './errors.js';

/** @param {Uint8Array|ArrayBuffer|string} data */
export async function sha256Hex(data) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new NetError('packs.err.crypto');
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
