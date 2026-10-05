import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

// Website made of several pages (Vite multi-page): home, game, manual, compendium. All paths relative (base './').
const PAGES = {
  main: 'index.html',
  play: 'play/index.html',
  manual: 'manual/index.html',
  compendium: 'compendium/index.html',
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
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration itself (src/main.js, with path to the root): the plugin script would sit relative to the page
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
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
        // Precache game code, models on first load (they are large)
        globPatterns: ['**/*.{js,css,html,png,webp}'], // webp: Symbol-Atlas icons/symbols.webp, portraits portraits/*.webp, menu backdrops art/*.webp
        globIgnores: ['models/**', 'site/**', 'textures/**'],
        // Multiple pages: no fallback page for navigations (otherwise /play/ would get the home page)
        navigateFallback: null,
        // Serve play/?seed=42&dev=1 etc. offline from the precached page (the game reads the parameters itself)
        ignoreURLParametersMatching: [/.*/],
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/models\/.*\.glb$/, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 400 } } }, // 4 players load ~205 files (incl. LOD levels), there are ~260 in total
          // Figure manifest: without it the game shows only placeholder figures next to real buildings offline
          { urlPattern: /\/models\/.*\.json$/, handler: 'NetworkFirst', options: { cacheName: 'models-manifest' } },
          // painted ground and nature textures: only one size per graphics level, therefore not upfront but on first load
          { urlPattern: /\/textures\/.*\.webp$/, handler: 'CacheFirst', options: { cacheName: 'textures', expiration: { maxEntries: 30 } } },
          // Sound: manifest always fresh, audio files from the cache after the first load (see docs/AUDIO.md)
          { urlPattern: /\/audio\/manifest\.json$/, handler: 'NetworkFirst', options: { cacheName: 'sound-manifest' } },
          { urlPattern: /\/audio\/.*\.(ogg|mp3|m4a|wav|webm|opus)$/, handler: 'CacheFirst', options: { cacheName: 'audio', expiration: { maxEntries: 600 } } },
          // Website images (screenshots) only on demand
          { urlPattern: /\/site\/.*\.(webp|jpg|png)$/, handler: 'CacheFirst', options: { cacheName: 'site-images', expiration: { maxEntries: 60 } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
    pagePaths(),
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
