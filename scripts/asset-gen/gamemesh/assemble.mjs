// Step 4: put the new low mesh (Blender export with normals + MikkTSpace tangents) and the baked images into a copy of
// <Model>.lod1.glb (skeleton, animations, material stay). Skin weights: exact from the nearest near-model vertex.
//   node scripts/asset-gen/gamemesh/assemble.mjs <Model> <dir> <out.glb> [--keep-uv-size]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import { transferWeights } from '../farmesh.mjs';

const [model, dir, outFile] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const read = async (f) => { const d = await io.read(f); await d.transform(dequantize()); return d; };
const arr = (a) => { const n = a.getCount(), s = a.getElementSize(), o = new Float32Array(n * s), t = []; for (let i = 0; i < n; i++) o.set(a.getElement(i, t), i * s); return o; };

const near = await read(`public/models/characters/${model}.glb`);
const np = near.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin()).getMesh().listPrimitives()[0];
const nearData = { pos: arr(np.getAttribute('POSITION')), joints: arr(np.getAttribute('JOINTS_0')), weights: arr(np.getAttribute('WEIGHTS_0')) };

const low = await read(`${dir}/out.low.glb`);
const lp = low.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = arr(lp.getAttribute('POSITION'));
const { joints, weights } = transferWeights(nearData, pos, 1);
// sanity: distance of the low vertices to the nearest near vertex
let maxd = 0;
{ // brute force on a sample
  for (let v = 0; v < pos.length / 3; v += 7) { let best = Infinity; for (let i = 0; i < nearData.pos.length / 3; i++) { const d = (nearData.pos[i * 3] - pos[v * 3]) ** 2 + (nearData.pos[i * 3 + 1] - pos[v * 3 + 1]) ** 2 + (nearData.pos[i * 3 + 2] - pos[v * 3 + 2]) ** 2; if (d < best) best = d; } maxd = Math.max(maxd, Math.sqrt(best)); }
}

const doc = await read(`public/models/characters/${model}.lod1.glb`);
const buf = doc.getRoot().listBuffers()[0];
const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
const prim = node.getMesh().listPrimitives()[0];
const acc = (type, a, normalized = false) => doc.createAccessor().setType(type).setArray(a).setBuffer(buf).setNormalized(normalized);
for (const s of prim.listSemantics()) prim.setAttribute(s, null);
prim.setAttribute('POSITION', acc('VEC3', pos));
prim.setAttribute('NORMAL', acc('VEC3', arr(lp.getAttribute('NORMAL'))));
prim.setAttribute('TANGENT', acc('VEC4', arr(lp.getAttribute('TANGENT'))));
prim.setAttribute('TEXCOORD_0', acc('VEC2', arr(lp.getAttribute('TEXCOORD_0'))));
prim.setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(joints)));
prim.setAttribute('WEIGHTS_0', acc('VEC4', weights));
prim.setIndices(acc('SCALAR', new Uint32Array(lp.getIndices().getArray())));
const mat = prim.getMaterial();
for (const [tex, kind] of [[mat.getBaseColorTexture(), 'color'], [mat.getNormalTexture(), 'normal']]) {
  const jpg = await sharp(`${dir}/out.${kind}.png`).removeAlpha().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
}
for (const a of doc.getRoot().listAccessors()) if (!a.listParents().some((p) => p.propertyType !== 'Root')) a.dispose();
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(outFile, doc);
console.log(JSON.stringify({ out: outFile, tris: lp.getIndices().getCount() / 3, verts: pos.length / 3, maxDistToNear: maxd, size: fs.statSync(outFile).size }));
