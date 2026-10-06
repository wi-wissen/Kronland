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
//
// Far level of the buildings ("bake"): Meshy models have a texture atlas with hundreds of UV islands. With heavy
// simplification edges smear across the island borders (streaks in foreign colours); with strict seams
// the mesh stays almost as large as the original. So the last building level is built without UV: texture colour per
// vertex (COLOR_0), vertices at the same position merged, then simplified by position, normal and colour.
// The file is self-contained (no material from the original needed) and in the game also serves as a placeholder
// while the original is still loading (docs/MODELLE.md#detailstufen-erzeugen).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, weld, prune, dedup, meshopt, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

/** Default levels per folder: [fraction, error, kind] – 'bake' = vertex colours instead of texture (see above) */
const DEFAULTS = {
  buildings: [[0.45, 0.012], [0.12, 0.02, 'bake']],
  characters: [[0.35, 0.012], [0.15, 0.035], [0.06, 0.09]],
};

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v.split(',').map(Number); };
const ratios = opt('--ratios'), errors = opt('--errors');
// --keep-textures: texture stays in the LOD file (own rendering per level, e.g. flat colours)
const keepTextures = args.includes('--keep-textures') && !!args.splice(args.indexOf('--keep-textures'), 1);
// --strict-seams: do not move UV seams (own textures per level; otherwise colour streaks across island borders)
const strictSeams = args.includes('--strict-seams') && !!args.splice(args.indexOf('--strict-seams'), 1);
// --bake: last level with vertex colours instead of texture (default for buildings without --ratios)
const bakeLast = args.includes('--bake') && !!args.splice(args.indexOf('--bake'), 1);
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

/**
 * Weight of the UV in simplification per folder: higher = less smearing across island borders, slightly less
 * saving. Buildings (Meshy atlas with many islands) 5, characters (palette textures) 2. Overridable: LOD_UV_WEIGHT.
 */
const UV_WEIGHTS = { buildings: 5, characters: 2 };
let UV_WEIGHT = 2;
const uvWeightFor = (file) => Number(process.env.LOD_UV_WEIGHT) || UV_WEIGHTS[relative(ROOT, file).split(/[\\/]/)[0]] || 2;

function levelsFor(file) {
  if (ratios) return ratios.map((r, i) => [r, errors?.[i] ?? 0.02, bakeLast && i === ratios.length - 1 ? 'bake' : null]);
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
  const [out] = MeshoptSimplifier.simplifyWithAttributes(indices, pos, 3, att, 5, [0.4, 0.4, 0.4, UV_WEIGHT, UV_WEIGHT], null, target, error, strictSeams ? [] : ['Permissive']);
  if (out.length < 3 || !idxA) return indices.length / 3;
  idxA.setArray(n > 65535 ? out : new Uint16Array(out));
  compactPrimitive(prim); // remove vertices no longer used
  return out.length / 3;
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Colour texture of a material as linear RGB (downscaled: the far level only needs the area colours). */
async function textureRgb(tex, size = 256) {
  const { data, info } = await sharp(Buffer.from(tex.getImage())).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lin = new Float32Array(info.width * info.height * 3);
  for (let i = 0; i < lin.length; i++) lin[i] = srgbToLinear(data[i] / 255);
  return { lin, w: info.width, h: info.height };
}
function sampleRgb(img, u, v, out) {
  // bilinear, repeating (glTF default)
  const x = (((u % 1) + 1) % 1) * img.w - 0.5, y = (((v % 1) + 1) % 1) * img.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  out[0] = out[1] = out[2] = 0;
  for (const [dx, dy, wt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const px = Math.min(img.w - 1, Math.max(0, x0 + dx)), py = Math.min(img.h - 1, Math.max(0, y0 + dy)), o = (py * img.w + px) * 3;
    out[0] += img.lin[o] * wt; out[1] += img.lin[o + 1] * wt; out[2] += img.lin[o + 2] * wt;
  }
  return out;
}

/**
 * Vertex colours instead of texture: per triangle vertex the texture colour slightly inside the triangle (never on the island edge),
 * vertices with the same position and similar normal merged (UV seams disappear, hard edges stay),
 * colour averaged area-weighted. Then simplified by position, normal and colour.
 * @returns {number} triangles afterwards
 */
function bakePrimitive(doc, prim, img, ratio, error) {
  const P = prim.getAttribute('POSITION').getArray(), N = prim.getAttribute('NORMAL')?.getArray(), UV = prim.getAttribute('TEXCOORD_0')?.getArray();
  const n0 = P.length / 3;
  const I = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: n0 }, (_, i) => i);
  const key = new Map(), remap = new Int32Array(n0);
  const q = (v, s) => Math.round(v * s);
  let n = 0;
  for (let i = 0; i < n0; i++) {
    const k = `${q(P[i * 3], 1e4)},${q(P[i * 3 + 1], 1e4)},${q(P[i * 3 + 2], 1e4)}` + (N ? `|${q(N[i * 3], 4)},${q(N[i * 3 + 1], 4)},${q(N[i * 3 + 2], 4)}` : '');
    let j = key.get(k);
    if (j === undefined) { j = n++; key.set(k, j); }
    remap[i] = j;
  }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float64Array(n * 4);
  for (let i = 0; i < n0; i++) {
    const j = remap[i];
    for (let c = 0; c < 3; c++) { pos[j * 3 + c] = P[i * 3 + c]; if (N) nrm[j * 3 + c] += N[i * 3 + c]; }
  }
  for (let j = 0; j < n; j++) {
    const l = Math.hypot(nrm[j * 3], nrm[j * 3 + 1], nrm[j * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) nrm[j * 3 + c] /= l;
  }
  const s = [0, 0, 0], idx = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ja = remap[a], jb = remap[b], jc = remap[c];
    if (ja === jb || jb === jc || ja === jc) continue;
    idx.push(ja, jb, jc);
    // area as weight
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
    const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2 + 1e-12;
    if (!UV || !img) continue;
    const cu = (UV[a * 2] + UV[b * 2] + UV[c * 2]) / 3, cv = (UV[a * 2 + 1] + UV[b * 2 + 1] + UV[c * 2 + 1]) / 3;
    for (const [v, j] of [[a, ja], [b, jb], [c, jc]]) {
      // one third towards the triangle centre
      sampleRgb(img, UV[v * 2] + (cu - UV[v * 2]) / 3, UV[v * 2 + 1] + (cv - UV[v * 2 + 1]) / 3, s);
      col[j * 4] += s[0] * area; col[j * 4 + 1] += s[1] * area; col[j * 4 + 2] += s[2] * area; col[j * 4 + 3] += area;
    }
  }
  const rgb = new Float32Array(n * 3);
  for (let j = 0; j < n; j++) {
    const w = col[j * 4 + 3];
    for (let c = 0; c < 3; c++) rgb[j * 3 + c] = w ? col[j * 4 + c] / w : 0.8;
  }
  // simplify: position + normal + colour (colour weighted strongly so that roof, wall and window stay separate)
  const att = new Float32Array(n * 6);
  for (let j = 0; j < n; j++) for (let c = 0; c < 3; c++) { att[j * 6 + c] = nrm[j * 3 + c]; att[j * 6 + 3 + c] = rgb[j * 3 + c]; }
  const indices = new Uint32Array(idx);
  const target = Math.max(3, Math.floor((I.length * ratio) / 3) * 3);
  const [out] = MeshoptSimplifier.simplifyWithAttributes(indices, pos, 3, att, 6, [0.5, 0.5, 0.5, 1.5, 1.5, 1.5], null, target, error, ['Permissive']);
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  for (const sem of prim.listSemantics()) prim.setAttribute(sem, null);
  prim.setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nrm)).setAttribute('COLOR_0', acc('VEC3', rgb));
  prim.setIndices(acc('SCALAR', n > 65535 ? out : new Uint16Array(out)));
  compactPrimitive(prim);
  return out.length / 3;
}

for (const file of inputs) {
  const levels = levelsFor(file);
  UV_WEIGHT = uvWeightFor(file);
  const before = [];
  const after = [];
  for (let k = 0; k < levels.length; k++) {
    const [ratio, error, mode] = levels[k];
    const doc = await io.read(file);
    const root = doc.getRoot();
    for (const a of root.listAnimations()) {
      for (const smp of a.listSamplers()) { smp.getInput()?.dispose(); smp.getOutput()?.dispose(); smp.dispose(); }
      for (const c of a.listChannels()) c.dispose();
      a.dispose();
    }
    await doc.transform(dequantize(), weld());
    let t0 = 0, t1 = 0;
    // vertex colours only without skinning (buildings); characters keep the texture level
    const bake = mode === 'bake' && !root.listSkins().length;
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      t0 += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
      if (bake) {
        const tex = prim.getMaterial()?.getBaseColorTexture();
        t1 += bakePrimitive(doc, prim, tex ? await textureRgb(tex) : null, ratio, error);
      } else t1 += simplifyPrimitive(prim, ratio, error);
    }
    if (bake) {
      // vertex colours: material without textures (a normal texture would need UV), base colour from the vertices
      for (const m of root.listMaterials()) {
        m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
      }
    }
    // drop texture images: the game takes the material of the original
    if (!keepTextures || bake) for (const t of root.listTextures()) t.dispose();
    // keepAttributes: UV stay although the file itself no longer has a texture (material comes from the original)
    await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(outPattern ? outPattern.replace('{n}', String(k + 1)) : file.replace(/\.glb$/, `.lod${k + 1}.glb`), doc);
    before[0] = Math.round(t0); after.push(Math.round(t1));
  }
  console.log(relative(ROOT, file), before[0], '→', after.join(' → '));
}
