import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Game UI: hanging top bar, grid at the bottom (map | panel | portrait), quick access with heroes.

const SLOW = { timeout: 20_000 };

async function boot(page, url = '/?seed=42&no-models') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-hud-init')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-hud-init', '1');
    }
  });
  await page.goto(playUrl(url.replace(/^\//, '')));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  return errors;
}

/** Rectangles of the visible HUD parts, checked pairwise for overlap. */
async function overlaps(page) {
  return page.evaluate(() => {
    const parts = ['.tb-res', '.tb-crest', '.tb-sys', '.cb-map', '.context', '.cb-card'];
    const r = Object.fromEntries(parts.map((s) => [s, document.querySelector(s)?.getBoundingClientRect()]).filter(([, b]) => b && b.width));
    const hit = [];
    const keys = Object.keys(r);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = r[keys[i]], b = r[keys[j]];
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) hit.push(keys[i] + '×' + keys[j]);
      }
    }
    return hit;
  });
}

test('Without selection only the map and quick access remain at the bottom; idle shows the count', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__kronland.clearSelection());
  await expect(page.getByTestId('context-panel')).toHaveCount(0);
  await expect(page.getByTestId('selection-card')).toHaveCount(0);
  const idle = await page.evaluate(() => window.__kronland.uiState().idleSerfs);
  expect(idle).toBeGreaterThan(0);
  await expect(page.getByTestId('idle-count')).toHaveText(String(idle));
  expect(errors).toEqual([]);
});

test('Payday shows seconds only shortly before, without constant pulsing; speed as a drop-down menu', async ({ page, isMobile }) => {
  const errors = await boot(page);
  await expect(page.getByTestId('payday-soon')).toHaveCount(0);
  // Jump to shortly before payday
  await page.evaluate(() => {
    const e = window.__kronland;
    e.paused = true;
    const p = e.uiState().paydayIn;
    e.sim.tick += (p - 6) * 10;
    e.emitUi();
  });
  await expect(page.getByTestId('payday-soon')).toBeVisible();
  await expect(page.getByTestId('payday-soon')).toContainText('s');
  // No constant pulsing in the last seconds
  expect(await page.getByTestId('payday').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  if (isMobile) return; // on mobile there is only pause (space)
  await page.evaluate(() => window.__kronland.togglePause());
  // Speed: button unfolds the levels, choosing closes the menu
  const speed = page.getByTestId('speed');
  await expect(speed).toHaveText('1×');
  await speed.click();
  await page.getByTestId('speed-4').click();
  await expect(speed).toHaveText('4×');
  await expect(page.getByTestId('speed-2')).toHaveCount(0);
  await speed.click();
  await expect(page.getByTestId('speed-1')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('speed-1').click();
  await expect(speed).toHaveText('1×');
  // Click elsewhere closes
  await speed.click();
  await page.mouse.click(5, 400);
  await expect(page.getByTestId('speed-2')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Hero portrait selects the hero and brings it into view', async ({ page }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=orrin');
  await page.evaluate(() => window.__kronland.renderer.rig.lookAt(5, 5));
  const portrait = page.getByTestId('quick-hero-orrin');
  await expect(portrait).toBeVisible();
  await portrait.click();
  await expect(page.getByTestId('context-panel')).toContainText('Orrin');
  const d = await page.evaluate(() => {
    const e = window.__kronland;
    const h = [...e.sim.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0);
    const t = e.renderer.rig.target;
    return Math.hypot(t.x - h.px / 1000, t.z - h.py / 1000);
  });
  expect(d).toBeLessThan(12);
  // "Truppen" selects all own squads including the hero
  await page.evaluate(() => window.__kronland.clearSelection());
  await page.getByTestId('quick-army').click();
  await expect(page.getByTestId('context-panel')).toContainText('Orrin');
  expect(errors).toEqual([]);
});

test('Commands are labelled and grouped', async ({ page }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=orrin');
  await page.getByTestId('quick-hero-orrin').click();
  await expect(page.getByTestId('order-hold')).toContainText('Halten');
  await expect(page.getByTestId('order-attack')).toContainText('Angreifen');
  await expect(page.getByTestId('context-panel')).toContainText('Haltung');
  await expect(page.getByTestId('context-panel')).toContainText('Fähigkeiten');
  // Building: upgrade names the next level
  await page.getByTestId('quick-hq').click();
  await expect(page.getByTestId('upgrade')).toContainText('Ausbauen');
  await expect(page.getByTestId('upgrade')).toContainText('Stufe 2');
  expect(errors).toEqual([]);
});

test('Mobile: build menu right after the selection, tapping starts the build', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  const errors = await boot(page);
  await page.getByTestId('quick-all').click();
  // No intermediate step any more: tiles are there immediately
  await expect(page.getByTestId('build-residence')).toBeVisible();
  // Jump mark brings a group further right into view
  await page.getByTestId('build-cat-admin').click();
  await expect(page.getByTestId('build-university')).toBeInViewport();
  await page.getByTestId('build-cat-home').click();
  await expect(page.getByTestId('build-residence')).toBeInViewport();
  await page.getByTestId('build-residence').click();
  await expect(page.getByTestId('place-cancel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Nothing overlaps: top bar and bottom row at different window widths', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop widths');
  test.setTimeout(120_000);
  const errors = await boot(page, '/?seed=42&no-models&hero=orrin');
  for (const sel of ['all', 'hq', 'hero']) {
    if (sel === 'all') await page.getByTestId('quick-all').click();
    else if (sel === 'hq') await page.getByTestId('quick-hq').click();
    else await page.getByTestId('quick-hero-orrin').click();
    for (const width of [1920, 1600, 1440, 1280, 1100, 960, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      expect(await overlaps(page), `${sel} at ${width}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  expect(errors).toEqual([]);
});

test('Control groups: save, recall via the shield and the number key', async ({ page, isMobile }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=orrin');
  // Put two archer squads next to the castle and select them
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    const ids = [s.spawnLeader(0, 'bow1', hq.x + 4, hq.y + hq.h + 3, 0).id, s.spawnLeader(0, 'bow1', hq.x + 6, hq.y + hq.h + 3, 0).id];
    e.selected.clear();
    for (const id of ids) e.selected.add(id);
    e.emitUi();
  });
  if (isMobile) await page.getByTestId('group-save').click();
  else await page.keyboard.press('Shift+Digit1');
  await expect(page.getByTestId('group-1')).toBeVisible();
  await expect(page.getByTestId('group-save')).toContainText('Gruppe 1');
  // Clear the selection, bring it back via the shield
  await page.evaluate(() => window.__kronland.clearSelection());
  await page.getByTestId('group-1').click();
  await expect(page.getByTestId('context-panel')).toContainText('Truppen');
  expect(await page.evaluate(() => window.__kronland.selected.size)).toBe(2);
  if (!isMobile) {
    // Number key: pressing twice in quick succession brings the group into view
    await page.evaluate(() => { window.__kronland.clearSelection(); window.__kronland.renderer.rig.lookAt(5, 5); });
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit1');
    expect(await page.evaluate(() => window.__kronland.selected.size)).toBe(2);
    const d = await page.evaluate(() => {
      const e = window.__kronland, t = e.renderer.rig.target;
      const l = [...e.selected].map((id) => e.sim.entities.get(id));
      return Math.hypot(t.x - l[0].px / 1000, t.z - l[0].py / 1000);
    });
    expect(d).toBeLessThan(12);
  }
  expect(errors).toEqual([]);
});

test('Desktop: crest exactly at the screen centre, castle panel two-column, 5 serfs labelled', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop');
  const errors = await boot(page);
  for (const width of [1920, 1440, 1280, 1000]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.getByTestId('payday').evaluate((el, w) => { const r = el.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - w / 2); }, width), { message: `Medallion at ${width}px` }).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('quick-hq').click();
  await expect(page.getByTestId('buy-serf-5')).toContainText('5 Leibeigene kaufen');
  await expect(page.locator('.bpanel.cols')).toHaveCount(1);
  const cols = await page.locator('.bpanel.cols').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
  expect(errors).toEqual([]);
});

test('Heroes stacked, unconscious visible, abilities and control group explained', async ({ page, isMobile }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=hedda');
  // Abilities and control group are explained in the panel, not only in the tooltip
  await page.locator('[data-testid^=quick-hero-]').first().click();
  const explain = page.getByTestId('army-explain');
  await expect(explain).toBeVisible();
  const desc = await page.evaluate(() => {
    const e = window.__kronland, h = [...e.sim.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0);
    return Object.keys(window.__kronland.uiState().selection.heroes[0].abilities.reduce((o, a) => ({ ...o, [a.id]: 1 }), {}));
  });
  expect(desc.length).toBeGreaterThan(0);
  await expect(explain).toContainText('Gruppe 1');
  await expect(page.getByTestId('group-save')).toContainText('Gruppe 1 anlegen');
  // Unconscious: portrait shows the remaining time instead of the health bar
  await page.evaluate(() => {
    const e = window.__kronland, h = [...e.sim.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0);
    e.paused = true;
    h.down = true; h.hp = 0; h.downTimer = 40;
    e.emitUi();
  });
  await expect(page.getByTestId('hero-down')).toHaveText('6 s');
  await expect(page.locator('[data-testid^=quick-hero-]').first()).toHaveClass(/down/);
  expect(errors).toEqual([]);
});

test('Sound button: mute and music volume right in the top bar', async ({ page }) => {
  const errors = await boot(page);
  await page.getByTestId('sound').click();
  await expect(page.getByTestId('sound-menu')).toBeVisible();
  // Turn the music down: is saved and reported to the audio engine
  await page.getByTestId('sound-music').fill('20');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings')).music)).toBeCloseTo(0.2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kronland-audio') ?? '{}').music)).toBeCloseTo(0.2);
  // Mute
  await page.getByTestId('sound-mute').click();
  await expect(page.getByTestId('sound-mute')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kronland-audio') ?? '{}').muted)).toBe(true);
  // Click elsewhere closes the menu
  await page.mouse.click(5, 400);
  await expect(page.getByTestId('sound-menu')).toHaveCount(0);
  expect(errors).toEqual([]);
});
