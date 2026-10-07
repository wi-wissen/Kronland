// New service worker reloads pages from before the update handling (scripts/sw-legacy.js). Browser flow:
// e2e/update.spec.js ("legacy page").
import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { pickLegacyClients, legacyReloadSource, injectPong, PONG_SCRIPT, legacyReloadFile } from '../../scripts/sw-legacy.js';

const SCOPE = 'https://k.example/';
const client = (id, path, visibilityState = 'visible') => ({ id, url: SCOPE + path, visibilityState });

describe('which silent page is reloaded', () => {
  it('pages that answered never', () => {
    expect(pickLegacyClients([client('a', 'play/'), client('b', '')], new Set(['a', 'b']), SCOPE)).toEqual([]);
  });

  it('only the focused one of several legacy tabs', () => {
    const list = [client('older', 'play/'), { ...client('fresh', 'play/?seed=4'), focused: true }, client('manual', 'manual/')];
    expect(pickLegacyClients(list, new Set(), SCOPE)).toEqual(['fresh']);
  });

  it('without focus info: the first visible one (most recently focused first), never a hidden one', () => {
    expect(pickLegacyClients([client('bg', 'play/', 'hidden'), client('a', 'play/'), client('b', '')], new Set(), SCOPE)).toEqual(['a']);
    expect(pickLegacyClients([client('bg', 'play/', 'hidden')], new Set(), SCOPE)).toEqual([]);
  });

  it('ignores windows outside the scope', () => {
    expect(pickLegacyClients([{ id: 'x', url: 'https://k.example/other/', visibilityState: 'visible' }], new Set(), 'https://k.example/kronland/')).toEqual([]);
  });
});

describe('answer script in every page', () => {
  it('goes right after the charset, once', () => {
    const html = '<!doctype html><html><head>\n<meta charset="utf-8" />\n<title>x</title></head></html>';
    const out = injectPong(html);
    expect(out.indexOf(PONG_SCRIPT)).toBeGreaterThan(out.indexOf('charset'));
    expect(out.indexOf(PONG_SCRIPT)).toBeLessThan(out.indexOf('<title>'));
    expect(injectPong(out)).toBe(out);
    expect(injectPong('<html><head><title>y</title></head></html>')).toContain(`<head>\n    ${PONG_SCRIPT}`);
  });

  it('worker file name carries a content hash', () => {
    expect(legacyReloadFile()).toMatch(/^sw-legacy\.[0-9a-f]{10}\.js$/);
  });
});

/** Run the generated worker file against a fake worker scope. */
function fakeWorker(clients) {
  const listeners = {};
  const store = new Map();
  const navigated = [];
  const sw = {
    addEventListener: (t, f) => { (listeners[t] ??= []).push(f); },
    registration: { scope: SCOPE },
    clients: {
      claim: async () => {},
      matchAll: async () => clients.map((c) => ({
        ...c,
        postMessage: () => { if (c.answers) for (const f of listeners.message ?? []) f({ data: { type: 'kronland-pong' }, source: { id: c.id } }); },
        navigate: async (url) => { navigated.push([c.id, url]); },
      })),
    },
  };
  const caches = { open: async () => ({ match: async (k) => (store.has(k) ? new Response(store.get(k)) : undefined), put: async (k, r) => { store.set(k, await r.text()); } }) };
  const ctx = vm.createContext({ self: sw, caches, Response, URL, Date, Set, JSON, Promise, setTimeout: (f) => setTimeout(f, 0) });
  vm.runInContext(legacyReloadSource(), ctx);
  const activate = async () => { for (const f of listeners.activate) f({ waitUntil() {} }); await new Promise((r) => setTimeout(r, 30)); };
  return { activate, navigated, store };
}

describe('worker', () => {
  it('reloads the silent page once, leaves answering pages alone, no second round within the guard', async () => {
    const w = fakeWorker([{ id: 'new', url: SCOPE + 'play/', visibilityState: 'visible', answers: true }, { id: 'old', url: SCOPE + 'play/', visibilityState: 'visible' }]);
    await w.activate();
    expect(w.navigated).toEqual([['old', SCOPE + 'play/']]);
    await w.activate();
    expect(w.navigated).toHaveLength(1);
  });

  it('the guard is per address and expires', async () => {
    const w = fakeWorker([{ id: 'old', url: SCOPE, visibilityState: 'visible' }]);
    w.store.set('legacy-reload', JSON.stringify({ [SCOPE]: Date.now() - 1000 }));
    await w.activate();
    expect(w.navigated).toEqual([]);
    w.store.set('legacy-reload', JSON.stringify({ [SCOPE]: Date.now() - 61_000 }));
    await w.activate();
    expect(w.navigated).toEqual([['old', SCOPE]]);
  });

  it('a first install with only new pages reloads nothing and leaves no guard behind', async () => {
    const w = fakeWorker([{ id: 'new', url: SCOPE + 'play/', visibilityState: 'visible', answers: true }]);
    await w.activate();
    expect(w.navigated).toEqual([]);
    expect(w.store.has('legacy-reload')).toBe(false);
  });
});
