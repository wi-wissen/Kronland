// Creates simplified levels of detail (LOD) for GLB models: <name>.lod1.glb, <name>.lod2.glb (… lodN) next to the original.
//
// Usage:
//   node scripts/build-lods.mjs                      all buildings and characters under public/models (default levels)
//   node scripts/build-lods.mjs <file|folder> …      only these
//   Options: --ratios 0.45,0.2  --errors 0.01,0.04   target fraction of triangles and permitted error per level
//             --keep-textures   keep the texture in the LOD files   --out path/x.lod{n}.glb   target files
//
// Simplification uses meshoptimizer (simplifyWithAttributes, "Permissive": edges at UV seams may
// move as long as normals and UV hardly deviate – important for the KayKit colour-palette textures).
// Skinning (JOINTS_0/WEIGHTS_0) is preserved: vertices are only collapsed onto existing vertices.
// Animations and texture images are dropped in the LOD files; the game uses the clips and material of the original.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, prune, dedup, meshopt, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

/** Standardstufen je Ordner: [Anteil, Fehler] */
const DEFAULTS = {
  buildings: [[0.45, 0.012], [0.18, 0.04]],
  characters: [[0.35, 0.012], [0.15, 0.035], [0.06, 0.09]],
};

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v.split(',').map(Number); };
const ratios = opt('--ratios'), errors = opt('--errors');
// --keep-textures: texture stays in the LOD file (own rendering per level, e.g. flat colours)
const keepTextures = args.includes('--keep-textures') && !!args.splice(args.indexOf('--keep-textures'), 1);
// --strict-seams: do not move UV seams (own textures per level; otherwise colour streaks across island borders)
const strictSeams = args.includes('--strict-seams') && !!args.splice(args.indexOf('--strict-seams'), 1);
// --out <pattern>: target file, {n} = level (default: <name>.lod{n}.glb)
const outPattern = (() => { const i = args.indexOf('--out'); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; })();

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function collect(p) {
  if (!existsSync(p)) return [];
  if (statSync(p).isDirectory()) return readdirSync(p).sort().flatMap((f) => collect(join(p, f)));
  return p.endsWith('.glb') && !/\.lod\d\.glb$/.test(p) ? [p] : [];
}
const inputs = (args.length ? args : Object.keys(DEFAULTS).map((d) => join(ROOT, d))).flatMap(collect);

function levelsFor(file) {
  if (ratios) return ratios.map((r, i) => [r, errors?.[i] ?? 0.02]);
  const dir = relative(ROOT, file).split(/[\\/]/)[0];
  return DEFAULTS[dir] ?? DEFAULTS.buildings;
}

/** Simplify one primitive (positions + normals/UV as attributes). @returns {number} triangles afterwards */
function simplifyPrimitive(prim, ratio, error) {
  const posA = prim.getAttribute('POSITION');
  const pos = new Float32Array(posA.getArray());
  const n = posA.getCount();
  const idxA = prim.getIndices();
  const indices = new Uint32Array(idxA ? idxA.getArray() : Array.from({ length: n }, (_, i) => i));
  const target = Math.max(3, Math.floor((indices.length * ratio) / 3) * 3);
  if (indices.length <= 36 || target >= indices.length) return indices.length / 3;
  const nrm = prim.getAttribute('NORMAL')?.getArray(), uv = prim.getAttribute('TEXCOORD_0')?.getArray();
  const att = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    if (nrm) { att[i * 5] = nrm[i * 3]; att[i * 5 + 1] = nrm[i * 3 + 1]; att[i * 5 + 2] = nrm[i * 3 + 2]; }
    if (uv) { att[i * 5 + 3] = uv[i * 2]; att[i * 5 + 4] = uv[i * 2 + 1]; }
  }
  // weight UV more strongly: palette textures must not slip into a neighbouring cell (different colour)
  const [out] = MeshoptSimplifier.simplifyWithAttributes(indices, pos, 3, att, 5, [0.4, 0.4, 0.4, 2, 2], null, target, error, strictSeams ? [] : ['Permissive']);
  if (out.length < 3 || !idxA) return indices.length / 3;
  idxA.setArray(n > 65535 ? out : new Uint16Array(out));
  compactPrimitive(prim); // remove vertices no longer used
  return out.length / 3;
}

for (const file of inputs) {
  const levels = levelsFor(file);
  const before = [];
  const after = [];
  for (let k = 0; k < levels.length; k++) {
    const [ratio, error] = levels[k];
    const doc = await io.read(file);
    const root = doc.getRoot();
    for (const a of root.listAnimations()) {
      for (const smp of a.listSamplers()) { smp.getInput()?.dispose(); smp.getOutput()?.dispose(); smp.dispose(); }
      for (const c of a.listChannels()) c.dispose();
      a.dispose();
    }
    await doc.transform(dequantize(), weld());
    let t0 = 0, t1 = 0;
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      t0 += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
      t1 += simplifyPrimitive(prim, ratio, error);
    }
    // drop texture images: the game takes the material of the original
    if (!keepTextures) for (const t of root.listTextures()) t.dispose();
    // keepAttributes: UV stay although the file itself no longer has a texture (material comes from the original)
    await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(outPattern ? outPattern.replace('{n}', String(k + 1)) : file.replace(/\.glb$/, `.lod${k + 1}.glb`), doc);
    before[0] = Math.round(t0); after.push(Math.round(t1));
  }
  console.log(relative(ROOT, file), before[0], '→', after.join(' → '));
}
