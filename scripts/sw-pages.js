// Service worker: how page navigations are answered (vite.config.js → workbox.runtimeCaching). See docs/PERFORMANCE.md#updates-nach-einem-deploy.

/**
 * Workbox plugin for page navigations (serialised into sw.js – the functions must be self-contained):
 * always ask the server (`no-cache`: revalidate, also past the 10-min HTTP cache of GitHub Pages), so a reload
 * after a deploy gets the new page. Offline: the page from the precache – it matches the precached bundles.
 * While a new worker waits, the precache holds both page revisions (`index.html?__WB_REVISION__=…`); `match` returns
 * the first stored entry, i.e. the active (older) worker's page – the one whose bundles that worker serves.
 */
export const freshPages = {
  requestWillFetch: async ({ request }) => new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' }),
  // a followed redirect (/play → /play/) must not answer a navigation directly: hand it to the browser
  fetchDidSucceed: async ({ response }) => (response.redirected ? Response.redirect(response.url, 302) : response),
  handlerDidError: async ({ request }) => {
    const url = new URL(request.url);
    url.search = '';
    url.hash = '';
    if (url.pathname.endsWith('/')) url.pathname += 'index.html';
    const name = (await caches.keys()).find((k) => k.startsWith('workbox-precache-v2-'));
    return (name && (await (await caches.open(name)).match(url.href, { ignoreSearch: true }))) || undefined;
  },
};
