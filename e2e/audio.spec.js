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

  // Simulation events (weather, payday, errors) and combat near the camera
  await page.evaluate(() => {
    const e = window.__kronland, l = window.__kronlandAudio.listener;
    e.audio.onEvents([{ type: 'payday', player: 0 }, { type: 'rejected', player: 0, reason: 'x' }, { type: 'weather', state: 'winter' }], e.prev);
    for (let i = 0; i < 40; i++) e.audio.battle.add({ x: l.x, z: l.z }, 1);
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
  await page.route('**/audio/manifest.json', (r) => r.fulfill({
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
  page.on('request', (r) => { const m = r.url().match(/audio\/voice\/(de|en)\/([a-zA-Z]+)-[0-9a-f]{8}\.mp3/); if (m) voice.push(m[2]); });
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
