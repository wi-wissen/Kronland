// Generated clip (scripts/art/video.mjs) → seamless loop for the moving menu backdrop, encoded for the web.
//
//   node scripts/art/loop.mjs <job> <raw-N.mp4> [--period x,y,w,h] [--fade 1] [--trim 0] [--width 1920] [--out art/title-loop] [--compare]
//
// Loop: even with the still as first and last frame the models do not end exactly where they start (the windmill
// stands at another angle). Therefore the last --fade seconds are cross-faded into the first ones: the clip then
// starts at second --fade and ends on the frame just before it – no visible cut. --trim drops seconds at the end.
// --period x,y,w,h (pixels of the raw clip, e.g. the windmill): the loop ends on the frame of the second half in
// which this region looks most like frame 0 – so the sails have made whole turns and the fade blends sails at the
// same angle instead of ghosting them; the fade then uses the frames after it (at most --fade seconds).
// Output in public/<out>.av1.mp4 (AV1, SVT-AV1) and public/<out>.h264.mp4 (H.264 Main, for browsers without AV1),
// both silent, faststart. --compare additionally writes VP9-WebM and animated WebP to assets-src/art/<job>/compare/
// and prints all sizes. Needs ffmpeg with libsvtav1 and libx264.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../asset-gen/lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (n) => { const i = args.indexOf(n); if (i >= 0) args.splice(i, 1); return i >= 0; };
let fade = Number(opt('--fade', 1)), trim = Number(opt('--trim', 0));
const width = Number(opt('--width', 1920)), period = opt('--period');
const outName = opt('--out', 'art/title-loop'), compare = flag('--compare');
const [name, raw] = args;
if (!name || !raw) { console.error('Usage: loop.mjs <job> <raw-N.mp4> [--fade 1] [--trim 0] [--width 1920] [--out art/title-loop] [--compare]'); process.exit(1); }
const dir = requireAssetsSrc('art', name);
const src = path.join(dir, raw);

function ff(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`ffmpeg failed: ${argv.join(' ')}`); process.exit(1); }
}
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate:format=duration', '-of', 'json', src], { encoding: 'utf8' });
const info = JSON.parse(probe.stdout);
const [fn, fd] = info.streams[0].r_frame_rate.split('/').map(Number);
const fps = fn / fd;
if (period) {
  // Region of every frame as grey values; mean difference to frame 0
  const [x, y, w, h] = period.split(',').map(Number);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-vf', `crop=${w}:${h}:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 30 });
  const px = w * h, n = Math.floor(r.stdout.length / px);
  const diff = (j) => { let d = 0; for (let i = 0; i < px; i++) d += Math.abs(r.stdout[j * px + i] - r.stdout[i]); return d / px; };
  let best = -1, bestD = Infinity;
  for (let j = Math.ceil(n / 2); j < n - 1; j++) { const d = diff(j); if (d < bestD) { bestD = d; best = j; } }
  const fadeFrames = Math.min(Math.round(fade * fps), n - best);
  fade = fadeFrames / fps;
  trim = (n - best - fadeFrames) / fps;
  console.log(`${name}: region repeats at frame ${best} (${(best / fps).toFixed(2)} s, diff ${bestD.toFixed(1)}), fade ${fadeFrames} frames`);
}
const total = Number(info.format.duration) - trim;
const len = total - fade;
if (!(fade > 0 && len > fade)) { console.error(`Clip too short for --fade ${fade}: ${total} s`); process.exit(1); }

// Loop master (lossless intermediate): A = [fade, total), B = [0, fade) cross-faded over A's last `fade` seconds
const height = Math.round(width * 9 / 16 / 2) * 2;
const master = path.join(dir, 'loop-master.mkv');
ff(['-i', src, '-filter_complex',
  `[0:v]trim=start=${fade}:end=${total},setpts=PTS-STARTPTS,format=yuv420p[a];`
  + `[0:v]trim=start=0:end=${fade},setpts=PTS-STARTPTS,format=yuv420p[b];`
  + `[a][b]xfade=transition=fade:duration=${fade}:offset=${len - fade},scale=${width}:${height}:flags=lanczos,setsar=1[v]`,
  '-map', '[v]', '-an', '-c:v', 'ffv1', '-pix_fmt', 'yuv420p', master]);

const out = (ext) => path.join(ROOT, 'public', `${outName}.${ext}`);
fs.mkdirSync(path.dirname(out('x')), { recursive: true });
// Keyframe only at the start: the clip is short and always played from the beginning
const gop = ['-g', '999', '-keyint_min', '999'];
ff(['-i', master, '-an', '-c:v', 'libsvtav1', '-preset', '4', '-crf', '46', ...gop, '-svtav1-params', 'tune=0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out('av1.mp4')]);
ff(['-i', master, '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-profile:v', 'main', '-level', '4.0', ...gop, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out('h264.mp4')]);

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
console.log(`${name}: loop ${len.toFixed(2)} s, ${width}x${height}`);
console.log(`  ${path.relative(ROOT, out('av1.mp4'))}  ${kb(out('av1.mp4'))}`);
console.log(`  ${path.relative(ROOT, out('h264.mp4'))}  ${kb(out('h264.mp4'))}`);

if (compare) {
  const cmp = path.join(dir, 'compare');
  fs.mkdirSync(cmp, { recursive: true });
  const c = (f) => path.join(cmp, f);
  ff(['-i', master, '-an', '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2', ...gop, '-pix_fmt', 'yuv420p', c('loop.vp9.webm')]);
  ff(['-i', master, '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-profile:v', 'main', ...gop, '-pix_fmt', 'yuv420p', '-vf', 'scale=1280:720', c('loop-720.h264.mp4')]);
  ff(['-i', master, '-an', '-c:v', 'libsvtav1', '-preset', '4', '-crf', '40', ...gop, '-pix_fmt', 'yuv420p', '-vf', 'scale=1280:720', c('loop-720.av1.mp4')]);
  ff(['-i', master, '-vf', 'fps=15,scale=1280:720', '-c:v', 'libwebp_anim', '-quality', '70', '-loop', '0', c('loop-720.webp')]);
  for (const f of fs.readdirSync(cmp)) console.log(`  compare/${f}  ${kb(c(f))}`);
}
