// Recorded clip → seamless loop for the web (title video of the start page, scripts/site-video.py).
//
//   node scripts/video-loop.mjs <raw.mp4> --out site/hero-loop [--loop 201] [--fade 24] [--period x,y,w,h] [--width 1920] [--compare]
//
// Loop: the clip holds `--loop` frames plus `--fade` frames after them. The frames after the loop are cross-faded
// into the first ones: the result starts at frame `--fade`, ends on the frame just before it and is `--loop` frames
// long – no visible cut. Figures walking there blend for that moment; everything periodic (windmill sails) lines up
// if `--loop` is a whole number of its turns. Instead of `--loop`, `--period x,y,w,h` (pixels of the clip) picks the
// frame of the second half in which that region looks most like frame 0.
// Output: public/<out>.av1.mp4 (AV1, SVT-AV1) and public/<out>.h264.mp4 (H.264 Main, browsers without AV1), silent,
// faststart, one keyframe. --compare additionally writes VP9-WebM and animated WebP next to the clip and prints sizes.
// Needs ffmpeg with libsvtav1 and libx264.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (n) => { const i = args.indexOf(n); if (i >= 0) args.splice(i, 1); return i >= 0; };
const outName = opt('--out'), period = opt('--period'), width = Number(opt('--width', 1920)), compare = flag('--compare');
let loop = Number(opt('--loop', 0)), fadeN = Number(opt('--fade', 24));
const [src] = args;
if (!src || !outName || !fs.existsSync(src)) {
  console.error('Usage: video-loop.mjs <raw.mp4> --out site/hero-loop [--loop N] [--fade 24] [--period x,y,w,h] [--width 1920] [--compare]');
  process.exit(1);
}

function ff(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`ffmpeg failed: ${argv.join(' ')}`); process.exit(1); }
}
const info = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
  '-show_entries', 'stream=r_frame_rate,width,height,nb_read_frames', '-of', 'json', src], { encoding: 'utf8' }).stdout).streams[0];
const [fn, fd] = info.r_frame_rate.split('/').map(Number);
const fps = fn / fd, n = Number(info.nb_read_frames);

if (period) {
  const [x, y, w, h] = period.split(',').map(Number);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
  const px = w * h;
  const diff = (j) => { let d = 0; for (let i = 0; i < px; i++) d += Math.abs(r.stdout[j * px + i] - r.stdout[i]); return d / px; };
  let bestD = Infinity;
  for (let j = Math.ceil(n / 2); j < n - 1; j++) { const d = diff(j); if (d < bestD) { bestD = d; loop = j; } }
  console.log(`period: region repeats at frame ${loop} (diff ${bestD.toFixed(1)})`);
}
if (!loop) loop = n - fadeN;
fadeN = Math.min(fadeN, n - loop);
if (!(fadeN > 0 && loop > 2 * fadeN)) { console.error(`Not enough frames: ${n} for loop ${loop} + fade ${fadeN}`); process.exit(1); }

// Lossless intermediate: A = frames [fade, loop + fade), B = [0, fade) cross-faded over A's last `fade` frames
const s = (f) => (f / fps).toFixed(6);
const height = Math.round(width * info.height / info.width / 2) * 2;
const master = path.join(path.dirname(src), 'loop-master.mkv');
ff(['-i', src, '-filter_complex',
  `[0:v]trim=start_frame=${fadeN}:end_frame=${loop + fadeN},setpts=PTS-STARTPTS,format=yuv420p[a];`
  + `[0:v]trim=start_frame=0:end_frame=${fadeN},setpts=PTS-STARTPTS,format=yuv420p[b];`
  + `[a][b]xfade=transition=fade:duration=${s(fadeN)}:offset=${s(loop - fadeN)},scale=${width}:${height}:flags=lanczos,setsar=1[v]`,
  '-map', '[v]', '-an', '-c:v', 'ffv1', '-pix_fmt', 'yuv420p', master]);

const out = (ext) => path.join(ROOT, 'public', `${outName}.${ext}`);
fs.mkdirSync(path.dirname(out('x')), { recursive: true });
// Keyframe only at the start: the clip is short and always played from the beginning
const gop = ['-g', '9999', '-keyint_min', '9999', '-pix_fmt', 'yuv420p'];
ff(['-i', master, '-an', '-c:v', 'libsvtav1', '-preset', '4', '-crf', '46', ...gop, '-svtav1-params', 'tune=0', '-movflags', '+faststart', out('av1.mp4')]);
ff(['-i', master, '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-profile:v', 'main', '-level', '4.0', ...gop, '-movflags', '+faststart', out('h264.mp4')]);

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
console.log(`loop: ${loop} frames = ${(loop / fps).toFixed(3)} s, fade ${fadeN} frames, ${width}x${height}`);
for (const e of ['av1.mp4', 'h264.mp4']) console.log(`  ${path.relative(ROOT, out(e))}  ${kb(out(e))}`);

if (compare) {
  const c = (f) => path.join(path.dirname(src), `compare-${f}`);
  ff(['-i', master, '-an', '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2', ...gop, c('loop.vp9.webm')]);
  ff(['-i', master, '-vf', 'fps=15,scale=1280:-2', '-c:v', 'libwebp_anim', '-quality', '70', '-loop', '0', c('loop-720.webp')]);
  for (const f of ['loop.vp9.webm', 'loop-720.webp']) console.log(`  ${path.relative(ROOT, c(f))}  ${kb(c(f))}`);
}
