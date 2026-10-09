// Shared helpers of the network tests: fixtures as fetch, schemas from disk, a session storage mock.
import { readFileSync, readdirSync } from 'node:fs';
import { expect } from 'vitest';
import { createAuth } from '../../src/net/auth.js';
import { createApi } from '../../src/net/api.js';
import { memoryKv } from '../../src/net/kv.js';

export const FIX = new URL('../../contract/fixtures/', import.meta.url);
export const SCHEMA_DIR = new URL('../../contract/schemas/', import.meta.url);
export const fix = (p) => readFileSync(new URL(p, FIX));
export const fixJson = (p) => JSON.parse(fix(p).toString('utf8'));
export const schemaOf = (name) => JSON.parse(readFileSync(new URL(`${name}.schema.json`, SCHEMA_DIR), 'utf8'));
export const packFiles = () => readdirSync(new URL('pack-adventures-2/', FIX));

export const ORIGIN = 'https://src.example';

/**
 * fetch() that serves the example source from the fixtures: <origin>/catalog.json and <origin>/pack-adventures-2/*.
 * `overrides`: path -> Buffer/string/object/Response/function(request) for changed or extra files.
 * `calls` lists the requested addresses; `down` makes every request fail like an unreachable host.
 */
export function fixtureFetch(overrides = {}) {
  const calls = [];
  const state = { down: false };
  const f = async (url, init) => {
    const u = new URL(url, ORIGIN + '/');
    calls.push(u.href);
    if (state.down) throw new TypeError('Failed to fetch');
    const path = u.pathname;
    let body = overrides[path];
    if (typeof body === 'function') body = await body(u, init);
    if (body === undefined) {
      if (path === '/catalog.json') body = fix('catalog-static.json');
      else if (path.startsWith('/pack-adventures-2/')) { try { body = fix(path.slice(1)); } catch { body = undefined; } }
    }
    if (body === undefined || body === null) return new Response('{}', { status: 404 });
    if (body instanceof Response) return body;
    return new Response(typeof body === 'object' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body, { status: 200 });
  };
  f.calls = calls;
  f.state = state;
  return f;
}

/** sessionStorage / localStorage stand-in */
export class FakeStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

export const GAME = 'http://localhost:4173/play/';

/** Sign in through the real flow (authorize page -> button -> redirect -> token). */
export async function signIn(base) {
  const kv = memoryKv().kv, session = new FakeStorage();
  const auth = createAuth({ server: base, kv, session, here: () => GAME });
  const url = new URL(await auth.loginUrl());
  const page = await fetch(url);
  expect(await page.text()).toContain('Als Test anmelden');
  const form = new URLSearchParams({ decision: 'allow' });
  for (const k of ['client_id', 'redirect_uri', 'state', 'code_challenge', 'scope']) form.set(k, url.searchParams.get(k));
  const res = await fetch(`${base}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual' });
  expect(res.status).toBe(302);
  const back = new URL(res.headers.get('location'));
  expect(back.origin + back.pathname).toBe(GAME.replace(/\/$/, '/'));
  await auth.handleRedirect(back.search);
  return { auth, api: createApi({ server: base, auth }), kv };
}

