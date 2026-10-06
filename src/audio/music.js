// Music: per theme (menu, build, winter, battle) plays either files from the manifest or the generative
// music from composer.js. Theme changes cross-fade; victory/defeat as a short signal melody.
// Between two peace pieces (build, winter) there is a pause (setting musicPause) in which only the
// ambience is heard. Switches between build and winter wait for the running piece to finish.
// The notes are scheduled with a small lookahead so playback stays cleanly in time.

import { composeSection, composeJingle, THEMES } from './composer.js';
import { scheduleNotes } from './synth.js';
import { pickFile, lookup } from './manifest.js';
import { MUSIC_PAUSES, BATTLE_MUSIC } from './settings.js';

/** All music names in the manifest. */
export const MUSIC_THEMES = /** @type {const} */ (['menu', 'build', 'winter', 'battle', 'victory', 'defeat']);
/** Peace themes: pauses between the pieces, gentle switching among each other. */
export const PEACE_THEMES = new Set(['build', 'winter']);

/**
 * Theme that is actually played: winter without its own files sounds like build
 * (the generative music has no winter theme).
 * @param {import('./manifest.js').Manifest} manifest @param {string} theme
 */
export function resolveTheme(manifest, theme) {
  if (theme === 'winter' && !lookup(manifest, 'music', 'winter')) return 'build';
  return theme;
}

/** Pause length in seconds for a setting and a random number 0…1. */
export function pauseSeconds(setting, r) {
  const [a, b] = MUSIC_PAUSES[setting] ?? MUSIC_PAUSES.normal;
  return a + (b - a) * r;
}

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
      const gap = this.section % th.form.length !== 0 ? 0 : PEACE_THEMES.has(this.theme) ? this.music.pauseGap() : 3 + this.music.rnd() * 3;
      this.music.sections[this.theme] = this.section;
      this.loadSection(end + gap);
    }
  }

  fade(v, tau) {
    const t = this.music.eng.ctx.currentTime;
    for (const g of [this.fader.gain, this.wet.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, tau); }
  }

  /** @param {number} [fadeOut] seconds until (almost) silent */
  stop(fadeOut = FADE_OUT) {
    this.stopped = true;
    this.fade(0, fadeOut / 4);
    setTimeout(() => { this.fader.disconnect(); this.wet.disconnect(); }, (fadeOut + LOOKAHEAD + 3) * 1000);
  }
}

/** File track: plays the files of a manifest entry one after another (without immediate repetition). */
export class FileTrack {
  constructor(music, theme, entry, firstBuffer, firstFile) {
    this.music = music;
    this.kind = 'file';
    this.theme = theme;
    this.entry = entry;
    this.peace = PEACE_THEMES.has(theme);
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
    // never loop peace pieces directly: a pause follows every piece
    s.loop = this.entry.files.length === 1 && this.entry.loop !== false && !this.peace;
    this.level.gain.setValueAtTime(this.entry.gain ?? 1, Math.max(ctx.currentTime, at - 0.01));
    s.connect(this.level);
    s.start(at);
    this.src = s;
    this.startsAt = at;
    this.last = file;
    s.onended = () => { if (!this.stopped && !s.loop && this.src === s) this.playNext(this.peace ? this.music.pauseGap() : 1.5); };
  }

  /** Next piece after gap seconds (audio time, pauses along with a hidden tab). */
  async playNext(gap, at = null) {
    const file = pickFile(this.entry, this.music.rnd, this.last);
    const req = (this.req = (this.req ?? 0) + 1);
    this.pendingGap = gap;
    const buf = await this.music.eng.loadBuffer(file);
    if (this.stopped || req !== this.req) return;
    this.pendingGap = null;
    if (buf) this.playBuffer(buf, file, Math.max(at ?? 0, this.music.eng.ctx.currentTime + gap));
  }

  /**
   * Switch to another peace theme without aborting the running piece:
   * the next piece comes from the new theme; if a pause is on, the scheduled piece is replaced.
   */
  retarget(theme, entry) {
    this.theme = theme;
    this.entry = entry;
    this.last = null;
    const ctx = this.music.eng.ctx;
    if (this.src && this.startsAt > ctx.currentTime + 0.05) {
      const at = this.startsAt, old = this.src;
      this.src = null;
      try { old.stop(); } catch { /* */ }
      this.playNext(0, at);
    } else if (this.pendingGap != null) this.playNext(this.pendingGap);
  }

  update() {}

  fade(v, tau) {
    const t = this.music.eng.ctx.currentTime, g = this.fader.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, tau);
  }

  /** @param {number} [fadeOut] seconds until (almost) silent */
  stop(fadeOut = FADE_OUT) {
    this.stopped = true;
    this.fade(0, fadeOut / 4);
    const src = this.src;
    setTimeout(() => { try { src?.stop(); } catch { /* */ } this.fader.disconnect(); }, (fadeOut + 2) * 1000);
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

  /** Random pause length between peace pieces according to the setting. */
  pauseGap() { return pauseSeconds(this.eng.settings?.musicPause, this.rnd()); }

  /** Choose theme: 'menu' | 'build' | 'winter' | 'battle' | null (silence). */
  setTheme(theme) {
    if (theme === this.want && (this.track || !this.eng.ctx)) return;
    this.want = theme;
    if (this.eng.ctx) this.startWanted();
  }

  /** Called after the audio context is unlocked. */
  onReady() { if (this.want && !this.track) this.startWanted(); }

  startWanted() {
    const eng = this.eng;
    const theme = this.want ? resolveTheme(eng.manifest, this.want) : null;
    if (this.track?.theme === theme) return;
    const entry = theme ? lookup(eng.manifest, 'music', theme) : null;
    if (entry && this.track?.kind === 'file' && this.track.peace && PEACE_THEMES.has(theme)) {
      this.track.retarget(theme, entry);
      return;
    }
    // combat over: slowly fade out the combat theme, the peace music fades in underneath
    this.track?.stop(this.track.theme === 'battle' && PEACE_THEMES.has(theme) ? BATTLE_MUSIC.fadeOut : FADE_OUT);
    this.track = null;
    if (!theme) return;
    if (entry) {
      // load file; until then (or if it is missing) play generatively
      this.startSynth(theme);
      const file = pickFile(entry, this.rnd);
      eng.loadBuffer(file).then((buf) => {
        if (!buf || !this.want || resolveTheme(eng.manifest, this.want) !== theme || !eng.ctx) return;
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
