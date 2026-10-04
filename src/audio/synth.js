// Building blocks of sound synthesis with the Web Audio API: noise buffers, envelopes, tones, filtered
// noise, bells, plucked strings (Karplus-Strong) and reverb. All functions work with any
// BaseAudioContext – also with OfflineAudioContext (analysis in scripts/audio-check.html).

import { karplusStrong, midiToFreq } from './karplus.js';
import { mulberry32 } from './rng.js';

/** Cache buffers per context. @type {WeakMap<BaseAudioContext, Map<string, AudioBuffer>>} */
const cache = new WeakMap();
function cached(ctx, key, make) {
  let m = cache.get(ctx);
  if (!m) { m = new Map(); cache.set(ctx, m); }
  let b = m.get(key);
  if (!b) { b = make(); m.set(key, b); }
  return b;
}

/** White noise (2 s, mono), once per context. */
export function noiseBuffer(ctx) {
  return cached(ctx, 'noise', () => {
    const len = Math.floor(ctx.sampleRate * 2);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0), r = mulberry32(12345);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    return b;
  });
}

/** Brown (deep, soft) noise for wind and water. */
export function brownNoiseBuffer(ctx) {
  return cached(ctx, 'brown', () => {
    const len = Math.floor(ctx.sampleRate * 4);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0), r = mulberry32(777);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    // Loop seamlessly: cross-fade start and end
    const x = Math.floor(ctx.sampleRate * 0.1);
    for (let i = 0; i < x; i++) { const t = i / x; d[len - x + i] = d[len - x + i] * (1 - t) + d[i] * t; }
    return b;
  });
}

/**
 * Plucked string as a buffer (cached per pitch and timbre).
 * @param {'lute'|'harp'|'twang'} kind
 */
export function pluckBuffer(ctx, midi, kind = 'lute') {
  const m = Math.round(midi);
  return cached(ctx, `ks:${kind}:${m}`, () => {
    const o = kind === 'harp' ? { t60: 2.6, brightness: 0.4, body: 0.45, seed: m * 3 + 1 }
      : kind === 'twang' ? { t60: 0.35, brightness: 0.9, body: 0.1, seed: m }
      : { t60: 1.5, brightness: 0.55, body: 0.25, seed: m * 7 + 3 };
    const secs = kind === 'harp' ? 3 : kind === 'twang' ? 0.5 : 2;
    const { data, rate } = karplusStrong(midiToFreq(m), ctx.sampleRate, secs, o);
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    // Fine tuning via the playback rate (integer delay length)
    /** @type {any} */ (b).ksRate = rate;
    return b;
  });
}

/** Reverb impulse response: decaying stereo noise, damped towards the top. */
export function reverbImpulse(ctx, seconds = 1.8, decay = 3) {
  return cached(ctx, `ir:${seconds}:${decay}`, () => {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c), r = mulberry32(99 + c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // the later, the darker (low-pass narrows)
        const k = 0.6 - 0.5 * t;
        lp += k * ((r() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.008 ? i / (ctx.sampleRate * 0.008) : 1);
      }
    }
    return b;
  });
}

/**
 * Reverb effect: convolver (desktop) or two cheap delays with feedback (mobile).
 * @returns {{ input: AudioNode, output: AudioNode }}
 */
export function createReverb(ctx, lite = false) {
  const input = ctx.createGain(), output = ctx.createGain();
  if (!lite) {
    const conv = ctx.createConvolver();
    conv.buffer = reverbImpulse(ctx);
    input.connect(conv).connect(output);
  } else {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    input.connect(lp);
    for (const [t, fb] of [[0.083, 0.38], [0.131, 0.32]]) {
      const d = ctx.createDelay(1); d.delayTime.value = t;
      const g = ctx.createGain(); g.gain.value = fb;
      lp.connect(d); d.connect(g); g.connect(d); d.connect(output);
    }
  }
  return { input, output };
}

/** Envelope: rise to peak, then exponential decay until t+dur; silent afterwards. */
export function envelope(param, t, peak, attack, dur, curve = 'exp') {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  if (curve === 'exp') {
    param.setTargetAtTime(0, t + attack, Math.max(0.005, (dur - attack) / 4.5));
  } else {
    param.linearRampToValueAtTime(0, t + dur);
  }
}

/**
 * Tone with oscillator. Returns the end time.
 * @param {{ type?: OscillatorType, freq: number, to?: number, glide?: number, dur: number, attack?: number, gain?: number, detune?: number, curve?: 'exp'|'lin' }} o
 */
export function tone(ctx, out, t, o) {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  envelope(g.gain, t, o.gain ?? 0.5, o.attack ?? 0.004, o.dur, o.curve);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
  return t + o.dur;
}

/**
 * Filtered noise.
 * @param {{ filter?: BiquadFilterType, freq: number, to?: number, q?: number, dur: number, attack?: number, gain?: number, brown?: boolean, curve?: 'exp'|'lin', offset?: number }} o
 */
export function noise(ctx, out, t, o) {
  const src = ctx.createBufferSource();
  src.buffer = o.brown ? brownNoiseBuffer(ctx) : noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  envelope(g.gain, t, o.gain ?? 0.5, o.attack ?? 0.002, o.dur, o.curve);
  src.connect(f).connect(g).connect(out);
  src.start(t, o.offset ?? 0);
  src.stop(t + o.dur + 0.05);
  return t + o.dur;
}

/**
 * Bell / metal: sum of inharmonic partials, each with its own decay.
 * @param {number[][]} partials [frequency factor, level, decay factor]
 */
export function bell(ctx, out, t, freq, dur, gain, partials) {
  for (const [ratio, lvl, dk] of partials) {
    tone(ctx, out, t, { freq: freq * ratio, dur: dur * (dk ?? 1), gain: gain * lvl, attack: 0.002 });
  }
  return t + dur;
}

/** Play a plucked string. */
export function pluck(ctx, out, t, midi, gain, kind = 'lute', dur = 2) {
  const b = pluckBuffer(ctx, midi, kind);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = /** @type {any} */ (b).ksRate ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.setValueAtTime(gain, t + Math.max(0.05, dur - 0.08));
  g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(g).connect(out);
  s.start(t);
  s.stop(t + Math.min(dur, b.duration) + 0.02);
  return t + dur;
}

// ---------- Music instruments ----------

/** Recorder: triangle + quiet sine overtone, delayed vibrato, breath noise at the onset. */
export function recorder(ctx, out, t, midi, dur, vel) {
  const f = midiToFreq(midi);
  const len = Math.max(0.12, dur * 0.95);
  const g = ctx.createGain();
  const peak = 0.17 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.045);
  g.gain.setTargetAtTime(peak * 0.8, t + 0.06, 0.15);
  g.gain.setTargetAtTime(0, t + len - 0.04, 0.03);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 5); lp.Q.value = 0.3;
  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  // Vibrato only sets in on longer notes
  if (dur > 0.45) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + 0.25);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.6);
    lfo.connect(depth); depth.connect(o1.frequency); depth.connect(o2.frequency);
    lfo.start(t); lfo.stop(t + len + 0.1);
  }
  o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
  o1.start(t); o2.start(t); o1.stop(t + len + 0.15); o2.stop(t + len + 0.15);
  // blowing noise
  noise(ctx, out, t, { filter: 'bandpass', freq: f * 2.5, q: 1.5, dur: 0.07, gain: 0.03 * vel, attack: 0.01 });
}

/** Shawm (battle theme): nasal but damped square/sawtooth mix through formant filters. */
export function shawm(ctx, out, t, midi, dur, vel) {
  const f = midiToFreq(midi);
  const len = Math.max(0.1, dur * 0.92);
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f; o2.detune.value = 5;
  const m2 = ctx.createGain(); m2.gain.value = 0.4;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const g = ctx.createGain();
  const peak = 0.11 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);
  g.gain.setTargetAtTime(peak * 0.75, t + 0.05, 0.1);
  g.gain.setTargetAtTime(0, t + len - 0.03, 0.025);
  if (dur > 0.5) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.8;
    const depth = ctx.createGain(); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.005, t + 0.5);
    lfo.connect(depth); depth.connect(o1.frequency); depth.connect(o2.frequency);
    lfo.start(t); lfo.stop(t + len + 0.1);
  }
  o1.connect(bp); o2.connect(m2).connect(bp); bp.connect(lp).connect(g).connect(out);
  o1.start(t); o2.start(t); o1.stop(t + len + 0.12); o2.stop(t + len + 0.12);
}

/** Drone (hurdy-gurdy-like): two slightly detuned sawtooths, heavily low-passed, soft fade in/out. */
export function drone(ctx, out, t, midi, dur, vel) {
  const f = midiToFreq(midi);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(900, f * 4); lp.Q.value = 0.5;
  const g = ctx.createGain();
  const peak = 0.07 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.min(1.2, dur * 0.3));
  g.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 1));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.2);
  for (const det of [-6, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.3);
  }
  lp.connect(g).connect(out);
}

/** Frame drum. midi < 48 = low hit in the middle, otherwise bright rim hit. */
export function frameDrum(ctx, out, t, midi, vel) {
  const low = midi < 48;
  tone(ctx, out, t, { freq: low ? 115 : 230, to: low ? 58 : 150, glide: 0.12, dur: low ? 0.35 : 0.15, gain: (low ? 0.42 : 0.16) * vel });
  noise(ctx, out, t, { filter: low ? 'lowpass' : 'bandpass', freq: low ? 600 : 2400, q: low ? 0.7 : 1.2, dur: low ? 0.08 : 0.06, gain: (low ? 0.12 : 0.13) * vel });
}

/**
 * Schedule the note events of a section from t0.
 * @param {{beat:number,dur:number,inst:string,midi:number,vel:number}[]} events
 * @param {{ dry: AudioNode, wet?: AudioNode }} out
 * @param {(e:any)=>boolean} [filter] only certain events (for look-ahead scheduling in chunks)
 */
export function scheduleNotes(ctx, out, events, t0, bpm, filter) {
  const spb = 60 / bpm;
  for (const e of events) {
    if (filter && !filter(e)) continue;
    const t = t0 + e.beat * spb, d = e.dur * spb;
    playNote(ctx, out, t, e.inst, e.midi, d, e.vel);
  }
}

/** Play one note with the matching instrument (melody with a reverb share). */
export function playNote(ctx, out, t, inst, midi, d, vel) {
  // Melody and harp get a reverb share: one node splits into dry and reverb
  const send = (amount) => {
    if (!out.wet) return out.dry;
    const s = ctx.createGain();
    const w = ctx.createGain(); w.gain.value = amount;
    s.connect(out.dry); s.connect(w).connect(out.wet);
    return s;
  };
  switch (inst) {
    case 'lute': pluck(ctx, send(0.25), t, midi, 0.2 * vel, 'lute', Math.min(2, d + 0.6)); break;
    case 'harp': pluck(ctx, send(1.4), t, midi, 0.2 * vel, 'harp', Math.min(3, d + 1.2)); break;
    case 'recorder': recorder(ctx, send(0.7), t, midi, d, vel); break;
    case 'shawm': shawm(ctx, send(0.45), t, midi, d, vel); break;
    case 'drone': drone(ctx, out.dry, t, midi, d, vel); break;
    case 'drum': frameDrum(ctx, out.dry, t, midi, vel); break;
    default: break;
  }
}
