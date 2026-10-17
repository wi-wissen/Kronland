// Re-built LOD levels for Meshy buildings (prototype, docs: see report).
//   1. low mesh: weld the original by position only, quadric simplification with vertex update (meshoptimizer
//      simplifyWithUpdate), team colour (magenta pennant) locked;
//   2. new UV atlas (xatlas, Python);
//   3. Blender headless: colour (+ normal map) baked from the original, selected-to-active with a smooth cage just
//      outside the simplification error;
//   4. gaps between UV charts filled (pull-push), JPEG/WebP, meshopt compression.
// Budgets follow the on-screen size at the switching distance (src/render/lod.js: 38 / 72 tiles, FOV 40°, 900 px
// canvas; lod1 also from 21 tiles on graphics level "low"; retina counted double): geometric error ≤ PX_ERR (1.5) pixels, lod1 ≤ 40 % and lod2 ≤ 25 % (max 2000) of the original triangles,
// texture ≈ TEX_K (3.5) texels per screen pixel of the model height (lod1 ≤ 512, lod2 ≤ 256).
//
// usage: node scripts/asset-gen/lodbake/lodbake.mjs <name|all> … [--out dir] [--levels spec] [--fp w,d]
//   default levels: auto (lod1 + lod2 from the budgets above); manual spec: label:triangles:texture[:n|n256]
//   env BLENDER, PYTHON (needs pip xatlas numpy), PX_ERR (default 1.5), LOD1_MAXFRAC (0.4), TEX_FMT jpeg|webp, TEX_Q
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BLENDER = process.env.BLENDER ?? 'blender';
const PYTHON = process.env.PYTHON ?? 'python';
const PX_ERR = Number(process.env.PX_ERR ?? 1.5);
const TEX_K = Number(process.env.TEX_K ?? 3.5); // texels per screen pixel of the model height (atlas covers all sides, ~50 % used)
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const outDir = opt('--out', join(ROOT, 'review', 'lodbake'));
const spec = opt('--levels', 'auto');
const fpArg = opt('--fp', null);
const tmp = join(outDir, 'tmp');
mkdirSync(tmp, { recursive: true });

// building type, footprint and fill per model file (same rules as src/render/models.js)
const assetsSrc = readFileSync(join(ROOT, 'src/render/assets.js'), 'utf8');
const ownBlock = /OWN_BUILDING_ASSETS = \{([\s\S]*?)\n\};/.exec(assetsSrc)[1];
const typeOf = new Map();
for (const m of ownBlock.matchAll(/(\w+): \[([^\]]*)\]/g)) for (const f of m[2].matchAll(/'([^']+)'/g)) typeOf.set(f[1], m[1]);
const fillExtra = Object.fromEntries([...(/OWN_BUILDING_FILL = \{([^}]*)\}/.exec(assetsSrc)?.[1] ?? '').matchAll(/(\w+): ([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
const { BUILDINGS } = await import(pathToFileURL(join(ROOT, 'src/sim/data/buildings.js')).href);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const tanHalf = Math.tan((20 * Math.PI) / 180);
const pxAt = (H, D) => (H * 900) / (2 * D * tanHalf);
const pow2 = (x, lo, hi) => Math.min(hi, Math.max(lo, 2 ** Math.ceil(Math.log2(x))));

const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 << 20 });
const names = args.includes('all') ? [...typeOf.keys()] : args;
for (const item of names) {
  const src = item.endsWith('.glb') ? item : join(ROOT, 'public/models/buildings', `${item}.glb`);
  const name = basename(src, '.glb');
  const t0 = Date.now();
  const raw = join(tmp, `${name}_raw.glb`);
  run('node', [join(HERE, 'unpack.mjs'), src, raw]);
  const { min, max } = getBounds((await io.read(raw)).getRoot().listScenes()[0]);
  const size = [0, 1, 2].map((k) => max[k] - min[k]);
  let srcTris = 0;
  for (const m of (await io.read(raw)).getRoot().listMeshes()) for (const p of m.listPrimitives()) srcTris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  const type = typeOf.get(name), b = type && BUILDINGS[type];
  const [w, d] = fpArg ? fpArg.split(',').map(Number) : b ? [b.w, b.h] : [3, 3];
  const fill = (type === 'headquarters' ? 1.05 : type === 'tower' ? 1.0 : type?.endsWith('Mine') ? 1.05 : 0.92) * (fillExtra[name] ?? 1);
  const H = size[1] * Math.min((w * fill) / size[0], (d * fill) / size[2]);
  const ext = Math.max(...size) / size[1]; // meshopt error is relative to the largest extent
  const px1 = Math.max(2 * pxAt(H, 38), pxAt(H, 21)), px2 = 2 * pxAt(H, 72);
  const levels = spec === 'auto'
    ? [
      { label: 'lod1', err: PX_ERR / (px1 * ext), min: 400, max: Math.round(srcTris * Number(process.env.LOD1_MAXFRAC ?? 0.4)), tex: pow2(px1 * TEX_K, 128, Number(process.env.TEX_MAX1 ?? 512)), normal: true },
      { label: 'lod2', err: PX_ERR / (px2 * ext), min: 200, max: Math.min(2000, Math.round(srcTris * 0.25)), tex: pow2(px2 * TEX_K, 64, Number(process.env.TEX_MAX2 ?? 256)), normal: false },
    ]
    : spec.split(',').map((s) => { const [label, tris, tex, n] = s.split(':'); return { label, tris: Number(tris), err: 1, tex: Number(tex), normal: !!n && n.startsWith('n'), nsize: n && n.length > 1 ? Number(n.slice(1)) : 0 }; });
  console.log(`${name} (${type ?? '?'} ${w}x${d}): height ${H.toFixed(2)} tiles, ${px1.toFixed(0)} px at lod1, ${px2.toFixed(0)} px at lod2`);
  for (const L of levels) {
    const base = join(tmp, `${name}.${L.label}`);
    const env = { ...process.env, LM_MAXTRIS: String(L.max ?? 0) };
    const lowLog = execFileSync('node', [join(HERE, 'lowmesh.mjs'), raw, `${base}.obj`, String(L.tris ?? L.min), '', String(L.err)], { encoding: 'utf8', env }).trim();
    // cage just outside the simplification error (too far: rays hit neighbouring parts, e.g. thin galleries)
    const relErr = Number(/rel\. error ([\d.]+)/.exec(lowLog)[1]);
    const extrude = process.env.BAKE_EXTRUDE ?? Math.max(0.005, 1.5 * relErr).toFixed(4);
    // texture baked at twice the final size (anti-aliasing), scaled down in finalize
    const bakeSize = Math.min(2048, L.tex * 2);
    const uvLog = run(PYTHON, [join(HERE, 'uv_xatlas.py'), `${base}.obj`, `${base}_uv.obj`, String(bakeSize)]).trim();
    const bl = run(BLENDER, ['-b', '--factory-startup', '-P', join(HERE, 'bake.py'), '--', raw, `${base}_uv.obj`, `${base}_baked.glb`, String(bakeSize),
      '--sharp', process.env.BAKE_SHARP ?? '40', '--extrude', extrude, ...(L.normal ? [] : ['--nonormal'])]);
    if (!bl.includes('DONE')) throw new Error(`bake failed for ${name} ${L.label}\n${bl.slice(-3000)}`);
    const out = join(outDir, `${name}.${L.label}.glb`);
    const nsize = L.nsize || (spec === 'auto' ? L.tex / 2 : L.tex);
    const finLog = run('node', [join(HERE, 'finalize.mjs'), `${base}_baked.glb`, out, '--like', raw, '--q', process.env.TEX_Q ?? '85', '--fmt', process.env.TEX_FMT ?? 'jpeg',
      '--size', String(L.tex), '--nsize', String(nsize), '--team', `${base}.team.json`, ...(L.normal ? [] : ['--nonormal'])]);
    console.log(`  ${L.label}: ${lowLog.replace(/^team-locked \d+, /, '')} | tex ${L.tex}${L.normal ? ` + normal ${nsize}` : ''} | ${uvLog.split(' util')[0]} | ${(statSync(out).size / 1024).toFixed(0)} KB | ${finLog.split(String.fromCharCode(10)).filter((l) => l.startsWith('team')).join(', ')}`);
  }
  console.log(`  ${name}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
