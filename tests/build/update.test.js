// Updates after a deploy: detecting an outdated page (src/pwa.js) and the service worker's answer to page
// navigations (scripts/sw-pages.js). The full flow runs in the browser: e2e/update.spec.js.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { bundleRefs, isOutdated, reloadAllowed, updateAction, RELOAD_GUARD_MS } from '../../src/pwa.js';
import { freshPages } from '../../scripts/sw-pages.js';

const page = (entry, css = 'play-BwPUHL4K.css') => `<!doctype html><html><head>
  <script>window.KRONLAND_ROOT = '../';</script>
  <script type="module" crossorigin src="../assets/${entry}"></script>
  <link rel="modulepreload" crossorigin href="../assets/style-B29v53Rr.js">
  <link rel="stylesheet" crossorigin href="../assets/${css}">
  <link rel="icon" href="../favicon.ico"><link rel="manifest" href="../manifest.webmanifest">
</head><body></body></html>`;

describe('outdated page', () => {
  it('collects the hashed bundles of script and link tags', () => {
    expect([...bundleRefs(page('play-L2BxqF40.js'))].sort()).toEqual(['assets/play-BwPUHL4K.css', 'assets/play-L2BxqF40.js', 'assets/style-B29v53Rr.js']);
  });

  it('is outdated when the server page references a bundle the running page lacks', () => {
    const running = bundleRefs(page('play-L2BxqF40.js'));
    expect(isOutdated(running, page('play-L2BxqF40.js'))).toBe(false);
    expect(isOutdated(running, page('play-Zz9new00.js'))).toBe(true);
    expect(isOutdated(running, page('play-L2BxqF40.js', 'play-new.css'))).toBe(true);
  });

  it('ignores extra bundles the running page loaded later (lazy chunks) and pages without bundles', () => {
    const running = new Set([...bundleRefs(page('play-L2BxqF40.js')), 'assets/ScriptPanel-QXdI6vAK.js', 'https://x/assets/x.css']);
    expect(isOutdated(running, page('play-L2BxqF40.js'))).toBe(false);
    expect(isOutdated(running, '<html>404</html>')).toBe(false);
    expect(isOutdated(new Set(), page('play-L2BxqF40.js'))).toBe(false); // dev server: no hashed bundles
  });

  it('reloads automatically at most once per guard interval', () => {
    expect(reloadAllowed(1_000_000, null)).toBe(true);
    expect(reloadAllowed(1_000_000, 1_000_000 - 5_000)).toBe(false);
    expect(reloadAllowed(1_000_000, 1_000_000 - RELOAD_GUARD_MS)).toBe(true);
    // clock jumped back (other tab, changed system time): allowed
    expect(reloadAllowed(1_000_000, 2_000_000)).toBe(true);
  });
});

describe('update decision (waiting worker, page decides)', () => {
  it('outdated page: reload in the menus, notice in a game or editor draft', () => {
    expect(updateAction({ outdated: true, waiting: true, idle: true })).toBe('reload');
    expect(updateAction({ outdated: true, waiting: false, idle: true })).toBe('reload'); // worker not found yet: plain reload
    expect(updateAction({ outdated: true, waiting: true, idle: false })).toBe('notice');
    expect(updateAction({ outdated: true, waiting: false, idle: false })).toBe('notice');
  });

  it('current page with a waiting worker: let it take over without a reload, but only when idle', () => {
    expect(updateAction({ outdated: false, waiting: true, idle: true })).toBe('activate');
    expect(updateAction({ outdated: false, waiting: true, idle: false })).toBe('none');
  });

  it('current or unknown (offline): nothing – no reload, no loop', () => {
    expect(updateAction({ outdated: false, waiting: false, idle: true })).toBe('none');
    expect(updateAction({ outdated: null, waiting: true, idle: true })).toBe('none');
    expect(updateAction({ outdated: null, waiting: false, idle: false })).toBe('none');
  });
});

describe('service worker: page navigations', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('always asks the server, past the HTTP cache', async () => {
    const r = await freshPages.requestWillFetch({ request: new Request('https://k.example/play/?seed=4') });
    expect(r.url).toBe('https://k.example/play/?seed=4');
    expect(r.cache).toBe('no-cache');
  });

  it('turns a followed redirect into a redirect answer', async () => {
    const plain = new Response('x');
    expect(await freshPages.fetchDidSucceed({ response: plain })).toBe(plain);
    const followed = { redirected: true, url: 'https://k.example/play/' };
    const r = await freshPages.fetchDidSucceed({ response: followed });
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://k.example/play/');
  });

  it('offline: answers with the precached page, ignoring parameters', async () => {
    const asked = [];
    const cache = { match: async (url, opts) => { asked.push([url, opts]); return url.endsWith('/play/index.html') ? 'PAGE' : undefined; } };
    vi.stubGlobal('caches', { keys: async () => ['models', 'workbox-precache-v2-https://k.example/'], open: async () => cache });
    expect(await freshPages.handlerDidError({ request: new Request('https://k.example/play/?seed=4#x') })).toBe('PAGE');
    expect(asked[0]).toEqual(['https://k.example/play/index.html', { ignoreSearch: true }]);
    expect(await freshPages.handlerDidError({ request: new Request('https://k.example/manual/') })).toBeUndefined();
    vi.stubGlobal('caches', { keys: async () => [], open: async () => cache });
    expect(await freshPages.handlerDidError({ request: new Request('https://k.example/play/') })).toBeUndefined();
  });
});
