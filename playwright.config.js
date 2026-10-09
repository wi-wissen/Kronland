import { defineConfig, devices } from '@playwright/test';

// Port is configurable so that servers running in parallel do not collide: E2E_PORT=4204 npx playwright test
const PORT = Number(process.env.E2E_PORT) || 4173;
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Use the preinstalled Chromium if the Playwright version does not match: PW_CHROMIUM=/path/to/chrome
const launchOptions = { args: gl, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) };
const CI = !!process.env.CI;

/**
 * Specs that check rendering or simulation details without anything phone-specific (no touch, no phone layout,
 * no portrait camera): they run in the desktop project only. Everything else runs on desktop and phone.
 */
export const DESKTOP_ONLY = process.env.E2E_ALL_PROJECTS ? [] // phone evidence pictures of these specs
  : ['cavalry', 'circle', 'figures', 'moving-parts', 'script-abilities', 'showcase', 'spots', 'update', 'winter'].map((n) => `**/${n}.spec.js`);

/**
 * Heavy specs: high graphics level or the showcase map under software WebGL, minutes per test. CI runs them as a
 * group of their own (E2E_GROUP=heavy) next to the shards of the remaining ones (E2E_GROUP=light); without the
 * variable everything runs.
 */
export const HEAVY = ['cavalry', 'circle', 'figures', 'moving-parts', 'showcase', 'spots', 'update', 'winter'].map((n) => `**/${n}.spec.js`);
const GROUP = process.env.E2E_GROUP;
/** @type {{ testMatch?: string[], testIgnore?: string[] }} */
const group = GROUP === 'heavy' ? { testMatch: HEAVY } : GROUP === 'light' ? { testIgnore: HEAVY } : {};

export default defineConfig({
  testDir: 'e2e',
  ...group,
  timeout: 60_000,
  retries: 0,
  // Distribute single tests (not whole files) over workers and CI shards: hud.spec.js alone takes minutes
  fullyParallel: true,
  // CI: one browser per runner – two SwiftShader browsers on one machine slow each other down into timeouts
  ...(CI ? { workers: 1 } : {}),
  // CI: readable log plus a blob report per shard, merged into one HTML report afterwards (.github/workflows/ci.yml)
  reporter: CI ? [['list'], ['blob']] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, launchOptions, ...(CI ? { trace: 'retain-on-failure' } : {}) },
  webServer: {
    // E2E_PREBUILT=1: dist/ exists already (CI takes it from the unit job), only serve it
    command: `${process.env.E2E_PREBUILT ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions }, testIgnore: [...DESKTOP_ONLY, ...(group.testIgnore ?? [])] },
  ],
});
