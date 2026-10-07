// Social media preview (Open Graph, 1200×630): title painting from public/art/title.webp with the game name only
// (no text in one language: links are shared in German and English alike), rendered in Chromium and saved as
// public/og-image.jpg (JPEG: every platform reads it, unlike WebP).
// The file stays without a content hash, crawlers need a stable address (scripts/vite-social-meta.js).
//
//   node scripts/og-image.mjs

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'public/og-image.jpg');
const art = readFileSync(resolve(ROOT, 'public/art/title.webp')).toString('base64');

const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@700&display=block">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { background: #22170f url(data:image/webp;base64,${art}) center 62% / cover no-repeat; }
  /* name in the lower third (roughly golden ratio), darkened ground below it */
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20, 12, 6, 0.2) 0%, rgba(20, 12, 6, 0) 35%, rgba(20, 12, 6, 0.15) 58%, rgba(20, 12, 6, 0.7) 100%); }
  h1 { position: absolute; bottom: 64px; left: 0; right: 0; margin: 0; text-align: center; font: 700 112px/1 'Alegreya SC', serif;
       color: #f6dc8c; letter-spacing: 0.02em; text-shadow: 0 3px 0 #3a2210, 0 6px 24px rgba(0, 0, 0, 0.75); }
</style></head><body><div class="shade"></div><h1>Kronland</h1></body></html>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await browser.close();
console.log('written', OUT);
