import { describe, it, expect, vi } from 'vitest';
import { createVerifier, challengeFor, createAuth, CLIENT_ID } from '../../src/net/auth.js';
import { memoryKv } from '../../src/net/kv.js';
import { FakeStorage } from './helpers.js';

const SERVER = 'https://api.example';
const GAME = 'https://kronland.example/play/?seed=3#x';

function setup({ now = () => 1_000_000, tokenResponse } = {}) {
  const kv = memoryKv().kv, session = new FakeStorage(), calls = [];
  const fetch = async (url, init) => {
    const body = Object.fromEntries(new URLSearchParams(init.body));
    calls.push({ url, body });
    const r = tokenResponse?.(body, calls.length) ?? { status: 200, json: { access_token: `at${calls.length}`, refresh_token: `rt${calls.length}`, token_type: 'Bearer', expires_in: 3600 } };
    return new Response(JSON.stringify(r.json), { status: r.status });
  };
  const go = [];
  const auth = createAuth({ server: SERVER, fetch, kv, session, here: () => GAME, go: (u) => go.push(u), now });
  return { auth, kv, session, calls, go };
}

describe('PKCE helpers', () => {
  it('challenge matches the example of RFC 7636 appendix B', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('verifier: 43-128 characters of the unreserved set, different every time', () => {
    const a = createVerifier(), b = createVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(a).not.toBe(b);
    expect(createVerifier(32)).toHaveLength(43);
  });
});

describe('sign-in flow', () => {
  it('login URL carries client, redirect without query, S256 challenge and state; secrets stay in sessionStorage', async () => {
    const { auth, session } = setup();
    const url = new URL(await auth.loginUrl('play=abc'));
    expect(url.origin + url.pathname).toBe(`${SERVER}/oauth/authorize`);
    const q = url.searchParams;
    expect(q.get('client_id')).toBe(CLIENT_ID);
    expect(q.get('response_type')).toBe('code');
    expect(q.get('redirect_uri')).toBe('https://kronland.example/play/');
    expect(q.get('code_challenge_method')).toBe('S256');
    const saved = JSON.parse(session.getItem('kronland-pkce'));
    expect(q.get('state')).toBe(saved.state);
    expect(await challengeFor(saved.verifier)).toBe(q.get('code_challenge'));
    expect(url.href).not.toContain(saved.verifier);
    expect(saved.returnQuery).toBe('play=abc');
  });

  it('login() navigates', async () => {
    const { auth, go } = setup();
    await auth.login();
    expect(go[0]).toContain('/oauth/authorize?');
  });

  it('redirect back: state is checked, code and verifier are exchanged, tokens stored', async () => {
    const { auth, session, calls, kv } = setup();
    await auth.loginUrl('play=abc');
    const { state, verifier } = JSON.parse(session.getItem('kronland-pkce'));
    expect(await auth.handleRedirect(`?code=CODE&state=${state}`)).toEqual({ returnQuery: 'play=abc' });
    expect(calls[0].url).toBe(`${SERVER}/oauth/token`);
    expect(calls[0].body).toMatchObject({ grant_type: 'authorization_code', client_id: CLIENT_ID, code: 'CODE', code_verifier: verifier, redirect_uri: 'https://kronland.example/play/' });
    expect(auth.signedIn).toBe(true);
    expect(await auth.token()).toBe('at1');
    expect(session.getItem('kronland-pkce')).toBeNull();
    expect((await kv.get('tokens')).refresh).toBe('rt1');
  });

  it('a foreign state (not started here) and a denied sign-in are errors; other addresses are ignored', async () => {
    const { auth } = setup();
    expect(await auth.handleRedirect('?seed=4')).toBeNull();
    await expect(auth.handleRedirect('?code=C&state=S')).rejects.toMatchObject({ code: 'auth.err.state' });
    await auth.loginUrl();
    await expect(auth.handleRedirect('?code=C&state=other')).rejects.toMatchObject({ code: 'auth.err.state' });
    const s2 = setup();
    await s2.auth.loginUrl();
    const { state } = JSON.parse(s2.session.getItem('kronland-pkce'));
    await expect(s2.auth.handleRedirect(`?error=access_denied&state=${state}`)).rejects.toMatchObject({ code: 'auth.err.denied' });
    expect(s2.auth.signedIn).toBe(false);
  });

  it('a refused code is auth.err.exchange', async () => {
    const { auth, session } = setup({ tokenResponse: () => ({ status: 400, json: { error: 'invalid_grant' } }) });
    await auth.loginUrl();
    const { state } = JSON.parse(session.getItem('kronland-pkce'));
    await expect(auth.handleRedirect(`?code=C&state=${state}`)).rejects.toMatchObject({ code: 'auth.err.exchange', params: { status: 400, error: 'invalid_grant' } });
  });

  it('refresh shortly before expiry, one request for parallel callers', async () => {
    let t = 1_000_000;
    const { auth, session, calls } = setup({ now: () => t });
    await auth.loginUrl();
    const { state } = JSON.parse(session.getItem('kronland-pkce'));
    await auth.handleRedirect(`?code=C&state=${state}`);
    expect(await auth.token()).toBe('at1');
    t += 3600_000 - 10_000; // 10 s left
    const [a, b] = await Promise.all([auth.token(), auth.token()]);
    expect(a).toBe('at2');
    expect(b).toBe('at2');
    expect(calls.filter((c) => c.body.grant_type === 'refresh_token')).toHaveLength(1);
    expect(calls[1].body.refresh_token).toBe('rt1');
  });

  it('a refused refresh token ends the session; offline keeps it', async () => {
    let t = 1_000_000, fail = 'refuse';
    const s = setup({ now: () => t, tokenResponse: (body) => (body.grant_type === 'refresh_token' && fail === 'refuse' ? { status: 400, json: { error: 'invalid_grant' } } : undefined) });
    await s.auth.loginUrl();
    await s.auth.handleRedirect(`?code=C&state=${JSON.parse(s.session.getItem('kronland-pkce')).state}`);
    t += 4000_000;
    expect(await s.auth.token()).toBeNull();
    expect(s.auth.signedIn).toBe(false);
    expect(await s.kv.get('tokens')).toBeUndefined();
  });

  it('tokens are restored on load, only for the same server; logout forgets them', async () => {
    const s = setup();
    await s.auth.loginUrl();
    await s.auth.handleRedirect(`?code=C&state=${JSON.parse(s.session.getItem('kronland-pkce')).state}`);
    const again = createAuth({ server: SERVER, kv: s.kv, session: s.session, fetch: async () => { throw new Error('no network'); } });
    expect(await again.load()).toBe(true);
    expect(await again.token()).toBe('at1');
    const other = createAuth({ server: 'https://other.example', kv: s.kv, session: s.session });
    expect(await other.load()).toBe(false);
    await again.logout();
    expect(again.signedIn).toBe(false);
    expect(await s.kv.get('tokens')).toBeUndefined();
  });
});

describe('logout and token revocation (RFC 7009)', () => {
  async function make(revoke, opts = {}, tokenJson) {
    const kv = memoryKv().kv, session = new FakeStorage(), revokes = [];
    const fetch = async (url, init) => {
      if (url.endsWith('/oauth/revoke')) { revokes.push({ url, init, body: Object.fromEntries(new URLSearchParams(init.body)) }); return revoke ? revoke(init) : new Response('', { status: 200 }); }
      return new Response(JSON.stringify(tokenJson ?? { access_token: 'at1', refresh_token: 'rt1', token_type: 'Bearer', expires_in: 3600 }), { status: 200 });
    };
    const auth = createAuth({ server: SERVER, fetch, kv, session, here: () => GAME, now: () => 1_000_000, ...opts });
    await auth.loginUrl();
    await auth.handleRedirect(`?code=C&state=${JSON.parse(session.getItem('kronland-pkce')).state}`);
    return { auth, kv, session, revokes };
  }

  it('revokes the refresh token with a form body, no secret, and clears the device', async () => {
    const s = await make();
    await s.auth.logout();
    expect(s.revokes).toHaveLength(1);
    const { url, init, body } = s.revokes[0];
    expect(url).toBe(`${SERVER}/oauth/revoke`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(body).toEqual({ token: 'rt1', token_type_hint: 'refresh_token', client_id: CLIENT_ID });
    expect(s.auth.signedIn).toBe(false);
    expect(await s.kv.get('tokens')).toBeUndefined();
  });

  it('without a refresh token the access token is revoked', async () => {
    const s = await make(null, {}, { access_token: 'at9', token_type: 'Bearer', expires_in: 3600 });
    await s.auth.logout();
    expect(s.revokes[0].body).toEqual({ token: 'at9', token_type_hint: 'access_token', client_id: CLIENT_ID });
  });

  it('clears pending PKCE state', async () => {
    const s = await make();
    await s.auth.loginUrl();
    expect(s.session.getItem('kronland-pkce')).toBeTruthy();
    await s.auth.logout();
    expect(s.session.getItem('kronland-pkce')).toBeNull();
  });

  it.each([
    ['fetch throws', () => { throw new TypeError('Failed to fetch'); }],
    ['server answers 500', () => new Response('boom', { status: 500 })],
  ])('tokens are cleared when %s; only a warning is logged', async (_n, revoke) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = await make(revoke);
    await expect(s.auth.logout()).resolves.toBeUndefined();
    expect(s.auth.signedIn).toBe(false);
    expect(await s.kv.get('tokens')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not hang: a request that never answers is aborted after the timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let signal;
    const s = await make((init) => { signal = init.signal; return new Promise(() => {}); }, { revokeTimeoutMs: 20 });
    await s.auth.logout();
    expect(signal.aborted).toBe(true);
    expect(s.auth.signedIn).toBe(false);
    expect(await s.kv.get('tokens')).toBeUndefined();
    warn.mockRestore();
  });

  it('signed out: nothing to revoke, no request', async () => {
    const s = await make();
    await s.auth.logout();
    await s.auth.logout();
    expect(s.revokes).toHaveLength(1);
  });

  it('keeps the newest refresh token after a rotation', async () => {
    let n = 0;
    const kv = memoryKv().kv, session = new FakeStorage();
    let t = 1_000_000;
    const fetch = async () => { n++; return new Response(JSON.stringify({ access_token: `at${n}`, refresh_token: `rt${n}`, token_type: 'Bearer', expires_in: 60 }), { status: 200 }); };
    const auth = createAuth({ server: SERVER, fetch, kv, session, here: () => GAME, now: () => t });
    await auth.loginUrl();
    await auth.handleRedirect(`?code=C&state=${JSON.parse(session.getItem('kronland-pkce')).state}`);
    t += 120_000;
    expect(await auth.token()).toBe('at2');
    expect((await kv.get('tokens')).refresh).toBe('rt2');
  });
});

