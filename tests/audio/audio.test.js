import { describe, it, expect } from 'vitest';
import { parseManifest, resolvePath, lookup, pickFile, allFiles, emptyManifest } from '../../src/audio/manifest.js';
import { VoiceLimiter } from '../../src/audio/voices.js';
import { distanceGain, audibleRadius, screenPan, spatialize, zoomGain } from '../../src/audio/spatial.js';
import { composeSection, composeJingle, degreeToMidi, varyMelody, THEMES, barLength, RANGES } from '../../src/audio/composer.js';
import { normalizeSettings, applySettingsDetail, loadAudioSettings, saveAudioSettings, AUDIO_DEFAULTS, AUDIO_SETTINGS_KEY } from '../../src/audio/settings.js';
import { karplusStrong, midiToFreq } from '../../src/audio/karplus.js';
import { BattleMeter } from '../../src/audio/battle.js';
import { ambientTargets } from '../../src/audio/ambient.js';
import { mulberry32 } from '../../src/audio/rng.js';
import { AudioEngine, getAudio } from '../../src/audio/AudioEngine.js';
import { SFX, SFX_NAMES } from '../../src/audio/sfx.js';

describe('Manifest', () => {
  it('resolves paths relative to audio/ and rejects unsafe ones', () => {
    expect(resolvePath('music/build.ogg')).toBe('audio/music/build.ogg');
    expect(resolvePath('./sfx/chop.mp3')).toBe('audio/sfx/chop.mp3');
    expect(resolvePath('audio/sfx/x.wav')).toBe('audio/sfx/x.wav');
    expect(resolvePath('../secret.ogg')).toBeNull();
    expect(resolvePath('/abs.ogg')).toBeNull();
    expect(resolvePath('https://evil.example/x.ogg')).toBeNull();
    expect(resolvePath('music/readme.txt')).toBeNull();
    expect(resolvePath(42)).toBeNull();
  });

  it('accepts string, list and object with gain', () => {
    const m = parseManifest({
      version: 1,
      music: { build: ['music/b1.ogg', 'music/b2.ogg'], battle: 'music/battle.mp3', menu: [] },
      sfx: { chop: { files: ['sfx/c1.ogg', 'bad/../x.ogg'], gain: 0.5 }, 'bad name': 'sfx/x.ogg', coin: { file: 'sfx/coin.ogg', gain: 9 } },
      ambient: { rain: { files: ['ambient/rain.ogg'], loop: true } },
      other: { x: 'y.ogg' },
    });
    expect(m.music.build.files).toEqual(['audio/music/b1.ogg', 'audio/music/b2.ogg']);
    expect(m.music.battle.files).toEqual(['audio/music/battle.mp3']);
    expect(m.music.menu).toBeUndefined();
    expect(m.sfx.chop).toEqual({ files: ['audio/sfx/c1.ogg'], gain: 0.5 });
    expect(m.sfx['bad name']).toBeUndefined();
    expect(m.sfx.coin.gain).toBe(4);
    expect(m.ambient.rain.loop).toBe(true);
    expect(/** @type {any} */ (m).other).toBeUndefined();
    expect(allFiles(m)).toHaveLength(6);
  });

  it('is robust against nonsense', () => {
    expect(parseManifest(null)).toEqual(emptyManifest());
    expect(parseManifest('x')).toEqual(emptyManifest());
    expect(parseManifest({ music: 5, sfx: null })).toEqual(emptyManifest());
  });

  it('finds entries via fallback names and does not directly repeat files', () => {
    const m = parseManifest({ sfx: { clash: ['sfx/a.ogg', 'sfx/b.ogg', 'sfx/c.ogg'] } });
    expect(lookup(m, 'sfx', 'clashHeavy', ['clash']).files).toHaveLength(3);
    expect(lookup(m, 'sfx', 'nope')).toBeNull();
    expect(lookup(m, 'music', 'build')).toBeNull();
    const r = mulberry32(1);
    let last = null;
    for (let i = 0; i < 50; i++) { const f = pickFile(m.sfx.clash, r, last); expect(f).not.toBe(last); last = f; }
    expect(pickFile({ files: ['x'], gain: 1 }, r, 'x')).toBe('x');
  });
});

describe('Voice limiting', () => {
  it('limits simultaneous voices per kind and releases them after expiry', () => {
    const v = new VoiceLimiter();
    expect(v.acquire('clash', 0, 1, { max: 2 })).toBe(true);
    expect(v.acquire('clash', 0, 1, { max: 2 })).toBe(true);
    expect(v.acquire('clash', 0, 1, { max: 2 })).toBe(false);
    expect(v.acquire('chop', 0, 1, { max: 2 })).toBe(true);
    expect(v.active('clash', 0.5)).toBe(2);
    expect(v.acquire('clash', 1.01, 1, { max: 2 })).toBe(true);
  });

  it('respects the cooldown', () => {
    const v = new VoiceLimiter();
    expect(v.acquire('coin', 0, 0.1, { cooldown: 0.5 })).toBe(true);
    expect(v.acquire('coin', 0.3, 0.1, { cooldown: 0.5 })).toBe(false);
    expect(v.acquire('coin', 0.6, 0.1, { cooldown: 0.5 })).toBe(true);
  });

  it('global cap: important sounds displace unimportant ones, not the other way round', () => {
    const v = new VoiceLimiter({ globalMax: 3 });
    for (let i = 0; i < 3; i++) expect(v.acquire(`a${i}`, 0, 5, { priority: 1 })).toBe(true);
    expect(v.acquire('low', 0, 5, { priority: 0 })).toBe(false);
    expect(v.acquire('ui', 0, 5, { priority: 4 })).toBe(true);
    expect(v.active(null, 0)).toBe(3);
    expect(v.acquire('ui2', 0, 5, { priority: 1 })).toBe(false);
  });
});

describe('Spatial mixing', () => {
  const l = { x: 50, z: 50, dist: 28, yaw: 0.7 };
  it('volume falls monotonically with distance and is zero at the edge', () => {
    let prev = Infinity;
    for (let d = 0; d <= 60; d += 2) {
      const g = distanceGain(d, 28);
      expect(g).toBeLessThanOrEqual(prev + 1e-12);
      expect(g).toBeGreaterThanOrEqual(0);
      prev = g;
    }
    expect(distanceGain(0, 28)).toBeCloseTo(zoomGain(28));
    expect(distanceGain(audibleRadius(28), 28)).toBe(0);
  });

  it('zoomed further out: larger audible range, but quieter', () => {
    expect(audibleRadius(70)).toBeGreaterThan(audibleRadius(10));
    expect(zoomGain(70)).toBeLessThan(zoomGain(10));
    expect(distanceGain(30, 70)).toBeGreaterThan(0);
    expect(distanceGain(30, 10)).toBe(0);
  });

  it('panning follows the camera screen right axis', () => {
    // right axis at yaw 0: +x
    expect(screenPan(10, 0, 28, 0)).toBeGreaterThan(0.2);
    expect(screenPan(-10, 0, 28, 0)).toBeLessThan(-0.2);
    expect(Math.abs(screenPan(0, 10, 28, 0))).toBeLessThan(1e-9);
    // at yaw π/2 the right axis points to −z
    expect(screenPan(0, -10, 28, Math.PI / 2)).toBeGreaterThan(0.2);
    expect(Math.abs(screenPan(1000, 0, 28, 0))).toBeLessThanOrEqual(0.85);
  });

  it('spatialize returns null outside the audible range', () => {
    expect(spatialize(50, 50, l)).not.toBeNull();
    expect(spatialize(150, 150, l)).toBeNull();
    const s = spatialize(55, 50, l);
    expect(s.d).toBeCloseTo(5);
  });
});

describe('Music generator', () => {
  it('is deterministic for seed and section', () => {
    for (const th of Object.keys(THEMES)) {
      for (let s = 0; s < 6; s++) {
        expect(composeSection(th, s, 1234)).toEqual(composeSection(th, s, 1234));
      }
    }
  });

  it('varies between seeds and sections', () => {
    const a = JSON.stringify(composeSection('build', 1, 1).events);
    const b = JSON.stringify(composeSection('build', 1, 2).events);
    const c = JSON.stringify(composeSection('build', 2, 1).events);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('composed bars have the right length', () => {
    for (const th of Object.values(THEMES)) {
      for (const mel of Object.values(th.melodies)) {
        expect(mel.bars).toHaveLength(8);
        expect(mel.chords).toHaveLength(8);
        for (const bar of mel.bars) expect(barLength(bar)).toBeCloseTo(th.beatsPerBar);
      }
    }
  });

  it('variation preserves bar lengths and cadences', () => {
    const r = mulberry32(5);
    const bars = THEMES.build.melodies.A.bars;
    for (let i = 0; i < 30; i++) {
      const v = varyMelody(bars, r, 1);
      v.forEach((bar, bi) => expect(barLength(bar)).toBeCloseTo(barLength(bars[bi])));
      expect(v[3]).toEqual(bars[3]);
      expect(v[7]).toEqual(bars[7]);
    }
  });

  it('melody notes stay in key, all notes within instrument range and section length', () => {
    for (const [name, th] of Object.entries(THEMES)) {
      const scale = new Set([0, 1, 2, 3, 4, 5, 6].map((d) => ((degreeToMidi(th.root, th.mode, d) % 12) + 12) % 12));
      for (let s = 0; s < th.form.length; s++) {
        const sec = composeSection(name, s, 99);
        expect(sec.events.length).toBeGreaterThan(10);
        for (const e of sec.events) {
          if (e.inst !== 'drum') expect(scale.has(((e.midi % 12) + 12) % 12)).toBe(true);
          const rg = RANGES[e.inst];
          if (rg) { expect(e.midi).toBeGreaterThanOrEqual(rg[0]); expect(e.midi).toBeLessThanOrEqual(rg[1]); }
          expect(e.beat).toBeGreaterThanOrEqual(-0.2);
          expect(e.beat).toBeLessThan(sec.beats);
          expect(e.vel).toBeGreaterThan(0);
          expect(e.vel).toBeLessThanOrEqual(1);
        }
        const hasLead = sec.events.some((e) => e.inst === th.lead);
        expect(hasLead).toBe(!['intro', 'rest'].includes(sec.part));
      }
    }
  });

  it('battle theme has drums, build theme does not; mobile version has fewer notes', () => {
    expect(composeSection('battle', 1, 3).events.some((e) => e.inst === 'drum')).toBe(true);
    expect(composeSection('build', 1, 3).events.some((e) => e.inst === 'drum')).toBe(false);
    expect(composeSection('build', 0, 3, { lite: true }).events.length).toBeLessThan(composeSection('build', 0, 3).events.length);
  });

  it('jingles', () => {
    for (const j of ['victory', 'defeat']) {
      const r = composeJingle(j);
      expect(r.events.length).toBeGreaterThan(5);
      expect(r.beats).toBeGreaterThan(4);
    }
    expect(() => composeSection('nope', 0, 1)).toThrow();
  });

  it('degrees → MIDI', () => {
    expect(degreeToMidi(62, 'dorian', 0)).toBe(62);
    expect(degreeToMidi(62, 'dorian', 2)).toBe(65);
    expect(degreeToMidi(62, 'dorian', 7)).toBe(74);
    expect(degreeToMidi(62, 'dorian', -1)).toBe(60);
    expect(midiToFreq(69)).toBe(440);
  });
});

describe('Karplus-Strong', () => {
  it('produces normalised, decaying samples', () => {
    const { data, rate } = karplusStrong(220, 44100, 1.5, { t60: 1 });
    expect(data.length).toBe(Math.floor(44100 * 1.5));
    let peak = 0;
    for (const v of data) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); }
    expect(peak).toBeLessThanOrEqual(0.9 + 1e-6);
    const rms = (a, b) => Math.sqrt(data.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
    expect(rms(0, 4410)).toBeGreaterThan(rms(44100, 48510) * 10);
    expect(rate).toBeGreaterThan(0.98);
    expect(rate).toBeLessThan(1.02);
  });

  it('is accurately tuned even in high registers (< 3 cents)', () => {
    const sr = 44100;
    for (const m of [40, 64, 84, 93]) {
      const f = midiToFreq(m);
      const { data, rate } = karplusStrong(f, sr, 0.7, { t60: 2.6, brightness: 0.4 });
      const x = data.slice(4410, 22050);
      const lo = Math.floor(sr / (f * 1.1)), hi = Math.ceil(sr / (f * 0.9));
      const ac = [];
      let bl = lo;
      for (let l = lo - 1; l <= hi + 1; l++) {
        let s = 0;
        for (let i = 0; i < x.length - l; i++) s += x[i] * x[i + l];
        ac[l] = s;
        if (l >= lo && l <= hi && s > ac[bl]) bl = l;
      }
      const p = bl + (0.5 * (ac[bl - 1] - ac[bl + 1])) / (ac[bl - 1] - 2 * ac[bl] + ac[bl + 1]);
      const cents = 1200 * Math.log2(((sr / p) * rate) / f);
      expect(Math.abs(cents), `MIDI ${m}`).toBeLessThan(3);
    }
  });
});

describe('Settings', () => {
  it('normalises and clamps values, accepts percent', () => {
    expect(normalizeSettings(null)).toEqual(AUDIO_DEFAULTS);
    expect(AUDIO_DEFAULTS).toMatchObject({ master: 0.8, music: 0.6, sfx: 0.8 });
    const s = normalizeSettings({ master: 2, music: -1, sfx: '0.5', ui: 70, muted: true });
    expect(s).toMatchObject({ master: 0.02, music: 0, sfx: 0.5, ui: 0.7, muted: true });
    expect(normalizeSettings({ mute: true }).muted).toBe(true);
  });

  it('understands different forms of the settings event', () => {
    const cur = { ...AUDIO_DEFAULTS };
    expect(applySettingsDetail(cur, { audio: { music: 0.2 } }).music).toBe(0.2);
    expect(applySettingsDetail(cur, { key: 'audio.sfx', value: 0.3 }).sfx).toBe(0.3);
    expect(applySettingsDetail(cur, { key: 'muted', value: true }).muted).toBe(true);
    expect(applySettingsDetail(cur, { master: 0.1 }).master).toBe(0.1);
    expect(applySettingsDetail(cur, { key: 'quality', value: 'high' })).toBeNull();
    expect(applySettingsDetail(cur, { quality: 'high' })).toBeNull();
  });

  it('saves and loads via a store, even if it throws', () => {
    const mem = new Map();
    const st = { get: (k) => mem.get(k) ?? null, set: (k, v) => { mem.set(k, v); return true; } };
    saveAudioSettings({ ...AUDIO_DEFAULTS, music: 0.25 }, st);
    expect(JSON.parse(mem.get(AUDIO_SETTINGS_KEY)).music).toBe(0.25);
    expect(loadAudioSettings(st).music).toBe(0.25);
    mem.set(AUDIO_SETTINGS_KEY, '{broken');
    expect(loadAudioSettings(st)).toEqual(AUDIO_DEFAULTS);
    expect(loadAudioSettings()).toEqual(AUDIO_DEFAULTS); // Node: no localStorage
  });
});

describe('Battle intensity and ambience', () => {
  it('rises with nearby fights, decays, theme with hysteresis', () => {
    const b = new BattleMeter();
    const l = { x: 50, z: 50, dist: 28, yaw: 0 };
    expect(b.intensity(l)).toBe(0);
    for (let i = 0; i < 30; i++) b.add({ x: 52, z: 50 }, 1);
    expect(b.intensity(l)).toBeGreaterThan(0.5);
    expect(b.intensity({ ...l, x: 200 })).toBe(0);
    expect(b.theme(b.intensity(l), 0)).toBe('battle');
    b.decay(30);
    expect(b.intensity(l)).toBeLessThan(0.12);
    expect(b.theme(b.intensity(l), 5)).toBe('battle');   // minimum duration
    expect(b.theme(b.intensity(l), 20)).toBe('build');
  });

  it('ambient layers per weather', () => {
    expect(ambientTargets('summer')).toMatchObject({ summer: 0.75, rain: 0, winter: 0 });
    expect(ambientTargets('rain').rain).toBeGreaterThan(0);
    expect(ambientTargets('winter', 1).water).toBe(0);
    expect(ambientTargets('summer', 1, 1, 0.5).battle).toBeCloseTo(0.4);
  });
});

describe('Without Web Audio (Node)', () => {
  it('is a silent no-op', () => {
    const a = new AudioEngine();
    expect(a.available).toBe(false);
    a.unlock();
    expect(a.ctx).toBeNull();
    expect(a.play('chop', { x: 1, z: 1 })).toBe(false);
    a.setVolume('music', 0.3);
    expect(a.getVolume('music')).toBe(0.3);
    a.music.setTheme('build');
    a.setAmbient(true);
    expect(getAudio()).toBe(getAudio());
  });

  it('all effects are fully described', () => {
    expect(SFX_NAMES.length).toBeGreaterThanOrEqual(30);
    for (const [name, d] of Object.entries(SFX)) {
      expect(typeof d.play, name).toBe('function');
      expect(d.dur, name).toBeGreaterThan(0);
      expect(d.dur, name).toBeLessThan(5);
    }
  });
});
