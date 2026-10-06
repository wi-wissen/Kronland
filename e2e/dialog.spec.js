import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Mission dialogues: the next speaker waits until the recording has ended; the dialogue camera moves close to the
// speaking figure; objectives with a location are marked and can be jumped to in the objectives panel.
// Playback is simulated in the test (every recording "lasts" 4 s) so the times do not depend on the browser.

const VOICE_MS = 4000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((ms) => {
    window.__voiceLog = [];
    // Mouse pointer at the top edge (resource bar): no edge scrolling, it would take over the camera
    localStorage.setItem('kronland-settings', JSON.stringify({ edgeScroll: false }));
    class FakeAudio extends EventTarget {
      constructor(src) { super(); this.src = src; this.paused = true; this.volume = 1; }
      play() {
        this.paused = false;
        window.__voiceLog.push({ ev: 'play', src: this.src, t: performance.now() });
        this.timer = setTimeout(() => { this.paused = true; window.__voiceLog.push({ ev: 'ended', src: this.src, t: performance.now() }); this.dispatchEvent(new Event('ended')); }, ms);
        return Promise.resolve();
      }
      pause() {
        if (this.paused) return;
        clearTimeout(this.timer);
        this.paused = true;
        window.__voiceLog.push({ ev: 'pause', src: this.src, t: performance.now() });
        this.dispatchEvent(new Event('pause'));
      }
    }
    window.Audio = FakeAudio;
  }, VOICE_MS);
});

test('Dialogues: no talking over each other, camera close to the speaker, objective marked and jumpable', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  // Unlock sound with a click on the resource bar (not into the picture: the castle would lie there now)
  await page.getByRole('group', { name: 'Rohstoffe' }).click();

  // While a recording is running, music and ambience step back
  await page.waitForFunction(() => window.__voiceLog.length > 0 && window.__kronlandAudio.ctx?.state === 'running', null, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.__kronlandAudio.ducked), { timeout: 5000 }).toBe(true);

  // The first two voiced lines (Nelia, then Orrin's call) run one after another, each to the end
  await page.waitForFunction(() => window.__voiceLog.filter((x) => x.ev === 'play').length >= 2, null, { timeout: 60_000 });
  const log = await page.evaluate(() => window.__voiceLog);
  const plays = log.filter((x) => x.ev === 'play');
  expect(log.filter((x) => x.ev === 'pause')).toEqual([]);
  for (let i = 1; i < 2; i++) {
    const end = log.find((x) => x.ev === 'ended' && x.src === plays[i - 1].src);
    expect(end, `Line ${i} finished`).toBeTruthy();
    expect(plays[i].t).toBeGreaterThanOrEqual(end.t);
  }

  // Dialogue camera: close up (distance 8 instead of the overview)
  // first the overview (the camera moves back there afterwards)
  expect(await page.evaluate(() => window.__kronland.dialogCam?.dist)).toBeGreaterThan(12);
  await expect.poll(() => page.evaluate(() => window.__kronland.renderer.rig.dist), { timeout: 10_000 }).toBeLessThan(8.5);
  await page.screenshot({ path: info.outputPath('dialog-camera.png') });

  // First objective "to the stranger on the village square": Orrin is marked (ring and arrow) and can be jumped to via the objectives panel
  const hint = await page.evaluate(() => window.__kronland.sim.mission.uiState(window.__kronland.sim).objectives.find((o) => o.id === 'meet').hint.entity);
  expect(hint.x).toBeGreaterThan(0);
  await page.evaluate(() => { window.__kronland.dialogFocus = () => {}; }); // dialogue camera silent from here on
  if (!(await page.getByTestId('objective-go-meet').isVisible())) await page.getByTestId('objectives-toggle').click();
  await page.getByTestId('objective-go-meet').click();
  await expect.poll(() => page.evaluate(() => window.__kronland.renderer.hintMarker?.group.visible)).toBe(true);
  // Next to it lie the foundations of the village centre (landmark)
  expect(await page.evaluate(() => window.__kronland.renderer.landmarks.map((l) => l.mesh.visible))).toEqual([true]);
  const target = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  // On small screens the objective lies above the panel (offset view point), hence some leeway
  expect(Math.hypot(target.x - hint.x, target.z - hint.y)).toBeLessThan(8);
  await page.screenshot({ path: info.outputPath('destination.png') });
  // After the dialogue the music gets louder again
  await expect.poll(() => page.evaluate(() => window.__kronlandAudio.ducked), { timeout: 20_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test('Mission 1: Orrin joins on the village square, the conversation can be skipped', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  await page.getByRole('group', { name: 'Rohstoffe' }).click();
  // Initially only Nelia; Orrin stands as a conversation figure on the village square
  await expect(page.getByRole('toolbar', { name: 'Helden' }).getByRole('button')).toHaveCount(1);
  await page.evaluate(() => {
    const k = window.__kronland, st = k.sim.mission.state;
    const n = k.sim.entities.get(st.npcs.stranger.entity);
    k.selectHero(st.refs.nelia);
    k.issue({ type: 'order', units: [st.refs.nelia], order: 'move', x: Math.floor(n.px / 1000), y: Math.floor(n.py / 1000) });
  });
  await page.waitForFunction(() => window.__kronland.sim.mission.state.flags.orrin, null, { timeout: 60_000 });
  // Orrin is now a hero; his conversation (several lines) can be skipped with one button
  await expect(page.getByRole('toolbar', { name: 'Helden' }).getByRole('button')).toHaveCount(2);
  // When the line changes the old dialogue still fades out - take only the active one
  const skip = page.locator('[data-testid=dialog]:not(.dlg-leave-active) [data-testid=dialog-skip-all]');
  await expect(skip).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: info.outputPath('orrin-talk.png') });
  await skip.click();
  await expect(page.getByTestId('dialog')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => window.__voiceLog.at(-1).ev)).toBe('pause');
  // Next objective: the old tree (on mobile the objective list is behind the "Ziele" button)
  if (info.project.name === 'mobile') await page.getByTestId('objectives-toggle').click();
  await expect(page.getByTestId('objective-root')).toBeVisible();
  expect(errors).toEqual([]);
});
