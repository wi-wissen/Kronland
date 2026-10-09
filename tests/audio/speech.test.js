// Reading dialogues aloud: a named recording that does not load falls back to the browser's speech output.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { speak, resetSpeech } from '../../src/audio/speech.js';
import { useLevelAssets } from '../../src/levels/assets.js';

class FakeAudio {
  static last = null;
  constructor(src) { this.src = src; this.listeners = {}; this.volume = 1; FakeAudio.last = this; }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
  emit(k) { for (const f of this.listeners[k] ?? []) f(); }
  play() { return Promise.resolve(); }
  pause() {}
}

describe('Speech output as a stand-in', () => {
  let spoken;
  beforeEach(() => {
    spoken = [];
    globalThis.Audio = FakeAudio;
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel() {}, pause() {}, resume() {}, getVoices: () => [] };
    resetSpeech();
  });
  afterEach(() => {
    delete globalThis.Audio;
    delete globalThis.SpeechSynthesisUtterance;
    delete globalThis.speechSynthesis;
    useLevelAssets(null, null);
  });

  it('a recording of the level plays; if it does not load, the browser reads the text', () => {
    const blob = new Blob(['x'], { type: 'audio/mpeg' });
    const s = { id: 'own' };
    globalThis.URL.createObjectURL ??= () => 'blob:x';
    globalThis.URL.revokeObjectURL ??= () => {};
    useLevelAssets({ scenario: s, assets: new Map([['assets/hello.mp3', blob]]) }, s);
    let ended = 0;
    expect(speak({ seq: 1, speaker: 'alchemist', text: { de: 'Hallo', en: 'Hello' }, voice: 'assets/hello.mp3' }, 'de', { onEnd: () => ended++ })).toBe(true);
    expect(FakeAudio.last.src).toMatch(/^blob:/);
    expect(spoken).toEqual([]);
    FakeAudio.last.emit('error');
    expect(spoken.map((u) => u.text)).toEqual(['Hallo']);
    expect(ended).toBe(0);
    spoken[0].onend();
    expect(ended).toBe(1);
  });

  it('a recording the level does not have: speech output right away', () => {
    FakeAudio.last = null;
    expect(speak({ seq: 2, speaker: 'alchemist', text: 'Nur deutsch', voice: 'assets/missing.mp3' }, 'en')).toBe(true);
    expect(FakeAudio.last).toBeNull();
    expect(spoken.map((u) => u.text)).toEqual(['Nur deutsch']);
  });
});

describe('Autoplay rule', () => {
  it('a recording blocked before the first tap plays with the first tap', async () => {
    let plays = 0;
    class Blocked extends FakeAudio { play() { plays++; return plays === 1 ? Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) : Promise.resolve(); } }
    globalThis.Audio = Blocked;
    globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    const spoken = [];
    globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel() {}, pause() {}, getVoices: () => [] };
    const target = new EventTarget();
    globalThis.window ??= target;
    resetSpeech();
    expect(speak({ seq: 10, speaker: null, text: 'Hallo', voice: 'audio/x.mp3' }, 'de')).toBe(true);
    await Promise.resolve(); await Promise.resolve();
    expect(plays).toBe(1);
    expect(spoken).toEqual([]);
    globalThis.window.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(plays).toBe(2);
    delete globalThis.Audio; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
  });
});

describe('Strict autoplay (iOS Safari): one unlocked player for all lines', () => {
  it('after the first tap every later line plays without another tap; a late pause does not end the next line', async () => {
    let gesture = false;
    const made = [];
    class Strict extends FakeAudio {
      constructor(src) { super(src); this.paused = true; this.activated = false; made.push(this); }
      play() {
        if (!this.activated && !gesture) return Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
        this.activated = true;
        this.paused = false;
        return Promise.resolve();
      }
      pause() { if (!this.paused) { this.paused = true; queueMicrotask(() => this.emit('pause')); } }
    }
    globalThis.Audio = Strict;
    globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    const spoken = [];
    globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel() {}, pause() {}, getVoices: () => [] };
    globalThis.window ??= new EventTarget();
    resetSpeech();
    const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
    speak({ seq: 20, speaker: null, text: 'Eins', voice: 'audio/1.mp3' }, 'de');
    await flush();
    expect(made[0].paused).toBe(true);
    gesture = true;
    globalThis.window.dispatchEvent(new Event('pointerdown'));
    gesture = false;
    await flush();
    expect(made[0].paused).toBe(false);
    let ended = 0;
    speak({ seq: 21, speaker: null, text: 'Zwei', voice: 'audio/2.mp3' }, 'de', { onEnd: () => ended++ });
    await flush();
    // same element, playing without a tap; the pause of line 1 (stopped) did not end line 2
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe('audio/2.mp3');
    expect(made[0].paused).toBe(false);
    expect(ended).toBe(0);
    expect(spoken).toEqual([]);
    made[0].emit('ended');
    expect(ended).toBe(1);
    delete globalThis.Audio; delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
  });
});
