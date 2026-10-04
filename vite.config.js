import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Kronland',
        short_name: 'Kronland',
        description: 'Aufbau-Strategiespiel im Browser',
        lang: 'de',
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
        globPatterns: ['**/*.{js,css,html,png}'],
        globIgnores: ['models/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/models\/.*\.glb$/, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 200 } } },
          // Sound: manifest always fresh, audio files from the cache after the first load (see docs/AUDIO.md)
          { urlPattern: /\/audio\/manifest\.json$/, handler: 'NetworkFirst', options: { cacheName: 'sound-manifest' } },
          { urlPattern: /\/audio\/.*\.(ogg|mp3|m4a|wav|webm|opus)$/, handler: 'CacheFirst', options: { cacheName: 'audio', expiration: { maxEntries: 300 } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Long AI matches and mission runs need more than 5 s on slow machines
    testTimeout: 60_000,
  },
});
