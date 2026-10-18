// Compress a baked low mesh like the game files: textures from the bake PNGs (alpha = covered texels) with all gaps
// between the UV charts filled (pull-push, so mipmaps do not pull black or foreign colours into the charts),
// downscaled + JPEG, material factors like the original, weld + meshopt (medium).
// usage: node finalize.mjs in.glb out.glb --like orig.glb [--q 85] [--size 512] [--nonormal]
//        (expects in_color.png / in_normal.png next to in.glb, written by bake.py)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { weld, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const noNormal = flag('--nonormal');
const like = opt('--like', null), q = Number(opt('--q', 85)), size = Number(opt('--size', 0));
const teamFile = opt('--team', null);
const nsize = Number(opt('--nsize', 0)) || size, fmt = opt('--fmt', 'jpeg'), chroma = opt('--chroma', '4:2:0');
const [src, dst] = args;

/** Pull-push fill of all texels with alpha < 0.5 (RGBA raw, w = h = power of two). */
export function fillGaps(data, w, h) {
  const levels = [];
  let cur = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] > 127 ? 1 : 0;
    for (let c = 0; c < 3; c++) cur[i * 4 + c] = data[i * 4 + c] * a;
    cur[i * 4 + 3] = a;
  }
  let cw = w, ch = h;
  levels.push({ img: cur, w: cw, h: ch });
  while (cw > 1 && ch > 1) {
    const nw = cw >> 1, nh = ch >> 1, nx = new Float32Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const o = (y * nw + x) * 4;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const s = ((y * 2 + dy) * cw + x * 2 + dx) * 4;
        for (let c = 0; c < 4; c++) nx[o + c] += cur[s + c];
      }
    }
    cur = nx; cw = nw; ch = nh;
    levels.push({ img: cur, w: cw, h: ch });
  }
  // push: normalise from coarse to fine, fill empty texels from the parent
  for (let l = levels.length - 1; l >= 0; l--) {
    const { img, w: lw, h: lh } = levels[l];
    const parent = levels[l + 1];
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const o = (y * lw + x) * 4;
      if (img[o + 3] > 1e-6) { for (let c = 0; c < 3; c++) img[o + c] /= img[o + 3]; img[o + 3] = 1; }
      else if (parent) {
        const p = ((Math.min(parent.h - 1, y >> 1)) * parent.w + Math.min(parent.w - 1, x >> 1)) * 4;
        for (let c = 0; c < 3; c++) img[o + c] = parent.img[p + c];
        img[o + 3] = 0;
      }
    }
  }
  const out = Buffer.alloc(w * h * 3);
  const L0 = levels[0].img;
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] > 127) for (let c = 0; c < 3; c++) out[i * 3 + c] = data[i * 4 + c];
    else for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(L0[i * 4 + c])));
  }
  return out;
}

// same rule as markerWeightSrgb in src/render/characters.js
function marker(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 51 || d === 0) return 0;
  let h;
  if (mx === r) h = (60 * (g - b)) / d; else if (mx === g) h = 120 + (60 * (b - r)) / d; else h = 240 + (60 * (r - g)) / d;
  if (h < 0) h += 360;
  const cl = (x) => Math.min(1, Math.max(0, x));
  return (h < 295 ? cl((h - 285) / 10) : 1 - cl((h - 342) / 10)) * cl((d / mx - 0.25) / 0.15);
}

/**
 * Team colour only where it belongs: triangles of the low mesh whose texels are mostly magenta (pennant) keep it;
 * magenta texels in all other triangles (bake rays that hit the pennant from the ridge or pole) are cleared and
 * then filled from their surroundings. Returns the number of cleared texels.
 */
function cleanTeam(data, w, h, prim) {
  const uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  if (!uv || !idx) return 0;
  const n = idx.getCount() / 3, U = [], t = [];
  for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, t); U.push(t[0] * w, t[1] * h); }
  const isM = (k) => data[k * 4 + 3] > 127 && marker(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]) > Number(process.env.TEAM_T ?? 0.05);
  const raster = (tri, fn) => {
    const [a, b, c] = [0, 1, 2].map((j) => idx.getScalar(tri * 3 + j));
    const ax = U[a * 2], ay = U[a * 2 + 1], bx = U[b * 2], by = U[b * 2 + 1], cx = U[c * 2], cy = U[c * 2 + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      const e = 1.5 / Math.sqrt(Math.abs(area)); // ~1.5 texel slack at the edges
      if (w0 >= -e && w1 >= -e && 1 - w0 - w1 >= -e) fn(y * w + x);
    }
  };
  const team = new Uint8Array(n), protect = new Uint8Array(w * h);
  // team triangles: all three corners are locked pennant vertices (lowmesh.mjs); fallback: mostly magenta texels
  const G = 2e-3, cells = new Set(), key = (p, d = [0, 0, 0]) => p.map((x, k) => Math.round(x / G) + d[k]).join(',');
  if (teamFile) for (const p of JSON.parse(readFileSync(teamFile, 'utf8'))) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) cells.add(key(p, [dx, dy, dz]));
  const pos = prim.getAttribute('POSITION'), q = [];
  for (let i = 0; i < n; i++) {
    if (teamFile) {
      team[i] = [0, 1, 2].every((j) => cells.has(key(pos.getElement(idx.getScalar(i * 3 + j), q).map((x) => Math.round(x / G) * G)))) ? 1 : 0;
    } else {
      let m = 0, all = 0;
      raster(i, (k) => { if (data[k * 4 + 3] > 127) { all++; if (isM(k)) m++; } });
      team[i] = all > 0 && m / all > 0.5 ? 1 : 0;
    }
    if (team[i]) raster(i, (k) => { protect[k] = 1; });
  }
  console.log('team triangles', team.reduce((a, b) => a + b, 0));
  let cleared = 0;
  for (let i = 0; i < n; i++) if (!team[i]) raster(i, (k) => { if (!protect[k] && isM(k)) { data[k * 4 + 3] = 0; cleared++; } });
  return cleared;
}

async function filledJpeg(png, sz, prim = null) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (prim) console.log('team texels cleared', cleanTeam(data, info.width, info.height, prim));
  const rgb = fillGaps(data, info.width, info.height);
  let img = sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } });
  if (sz && info.width > sz) img = img.resize(sz, sz, { kernel: 'lanczos3' });
  if (fmt === 'webp') return new Uint8Array(await img.webp({ quality: q, effort: 6 }).toBuffer());
  return new Uint8Array(await img.jpeg({ quality: q, mozjpeg: true, chromaSubsampling: chroma }).toBuffer());
}

const MIME = fmt === 'webp' ? 'image/webp' : 'image/jpeg';
const doc = await io.read(src);
if (fmt === 'webp') doc.createExtension(EXTTextureWebP).setRequired(true);
const ref = like ? (await io.read(like)).getRoot().listMaterials()[0] : null;
const stem = src.replace(/\.glb$/, '');
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
for (const mat of doc.getRoot().listMaterials()) {
  mat.setMetallicFactor(ref ? ref.getMetallicFactor() : 0).setRoughnessFactor(ref ? ref.getRoughnessFactor() : 1)
    .setDoubleSided(ref ? ref.getDoubleSided() : true);
  if (ref) mat.setName(ref.getName());
  if (noNormal) mat.setNormalTexture(null);
  const ct = mat.getBaseColorTexture(), nt = mat.getNormalTexture();
  if (ct && existsSync(`${stem}_color.png`)) ct.setImage(await filledJpeg(`${stem}_color.png`, size, prim)).setMimeType(MIME);
  if (nt && existsSync(`${stem}_normal.png`)) nt.setImage(await filledJpeg(`${stem}_normal.png`, nsize)).setMimeType(MIME);
}
await doc.transform(weld(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
