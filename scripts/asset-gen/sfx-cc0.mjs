// Sound effects from CC0 sources – packs by Kenney (kenney.nl) and individual recordings from Freesound:
// download, check licence, cut, level, store as MP3 and enter into public/audio/manifest.json
// (section sfx). All other effects stay synthetic.
//
//   node scripts/asset-gen/sfx-cc0.mjs          regenerate files, update manifest
//
// Cut per file: mono, 44.1 kHz, optional pitch (rate), silence at the start removed (−40 dB below peak),
// end at −50 dB or at most maxDur, 2 ms fade-in and 30 ms fade-out, peak at −3 dBFS, MP3 (VBR q4).
// `gain` matches the loudness to the synthetic sound (measured: max. 50 ms RMS,
// roughly ear-weighted, against scripts/audio-check.html); MP3, because Safari before iOS 17 cannot decode Ogg.
// Requires curl, unzip, ffmpeg (libmp3lame). Cache: <tmp>/kronland-kenney.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const PACKS = {
  rpg: { page: 'https://kenney.nl/assets/rpg-audio', dir: 'Audio' },
  impact: { page: 'https://kenney.nl/assets/impact-sounds', dir: 'Audio' },
};

/**
 * Freesound recordings (CC0 only): the preview MP3 (128 kbit/s) is enough for short effects and needs no account.
 * The licence is checked on the sound's page when loading.
 */
const FREESOUND = {
  321889: { page: 'https://freesound.org/people/Duasun/sounds/321889/', mp3: 'https://cdn.freesound.org/previews/321/321889_5503971-hq.mp3' },
  386129: { page: 'https://freesound.org/people/ldezem/sounds/386129/', mp3: 'https://cdn.freesound.org/previews/386/386129_1655965-hq.mp3' },
};

/**
 * Effect → overall volume, longest duration (s), sources.
 * Source: [Kenney pack, file, pitch factor] or ['freesound', id, pitch factor, start time s].
 */
export const SELECTION = {
  chop: { gain: 1.15, maxDur: 0.35, src: [['rpg', 'chop', 1], ['rpg', 'chop', 0.9], ['rpg', 'chop', 1.08]] },
  pickaxe: { gain: 0.95, maxDur: 0.6, src: [['impact', 'impactMining_000'], ['impact', 'impactMining_001'], ['impact', 'impactMining_003'], ['impact', 'impactMining_004']] },
  hammer: { gain: 1.4, maxDur: 0.3, src: [['impact', 'impactWood_light_000'], ['impact', 'impactWood_light_002'], ['impact', 'impactWood_light_004']] },
  // Anvil with a long decay (single strikes from "Hammer and anvil" by Duasun, "Anvil – Lokomo 125 kg" by ldezem)
  anvil: { gain: 0.5, maxDur: 1.6, src: [['freesound', 321889, 1, 2.5], ['freesound', 321889, 1, 5.2], ['freesound', 321889, 1, 14.4], ['freesound', 321889, 1, 20.7], ['freesound', 386129, 1, 0]] },
  clash: { gain: 0.6, maxDur: 0.45, src: [['impact', 'impactMetal_light_000'], ['impact', 'impactMetal_light_001'], ['impact', 'impactMetal_light_002'], ['impact', 'impactMetal_light_003']] },
  arrowHit: { gain: 1, maxDur: 0.3, src: [['impact', 'impactWood_medium_000'], ['impact', 'impactWood_medium_002'], ['impact', 'impactWood_medium_004']] },
  coin: { gain: 0.5, maxDur: 0.9, src: [['rpg', 'handleCoins'], ['rpg', 'handleCoins2']] },
};

const CACHE = path.join(os.tmpdir(), 'kronland-sfx');
const OUT = path.join(ROOT, 'public/audio/sfx');
const MANIFEST = path.join(ROOT, 'public/audio/manifest.json');
const RATE = 44100;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr?.toString().slice(0, 300)}`);
  return r.stdout;
}

/** Download and unpack a pack (once), return the folder of the audio files. */
function pack(id) {
  const p = PACKS[id], dir = path.join(CACHE, id);
  if (!fs.existsSync(path.join(dir, 'License.txt'))) {
    fs.mkdirSync(dir, { recursive: true });
    const html = run('curl', ['-sSL', p.page]).toString();
    const url = html.match(new RegExp(`https://kenney\\.nl/media/pages/assets/${path.basename(p.page)}/[^"]*\\.zip`))?.[0];
    if (!url) throw new Error(`No ZIP link on ${p.page}`);
    run('curl', ['-sSL', '-o', path.join(dir, 'pack.zip'), url]);
    run('unzip', ['-oq', path.join(dir, 'pack.zip'), '-d', dir]);
  }
  const lic = fs.readFileSync(path.join(dir, 'License.txt'), 'utf8');
  if (!/CC0|Creative Commons Zero/i.test(lic)) throw new Error(`${id}: licence is not CC0`);
  return path.join(dir, p.dir);
}

/** Load a Freesound recording (once) and check CC0. */
function freesound(id) {
  const fsnd = FREESOUND[id], file = path.join(CACHE, `freesound-${id}.mp3`);
  if (!fs.existsSync(file)) {
    const html = run('curl', ['-sSL', fsnd.page]).toString();
    if (!html.includes('creativecommons.org/publicdomain/zero/')) throw new Error(`Freesound ${id}: licence is not CC0`);
    fs.mkdirSync(CACHE, { recursive: true });
    run('curl', ['-sSL', '-o', file, fsnd.mp3]);
  }
  return file;
}

/** Decode a file (mono, 44.1 kHz, pitch via sample rate, from start time) and cut it. */
function cut(file, rate = 1, maxDur = 1, at = 0) {
  const af = rate === 1 ? [] : ['-af', `asetrate=${Math.round(RATE * rate)},aresample=${RATE}`];
  const raw = run('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, at - 0.05)), '-t', String(maxDur + 1), '-i', file, '-ac', '1', '-ar', String(RATE), ...af, '-f', 'f32le', '-']);
  const x = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  let pk = 0;
  for (const v of x) pk = Math.max(pk, Math.abs(v));
  const thr = (db) => pk * 10 ** (db / 20);
  let a = x.findIndex((v) => Math.abs(v) > thr(-40));
  a = Math.max(0, a - Math.round(0.002 * RATE));
  // End: last 10 ms window above −50 dB
  const w = RATE / 100;
  let b = x.length;
  for (let i = x.length - w; i > a; i -= w) {
    let s = 0;
    for (let j = 0; j < w; j++) s += x[i + j] ** 2;
    if (Math.sqrt(s / w) > thr(-50)) { b = Math.min(x.length, i + w + Math.round(0.02 * RATE)); break; }
  }
  // A decay cut off at maxDur (anvil) is faded out for a long time instead of ending abruptly
  const capped = b > a + Math.round(maxDur * RATE);
  b = Math.min(b, a + Math.round(maxDur * RATE));
  const y = x.slice(a, b), n = y.length, fi = Math.round(0.002 * RATE), fo = Math.min(Math.round((capped ? 0.4 : 0.03) * RATE), n >> 1);
  for (let i = 0; i < n; i++) {
    let g = 10 ** (-3 / 20) / pk; // peak at −3 dBFS
    if (i < fi) g *= i / fi;
    if (i > n - fo) g *= 0.5 + 0.5 * Math.cos(Math.PI * (i - (n - fo)) / fo);
    y[i] *= g;
  }
  return y;
}

function encode(y, out) {
  const tmp = out + '.f32';
  fs.writeFileSync(tmp, Buffer.from(y.buffer));
  try { run('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', tmp, '-c:a', 'libmp3lame', '-q:a', '4', out]); }
  finally { fs.rmSync(tmp, { force: true }); }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const sfx = {};
  for (const [name, sel] of Object.entries(SELECTION)) {
    const files = [];
    sel.src.forEach(([id, base, rate = 1, at = 0], i) => {
      const rel = `sfx/${name}-${i + 1}.mp3`;
      const file = id === 'freesound' ? freesound(base) : path.join(pack(id), `${base}.ogg`);
      encode(cut(file, rate, sel.maxDur, at), path.join(ROOT, 'public/audio', rel));
      files.push(rel);
    });
    sfx[name] = { files, gain: sel.gain };
    console.log(`${name}: ${files.length} files`);
  }
  const m = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { version: 1, music: {}, ambient: {} };
  m.sfx = { ...(m.sfx ?? {}), ...sfx };
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
