import { test, expect } from '@playwright/test';

/** Record page errors; progress and language back to the start. */
async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-campaign-1');
      localStorage.removeItem('kronland-lang');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.goto('/');
  return errors;
}

// Software rendering (swiftshader) is slow: wait generously for step changes
const SLOW = { timeout: 20_000 };

const stepId = (page) => page.evaluate(() => window.__kronland?.sim.mission?.currentStep()?.id ?? null);

test('Start the tutorial from the menu, see the first step, complete a step, skip', async ({ page }) => {
  const errors = await fresh(page);
  await page.getByTestId('menu-tutorial').click();
  await page.waitForFunction(() => !!window.__kronland);
  const coach = page.getByTestId('tutorial-coach');
  await expect(coach).toBeVisible();
  await expect(page.getByTestId('tutorial-title')).toHaveText('Willkommen');
  await expect(page.getByTestId('tutorial-step')).toContainText('Schritt 1');

  // Reading step: "Weiter"
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('tutorial-title')).toHaveText('Umsehen', SLOW);
  // Camera step via "Weiter" (equivalent to dragging on phones)
  await page.getByTestId('tutorial-next').click();
  await expect(page.getByTestId('tutorial-title')).toHaveText('Leibeigene', SLOW);

  // Action step: highlight points at "Alle", click completes it
  await expect(page.getByTestId('tutorial-highlight')).toBeVisible();
  await page.getByTestId('quick-all').click();
  await expect(page.getByTestId('tutorial-title')).toHaveText('Holz schlagen', SLOW);
  expect(await stepId(page)).toBe('wood');

  // Skip
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('tutorial-title')).toHaveText('Lehm abbauen', SLOW);
  expect(errors).toEqual([]);
});

test('Skipping the tutorial to the end shows the conclusion', async ({ page }) => {
  const errors = await fresh(page);
  await page.getByTestId('menu-tutorial').click();
  await page.waitForFunction(() => !!window.__kronland);
  // Three real clicks, the rest via the engine (software rendering is very slow in the test)
  for (let i = 0; i < 3; i++) {
    const before = await stepId(page);
    await page.getByTestId('tutorial-skip').click();
    await page.waitForFunction((b) => window.__kronland.sim.mission.currentStep()?.id !== b, before);
  }
  await page.evaluate(() => {
    const e = window.__kronland;
    for (let i = 0; i < 30 && !e.sim.mission.state.result; i++) { e.missionSkip(); e.stepOnce(); }
    e.emitUi();
  });
  await expect(page.getByTestId('mission-result-title')).toHaveText('Tutorial beendet');
  await expect(page.getByTestId('next-mission')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Open the campaign, start mission 1, see objectives and dialogue', async ({ page }) => {
  const errors = await fresh(page);
  await page.getByTestId('menu-campaign').click();
  await expect(page.getByTestId('campaign-menu')).toBeVisible();
  // Only mission 1 is unlocked
  await expect(page.getByTestId('mission-c1')).toBeEnabled();
  await expect(page.getByTestId('mission-c2')).toBeDisabled();
  await expect(page.getByTestId('briefing')).toContainText('Erlengrund');
  await page.getByTestId('mission-start').click();
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');

  const obj = page.getByTestId('objectives');
  await expect(obj).toBeVisible();
  // On mobile the list is collapsed at first
  if (!(await page.getByTestId('objective-homes').isVisible())) await page.getByTestId('objectives-toggle').click();
  await expect(page.getByTestId('objective-homes')).toContainText('Wohnhäuser');
  await expect(page.getByTestId('objective-homes')).toContainText('0/2', SLOW);
  // The dialogue fades out after a few seconds; under load it may already be gone.
  // Hence check the mission state (speaker of the first message) and, if still visible, the display.
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.state.messages.map((m) => m.speaker).join(',')), SLOW).toMatch(/ottilie/i);
  const speaker = page.getByTestId('dialog-speaker');
  if (await speaker.isVisible()) await expect(speaker).toContainText('Ottilie');
  await expect(page.getByTestId('res-gold')).toHaveText('600');
  expect(errors).toEqual([]);
});

test('Victory unlocks the next mission', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto('/?mission=c1');
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  await page.evaluate(() => { const e = window.__kronland; e.sim.mission.finish(e.sim, true, 'objectives'); e.emitUi(); });
  await expect(page.getByTestId('mission-result-title')).toHaveText('Sieg!');
  await expect(page.getByTestId('debrief')).toBeVisible();
  await page.getByTestId('to-campaign').click();
  await expect(page.getByTestId('mission-c2')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('English texts via the saved language', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('kronland-lang', 'en'));
  await page.goto('/?mission=tutorial');
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('tutorial-title')).toHaveText('Welcome');
  await expect(page.getByTestId('tutorial-next')).toHaveText('Next');
});
