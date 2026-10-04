import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

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
  await page.getByTestId('quick-hq').click();
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
});
