import { defineConfig, devices } from '@playwright/test';

// Port is configurable so that servers running in parallel do not collide: E2E_PORT=4204 npx playwright test
const PORT = Number(process.env.E2E_PORT) || 4173;
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { args: gl } },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: gl } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: gl } } },
  ],
});
