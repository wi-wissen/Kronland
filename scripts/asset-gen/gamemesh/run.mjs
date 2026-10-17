// New game model (lod1) for a character: own mesh from the near model instead of the Meshy remesh.
//
//   node scripts/asset-gen/gamemesh/run.mjs <Model> [more …] [--out dir] [--tris n] [--head 2.5]
//   env BLENDER (default "blender"), PYTHON (default "python", needs pip xatlas numpy)
//
// Steps (docs/MODELLE.md#spielmodell-aus-dem-nahmodell):
//   1. simplify.mjs  – weld the near model by position, meshoptimizer (Permissive, Regularize); head region
//                      (skin weight on head/neck) weighted ×2.5 in the error, so the face keeps its shape
//   2. uv.py         – new UV atlas with xatlas, head charts enlarged ×1.6 (more texels for the face)
//   3. bake.py       – Blender: colour and normal map baked from the near model (selected to active, cage 1.5 %),
//                      export with normals and MikkTSpace tangents
//   4. assemble.mjs  – mesh and images into a copy of <Model>.lod1.glb; skeleton, animations, material and team
//                      marker (magenta baked along) stay, skin weights from the nearest near-model vertex
// Triangle budget: as many as the current game model (default). Writes <out>/<Model>.lod1.glb (default: in place).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const CHARS = path.join(ROOT, 'public', 'models', 'characters');
const BLENDER = process.env.BLENDER ?? 'blender';
const PYTHON = process.env.PYTHON ?? 'python';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const outDir = path.resolve(opt('--out', CHARS));
const trisArg = opt('--tris', null);
const head = opt('--head', '2.5');
const uvHead = opt('--uv-head', '1.6');
fs.mkdirSync(outDir, { recursive: true });

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const triangles = async (file) => {
  let t = 0;
  for (const m of (await io.read(file)).getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  return t;
};
const run = (cmd, a, env) => execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, ...env } });

for (const model of args) {
  const t0 = Date.now();
  const work = path.join(ROOT, 'review', 'gamemesh', model);
  fs.mkdirSync(work, { recursive: true });
  const near = path.join(work, 'near.glb');
  run('node', [path.join(HERE, 'unpack.mjs'), path.join(CHARS, `${model}.glb`), near]);
  const tris = trisArg ?? String(await triangles(path.join(CHARS, `${model}.lod1.glb`)));
  run('node', [path.join(HERE, 'simplify.mjs'), model, tris, head, work, uvHead], { FLAGS: 'Permissive,Regularize', NW: '0.1' });
  run(PYTHON, [path.join(HERE, 'uv.py'), work]);
  const log = run(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, 'bake.py'), '--', near, path.join(work, 'low_uv.obj'), path.join(work, 'out'), '1024', '180'], { CAGE: '0.015' });
  if (!log.includes('BAKE_DONE')) throw new Error(`${model}: Blender bake failed\n${log.split('\n').slice(-20).join('\n')}`);
  const out = path.join(outDir, `${model}.lod1.glb`);
  run('node', [path.join(HERE, 'assemble.mjs'), model, work, out]);
  console.log(`${model}.lod1.glb: ${await triangles(out)} triangles (before ${tris}), ${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
