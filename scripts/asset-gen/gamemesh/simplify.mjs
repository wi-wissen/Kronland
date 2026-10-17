// Step 1: simplify the near model's body mesh with meshoptimizer, head region weighted.
//   node scripts/asset-gen/gamemesh/simplify.mjs <Model> <targetTris> <headFactor> <outDir> [uvHeadFactor]
// Writes <outDir>/low.obj (positions in raw mesh space, faces), <outDir>/low_uvin.obj (head magnified, for xatlas chart sizes)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const [model, target = '2400', headF = '2.5', outDir, uvF = '1.6'] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(`public/models/characters/${model}.glb`);
await doc.transform(dequantize());
const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
const prim = node.getMesh().listPrimitives()[0];
const joints = node.getSkin().listJoints().map((j) => j.getName());
const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
const n = P.getCount();
const pos = new Float32Array(n * 3), tmp = [];
for (let i = 0; i < n; i++) pos.set(P.getElement(i, tmp), i * 3);
const idx0 = prim.getIndices().getArray();

// head weight per vertex
const HEAD = { Head: 1, head_end: 1, headfront: 1, neck: 0.5 };
const head = new Float32Array(n);
const jw = [], ww = [];
for (let i = 0; i < n; i++) {
  J.getElement(i, jw); W.getElement(i, ww);
  let h = 0; for (let c = 0; c < 4; c++) h += (HEAD[joints[jw[c]]] ?? 0) * ww[c];
  head[i] = Math.min(1, h);
}
// weld by position
const remap = MeshoptSimplifier.generatePositionRemap(pos, 3);
const idx = new Uint32Array(idx0.length);
for (let i = 0; i < idx0.length; i++) idx[i] = remap[idx0[i]];
// head centre
let hc = [0, 0, 0], hs = 0;
for (let i = 0; i < n; i++) if (head[i] > 0.8) { for (let c = 0; c < 3; c++) hc[c] += pos[i * 3 + c]; hs++; }
hc = hc.map((v) => v / hs);
const magnify = (F) => {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) { const s = 1 + (F - 1) * head[i]; for (let c = 0; c < 3; c++) out[i * 3 + c] = hc[c] + (pos[i * 3 + c] - hc[c]) * s; }
  return out;
};
const mpos = magnify(Number(headF));
// smooth normals on welded mesh as attributes (keeps creases like the brim edge)
const nrm = new Float32Array(n * 3);
for (let t = 0; t < idx.length; t += 3) {
  const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
  const e1 = [0, 1, 2].map((k) => pos[b * 3 + k] - pos[a * 3 + k]), e2 = [0, 1, 2].map((k) => pos[c * 3 + k] - pos[a * 3 + k]);
  const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v * 3 + k] += f[k];
}
for (let i = 0; i < n; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) nrm[i * 3 + k] /= l; }
const aw = Number(process.env.NW ?? 0.4);
const flags = (process.env.FLAGS ?? 'Regularize').split(',').filter(Boolean);
const [out, err] = MeshoptSimplifier.simplifyWithAttributes(idx, mpos, 3, nrm, 3, [aw, aw, aw], null, Number(target) * 3, 1, flags);
// compact
const used = new Map(); const vlist = [];
const faces = new Uint32Array(out.length);
for (let i = 0; i < out.length; i++) { const v = out[i]; if (!used.has(v)) { used.set(v, vlist.length); vlist.push(v); } faces[i] = used.get(v); }
let headTris = 0; for (let t = 0; t < out.length; t += 3) if ((head[out[t]] + head[out[t + 1]] + head[out[t + 2]]) / 3 > 0.5) headTris++;
let headTris0 = 0; for (let t = 0; t < idx.length; t += 3) if ((head[idx[t]] + head[idx[t + 1]] + head[idx[t + 2]]) / 3 > 0.5) headTris0++;
fs.mkdirSync(outDir, { recursive: true });
const writeObj = (file, P) => {
  let s = '';
  for (const v of vlist) s += `v ${P[v * 3]} ${P[v * 3 + 1]} ${P[v * 3 + 2]}\n`;
  for (let t = 0; t < faces.length; t += 3) s += `f ${faces[t] + 1} ${faces[t + 1] + 1} ${faces[t + 2] + 1}\n`;
  fs.writeFileSync(path.join(outDir, file), s);
};
writeObj('low.obj', pos);
writeObj('low_uvin.obj', magnify(Number(uvF)));
console.log(JSON.stringify({ model, tris: out.length / 3, verts: vlist.length, err, headTris, headTris0, tris0: idx.length / 3 }));
