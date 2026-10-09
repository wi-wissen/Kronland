// Mock server for the game API (contract/openapi.yaml) - no dependencies, no database, all state in memory.
// Serves the fixtures of contract/fixtures/, a mini sign-in page with real PKCE (S256) checking, cloud saves,
// own packs and progress events. For development, Vitest (tests/net) and Playwright (e2e/server.spec.js).
//
//   node scripts/mock-server.mjs [--port 4400] [--game http://localhost:5173/play/]
//   game: http://localhost:5173/play/?config=http://localhost:4400/kronland.config.json
//
// Static source of the example: <origin>/static/catalog.json. Server catalog: <origin>/catalog.json.

import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = new URL('../contract/', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
const json = (p) => JSON.parse(read(p).toString('utf8'));
const sha = (data) => createHash('sha256').update(data).digest('hex');
const rand = (n = 24) => randomBytes(n).toString('base64url');
const FILE_TYPES = { json: 'application/json', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', mp3: 'audio/mpeg', ogg: 'audio/ogg', glb: 'model/gltf-binary' };
const SCHEMAS = Object.fromEntries(['progress', 'pack-document', 'saves'].map((n) => [n, json(`schemas/${n}.schema.json`)]));
const { validate, validateDef } = await import('../src/net/schema.js');

/**
 * @param {{ port?: number, game?: string, tokenTtl?: number }} [opts] tokenTtl: lifetime of access tokens in seconds
 * @returns {Promise<{ url: string, close(): Promise<void>, state: any }>}
 */
export async function startMockServer({ port = 0, game = 'http://localhost:4173/play/', tokenTtl = 3600 } = {}) {
  const secret = rand();
  /** State, visible to tests as `state`. */
  const state = {
    codes: new Map(), access: new Map(), refresh: new Map(), revoked: [], // log of /oauth/revoke calls
    saves: new Map(), packs: new Map(), media: new Map(), progress: [], origin: '',
  };
  const reset = () => {
    for (const k of ['codes', 'saves', 'packs', 'media']) state[k].clear(); // tokens stay: a reset is not a sign-out
    state.progress.length = 0;
    state.revoked.length = 0;
    for (const e of json('fixtures/saves.json').saves) {
      const { etag, ...entry } = e;
      const envelope = json('fixtures/save-s1.json');
      envelope.meta = { ...envelope.meta, ...Object.fromEntries(['name', 'savedAt', 'tick', 'mode', 'mission', 'seed', 'players', 'fog'].map((k) => [k, e[k]])) };
      state.saves.set(e.id, { entry, envelope, etag: 1 });
    }
    state.packs.set('k7m2q9', json('fixtures/pack-document.json'));
  };
  reset();

  const send = (res, status, body, headers = {}) => {
    const isJson = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
    const data = body === null ? '' : isJson ? JSON.stringify(body) : body;
    res.writeHead(status, { 'Content-Type': isJson ? 'application/json' : 'text/plain; charset=utf-8', ...headers });
    res.end(data);
  };
  const fail = (res, status, code, params = {}) => send(res, status, { error: { code, params } });
  const body = async (req) => { const parts = []; for await (const c of req) parts.push(c); return Buffer.concat(parts); };
  const formOrJson = async (req) => {
    const raw = (await body(req)).toString('utf8');
    return (req.headers['content-type'] ?? '').includes('json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
  };
  const abs = (path) => state.origin + path;
  const bearer = (req) => { const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? ''); const t = m && state.access.get(m[1]); return t && t.expires > Date.now() ? t : null; };

  const sign = (id, expires) => createHmac('sha256', secret).update(`${id}.${expires}`).digest('hex');
  const signedUrl = (id, ttl = 3600) => { const expires = Math.floor(Date.now() / 1000) + ttl; return abs(`/api/v1/saves/${id}?expires=${expires}&signature=${sign(id, expires)}`); };

  /** pack.json (and files) of an own pack from its document */
  const buildPack = (doc) => {
    const files = new Map();
    const levels = doc.levels.map((l) => { const text = JSON.stringify(l.scenario); const file = `${sha(text)}.json`; files.set(file, { data: Buffer.from(text), type: 'application/json' }); return { id: l.id, file }; });
    for (const name of Object.keys(doc.media ?? {})) if (state.media.has(name)) files.set(name, state.media.get(name));
    const { levels: _l, mediaBase: _m, ...rest } = doc;
    return { manifest: { ...rest, levels }, files };
  };
  const ownEntry = (id, doc) => ({ id, title: doc.title, summary: doc.summary ?? { de: '', en: '' }, levels: doc.levels.length, access: 'open', own: true, manifest: abs(`/api/v1/packs/${id}/manifest`) });
  const saveEntry = (id) => { const s = state.saves.get(id); return { ...s.entry, etag: String(s.etag) }; };

  async function handle(req, res) {
    const url = new URL(req.url, state.origin);
    const path = url.pathname, method = req.method;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, Accept', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' };
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
    if (method === 'OPTIONS') return send(res, 204, null);
    let m;

    // ----- static files: fixtures as server catalog, as static source, as pack files -----
    if (path === '/kronland.config.json') return send(res, 200, { format: 'kronland-config', version: 1, server: state.origin, sources: [abs('/static/catalog.json')] });
    if (path === '/catalog.json') return send(res, 200, json('fixtures/catalog-server.json'));
    if (path === '/static/catalog.json') return send(res, 200, json('fixtures/catalog-static.json'));
    if ((m = /^\/(?:static|packs\/wi7\.adventures-2)\/(?:pack-adventures-2\/)?([\w.-]+)$/.exec(path)) && existsSync(new URL(`fixtures/pack-adventures-2/${m[1]}`, ROOT))) {
      return send(res, 200, read(`fixtures/pack-adventures-2/${m[1]}`), { 'Content-Type': FILE_TYPES[m[1].split('.').pop()] ?? 'application/octet-stream' });
    }
    if ((m = /^\/play\/([\w.-]+)$/.exec(path))) return send(res, 302, null, { Location: `${game}?play=${m[1]}` });

    // ----- OAuth: authorize page and token endpoint -----
    if (path === '/oauth/authorize' && method === 'GET') {
      const q = Object.fromEntries(url.searchParams);
      if (q.response_type !== 'code' || !q.client_id || !q.redirect_uri || !q.state || !q.code_challenge || q.code_challenge_method !== 'S256') {
        return send(res, 400, 'invalid_request: response_type=code, client_id, redirect_uri, state and an S256 code_challenge are required');
      }
      if (q.client_id !== 'kronland-game') return send(res, 400, 'invalid_client');
      const field = (k) => `<input type="hidden" name="${k}" value="${(q[k] ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">`;
      return send(res, 200, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kronland Mock</title>
<body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem"><h1>Kronland (Mock-Server)</h1><p>Anmelde-Seite des Test-Servers.</p>
<form method="post" action="/oauth/authorize">${['client_id', 'redirect_uri', 'state', 'code_challenge', 'scope'].map(field).join('')}
<button name="decision" value="allow" style="font-size:1.1rem;padding:.6rem 1rem">Als Test anmelden</button>
<button name="decision" value="deny" style="font-size:1.1rem;padding:.6rem 1rem">Abbrechen</button></form></body>`, { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (path === '/oauth/authorize' && method === 'POST') {
      const f = await formOrJson(req);
      const to = new URL(f.redirect_uri);
      if (f.decision === 'deny') to.searchParams.set('error', 'access_denied');
      else { const code = rand(); state.codes.set(code, { challenge: f.code_challenge, redirect: f.redirect_uri, expires: Date.now() + 60_000 }); to.searchParams.set('code', code); }
      to.searchParams.set('state', f.state);
      return send(res, 302, null, { Location: to.href });
    }
    if (path === '/oauth/token' && method === 'POST') {
      const f = await formOrJson(req);
      const bad = (error) => send(res, 400, { error });
      if (f.client_id !== 'kronland-game') return bad('invalid_client');
      let grant = null;
      if (f.grant_type === 'authorization_code') {
        const c = state.codes.get(f.code);
        state.codes.delete(f.code); // single use
        if (!c || c.expires < Date.now() || c.redirect !== f.redirect_uri) return bad('invalid_grant');
        // PKCE: BASE64URL(SHA-256(code_verifier)) must equal the code_challenge of the authorization request
        if (!f.code_verifier || createHash('sha256').update(f.code_verifier).digest('base64url') !== c.challenge) return bad('invalid_grant');
      } else if (f.grant_type === 'refresh_token') {
        const old = state.refresh.get(f.refresh_token);
        if (!old) return bad('invalid_grant');
        state.refresh.delete(f.refresh_token); // rotation: every refresh token is single use
        grant = old.grant;
      } else return bad('unsupported_grant_type');
      const access = 'at_' + rand(), refresh = 'rt_' + rand();
      grant ??= rand(8);
      state.access.set(access, { expires: Date.now() + tokenTtl * 1000, grant });
      state.refresh.set(refresh, { grant });
      return send(res, 200, { token_type: 'Bearer', access_token: access, refresh_token: refresh, expires_in: tokenTtl });
    }
    if (path === '/oauth/revoke' && method === 'POST') { // RFC 7009: unknown tokens are fine; revoking a token ends its whole grant
      const f = await formOrJson(req);
      const bad = (error) => send(res, 400, { error });
      if (!f.token) return bad('invalid_request');
      if (f.client_id !== 'kronland-game') return bad('invalid_client');
      if (f.token_type_hint && !['access_token', 'refresh_token'].includes(f.token_type_hint)) return bad('unsupported_token_type');
      const grant = (state.refresh.get(f.token) ?? state.access.get(f.token))?.grant;
      if (grant) {
        for (const m of [state.access, state.refresh]) for (const [k, v] of m) if (v.grant === grant) m.delete(k);
      }
      state.revoked.push({ token: f.token, hint: f.token_type_hint ?? null, grant: grant ?? null });
      return send(res, 200, null);
    }
    if (path === '/broadcasting/auth') return fail(res, 501, 'net.err.notImplemented');

    // ----- test helpers -----
    if (path === '/mock/progress') return send(res, 200, { events: state.progress });
    if (path === '/mock/reset' && method === 'POST') { reset(); return send(res, 204, null); }
    if ((m = /^\/mock\/signed\/([\w-]+)$/.exec(path))) return send(res, 200, { url: signedUrl(m[1]) });
    if (path === '/mock/revoke' && method === 'POST') { state.access.clear(); return send(res, 204, null); }

    // ----- game API -----
    if (!path.startsWith('/api/v1/')) return fail(res, 404, 'net.err.notFound');
    const user = bearer(req);
    const needUser = () => { if (!user) { fail(res, 401, 'auth.err.invalid'); return false; } return true; };

    if (path === '/api/v1/me') return needUser() && send(res, 200, json('fixtures/me.json'));

    if (path === '/api/v1/packs' && method === 'GET') {
      if (!needUser()) return;
      const me = json('fixtures/packs-me.json');
      me.packs = [...me.packs.filter((p) => !p.own), ...[...state.packs].map(([id, doc]) => ownEntry(id, doc))];
      for (const p of me.packs) if (p.manifest && !/^https?:/.test(p.manifest)) p.manifest = abs(`/${p.manifest.replace(/^\//, '')}`);
      return send(res, 200, me);
    }

    if ((m = /^\/api\/v1\/packs\/([a-z0-9.-]+)(?:\/(manifest|media|files\/([\w.-]+)))?$/.exec(path))) {
      const [, id, sub, fileName] = m;
      if (sub === 'manifest' && method === 'GET') {
        if (id === 'wi7.adventures-2') return send(res, 200, read('fixtures/pack-adventures-2/pack.json'), { 'Content-Type': 'application/json' });
        const doc = state.packs.get(id);
        if (!doc) return fail(res, 404, 'packs.err.notFound', { id });
        if (!user) return fail(res, 401, 'auth.err.invalid'); // private
        return send(res, 200, JSON.stringify(buildPack(doc).manifest, null, 2) + '\n', { 'Content-Type': 'application/json' });
      }
      if (fileName && method === 'GET') {
        if (id === 'wi7.adventures-2' && existsSync(new URL(`fixtures/pack-adventures-2/${fileName}`, ROOT))) return send(res, 200, read(`fixtures/pack-adventures-2/${fileName}`), { 'Content-Type': FILE_TYPES[fileName.split('.').pop()] ?? 'application/octet-stream' });
        const doc = state.packs.get(id);
        const f = doc && buildPack(doc).files.get(fileName);
        if (!f) return fail(res, 404, 'packs.err.notFound', { id });
        if (!user) return fail(res, 401, 'auth.err.invalid');
        return send(res, 200, f.data, { 'Content-Type': f.type });
      }
      if (!needUser()) return;
      if (sub === 'media' && method === 'POST') {
        let form;
        try { form = await new Response(await body(req), { headers: { 'content-type': req.headers['content-type'] } }).formData(); } catch { return fail(res, 422, 'packs.err.media'); }
        const file = form.get('file');
        if (!file || typeof file === 'string') return fail(res, 422, 'packs.err.media');
        const data = Buffer.from(await file.arrayBuffer());
        const ext = basename(file.name || '').split('.').pop().toLowerCase();
        if (!FILE_TYPES[ext] || ext === 'json') return fail(res, 422, 'packs.err.media');
        if (data.length > 20_000_000) return fail(res, 422, 'packs.err.size', { file: file.name, mb: 20 });
        const name = `${sha(data)}.${ext}`;
        state.media.set(name, { data, type: FILE_TYPES[ext] });
        return send(res, 200, { name, type: FILE_TYPES[ext], bytes: data.length });
      }
      if (!sub && method === 'GET') {
        const doc = state.packs.get(id);
        return doc ? send(res, 200, { ...doc, mediaBase: abs(`/api/v1/packs/${id}/files/`) }) : fail(res, 404, 'packs.err.notFound', { id });
      }
      if (!sub && method === 'PUT') {
        let doc;
        try { doc = JSON.parse((await body(req)).toString('utf8')); } catch { return fail(res, 422, 'packs.err.schema', { path: '/' }); }
        const issue = validate(SCHEMAS['pack-document'], doc)[0];
        if (issue) return fail(res, 422, 'packs.err.schema', { path: issue.path || '/', detail: issue.message });
        if (doc.id !== id) return fail(res, 422, 'packs.err.schema', { path: '/id' });
        for (const name of Object.keys(doc.media ?? {})) if (!state.media.has(name)) return fail(res, 422, 'packs.err.media', { file: name });
        delete doc.mediaBase;
        state.packs.set(id, doc);
        return send(res, 200, ownEntry(id, doc));
      }
      if (!sub && method === 'DELETE') return state.packs.delete(id) ? send(res, 204, null) : fail(res, 404, 'packs.err.notFound', { id });
    }

    if (path === '/api/v1/progress' && method === 'POST') {
      if (!needUser()) return;
      let doc;
      try { doc = JSON.parse((await body(req)).toString('utf8')); } catch { return fail(res, 422, 'net.err.invalid'); }
      const issue = validate(SCHEMAS.progress, doc)[0];
      if (issue) return fail(res, 422, 'net.err.invalid', { path: issue.path || '/' });
      for (const e of doc.events) if (!state.progress.some((x) => x.id === e.id)) state.progress.push(e);
      return send(res, 204, null);
    }

    if (path === '/api/v1/saves' && method === 'GET') return needUser() && send(res, 200, { saves: [...state.saves.keys()].map(saveEntry) });
    if (path === '/api/v1/saves' && method === 'POST') {
      if (!needUser()) return;
      const doc = JSON.parse((await body(req)).toString('utf8') || '{}');
      if (validateDef(SCHEMAS.saves, 'write', doc).length) return fail(res, 422, 'saves.err.broken');
      const id = doc.id && !state.saves.has(doc.id) ? doc.id : rand(8);
      return storeSave(res, id, doc, 201);
    }
    if ((m = /^\/api\/v1\/saves\/([A-Za-z0-9_-]{1,64})$/.exec(path))) {
      const id = m[1], cur = state.saves.get(id);
      if (method === 'GET') {
        const expires = Number(url.searchParams.get('expires')), sig = url.searchParams.get('signature');
        const signed = sig && expires > Date.now() / 1000 && sig === sign(id, expires);
        if (!user && !signed) return sig ? fail(res, 403, 'auth.err.signature') : fail(res, 401, 'auth.err.invalid');
        if (!cur) return fail(res, 404, 'saves.err.missing', { id });
        return send(res, 200, cur.envelope, { ETag: `"${cur.etag}"` });
      }
      if (!needUser()) return;
      const ifMatch = (req.headers['if-match'] ?? '').replace(/^"|"$/g, '');
      if (method === 'PUT') {
        if (!cur) return fail(res, 404, 'saves.err.missing', { id });
        if (ifMatch !== String(cur.etag)) { await body(req); return fail(res, 412, 'saves.err.conflict', { id }); }
        const doc = JSON.parse((await body(req)).toString('utf8') || '{}');
        if (validateDef(SCHEMAS.saves, 'write', doc).length) return fail(res, 422, 'saves.err.broken');
        return storeSave(res, id, doc, 200);
      }
      if (method === 'DELETE') {
        if (!cur) return fail(res, 404, 'saves.err.missing', { id });
        if (ifMatch && ifMatch !== String(cur.etag)) return fail(res, 412, 'saves.err.conflict', { id });
        state.saves.delete(id);
        return send(res, 204, null);
      }
    }
    return fail(res, 404, 'net.err.notFound');
  }

  function storeSave(res, id, doc, status) {
    const old = state.saves.get(id);
    const meta = doc.envelope.meta ?? {};
    const text = JSON.stringify(doc.envelope);
    const entry = { id, name: String(meta.name ?? id).slice(0, 80), savedAt: meta.savedAt ?? new Date().toISOString(), tick: meta.tick ?? 0, mode: meta.mode ?? 'free', mission: meta.mission ?? null, seed: meta.seed ?? 0, players: meta.players ?? 0, fog: !!meta.fog, thumb: doc.thumb !== undefined ? doc.thumb : old?.entry.thumb ?? null, size: text.length, auto: id === 'auto' };
    const etag = (old?.etag ?? 0) + 1;
    state.saves.set(id, { entry, envelope: doc.envelope, etag });
    return send(res, status, { ...entry, etag: String(etag) }, { ETag: `"${etag}"` });
  }

  const server = createServer((req, res) => { handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) fail(res, 500, 'net.err.unknown'); else res.end(); }); });
  await new Promise((ok) => server.listen(port, ok));
  state.origin = `http://localhost:${server.address().port}`;
  return { url: state.origin, state, signedUrl, close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(ok); }) };
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
  const s = await startMockServer({ port: Number(arg('port', process.env.PORT ?? 4400)), game: arg('game', 'http://localhost:5173/play/') });
  console.log(`Kronland mock server: ${s.url}`);
  console.log(`  game:   ${arg('game', 'http://localhost:5173/play/')}?config=${s.url}/kronland.config.json`);
  console.log('  sign in with the button "Als Test anmelden"');
}
