// Music: pauses between peace pieces, winter theme, soft switching (with a mock of the AudioContext).
import { describe, it, expect } from 'vitest';
import { resolveTheme, pauseSeconds, FileTrack, PEACE_THEMES, MUSIC_THEMES } from '../../src/audio/music.js';
import { musicTheme } from '../../src/audio/GameAudio.js';
import { parseManifest } from '../../src/audio/manifest.js';
import { normalizeSettings, applySettingsDetail, AUDIO_DEFAULTS, MUSIC_PAUSES } from '../../src/audio/settings.js';

const param = () => ({ value: 1, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
function fakeCtx() {
  const ctx = {
    currentTime: 100, sources: [],
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource() {
      const s = { loop: false, connect(n) { return n; }, start(at) { s.at = at; }, stop() { s.stopped = true; } };
      ctx.sources.push(s);
      return s;
    },
  };
  return ctx;
}
function fakeMusic(gap = 90) {
  const ctx = fakeCtx();
  const eng = { ctx, buses: { music: {} }, loadBuffer: async (f) => ({ name: f }) };
  return { eng, rnd: () => 0.5, pauseGap: () => gap };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Music themes', () => {
  const withWinter = parseManifest({ music: { build: ['music/a.mp3'], winter: ['music/w.mp3'] } });
  const without = parseManifest({ music: { build: ['music/a.mp3'] } });

  it('winter only with its own files, otherwise build', () => {
    expect(resolveTheme(withWinter, 'winter')).toBe('winter');
    expect(resolveTheme(without, 'winter')).toBe('build');
    expect(resolveTheme(without, 'battle')).toBe('battle');
  });

  it('theme from combat mode and weather', () => {
    expect(musicTheme('build', 'winter')).toBe('winter');
    expect(musicTheme('build', 'rain')).toBe('build');
    expect(musicTheme('battle', 'winter')).toBe('battle');
    expect(MUSIC_THEMES).toContain('winter');
    expect([...PEACE_THEMES]).toEqual(['build', 'winter']);
  });
});

describe('Pauses between pieces', () => {
  it('pause length per setting, unknown = normal', () => {
    expect(pauseSeconds('normal', 0)).toBe(MUSIC_PAUSES.normal[0]);
    expect(pauseSeconds('long', 1)).toBe(MUSIC_PAUSES.long[1]);
    expect(pauseSeconds('nonsense', 0)).toBe(MUSIC_PAUSES.normal[0]);
    expect(pauseSeconds('off', 1)).toBeLessThan(5);
  });

  it('setting is validated and applied via events', () => {
    expect(AUDIO_DEFAULTS.musicPause).toBe('normal');
    expect(normalizeSettings({ musicPause: 'long' }).musicPause).toBe('long');
    expect(normalizeSettings({ musicPause: 'forever' }).musicPause).toBe('normal');
    expect(applySettingsDetail(AUDIO_DEFAULTS, { key: 'musicPause', value: 'short' }).musicPause).toBe('short');
    expect(applySettingsDetail(AUDIO_DEFAULTS, { musicPause: 'off' }).musicPause).toBe('off');
    expect(AUDIO_DEFAULTS.barks).toBe('rare');
    expect(normalizeSettings({ barks: 'often' }).barks).toBe('often');
    expect(normalizeSettings({ barks: 'loud' }).barks).toBe('rare');
    expect(applySettingsDetail(AUDIO_DEFAULTS, { key: 'barks', value: 'off' }).barks).toBe('off');
  });

  it('peace piece does not loop and the next one comes only after the pause', async () => {
    const m = fakeMusic(90);
    const entry = { files: ['a', 'b'], gain: 1 };
    const t = new FileTrack(m, 'build', entry, { name: 'a' }, 'a');
    const first = m.eng.ctx.sources[0];
    expect(first.loop).toBe(false);
    m.eng.ctx.currentTime = 250;
    first.onended();
    await flush();
    const next = m.eng.ctx.sources[1];
    expect(next.buffer.name).toBe('b');
    expect(next.at).toBe(340);
    t.stop();
  });

  it('battle music: a single file loops, several follow without a long pause', async () => {
    const m = fakeMusic(90);
    new FileTrack(m, 'battle', { files: ['x'], gain: 1 }, { name: 'x' }, 'x');
    expect(m.eng.ctx.sources[0].loop).toBe(true);
    const m2 = fakeMusic(90);
    new FileTrack(m2, 'battle', { files: ['x', 'y'], gain: 1 }, { name: 'x' }, 'x');
    m2.eng.ctx.sources[0].onended();
    await flush();
    expect(m2.eng.ctx.sources[1].at).toBeLessThan(m2.eng.ctx.currentTime + 2);
  });

  it('switching to winter during the pause replaces the planned piece at the same time', async () => {
    const m = fakeMusic(60);
    const t = new FileTrack(m, 'build', { files: ['a', 'b'], gain: 1 }, { name: 'a' }, 'a');
    m.eng.ctx.sources[0].onended();
    await flush();
    const planned = m.eng.ctx.sources[1];
    t.retarget('winter', { files: ['w'], gain: 0.9 });
    await flush();
    expect(planned.stopped).toBe(true);
    const w = m.eng.ctx.sources[2];
    expect(w.buffer.name).toBe('w');
    expect(w.at).toBe(planned.at);
    expect(t.theme).toBe('winter');
  });

  it('switching while a piece is playing: it plays to the end, then winter', async () => {
    const m = fakeMusic(60);
    const t = new FileTrack(m, 'build', { files: ['a', 'b'], gain: 1 }, { name: 'a' }, 'a');
    const playing = m.eng.ctx.sources[0];
    m.eng.ctx.currentTime = 120; // piece already playing
    t.retarget('winter', { files: ['w'], gain: 1 });
    expect(playing.stopped).toBeUndefined();
    playing.onended();
    await flush();
    expect(m.eng.ctx.sources[1].buffer.name).toBe('w');
  });
});
