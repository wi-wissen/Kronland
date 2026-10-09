import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';
import { startMockServer } from '../scripts/mock-server.mjs';
import { mkdirSync } from 'node:fs';

// Level packs from a source and the server (docs/SERVER.md) against the mock server: discover and start a pack,
// locked pack, sign in with PKCE round trip, progress events, sources in the settings, ?source= link.
// The config file is replaced per test (page.route); service workers are blocked so the routes see every request.
// Screenshots (desktop and phone size) when E2E_SHOT_DIR is set.

test.describe.configure({ timeout: 300_000, mode: 'serial' });
test.use({ serviceWorkers: 'block' });
// Evidence pictures: E2E_SHOT_SIZE=1440x900 (desktop) or 412x915 (phone)
const SIZE = process.env.E2E_SHOT_SIZE?.split('x').map(Number);
if (SIZE) test.use({ viewport: { width: SIZE[0], height: SIZE[1] }, ...(SIZE[0] < 600 ? { isMobile: true, hasTouch: true } : {}) });
const SLOW = { timeout: 60_000 };

let mock;
test.beforeAll(async () => { mock = await startMockServer(); });
test.afterAll(async () => { await mock.close(); });
test.beforeEach(async () => { await fetch(`${mock.url}/mock/reset`, { method: 'POST' }); await fetch(`${mock.url}/mock/revoke`, { method: 'POST' }); });

/** Page with its own configuration file; returns the errors seen. */
async function open(page, config, query = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/kronland.config.json', (route) => route.fulfill({ json: { format: 'kronland-config', version: 1, ...config } }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-')) localStorage.removeItem(k);
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.goto(playUrl(query), { waitUntil: 'domcontentloaded' });
  return errors;
}

async function shot(page, name) {
  const dir = process.env.E2E_SHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const phone = page.viewportSize().width < 600;
  await page.screenshot({ path: `${dir}/${name}-${phone ? 'phone' : 'desktop'}.png` });
}

/** Sign in through the mock server's page. */
async function signIn(page) {
  await page.getByTestId('sign-in').click();
  await page.getByRole('button', { name: 'Als Test anmelden' }).click();
  await expect(page.getByTestId('account')).toContainText('Löwe 7', SLOW);
}

test('discover: a pack of a source is listed, loaded, verified and its first level starts', async ({ page }) => {
  const errors = await open(page, { sources: [`${mock.url}/static/catalog.json`] });
  await expect(page.getByTestId('menu-discover')).toBeVisible(SLOW);
  await shot(page, 'menu-discover');
  await page.getByTestId('menu-discover').click();
  await expect(page.getByTestId('discover-menu')).toBeVisible();
  const card = page.getByTestId('pack-wi7.adventures-2');
  await expect(card).toBeVisible(SLOW);
  await card.click();
  await expect(page.getByTestId('discover-levels').locator('li')).toHaveCount(5, SLOW);
  await expect(page.getByTestId('discover-preview')).toBeVisible();
  await shot(page, 'discover');
  await page.getByTestId('start-r1-2').click();
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  await expect.poll(() => page.evaluate(() => window.__kronland?.sim.mission?.def.id), SLOW).toBe('r1-2');
  expect(errors).toEqual([]);
});

test('discover: without any source the game looks as before (no entry)', async ({ page }) => {
  await open(page, {});
  await expect(page.getByTestId('menu-adventures')).toBeVisible(SLOW);
  await expect(page.getByTestId('menu-discover')).toHaveCount(0);
  await expect(page.getByTestId('account')).toHaveCount(0);
});

test('server: sign in with PKCE, locked pack with "Learn more", progress reaches the server, sign out', async ({ page }) => {
  const errors = await open(page, { server: mock.url });
  await expect(page.getByTestId('sign-in')).toBeVisible(SLOW);
  await shot(page, 'signed-out');
  await signIn(page);
  await expect(page.getByTestId('account-manage')).toHaveAttribute('href', 'https://api.kronland.example/manage');
  expect(new URL(page.url()).search).toBe(''); // code and state are gone from the address
  await shot(page, 'signed-in');

  // still signed in after a reload (tokens in IndexedDB)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('account')).toContainText('Löwe 7', SLOW);

  await page.getByTestId('menu-discover').click();
  await expect(page.getByTestId('pack-wi7.python-pro')).toBeVisible(SLOW);
  await page.getByTestId('pack-wi7.python-pro').click();
  await expect(page.getByTestId('discover-locked')).toBeVisible();
  await expect(page.getByTestId('discover-learn')).toHaveAttribute('href', 'https://api.kronland.example/packs/wi7.python-pro');
  await shot(page, 'discover-locked');
  // own pack of the example account
  await expect(page.getByTestId('pack-k7m2q9')).toBeVisible();

  // progress: starting a level of a pack sends "started"
  await page.getByTestId('pack-wi7.adventures-2').click();
  await page.getByTestId('start-r1-2').click();
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  await expect.poll(async () => (await (await fetch(`${mock.url}/mock/progress`)).json()).events.map((e) => e.type), { timeout: 30_000 }).toContain('started');
  const ev = (await (await fetch(`${mock.url}/mock/progress`)).json()).events[0];
  expect(ev).toMatchObject({ pack: 'wi7.adventures-2', level: 'r1-2' });
  expect(ev.packHash).toMatch(/^[0-9a-f]{64}$/);

  // sign out
  await page.goto(playUrl(), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('account')).toContainText('Löwe 7', SLOW);
  const live = [...mock.state.access.keys()].at(-1);
  expect((await fetch(`${mock.url}/api/v1/me`, { headers: { Authorization: `Bearer ${live}` } })).status).toBe(200);
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('sign-in')).toBeVisible();
  // the server saw the revocation of the refresh token, and the old access token is dead
  await expect.poll(() => mock.state.revoked.length, { timeout: 15_000 }).toBe(1);
  expect(mock.state.revoked[0]).toMatchObject({ hint: 'refresh_token' });
  expect(mock.state.revoked[0].token).toMatch(/^rt_/);
  expect((await fetch(`${mock.url}/api/v1/me`, { headers: { Authorization: `Bearer ${live}` } })).status).toBe(401);
  expect(errors).toEqual([]);
});

test('server: a refused sign-in is shown, nothing changes', async ({ page }) => {
  await open(page, { server: mock.url });
  await page.getByTestId('sign-in').click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('auth-error')).toContainText('abgebrochen', SLOW);
  await expect(page.getByTestId('sign-in')).toBeVisible();
});

test('sources: add and remove one in the settings, ?source= asks first', async ({ page }) => {
  await open(page, {});
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('sources')).toBeVisible(SLOW);
  await expect(page.getByTestId('source-none')).toBeVisible();
  await page.getByTestId('source-input').fill('http://example.org/nope');
  await page.getByTestId('source-add').click();
  await expect(page.getByTestId('source-error')).toBeVisible();
  await page.getByTestId('source-input').fill(`${mock.url}/static/catalog.json`);
  await page.getByTestId('source-add').click();
  await expect(page.getByTestId('source-player')).toContainText('/static/catalog.json');
  await page.getByTestId('source-add').scrollIntoViewIfNeeded();
  await shot(page, 'sources');
  await page.getByTestId('settings-done').click();
  await expect(page.getByTestId('menu-discover')).toBeVisible();
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('source-remove').click();
  await expect(page.getByTestId('source-none')).toBeVisible();
  await page.getByTestId('settings-done').click();
  await expect(page.getByTestId('menu-discover')).toHaveCount(0);

  // link: the player has to agree
  await page.goto(playUrl(`?source=${encodeURIComponent(`${mock.url}/static/`)}`), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('confirm-dialog')).toContainText('/static/catalog.json', SLOW);
  await page.getByTestId('confirm-cancel').click();
  await expect(page.getByTestId('menu-discover')).toHaveCount(0);
  await page.goto(playUrl(`?source=${encodeURIComponent(`${mock.url}/static/`)}`), { waitUntil: 'domcontentloaded' });
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('pack-wi7.adventures-2')).toBeVisible(SLOW);
});

test('cloud: a save game goes to the server and back (signed in)', async ({ page }) => {
  await open(page, { server: mock.url });
  await signIn(page);
  await page.getByTestId('menu-saves').click();
  await page.getByTestId('save-where-cloud').click();
  await expect(page.getByTestId('save-item')).toHaveCount(2, SLOW); // example saves of the mock server
  await expect(page.getByTestId('save-store')).toContainText('Server');
  await shot(page, 'cloud-saves');
});

test('editor: "Save to server" stores the level as a pack, it comes back under Discover levels and opens in the editor', async ({ page }) => {
  const errors = await open(page, { server: mock.url });
  await signIn(page);
  await page.getByTestId('menu-adventures').click();
  await page.getByTestId('open-editor').click();
  await expect(page.getByTestId('editor-canvas')).toBeVisible(SLOW);
  const before = mock.state.packs.size;
  await page.getByTestId('editor-title').fill('Mein Server-Level');
  await page.getByTestId('editor-to-server').click();
  await expect.poll(() => mock.state.packs.size, SLOW).toBe(before + 1);
  const [id, doc] = [...mock.state.packs].at(-1);
  expect(id).toMatch(/^[a-z0-9]{7}$/);
  expect(doc.title.de).toBe('Mein Server-Level');
  // the extra button must not widen the page (phone: the action bar scrolls)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, 'editor-to-server');

  await page.getByTestId('editor-back').click();
  await page.getByTestId('adventure-back').click();
  await page.getByTestId('menu-discover').click();
  await page.getByTestId(`pack-${id}`).click();
  await expect(page.getByTestId('discover-levels').locator('li')).toHaveCount(1, SLOW);
  await page.locator('[data-testid^="edit-"]').click();
  await expect(page.getByTestId('editor-title')).toHaveValue('Mein Server-Level', SLOW);
  expect(errors).toEqual([]);
});
