// Pause shortening of voice recordings (scripts/asset-gen/pauses.mjs): needs ffmpeg, skipped without it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { PAUSE_FILTER, innerPauses } from '../../scripts/asset-gen/pauses.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

/** Tone, `gap` seconds of silence, tone (mono WAV). */
function sample(dir, name, gap) {
  const file = path.join(dir, name);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=f=300:d=0.6', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-f', 'lavfi', '-i', 'sine=f=300:d=0.6',
    '-filter_complex', `[1]atrim=0:${gap}[s];[0][s][2]concat=n=3:v=0:a=1`, file]);
  if (r.status) throw new Error(String(r.stderr));
  return file;
}

describe.skipIf(!hasFfmpeg)('Voice pauses', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pauses-'));

  it('detects a long inner pause but not a short one', () => {
    expect(innerPauses(sample(dir, 'long.wav', 2.5)).length).toBe(1);
    expect(innerPauses(sample(dir, 'short.wav', 0.3))).toEqual([]);
  });

  it('shortens a long pause to a phrase break and leaves the speech', () => {
    const src = sample(dir, 'a.wav', 2.5), out = path.join(dir, 'a.out.wav');
    expect(spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-af', PAUSE_FILTER, out]).status).toBe(0);
    expect(innerPauses(out)).toEqual([]);
    const len = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);
    expect(len(out)).toBeLessThan(len(src) - 1.5);
    expect(len(out)).toBeGreaterThan(1.2); // both tones survive
  });
});
