import { test, expect } from '@playwright/test';
import { playUrl, hashed } from './paths.js';

// Selection by sex: a female serf is called "1 Leibeigene" and shows the female portrait, a male serf
// "1 Leibeigener" with a male portrait (sex = drawn variant, src/render/variants.js figureSex).
// Screenshots: test-results/sex-<f|m>-<project>.png

const SLOW = { timeout: 60_000 };

test('Female and male serf: title and portrait match the figure', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.renderer, null, { timeout: 120_000 });
  // Figure manifest loaded: among the own serfs there are both variants
  const ids = await page.waitForFunction(() => {
    const e = window.__kronland;
    const serfs = [...e.sim.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0 && !u.militia);
    const f = serfs.find((u) => e.sexOf(u) === 'f'), m = serfs.find((u) => e.sexOf(u) === 'm');
    return f && m ? { f: f.id, m: m.id } : null;
  }, null, SLOW).then((h) => h.jsonValue());

  const select = async (id) => {
    await page.evaluate((id) => {
      const e = window.__kronland, u = e.sim.entities.get(id);
      e.selected.clear(); e.selected.add(id); e.emitUi();
      const r = e.renderer.rig;
      r.dist = 9; r.lookAt(u.px / 1000, u.py / 1000); r.clamp?.(); r.update(0);
    }, id);
  };
  // Desktop: selection card with portrait; mobile: head of the command panel (title + small portrait)
  const phone = info.project.name !== 'desktop';
  const card = phone ? page.getByTestId('context-panel') : page.getByTestId('selection-card');
  const pic = card.locator(phone ? '.cx-mini img' : '.sc-portrait img');

  await select(ids.f);
  await expect(card).toHaveAttribute('aria-label', '1 Leibeigene', SLOW);
  await expect(pic).toHaveAttribute('src', hashed('portraits/serf-f.webp'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test-results/sex-f-${info.project.name}.png` });

  await select(ids.m);
  await expect(card).toHaveAttribute('aria-label', '1 Leibeigener', SLOW);
  await expect(pic).toHaveAttribute('src', hashed('portraits/serf.webp'));
  // the line under "Bauen" (desktop) also names the figure in the singular
  if (!phone) await expect(page.getByTestId('context-panel').locator('.cx-sub')).toContainText('1 Leibeigener');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `test-results/sex-m-${info.project.name}.png` });

  // both together: plural, independent of the sex
  await page.evaluate(([a, b]) => { const e = window.__kronland; e.selected.clear(); e.selected.add(a); e.selected.add(b); e.emitUi(); }, [ids.f, ids.m]);
  await expect(card).toHaveAttribute('aria-label', '2 Leibeigene', SLOW);
  expect(errors).toEqual([]);
});
