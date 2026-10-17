// Inner pauses of speech recordings (ffmpeg silencedetect). Used by voice.mjs as a quality gate and as a report:
//
//   node scripts/asset-gen/pauses.mjs [dir] [--csv]      table per voice role (default public/audio/voice/de)

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

/** Silence threshold and shortest silence that counts as a pause */
export const PAUSE_DB = -40;
export const PAUSE_MIN = 0.7;
/** Longest inner pause a game recording may have (seconds) */
export const PAUSE_MAX = 0.8;

/**
 * Silent stretches inside a recording (leading and trailing silence excluded).
 * @param {string} file any format ffmpeg reads
 * @returns {{duration:number, pauses:number[]}} pause lengths in seconds
 */
export function innerPauses(file, { db = PAUSE_DB, min = PAUSE_MIN } = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=n=${db}dB:d=${min}`, '-f', 'null', '-'], { encoding: 'utf8' });
  const log = r.stderr ?? '';
  const duration = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(log)?.slice(1).reduce((s, v) => s * 60 + Number(v), 0) ?? 0);
  const pauses = [];
  let start = null;
  for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    const v = Number(m[2]);
    if (m[1] === 'start') start = v;
    else if (start !== null) { if (start > 0.05) pauses.push(v - start); start = null; }
  }
  // an open silence at the end is trailing silence and is ignored
  return { duration, pauses };
}

/** Longest inner pause in seconds (0 = none above the minimum). */
export const longestPause = (file, opts) => Math.max(0, ...innerPauses(file, opts).pauses);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dir = path.resolve(args[0] ?? path.join(ROOT, 'public/audio/voice/de'));
  const rows = {};
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mp3')).sort()) {
    const role = f.slice(0, f.lastIndexOf('-'));
    const { duration, pauses } = innerPauses(path.join(dir, f));
    const row = (rows[role] ??= { n: 0, withPause: 0, total: 0, max: 0, dur: 0 });
    row.n++; row.dur += duration;
    if (pauses.length) row.withPause++;
    row.total += pauses.reduce((s, p) => s + p, 0);
    row.max = Math.max(row.max, ...pauses, 0);
  }
  const all = { n: 0, withPause: 0, total: 0, max: 0, dur: 0 };
  console.log('| Role | Files | With pause > 0.7 s | Pause share | Longest (s) |\n|---|---:|---:|---:|---:|');
  for (const [role, r] of Object.entries(rows).sort((a, b) => b[1].withPause / b[1].n - a[1].withPause / a[1].n)) {
    console.log(`| ${role} | ${r.n} | ${r.withPause} | ${(100 * r.total / r.dur).toFixed(1)} % | ${r.max.toFixed(1)} |`);
    all.n += r.n; all.withPause += r.withPause; all.total += r.total; all.dur += r.dur; all.max = Math.max(all.max, r.max);
  }
  console.log(`| **all** | ${all.n} | ${all.withPause} | ${(100 * all.total / all.dur).toFixed(1)} % | ${all.max.toFixed(1)} |`);
}
