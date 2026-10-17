// Shorten long pauses inside voice recordings. The clone model copies the pacing of its template, which
// sometimes has 2-3 s of silence between phrases.
//
//   node scripts/asset-gen/pauses.mjs [--check]   shorten all public/audio/voice/*/*.mp3 in place (idempotent)
//
// Only files with a pause above LONG_PAUSE are re-encoded; --check just reports them.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const GAME_DIR = path.join(ROOT, 'public/audio/voice');
/** Silence level (dB) below which the recording counts as silent */
const THRESHOLD = -45;
/** A pause above this many seconds is shortened to roughly 0.45 s (stop_silence 0.15 plus the filter's window) */
export const LONG_PAUSE = 0.7;
/** ffmpeg filter: trim the start and cut every inner pause of 0.3 s or more down to a natural phrase break */
export const PAUSE_FILTER = `silenceremove=start_periods=1:start_threshold=${THRESHOLD}dB:start_silence=0.05`
  + `:stop_periods=-1:stop_duration=0.3:stop_threshold=${THRESHOLD}dB:stop_silence=0.15`;

/** Lengths (s) of the inner pauses of a recording that are longer than `min`. */
export function innerPauses(file, min = LONG_PAUSE) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=n=${THRESHOLD + 5}dB:d=${min}`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status) throw new Error(`ffmpeg: ${r.stderr}`);
  // silence_end is only reported for pauses that are followed by speech (not for trailing silence)
  return [...r.stderr.matchAll(/silence_end: [\d.]+ \| silence_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  let found = 0, saved = 0;
  for (const lang of fs.readdirSync(GAME_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const name of fs.readdirSync(path.join(GAME_DIR, lang.name)).filter((f) => f.endsWith('.mp3'))) {
      const file = path.join(GAME_DIR, lang.name, name);
      const pauses = innerPauses(file);
      if (!pauses.length) continue;
      found++;
      if (check) { console.log(`${lang.name}/${name}: ${pauses.map((p) => p.toFixed(1)).join(' ')} s`); continue; }
      const tmp = `${file}.tmp.mp3`;
      const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-af', PAUSE_FILTER, '-ac', '1', '-b:a', '48k', tmp], { encoding: 'utf8' });
      if (r.status) throw new Error(`ffmpeg: ${r.stderr}`);
      saved += fs.statSync(file).size - fs.statSync(tmp).size;
      fs.renameSync(tmp, file);
    }
  }
  console.log(`${found} recordings with long pauses${check ? '' : ` shortened (${(saved / 1024).toFixed(0)} KB smaller)`}`);
}
