// Removes unneeded animations from character GLBs (saves download on mobile).
// All clips that public/models/characters/manifest.json names for the model are kept
// (model clips and role overrides); without a manifest entry a fixed base list.
// Usage: node scripts/trim-animations.mjs public/models/characters/*.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = /^(Idle|Walking_A|Running_A|1H_Melee_Attack_Chop|2H_Melee_Attack_Spin|Death_A|Death_A_Pose|Spellcast_Shoot|Spellcast_Raise|Use_Item|Interact)$/;
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'characters', 'manifest.json');
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;

/** Clip names the manifest needs for a model. */
function wanted(model) {
  const def = manifest?.models?.[model];
  if (!def) return null;
  const names = new Set(Object.values(def.clips ?? {}));
  for (const r of Object.values(manifest.roles ?? {})) {
    for (const v of [r, ...(r.variants ?? [])]) {
      if ((v.model ?? r.model) === model) for (const n of Object.values({ ...r.clips, ...v.clips })) names.add(n);
    }
  }
  return names;
}

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
for (const file of process.argv.slice(2)) {
  if (/\.lod\d\.glb$/.test(file)) continue;
  const keep = wanted(basename(file, '.glb'));
  const doc = await io.read(file);
  const before = doc.getRoot().listAnimations().map((a) => a.getName());
  for (const a of doc.getRoot().listAnimations()) {
    if (keep ? keep.has(a.getName()) : BASE.test(a.getName())) continue;
    // also remove time and value lists, otherwise they stay behind as orphaned data in the file
    const acc = a.listSamplers().flatMap((s) => [s.getInput(), s.getOutput()]).filter(Boolean);
    for (const c of a.listChannels()) c.dispose();
    for (const smp of a.listSamplers()) smp.dispose();
    a.dispose();
    for (const x of acc) if (!x.isDisposed() && !x.listParents().some((p) => p.propertyType === 'AnimationSampler')) x.dispose();
  }
  await doc.transform(prune());
  await io.write(file, doc);
  const after = doc.getRoot().listAnimations().map((a) => a.getName());
  const missing = keep ? [...keep].filter((n) => !after.includes(n)) : [];
  console.log(basename(file), before.length, '→', after.length, after.join(', '), missing.length ? `(missing: ${missing.join(', ')})` : '');
}
