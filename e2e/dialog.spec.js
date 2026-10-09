import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
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
        this.unlocked = true;
        this.paused = false;
        // the silent clip that unlocks the player is no line
        if (!this.src.startsWith('data:')) window.__voiceLog.push({ ev: 'play', src: this.src, t: performance.now() });
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
  // Nelia selected, the figure tapped (as a right click / tap on it would do): she walks there and talks
  await page.evaluate(() => {
    const k = window.__kronland, st = k.sim.mission.state;
    const n = k.sim.entities.get(st.npcs.stranger.entity);
    k.selectHero(st.refs.nelia);
    k.issue({ type: 'order', units: [st.refs.nelia], order: 'talk', target: n.id });
  });
  const objective = (id) => page.evaluate((i) => window.__kronland.sim.mission.state.objectives.find((o) => o.id === i).status, id);
  await expect.poll(() => objective('meet'), { timeout: 60_000 }).toBe('done');
  // His conversation (several lines) can be skipped with one button, once it runs
  await page.waitForFunction(() => window.__kronland.sim.mission.state.messages.some((m) => m.text.de.startsWith('Endlich ein Gesicht')), null, { timeout: 60_000 });
  // When the line changes the old dialogue still fades out - take only the active one
  const skip = page.locator('[data-testid=dialog]:not(.dlg-leave-active) [data-testid=dialog-skip-all]');
  await expect(skip).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: info.outputPath('orrin-talk.png') });
  // Skip while a line is being spoken (each lasts 4 s, between two lines nothing plays that could be cut off).
  // Check and click in one step in the page: under load a line may end between a separate check and the click.
  await page.waitForFunction(() => window.__voiceLog.at(-1)?.ev === 'play', null, { timeout: 30_000 });
  const before = await page.evaluate(() => {
    const log = window.__voiceLog, playing = log.at(-1).ev === 'play', n = log.length;
    document.querySelector('[data-testid=dialog]:not(.dlg-leave-active) [data-testid=dialog-skip-all]').click();
    return { playing, n };
  });
  await expect(page.getByTestId('dialog')).toHaveCount(0, { timeout: 5000 });
  // the spoken line is cut off, no further line starts afterwards
  await page.waitForTimeout(1000);
  const after = await page.evaluate(() => window.__voiceLog.map((x) => x.ev));
  expect(after.slice(before.n)).toEqual(before.playing ? ['pause'] : []);
  // The rest of the conversation is left out, Orrin joins as a hero right away
  await expect(page.getByRole('toolbar', { name: 'Helden' }).getByRole('button')).toHaveCount(2, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__kronland.sim.mission.state.messages.filter((m) => m.skipped).length)).toBeGreaterThan(0);
  // Next objective: the old tree (on mobile the objective list is behind the "Ziele" button)
  if (info.project.name === 'mobile') await page.getByTestId('objectives-toggle').click();
  await expect(page.getByTestId('objective-root')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Mission 1 by direct link: every line up to the first objectives is shown and voiced, the first after the first tap', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Strictest autoplay rule (iOS Safari): an element may play only once it has started inside a tap – a new element
  // for a later line would be refused again (NotAllowedError)
  await page.addInitScript((ms) => {
    window.__gesture = false;
    for (const ev of ['pointerdown', 'keydown', 'touchend']) {
      window.addEventListener(ev, () => { window.__gesture = true; setTimeout(() => { window.__gesture = false; }, 0); }, { capture: true });
    }
    class GatedAudio extends EventTarget {
      constructor(src) { super(); this.src = src; this.paused = true; this.volume = 1; this.unlocked = false; }
      play() {
        if (!this.unlocked && !window.__gesture) {
          window.__voiceLog.push({ ev: 'blocked', src: this.src, t: performance.now() });
          return Promise.reject(new DOMException('play() needs a user gesture', 'NotAllowedError'));
        }
        this.unlocked = true;
        this.paused = false;
        // the silent clip that unlocks the player is no line
        if (!this.src.startsWith('data:')) window.__voiceLog.push({ ev: 'play', src: this.src, t: performance.now() });
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
    window.Audio = GatedAudio;
  }, 2500);
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  // The first line is shown at once, its recording is held back by the browser
  await expect(page.locator('[data-testid=dialog]:not(.dlg-leave-active) [data-testid=dialog-text]')).toContainText('Lindgrund. Kein Rauch', { timeout: 60_000 });
  await page.waitForFunction(() => window.__voiceLog.some((x) => x.ev === 'blocked'), null, { timeout: 30_000 });
  const blocked = await page.evaluate(() => window.__voiceLog.find((x) => x.ev === 'blocked').src);
  expect(await page.evaluate(() => window.__voiceLog.some((x) => x.ev === 'play'))).toBe(false);
  // First tap (resource bar, not into the picture): the held line plays now
  await page.getByRole('group', { name: 'Rohstoffe' }).click();
  await page.waitForFunction((src) => window.__voiceLog.some((x) => x.ev === 'play' && x.src === src), blocked, { timeout: 10_000 });
  await page.evaluate(() => { window.__kronland.dialogFocus = () => {}; }); // dialogue camera silent from here on
  // Nelia goes to the stranger (tap on him with her selected); the conversation follows the arrival lines
  await page.evaluate(() => {
    const k = window.__kronland, st = k.sim.mission.state;
    const n = k.sim.entities.get(st.npcs.stranger.entity), nelia = k.sim.entities.get(st.refs.nelia);
    nelia.px = n.px + 2000; nelia.py = n.py; nelia.path = [];
    k.selectHero(st.refs.nelia);
    k.issue({ type: 'order', units: [st.refs.nelia], order: 'talk', target: n.id });
  });
  // Up to the next objective (the old tree): every line of the mission gets its recording, in order
  const lines = 7;
  await page.waitForFunction((n) => window.__voiceLog.filter((x) => x.ev === 'play').length >= n, lines, { timeout: 200_000 });
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.state.objectives.find((o) => o.id === 'root').status), { timeout: 30_000 }).toBe('active');
  const messages = await page.evaluate(() => window.__kronland.sim.mission.state.messages.map((m) => ({ speaker: m.speaker, de: m.text.de })));
  const { files } = JSON.parse(readFileSync(new URL('../public/audio/voice/index.json', import.meta.url), 'utf8'));
  expect(messages.slice(0, lines).map((m) => m.speaker)).toEqual(['nelia', 'orrin', 'orrin', 'nelia', 'orrin', 'nelia', 'orrin']);
  const plays = await page.evaluate(() => window.__voiceLog.filter((x) => x.ev === 'play').map((x) => x.src));
  messages.slice(0, lines).forEach((m, i) => {
    const file = files[`${m.speaker}|de|${m.de}`];
    expect(file, m.de).toBeTruthy();
    // the built game may add a content hash to the file name
    expect(plays[i], m.de).toContain(file.replace(/\.mp3$/, ''));
  });
  // nothing talked over another line
  expect(await page.evaluate(() => window.__voiceLog.filter((x) => x.ev === 'pause'))).toEqual([]);
  await page.screenshot({ path: info.outputPath('c1-voiced.png') });
  expect(errors).toEqual([]);
});
