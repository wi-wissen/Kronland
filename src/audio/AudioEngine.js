// AudioEngine: one shared AudioContext with buses (master, music, sfx, ambient, ui), volume
// settings, unlocking on the first user interaction (autoplay rules, iOS Safari), pause on
// hidden tab, voice limiting, spatial mix and files from public/audio/manifest.json.
// Without Web Audio (Node, tests, very old browsers) everything is a silent no-op.

import { loadAudioSettings, saveAudioSettings, broadcastAudioSettings, normalizeSettings, applySettingsDetail, AUDIO_SETTINGS_KEY, SETTINGS_EVENT, VOLUME_KEYS } from './settings.js';
import { VoiceLimiter } from './voices.js';
import { spatialize } from './spatial.js';
import { parseManifest, emptyManifest, lookup, pickFile, MANIFEST_URL } from './manifest.js';
import { siteUrl, assetUrl } from '../paths.js';
import { SFX } from './sfx.js';
import { createReverb } from './synth.js';
import { mulberry32 } from './rng.js';
import { Music } from './music.js';

/** Level of music and ambience while a voice speaks (1 = unchanged) */
const DUCK = { music: 0.22, ambient: 0.55 };
import { Ambient } from './ambient.js';

const hasWindow = typeof window !== 'undefined';
const AC = hasWindow ? (window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext) : undefined;

/**
 * Run work that followed a user gesture a little later, in an idle moment (at the latest after `timeout` ms).
 * @param {() => void} fn @param {number} [timeout]
 */
export function afterGesture(fn, timeout = 400) {
  const run = () => { try { fn(); } catch (err) { console.error(err); } };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout });
  else setTimeout(run, 16);
}

/** Volume slider → gain (closer to perception than linear). */
export const sliderToGain = (v) => v * v;

export class AudioEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.settings = loadAudioSettings();
    this.available = !!AC;
    this.unlocked = false;
    /** Mobile: fewer voices, cheap reverb, fewer ambient events */
    this.lite = hasWindow && (matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4);
    this.voices = new VoiceLimiter({ globalMax: this.lite ? 12 : 24 });
    this.rnd = mulberry32(((Date.now() & 0xffff) ^ 0x5bd1) >>> 0);
    /** @type {Record<string, GainNode>} */
    this.buses = {};
    this.manifest = emptyManifest();
    /** @type {Map<string, Promise<AudioBuffer|null>>} */
    this.buffers = new Map();
    /** @type {Map<string, AudioBuffer>} loaded effect files (synchronous access when playing) */
    this.sfxFiles = new Map();
    this.lastFile = new Map();
    /** Listener for spatial sounds (set by GameAudio every frame) */
    this.listener = null;
    this.music = new Music(this);
    this.ambient = new Ambient(this);
    this.installed = false;
    /** Counter of played effects per name (check aid for tests and debugging: window.__kronlandAudio.played) */
    this.played = Object.create(null);
  }

  /** Register event listeners (once, from App.vue or GameAudio). */
  install() {
    if (this.installed || !hasWindow) return this;
    this.installed = true;
    const unlock = () => this.unlock();
    for (const t of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(t, unlock, { capture: true, passive: true });
    this.removeUnlock = () => { for (const t of ['pointerdown', 'touchend', 'keydown', 'click']) window.removeEventListener(t, unlock, { capture: true }); };
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener(SETTINGS_EVENT, (e) => {
      const d = /** @type {CustomEvent} */ (e).detail;
      if (d?.source === 'audio') { this.applySettings(normalizeSettings(d.audio, this.settings), false); return; }
      // event without content: re-read settings from storage
      const next = d ? applySettingsDetail(this.settings, d) : loadAudioSettings();
      if (next) this.applySettings(next, !!d);
      else if (!d) this.applySettings(loadAudioSettings(), false);
    });
    window.addEventListener('storage', (e) => { if (e.key === AUDIO_SETTINGS_KEY) this.applySettings(loadAudioSettings(), false); });
    // UI sounds: all buttons of the UI (except the play field)
    document.addEventListener('click', (e) => {
      const b = /** @type {Element} */ (e.target)?.closest?.('button, [role="button"], .btn, select, input[type="checkbox"], input[type="radio"]');
      if (b && !b.hasAttribute('data-no-sound')) this.play(b.classList.contains('primary') ? 'confirm' : 'click');
    }, true);
    document.addEventListener('pointerover', (e) => {
      if (/** @type {PointerEvent} */ (e).pointerType !== 'mouse') return;
      const b = /** @type {Element} */ (e.target)?.closest?.('button');
      if (b && b !== this.lastHover && !b.disabled) { this.lastHover = b; this.play('hover'); }
      else if (!b) this.lastHover = null;
    }, true);
    return this;
  }

  /** Create or resume the AudioContext on the first user interaction. */
  unlock() {
    if (!this.available) return;
    if (!this.ctx) this.createContext();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
    if (!this.unlocked) {
      // iOS: a silent buffer within the gesture unlocks the output
      try {
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch { /* egal */ }
      this.unlocked = true;
      this.removeUnlock?.();
      // let further gestures resume it, in case the browser suspends the context again later
      for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, () => { if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {}); }, { capture: true, passive: true });
      // Music and ambience build their synth graphs (together 100–300 ms on the main thread): not inside the
      // input event, otherwise the first click or selection drag of the session freezes. Each runs in its own
      // task once the browser has a moment, so frames (and the selection box) get through in between.
      afterGesture(() => this.music.onReady());
      afterGesture(() => { if (this.wantAmbient) this.ambient.start(); });
    }
  }

  createContext() {
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      this.available = false;
      return;
    }
    const ctx = this.ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(limiter);
    this.buses.master = master;
    // Music and ambience run through their own ducking, which lowers them during spoken dialogues
    this.ducks = {};
    for (const k of ['music', 'sfx', 'ambient', 'ui']) {
      const g = ctx.createGain();
      if (DUCK[k] !== undefined) { const d = ctx.createGain(); d.connect(master); g.connect(d); this.ducks[k] = d; } else g.connect(master);
      this.buses[k] = g;
    }
    // Reverb: music (own reverb into the music bus) and a quiet shared room for effects
    this.musicReverb = createReverb(ctx, this.lite);
    this.musicReverb.output.connect(this.buses.music);
    this.musicReverb.input.gain.value = 0.5;
    if (!this.lite) {
      const room = createReverb(ctx, true);
      const send = ctx.createGain(); send.gain.value = 0.12;
      this.buses.sfx.connect(send).connect(room.input);
      this.buses.ui.connect(send);
      room.output.connect(master);
    }
    this.applySettings(this.settings, false, true);
    this.loadManifest();
    ctx.onstatechange = () => { if (ctx.state === 'running') this.music.update(); };
  }

  onVisibility() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (this.unlocked) ctx.resume().catch(() => {});
  }

  // ---------- Settings ----------

  /** @param {import('./settings.js').AudioSettings} s @param {boolean} persist */
  applySettings(s, persist = true, instant = false) {
    this.settings = normalizeSettings(s);
    if (persist) { saveAudioSettings(this.settings); broadcastAudioSettings(this.settings); }
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime, tau = instant ? 0.001 : 0.05;
    const m = this.settings.muted ? 0 : sliderToGain(this.settings.master);
    this.buses.master.gain.setTargetAtTime(m, t, tau);
    for (const k of ['music', 'sfx', 'ambient', 'ui']) this.buses[k].gain.setTargetAtTime(sliderToGain(this.settings[k]), t, tau);
  }

  /**
   * Lower music and ambience while a voice speaks (down fast, back up slowly).
   * @param {boolean} on
   */
  duck(on) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ducked = on;
    for (const [k, d] of Object.entries(this.ducks)) d.gain.setTargetAtTime(on ? DUCK[k] : 1, ctx.currentTime, on ? 0.12 : 0.6);
  }

  /** @param {'master'|'music'|'sfx'|'ambient'|'ui'} key */
  getVolume(key) { return this.settings[key]; }
  setVolume(key, v) { if (VOLUME_KEYS.includes(key)) this.applySettings({ ...this.settings, [key]: v }); }
  get muted() { return this.settings.muted; }
  setMuted(m) { this.applySettings({ ...this.settings, muted: !!m }); }
  toggleMute() { this.setMuted(!this.settings.muted); return this.settings.muted; }

  // ---------- Files ----------

  async loadManifest() {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch(siteUrl(MANIFEST_URL));
      if (!res.ok) return;
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('html')) return;
      this.manifest = parseManifest(await res.json(), siteUrl('audio/'));
    } catch { return; }
    // Preload effect files so they are ready immediately when played
    for (const [name, e] of Object.entries(this.manifest.sfx)) {
      for (const f of e.files) this.loadBuffer(f).then((b) => { if (b) this.sfxFiles.set(f, b); });
      void name;
    }
    // If music or ambience is already running, switch to files
    if (this.music.want && Object.keys(this.manifest.music).length) { const w = this.music.want; this.music.track?.stop(); this.music.track = null; this.music.setTheme(w); }
    if (this.ambient.active && Object.keys(this.manifest.ambient).length) { this.ambient.stop(); setTimeout(() => this.wantAmbient && this.ambient.start(), 100); }
  }

  /** Load and decode a file (cached); null on error or missing file. */
  loadBuffer(url) {
    if (!this.ctx || typeof fetch === 'undefined') return Promise.resolve(null);
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(assetUrl(url))
        .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('html') ? r.arrayBuffer() : null))
        .then((ab) => (ab ? new Promise((res) => { this.ctx.decodeAudioData(ab, res, () => res(null)); }) : null))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  /** Buffer for a manifest entry (random file). */
  loadEntryBuffer(cat, name) {
    const e = lookup(this.manifest, cat, name);
    return e ? this.loadBuffer(pickFile(e, this.rnd)) : Promise.resolve(null);
  }

  manifestGain(cat, name) { return lookup(this.manifest, cat, name)?.gain ?? 1; }

  // ---------- Playing ----------

  /** Stereo panner (with fallback for browsers without StereoPannerNode). */
  panNode(out, pan) {
    const ctx = this.ctx;
    if (!ctx || !pan) return out;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(out);
      setTimeout(() => p.disconnect(), 6000);
      return p;
    }
    return out;
  }

  /**
   * Play a sound effect.
   * @param {string} name key from SFX
   * @param {{ x?: number, z?: number, gain?: number, at?: number, delay?: number }} [o]
   *   x/z: world position in tiles (spatial); without position global
   * @returns {boolean} played?
   */
  play(name, o = {}) {
    const ctx = this.ctx, def = SFX[name];
    if (!ctx || !def || ctx.state !== 'running' || this.settings.muted) return false;
    let gain = (o.gain ?? 1) * (def.gain ?? 1), pan = 0;
    if (o.x !== undefined && o.z !== undefined) {
      if (!this.listener) return false;
      const s = spatialize(o.x, o.z, this.listener);
      if (!s) return false;
      gain *= s.gain; pan = s.pan;
    }
    if (gain < 0.02) return false;
    const now = ctx.currentTime;
    const t = Math.max(now, o.at ?? now) + (o.delay ?? 0) + 0.01;
    if (!this.voices.acquire(name, t, def.dur, { max: this.lite ? Math.min(def.max ?? 4, 2) : def.max, cooldown: def.cooldown, priority: def.priority })) return false;
    const bus = this.buses[def.bus ?? 'sfx'];
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(this.panNode(bus, pan));
    const entry = lookup(this.manifest, 'sfx', name);
    const file = entry ? pickFile(entry, this.rnd, this.lastFile.get(name)) : null;
    const buf = file ? this.sfxFiles.get(file) : null;
    let dur = def.dur;
    if (buf) {
      this.lastFile.set(name, file);
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = 1 + (this.rnd() - 0.5) * 0.08;
      g.gain.value = gain * entry.gain;
      s.connect(g);
      s.start(t);
      dur = buf.duration;
    } else {
      def.play(ctx, g, t, this.rnd);
    }
    setTimeout(() => g.disconnect(), (t - now + dur + 1) * 1000);
    this.played[name] = (this.played[name] ?? 0) + 1;
    return true;
  }

  /**
   * Play a file once (e.g. a voiced bark), through a bus with its volume and mute.
   * @param {string} url @param {{ gain?: number, bus?: string }} [o]
   * @returns {Promise<number>} length in seconds, 0 if not played
   */
  async playFile(url, o = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.muted) return 0;
    const buf = await this.loadBuffer(url);
    if (!buf || ctx.state !== 'running') return 0;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    g.connect(this.buses[o.bus ?? 'sfx']);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(g);
    s.start();
    s.onended = () => g.disconnect();
    return buf.duration;
  }

  /** Ambience on/off (GameAudio). */
  setAmbient(on) {
    this.wantAmbient = on;
    if (!this.ctx || !this.unlocked) return;
    if (on) this.ambient.start(); else this.ambient.stop();
  }
}

/** @type {AudioEngine|null} */
let instance = null;

/** The shared AudioEngine (created once, listeners registered). */
export function getAudio() {
  if (!instance) {
    instance = new AudioEngine().install();
    if (hasWindow) /** @type {any} */ (window).__kronlandAudio = instance;
  }
  return instance;
}
