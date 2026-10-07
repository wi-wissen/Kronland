// Minimal static file server for tests that need control over the served build (deploy simulation in
// e2e/update.spec.js, load measurements). Headers like GitHub Pages: `Cache-Control: max-age=600` on every file,
// ETag/Last-Modified, `/dir` → 301 `/dir/`. The served folder can be switched at runtime (`setRoot`): that is a deploy.
// Counts the bytes sent per path, so a test can tell what really came over the network.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webm': 'audio/webm',
};

/**
 * @param {{ root: string, port: number }} opts
 * @returns {Promise<{ setRoot: (dir: string) => void, sent: Map<string, number>, reset: () => void, close: () => Promise<void> }>}
 */
export async function startStaticServer({ root, port }) {
  let dir = root;
  /** bytes of response bodies per path (304 and HEAD count 0) */
  const sent = new Map();
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    let file = normalize(join(dir, path));
    if (!file.startsWith(normalize(dir))) { res.writeHead(403).end(); return; }
    let st;
    try { st = statSync(file); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    if (st.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
      file = join(file, 'index.html');
      try { st = statSync(file); } catch { res.writeHead(404).end(); return; }
    }
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'max-age=600', ETag: etag, 'Last-Modified': st.mtime.toUTCString(),
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') { res.end(); return; }
    sent.set(path, (sent.get(path) ?? 0) + st.size);
    createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, resolve));
  return {
    setRoot: (d) => { dir = d; },
    sent,
    reset: () => sent.clear(),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
