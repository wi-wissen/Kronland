import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { quick } from './quick.js';

// Sound system: unlock on first click, menu and game music, ambience, settings, UI sounds.
// The test cannot listen; it checks state and that nothing throws (sound analysis: scripts/audio-check.py).

test('Sound unlocks on first click, menu music and settings', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl());
  await page.waitForFunction(() => !!window.__kronlandAudio);
  // No AudioContext before a user gesture (autoplay rules)
  expect(await page.evaluate(() => window.__kronlandAudio.ctx)).toBeNull();
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => window.__kronlandAudio.ctx?.state === 'running');
  // the music starts right after the click, outside of the input event (AudioEngine.unlock → afterGesture)
  await page.waitForFunction(() => !!window.__kronlandAudio.music.track);
  const music = await page.evaluate(() => ({ want: window.__kronlandAudio.music.want, track: window.__kronlandAudio.music.track?.theme }));
  expect(music).toEqual({ want: 'menu', track: 'menu' });

  // Settings UI (another part of the program) writes the storage and signals via event
  await page.evaluate(() => {
    localStorage.setItem('kronland-audio', JSON.stringify({ master: 0.5, music: 0.25, sfx: 0.8, muted: false }));
    window.dispatchEvent(new CustomEvent('kronland-settings'));
  });
  expect(await page.evaluate(() => window.__kronlandAudio.getVolume('music'))).toBe(0.25);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('kronland-settings', { detail: { key: 'audio.muted', value: true } })));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-audio')).muted)).toBe(true);
  expect(await page.evaluate(() => window.__kronlandAudio.play('click'))).toBe(false);
  await page.evaluate(() => window.__kronlandAudio.setMuted(false));
  expect(errors).toEqual([]);
});

test('In game: build music, ambience, spatial sounds, events', async ({ page }) => {
  // Software rendering under load: generous total time instead of aborting mid-run
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await quick(page, 'hq');
  await page.waitForFunction(() => window.__kronlandAudio.ctx?.state === 'running' && window.__kronlandAudio.ambient.active);
  const st = await page.evaluate(() => {
    const a = window.__kronlandAudio, l = a.listener;
    return {
      theme: a.music.track?.theme,
      listener: !!l,
      near: a.play('clash', { x: l.x + 1, z: l.z }),
      far: a.play('clash', { x: l.x + 400, z: l.z + 400 }),
      ui: a.play('confirm'),
    };
  });
  expect(st).toEqual({ theme: 'build', listener: true, near: true, far: false, ui: true });

  // Calm: work beat from the rendering, wind only quiet and with a reason, birds rare
  const calm = await page.evaluate(() => {
    const e = window.__kronland, a = window.__kronlandAudio;
    const serf = [...e.sim.entities.values()].find((u) => u.kind === 'unit' && u.owner === e.player);
    const b = serf && e.renderer.chars.beat(serf.id);
    return { beat: !!b && b.period > 0 && typeof b.anim === 'string', wind: a.ambient.layers.wind?.level, birds: a.ambient.birdCount ?? 0 };
  });
  expect(calm.beat).toBe(true);
  expect(calm.wind).toBeLessThanOrEqual(0.3);
  expect(calm.birds).toBeLessThanOrEqual(1);

  // Simulation events (weather, payday, errors) and combat near the camera
  await page.evaluate(() => {
    const e = window.__kronland, l = window.__kronlandAudio.listener;
    e.audio.onEvents([{ type: 'payday', player: 0 }, { type: 'rejected', player: 0, reason: 'x' }, { type: 'weather', state: 'winter' }], e.prev);
    for (let i = 0; i < 40; i++) e.audio.battle.add({ x: l.x, z: l.z }, 1);
    e.audio.battle.combat(performance.now() / 1000); // the player takes part in the fight
  });
  await page.waitForFunction(() => window.__kronlandAudio.music.want === 'battle');
  expect(await page.evaluate(() => window.__kronlandAudio.ambient.weather)).toBe('winter');

  // Game keeps running for a few seconds with sound, without errors
  await page.evaluate(() => window.__kronland.setSpeed(4));
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

/** Small WAV file (sine) as a stand-in for a Stable Audio file. */
function sineWav(seconds = 0.5, freq = 440, rate = 22050) {
  const n = Math.floor(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000 * Math.min(1, (n - i) / 500)), 44 + i * 2);
  return buf;
}

test.describe('Audio files', () => {
  // The PWA service worker may take over the page mid-test; page.route does not see its fetches
  test.use({ serviceWorkers: 'block' });

test('Files from the manifest replace synthetic sounds and music', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Manifest in the build with content hash (audio/manifest.<hash>.json)
  await page.route(/\/audio\/manifest(\.[0-9a-f]{10})?\.json$/, (r) => r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ version: 1, sfx: { coin: ['sfx/coin.wav', 'sfx/missing.wav'] }, music: { menu: { files: ['music/menu.wav'], gain: 0.5 } } }),
  }));
  await page.route('**/audio/sfx/coin.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: sineWav(0.3, 880) }));
  await page.route('**/audio/music/menu.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: sineWav(2, 220) }));
  await page.route('**/audio/sfx/missing.wav', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(playUrl());
  await page.waitForFunction(() => !!window.__kronlandAudio);
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => window.__kronlandAudio.manifest.sfx.coin && window.__kronlandAudio.sfxFiles.size === 1);
  await page.waitForFunction(() => window.__kronlandAudio.music.track?.kind === 'file');
  const r = await page.evaluate(() => {
    const a = window.__kronlandAudio;
    const played = [];
    for (let i = 0; i < 4; i++) { a.voices.reset(); played.push(a.play('coin')); }
    return { played, files: [...a.sfxFiles.keys()], chop: a.play('chop') };
  });
  // Missing file: fall back to the synthetic sound, no errors
  expect(r.played).toEqual([true, true, true, true]);
  // Paths relative to the page: the game lives under play/, the audio files in the site root
  expect(r.files).toEqual(['../audio/sfx/coin.wav']);
  expect(errors).toEqual([]);
});

test('Bundled effect recordings (Kenney, CC0) are loaded and decoded', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl());
  await page.waitForFunction(() => !!window.__kronlandAudio);
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => Object.keys(window.__kronlandAudio.manifest.sfx).length > 0);
  const total = await page.evaluate(() => Object.values(window.__kronlandAudio.manifest.sfx).reduce((n, e) => n + e.files.length, 0));
  await page.waitForFunction((n) => window.__kronlandAudio.sfxFiles.size === n, total, { timeout: 60_000 });
  const r = await page.evaluate(() => {
    const a = window.__kronlandAudio, out = {};
    for (const name of Object.keys(a.manifest.sfx)) { a.voices.reset(); out[name] = a.play(name) && a.lastFile.has(name); }
    return out;
  });
  expect(Object.values(r).every(Boolean), JSON.stringify(r)).toBe(true);
  expect(errors).toEqual([]);
});
});

test('Voices: mission dialogue with recording, serf bark on selecting', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [], voice = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { const m = r.url().match(/audio\/voice\/(de|en)\/([a-zA-Z]+)-[0-9a-f]{8}(\.[0-9a-f]{10})?\.mp3/); if (m) voice.push(m[2]); });
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1');
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => window.__kronlandAudio.ctx?.state === 'running');
  // A mission dialogue is running (Orrin or Nelia): its recording is loaded
  await expect.poll(() => voice.some((v) => v === 'orrin' || v === 'nelia'), { timeout: 30_000 }).toBe(true);
  // Mission 1 starts without serfs: add three for the test (as after the find at the old tree)
  await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__kronland.sim.spawnSerf(0); });
  // Barks to "Often" (default "Rarely" mostly stays silent)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('kronland-settings', { detail: { key: 'barks', value: 'often' } })));
  expect(await page.evaluate(() => window.__kronlandAudio.settings.barks)).toBe('often');
  // Select serfs as soon as no dialogue is speaking any more (barks stay silent meanwhile): a bark is loaded
  await expect.poll(async () => {
    await page.evaluate(() => { const e = window.__kronland; e.clearSelection(); if (e.audio.barks) e.audio.barks.busyUntil = -Infinity; e.selectAllSerfs(); });
    return voice.some((v) => v === 'serf' || v === 'serfF');
  }, { timeout: 60_000, intervals: [1000] }).toBe(true);
  expect(errors).toEqual([]);
});

test('Bundled music: build as file, winter, music pauses setting', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl());
  await page.waitForFunction(() => !!window.__kronlandAudio);
  // Setting in the start menu: pauses between music tracks
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('music-pause-long').click();
  await page.getByTestId('barks-off').click();
  expect(await page.evaluate(() => window.__kronlandAudio.settings.barks)).toBe('off');
  await page.getByTestId('barks-rare').click();
  await expect(page.getByTestId('music-pause-long')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('music-pause-long').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('settings-music-pauses.png') });
  expect(await page.evaluate(() => window.__kronlandAudio.settings.musicPause)).toBe('long');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-audio')).musicPause)).toBe('long');
  await page.getByTestId('settings-done').click();

  // In game: build music from files, on winter a soft switch to the winter theme
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await quick(page, 'hq');
  await page.waitForFunction(() => window.__kronlandAudio.music.track?.kind === 'file', null, { timeout: 90_000 });
  const m = await page.evaluate(() => {
    const a = window.__kronlandAudio;
    return { theme: a.music.track.theme, loop: a.music.track.src.loop, build: a.manifest.music.build.files.length, winter: a.manifest.music.winter.files.length, pause: a.music.pauseGap() };
  });
  expect(m).toMatchObject({ theme: 'build', loop: false, build: 5, winter: 2 });
  expect(m.pause).toBeGreaterThanOrEqual(150);
  await page.evaluate(() => { const e = window.__kronland; e.audio.onEvents([{ type: 'weather', state: 'winter' }], e.prev); });
  await page.waitForFunction(() => window.__kronlandAudio.music.want === 'winter' && window.__kronlandAudio.music.track?.theme === 'winter');
  expect(await page.evaluate(() => window.__kronlandAudio.music.track.kind)).toBe('file');
  expect(errors).toEqual([]);
});

test('Combat: alarm call "Eure Truppen sind im Kampf!" is spoken, then the combat music ends', async ({ page }, info) => {
  test.setTimeout(150_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto(playUrl('?seed=42&no-models&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.audio);
  await quick(page, 'hq');
  await page.waitForFunction(() => window.__kronlandAudio.ctx?.state === 'running');
  // Own sword squad and a (tough) enemy one side by side on open ground, camera on them
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, m = s.map, hq = s.findBuilding(0, 'headquarters');
    let f = null;
    for (let r = 4; r < 30 && !f; r++) for (let dx = -r; dx <= r && !f; dx++) {
      const x = hq.x + dx, y = hq.y + hq.h + r;
      let ok = true;
      for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 8 && ok; i++) if (!m.walkable(x + i, y + j)) ok = false;
      if (ok) f = { x, y };
    }
    s.spawnLeader(0, 'sword4', f.x, f.y);
    const C = s.spawnLeader(1, 'sword4', f.x + 3, f.y);
    for (const id of C.soldiers) s.entities.get(id).hp *= 20;
    C.hp *= 20;
    window.__foe = [C.id, ...C.soldiers];
    e.clearSelection();
    const rig = e.renderer.rig;
    rig.lookAt(f.x + 1.5, f.y); rig.dist = 18; rig.update(0);
  });
  // Notice appears and the alarm call (recording) is played
  await expect(page.getByTestId('toasts')).toContainText('Eure Truppen sind im Kampf!', { timeout: 30_000 });
  await page.waitForFunction(() => window.__kronland.audio.announced.some((a) => (a.kind === 'leader' || a.kind === 'soldier') && a.played), null, { timeout: 30_000 });
  const said = await page.evaluate(() => window.__kronland.audio.announced.find((a) => a.played));
  expect(said.url).toMatch(/audio\/voice\/de\//);
  await page.waitForFunction(() => window.__kronlandAudio.music.want === 'battle', null, { timeout: 30_000 });
  await page.screenshot({ path: info.outputPath(`combat-${info.project.name}.png`) });

  // Combat over (enemy gone): back to build music after the grace period (+ minimum duration) at the latest
  const grace = await page.evaluate(() => {
    const e = window.__kronland;
    for (const id of window.__foe) e.sim.entities.delete(id);
    return e.audio.battle.grace;
  });
  await page.waitForFunction(() => window.__kronlandAudio.music.want === 'build', null, { timeout: 40_000 });
  const r = await page.evaluate(() => {
    const e = window.__kronland, b = e.audio.battle;
    return { quiet: performance.now() / 1000 - b.lastCombat, held: performance.now() / 1000 - b.since, track: window.__kronlandAudio.music.track?.theme };
  });
  // Under software graphics frames stutter: some leeway above the grace period
  expect(r.quiet).toBeGreaterThanOrEqual(grace - 0.5);
  expect(r.quiet).toBeLessThan(grace + 4);
  expect(r.track).toBe('build');
  expect(errors).toEqual([]);
});

test('Showcase: many workers moving in do not ring constantly (notice sounds throttled)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?mission=showcase&no-models'));
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 180_000 });
  await page.mouse.click(5, 5);
  await page.waitForFunction(() => window.__kronlandAudio.ctx?.state === 'running');
  // Count simulation arrivals; the engine counts played sounds itself (AudioEngine.played)
  await page.evaluate(() => {
    const e = window.__kronland, ga = e.audio, a = window.__kronlandAudio, orig = ga.onEvents.bind(ga);
    window.__arrived = 0;
    window.__played0 = a.played.workerArrived ?? 0;
    window.__t0 = a.ctx.currentTime;
    ga.onEvents = (evs, prev) => { window.__arrived += evs.filter((v) => v.type === 'workerArrived' && v.player === e.player).length; return orig(evs, prev); };
    e.setSpeed(8);
  });
  await page.waitForTimeout(15_000);
  // Burst like on the showcase: 40 arrivals in 4 s (fed in by hand, independent of the compute speed)
  await page.evaluate(async () => {
    const e = window.__kronland;
    for (let i = 0; i < 40; i++) {
      e.audio.onEvents([{ type: 'workerArrived', player: e.player, worker: 0, prof: 'farmer', workplace: 0 }], e.prev);
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  const st = await page.evaluate(() => {
    const a = window.__kronlandAudio;
    return { arrived: window.__arrived, played: (a.played.workerArrived ?? 0) - window.__played0, secs: a.ctx.currentTime - window.__t0 };
  });
  console.log('Showcase arrival:', JSON.stringify(st));
  // at most one sound per quiet period (8 s), no matter how many workers move in
  expect(st.played).toBeGreaterThanOrEqual(1);
  expect(st.played).toBeLessThanOrEqual(Math.ceil(st.secs / 8) + 1);
  expect(errors).toEqual([]);
});
