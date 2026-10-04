// Draws the coloured SVG icons (src/ui/icons/index.js) without labels into a grid on a white background.
// The image is the content template for the image model; layout.json fixes order and grid.
//   node scripts/icons/template.mjs   →  assets-src/icons/template.png, assets-src/icons/layout.json
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { ICONS, GLYPHS } from '../../src/ui/icons/index.js';

const names = Object.keys(ICONS).filter((n) => !GLYPHS.has(n)); // control icons stay vector
const COLS = 12, CELL = 256;
const rows = Math.ceil(names.length / COLS);
const cells = names.map((n) => `<div class=c><svg viewBox="-2 -2 36 36" width=${CELL * 0.8} height=${CELL * 0.8}>${ICONS[n]}</svg></div>`).join('');
const html = `<html><body style="margin:0;background:#fff"><div style="display:grid;grid-template-columns:repeat(${COLS},${CELL}px);grid-auto-rows:${CELL}px">${cells}</div>
<style>.c{display:flex;align-items:center;justify-content:center}</style></body></html>`;
// In the cloud container Chromium lives under /opt/pw-browsers (CHROMIUM_PATH overrides)
const exe = process.env.CHROMIUM_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: COLS * CELL, height: rows * CELL } });
await page.setContent(html);
fs.mkdirSync('assets-src/icons', { recursive: true });
await page.screenshot({ path: 'assets-src/icons/template.png' });
await browser.close();
fs.writeFileSync('assets-src/icons/layout.json', JSON.stringify({ cols: COLS, rows, names }, null, 1) + '\n');
console.log(`assets-src/icons/template.png: ${names.length} icons, ${COLS}×${rows}`);
