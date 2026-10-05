// Make the Meshy result game-ready: assets-src/characters/<id>/ → public/models/characters/<model>.glb
//
//   node scripts/asset-gen/postprocess.mjs <id> [--no-lods]
//   node scripts/asset-gen/postprocess.mjs <id> --game-only --out-dir review/color-a --spec {"greenToBrown":{...}}   (game model only, variants)
//
// Steps
//  1. rigged.glb as the basis; take over animations from anim-<key>.glb and name them after the game key
//     (idle, walk, chop …). Only rotations + hip translation stay (the rest is constant).
//  2. Hold loops in place (remove hip drift in X/Z) and blend the seam softly to the first frame.
//  3. Near model: texture spec.textureSize², marker colour (magenta) → mask texture from the triangles
//     (<model>.mask.png, R = player colour), marker areas neutral grey; optionally beard → hair colour.
//  4. Tools (spec.props) attached to the hand as rigid meshes; their colours live in a strip
//     appended to the bottom of the texture.
//  5. Game model (level 1): far model (spec.far) onto the skeleton, flat colour per triangle as vertex colour (no texture).
//  6. meshopt compression.
// The manifest entry (models.<model>) is printed by the script for pasting in.

import { applyRigid, removeCylinder } from './rigid.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { SRC_DIR, OUT_DIR, ROOT } from './lib.mjs';
import { SWATCHES, SWATCH_KEYS, buildTool } from './props.mjs';
import { aimProp } from './aim.mjs';
import { paletteize, rgbToLab, labToRgb } from './palette.mjs';
import { rasterTriangles, fillGutters } from './texraster.mjs';
import { triangleInfo, headRegions, meanLab, shiftBeard, triangleAdjacency, growMarker } from './regions.mjs';
import { fitTo, transferWeights } from './farmesh.mjs';

const LOOP_FADE = 0.3; // s: seam cross-fade
const ONE_SHOT = new Set(['die']);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ---------- Marker colour ----------

/**
 * How strongly is a pixel marker colour (magenta)? 0…1, soft at the edges.
 * Via hue: Meshy shifts magenta in the texture towards carmine (red high, blue medium, green ≈ 0),
 * so hue 295°–342° fully, fading out towards 285°/352°; skin and lips (0°–30°) stay out.
 */
export function markerWeight(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 60 || max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = (60 * (g - b)) / d; else if (max === g) h = 120 + (60 * (b - r)) / d; else h = 240 + (60 * (r - g)) / d;
  if (h < 0) h += 360;
  const sat = d / max;
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const hue = h < 295 ? ramp(h, 285, 295) : h > 342 ? 1 - ramp(h, 342, 352) : 1;
  return hue * ramp(sat, 0.25, 0.4);
}

/**
 * More generous marker detection inside team areas: Meshy shades magenta to carmine and burgundy
 * (hue up to ~360°/8°). Apply only where the triangle is a team area anyway – otherwise it would hit lips.
 */
export function markerWeightRelaxed(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max < 45 || max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = (60 * (g - b)) / d; else if (max === g) h = 120 + (60 * (b - r)) / d; else h = 240 + (60 * (r - g)) / d;
  if (h < 0) h += 360;
  const ramp = (x, a, c) => Math.min(1, Math.max(0, (x - a) / (c - a)));
  const hue = h >= 280 || h <= 8 ? 1 : h > 270 ? ramp(h, 270, 280) : h < 18 ? 1 - ramp(h, 8, 18) : 0;
  return hue * ramp(d / max, 0.22, 0.35);
}

// ---------- Smooth normals ----------

/**
 * After the remesh Meshy delivers flat normals (faceted look). Recompute normals and average them over
 * vertices at the same position (UV seams stay separate, but are shaded identically).
 */
export function smoothNormals(pos, idx) {
  const n = pos.length / 3;
  const acc = new Float32Array(n * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // area-weighted
    for (const k of [a, b, c]) { acc[k] += nx; acc[k + 1] += ny; acc[k + 2] += nz; }
  }
  const key = (i) => `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
  const groups = new Map();
  for (let i = 0; i < n; i++) { const k = key(i); (groups.get(k) ?? groups.set(k, []).get(k)).push(i); }
  const out = new Float32Array(n * 3);
  for (const list of groups.values()) {
    let x = 0, y = 0, z = 0;
    for (const i of list) { x += acc[i * 3]; y += acc[i * 3 + 1]; z += acc[i * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of list) { out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l; }
  }
  return out;
}

// ---------- Animations ----------

const quatDot = (a, i, b, j) => a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2] + a[i + 3] * b[j + 3];

/** Loop seam: blend the last LOOP_FADE s towards the first frame (quaternions: nlerp with sign). */
function fadeSeam(times, vals, size) {
  const T = times[times.length - 1];
  for (let k = 0; k < times.length; k++) {
    const w = Math.min(1, Math.max(0, (times[k] - (T - LOOP_FADE)) / LOOP_FADE));
    if (w <= 0) continue;
    const s = w * w * (3 - 2 * w);
    const i = k * size;
    const sign = size === 4 && quatDot(vals, i, vals, 0) < 0 ? -1 : 1;
    for (let c = 0; c < size; c++) vals[i + c] += (vals[c] * sign - vals[i + c]) * s;
    if (size === 4) { const l = Math.hypot(vals[i], vals[i + 1], vals[i + 2], vals[i + 3]); for (let c = 0; c < 4; c++) vals[i + c] /= l; }
  }
}

/** Hips in place: remove drift in X/Z, mean to the rest pose. */
function holdInPlace(times, vals, rest) {
  const n = times.length, T = times[n - 1] || 1;
  for (const c of [0, 2]) {
    const d = vals[(n - 1) * 3 + c] - vals[c];
    let mean = 0;
    for (let k = 0; k < n; k++) { vals[k * 3 + c] -= d * (times[k] / T); mean += vals[k * 3 + c]; }
    mean /= n;
    for (let k = 0; k < n; k++) vals[k * 3 + c] += rest[c] - mean;
  }
}

/** Take over a section [t0, t1) of a clip (e.g. cut off the lead-in of a text motion). */
function cut(times, vals, size, t0, t1) {
  const keep = [];
  for (let k = 0; k < times.length; k++) if (times[k] >= t0 - 1e-4 && times[k] <= t1 + 1e-4) keep.push(k);
  const nt = new Float32Array(keep.length), nv = new Float32Array(keep.length * size);
  keep.forEach((k, i) => { nt[i] = times[k] - times[keep[0]]; for (let c = 0; c < size; c++) nv[i * size + c] = vals[k * size + c]; });
  return [nt, nv];
}

async function importClips(doc, dir, spec) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  for (const a of root.listAnimations()) {
    for (const s of a.listSamplers()) { s.getInput()?.dispose(); s.getOutput()?.dispose(); s.dispose(); }
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
  const nodes = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const names = [];
  const files = fs.readdirSync(dir).filter((f) => /^anim-[A-Za-z]+\.glb$/.test(f)).sort();
  for (const f of files) {
    const key = f.slice(5, -4);
    // Meshy sometimes puts a short rest pose next to it: take the longest clip
    const dur = (a) => Math.max(0, ...a.listSamplers().map((x) => x.getInput().getMax([])[0]));
    const src = (await io.read(path.join(dir, f))).getRoot().listAnimations().sort((a, b) => dur(b) - dur(a))[0];
    if (!src) continue;
    const range = spec.clipRanges?.[key];
    const anim = doc.createAnimation(key);
    for (const ch of src.listChannels()) {
      const node = nodes.get(ch.getTargetNode()?.getName());
      const p = ch.getTargetPath();
      if (!node || p === 'scale' || p === 'weights') continue;
      const isHips = node.getName() === 'Hips';
      if (p === 'translation' && !isHips) continue; // bone lengths stay constant
      const s = ch.getSampler();
      const size = p === 'rotation' ? 4 : 3;
      let times = new Float32Array(s.getInput().getArray());
      let vals = new Float32Array(s.getOutput().getArray());
      if (range) [times, vals] = cut(times, vals, size, range[0], range[1]);
      if (!ONE_SHOT.has(key)) {
        if (p === 'translation') holdInPlace(times, vals, node.getTranslation());
        fadeSeam(times, vals, size);
      }
      const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
      const output = doc.createAccessor().setType(size === 4 ? 'VEC4' : 'VEC3').setArray(vals).setBuffer(buffer);
      const smp = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(smp).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(p).setSampler(smp));
    }
    names.push(key);
  }
  return names;
}

// ---------- Tools ----------

/**
 * Attach tools to bones. spec.props: { Axe: { bone, offset:[x,y,z] (m), rot:[x,y,z] (degrees), clips:[…] } }
 * or two-handed { bone, aim: <lead hand>, grip } – then aligned per frame (aim.mjs).
 */
function addProps(doc, spec, uvOf, { colors = false } = {}) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const material = root.listMaterials()[0];
  const nodes = new Map(root.listNodes().map((n) => [n.getName(), n]));
  for (const [name, p] of Object.entries(spec.props ?? {})) {
    const bone = nodes.get(p.bone ?? 'RightHand');
    if (!bone) throw new Error(`Bone ${p.bone} missing`);
    const g = buildTool(name, uvOf);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.nrm).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.uv).setBuffer(buffer))
      .setMaterial(material);
    if (colors) {
      prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(g.col.map(srgbToLinear)).setBuffer(buffer));
      prim.setAttribute('_TEAM', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(g.pos.length / 3)).setBuffer(buffer));
    }
    const mesh = doc.createMesh(name).addPrimitive(prim);
    // bones are in cm (armature scale 0.01): compensate the bone's world scale
    const wm = bone.getWorldMatrix();
    const ws = Math.hypot(wm[0], wm[1], wm[2]);
    const [rx, ry, rz] = (p.rot ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180);
    const q = eulerQuat(rx, ry, rz);
    const node = doc.createNode(name).setMesh(mesh).setScale([1 / ws, 1 / ws, 1 / ws])
      .setTranslation((p.offset ?? [0, 0, 0]).map((v) => v / ws)).setRotation(q);
    bone.addChild(node);
    if (p.aim) aimProp(doc, node, p); // two-handed: align between the hands per frame
  }
}

/** sRGB (0–1) → linear (glTF vertex colours are linear). */
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function eulerQuat(x, y, z) { // XYZ order like three.js
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

// ---------- Textures ----------

/** Texture of the character as raw RGB data at target size. */
async function readTexture(doc, size) {
  const tex = doc.getRoot().listTextures()[0];
  const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Colour at a UV position (glTF: v from the top). */
const sampler = (tex) => (u, v) => {
  const x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h)));
  const o = (y * tex.w + x) * 3;
  return [tex.data[o], tex.data[o + 1], tex.data[o + 2]];
};

/** The skinned mesh of the character: attributes as arrays and bone names. */
function skinnedGeometry(doc) {
  const root = doc.getRoot();
  const prim = root.listMeshes().flatMap((m) => m.listPrimitives()).find((p) => p.getAttribute('JOINTS_0'));
  const joints = root.listSkins()[0]?.listJoints().map((j) => j.getName()) ?? [];
  const A = (k) => prim.getAttribute(k)?.getArray();
  return { prim, joints, g: { pos: A('POSITION'), uv: A('TEXCOORD_0'), idx: prim.getIndices().getArray(), joints: A('JOINTS_0'), weights: A('WEIGHTS_0') } };
}

/** Head regions and – with spec.beard = 'hair' – the colour shift beard → hair. */
function regionsOf(g, joints, sample, spec) {
  const info = triangleInfo(g, joints, sample);
  const reg = headRegions(info, (i) => markerWeight(...info[i].rgb) > 0.5);
  let beardShift = null;
  if (spec.beard === 'hair') {
    const hair = meanLab(info, reg.hair), beard = meanLab(info, reg.beard);
    if (hair && beard) beardShift = { hair, beard };
  }
  return { info, reg, beardShift };
}

/**
 * Team area per triangle from all its pixels: fraction of pure marker colour (seed) and fraction including
 * darkened marker colour (growth via neighbours, growMarker).
 */
function markerTriangles(id, data, g) {
  const nt = g.idx.length / 3;
  const cnt = new Uint32Array(nt), st = new Float32Array(nt), rl = new Float32Array(nt);
  for (let i = 0; i < id.length; i++) {
    const t = id[i];
    if (t < 0) continue;
    const r = data[i * 3], gg = data[i * 3 + 1], b = data[i * 3 + 2];
    cnt[t]++;
    if (markerWeight(r, gg, b) > 0.5) st[t]++;
    if (markerWeightRelaxed(r, gg, b) > 0.5) rl[t]++;
  }
  for (let t = 0; t < nt; t++) if (cnt[t]) { st[t] /= cnt[t]; rl[t] /= cnt[t]; }
  return growMarker(st, rl, triangleAdjacency(g.pos, g.idx));
}

/** Match a pixel (RGB in buf from o) to the hair colour via Lab. */
function recolorBeard(buf, o, shift) {
  const lab = shiftBeard(rgbToLab(buf[o], buf[o + 1], buf[o + 2]), shift.beard, shift.hair);
  const [r, g, b] = labToRgb(...lab);
  buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
}

/**
 * Finish the texture: append the tool colour strip at the bottom (body UV are squeezed into the upper part),
 * attach tools, set the texture, write the mask (R = player colour, same UV) – large textures at half size.
 */
async function finishTexture(doc, spec, rgb, mask, W, H, maskFile, hasProps, format = 'jpeg') {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const tex = root.listTextures()[0];
  const strip = hasProps ? Math.max(8, Math.round(W / 64)) : 0;
  const H2 = H + strip;
  const out = Buffer.alloc(W * H2 * 3);
  Buffer.from(rgb.buffer, rgb.byteOffset, W * H * 3).copy(out, 0);
  const m2 = Buffer.alloc(W * H2 * 3);
  for (let i = 0; i < W * H; i++) m2[i * 3] = mask[i];
  if (hasProps) {
    const cw = Math.floor(W / SWATCH_KEYS.length);
    SWATCH_KEYS.forEach((k, i) => {
      const c = parseInt(SWATCHES[k].slice(1), 16);
      for (let y = H; y < H2; y++) for (let x = i * cw; x < (i + 1) * cw; x++) {
        const o = (y * W + x) * 3; out[o] = c >> 16; out[o + 1] = (c >> 8) & 255; out[o + 2] = c & 255;
      }
    });
    const k = H / H2;
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!uv) continue;
      const a = new Float32Array(uv.getArray());
      for (let i = 1; i < a.length; i += 2) a[i] *= k;
      prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(a).setBuffer(buffer));
    }
    addProps(doc, spec, (sw) => [(SWATCH_KEYS.indexOf(sw) + 0.5) * cw / W, (H + strip / 2) / H2]);
  }
  const img = sharp(out, { raw: { width: W, height: H2, channels: 3 } });
  if (format === 'png') tex.setImage(await img.png({ compressionLevel: 9 }).toBuffer()).setMimeType('image/png');
  else tex.setImage(await img.jpeg({ quality: 86, mozjpeg: true }).toBuffer()).setMimeType('image/jpeg');
  let ms = sharp(m2, { raw: { width: W, height: H2, channels: 3 } });
  if (W >= 2048) ms = ms.resize(W / 2, Math.round(H2 / 2));
  await ms.png({ compressionLevel: 9 }).toFile(maskFile);
}

/**
 * Near model: Meshy texture (spec.textureSize). Team-colour mask from the triangles: only triangles whose
 * pixels are to a notable part marker colour get a mask (per pixel by marker fraction);
 * isolated magenta speckles in other triangles are painted over with their base colour. Edges of the UV islands
 * fill from the own island – nothing runs into foreign areas. Optionally beard → hair colour.
 * @returns {Promise<number>} fraction of the team area in the texture
 */
async function detailTexture(doc, spec, maskFile, hasProps) {
  const S = spec.textureSize ?? 1024;
  const tex = await readTexture(doc, S);
  const { g, joints } = skinnedGeometry(doc);
  const { reg, beardShift } = regionsOf(g, joints, sampler(tex), spec);
  const brownFor = greenToBrownFor(spec, reg);
  const id = rasterTriangles(g.uv, g.idx, S, S);
  const nt = g.idx.length / 3, N = S * S, d = tex.data;
  const team = markerTriangles(id, d, g);
  const w = new Float32Array(N), base = new Float64Array(nt * 4);
  for (let i = 0; i < N; i++) {
    const t = id[i];
    if (t < 0) continue;
    w[i] = team[t] ? markerWeightRelaxed(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]) : markerWeight(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
    if (w[i] < 0.2) { base[t * 4] += d[i * 3]; base[t * 4 + 1] += d[i * 3 + 1]; base[t * 4 + 2] += d[i * 3 + 2]; base[t * 4 + 3]++; }
  }
  const mask = new Uint8Array(N);
  let marked = 0;
  for (let i = 0; i < N; i++) {
    const t = id[i];
    if (t < 0) continue;
    if (team[t]) {
      mask[i] = Math.round(w[i] * 255);
      if (mask[i]) {
        // marker area neutral grey, brightness stays (the shader recolours to the player colour)
        marked++;
        const k = w[i], v = Math.max(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]) * 0.62;
        for (let c = 0; c < 3; c++) d[i * 3 + c] = Math.round(d[i * 3 + c] + (v - d[i * 3 + c]) * k);
      }
    } else if (w[i] > 0 && base[t * 4 + 3] > 0) {
      for (let c = 0; c < 3; c++) d[i * 3 + c] = Math.round(d[i * 3 + c] + (base[t * 4 + c] / base[t * 4 + 3] - d[i * 3 + c]) * w[i]);
    }
    if (beardShift && reg.beard[t]) recolorBeard(d, i * 3, beardShift);
    // clothing: green/olive → brown (hue only; folds and shadows stay)
    if (brownFor && !mask[i] && brownFor(t)) {
      const lab = rgbToLab(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
      if (isGreenish(lab)) {
        const [r, gg, b] = labToRgb(...toBrown(lab, spec.greenToBrown));
        d[i * 3] = r; d[i * 3 + 1] = gg; d[i * 3 + 2] = b;
      }
    }
  }
  fillGutters(id, S, S, [{ data: d, ch: 3 }, { data: mask, ch: 1 }], 6);
  await finishTexture(doc, spec, d, mask, S, S, maskFile, hasProps, 'jpeg');
  return marked / N;
}

/**
 * Colours as from Meshy (spec.keepColors): base colour and normal map stay unchanged, only
 *  - scaled down to `size`,
 *  - the gaps between the UV islands filled completely with the edge colour of the own island (otherwise when
 *    scaling down via mipmaps foreign colours run into the edges: light lines),
 *  - a strip with the tool colours at the bottom (normal map flat there).
 * The team area stays magenta; the game recolours it when drawing (manifest `teamMarker`).
 * Metal/roughness and emissive textures are dropped (the game sets fixed values).
 */
async function keepTexture(doc, spec, size, hasProps) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const mat = root.listMaterials()[0];
  const { g } = skinnedGeometry(doc);
  const W = size, H = size;
  const id = rasterTriangles(g.uv, g.idx, W, H);
  const decode = async (t) => (await sharp(Buffer.from(t.getImage())).resize(W, H).removeAlpha().raw().toBuffer());
  const baseTex = mat.getBaseColorTexture(), nrmTex = mat.getNormalTexture();
  const base = await decode(baseTex);
  const nrm = nrmTex ? await decode(nrmTex) : null;
  fillGutters(id, W, H, [{ data: base, ch: 3 }, ...(nrm ? [{ data: nrm, ch: 3 }] : [])], W);
  const strip = hasProps ? Math.max(8, Math.round(W / 64)) : 0;
  const H2 = H + strip;
  const grow = (src, fill) => {
    const out = Buffer.alloc(W * H2 * 3);
    src.copy(out, 0);
    for (let y = H; y < H2; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; out[o] = fill(x)[0]; out[o + 1] = fill(x)[1]; out[o + 2] = fill(x)[2]; }
    return out;
  };
  const cw = Math.floor(W / SWATCH_KEYS.length);
  const swatch = (x) => { const c = parseInt(SWATCHES[SWATCH_KEYS[Math.min(SWATCH_KEYS.length - 1, Math.floor(x / cw))]].slice(1), 16); return [c >> 16, (c >> 8) & 255, c & 255]; };
  const b2 = strip ? grow(base, swatch) : base;
  const n2 = nrm && strip ? grow(nrm, () => [128, 128, 255]) : nrm;
  if (strip) {
    const k = H / H2;
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const uv = prim.getAttribute('TEXCOORD_0');
      if (!uv) continue;
      const a = new Float32Array(uv.getArray());
      for (let i = 1; i < a.length; i += 2) a[i] *= k;
      prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(a).setBuffer(buffer));
    }
    addProps(doc, spec, (sw) => [(SWATCH_KEYS.indexOf(sw) + 0.5) * cw / W, (H + strip / 2) / H2]);
  }
  const jpg = (buf) => sharp(buf, { raw: { width: W, height: H2, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  baseTex.setImage(await jpg(b2)).setMimeType('image/jpeg');
  if (nrmTex) nrmTex.setImage(await jpg(n2)).setMimeType('image/jpeg');
  mat.setMetallicRoughnessTexture(null).setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]).setOcclusionTexture(null);
}

/** Lab distance of two sRGB colours (0–255). */
function deltaE(c1, c2) {
  const a = rgbToLab(...c1), b = rgbToLab(...c2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
const hexRgb = (h) => { const c = parseInt(h.slice(1), 16); return [c >> 16, (c >> 8) & 255, c & 255]; };

/** Green or olive (hue 92°–170° in Lab, clearly chromatic)? Brown, ochre and skin lie below. */
export function isGreenish(lab) {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return Math.hypot(lab[1], lab[2]) > 12 && h >= 92 && h <= 170;
}

/**
 * Green → brown (spec.greenToBrown = { hue?: 62, maxChroma?: 38 }): green and olive clothing gets the
 * hue of brown; brightness and shading stay as in the concept. Green camouflages on grass and is a
 * player colour. Head, skin and team area stay untouched.
 * @returns {null | ((t:number) => boolean)} does the rule apply to triangle t?
 */
function greenToBrownFor(spec, reg) {
  if (!spec.greenToBrown) return null;
  return (t) => !reg.head[t] && !reg.skin[t];
}

/** Rotate the hue of a Lab colour to brown (brightness stays, chroma at most maxChroma). */
export function toBrown(lab, o = {}) {
  const h = ((o.hue ?? 62) * Math.PI) / 180;
  const c = Math.min(Math.hypot(lab[1], lab[2]), o.maxChroma ?? 38);
  return [lab[0], Math.cos(h) * c, Math.sin(h) * c];
}

/**
 * Game model: flat colour per triangle as **vertex colour** (COLOR_0), without texture. A texture is scaled down in the distance via
 * mipmaps, and the colour islands run into each other (lines, blotches) – vertex colours stay clean at any
 * distance. Palette via k-means, smoothed over neighbours; face triangles keep their own
 * mean colour (eyes, mouth as dark areas). Team area as vertex attribute _TEAM (0/1).
 * spec.recolor: [{ from: '#rrggbb', to: '#rrggbb', within?: ΔE }] – recolour clothing (not head).
 * spec.greenToBrown: rotate green/olive of the clothing in hue to brown (see toBrown).
 * @returns {Promise<number>} fraction of the team area (triangles)
 */
async function flatColors(doc, spec, hasProps) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const S = 1024;
  const hi = await readTexture(doc, S);
  const { prim, g, joints } = skinnedGeometry(doc);
  const nt = g.idx.length / 3;
  const id = rasterTriangles(g.uv, g.idx, S, S);
  const markerTris = markerTriangles(id, hi.data, g);
  // mean colour per triangle (without marker colour) for the face
  const sum = new Float64Array(nt * 4);
  for (let i = 0; i < id.length; i++) {
    const t = id[i];
    if (t < 0) continue;
    const r = hi.data[i * 3], gg = hi.data[i * 3 + 1], b = hi.data[i * 3 + 2];
    if (markerWeightRelaxed(r, gg, b) > 0.3) continue;
    sum[t * 4] += r; sum[t * 4 + 1] += gg; sum[t * 4 + 2] += b; sum[t * 4 + 3]++;
  }
  // Colours as muted as in the concept (no boost – it turned olive into a garish green)
  const pal = paletteize(hi, [g], markerWeight, { colors: 12, smooth: 2, saturation: 1, ...spec.flat, markerTris: [markerTris] });
  const labels = pal.labels[0];
  // Remove isolated team triangles, close holes in team areas (neighbourhood by area)
  for (let it = 0; it < 2; it++) {
    const next = Int32Array.from(labels);
    for (let t = 0; t < nt; t++) {
      const nb = pal.neighbors[t];
      if (!nb.length) continue;
      let m = 0, all = 0;
      const other = new Map();
      for (const j of nb) {
        all += pal.area[j];
        if (labels[j] === pal.marker) m += pal.area[j];
        else other.set(labels[j], (other.get(labels[j]) ?? 0) + pal.area[j]);
      }
      const frac = m / Math.max(1e-12, all);
      if (labels[t] === pal.marker && frac < 0.25 && other.size) next[t] = [...other].sort((a, b) => b[1] - a[1])[0][0];
      else if (labels[t] !== pal.marker && frac > 0.75) next[t] = pal.marker;
    }
    labels.set(next);
  }
  const { reg, beardShift } = regionsOf(g, joints, sampler(hi), spec);
  const brownFor = greenToBrownFor(spec, reg);
  let hairLabel;
  if (beardShift) {
    const area = new Map();
    reg.hair.forEach((h, t) => { if (h) area.set(labels[t], (area.get(labels[t]) ?? 0) + 1); });
    hairLabel = [...area].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  const rules = (spec.recolor ?? []).map((r) => ({ from: hexRgb(r.from), to: hexRgb(r.to), within: r.within ?? 18 }));
  const colorOf = (t) => {
    const L = labels[t];
    if (L === pal.marker) return [140, 140, 140];
    if (reg.face[t] && sum[t * 4 + 3] > 0) {
      const c = [0, 1, 2].map((k) => sum[t * 4 + k] / sum[t * 4 + 3]);
      if (beardShift && reg.beard[t]) { const tmp = Buffer.from(c.map(Math.round)); recolorBeard(tmp, 0, beardShift); return [...tmp]; }
      return c;
    }
    let c = pal.palette[beardShift && reg.beard[t] && hairLabel !== undefined ? hairLabel : L];
    if (!reg.head[t]) for (const r of rules) if (deltaE(c, r.from) < r.within) { c = r.to; break; }
    if (brownFor && brownFor(t)) { const lab = rgbToLab(...c); if (isGreenish(lab)) c = labToRgb(...toBrown(lab, spec.greenToBrown)); }
    return c;
  };
  // Share vertices per (original vertex, colour); keep all attributes, plus COLOR_0 (linear) and _TEAM
  const colors = Array.from({ length: nt }, (_, t) => colorOf(t).map((x) => Math.round(x)));
  const map = new Map(), src = [], col = [], team = [], out = new Uint32Array(g.idx.length);
  let marked = 0;
  for (let t = 0; t < nt; t++) {
    const c = colors[t], tm = labels[t] === pal.marker ? 1 : 0;
    marked += tm;
    for (let k = 0; k < 3; k++) {
      const v = g.idx[t * 3 + k], key = `${v}:${c[0]},${c[1]},${c[2]}:${tm}`;
      let n = map.get(key);
      if (n === undefined) { n = src.length; map.set(key, n); src.push(v); col.push(...c.map((x) => srgbToLinear(x / 255))); team.push(tm); }
      out[t * 3 + k] = n;
    }
  }
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem), n = a.getElementSize(), arr = a.getArray();
    const na = new arr.constructor(src.length * n);
    src.forEach((sv, i) => { for (let c = 0; c < n; c++) na[i * n + c] = arr[sv * n + c]; });
    prim.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(na).setBuffer(buffer).setNormalized(a.getNormalized()));
  }
  prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(col)).setBuffer(buffer));
  prim.setAttribute('_TEAM', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(team)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(out).setBuffer(buffer));
  // No texture: colour comes from the vertices
  for (const mat of root.listMaterials()) mat.setBaseColorTexture(null);
  for (const tex of root.listTextures()) tex.dispose();
  if (hasProps) addProps(doc, spec, () => [0, 0], { colors: true });
  return marked / nt;
}

// ---------- Ablauf ----------

/** Smooth normals (all meshes). */
function smoothAll(doc) {
  const root = doc.getRoot();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pa = prim.getAttribute('POSITION'), ia = prim.getIndices();
    if (!pa || !ia) continue;
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(smoothNormals(pa.getArray(), ia.getArray())).setBuffer(root.listBuffers()[0]));
  }
}

/** Remove animations (LOD files carry none; the game takes the clips of the original). */
function dropAnimations(doc) {
  for (const a of doc.getRoot().listAnimations()) {
    for (const smp of a.listSamplers()) { smp.getInput()?.dispose(); smp.getOutput()?.dispose(); smp.dispose(); }
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
}

async function finish(doc, model, file) {
  for (const mat of doc.getRoot().listMaterials()) mat.setName(model).setMetallicFactor(0).setRoughnessFactor(0.85);
  await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(file, doc);
  return (fs.statSync(file).size / 1024).toFixed(0);
}

const lodsOf = (file, ratios, errors, out) => execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-lods.mjs'), file,
  '--ratios', ratios, '--errors', errors, '--keep-textures', '--strict-seams', '--out', out], { stdio: 'inherit' });

/**
 * Insert the far model (own Meshy model, without rig) into the rig of the near model: geometry, UV and texture
 * of the far model, skin weights transferred from the near model (farmesh.mjs).
 */
async function buildFar(doc, farDir) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const farFile = ['remeshed.glb', 'raw.glb'].map((f) => path.join(farDir, f)).find((f) => fs.existsSync(f));
  const far = await io.read(farFile);
  // geometry of the far model in world coordinates
  let fpos = [], fuv = [], fidx = [];
  for (const node of far.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray();
      const idx = prim.getIndices()?.getArray() ?? Array.from({ length: p.length / 3 }, (_, i) => i);
      const base = fpos.length / 3;
      for (let i = 0; i < p.length; i += 3) {
        const [x, y, z] = [p[i], p[i + 1], p[i + 2]];
        fpos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      fuv.push(...uv);
      for (const i of idx) fidx.push(i + base);
    }
  }
  const prim = root.listMeshes().flatMap((x) => x.listPrimitives()).find((p) => p.getAttribute('JOINTS_0'));
  const nearPos = prim.getAttribute('POSITION').getArray();
  const pos = fitTo(new Float32Array(fpos), nearPos);
  const { joints, weights } = transferWeights({
    pos: nearPos, joints: prim.getAttribute('JOINTS_0').getArray(), weights: prim.getAttribute('WEIGHTS_0').getArray(),
  }, pos);
  const J = prim.getAttribute('JOINTS_0').getArray().constructor;
  for (const sem of prim.listSemantics()) prim.setAttribute(sem, null);
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  prim.setAttribute('POSITION', acc('VEC3', pos)).setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(fuv)))
    .setAttribute('JOINTS_0', acc('VEC4', new J(joints))).setAttribute('WEIGHTS_0', acc('VEC4', weights))
    .setIndices(acc('SCALAR', new Uint32Array(fidx)));
  // textures of the far model (base colour, if present normal map) into the slots of the material
  const fm = far.getRoot().listMaterials()[0], dm = root.listMaterials()[0];
  const copy = (src, dst) => { if (src && dst) dst.setImage(src.getImage()).setMimeType(src.getMimeType()); };
  copy(fm.getBaseColorTexture() ?? far.getRoot().listTextures()[0], dm.getBaseColorTexture() ?? root.listTextures()[0]);
  if (fm.getNormalTexture() && dm.getNormalTexture()) copy(fm.getNormalTexture(), dm.getNormalTexture());
  else dm.setNormalTexture(null);
  smoothAll(doc);
  return pos.length / 3;
}

/**
 * Lean path (spec.keepColors, Meshy 7.1 with PBR): colours and normal map as from Meshy, team area stays
 * magenta (the game recolours when drawing). Near model = rigged.glb, game model = the same model reduced by remesh
 * (spec.far, e.g. remeshOf), with its own smaller texture. Meshy's normals stay (they match the normal map).
 */
async function keepColorsModel(dir, spec, model, rigged, hasProps, out, lods) {
  const doc = await io.read(rigged);
  const rigid = applyRigid(doc, spec.rigid);
  if (rigid.length) console.log(`Bound rigidly: ${rigid.join(', ')}`);
  if (spec.remove) console.log(`Removed: ${removeCylinder(doc, spec.remove)} triangles`);
  const clips = await importClips(doc, dir, spec);
  await keepTexture(doc, spec, spec.textureSize ?? 2048, hasProps);
  const kb = await finish(doc, model, out('.glb'));
  console.log(`${model}.glb: ${kb} KB, clips ${clips.join(', ')}`);
  if (lods && spec.far) {
    const game = await io.read(rigged);
    dropAnimations(game);
    applyRigid(game, spec.rigid); // the far model takes over the weights of the near model
    const n = await buildFar(game, path.join(SRC_DIR, spec.far));
    removeCylinder(game, spec.remove);
    await keepTexture(game, spec, spec.farTextureSize ?? 1024, hasProps);
    const kb1 = await finish(game, model, out('.lod1.glb'));
    console.log(`${model}.lod1.glb: game model from ${spec.far}, ${n} vertices, ${kb1} KB`);
  }
  const entry = {
    lods: lods && spec.far ? 1 : 0, height: spec.height ?? 0.95, teamMarker: true,
    clips: Object.fromEntries(clips.map((c) => [c, c])),
    ...(hasProps ? { props: Object.fromEntries(Object.entries(spec.props).map(([k, p]) => [k, p.clips])) } : {}),
  };
  console.log(`Manifest models.${model}:\n${JSON.stringify(entry)}`);
  return entry;
}

/**
 * Two representations per character – each with its own mesh and its own look:
 *  - level 0, near model (only large on screen): Meshy model with detail texture, animations, tools
 *    → <model>.glb, mask <model>.mask.png
 *  - level 1, game model (normal game height and farther): own simplified far model (spec.far) put onto the
 *    skeleton, flat vertex colours, team area as vertex attribute → <model>.lod1.glb (no texture, no mask).
 *    Without spec.far: near model simplified and flat-coloured.
 * Farther away it stays at the game model; the game only throttles the animation there (see lod.js).
 */
export async function postprocess(id, opts = {}) {
  const lods = opts.lods ?? true;
  const dir = path.join(SRC_DIR, id);
  const spec = { ...JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8')), ...opts.spec };
  const model = spec.model;
  const rigged = path.join(dir, 'rigged.glb');
  const hasProps = Object.keys(spec.props ?? {}).length > 0;
  const outDir = opts.outDir ?? OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const out = (suffix) => path.join(outDir, `${model}${suffix}`);
  // remove old level files of this model (the structure may have changed)
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(`${model}.lod`) || f.startsWith(`${model}.far`) || f.startsWith(`${model}.mid`)) fs.unlinkSync(path.join(outDir, f));

  // Level 0: near model (skipped with opts.gameOnly – quick colour variants of the game model)
  if (opts.gameOnly) {
    const game = await io.read(rigged);
    dropAnimations(game);
    await buildFar(game, path.join(SRC_DIR, spec.far));
    await flatColors(game, spec, hasProps);
    await finish(game, model, out('.lod1.glb'));
    return null;
  }
  if (spec.keepColors) return keepColorsModel(dir, spec, model, rigged, hasProps, out, lods);
  const doc = await io.read(rigged);
  const clips = await importClips(doc, dir, spec);
  smoothAll(doc);
  const share = await detailTexture(doc, spec, out('.mask.png'), hasProps);
  const kb = await finish(doc, model, out('.glb'));
  console.log(`${model}.glb: ${kb} KB, clips ${clips.join(', ')}, team area ${(share * 100).toFixed(1)} %`);
  const masks = [`${model}.mask.png`];

  // Level 1: game model
  if (lods) {
    const game = await io.read(rigged);
    dropAnimations(game);
    const n = spec.far ? await buildFar(game, path.join(SRC_DIR, spec.far)) : (smoothAll(game), null);
    const share1 = await flatColors(game, spec, hasProps);
    if (spec.far) await finish(game, model, out('.lod1.glb'));
    else {
      const tmp = out('.mid.tmp.glb');
      await finish(game, model, tmp);
      lodsOf(tmp, '0.35', '0.012', out('.lod{n}.glb'));
      fs.unlinkSync(tmp);
    }
    const kb1 = (fs.statSync(out('.lod1.glb')).size / 1024).toFixed(0);
    console.log(`${model}.lod1.glb: game model${spec.far ? ` from ${spec.far}` : ''}${n ? `, ${n} vertices` : ''}, ${kb1} KB, team area ${(share1 * 100).toFixed(1)} % of the triangles`);
  }
  const entry = {
    lods: lods ? 1 : 0, height: spec.height ?? 0.95, mask: lods ? [masks[0], null] : masks[0],
    clips: Object.fromEntries(clips.map((c) => [c, c])),
    ...(hasProps ? { props: Object.fromEntries(Object.entries(spec.props).map(([k, p]) => [k, p.clips])) } : {}),
  };
  console.log(`Manifest models.${model}:\n${JSON.stringify(entry)}`);
  return entry;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
  await postprocess(args[0], {
    lods: !args.includes('--no-lods'), gameOnly: args.includes('--game-only'),
    outDir: opt('--out-dir'), spec: opt('--spec') ? JSON.parse(opt('--spec')) : undefined,
  });
}
