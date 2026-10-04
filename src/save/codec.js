// Compression for stored save games: gzip (CompressionStream) + Base64, prefix 'gz:'.
// Without CompressionStream (older browsers) the JSON text is stored unchanged with prefix 'js:'.
// A typical save shrinks to about a seventh (160 kB → 23 kB).

const hasGzip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * @param {string} text JSON text
 * @param {{ compress?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function encode(text, { compress = true } = {}) {
  if (compress && hasGzip()) {
    try { return 'gz:' + bytesToB64(await pipe(new TextEncoder().encode(text), new CompressionStream('gzip'))); } catch { /* below: uncompressed */ }
  }
  return 'js:' + text;
}

/** @param {string} stored @returns {Promise<string>} JSON text */
export async function decode(stored) {
  if (typeof stored !== 'string') throw new Error('not a text');
  if (stored.startsWith('js:')) return stored.slice(3);
  if (stored.startsWith('gz:')) {
    if (!hasGzip()) throw new Error('gzip not available');
    return new TextDecoder().decode(await pipe(b64ToBytes(stored.slice(3)), new DecompressionStream('gzip')));
  }
  // Without prefix: plain JSON text (earlier format)
  return stored;
}
