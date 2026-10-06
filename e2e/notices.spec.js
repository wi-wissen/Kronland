import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Notices with categories: the attack alarm stays as long as the fight lasts; promotions merge into
// one entry; a finished building stays visible anyway; × closes a notice (also by touch).

const SLOW = { timeout: 20_000 };
const SHOTS = process.env.SHOTS_DIR;

test('In combat: attack stays, promotions merged, finished building visible', async ({ page, isMobile }, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  await page.goto(playUrl('?seed=42&no-models&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);

  // Own and enemy squad in front of the castle; hits and promotions come as events as from combat
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    e.paused = true; // the opponent AI should not change the situation during the test
    const mine = s.spawnLeader(0, 'sword1', hq.x + 4, hq.y + hq.h + 3);
    const foe = s.spawnLeader(1, 'sword1', hq.x + 6, hq.y + hq.h + 3);
    window.__fight = { mine: mine.id, foe: foe.id, hq: hq.id, n: 0 };
    window.__hits = setInterval(() => {
      const f = window.__fight;
      e.attackToast({ type: 'hit', by: f.foe, target: f.mine });
      // fast promotions in combat
      e.eventToasts([{ type: 'promoted', player: 0, leader: f.mine, stars: 1 + (f.n++ % 3) }]);
    }, 400);
  });
  const toasts = page.getByTestId('toast');
  const attack = toasts.filter({ hasText: 'Eure Truppen sind im Kampf!' });
  await expect(attack).toBeVisible(SLOW);
  await expect(attack).toHaveAttribute('data-sticky', '1');
  // After more than the old display duration (7 s) the alarm still stands, promotions remain one entry
  await page.waitForTimeout(8000);
  await expect(attack).toBeVisible();
  const promo = toasts.filter({ hasText: 'Beförderungen' });
  await expect(promo).toHaveCount(1);
  expect(Number((await promo.innerText()).match(/(\d+) Beförderungen/)[1])).toBeGreaterThan(5);
  // A building finishes in the middle of the fight: gets a place despite the promotions
  await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.entities.get(window.__fight.hq);
    // like from the buildingDone event, only standing longer (SwiftShader is slow)
    e.toast('toast.buildingDone', { building: 'residence', level: 0 }, { icon: 'b-residence', tone: 'good', pos: e.entityPos(hq), ttl: 60000 });
  });
  const done = toasts.filter({ hasText: 'Wohnhaus fertig' });
  await expect(done).toBeVisible(SLOW);
  await expect(toasts.first()).toContainText('Eure Truppen sind im Kampf!'); // alarm on top
  // Wait for the fade-in (SwiftShader renders slowly, the transitions hang on requestAnimationFrame)
  await expect.poll(() => done.evaluate((el) => getComputedStyle(el).opacity), SLOW).toBe('1');
  if (SHOTS) { await page.screenshot({ path: `${SHOTS}/notices-${info.project.name}.png` }); }

  // × closes the finished building (tap on mobile)
  const close = done.getByTestId('toast-close');
  if (isMobile) await close.tap(); else await close.click();
  await expect(done).toHaveCount(0);
  // Jump to the combat location: the alarm stays
  await attack.locator('.toast-main').click();
  await page.waitForTimeout(500);
  await expect(attack).toBeVisible();

  // Combat over: after the grace period (ALERT_MS) the alarm disappears by itself
  await page.evaluate(() => clearInterval(window.__hits));
  await expect(attack).toHaveCount(0, { timeout: 40_000 });
  expect(errors).toEqual([]);
});
