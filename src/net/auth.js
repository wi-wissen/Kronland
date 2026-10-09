// Sign-in: OAuth 2 Authorization Code with PKCE (RFC 7636), public client without a secret. Own code on Web Crypto
// instead of a library: the flow is short and the game needs nothing else.
//   1. login():           code_verifier + state into sessionStorage, redirect to {server}/oauth/authorize
//   2. handleRedirect():  back at the game with ?code=&state= -> POST {server}/oauth/token -> tokens in IndexedDB
//   3. token():           valid access token, refreshed shortly before it expires
//   4. logout():          forget the tokens
// Tokens belong to one server; a different server in the configuration ignores them.

import { NetError } from './errors.js';

export const CLIENT_ID = 'kronland-game';
export const SCOPE = 'play packs:write';
const SESSION_KEY = 'kronland-pkce';
const TOKEN_KEY = 'tokens';
/** Refresh this long before the access token runs out. */
const SKEW_MS = 30_000;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Random code_verifier (RFC 7636: 43-128 characters of the unreserved set; 48 bytes give 64). */
export function createVerifier(bytes = 48, random = (a) => globalThis.crypto.getRandomValues(a)) {
  return b64url(random(new Uint8Array(bytes)));
}

/** code_challenge = BASE64URL(SHA-256(code_verifier)) (method S256). */
export async function challengeFor(verifier) {
  return b64url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

/**
 * @typedef {Object} AuthEnv
 * @property {string} server base address
 * @property {typeof fetch} [fetch]
 * @property {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<void>, delete(k: string): Promise<void> }} kv
 * @property {Pick<Storage, 'getItem'|'setItem'|'removeItem'>} [session] sessionStorage
 * @property {() => string} [here] address of the game page (default: location)
 * @property {(url: string) => void} [go] navigate (default: location.assign)
 * @property {() => number} [now]
 */

/** @param {AuthEnv} env */
export function createAuth(env) {
  const f = env.fetch ?? globalThis.fetch.bind(globalThis);
  const session = env.session ?? globalThis.sessionStorage;
  const now = env.now ?? Date.now;
  const here = env.here ?? (() => globalThis.location.href);
  /** @type {{ access: string, refresh: string, expiresAt: number, server: string }|null} */
  let tokens = null;
  let refreshing = null;

  /** Redirect address: the game page without query and fragment (registered with the server). */
  const redirectUri = () => { const u = new URL(here()); u.search = ''; u.hash = ''; return u.href; };

  const store = async (json) => {
    tokens = { access: json.access_token, refresh: json.refresh_token ?? tokens?.refresh ?? '', expiresAt: now() + (json.expires_in ?? 3600) * 1000, server: env.server };
    await env.kv.set(TOKEN_KEY, tokens);
  };

  const post = async (params) => {
    let res;
    try { res = await f(`${env.server}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ client_id: CLIENT_ID, ...params }) }); } catch (e) { throw new NetError('net.err.offline', {}, e); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) throw new NetError('auth.err.exchange', { status: res.status, error: json.error ?? '' });
    await store(json);
  };

  return {
    redirectUri,
    /** Read the stored tokens (call once at start). @returns {Promise<boolean>} signed in? */
    async load() {
      const saved = await env.kv.get(TOKEN_KEY).catch(() => null);
      tokens = saved && saved.server === env.server ? saved : null;
      return !!tokens;
    },
    get signedIn() { return !!tokens; },

    /** Start the sign-in: remember verifier and state, return the address of the server's sign-in page. */
    async loginUrl(returnQuery = '') {
      const verifier = createVerifier(), state = createVerifier(24);
      session.setItem(SESSION_KEY, JSON.stringify({ state, verifier, redirectUri: redirectUri(), returnQuery }));
      const q = new URLSearchParams({
        response_type: 'code', client_id: CLIENT_ID, redirect_uri: redirectUri(), scope: SCOPE,
        code_challenge: await challengeFor(verifier), code_challenge_method: 'S256', state,
      });
      return `${env.server}/oauth/authorize?${q}`;
    },
    async login(returnQuery = '') { (env.go ?? ((u) => globalThis.location.assign(u)))(await this.loginUrl(returnQuery)); },

    /**
     * Back from the server: `?code=&state=`. Returns null if the address is no sign-in answer, otherwise `{ returnQuery }`
     * after the code was exchanged. A wrong state (not started here) or a refusal throws auth.err.*.
     * @param {string} search
     */
    async handleRedirect(search) {
      const q = new URLSearchParams(search);
      const code = q.get('code'), state = q.get('state'), denied = q.get('error');
      if (!(code && state) && !(denied && state)) return null;
      let saved = null;
      try { saved = JSON.parse(session.getItem(SESSION_KEY) ?? 'null'); } catch { /* handled below */ }
      session.removeItem(SESSION_KEY);
      if (!saved || saved.state !== state) throw new NetError('auth.err.state');
      if (denied) throw new NetError('auth.err.denied', { error: denied });
      await post({ grant_type: 'authorization_code', code, redirect_uri: saved.redirectUri, code_verifier: saved.verifier });
      return { returnQuery: saved.returnQuery ?? '' };
    },

    /** A usable access token or null (not signed in / session expired). */
    async token() {
      if (!tokens) return null;
      if (tokens.expiresAt - now() > SKEW_MS) return tokens.access;
      return this.refresh();
    },

    /** Refresh the tokens; one request at a time. A refused refresh token ends the session. */
    refresh() {
      if (!tokens?.refresh) return Promise.resolve(null);
      refreshing ??= post({ grant_type: 'refresh_token', refresh_token: tokens.refresh })
        .then(() => tokens.access)
        .catch(async (e) => {
          if (e.code === 'auth.err.exchange') { tokens = null; await env.kv.delete(TOKEN_KEY).catch(() => {}); return null; }
          return tokens?.access ?? null; // offline: keep the session, try the old token
        })
        .finally(() => { refreshing = null; });
      return refreshing;
    },

    async logout() { tokens = null; await env.kv.delete(TOKEN_KEY).catch(() => {}); },
  };
}
