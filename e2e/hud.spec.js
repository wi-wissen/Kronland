import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { quick, openQuick } from './quick.js';

// Game UI: hanging top bar, grid at the bottom (map | panel | portrait), quick access with heroes.

const SLOW = { timeout: 20_000 };

async function boot(page, url = '/?seed=42&no-models', gold = '500') {
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
  await expect(page.getByTestId('res-gold')).toHaveText(gold, SLOW);
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
  // Mobile: quick access sits in the map panel behind the map button
  await openQuick(page);
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
  await quick(page, 'army');
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
  await quick(page, 'hq');
  await expect(page.getByTestId('upgrade')).toContainText('Ausbauen');
  await expect(page.getByTestId('upgrade')).toContainText('Stufe 2');
  expect(errors).toEqual([]);
});

test('Mobile: build menu right after the selection, tapping starts the build', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  const errors = await boot(page);
  await quick(page, 'all');
  // Default build view: tiles are there immediately
  await expect(page.getByTestId('build-residence')).toBeVisible();
  // Tabs switch the group
  await page.getByTestId('build-tab-admin').click();
  await expect(page.getByTestId('build-university')).toBeInViewport();
  await page.getByTestId('build-tab-home').click();
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
    if (sel === 'all') await quick(page, 'all');
    else if (sel === 'hq') await quick(page, 'hq');
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
  // Season is shown with its name as long as there is room; when it gets tight (faith added), the name goes first,
  // the crest stays in one row
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.tb-wxname')).toBeVisible();
  // Without faith it is shown greyed out (no gap in the right shield)
  await expect(page.getByTestId('faith')).toHaveClass(/tb-none/);
  await expect(page.getByTestId('faith')).toHaveText('0');
  await page.evaluate(() => { const e = window.__kronland; e.sim.players[0].faith = 1234; e.emitUi(); });
  await expect(page.getByTestId('faith')).toBeVisible();
  await expect(page.getByTestId('faith')).not.toHaveClass(/tb-none/);
  await expect(page.locator('.topbar')).not.toHaveClass(/tight/);
  await page.setViewportSize({ width: 1920, height: 900 });
  await expect(page.locator('.tb-wxname')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await quick(page, 'hq');
  await expect(page.getByTestId('buy-serf-5')).toContainText('5 Leibeigene kaufen');
  await expect(page.locator('.bpanel.cols')).toHaveCount(1);
  const cols = await page.locator('.bpanel.cols').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
  expect(errors).toEqual([]);
});

test('Heroes stacked, unconscious visible, abilities and control group explained', async ({ page, isMobile }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=hedda');
  await page.locator('[data-testid^=quick-hero-]').first().click();
  const explain = page.getByTestId('army-explain');
  const ability = page.locator('[data-testid^=ability-]').first();
  await expect(ability).toBeVisible();
  if (isMobile) {
    // Touch: no hover – abilities and control group are spelled out in the panel
    await expect(explain).toBeVisible();
    await expect(explain).toContainText('Gruppe 1');
  } else {
    // Desktop: compact panel, explanation in the tooltip; health of the hero in the selection card
    await expect(explain).toHaveCount(0);
    await ability.hover();
    await expect(page.getByTestId('tooltip')).toBeVisible();
    await page.getByTestId('group-save').hover();
    await expect(page.getByTestId('tooltip')).toContainText('Taste 1');
    await expect(page.getByTestId('selection-card')).toContainText('Lebenspunkte');
  }
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

/** Set all resources to one value (storehouse, nothing raw). */
async function setStock(page, n) {
  await page.evaluate((v) => {
    const e = window.__kronland, p = e.sim.players[0];
    for (const r of Object.keys(p.stock)) { p.stock[r] = v; if (r in p.raw) p.raw[r] = 0; }
    e.emitUi();
  }, n);
}

test('Resource bar: large amounts shortened, everything in one row with the crest', async ({ page, isMobile }) => {
  const errors = await boot(page);
  await setStock(page, 50000);
  await expect(page.getByTestId('res-gold')).toHaveText('50k');
  await expect(page.getByTestId('res-gold')).toHaveAttribute('data-value', '50000');
  // Exact value is in the tooltip (mouse; on mobile via long press, see labels.spec.js)
  if (!isMobile) {
    await page.getByTestId('res-gold').hover();
    await expect(page.getByTestId('tooltip')).toContainText('50000');
  }
  const box = (s) => page.locator(s).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  if (isMobile) {
    // Last resource fully visible, crest and coin buttons share the second row
    const vw = page.viewportSize().width;
    const items = await page.locator('.tb-resitem').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const r of items) expect(r).toBeLessThanOrEqual(vw);
    const crest = await box('.tb-crest'), sys = await box('.tb-sys');
    expect(sys.t).toBeLessThan(crest.b);
    expect(sys.l).toBeGreaterThanOrEqual(crest.r - 1);
  } else {
    for (const width of [1440, 1180]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      // Crest stays in the first row (no row of its own), medallion centred
      await expect(page.getByTestId('topbar')).not.toHaveClass(/tight/);
      const res = await box('.tb-res'), crest = await box('.tb-crest');
      expect(crest.t, `Crest at ${width}px`).toBeLessThan(res.b);
      expect(res.r).toBeLessThan(crest.l);
    }
    // Narrower: resources in two rows instead of the crest in its own row
    await expect(page.getByTestId('res-bar')).toHaveClass(/two/);
  }
  // Below the limit the exact number stays
  await setStock(page, 9999);
  await expect(page.getByTestId('res-gold')).toHaveText('9999');
  expect(errors).toEqual([]);
});

test('Hero images sit round in the frame', async ({ page }) => {
  const errors = await boot(page, '/?seed=42&no-models&hero=orrin');
  await page.getByTestId('quick-hero-orrin').click();
  // hero alone: only the health bar (the heading names him); with a squad the hero card appears
  await expect(page.getByTestId('hero-orrin')).toBeVisible();
  await expect(page.locator('[data-testid=hero-orrin] .hc-portrait')).toHaveCount(0);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    e.selected.add(s.spawnLeader(0, 'sword1', hq.x + 2, hq.y + hq.h + 2).id);
    e.emitUi();
  });
  for (const frame of ['[data-testid=quick-hero-orrin] .cb-pic', '[data-testid=hero-orrin] .hc-portrait']) {
    const fit = await page.locator(frame).evaluate((el) => {
      const img = el.querySelector('img.ico.portrait');
      const a = el.getBoundingClientRect(), b = img.getBoundingClientRect();
      return { radius: getComputedStyle(img).borderRadius, inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5 && b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5, fill: b.width / a.width };
    });
    expect(fit.radius, frame).toBe('50%');
    expect(fit.inside, frame).toBe(true);
    expect(fit.fill, frame).toBeGreaterThan(0.85);
  }
  expect(errors).toEqual([]);
});

test('Mobile: map button unfolds minimap and quick access and folds them again', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  const errors = await boot(page);
  await page.evaluate(() => window.__kronland.clearSelection());
  const toggle = page.getByTestId('minimap-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('quick-hq')).toHaveCount(0);
  await expect(page.getByTestId('minimap')).toHaveCount(0);
  // Bottom right
  const vp = page.viewportSize();
  const b = await toggle.boundingBox();
  expect(b.x + b.width).toBeGreaterThan(vp.width * 0.8);
  expect(b.y).toBeGreaterThan(vp.height * 0.7);
  // Unfold: minimap and four quick accesses in the panel, within the screen
  await toggle.click();
  const panel = page.getByTestId('map-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('minimap-canvas')).toBeVisible();
  for (const k of ['hq', 'idle', 'all', 'army']) await expect(panel.getByTestId('quick-' + k)).toBeVisible();
  const p = await panel.boundingBox();
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(vp.width);
  // Tapping again folds it
  await toggle.click();
  await expect(panel).toHaveCount(0);
  // Quick access folds after triggering
  await toggle.click();
  await page.getByTestId('quick-all').click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('build-residence')).toBeVisible(SLOW);
  expect(errors).toEqual([]);
});

test('Objectives: on mobile a compact button with a full-screen view, "Ziel zeigen" closes it', async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  const errors = await boot(page, '/?mission=showcase&no-models&quality=low', '50k');
  const toggle = page.getByTestId('objectives-toggle');
  await expect(toggle).toBeVisible(SLOW);
  const vp = page.viewportSize();
  if (!isMobile) {
    // Desktop: panel unfolds in itself, no full-screen view
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('objectives-sheet')).toHaveCount(0);
    await expect(page.getByTestId('objective-go-see-buildingArea')).toBeVisible();
    expect(errors).toEqual([]);
    return;
  }
  // Mobile: initially only a small button at the top left
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const chip = await page.getByTestId('objectives').boundingBox();
  expect(chip.width).toBeLessThan(vp.width * 0.5);
  expect(chip.x).toBeLessThan(vp.width * 0.1);
  await expect(toggle).toContainText('Ziele');
  await toggle.click();
  const sheet = page.getByTestId('objectives-sheet');
  await expect(sheet).toBeVisible();
  const s = await sheet.boundingBox();
  expect(s.width).toBeGreaterThan(vp.width * 0.9);
  expect(s.height).toBeGreaterThan(vp.height * 0.9);
  // Close button
  await page.getByTestId('objectives-close').click();
  await expect(sheet).toHaveCount(0);
  // "Ziel zeigen" jumps there and closes the view
  await toggle.click();
  const before = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  await page.getByTestId('objective-go-see-buildingArea').click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => {
    const after = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
    return Math.abs(after.x - before.x) + Math.abs(after.z - before.z);
  }).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

/** Rectangle of the pause banner and the HUD parts it overlaps. */
async function bannerSpot(page) {
  return page.evaluate(() => {
    const b = document.querySelector('[data-testid="pause-banner"]').getBoundingClientRect();
    const hit = ['.tb-res', '.tb-crest', '.tb-sys', '.cb-units', '.cb-quick', '.context', '.cb-card', '.cmdbar button', '.cmdbar canvas', '.toasts .toast']
      .flatMap((sel) => [...document.querySelectorAll(sel)].map((el) => [sel, el.getBoundingClientRect()]))
      .filter(([, r]) => r.width && b.left < r.right - 1 && r.left < b.right - 1 && b.top < r.bottom - 1 && r.top < b.bottom - 1)
      .map(([sel]) => sel);
    return { top: b.top, bottom: b.bottom, vh: innerHeight, hit };
  });
}

test('Space pauses game and animations, greys the world and shows the pause banner at the bottom', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__kronland.clearSelection());
  await expect(page.getByTestId('pause-banner')).toHaveCount(0);
  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause-banner')).toBeVisible();
  await expect(page.getByTestId('pause-banner')).toContainText('Pausiert');
  await expect(page.getByTestId('game-canvas')).toHaveCSS('filter', 'grayscale(1)');
  // animation clock of the renderer stands still while paused
  const t0 = await page.evaluate(() => window.__kronland.renderer.time);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__kronland.renderer.time)).toBe(t0);
  // bottom centre, clear of the HUD; lets clicks through to the map
  const spot = await bannerSpot(page);
  expect(spot.bottom).toBeGreaterThan(spot.vh * 0.85);
  expect(spot.hit).toEqual([]);
  expect(await page.getByTestId('pause-banner').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.screenshot({ path: `test-results/pause-banner-${test.info().project.name}.png` });
  // with a selection the context panel takes the bottom: banner moves under the top bar
  await page.evaluate(() => window.__kronland.selectIdleSerfs());
  await expect(page.getByTestId('context-panel')).toBeVisible();
  await expect.poll(async () => (await bannerSpot(page)).bottom).toBeLessThan(spot.vh * 0.3);
  expect((await bannerSpot(page)).hit.filter((h) => h.startsWith('.tb-'))).toEqual([]);
  await page.screenshot({ path: `test-results/pause-banner-selected-${test.info().project.name}.png` });
  // Space again: game, colours and animations continue
  await page.keyboard.press(' ');
  await expect(page.getByTestId('pause-banner')).toHaveCount(0);
  await expect(page.getByTestId('game-canvas')).toHaveCSS('filter', 'none');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__kronland.renderer.time)).toBeGreaterThan(t0);
  expect(errors).toEqual([]);
});
