// Low-poly shell from a building GLB: weld by position only (UV/normal seams ignored, we re-bake later),
// then quadric simplification (meshoptimizer) of the pure geometry. Output: OBJ (positions + faces).
// usage: node lowmesh.mjs in.glb out.obj targetTris [flags,comma] [maxError]   env LM_MAXTRIS, LM_UPDATE=0 (plain collapse), LM_LOCKTEAM=0
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

// same rule as markerWeightSrgb in src/render/characters.js (team colour magenta)
function markerWeightSrgb(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 51 || d === 0) return 0;
  let h;
  if (mx === r) h = (60 * (g - b)) / d; else if (mx === g) h = 120 + (60 * (b - r)) / d; else h = 240 + (60 * (r - g)) / d;
  if (h < 0) h += 360;
  const cl = (x) => Math.min(1, Math.max(0, x));
  const hue = h < 295 ? cl((h - 285) / 10) : 1 - cl((h - 342) / 10);
  return hue * cl((d / mx - 0.25) / 0.15);
}

await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [src, dst, tgt, flagStr = '', errStr = '1'] = process.argv.slice(2);
const doc = await io.read(src);
await doc.transform(dequantize());

// collect world-space positions of all primitives
const P = [], I = [], TEAM = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), base = P.length / 3, v = [];
    const uv = prim.getAttribute('TEXCOORD_0'), tex = prim.getMaterial()?.getBaseColorTexture();
    let img = null;
    if (uv && tex) img = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // team colour per vertex sample; a face counts as pennant when its centroid and at least two corners are magenta
    // (single magenta texels at island borders elsewhere in the atlas must not lock geometry)
    const sample = (u, w) => {
      const W = img.info.width, Hh = img.info.height;
      const x = Math.min(W - 1, Math.max(0, Math.floor((u - Math.floor(u)) * W))), y = Math.min(Hh - 1, Math.max(0, Math.floor((w - Math.floor(w)) * Hh)));
      const k = (y * W + x) * 3;
      return markerWeightSrgb(img.data[k], img.data[k + 1], img.data[k + 2]) > 0.5 ? 1 : 0;
    };
    const vt = [];
    for (let i = 0; i < pos.getCount(); i++) { vt.push(0); }
    if (img) {
      const idx0 = prim.getIndices(), t = [[], [], []];
      for (let f = 0; f < idx0.getCount(); f += 3) {
        const c = [0, 1, 2].map((j) => idx0.getScalar(f + j));
        c.forEach((k, j) => uv.getElement(k, t[j]));
        const corners = t.reduce((a, q) => a + sample(q[0], q[1]), 0);
        const mid = sample((t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3);
        if (mid && corners >= 2) for (const k of c) vt[k] = 1;
      }
    }
    TEAM.push(...vt);
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      const [x, y, z] = v;
      P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    const idx = prim.getIndices();
    if (idx) for (let i = 0; i < idx.getCount(); i++) I.push(base + idx.getScalar(i));
    else for (let i = 0; i < pos.getCount(); i++) I.push(base + i);
  }
}
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
// weld
const eps = size * 2e-5, map = new Map(), remap = new Int32Array(P.length / 3), WP = [];
for (let i = 0; i < P.length / 3; i++) {
  const key = `${Math.round(P[i * 3] / eps)},${Math.round(P[i * 3 + 1] / eps)},${Math.round(P[i * 3 + 2] / eps)}`;
  let j = map.get(key);
  if (j === undefined) { j = WP.length / 3; map.set(key, j); WP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); }
  remap[i] = j;
}
const lock = new Uint8Array(WP.length / 3);
if (process.env.LM_LOCKTEAM !== '0') for (let i = 0; i < remap.length; i++) if (TEAM[i]) lock[remap[i]] = 1;
let nLock = 0; for (const l of lock) nLock += l;
const tri = [];
for (let i = 0; i < I.length; i += 3) {
  const a = remap[I[i]], b = remap[I[i + 1]], c = remap[I[i + 2]];
  if (a !== b && b !== c && a !== c) tri.push(a, b, c);
}
const positions = new Float32Array(WP), indices = new Uint32Array(tri);
const target = Math.min(indices.length, Number(tgt) * 3);
const flags = flagStr ? flagStr.split(',') : [];
function simplify(target, maxErr) {
  const idx = indices.slice(), pos = positions.slice();
  if (process.env.LM_UPDATE !== '0') {
    // simplifyWithUpdate: collapsed vertices move to the quadric optimum (flatter walls, straighter edges)
    const [n, e] = MeshoptSimplifier.simplifyWithUpdate(idx, pos, 3, new Float32Array(0), 0, [], lock, target, maxErr, flags);
    return { out: idx.subarray(0, n), err: e, pos };
  }
  const [o, e] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, new Float32Array(WP.length / 3), 1, [0], lock, target, maxErr, flags);
  return { out: o, err: e, pos };
}
// target: triangle count; maxError: relative error budget (stops at whichever comes first); LM_MAXTRIS caps the count
let res = simplify(target, Number(errStr));
const maxTris = Number(process.env.LM_MAXTRIS ?? 0);
if (maxTris && res.out.length / 3 > maxTris) res = simplify(maxTris * 3, 1);
const { out, err } = res;
positions.set(res.pos);
// compact
const used = new Map(), V = [];
const F = [];
for (let i = 0; i < out.length; i++) {
  let j = used.get(out[i]);
  if (j === undefined) { j = used.size; used.set(out[i], j); V.push(positions[out[i] * 3], positions[out[i] * 3 + 1], positions[out[i] * 3 + 2]); }
  F.push(j + 1);
}
let s = '';
for (let i = 0; i < V.length; i += 3) s += `v ${V[i]} ${V[i + 1]} ${V[i + 2]}\n`;
for (let i = 0; i < F.length; i += 3) s += `f ${F[i]} ${F[i + 1]} ${F[i + 2]}\n`;
writeFileSync(dst, s);
// positions of the team-coloured (locked) vertices that survived: finalize.mjs keeps magenta only on triangles made of them
const teamPos = [];
for (const [src, j] of used) if (lock[src]) teamPos.push([V[j * 3], V[j * 3 + 1], V[j * 3 + 2]]);
writeFileSync(dst.replace(/\.obj$/, '.team.json'), JSON.stringify(teamPos));
console.log(`team-locked ${nLock}, in ${tri.length / 3} tris (${WP.length / 3} welded verts) -> ${out.length / 3} tris, rel. error ${(err).toFixed(4)}`);
