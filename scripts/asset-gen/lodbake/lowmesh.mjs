// Low-poly shell from a building GLB: weld by position only (UV/normal seams ignored, we re-bake later),
// then quadric simplification (meshoptimizer) of the pure geometry. Output: OBJ (positions + faces).
// usage: node lowmesh.mjs in.glb out.obj targetTris [flags,comma] [maxError]   env LM_MAXTRIS, LM_UPDATE=0 (plain collapse), LM_LOCKTEAM=0,
//   LM_PARTS=<model> (moving parts simplified on their own)
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
// moving parts (LM_PARTS = model name in MOVING_PARTS, src/render/movingParts.js): rotor and building are simplified
// separately (own vertices), so no collapse joins a sail to the tower and the game's cylinder cut still works
const groupOf = new Uint8Array(tri.length / 3);
if (process.env.LM_PARTS) {
  const { MOVING_PARTS, partAt } = await import('../../../src/render/movingParts.js');
  const { Vector3 } = await import('three');
  const parts = MOVING_PARTS[process.env.LM_PARTS] ?? [];
  const q = new Vector3();
  for (let t = 0; t < tri.length / 3; t++) {
    q.set(0, 0, 0);
    for (let k = 0; k < 3; k++) { const v = tri[t * 3 + k]; q.x += WP[v * 3] / 3; q.y += WP[v * 3 + 1] / 3; q.z += WP[v * 3 + 2] / 3; }
    groupOf[t] = partAt(parts, q) + 1;
  }
}
const nGroups = Math.max(...groupOf) + 1;
const totalTris = tri.length / 3;
const flags = flagStr ? flagStr.split(',') : [];
// one group: own compact vertex list, simplified on its own share of the target
function simplifyGroup(g, targetTris, maxErr) {
  const vmap = new Map(), gp = [], gl = [], gi = [];
  for (let t = 0; t < totalTris; t++) {
    if (groupOf[t] !== g) continue;
    for (let k = 0; k < 3; k++) {
      const v = tri[t * 3 + k];
      let j = vmap.get(v);
      if (j === undefined) { j = vmap.size; vmap.set(v, j); gp.push(WP[v * 3], WP[v * 3 + 1], WP[v * 3 + 2]); gl.push(lock[v]); }
      gi.push(j);
    }
  }
  const idx = new Uint32Array(gi), pos = new Float32Array(gp), lk = new Uint8Array(gl);
  const target = Math.min(idx.length, Math.max(3, Math.round(targetTris) * 3));
  if (process.env.LM_UPDATE !== '0') {
    // simplifyWithUpdate: collapsed vertices move to the quadric optimum (flatter walls, straighter edges)
    const [n, e] = MeshoptSimplifier.simplifyWithUpdate(idx, pos, 3, new Float32Array(0), 0, [], lk, target, maxErr, flags);
    return { out: idx.subarray(0, n), err: e, pos, lock: lk };
  }
  const [o, e] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, new Float32Array(pos.length / 3), 1, [0], lk, target, maxErr, flags);
  return { out: o, err: e, pos, lock: lk };
}
function simplify(targetTris, maxErr) {
  const res = [];
  for (let g = 0; g < nGroups; g++) {
    const n = groupOf.reduce((a, x) => a + (x === g), 0);
    if (n) res.push(simplifyGroup(g, (targetTris * n) / totalTris, maxErr));
  }
  return res;
}
// target: triangle count; maxError: relative error budget (stops at whichever comes first); LM_MAXTRIS caps the count
let res = simplify(Math.min(totalTris, Number(tgt)), Number(errStr));
const count = (r) => r.reduce((a, g) => a + g.out.length / 3, 0);
const maxTris = Number(process.env.LM_MAXTRIS ?? 0);
if (maxTris && count(res) > maxTris) res = simplify(maxTris, 1);
const err = Math.max(...res.map((g) => g.err));
// compact
const V = [], F = [], teamPos = [];
for (const g of res) {
  const used = new Map();
  for (let i = 0; i < g.out.length; i++) {
    let j = used.get(g.out[i]);
    if (j === undefined) {
      j = V.length / 3; used.set(g.out[i], j);
      const k = g.out[i] * 3;
      V.push(g.pos[k], g.pos[k + 1], g.pos[k + 2]);
      // positions of the team-coloured (locked) vertices that survived: finalize.mjs keeps magenta only on triangles made of them
      if (g.lock[g.out[i]]) teamPos.push([g.pos[k], g.pos[k + 1], g.pos[k + 2]]);
    }
    F.push(j + 1);
  }
}
let s = '';
for (let i = 0; i < V.length; i += 3) s += `v ${V[i]} ${V[i + 1]} ${V[i + 2]}\n`;
for (let i = 0; i < F.length; i += 3) s += `f ${F[i]} ${F[i + 1]} ${F[i + 2]}\n`;
writeFileSync(dst, s);
writeFileSync(dst.replace(/\.obj$/, '.team.json'), JSON.stringify(teamPos));
console.log(`team-locked ${nLock}, in ${tri.length / 3} tris (${WP.length / 3} welded verts) -> ${F.length / 3} tris, rel. error ${(err).toFixed(4)}`);
