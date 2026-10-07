// Pause hold: game paused → music, ambience and game sounds fade out and halt, UI sounds stay;
// on resume the music continues where it stopped (with a mock of the AudioContext).
import { describe, it, expect } from 'vitest';
import { shouldHold, holdGain, holdPosition, HOLD_FADE, HELD_BUSES } from '../../src/audio/hold.js';
import { AudioEngine } from '../../src/audio/AudioEngine.js';
import { FileTrack } from '../../src/audio/music.js';
import { parseManifest } from '../../src/audio/manifest.js';

/** AudioParam mock that records its automation */
function param(v = 1) {
  const p = {
    value: v, ramps: [],
    setValueAtTime(x) { p.value = x; }, cancelScheduledValues() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, setValueCurveAtTime() {}, cancelAndHoldAtTime() {},
    linearRampToValueAtTime(x, t) { p.ramps.push({ x, t }); p.target = x; },
  };
  return p;
}
/** Any other node (oscillators, filters …): methods are no-ops, parameters are mocks */
function anyNode() {
  const n = { connect(x) { return x; }, disconnect() {}, start() {}, stop() {} };
  return new Proxy(n, { get: (o, k) => (k in o ? o[k] : (o[k] = typeof k === 'string' && /^(set|get)/.test(k) ? () => {} : param())) });
}
function fakeCtx() {
  const base = {
    currentTime: 100, state: 'running', sampleRate: 44100, sources: [],
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource() {
      const s = { loop: false, playbackRate: param(), connect(n) { return n; }, start(at, off = 0) { s.at = at; s.offset = off; }, stop(at) { s.stoppedAt = at; } };
      ctx.sources.push(s);
      return s;
    },
  };
  const ctx = new Proxy(base, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && k.startsWith('create') ? () => anyNode() : undefined) });
  return ctx;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Pause hold: state logic', () => {
  it('holds while paused, but not after the game ended or was stopped', () => {
    expect(shouldHold({ paused: true })).toBe(true);
    expect(shouldHold({ paused: false })).toBe(false);
    expect(shouldHold({ paused: true, ended: true })).toBe(false);
    expect(shouldHold({ paused: true, stopped: true })).toBe(false);
    expect(holdGain(true)).toBe(0);
    expect(holdGain(false)).toBe(1);
    expect(HELD_BUSES).not.toContain('ui');
  });

  it('position in the file: running piece, pause between pieces, finished piece, loop', () => {
    expect(holdPosition(100, 130, 200)).toEqual({ offset: 30, gap: 0 });
    expect(holdPosition(150, 130, 200)).toEqual({ offset: 0, gap: 20 });
    expect(holdPosition(100, 400, 200)).toBeNull();
    expect(holdPosition(100, 350, 200, true)).toEqual({ offset: 50, gap: 0 });
  });
});

describe('Pause hold: AudioEngine', () => {
  function engine() {
    const eng = new AudioEngine();
    eng.ctx = /** @type {any} */ (fakeCtx());
    for (const k of HELD_BUSES) eng.holds[k] = eng.ctx.createGain();
    eng.buses = { music: eng.ctx.createGain(), sfx: eng.ctx.createGain(), ambient: eng.ctx.createGain(), ui: eng.ctx.createGain() };
    return eng;
  }

  it('fades the held buses to 0 over HOLD_FADE and back to 1', () => {
    const eng = engine();
    eng.setHold(true);
    expect(eng.held).toBe(true);
    expect(eng.music.held).toBe(true);
    for (const k of HELD_BUSES) expect(eng.holds[k].gain.ramps.at(-1)).toEqual({ x: 0, t: 100 + HOLD_FADE });
    eng.ctx.currentTime = 160;
    eng.setHold(false);
    expect(eng.music.held).toBe(false);
    for (const k of HELD_BUSES) expect(eng.holds[k].gain.ramps.at(-1)).toEqual({ x: 1, t: 160 + HOLD_FADE });
    // repeated calls (every frame) change nothing
    eng.setHold(false);
    expect(eng.holds.music.gain.ramps.length).toBe(2);
  });

  it('while held only UI sounds play', () => {
    const eng = engine();
    // effects as files (no synthesis in the mock)
    eng.manifest = parseManifest({ sfx: { clash: ['sfx/clash.ogg'], click: ['sfx/click.ogg'] } });
    for (const e of Object.values(eng.manifest.sfx)) for (const f of e.files) eng.sfxFiles.set(f, /** @type {any} */ ({ duration: 0.3 }));
    eng.setHold(true);
    expect(eng.play('clash')).toBe(false);
    expect(eng.play('click')).toBe(true);
    eng.setHold(false);
    expect(eng.play('clash')).toBe(true);
  });

  it('theme changes while held wait for the resume', () => {
    const eng = engine();
    let started = 0;
    eng.music.startWanted = () => { started++; };
    eng.setHold(true);
    eng.music.setTheme('battle');
    expect(started).toBe(0);
    expect(eng.music.want).toBe('battle');
    eng.setHold(false);
    expect(started).toBe(1);
  });

  it('without AudioContext the hold is remembered for later', () => {
    const eng = new AudioEngine();
    eng.setHold(true);
    expect(eng.held).toBe(true);
    expect(eng.music.held).toBe(true);
  });
});

describe('Pause hold: music file continues where it stopped', () => {
  function fakeMusic() {
    const ctx = fakeCtx();
    const eng = { ctx, buses: { music: {} }, loadBuffer: async (f) => ({ name: f, duration: 200 }) };
    return { eng, rnd: () => 0.5, pauseGap: () => 90 };
  }

  it('running piece: stops at the hold, restarts at the same offset', () => {
    const m = fakeMusic();
    const t = new FileTrack(m, 'build', { files: ['a', 'b'], gain: 1 }, { name: 'a', duration: 200 }, 'a');
    const first = m.eng.ctx.sources[0];
    m.eng.ctx.currentTime = 130;
    t.hold(130.3);
    expect(first.stoppedAt).toBe(130.3);
    first.onended(); // ended by the hold: no next piece
    m.eng.ctx.currentTime = 500;
    t.release(500);
    const again = m.eng.ctx.sources[1];
    expect(m.eng.ctx.sources.length).toBe(2);
    expect(again.buffer.name).toBe('a');
    expect(again.offset).toBeCloseTo(130.3 - 100.05, 5);
    expect(again.at).toBeCloseTo(500.02, 5);
    t.stop();
  });

  it('during the pause between pieces the rest of the pause is kept', async () => {
    const m = fakeMusic();
    const t = new FileTrack(m, 'build', { files: ['a', 'b'], gain: 1 }, { name: 'a', duration: 200 }, 'a');
    m.eng.ctx.currentTime = 250;
    m.eng.ctx.sources[0].onended();
    await flush();
    const next = m.eng.ctx.sources[1];
    expect(next.at).toBe(340);
    t.hold(260);
    expect(next.stoppedAt).toBe(260);
    t.release(1000);
    expect(m.eng.ctx.sources[2].at).toBeCloseTo(1000.02 + 80, 5);
    expect(m.eng.ctx.sources[2].offset).toBe(0);
    t.stop();
  });
});
