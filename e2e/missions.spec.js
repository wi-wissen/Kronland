import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { quick } from './quick.js';

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
  await page.goto(playUrl());
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
  await expect(page.getByTestId('ui-pointer')).toBeVisible();
  await quick(page, 'all');
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
  await expect(page.getByTestId('briefing')).toContainText('Lindgrund');
  await page.getByTestId('mission-start').click();
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');

  const obj = page.getByTestId('objectives');
  await expect(obj).toBeVisible();
  // On mobile the list is collapsed at first
  // First objective: Nelia to the stranger on the village square (Orrin); the build objectives follow bit by bit
  if (!(await page.getByTestId('objective-meet').isVisible())) await page.getByTestId('objectives-toggle').click();
  await expect(page.getByTestId('objective-meet')).toContainText('Fremden');
  await expect(page.getByTestId('objective-homes')).toHaveCount(0);
  // The dialogue fades out after a few seconds; under load it may already be gone.
  // Hence check the mission state (speaker of the first message) and, if still visible, the display.
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.state.messages.map((m) => m.speaker).join(',')), SLOW).toMatch(/nelia/i);
  const speaker = page.getByTestId('dialog-speaker');
  if (await speaker.isVisible()) await expect(speaker).toContainText('Nelia');
  await expect(page.getByTestId('res-gold')).toHaveText('400');
  expect(errors).toEqual([]);
});

test('Victory unlocks the next mission', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c1'));
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
  await page.goto(playUrl('?mission=tutorial'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('tutorial-title')).toHaveText('Welcome');
  await expect(page.getByTestId('tutorial-next')).toHaveText('Next');
});

test('Offers: mercenaries or serfs - paying closes the other offer (mission 4)', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c4&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c4');
  const panel = page.getByTestId('tributes');
  await expect(panel).toBeVisible(SLOW);
  await expect(page.getByTestId('tribute-mercs')).toContainText('Söldner');
  await expect(page.getByTestId('tribute-refugees')).toContainText('Leibeigene');
  // Collapsible (mobile: little space)
  await page.getByTestId('tributes-toggle').click();
  await expect(page.getByTestId('tribute-mercs')).toHaveCount(0);
  await page.getByTestId('tributes-toggle').click();
  const serfs = () => page.evaluate(() => [...window.__kronland.sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).length);
  const before = await serfs();
  await page.getByTestId('tribute-pay-refugees').click();
  await expect(panel).toHaveCount(0, SLOW);
  await expect.poll(serfs, SLOW).toBeGreaterThanOrEqual(before + 8);
  expect(errors).toEqual([]);
});

test('Mission 2: later buildings are greyed out, the pointer shows the farm, the barracks unlocks with the first trade', async ({ page }, testInfo) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c2&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c2');
  await quick(page, 'all');
  const farm = page.getByTestId('build-farm');
  await expect(farm).toBeVisible(SLOW);
  // Objective "3 farms" points at the farm tile; buildings of later missions are locked
  await expect(farm).toHaveClass(/hint/);
  await expect(page.getByTestId('ui-pointer')).toBeVisible(SLOW);
  const barracks = page.getByTestId('build-barracks');
  await expect(barracks).toHaveClass(/locked/);
  await expect(barracks).toHaveAttribute('aria-label', /In dieser Mission nicht verfügbar/);
  await expect(page.getByTestId('build-smithy')).toHaveClass(/locked/);
  await page.screenshot({ path: testInfo.outputPath('c2-locked.png') });
  // Milestone: first trade – the herald comes, the barracks is free
  await page.evaluate(() => { window.__kronland.sim.mission.state.flags.traded = true; });
  await expect(barracks).not.toHaveClass(/locked/, SLOW);
  await expect(page.getByTestId('tribute-buyShard')).toBeVisible(SLOW);
  expect(errors).toEqual([]);
});

test('Conversation figure: Orrin talks to the village elder, the neighbouring village becomes allied (mission 1)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  // Nelia already stands with Orrin on the village square, then almost at the old root (the walking is not
  // the subject here); afterwards Orrin goes to the village elder by command, as with a right click
  await page.evaluate(() => {
    const e = window.__kronland, st = e.sim.mission.state, n = e.sim.entities.get(st.refs.nelia);
    const o = e.sim.entities.get(st.npcs.stranger.entity);
    n.px = o.px + 1000; n.py = o.py; n.path = [];
  });
  await page.waitForFunction(() => window.__kronland.sim.mission.state.flags.orrin, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const e = window.__kronland, st = e.sim.mission.state, n = e.sim.entities.get(st.refs.nelia);
    n.px = st.refs.oldRoot.x * 1000 + 500; n.py = st.refs.oldRoot.y * 1000 + 1500; n.path = [];
  });
  await page.waitForFunction(() => window.__kronland.sim.mission.state.npcs.elder, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const e = window.__kronland, st = e.sim.mission.state;
    const npc = e.sim.entities.get(st.npcs.elder.entity);
    const o = e.sim.entities.get(st.refs.orrin);
    o.px = npc.px + 6000; o.py = npc.py;
    e.issue({ type: 'order', units: [st.refs.orrin], order: 'move', x: Math.floor(npc.px / 1000), y: Math.floor(npc.py / 1000) + 1 });
  });
  await page.waitForFunction(() => window.__kronland.sim.mission.state.npcs.elder.state === 'talked', null, { timeout: 120_000 });
  // The conversation is in the notices (the display itself changes quickly depending on speed)
  expect(await page.evaluate(() => window.__kronland.sim.mission.state.messages.some((m) => m.speaker === 'elder'))).toBe(true);
  await expect(page.getByTestId('dialog').first()).toBeVisible(SLOW);
  const rel = await page.evaluate(() => { const s = window.__kronland.sim; return s.relation(0, s.mission.playerOf('neighbors')); });
  expect(rel).toBe('allied');
  expect(errors).toEqual([]);
});

/** Screenshot for the docs (only with E2E_SHOTS=<folder>); desktop 1440×900, mobile with suffix "-phone". */
async function shot(page, testInfo, name) {
  if (!process.env.E2E_SHOTS) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}-${testInfo.project.name === 'mobile' ? 'phone' : 'desktop'}.png` });
}

/** Unfold the objectives list (collapsed at first on mobile). */
async function openObjectives(page) {
  await expect(page.getByTestId('objectives')).toBeVisible(SLOW);
  if (await page.getByTestId('objectives-toggle').getAttribute('aria-expanded') !== 'true') await page.getByTestId('objectives-toggle').click();
}

/** Point the camera at a mission reference; reveal the region for it (fog of war). */
async function lookAt(page, ref, dist = null) {
  await page.evaluate(([ref, dist]) => {
    const e = window.__kronland, p = e.sim.mission.pointOf(e.sim, ref), r = e.renderer.rig;
    e.sim.mission.runAction(e.sim, { type: 'reveal', area: ref, r: 34, seconds: 120 });
    for (let i = 0; i < 6; i++) e.stepOnce();
    r.lookAt(p.x, p.y); if (dist) r.dist = dist; r.update(0);
  }, [ref, dist]);
  await page.waitForTimeout(1500);
}

test('Mission 3: Valley behind the ridge - after the weather works the clock runs until the thaw', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c3'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c3' && window.__kronland.renderer.frameNo > 2, null, { timeout: 60_000 });
  await openObjectives(page);
  await expect(page.getByTestId('objective-works')).toBeVisible(SLOW);
  await expect(page.getByTestId('objective-escape')).toHaveCount(0);
  // Mountain ridge with steep slope, passage at the gate (land) and in the gorge (ice)
  const ok = await page.evaluate(() => {
    const s = window.__kronland.sim, st = s.mission.state, m = s.map;
    const cliff = [...m.flags].filter((f) => f & 8).length;
    const gate = st.refs.gate, gorge = st.refs.gorge;
    return { cliff, gate: !(m.flags[m.idx(gate.x, gate.y)] & (1 | 8)), gorge: !!(m.flags[m.idx(gorge.x, gorge.y)] & 1) };
  });
  expect(ok.cliff).toBeGreaterThan(500);
  expect(ok).toMatchObject({ gate: true, gorge: true });
  await page.evaluate(() => window.__kronland.renderer.rig.update(0));
  await lookAt(page, 'gorge', 30);
  await shot(page, testInfo, 'c3-gorge');
  // Works destroyed: the escape objective with clock appears
  await page.evaluate(() => { const e = window.__kronland; e.sim.mission.runAction(e.sim, { type: 'remove', ref: 'weatherworks' }); });
  await expect(page.getByTestId('objective-escape')).toBeVisible(SLOW);
  await expect(page.getByTestId('objective-escape')).toContainText(/\d:\d\d/);
  await lookAt(page, 'isle', 28);
  await shot(page, testInfo, 'c3-thaw');
  expect(errors).toEqual([]);
});

test('Mission 6: Malvor\'s weather power plant with loading bar on the works island', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=c6'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c6' && window.__kronland.renderer.frameNo > 2, null, { timeout: 60_000 });
  await openObjectives(page);
  const goal = page.getByTestId('objective-malvorPlant');
  await expect(goal).toBeVisible(SLOW);
  await expect(goal).toContainText('1000/1000');
  const owner = await page.evaluate(() => { const s = window.__kronland.sim; return s.entities.get(s.mission.state.refs.malvorPlant)?.owner; });
  expect(owner).toBe(1);
  await lookAt(page, 'worksIsle', 22);
  await shot(page, testInfo, 'c6-plant');
  expect(errors).toEqual([]);
});
