// Ambient sounds: layers (foliage, rain, winter, water, battle, wind), each with its own volume,
// softly cross-faded. Continuous beds are looped, filtered noise; one-off events
// (birds, drops, thunder, distant blades) are scheduled by tick() at irregular intervals.
// If the manifest holds a file for a layer (ambient.summer, …), it replaces the synthetic bed.
//
// Kept calm (feedback "bird all the time", "wind for no reason"): birds only with forest near the
// screen centre and not zoomed far out, single short calls 20–60 s apart (rarer with little forest),
// never the same call kind twice in a row. Wind only where it has a reason: zoomed far out (height),
// many steep slopes in view (mountains) or winter (own layer) – faded in and out quietly and slowly.

import { brownNoiseBuffer, noiseBuffer } from './synth.js';
import { birdCall, droplet, distantClash } from './sfx.js';
import { mulberry32 } from './rng.js';

export const AMBIENT_LAYERS = ['summer', 'rain', 'winter', 'water', 'battle', 'wind'];

/** Birds: gaps (s), conditions, level. */
export const BIRDS = { gapMin: 20, gapSpread: 40, minForest: 0.1, maxDist: 45, gain: 0.022, kinds: 3 };

/** Wind: from which camera distance (full at MAX_DIST 75), from which share of steep slope, maximum level. */
export const WIND = { distFrom: 50, distFull: 75, cliffFrom: 0.15, cliffFull: 0.5, level: 0.3 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Level of the wind layer: only zoomed far out or in the mountains, otherwise silent. In winter the
 * winter layer itself howls, the wind layer then stays off.
 * @param {string} weather @param {number} dist camera distance @param {number} cliff share of steep slope in view 0…1
 */
export function windTarget(weather, dist = 28, cliff = 0) {
  if (weather === 'winter') return 0;
  const high = clamp01((dist - WIND.distFrom) / (WIND.distFull - WIND.distFrom));
  const mountain = clamp01((cliff - WIND.cliffFrom) / (WIND.cliffFull - WIND.cliffFrom));
  return WIND.level * Math.max(high, mountain);
}

/**
 * Target volumes of the layers from weather, water proximity, combat intensity, zoom and landscape (pure, testable).
 * @param {{ forest?: number, cliff?: number, dist?: number }} [env] forest and steep-slope share around the screen centre, camera distance
 */
export function ambientTargets(weather, water = 0, battle = 0, zoom = 1, env = {}) {
  const w = { summer: 0, rain: 0, winter: 0, water: 0, battle: 0, wind: 0 };
  if (weather === 'rain') w.rain = 0.9;
  else if (weather === 'winter') w.winter = 0.5;
  else w.summer = 0.6 * clamp01(env.forest ?? 0); // foliage rustle only near forest
  w.water = weather === 'winter' ? 0 : Math.min(1, water) * 0.7;
  w.battle = Math.min(1, battle) * 0.8;
  for (const k of Object.keys(w)) w[k] *= zoom;
  w.wind = windTarget(weather, env.dist, env.cliff);
  return w;
}

/** May birds call? Only in summer, with forest near the screen centre and not zoomed far out. */
export function birdsAllowed(weather, forest = 0, dist = 28) {
  return weather === 'summer' && forest >= BIRDS.minForest && dist < BIRDS.maxDist;
}

/** Pause until the next bird call (s): 20–60 s with dense forest, up to 2.5× longer with little forest; mobile 1.5×. */
export function birdDelay(r, forest = 1, lite = false) {
  return (BIRDS.gapMin + r() * BIRDS.gapSpread) / (0.4 + 0.6 * clamp01(forest)) * (lite ? 1.5 : 1);
}

/** Pick a call kind, never the same as last time. */
export function pickBirdKind(r, last = -1, kinds = BIRDS.kinds) {
  if (last < 0 || last >= kinds) return Math.floor(r() * kinds);
  const k = Math.floor(r() * (kinds - 1));
  return k >= last ? k + 1 : k;
}

/** Volume of a bird call: quiet, slightly louder with forest and proximity. */
export function birdGain(forest = 1, dist = 28) {
  return BIRDS.gain * (0.6 + 0.4 * clamp01(forest)) * clamp01(1.2 - dist / BIRDS.maxDist);
}

export class Ambient {
  /** @param {import('./AudioEngine.js').AudioEngine} eng */
  constructor(eng) {
    this.eng = eng;
    this.r = mulberry32(4711);
    /** @type {Record<string, { gain: GainNode, nodes: AudioNode[], level: number, file?: boolean }>} */
    this.layers = {};
    this.weather = 'summer';
    this.water = 0;
    this.battle = 0;
    this.zoom = 1;
    this.forest = 0; this.cliff = 0; this.dist = 28;
    this.lastBird = -1;
    this.nextBird = 0; this.nextDrop = 0; this.nextThunder = 0; this.nextClash = 0;
    this.active = false;
  }

  /** Build the layers (at game start). */
  start() {
    const eng = this.eng, ctx = eng.ctx;
    if (!ctx || this.active) return;
    this.active = true;
    for (const name of AMBIENT_LAYERS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(eng.buses.ambient);
      this.layers[name] = { gain, nodes: [], level: 0 };
      this.buildBed(name);
    }
    this.apply(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    const ctx = this.eng.ctx;
    for (const L of Object.values(this.layers)) {
      L.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      const nodes = L.nodes, g = L.gain;
      setTimeout(() => { for (const n of nodes) { try { /** @type {any} */ (n).stop?.(); } catch { /* already stopped */ } n.disconnect(); } g.disconnect(); }, 2500);
    }
    this.layers = {};
  }

  /** Synthetic bed of a layer, or file from the manifest. */
  buildBed(name) {
    const eng = this.eng, ctx = eng.ctx, L = this.layers[name];
    const loop = (buffer, rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
      s.start(ctx.currentTime, this.r() * buffer.duration);
      L.nodes.push(s);
      return s;
    };
    const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; L.nodes.push(b); return b; };
    const lfo = (rate, depth, param) => {
      const o = ctx.createOscillator(); o.frequency.value = rate;
      const g = ctx.createGain(); g.gain.value = depth;
      o.connect(g).connect(param); o.start();
      L.nodes.push(o, g);
    };
    const level = (v) => { const g = ctx.createGain(); g.gain.value = v; L.nodes.push(g); return g; };

    // Prefer a file from the manifest (loaded later; synthetic until then)
    eng.loadEntryBuffer('ambient', name).then((buf) => {
      if (!buf || !this.active || this.layers[name] !== L) return;
      for (const n of L.nodes) { try { /** @type {any} */ (n).stop?.(); } catch { /* */ } n.disconnect(); }
      L.nodes = [];
      const s = loop(buf);
      s.connect(level(eng.manifestGain('ambient', name))).connect(L.gain);
      L.file = true;
    });

    switch (name) {
      case 'summer': {
        // quiet foliage rustle (only with forest, see ambientTargets) – used to have wind underneath permanently
        const leaves = filt('bandpass', 3000, 0.6);
        const lg = level(0.03);
        lfo(0.11, 0.02, lg.gain);
        loop(noiseBuffer(ctx)).connect(leaves).connect(lg).connect(L.gain);
        break;
      }
      case 'wind': {
        // wind at height or in the mountains: deep noise with a wandering centre and slow gusts
        const f = filt('bandpass', 420, 0.6);
        lfo(0.07, 180, f.frequency);
        const g = level(0.32);
        lfo(0.045, 0.12, g.gain);
        loop(brownNoiseBuffer(ctx), 1).connect(f).connect(g).connect(L.gain);
        break;
      }
      case 'rain': {
        // noise in two bands: patter (high) and hiss (mid)
        const hi = filt('bandpass', 3600, 0.7);
        const soft = filt('lowpass', 7000, 0.5);
        loop(noiseBuffer(ctx)).connect(hi).connect(soft).connect(level(0.07)).connect(L.gain);
        const mid = filt('lowpass', 1400, 0.5);
        loop(noiseBuffer(ctx), 0.9).connect(mid).connect(level(0.07)).connect(L.gain);
        const low = filt('lowpass', 300, 0.5);
        loop(brownNoiseBuffer(ctx)).connect(low).connect(level(0.15)).connect(L.gain);
        break;
      }
      case 'winter': {
        // cold, howling wind: narrow band with wandering centre frequency
        const f = filt('bandpass', 650, 3.5);
        lfo(0.05, 260, f.frequency);
        const g = level(0.5);
        lfo(0.09, 0.2, g.gain);
        loop(brownNoiseBuffer(ctx), 1.2).connect(f).connect(g).connect(L.gain);
        const f2 = filt('bandpass', 1500, 6);
        lfo(0.033, 420, f2.frequency);
        loop(noiseBuffer(ctx)).connect(f2).connect(level(0.02)).connect(L.gain);
        const base = filt('lowpass', 250);
        loop(brownNoiseBuffer(ctx), 0.8).connect(base).connect(level(0.16)).connect(L.gain);
        break;
      }
      case 'water': {
        // babbling brook: band-pass noise with fast, irregular modulation
        const f = filt('bandpass', 900, 1.2);
        lfo(0.6, 300, f.frequency);
        const g = level(0.13);
        lfo(1.7, 0.05, g.gain);
        loop(noiseBuffer(ctx), 0.7).connect(f).connect(g).connect(L.gain);
        const low = filt('lowpass', 500);
        loop(brownNoiseBuffer(ctx), 1.4).connect(low).connect(level(0.18)).connect(L.gain);
        break;
      }
      case 'battle': {
        // distant melee: deep rumble; blades come as one-off events from tick()
        const f = filt('lowpass', 380);
        const g = level(0.3);
        lfo(0.23, 0.1, g.gain);
        loop(brownNoiseBuffer(ctx), 0.7).connect(f).connect(g).connect(L.gain);
        const m = filt('bandpass', 900, 0.8);
        loop(noiseBuffer(ctx), 0.6).connect(m).connect(level(0.02)).connect(L.gain);
        break;
      }
      default: break;
    }
  }

  setWeather(state) { if (state !== this.weather) { this.weather = state; this.apply(); } }

  /**
   * Per frame (throttled) from GameAudio: water proximity 0…1, combat intensity 0…1, zoom damping 0…1,
   * landscape around the screen centre (forest and steep-slope share 0…1, camera distance).
   * @param {{ forest?: number, cliff?: number, dist?: number }} [env]
   */
  setScene(water, battle, zoom, env = {}) {
    this.water = water; this.battle = battle; this.zoom = zoom;
    this.forest = env.forest ?? this.forest; this.cliff = env.cliff ?? this.cliff; this.dist = env.dist ?? this.dist;
    this.apply();
  }

  /** Set target levels; weather changes fade slowly (≈ 4 s), scene faster (≈ 1 s). */
  apply(instant = false) {
    const ctx = this.eng.ctx;
    if (!ctx || !this.active) return;
    const t = ambientTargets(this.weather, this.water, this.battle, this.zoom, { forest: this.forest, cliff: this.cliff, dist: this.dist });
    for (const [name, L] of Object.entries(this.layers)) {
      const v = t[name];
      if (Math.abs(v - L.level) < 0.01 && !instant) continue;
      const weatherLayer = name === 'summer' || name === 'rain' || name === 'winter';
      // wind comes and goes slowly (≈ 6 s) so it does not set in suddenly
      const tau = instant ? 0.05 : name === 'wind' ? 2 : weatherLayer && Math.abs(v - L.level) > 0.3 ? 1.4 : 0.35;
      L.gain.gain.setTargetAtTime(v, ctx.currentTime, tau);
      L.level = v;
    }
  }

  /**
   * Occasional bird calls: only if birdsAllowed, one short call, then 20–60 s (and more) of quiet. If the
   * manifest holds a file for the foliage layer, it brings its own birds.
   */
  birds(now, ctx, out, r, lite) {
    if (this.layers.summer?.file || this.zoom <= 0) return;
    if (!birdsAllowed(this.weather, this.forest, this.dist)) {
      // camera only just arrives at the forest: do not call right away
      this.nextBird = Math.max(this.nextBird, now + 6 + r() * 10);
      return;
    }
    if (this.nextBird === 0) this.nextBird = now + birdDelay(r, this.forest, lite) * 0.4;
    if (now < this.nextBird) return;
    const kind = pickBirdKind(r, this.lastBird);
    this.lastBird = kind;
    const pan = this.eng.panNode(out, (r() - 0.5) * 1.4);
    birdCall(ctx, pan, now + 0.05, r, kind, birdGain(this.forest, this.dist) * this.zoom);
    this.birdCount = (this.birdCount ?? 0) + 1;
    this.nextBird = now + birdDelay(r, this.forest, lite);
  }

  /** Schedule one-off events (from the AudioEngine tick, ~5×/s). */
  tick(now = this.eng.ctx?.currentTime ?? 0) {
    const ctx = this.eng.ctx;
    if (!ctx || !this.active) return;
    const r = this.r, lite = this.eng.lite;
    const out = this.eng.buses.ambient;
    const rain = this.layers.rain?.level ?? 0, bat = this.layers.battle?.level ?? 0;
    this.birds(now, ctx, out, r, lite);
    if (rain > 0.1 && !this.layers.rain.file && now >= this.nextDrop) {
      const pan = this.eng.panNode(out, (r() - 0.5) * 1.6);
      for (let i = 0; i < (lite ? 2 : 4); i++) droplet(ctx, pan, now + r() * 0.3, r, 0.02 * rain);
      this.nextDrop = now + 0.25 + r() * 0.4;
    }
    if (rain > 0.5 && now >= this.nextThunder) {
      if (this.nextThunder > 0) this.eng.play('thunder', { gain: 0.7 + r() * 0.3, at: now });
      this.nextThunder = now + 25 + r() * 40;
    }
    if (bat > 0.1 && now >= this.nextClash) {
      const pan = this.eng.panNode(out, (r() - 0.5) * 1.2);
      distantClash(ctx, pan, now + 0.02, r, 0.05 * bat);
      this.nextClash = now + 0.15 + r() * (0.9 - bat * 0.6);
    }
  }
}
