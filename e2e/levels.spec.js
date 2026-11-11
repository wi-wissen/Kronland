import { test, expect } from './fixtures.js';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { playUrl } from './paths.js';
import { openWorkshop } from './menu.js';

// Levels as .zip: opened by link from another server, with a talk figure, an own speaker with portrait and a
// 3D model that does not load (stand-in); in the world editor opened, listed and saved again.

const SLOW = { timeout: 30_000 };
/** 1×1 PNG */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const MISSION = `alchemist = npc("alchemist", look="assets/alchemist.glb", at=(12, 8))
objective("talk", de="Sprich mit dem Alchemisten", en="Talk to the alchemist")

@on_talk("alchemist")
def talk(hero):
    alchemist.stop_talking()
    say("alchemist", de="Schwefel? Im Norden, hinter dem Grat.", en="Sulfur? Up north, behind the ridge.", voice="assets/missing.mp3")
    complete("talk")
`;

function levelZip() {
  const scenario = {
    format: 'kronland-scenario', version: 2, id: 'e2e-alchemist', kind: 'mission', end: 'objectives',
    title: { de: 'Der Alchemist', en: 'The Alchemist' },
    summary: { de: 'Ein Level per Link', en: 'A level by link' },
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 6, y: 8 }] },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    speakers: { alchemist: { name: { de: 'Alchemist Berthold', en: 'Berthold the Alchemist' }, color: '#7a4a8a', portrait: 'assets/alchemist.png' } },
    sections: [{ id: 'mission', file: 'mission.py', level: 'mission', visibility: 'hidden', editable: false }],
  };
  return Buffer.from(zipSync({
    'alchemist/scenario.json': strToU8(JSON.stringify(scenario, null, 2)),
    'alchemist/mission.py': strToU8(MISSION),
    'alchemist/assets/alchemist.png': new Uint8Array(PNG),
    // not a real model: the normal figure must stand in
    'alchemist/assets/alchemist.glb': strToU8('broken'),
  }));
}

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-editor-draft');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

/** Screen position of an entity's drawn figure. */
const screenOf = (page, kind) => page.evaluate((k) => {
  const e = window.__kronland;
  const fig = [...e.sim.entities.values()].find((x) => x.kind === k);
  const rec = e.renderer.chars.records.get(fig.id);
  const p = e.renderer.project(rec.position.x, rec.position.y + 0.5, rec.position.z);
  const r = e.renderer.renderer.domElement.getBoundingClientRect();
  return { x: p.x, y: p.y, w: r.width, h: r.height };
}, kind);

test('Level by link: zip from another server, talk figure, own speaker, stand-in for a missing model', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = await fresh(page);
  await page.route('https://levels.example/**', (route) => route.fulfill({
    status: 200, body: levelZip(), headers: { 'content-type': 'application/zip', 'access-control-allow-origin': '*' },
  }));
  await page.goto(playUrl('?level=https://levels.example/alchemist.zip&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim?.mission?.def?.custom, null, SLOW);
  expect(page.url()).toContain('level=https');
  await expect(page.getByTestId('objectives')).toBeVisible(SLOW);
  // On phones the objectives are a chip; the text is in the sheet
  if (page.viewportSize().width >= 760) await expect(page.getByTestId('objectives')).toContainText('Sprich mit dem Alchemisten');
  // The broken model: the figure still stands there (procedural stand-in)
  const npc = await page.evaluate(() => {
    const e = window.__kronland;
    const n = [...e.sim.entities.values()].find((x) => x.kind === 'npc');
    return { look: n.look, drawn: e.renderer.chars.records.get(n.id)?.visible ?? false };
  });
  expect(npc).toEqual({ look: 'assets/alchemist.glb', drawn: true });

  // Select Nelia and tap the alchemist: she walks there and talks
  await page.getByTestId('quick-hero-nelia').click();
  // On phones the hero panel covers the lower half: fold it first
  if (await page.getByTestId('panel-collapse').isVisible()) {
    await page.getByTestId('panel-collapse').click();
    await expect(page.getByTestId('panel-collapse')).toHaveAttribute('aria-expanded', 'false');
  }
  // Camera and game area may still change after selecting and folding (phones): tap once the figure has stood
  // still on screen for a while
  let p = await screenOf(page, 'npc'), still = 0;
  for (let i = 0; i < 30 && still < 3; i++) {
    await page.waitForTimeout(300);
    const q = await screenOf(page, 'npc');
    still = Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1 && q.w === p.w && q.h === p.h ? still + 1 : 0;
    p = q;
  }
  if (page.viewportSize().width < 760) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByTestId('dialog-speaker')).toHaveText('Alchemist Berthold', { timeout: 60_000 });
  await expect(page.getByTestId('dialog-text')).toContainText('Schwefel');
  await expect(page.locator('.dlg-seal img')).toHaveAttribute('src', /^blob:/);
  await page.screenshot({ path: test.info().outputPath('talk.png') });
  await expect(page.getByTestId('mission-result')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('Level as zip in the world editor: open, files tab, save again; goals in the adventure menu', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-kind-code').click();
  await page.getByTestId('lib-mine').locator('summary').click();
  await expect(page.getByTestId('level-link')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('library.png'), fullPage: true });
  // A script mission of the game is a series of its own
  await page.getByTestId('series-script-missions').click();
  await expect(page.getByTestId('level-row-m1')).toContainText('Der Überfall');
  await page.getByTestId('library-back').click();
  await page.getByTestId('library-back').click();
  await openWorkshop(page);
  await page.waitForFunction(() => !!window.__kronlandEditor, null, SLOW);
  await page.getByTestId('editor-open-file').setInputFiles({ name: 'alchemist.zip', mimeType: 'application/zip', buffer: levelZip() });
  if (page.viewportSize().width < 900) await page.getByTestId('editor-panel-open').click();
  await page.getByTestId('editor-tab-files').click();
  await expect(page.getByTestId('asset-assets/alchemist.png')).toBeVisible(SLOW);
  await expect(page.getByTestId('asset-assets/alchemist.glb')).toBeVisible();
  // version 2: no text table tab
  await expect(page.getByTestId('editor-tab-texts')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('editor-files.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('editor-save').click()]);
  expect(dl.suggestedFilename()).toBe('e2e-alchemist.zip');
  const fs = await import('node:fs/promises');
  const files = unzipSync(new Uint8Array(await fs.readFile(await dl.path())));
  expect(Object.keys(files).sort()).toEqual(['assets/alchemist.glb', 'assets/alchemist.png', 'mission.py', 'scenario.json']);
  expect(strFromU8(files['mission.py'])).toBe(MISSION);
  const json = JSON.parse(strFromU8(files['scenario.json']));
  expect(json.sections[0]).toMatchObject({ id: 'mission', file: 'mission.py' });
  expect(json.sections[0].code).toBeUndefined();
  expect(json.world.terrain).toBeTruthy();
  expect(errors).toEqual([]);
});
