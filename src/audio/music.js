// Music: per theme (menu, build, battle) plays either files from the manifest or the generative
// music from composer.js. Theme changes cross-fade; victory/defeat as a short signal melody.
// The notes are scheduled with a small lookahead so playback stays cleanly in time.

import { composeSection, composeJingle, THEMES } from './composer.js';
import { scheduleNotes } from './synth.js';
import { pickFile, lookup } from './manifest.js';

const LOOKAHEAD = 1.2;   // seconds scheduled in advance
const INTERVAL = 200;    // ms between scheduling passes
const FADE_IN = 2.5, FADE_OUT = 3;

/** Generative track of a theme. */
class SynthTrack {
  constructor(music, theme, startAt, section) {
    this.music = music;
    this.kind = 'synth';
    this.theme = theme;
    this.section = section;
    const ctx = music.eng.ctx;
    this.fader = ctx.createGain();
    this.wet = ctx.createGain();
    this.fader.connect(music.eng.buses.music);
    this.wet.connect(music.eng.musicReverb.input);
    this.out = { dry: this.fader, wet: this.wet };
    this.loadSection(startAt);
  }

  loadSection(at) {
    const s = composeSection(this.theme, this.section, this.music.seed, { lite: this.music.eng.lite });
    this.events = s.events;
    this.bpm = s.bpm;
    this.start = at;
    this.length = (s.beats * 60) / s.bpm;
    this.next = 0;
  }

  /** Schedule notes up to now + LOOKAHEAD. */
  update(now) {
    if (this.stopped) return;
    const until = now + LOOKAHEAD;
    for (let guard = 0; guard < 4; guard++) {
      const spb = 60 / this.bpm;
      const evs = this.events;
      const from = this.next;
      while (this.next < evs.length && this.start + evs[this.next].beat * spb < until) this.next++;
      if (this.next > from) {
        const slice = evs.slice(from, this.next).filter((e) => this.start + e.beat * spb >= now - 0.05);
        scheduleNotes(this.music.eng.ctx, this.out, slice, this.start, this.bpm);
      }
      const end = this.start + this.length;
      if (this.next < evs.length || end > until) break;
      // section finished: next section; after a whole pass a short breather
      this.section++;
      const th = THEMES[this.theme];
      const gap = this.section % th.form.length === 0 ? 3 + this.music.rnd() * 3 : 0;
      this.music.sections[this.theme] = this.section;
      this.loadSection(end + gap);
    }
  }

  fade(v, tau) {
    const t = this.music.eng.ctx.currentTime;
    for (const g of [this.fader.gain, this.wet.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, tau); }
  }

  stop() {
    this.stopped = true;
    this.fade(0, FADE_OUT / 4);
    setTimeout(() => { this.fader.disconnect(); this.wet.disconnect(); }, (FADE_OUT + LOOKAHEAD + 3) * 1000);
  }
}

/** File track: plays the files of a manifest entry one after another (without immediate repetition). */
class FileTrack {
  constructor(music, theme, entry, firstBuffer, firstFile) {
    this.music = music;
    this.kind = 'file';
    this.theme = theme;
    this.entry = entry;
    const ctx = music.eng.ctx;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    this.level = ctx.createGain();
    this.level.gain.value = entry.gain ?? 1;
    this.level.connect(this.fader).connect(music.eng.buses.music);
    this.playBuffer(firstBuffer, firstFile, ctx.currentTime + 0.05);
  }

  playBuffer(buffer, file, at) {
    const ctx = this.music.eng.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = this.entry.files.length === 1 && this.entry.loop !== false;
    s.connect(this.level);
    s.start(at);
    this.src = s;
    this.last = file;
    s.onended = () => { if (!this.stopped && !s.loop) this.playNext(); };
  }

  async playNext() {
    const file = pickFile(this.entry, this.music.rnd, this.last);
    const buf = await this.music.eng.loadBuffer(file);
    if (this.stopped) return;
    if (buf) this.playBuffer(buf, file, this.music.eng.ctx.currentTime + 1.5);
  }

  update() {}

  fade(v, tau) {
    const t = this.music.eng.ctx.currentTime, g = this.fader.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, tau);
  }

  stop() {
    this.stopped = true;
    this.fade(0, FADE_OUT / 4);
    const src = this.src;
    setTimeout(() => { try { src?.stop(); } catch { /* */ } this.fader.disconnect(); }, (FADE_OUT + 2) * 1000);
  }
}

export class Music {
  /** @param {import('./AudioEngine.js').AudioEngine} eng */
  constructor(eng) {
    this.eng = eng;
    /** desired theme (also before unlocking) */
    this.want = null;
    /** @type {SynthTrack|FileTrack|null} */
    this.track = null;
    /** section counter per theme: when switching back it continues varied */
    this.sections = {};
    this.seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    let s = this.seed;
    this.rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    this.timer = null;
  }

  /** Choose theme: 'menu' | 'build' | 'battle' | null (silence). */
  setTheme(theme) {
    if (theme === this.want && (this.track || !this.eng.ctx)) return;
    this.want = theme;
    if (this.eng.ctx) this.startWanted();
  }

  /** Called after the audio context is unlocked. */
  onReady() { if (this.want && !this.track) this.startWanted(); }

  startWanted() {
    const eng = this.eng, ctx = eng.ctx, theme = this.want;
    if (this.track?.theme === theme) return;
    this.track?.stop();
    this.track = null;
    if (!theme) return;
    const entry = lookup(eng.manifest, 'music', theme);
    if (entry) {
      // load file; until then (or if it is missing) play generatively
      this.startSynth(theme);
      const file = pickFile(entry, this.rnd);
      eng.loadBuffer(file).then((buf) => {
        if (!buf || this.want !== theme || !eng.ctx) return;
        this.track?.stop();
        this.track = new FileTrack(this, theme, entry, buf, file);
        this.track.fade(1, FADE_IN / 4);
      });
    } else this.startSynth(theme);
    if (!this.timer) this.timer = setInterval(() => this.update(), INTERVAL);
    this.update();
  }

  startSynth(theme) {
    const ctx = this.eng.ctx;
    if (!THEMES[theme]) return;
    const t = new SynthTrack(this, theme, ctx.currentTime + 0.15, this.sections[theme] ?? 0);
    t.fader.gain.value = 0; t.wet.gain.value = 0;
    t.fade(1, FADE_IN / 4);
    this.track = t;
  }

  update() {
    const ctx = this.eng.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.track?.update(ctx.currentTime);
  }

  /** Signal melody (victory/defeat); then silence until a theme is set again. */
  jingle(name) {
    const eng = this.eng, ctx = eng.ctx;
    this.want = null;
    this.track?.stop();
    this.track = null;
    if (!ctx) return;
    const entry = lookup(eng.manifest, 'music', name);
    const synth = () => {
      const j = composeJingle(name);
      const g = ctx.createGain(); g.connect(eng.buses.music);
      const w = ctx.createGain(); w.gain.value = 0.8; w.connect(eng.musicReverb.input);
      scheduleNotes(ctx, { dry: g, wet: w }, j.events, ctx.currentTime + 0.6, j.bpm);
      setTimeout(() => { g.disconnect(); w.disconnect(); }, ((j.beats * 60) / j.bpm + 5) * 1000);
    };
    if (!entry) { synth(); return; }
    eng.loadBuffer(pickFile(entry, this.rnd)).then((buf) => {
      if (!buf) { synth(); return; }
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = entry.gain;
      s.connect(g).connect(eng.buses.music);
      s.start(ctx.currentTime + 0.3);
    });
  }

  dispose() {
    clearInterval(this.timer);
    this.timer = null;
    this.track?.stop();
    this.track = null;
  }
}
