// Generative music, purely computational: from composed melodies, chord progressions and accompaniment patterns
// come note events { beat, dur, inst, midi, vel } for one section (8 bars) at a time.
// Same seed + same section = same notes (testable). Light variation: passing tones,
// neighbour tones, ornaments, changing accompaniment patterns and instrumentation per section.

import { mulberry32, mixSeed } from './rng.js';

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

/** Scale degree (0 = root, 7 = octave, negative = below) of a key → MIDI. */
export function degreeToMidi(root, mode, deg) {
  const s = MODES[mode];
  const o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return root + 12 * o + s[i];
}

/** @typedef {[number, number]} Note  [degree, duration in beats] */
/** @typedef {{ chords: number[], bars: Note[][] }} Melody */
/**
 * @typedef {Object} Theme
 * @property {string} name
 * @property {keyof MODES} mode
 * @property {number} root MIDI root of the melody
 * @property {number} bpm
 * @property {number} beatsPerBar
 * @property {Record<string, Melody>} melodies
 * @property {string[]} form section sequence: melody name, name+'2' (varied more), 'intro', 'rest'
 * @property {'arp3'|'arp4'|'ostinato'} accomp
 * @property {string} lead melody instrument
 * @property {boolean} [drums]
 * @property {boolean} [harpArps] harp arpeggios as accompaniment (menu)
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Calm build theme: D Dorian, 3/4, lute + recorder + drone
  build: {
    name: 'Feldweg', mode: 'dorian', root: 62, bpm: 84, beatsPerBar: 3, accomp: 'arp3', lead: 'recorder',
    form: ['intro', 'A', 'A2', 'B', 'A', 'rest', 'B2', 'A2'],
    melodies: {
      A: {
        chords: [0, 0, 6, 6, 0, 3, 6, 0],
        bars: [
          [[7, 1], [6, 0.5], [4, 0.5], [3, 1]],
          [[4, 2], [2, 1]],
          [[6, 1.5], [5, 0.5], [4, 1]],
          [[3, 2], [1, 1]],
          [[2, 1], [4, 1], [7, 1]],
          [[8, 1], [7, 0.5], [5, 0.5], [3, 1]],
          [[4, 1], [6, 1], [5, 0.5], [4, 0.5]],
          [[4, 1], [7, 2]],
        ],
      },
      B: {
        chords: [3, 3, 0, 0, 6, 6, 4, 0],
        bars: [
          [[3, 1], [5, 1], [7, 1]],
          [[8, 1.5], [7, 0.5], [5, 1]],
          [[7, 2], [4, 1]],
          [[5, 1], [4, 1], [2, 1]],
          [[6, 1], [4, 0.5], [5, 0.5], [6, 1]],
          [[8, 1.5], [7, 0.5], [6, 1]],
          [[4, 1.5], [5, 0.5], [6, 1]],
          [[4, 1], [2, 1], [0, 1]],
        ],
      },
    },
  },
  // Combat theme: A Aeolian, 4/4, driving lute ostinato, frame drum
  battle: {
    name: 'Sturm', mode: 'aeolian', root: 69, bpm: 116, beatsPerBar: 4, accomp: 'ostinato', lead: 'shawm', drums: true,
    form: ['intro', 'A', 'B', 'A2', 'B2'],
    melodies: {
      A: {
        chords: [0, 6, 5, 6, 0, 5, 3, 0],
        bars: [
          [[4, 1], [4, 0.5], [3, 0.5], [4, 1], [7, 1]],
          [[6, 1.5], [4, 0.5], [3, 1], [1, 1]],
          [[2, 1], [3, 0.5], [4, 0.5], [5, 1], [4, 1]],
          [[3, 1.5], [4, 0.5], [6, 2]],
          [[7, 1], [6, 0.5], [7, 0.5], [4, 2]],
          [[5, 1], [4, 0.5], [3, 0.5], [2, 1], [0, 1]],
          [[3, 1], [2, 0.5], [3, 0.5], [5, 1], [3, 1]],
          [[4, 1], [2, 1], [0, 2]],
        ],
      },
      B: {
        chords: [0, 0, 5, 6, 0, 0, 5, 6],
        bars: [
          [[0, 0.5], [0, 0.5], [2, 0.5], [4, 0.5], [7, 1], [4, 1]],
          [[6, 0.5], [7, 0.5], [6, 0.5], [4, 0.5], [3, 2]],
          [[5, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 1], [0, 1]],
          [[1, 1], [3, 1], [6, 2]],
          [[0, 0.5], [0, 0.5], [2, 0.5], [4, 0.5], [7, 1], [4, 1]],
          [[9, 1], [8, 0.5], [7, 0.5], [6, 2]],
          [[5, 1], [4, 1], [3, 1], [1, 1]],
          [[3, 1], [1, 1], [-1, 2]],
        ],
      },
    },
  },
  // Menu: G Mixolydian, 3/4, harp + recorder, solemn and calm
  menu: {
    name: 'Krone', mode: 'mixolydian', root: 67, bpm: 66, beatsPerBar: 3, accomp: 'arp3', lead: 'recorder', harpArps: true,
    form: ['intro', 'A', 'B', 'A2', 'rest'],
    melodies: {
      A: {
        chords: [0, 6, 0, 3, 0, 6, 3, 0],
        bars: [
          [[4, 2], [2, 1]],
          [[6, 1], [5, 1], [3, 1]],
          [[4, 3]],
          [[5, 1], [4, 0.5], [3, 0.5], [2, 1]],
          [[2, 1], [4, 1], [7, 1]],
          [[8, 1.5], [7, 0.5], [6, 1]],
          [[5, 1], [3, 1], [4, 1]],
          [[2, 1], [0, 2]],
        ],
      },
      B: {
        chords: [3, 0, 6, 0, 3, 6, 4, 0],
        bars: [
          [[3, 1], [5, 1], [7, 1]],
          [[7, 1.5], [6, 0.5], [4, 1]],
          [[6, 1], [5, 0.5], [3, 0.5], [1, 1]],
          [[2, 3]],
          [[5, 1], [4, 0.5], [3, 0.5], [5, 1]],
          [[8, 2], [6, 1]],
          [[4, 1], [6, 1], [5, 1]],
          [[4, 1], [2, 1], [0, 1]],
        ],
      },
    },
  },
};

/** Short signal melodies (victory, defeat) as fixed event lists. */
export const JINGLES = {
  victory: {
    bpm: 104, mode: 'ionian', root: 67,
    notes: [[0, 0.5], [2, 0.5], [4, 0.5], [7, 1.5], [6, 0.5], [7, 2]],
    chords: [[0, 0], [7, 4], [-3, 4]],
  },
  defeat: {
    bpm: 60, mode: 'aeolian', root: 64,
    notes: [[4, 1], [3, 1], [2, 1], [1, 0.5], [0, 2.5]],
    chords: [[0, 0], [5, 2], [0, 4]],
  },
};

/** Triad (degrees) over a chord degree of the key. */
const triad = (r) => [r, r + 2, r + 4];

/** Total length of a bar in beats. */
export const barLength = (bar) => bar.reduce((s, n) => s + n[1], 0);

/**
 * Vary a melody (deterministic via rnd). Bar lengths are preserved,
 * the last bar of each four-bar phrase stays unchanged (cadence).
 * @param {Note[][]} bars @param {() => number} rnd @param {number} amount 0…1
 * @returns {Note[][]}
 */
export function varyMelody(bars, rnd, amount) {
  return bars.map((bar, bi) => {
    if (bi % 4 === 3) return bar.map((n) => [n[0], n[1]]);
    let out = bar.map((n) => [n[0], n[1]]);
    // Passing tone: split a long note, the second half leads stepwise to the next note
    if (rnd() < 0.35 * amount) {
      const k = out.findIndex((n) => n[1] >= 1);
      if (k >= 0) {
        const next = out[k + 1]?.[0] ?? bars[bi + 1]?.[0]?.[0] ?? out[k][0];
        const dir = Math.sign(next - out[k][0]) || (rnd() < 0.5 ? 1 : -1);
        const half = out[k][1] / 2;
        out.splice(k, 1, [out[k][0], half], [out[k][0] + dir, half]);
      }
    }
    // Neighbour tone: shift an inner note by one degree
    if (rnd() < 0.25 * amount && out.length > 2) {
      const k = 1 + Math.floor(rnd() * (out.length - 2));
      out[k] = [out[k][0] + (rnd() < 0.5 ? 1 : -1), out[k][1]];
    }
    // Rhythmic variant: dotted ↔ straight
    if (rnd() < 0.2 * amount) {
      const k = out.findIndex((n, i) => i < out.length - 1 && n[1] === 1.5 && out[i + 1][1] === 0.5);
      if (k >= 0) { out[k] = [out[k][0], 1]; out[k + 1] = [out[k + 1][0], 1]; }
    }
    return out;
  });
}

/** Instrument ranges (MIDI) into which accompaniment and melody are clamped. */
export const RANGES = { recorder: [60, 93], shawm: [57, 88], lute: [40, 76], harp: [48, 96], drone: [26, 57] };

/**
 * Generate the notes of a section.
 * @param {string} themeName
 * @param {number} section running number (0, 1, 2, …)
 * @param {number} seed
 * @param {{ lite?: boolean }} [opts] lite: fewer voices (mobile)
 * @returns {{ events: {beat:number,dur:number,inst:string,midi:number,vel:number}[], beats: number, bpm: number, part: string }}
 */
export function composeSection(themeName, section, seed, opts = {}) {
  const th = THEMES[themeName];
  if (!th) throw new Error(`Unknown music theme: ${themeName}`);
  const rnd = mulberry32(mixSeed(seed, section * 7919 + themeName.length));
  const part = th.form[section % th.form.length];
  const cycle = Math.floor(section / th.form.length);
  const base = part.replace(/2$/, '');
  const mel = th.melodies[base] ?? th.melodies.A;
  const strong = part.endsWith('2');
  const bpb = th.beatsPerBar;
  const deg = (d) => degreeToMidi(th.root, th.mode, d);
  /** @type {{beat:number,dur:number,inst:string,midi:number,vel:number}[]} */
  const ev = [];
  const add = (beat, dur, inst, midi, vel) => {
    const [lo, hi] = RANGES[inst] ?? [0, 127];
    while (midi < lo) midi += 12;
    while (midi > hi) midi -= 12;
    ev.push({ beat: Math.round(beat * 1000) / 1000, dur, inst, midi, vel: Math.round(Math.max(0.05, Math.min(1, vel)) * 1000) / 1000 });
  };
  const hum = () => (rnd() - 0.5) * 0.12;

  // Melody
  const hasMelody = part !== 'intro' && part !== 'rest';
  if (hasMelody) {
    const amount = (strong ? 0.9 : 0.35) + Math.min(0.3, cycle * 0.1);
    const bars = varyMelody(mel.bars, rnd, amount);
    bars.forEach((bar, bi) => {
      let b = bi * bpb;
      for (const [d, dur] of bar) {
        const accent = Math.abs(b - Math.round(b / bpb) * bpb) < 1e-6 ? 0.1 : 0;
        // ornament: short grace note from above before long notes (in strongly varied sections)
        if (strong && dur >= 1.5 && rnd() < 0.3 && b > 0) add(b - 0.12, 0.12, th.lead, deg(d + 1), 0.45);
        add(b, dur, th.lead, deg(d), 0.62 + accent + hum());
        b += dur;
      }
    });
  }

  // Drone: root + fifth, re-triggered every four bars
  for (let b = 0; b < 8; b += 4) {
    add(b * bpb, 4 * bpb, 'drone', th.root - 24, 0.5);
    if (!opts.lite) add(b * bpb, 4 * bpb, 'drone', th.root - 17, 0.34);
  }

  // Accompaniment per bar
  const patterns3 = [[0, 1, 2, 3, 2, 1], [0, 2, 3, 2, 1, 2], [0, 2, 1, 3, 2, 1]];
  const pat = patterns3[(section + cycle) % patterns3.length];
  for (let bi = 0; bi < 8; bi++) {
    const chord = triad(mel.chords[bi]);
    const tones = [deg(chord[0]) - 24, deg(chord[1]) - 12, deg(chord[2]) - 12, deg(chord[0]) - 12];
    const t0 = bi * bpb;
    if (th.accomp === 'arp3') {
      const sparse = part === 'rest' && bi % 2 === 1;
      for (let i = 0; i < bpb * 2; i++) {
        if (sparse && i % 2 === 1) continue;
        const v = (i === 0 ? 0.62 : 0.4) + hum();
        add(t0 + i * 0.5, 0.5, 'lute', tones[pat[i % pat.length]], th.harpArps ? v * 0.6 : v);
      }
    } else if (th.accomp === 'ostinato') {
      const ost = [0, 0, 2, 0, 3, 0, 2, 1];
      for (let i = 0; i < bpb * 2; i++) add(t0 + i * 0.5, 0.5, 'lute', tones[ost[i % 8]], (i % 2 === 0 ? 0.58 : 0.4) + hum());
    }
    // Harp: broken chord at the start of the bar (menu), otherwise only at phrase ends and in quiet parts
    const harpBar = th.harpArps ? true : (part === 'rest' || part === 'intro') ? bi % 2 === 0 : bi === 7 && rnd() < 0.6;
    if (harpBar && !(opts.lite && !th.harpArps && bi % 4 !== 0)) {
      const up = [chord[0], chord[1], chord[2], chord[0] + 7];
      up.forEach((d, i) => add(t0 + i * 0.16, bpb - i * 0.16, 'harp', deg(d) + (th.harpArps ? 0 : 12), 0.36 - i * 0.03 + hum() * 0.5));
    }
  }

  // Drums (combat): basic pattern, roll in the last bar of each phrase
  if (th.drums) {
    for (let bi = 0; bi < 8; bi++) {
      const t0 = bi * bpb;
      const fill = bi % 4 === 3;
      const hits = fill ? [[0, 'low'], [1, 'low'], [2, 'high'], [2.5, 'high'], [3, 'low'], [3.25, 'high'], [3.5, 'high'], [3.75, 'high']]
        : [[0, 'low'], [1.5, 'low'], [2, 'high'], [3, 'low'], [3.5, 'high']];
      for (const [b, kind] of hits) add(t0 + b, 0.25, 'drum', kind === 'low' ? 45 : 52, (kind === 'low' ? 0.8 : 0.5) + hum());
    }
  }

  ev.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  return { events: ev, beats: 8 * bpb, bpm: th.bpm, part };
}

/** Victory or defeat melody as an event list. */
export function composeJingle(name) {
  const j = JINGLES[name];
  const ev = [];
  let b = 0;
  for (const [d, dur] of j.notes) { ev.push({ beat: b, dur, inst: name === 'victory' ? 'shawm' : 'recorder', midi: degreeToMidi(j.root, j.mode, d), vel: 0.7 }); b += dur; }
  for (const [d, at] of j.chords) {
    for (const k of [0, 2, 4]) ev.push({ beat: at, dur: 2.5, inst: 'harp', midi: degreeToMidi(j.root - 12, j.mode, d + k), vel: 0.45 });
  }
  ev.push({ beat: 0, dur: b + 1, inst: 'drone', midi: j.root - 24, vel: 0.4 });
  return { events: ev.sort((a, c) => a.beat - c.beat), beats: b + 1, bpm: j.bpm };
}
