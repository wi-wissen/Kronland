import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import hashedAssets from './scripts/vite-hashed-assets.js';
import blogPages from './scripts/vite-blog-pages.js';
import socialMeta from './scripts/vite-social-meta.js';
import { freshPages } from './scripts/sw-pages.js';

// Website made of several pages (Vite multi-page): home, game, manual, compendium, scripting reference, blog. All paths relative (base './').
const PAGES = {
  main: 'index.html',
  play: 'play/index.html',
  manual: 'manual/index.html',
  compendium: 'compendium/index.html',
  scripting: 'scripting/index.html',
  // Blog: overview; the article pages blog/<name>/ are written by scripts/vite-blog-pages.js
  blog: 'blog/index.html',
};

/**
 * Post-processing of the HTML pages after vite-plugin-pwa: the plugin writes the manifest link relative to the
 * root into every page. It belongs only in the game (play/) and must point one level up there.
 */
function pagePaths() {
  return {
    name: 'kronland:page-paths',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const page = (ctx.path ?? '').replace(/^\//, '').replace(/(^|\/)$/, '$1index.html');
        const depth = page.split('/').length - 1;
        const up = depth ? '../'.repeat(depth) : './';
        const link = /<link rel="manifest" href="[^"]*?manifest\.webmanifest"([^>]*)>/;
        if (page !== PAGES.play) return html.replace(link, '');
        return html.replace(link, `<link rel="manifest" href="${up}manifest.webmanifest"$1>`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  // Build label for the deploy test (e2e/update.spec.js); empty in normal builds
  define: { __KRONLAND_BUILD__: JSON.stringify(process.env.KRONLAND_BUILD ?? '') },
  plugins: [
    vue(),
    // Game files from public/ with a content hash in the name (models/…/castle.3f2a91c0d7.glb), see docs/PERFORMANCE.md
    hashedAssets(),
    // Link previews (Open Graph) and canonical address on every page, see docs/WEBSITE.md
    socialMeta(),
    VitePWA({
      // New workers wait; the page decides when they take over (SKIP_WAITING message, src/pwa.js)
      registerType: 'prompt',
      // Registration itself (src/main.js, with path to the root): the plugin script would sit relative to the page
      injectRegister: null,
      includeAssets: ['favicon.ico'], // PNG icons are already covered by globPatterns
      manifest: {
        name: 'Kronland',
        short_name: 'Kronland',
        description: 'Aufbau-Strategiespiel im Browser',
        lang: 'de',
        // Manifest is in the root, the game under play/ – start and scope only the game
        start_url: 'play/',
        scope: 'play/',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#1a221e',
        theme_color: '#1a221e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Upfront (on first visit, ~3 MB): code, pages and the small UI images (icons, portraits,
        // menu backdrops). Models, textures, sound and website images only when they are needed.
        globPatterns: ['**/*.{js,css,html,png,webp}'],
        globIgnores: ['models/**', 'site/**', 'textures/**', 'blog/*/*.{png,jpg,webp,svg}'],
        // Files with a content hash (Vite bundles, hashed game files) need no checksum in the cache key
        dontCacheBustURLsMatching: /\.[0-9a-f]{10}\.[a-z0-9]+$|(^|\/)assets\//i,
        // Multiple pages: no fallback page for navigations (otherwise /play/ would get the home page)
        navigateFallback: null,
        // Pages are precached (offline), but a navigation to play/ must not be answered from the precache
        // (old page + old bundles after a deploy): no directory index, navigations go to `freshPages` below.
        directoryIndex: null,
        // URL parameters never select a different precached file (play/?seed=42&dev=1 offline: freshPages ignores them too)
        ignoreURLParametersMatching: [/.*/],
        // A new worker waits (the old one keeps its precache while an old page runs) until a page sends SKIP_WAITING
        // (src/pwa.js). clientsClaim only matters for the very first worker: it controls the first page at once.
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // All game files carry a content hash: once loaded, never asked for again (CacheFirst). A changed
        // file has a new name; stale entries are cleaned up by src/cacheCleanup.js after loading.
        runtimeCaching: [
          // Server and sources (docs/SERVER.md): network first, so a changed file applies at once; offline the last copy
          { urlPattern: /\/kronland\.config\.json$/, handler: 'NetworkFirst', options: { cacheName: 'config', networkTimeoutSeconds: 3 } },
          // Pages: network first, past the HTTP cache; offline the precached page (see freshPages)
          { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkOnly', options: { plugins: [freshPages] } },
          // 4 players load ~200 model files, there are ~340 in total (figure manifest sits in the same folder)
          { urlPattern: /\/models\/.*\.(glb|json)$/, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 500 } } },
          // painted ground and nature textures: only one size per graphics level, therefore not upfront but on first load
          { urlPattern: /\/textures\/.*\.webp$/, handler: 'CacheFirst', options: { cacheName: 'textures', expiration: { maxEntries: 40 } } },
          // Sound: manifests, music, effects, voices (see docs/AUDIO.md)
          { urlPattern: /\/audio\/.*\.(json|ogg|mp3|m4a|wav|webm|opus)$/, handler: 'CacheFirst', options: { cacheName: 'audio', expiration: { maxEntries: 800 } } },
          // Website images (screenshots) only on demand
          { urlPattern: /\/site\/.*\.(webp|jpg|png)$/, handler: 'CacheFirst', options: { cacheName: 'site-images', expiration: { maxEntries: 60 } } },
          // Blog images and diagrams (public/blog/<article>/…) likewise
          { urlPattern: /\/blog\/[^/]+\/[^/]+\.(webp|jpg|png|svg)$/, handler: 'CacheFirst', options: { cacheName: 'blog-images', expiration: { maxEntries: 120 } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
    pagePaths(),
    blogPages(),
  ],
  build: {
    rollupOptions: {
      input: Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, resolve(import.meta.dirname, v)])),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Long AI matches and mission runs need more than 5 s on slow machines
    testTimeout: 60_000,
  },
});
