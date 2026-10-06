import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Attack alarm: notice, red pulse on the minimap, on mobile the map button pulses; the bell runs without errors.

const SLOW = { timeout: 20_000 };

test('Attack on a serf: notice, pulse on the minimap, map button on mobile', async ({ page, isMobile }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  await page.goto(playUrl('?seed=42&no-models&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  // An enemy serf hits one of ours (event as from combat)
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const mine = [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 0);
    // Pause the game: otherwise the opponent AI sends the serf away from the click point while waiting
    e.paused = true;
    const foe = [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 1);
    e.attackToast({ type: 'hit', by: foe.id, target: mine.id });
    e.emitUi();
  });
  await expect(page.getByTestId('toasts')).toContainText('Eure Siedler werden angegriffen!', SLOW);
  expect(await page.evaluate(() => window.__kronland.minimapDynamic().alerts.length)).toBe(1);
  if (isMobile) await expect(page.getByTestId('minimap-toggle')).toHaveAttribute('data-alarm', '1', SLOW);
  // After ALERT_MS without a hit the pulse is gone
  await expect.poll(() => page.evaluate(() => window.__kronland.minimapDynamic().alerts.length), { timeout: 15_000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('Ranged attack alerts as well; serfs attack an enemy like a tree (right click / tap)', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  await page.goto(playUrl('?seed=42&no-models&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  // Enemy archer shoots at our castle (event as from combat)
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    const L = s.spawnLeader(1, 'bow1', hq.x + 8, hq.y + hq.h + 2, 0);
    e.eventToasts([{ type: 'shot', by: L.id, target: hq.id, from: { x: L.px, y: L.py }, to: { x: L.px, y: L.py }, owner: 1, kind: 'arrow' }]);
    s.entities.delete(L.id);
    e.emitUi();
  });
  await expect(page.getByTestId('toasts')).toContainText('Angriff auf Burg', SLOW);

  // Select own serfs; only once the build panel is up, look for the free click point
  await page.evaluate(() => {
    const e = window.__kronland;
    e.selected.clear();
    for (const u of e.sim.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
  });
  await expect(page.getByTestId('context-panel')).toBeVisible(SLOW);
  await page.waitForTimeout(500);
  // Place an enemy serf next to the castle, select own serfs, click or tap the enemy
  const pos = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    const foe = [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 1);
    const x = hq.x + hq.w + 3.5, z = hq.y + hq.h + 1.5;
    foe.px = Math.round(x * 1000); foe.py = Math.round(z * 1000); foe.job = null; foe.path = []; foe.goal = undefined;
    // Set the camera so the enemy stands clear in the picture (not under the build panel or a button)
    let p = null;
    search: for (let r = 0; r <= 16; r += 2) {
      for (const [dx, dz] of [[r, r], [-r, r], [r, -r], [-r, -r], [0, r], [r, 0], [0, -r], [-r, 0]]) {
        e.renderer.rig.lookAt(x + dx, z + dz); e.renderer.rig.update(0);
        p = e.renderer.project(x, e.renderer.terrain.heightAt(x, z) + 0.4, z);
        if (document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS') break search;
      }
    }
    return { x: p.x, y: p.y, foe: foe.id, fx: foe.px, fz: foe.py };
  });
  await page.waitForTimeout(1500);
  // Click point must not lie under a panel
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, pos)).toBe('CANVAS');
  // Put the enemy back in place right before the click (the opponent AI may have sent it away meanwhile)
  await page.evaluate((p) => {
    const f = window.__kronland.sim.entities.get(p.foe);
    f.px = p.fx; f.py = p.fz; f.job = null; f.path = []; f.goal = undefined;
  }, pos);
  await page.waitForTimeout(400);
  if (info.project.name === 'mobile') await page.touchscreen.tap(pos.x, pos.y);
  else await page.mouse.click(pos.x, pos.y, { button: 'right' });
  await page.evaluate(() => { window.__kronland.paused = false; });
  await expect.poll(() => page.evaluate((id) => [...window.__kronland.sim.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0 && u.job?.kind === 'fight' && u.job.target === id).length, pos.foe), SLOW).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
