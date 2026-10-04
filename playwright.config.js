import { defineConfig, devices } from '@playwright/test';

// Port is configurable so that servers running in parallel do not collide: E2E_PORT=4204 npx playwright test
const PORT = Number(process.env.E2E_PORT) || 4173;
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Use the preinstalled Chromium if the Playwright version does not match: PW_CHROMIUM=/path/to/chrome
const launchOptions = { args: gl, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) };

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: `http://localhost:${PORT}`, launchOptions },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } },
  ],
});
