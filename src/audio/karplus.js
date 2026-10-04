// Karplus-Strong string synthesis as a pure function: produces the samples of a plucked string
// (lute, harp). Computed once per pitch and cached as an AudioBuffer –
// cheaper than a feedback loop in the audio graph and without its 128-sample minimum delay.

import { mulberry32 } from './rng.js';

/**
 * @param {number} freq fundamental frequency in Hz
 * @param {number} sampleRate
 * @param {number} seconds length
 * @param {{ t60?: number, brightness?: number, seed?: number, body?: number }} [o]
 *   t60: decay time to −60 dB; brightness 0…1: attack brightness; body 0…1: fundamental share (warmer)
 * @returns {{ data: Float32Array, rate: number }} rate: playback speed correction
 *   (the delay length is an integer; pitch = rate · sampleRate / period, period incl. filter delay)
 */
export function karplusStrong(freq, sampleRate, seconds, o = {}) {
  const t60 = o.t60 ?? 1.4, brightness = o.brightness ?? 0.55, body = o.body ?? 0.3;
  // Weighting of the loop filter; it also reads the next value and shortens the period by (1 − w)
  const w = 0.5 + 0.12 * brightness;
  const n = Math.max(2, Math.round(sampleRate / freq + (1 - w)));
  const period = n - (1 - w);
  const len = Math.max(n, Math.floor(sampleRate * seconds));
  const rnd = mulberry32(o.seed ?? 7);
  const line = new Float32Array(n);
  // Excitation: filtered noise (softer attack at low brightness) plus some fundamental oscillation
  let lp = 0, mean = 0;
  for (let i = 0; i < n; i++) {
    lp += (0.15 + 0.85 * brightness) * ((rnd() * 2 - 1) - lp);
    line[i] = lp * (1 - body) + Math.sin((2 * Math.PI * i) / n) * body;
    mean += line[i];
  }
  mean /= n;
  for (let i = 0; i < n; i++) line[i] -= mean;
  // Loss per round trip such that −60 dB is reached after t60 seconds
  const g = Math.pow(0.001, n / sampleRate / t60);
  const out = new Float32Array(len);
  let idx = 0;
  // Damping per round trip: weighted mean of two neighbours = low-pass
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const nx = idx + 1 === n ? 0 : idx + 1;
    line[idx] = (w * cur + (1 - w) * line[nx]) * g;
    out[i] = cur;
    idx = nx;
  }
  // Normalise, soft edges against clicks
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const k = peak > 0 ? 0.9 / peak : 0;
  const fadeIn = Math.min(len, Math.floor(sampleRate * 0.001)), fadeOut = Math.min(len, Math.floor(sampleRate * 0.03));
  for (let i = 0; i < len; i++) {
    let f = k;
    if (i < fadeIn) f *= i / fadeIn;
    if (i >= len - fadeOut) f *= (len - i) / fadeOut;
    out[i] *= f;
  }
  return { data: out, rate: (freq * period) / sampleRate };
}

/** MIDI note number → frequency. */
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
