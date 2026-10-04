// Procedural sound effects. Each entry: length, voice rule (max, cooldown, priority), bus and
// a function play(ctx, out, t, r) that schedules the sound from time t into the node out.
// r() supplies randomness 0…1 for small variations (pitch, timbre, timing).
// Sound goal: warm, soft, more "wood and bells" than "arcade"; no hard transients above 0 dBFS.

import { tone, noise, bell, pluck, envelope, noiseBuffer, recorder } from './synth.js';

/** Slight pitch variation ±amount (factor). */
const vary = (r, amount = 0.06) => 1 + (r() - 0.5) * 2 * amount;

// Partial series for metal and bells (frequency factor, level, decay factor)
const BLADE = [[1, 0.5, 1], [1.47, 0.35, 0.8], [2.09, 0.3, 0.6], [2.56, 0.22, 0.5], [3.24, 0.15, 0.35]];
const CHIME = [[1, 0.55, 1], [2, 0.22, 0.7], [3.01, 0.12, 0.45], [4.2, 0.06, 0.3]];
const COIN = [[1, 0.5, 1], [2.4, 0.3, 0.6], [3.9, 0.18, 0.4], [5.3, 0.08, 0.25]];
const STONE_TINK = [[1, 0.5, 1], [2.76, 0.28, 0.5], [5.4, 0.12, 0.3]];

/** A short reverb tail as an extra for "big" events is supplied by the bus; only the dry sound here. */

/** @typedef {{ dur: number, max?: number, cooldown?: number, priority?: number, bus?: 'sfx'|'ui'|'ambient', gain?: number, play: (ctx: BaseAudioContext, out: AudioNode, t: number, r: () => number) => void }} SfxDef */

/** @type {Record<string, SfxDef>} */
export const SFX = {
  // ---------- Work ----------
  chop: {
    dur: 0.35, max: 3, cooldown: 0.09, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.08);
      // dull axe stroke in wood: tone impulse + wood resonance + short crack
      tone(ctx, out, t, { type: 'sine', freq: 210 * p, to: 120 * p, glide: 0.07, dur: 0.12, gain: 0.5 });
      noise(ctx, out, t, { filter: 'bandpass', freq: 950 * p, q: 2.2, dur: 0.09, gain: 0.55 });
      noise(ctx, out, t, { filter: 'highpass', freq: 3500, q: 0.7, dur: 0.025, gain: 0.18 });
      tone(ctx, out, t + 0.004, { type: 'triangle', freq: 420 * p, dur: 0.18, gain: 0.1 });
    },
  },
  pickaxe: {
    dur: 0.5, max: 3, cooldown: 0.09, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.07);
      noise(ctx, out, t, { filter: 'highpass', freq: 2500, q: 0.8, dur: 0.02, gain: 0.3 });
      bell(ctx, out, t, 1850 * p, 0.28, 0.16, STONE_TINK);
      // rock chips
      noise(ctx, out, t + 0.02, { filter: 'bandpass', freq: 1400 * p, q: 1.2, dur: 0.16, gain: 0.14, curve: 'lin' });
      tone(ctx, out, t, { freq: 160 * p, to: 90, glide: 0.06, dur: 0.08, gain: 0.25 });
    },
  },
  hammer: {
    dur: 0.3, max: 3, cooldown: 0.08, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.1);
      // wooden mallet on beam: soft knock with wood resonance
      tone(ctx, out, t, { freq: 330 * p, to: 190 * p, glide: 0.05, dur: 0.1, gain: 0.45 });
      noise(ctx, out, t, { filter: 'bandpass', freq: 1700 * p, q: 3, dur: 0.05, gain: 0.32 });
      tone(ctx, out, t, { type: 'triangle', freq: 560 * p, dur: 0.14, gain: 0.08 });
    },
  },
  anvil: {
    dur: 0.8, max: 2, cooldown: 0.2, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.03);
      noise(ctx, out, t, { filter: 'highpass', freq: 3000, dur: 0.015, gain: 0.25 });
      bell(ctx, out, t, 1320 * p, 0.7, 0.13, [[1, 0.5, 1], [2.71, 0.3, 0.6], [4.16, 0.18, 0.4], [5.43, 0.1, 0.3]]);
    },
  },
  saw: {
    dur: 0.7, max: 2, cooldown: 0.3, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.06);
      // two saw strokes: noise with rough modulation
      for (let i = 0; i < 2; i++) {
        noise(ctx, out, t + i * 0.32, { filter: 'bandpass', freq: (i ? 2100 : 1800) * p, to: (i ? 1700 : 2300) * p, q: 4, dur: 0.28, gain: 0.22, attack: 0.04, curve: 'lin' });
      }
    },
  },
  chisel: {
    dur: 0.25, max: 2, cooldown: 0.12, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.08);
      bell(ctx, out, t, 2600 * p, 0.12, 0.1, STONE_TINK);
      noise(ctx, out, t, { filter: 'bandpass', freq: 3200 * p, q: 2, dur: 0.05, gain: 0.18 });
    },
  },
  bubble: {
    dur: 0.5, max: 2, cooldown: 0.3, priority: 1,
    play(ctx, out, t, r) {
      // alchemist: bubbling cauldron
      for (let i = 0; i < 3; i++) {
        const f = (300 + r() * 250);
        tone(ctx, out, t + i * 0.12 + r() * 0.05, { freq: f, to: f * 1.8, glide: 0.06, dur: 0.07, gain: 0.12 });
      }
    },
  },
  place: {
    dur: 0.35, max: 2, cooldown: 0.1, priority: 2, bus: 'ui',
    play(ctx, out, t, r) {
      // construction site staked out: two wooden pegs
      for (const [dt, f] of [[0, 380], [0.11, 300]]) {
        tone(ctx, out, t + dt, { freq: f * vary(r, 0.04), to: f * 0.6, glide: 0.05, dur: 0.09, gain: 0.35 });
        noise(ctx, out, t + dt, { filter: 'bandpass', freq: 1500, q: 2.5, dur: 0.04, gain: 0.2 });
      }
    },
  },

  // ---------- Economy (global) ----------
  buildingDone: {
    dur: 1.8, max: 1, cooldown: 0.6, priority: 3, bus: 'ui',
    play(ctx, out, t) {
      // small fanfare: plucked major chord upwards, recorder enters on top
      const notes = [67, 71, 74, 79];
      notes.forEach((m, i) => pluck(ctx, out, t + i * 0.085, m, 0.32, 'harp', 1.6));
      pluck(ctx, out, t, 55, 0.3, 'lute', 1.5);
      recorder(ctx, out, t + 0.34, 83, 0.22, 0.9);
      recorder(ctx, out, t + 0.56, 86, 0.75, 1);
    },
  },
  serfBought: {
    dur: 0.6, max: 2, cooldown: 0.12, priority: 2, bus: 'ui',
    play(ctx, out, t, r) {
      const k = r() < 0.5 ? 0 : 2;
      pluck(ctx, out, t, 60 + k, 0.35, 'lute', 0.55);
      pluck(ctx, out, t + 0.1, 67 + k, 0.35, 'lute', 0.5);
      tone(ctx, out, t, { freq: 180, to: 260, glide: 0.06, dur: 0.08, gain: 0.15 });
    },
  },
  coin: {
    dur: 0.9, max: 1, cooldown: 0.5, priority: 3, bus: 'ui',
    play(ctx, out, t, r) {
      // coins jingle into the pouch
      const n = 5;
      for (let i = 0; i < n; i++) {
        const dt = i * 0.07 + r() * 0.04;
        bell(ctx, out, t + dt, (2800 + r() * 1400), 0.32, 0.11 * (1 - i * 0.1), COIN);
      }
      noise(ctx, out, t + 0.3, { filter: 'bandpass', freq: 900, q: 0.8, dur: 0.15, gain: 0.12 });
    },
  },
  research: {
    dur: 2.2, max: 1, cooldown: 0.8, priority: 3, bus: 'ui',
    play(ctx, out, t) {
      // glockenspiel triad (pentatonic upwards), long decay
      [[1046.5, 0], [1318.5, 0.14], [1568, 0.28], [2093, 0.46]].forEach(([f, dt], i) => bell(ctx, out, t + dt, f, 1.6 - i * 0.2, 0.13, CHIME));
    },
  },
  workerArrived: {
    dur: 0.8, max: 1, cooldown: 0.4, priority: 2, bus: 'ui',
    play(ctx, out, t) {
      pluck(ctx, out, t, 69, 0.28, 'harp', 0.8);
      pluck(ctx, out, t + 0.12, 64, 0.22, 'harp', 0.8);
      pluck(ctx, out, t + 0.24, 69 + 7, 0.24, 'harp', 0.9);
    },
  },
  upgrade: {
    dur: 0.9, max: 1, cooldown: 0.3, priority: 2, bus: 'ui',
    play(ctx, out, t) {
      [62, 66, 69].forEach((m, i) => pluck(ctx, out, t + i * 0.07, m, 0.28, 'lute', 0.9));
    },
  },
  blessing: {
    dur: 2.4, max: 1, cooldown: 1, priority: 3, bus: 'ui',
    play(ctx, out, t) {
      // chapel bell
      bell(ctx, out, t, 523.25, 2.2, 0.16, [[0.5, 0.3, 1.2], [1, 0.45, 1], [1.19, 0.2, 0.6], [1.5, 0.15, 0.6], [2, 0.12, 0.5], [2.74, 0.06, 0.3]]);
    },
  },

  // ---------- Combat ----------
  clash: {
    dur: 0.45, max: 4, cooldown: 0.05, priority: 2,
    play(ctx, out, t, r) {
      const p = vary(r, 0.12);
      noise(ctx, out, t, { filter: 'highpass', freq: 2800, q: 0.7, dur: 0.035, gain: 0.35 });
      bell(ctx, out, t, 1650 * p, 0.38, 0.08, BLADE);
      noise(ctx, out, t + 0.01, { filter: 'bandpass', freq: 5200 * p, q: 3, dur: 0.12, gain: 0.08 });
    },
  },
  arrowShot: {
    dur: 0.35, max: 4, cooldown: 0.04, priority: 2,
    play(ctx, out, t, r) {
      const p = vary(r, 0.08);
      pluck(ctx, out, t, 47 + Math.round(r() * 3), 0.3, 'twang', 0.3);
      noise(ctx, out, t + 0.02, { filter: 'bandpass', freq: 2600 * p, to: 1100 * p, q: 2.5, dur: 0.22, gain: 0.18, attack: 0.03, curve: 'lin' });
    },
  },
  arrowHit: {
    dur: 0.15, max: 4, cooldown: 0.04, priority: 1,
    play(ctx, out, t, r) {
      const p = vary(r, 0.1);
      tone(ctx, out, t, { freq: 240 * p, to: 95, glide: 0.05, dur: 0.07, gain: 0.32 });
      noise(ctx, out, t, { filter: 'lowpass', freq: 1400 * p, q: 0.8, dur: 0.05, gain: 0.25 });
    },
  },
  ballista: {
    dur: 0.6, max: 2, cooldown: 0.12, priority: 2,
    play(ctx, out, t, r) {
      const p = vary(r, 0.05);
      // heavy string, wooden frame, arrow flight
      pluck(ctx, out, t, 38, 0.4, 'twang', 0.45);
      tone(ctx, out, t, { freq: 140 * p, to: 70, glide: 0.08, dur: 0.15, gain: 0.4 });
      noise(ctx, out, t, { filter: 'bandpass', freq: 800, q: 2, dur: 0.06, gain: 0.3 });
      noise(ctx, out, t + 0.05, { filter: 'bandpass', freq: 1800 * p, to: 700, q: 2, dur: 0.35, gain: 0.16, attack: 0.05, curve: 'lin' });
    },
  },
  cannon: {
    dur: 1.6, max: 2, cooldown: 0.15, priority: 3,
    play(ctx, out, t, r) {
      const p = vary(r, 0.06);
      noise(ctx, out, t, { filter: 'highpass', freq: 1800, dur: 0.03, gain: 0.35 });
      tone(ctx, out, t, { freq: 95 * p, to: 32, glide: 0.5, dur: 0.9, gain: 0.5 });
      noise(ctx, out, t, { filter: 'lowpass', freq: 1200 * p, to: 90, q: 0.6, dur: 1.4, gain: 0.5, brown: true });
      noise(ctx, out, t, { filter: 'lowpass', freq: 600, q: 0.5, dur: 0.6, gain: 0.28 });
    },
  },
  explosion: {
    dur: 2, max: 2, cooldown: 0.15, priority: 3,
    play(ctx, out, t, r) {
      const p = vary(r, 0.06);
      noise(ctx, out, t, { filter: 'lowpass', freq: 2200 * p, to: 110, q: 0.5, dur: 1.7, gain: 0.7 });
      noise(ctx, out, t, { filter: 'lowpass', freq: 500, to: 60, q: 0.7, dur: 1.9, gain: 0.6, brown: true });
      tone(ctx, out, t, { freq: 75 * p, to: 28, glide: 0.7, dur: 1.1, gain: 0.6 });
      // debris clattering down
      for (let i = 0; i < 6; i++) {
        noise(ctx, out, t + 0.25 + r() * 0.9, { filter: 'bandpass', freq: 1200 + r() * 2500, q: 2, dur: 0.04, gain: 0.08 + r() * 0.06 });
      }
    },
  },
  death: {
    dur: 0.6, max: 3, cooldown: 0.08, priority: 2,
    play(ctx, out, t, r) {
      const p = vary(r, 0.1);
      // collapsing: dull fall, armour rattles briefly – deliberately not drastic
      tone(ctx, out, t, { freq: 150 * p, to: 70, glide: 0.12, dur: 0.18, gain: 0.4 });
      noise(ctx, out, t + 0.02, { filter: 'lowpass', freq: 900 * p, q: 0.7, dur: 0.22, gain: 0.3 });
      for (let i = 0; i < 2; i++) bell(ctx, out, t + 0.12 + i * 0.07 + r() * 0.03, 1500 * vary(r, 0.15), 0.1, 0.03, BLADE);
    },
  },
  heroDown: {
    dur: 1.6, max: 1, cooldown: 1, priority: 3, bus: 'ui',
    play(ctx, out, t) {
      // sad falling lute figure
      [69, 67, 65, 64].forEach((m, i) => pluck(ctx, out, t + i * 0.22, m, 0.28, 'lute', 1));
    },
  },
  buildingCrash: {
    dur: 2.4, max: 1, cooldown: 0.4, priority: 3,
    play(ctx, out, t, r) {
      // beams break, walls rumble, dust
      noise(ctx, out, t, { filter: 'lowpass', freq: 1400, to: 120, q: 0.5, dur: 2.1, gain: 0.5, brown: true, attack: 0.05 });
      tone(ctx, out, t, { freq: 62, to: 30, glide: 1.2, dur: 1.4, gain: 0.45, attack: 0.03 });
      for (let i = 0; i < 7; i++) {
        const dt = i * 0.18 + r() * 0.12;
        noise(ctx, out, t + dt, { filter: 'bandpass', freq: 500 + r() * 1300, q: 2.5, dur: 0.07 + r() * 0.05, gain: 0.25 + r() * 0.12 });
        if (i % 2 === 0) tone(ctx, out, t + dt, { freq: 160 + r() * 120, to: 80, glide: 0.06, dur: 0.1, gain: 0.2 });
      }
    },
  },
  recruited: {
    dur: 1.1, max: 1, cooldown: 0.4, priority: 2, bus: 'ui',
    play(ctx, out, t) {
      // short horn call
      recorder(ctx, out, t, 62, 0.22, 0.9);
      recorder(ctx, out, t + 0.22, 69, 0.6, 1);
      tone(ctx, out, t, { type: 'triangle', freq: 146.8, dur: 0.85, gain: 0.08, attack: 0.04 });
    },
  },
  thunder: {
    dur: 4, max: 1, cooldown: 6, priority: 2, bus: 'ambient',
    play(ctx, out, t, r) {
      noise(ctx, out, t, { filter: 'lowpass', freq: 400 * vary(r, 0.2), to: 60, q: 0.4, dur: 3.6, gain: 0.55, brown: true, attack: 0.25 });
      noise(ctx, out, t + 0.1, { filter: 'lowpass', freq: 900, to: 150, q: 0.5, dur: 1.2, gain: 0.25, brown: true, attack: 0.05 });
    },
  },

  // ---------- Hero abilities ----------
  whirl: {
    dur: 1, max: 1, cooldown: 0.3, priority: 3,
    play(ctx, out, t) {
      // two blade swings in a circle
      for (let i = 0; i < 2; i++) {
        noise(ctx, out, t + i * 0.32, { filter: 'bandpass', freq: 500, to: 2600, q: 4, dur: 0.32, gain: 0.32, attack: 0.12, curve: 'lin' });
      }
      bell(ctx, out, t + 0.6, 1500, 0.4, 0.07, BLADE);
    },
  },
  might: {
    dur: 1.4, max: 1, cooldown: 0.3, priority: 3,
    play(ctx, out, t) {
      // aura of strength: deep drum beat + rising fifth chime
      tone(ctx, out, t, { freq: 110, to: 55, glide: 0.2, dur: 0.5, gain: 0.5 });
      recorder(ctx, out, t + 0.1, 57, 0.9, 0.8);
      recorder(ctx, out, t + 0.1, 64, 0.9, 0.7);
    },
  },
  heal: {
    dur: 1.8, max: 1, cooldown: 0.3, priority: 3,
    play(ctx, out, t) {
      // shimmering sine arpeggios upwards
      [76, 79, 83, 86, 88, 91].forEach((m, i) => {
        const f = 440 * Math.pow(2, (m - 69) / 12);
        tone(ctx, out, t + i * 0.09, { freq: f, dur: 1.1 - i * 0.08, gain: 0.09, attack: 0.03 });
        tone(ctx, out, t + i * 0.09, { freq: f * 2.003, dur: 0.6, gain: 0.03, attack: 0.03 });
      });
      noise(ctx, out, t, { filter: 'highpass', freq: 6000, dur: 1.2, gain: 0.03, attack: 0.3 });
    },
  },
  trap: {
    dur: 0.6, max: 1, cooldown: 0.3, priority: 3,
    play(ctx, out, t) {
      // trap is set: ratcheting + clicking into place
      for (let i = 0; i < 4; i++) noise(ctx, out, t + i * 0.06, { filter: 'bandpass', freq: 2200, q: 4, dur: 0.02, gain: 0.25 });
      tone(ctx, out, t + 0.3, { freq: 520, to: 260, glide: 0.04, dur: 0.08, gain: 0.35 });
      bell(ctx, out, t + 0.3, 1900, 0.2, 0.05, STONE_TINK);
    },
  },
  fuse: {
    dur: 1.8, max: 2, cooldown: 0.3, priority: 3,
    play(ctx, out, t, r) {
      // fuse hisses (irregular crackling)
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 4200; hp.Q.value = 0.9;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      let tt = t;
      while (tt < t + 1.7) {
        g.gain.linearRampToValueAtTime(0.05 + r() * 0.12, tt + 0.02);
        tt += 0.03 + r() * 0.05;
      }
      g.gain.linearRampToValueAtTime(0, t + 1.8);
      src.connect(hp).connect(lp).connect(g).connect(out);
      src.start(t); src.stop(t + 1.85);
    },
  },
  turret: {
    dur: 0.8, max: 1, cooldown: 0.3, priority: 3,
    play(ctx, out, t) {
      // cannon set up: metallic clack
      for (let i = 0; i < 3; i++) {
        tone(ctx, out, t + i * 0.13, { freq: 300 - i * 30, to: 160, glide: 0.04, dur: 0.07, gain: 0.3 });
        bell(ctx, out, t + i * 0.13, 1100 + i * 90, 0.18, 0.06, STONE_TINK);
      }
    },
  },

  // ---------- UI (global) ----------
  click: {
    dur: 0.08, max: 2, cooldown: 0.03, priority: 4, bus: 'ui',
    play(ctx, out, t, r) {
      // soft wooden click
      tone(ctx, out, t, { type: 'triangle', freq: 1250 * vary(r, 0.03), to: 850, glide: 0.03, dur: 0.045, gain: 0.22 });
      noise(ctx, out, t, { filter: 'bandpass', freq: 3000, q: 2, dur: 0.012, gain: 0.08 });
    },
  },
  hover: {
    dur: 0.05, max: 1, cooldown: 0.07, priority: 0, bus: 'ui',
    play(ctx, out, t) {
      tone(ctx, out, t, { type: 'sine', freq: 1900, dur: 0.03, gain: 0.04 });
    },
  },
  confirm: {
    dur: 0.35, max: 1, cooldown: 0.08, priority: 4, bus: 'ui',
    play(ctx, out, t) {
      pluck(ctx, out, t, 72, 0.3, 'harp', 0.4);
      pluck(ctx, out, t + 0.08, 79, 0.3, 'harp', 0.4);
    },
  },
  error: {
    dur: 0.35, max: 1, cooldown: 0.25, priority: 4, bus: 'ui',
    play(ctx, out, t) {
      // two deep, muffled tones downwards (no shrill beep)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(out);
      tone(ctx, lp, t, { type: 'square', freq: 311, dur: 0.11, gain: 0.12, attack: 0.008 });
      tone(ctx, lp, t + 0.12, { type: 'square', freq: 233, dur: 0.18, gain: 0.12, attack: 0.008 });
    },
  },
  notify: {
    dur: 1.2, max: 1, cooldown: 0.5, priority: 3, bus: 'ui',
    play(ctx, out, t) {
      bell(ctx, out, t, 880, 0.9, 0.1, CHIME);
      bell(ctx, out, t + 0.16, 1174.7, 1, 0.1, CHIME);
    },
  },
  open: {
    dur: 0.25, max: 1, cooldown: 0.1, priority: 2, bus: 'ui',
    play(ctx, out, t) {
      // parchment/menu opening: short rustle
      noise(ctx, out, t, { filter: 'bandpass', freq: 1600, to: 3000, q: 1.4, dur: 0.15, gain: 0.1, attack: 0.03, curve: 'lin' });
    },
  },
};

/** Bird call (ambience): short trills with frequency jumps, kind 0…2. */
export function birdCall(ctx, out, t, r, kind = 0, gain = 0.06) {
  const base = [2900, 3600, 2300][kind] * (1 + (r() - 0.5) * 0.1);
  const notes = kind === 0 ? 3 + Math.floor(r() * 3) : kind === 1 ? 2 : 4 + Math.floor(r() * 4);
  let tt = t;
  for (let i = 0; i < notes; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const len = kind === 2 ? 0.04 : 0.07 + r() * 0.05;
    const f0 = base * (kind === 1 ? (i ? 0.8 : 1.15) : 1 + (r() - 0.5) * 0.25);
    osc.frequency.setValueAtTime(f0, tt);
    osc.frequency.exponentialRampToValueAtTime(f0 * (kind === 1 ? 0.85 : 1.25), tt + len);
    envelope(g.gain, tt, gain, 0.008, len, 'lin');
    osc.connect(g).connect(out);
    osc.start(tt); osc.stop(tt + len + 0.02);
    tt += len + (kind === 2 ? 0.02 : 0.03 + r() * 0.05);
  }
  return tt;
}

/** Raindrop on leaf/roof (ambience). */
export function droplet(ctx, out, t, r, gain = 0.05) {
  const f = 1800 + r() * 2600;
  tone(ctx, out, t, { freq: f, to: f * 1.4, glide: 0.02, dur: 0.03, gain });
}

/** Distant battle noise: a single muffled clang (ambience "battle"). */
export function distantClash(ctx, out, t, r, gain = 0.05) {
  bell(ctx, out, t, 1300 + r() * 900, 0.25, gain, BLADE);
}

/** Names of all effects (for docs, tests, check script). */
export const SFX_NAMES = Object.keys(SFX);
