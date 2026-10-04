// Create a character with Meshy: multiple views → 3D model → rig → animations.
//
//   node scripts/asset-gen/model.mjs generate <id>   # views (view-*.png) → textured model (raw.glb)
//   node scripts/asset-gen/model.mjs remesh <id>     # only with spec.remeshInGeneration = false: reduce separately
//   node scripts/asset-gen/model.mjs rig <id>        # auto-rig (rigged.glb)
//   node scripts/asset-gen/model.mjs motions         # create custom motions (text → motion) from animations.json
//   node scripts/asset-gen/model.mjs animate <id>    # apply the clips of the animation set to the rig (anim-<key>.glb)
//   node scripts/asset-gen/model.mjs all <id>        # everything in sequence
//   node scripts/asset-gen/model.mjs balance         # Meshy credit balance
//
// Inputs: assets-src/characters/<id>/spec.json (views, polygon count, size, animation set) and
// assets-src/characters/animations.json (sets: game key → library ID or text motion).
// Each step writes task IDs to job.json and is skipped or resumed on a repeated call
// (no double credit spend). Costs are booked against the budget (assets-src/credits.json) in advance.

import fs from 'node:fs';
import path from 'node:path';
import { reexecWithProxy, meshy, meshyWait, meshyBalance, download, dataUri, loadJob, saveJob, spend, SRC_DIR } from './lib.mjs';

reexecWithProxy();

const ANIM_FILE = path.join(SRC_DIR, 'animations.json');
const readSpec = (id) => JSON.parse(fs.readFileSync(path.join(SRC_DIR, id, 'spec.json'), 'utf8'));
const readAnims = () => JSON.parse(fs.readFileSync(ANIM_FILE, 'utf8'));
const writeAnims = (a) => fs.writeFileSync(ANIM_FILE, JSON.stringify(a, null, 2) + '\n');

async function generate(id) {
  const spec = readSpec(id), job = loadJob(id), dir = path.join(SRC_DIR, id);
  if (spec.remeshOf) return; // produced in the remesh step
  if (!job.model?.task) {
    const views = (spec.views ?? ['view-1.png', 'view-2.png', 'view-3.png', 'view-4.png']).map((f) => path.join(dir, f));
    spend(spec.modelCredits ?? 30, `${id}: model`);
    const params = {
      image_urls: views.map(dataUri),
      ai_model: spec.aiModel ?? 'latest',
      should_texture: true, enable_pbr: spec.enablePbr ?? false, texture_resolution: spec.textureResolution ?? '2k',
      should_remesh: spec.remeshInGeneration ?? true, topology: 'triangle', target_polycount: spec.polycount ?? 5000,
      pose_mode: spec.pose ?? 'a-pose', remove_lighting: true, target_formats: ['glb'], origin_at: 'bottom',
    };
    if (spec.texturePrompt) params.texture_prompt = spec.texturePrompt;
    const { result } = await meshy('v1/multi-image-to-3d', params);
    job.model = { task: result, params: { ...params, image_urls: spec.views ?? 'view-1..4' } };
    saveJob(job);
  }
  const t = await meshyWait('v1/multi-image-to-3d', job.model.task, { label: `${id} model` });
  job.model.credits = t.consumed_credits;
  await download(t.model_urls.glb, path.join(dir, 'raw.glb'));
  if (t.thumbnail_url) await download(t.thumbnail_url, path.join(dir, 'thumb.png'));
  saveJob(job);
  console.log(`\n${id}: raw.glb (${t.consumed_credits ?? '?'} Credits)`);
}

/**
 * Reduce separately (like in the web UI): first generate at full resolution (spec.remeshInGeneration = false),
 * then remesh to spec.polycount triangles. Result remeshed.glb; the rig builds on it.
 */
async function remesh(id) {
  const spec = readSpec(id), job = loadJob(id), dir = path.join(SRC_DIR, id);
  // spec.remeshOf: far model as a reduced version of another model (texture stays, no concept of its own)
  const source = spec.remeshOf ? loadJob(spec.remeshOf).model?.task : job.model?.task;
  if (spec.remeshInGeneration !== false && !spec.remeshOf) return;
  if (!source) throw new Error(`${spec.remeshOf ?? id}: run "generate" first`);
  if (!job.remesh?.task) {
    spend(5, `${id}: Remesh`);
    const { result } = await meshy('v1/remesh', { input_task_id: source, topology: 'triangle', target_polycount: spec.polycount ?? 10000, target_formats: ['glb'] });
    job.remesh = { task: result };
    saveJob(job);
  }
  const t = await meshyWait('v1/remesh', job.remesh.task, { label: `${id} Remesh` });
  await download(t.model_urls.glb, path.join(dir, 'remeshed.glb'));
  saveJob(job);
  console.log(`\n${id}: remeshed.glb`);
}

async function rig(id) {
  const spec = readSpec(id), job = loadJob(id), dir = path.join(SRC_DIR, id);
  if (spec.rig === false) { console.log(`${id}: no rig (far model, skin weights come from the near model)`); return; }
  if (!job.model?.task) throw new Error(`${id}: run "generate" first`);
  if (!job.rig?.task) {
    spend(5, `${id}: Rig`);
    const input = job.remesh?.task ?? job.model.task;
    const { result } = await meshy('v1/rigging', { input_task_id: input, height_meters: spec.heightMeters ?? 1.6 });
    job.rig = { task: result };
    saveJob(job);
  }
  const t = await meshyWait('v1/rigging', job.rig.task, { label: `${id} Rig` });
  await download(t.result.rigged_character_glb_url, path.join(dir, 'rigged.glb'));
  const basic = t.result.basic_animations ?? {};
  if (basic.walking_glb_url) await download(basic.walking_glb_url, path.join(dir, 'anim-basic-walk.glb'));
  if (basic.running_glb_url) await download(basic.running_glb_url, path.join(dir, 'anim-basic-run.glb'));
  saveJob(job);
  console.log(`\n${id}: rigged.glb`);
}

/** Create custom motions (text → motion) once; they apply to all characters with the same set. */
async function motions() {
  const a = readAnims();
  for (const [setName, set] of Object.entries(a.sets)) {
    for (const [key, src] of Object.entries(set.clips)) {
      if (!src.motion) continue;
      // Meshy keeps motions only for 3 days: regenerate older ones
      if (src.task && src.created && Date.now() - src.created < 2.5 * 86400e3) continue;
      spend(10, `motion ${setName}.${key}`);
      const { result } = await meshy('v1/text-to-motion', { prompt: src.motion, duration: src.duration ?? 3, mode: 'prime' });
      src.task = result;
      src.created = Date.now();
      writeAnims(a);
      await meshyWait('v1/text-to-motion', result, { label: `motion ${key}` });
      console.log(`\nmotion ${setName}.${key}: ${result}`);
    }
  }
}

async function animate(id) {
  const spec = readSpec(id), job = loadJob(id), dir = path.join(SRC_DIR, id);
  if (spec.rig === false) return;
  if (!job.rig?.task) throw new Error(`${id}: run "rig" first`);
  const set = readAnims().sets[spec.animations ?? 'human'];
  job.anims ??= {};
  for (const [key, src] of Object.entries(set.clips)) {
    const file = path.join(dir, `anim-${key}.glb`);
    let a = job.anims[key];
    const source = src.motion ? { motion: src.task } : { action: src.action };
    if (a && JSON.stringify(a.source) !== JSON.stringify(source)) a = null; // source changed
    if (!a?.task) {
      if (src.motion && !src.task) throw new Error(`Motion ${key} missing: run "motions" first`);
      spend(3, `${id}: animation ${key}`);
      const body = { rig_task_id: job.rig.task, post_process: { operation_type: 'change_fps', fps: 24 } };
      if (src.motion) body.motion_task_id = src.task; else body.action_id = src.action;
      const { result } = await meshy('v1/animations', body);
      a = job.anims[key] = { task: result, source };
      saveJob(job);
    }
    if (fs.existsSync(file) && a.done) continue;
    const t = await meshyWait('v1/animations', a.task, { label: `${id} ${key}` });
    await download(t.result.animation_glb_url, file);
    a.done = true;
    saveJob(job);
    console.log(`\n${id}: anim-${key}.glb`);
  }
}

const [cmd, id] = process.argv.slice(2);
try {
  if (cmd === 'generate') await generate(id);
  else if (cmd === 'remesh') await remesh(id);
  else if (cmd === 'rig') await rig(id);
  else if (cmd === 'motions') await motions();
  else if (cmd === 'animate') await animate(id);
  else if (cmd === 'all') { await generate(id); await remesh(id); await rig(id); await motions(); await animate(id); }
  else if (cmd === 'balance') console.log(await meshyBalance());
  else { console.error('Usage: node scripts/asset-gen/model.mjs generate|rig|motions|animate|all <id> | balance'); process.exit(1); }
} catch (err) {
  console.error('\n' + err.message);
  process.exit(1);
}
