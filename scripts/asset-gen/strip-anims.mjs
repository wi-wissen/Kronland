// Shrink motion files (anim-*.glb) losslessly: for every clip Meshy delivers the complete model including texture
// (~4–8 MB). postprocess.mjs only needs the motion tracks and the bone names – mesh, skin, material and
// texture are dropped (~20–50 KB per file).
//
//   node scripts/asset-gen/strip-anims.mjs            all characters under assets-src/characters
//   node scripts/asset-gen/strip-anims.mjs <id> …     only these
//
// Note: render.mjs shows shrunk files without a character – preview then with the finished game file
// (public/models/characters/<model>.glb, --clip <key>).

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { SRC_DIR } from './lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export async function stripAnim(file) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  if (!root.listMeshes().length && !root.listTextures().length) return null; // already shrunk
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMeshes()) m.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(prune({ keepLeaves: true }));
  const before = fs.statSync(file).size;
  await io.write(file, doc);
  return [before, fs.statSync(file).size];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  requireAssetsSrc('characters');
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(SRC_DIR).filter((d) => fs.statSync(path.join(SRC_DIR, d)).isDirectory());
  let a = 0, b = 0, n = 0;
  for (const id of ids) {
    const dir = path.join(SRC_DIR, id);
    for (const f of fs.readdirSync(dir).filter((x) => /^anim-.*\.glb$/.test(x))) {
      const r = await stripAnim(path.join(dir, f));
      if (r) { a += r[0]; b += r[1]; n++; }
    }
  }
  console.log(`${n} files shrunk: ${(a / 1e6).toFixed(0)} MB → ${(b / 1e6).toFixed(1)} MB`);
}
