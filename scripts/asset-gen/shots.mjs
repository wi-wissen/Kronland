// Shot clips of the shooters: release frame and aiming direction per figure, written into the manifest (`shots`).
// The game plays one clip cycle per shot with the release on the arrow's departure and turns the figure so that the
// shot goes towards the target (archers stand side-on: the Meshy shots aim over the left shoulder, ~90° to the side).
//
//   node scripts/asset-gen/shots.mjs            # all models that ranged roles (bow, mounted crossbow) shoot with
//   node scripts/asset-gen/shots.mjs Archer …
//
// Bow (two hands): release = end of the full draw – hands at head height and furthest apart; aim = direction
// draw hand → bow hand at that moment. Crossbow in the saddle (`rideShoot`, ride-clips.mjs): release and forward aim
// are given by the clip.

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { threeOf, pose, idleHeight, worldPos } from './rig3.mjs';
import { RIDE_SHOT_RELEASE } from './ride-clips.mjs';

const DIR = process.env.CHAR_DIR ?? 'public/models/characters';
/** Roles that shoot (Renderer: lines bow and lightCav; bandit archers). */
export const SHOOTER_ROLES = /^(soldier\.(bow|lightCav)|bandit\.bow)(\.|$)/;

/** Animation name a model plays for `shoot` in a role (alias, otherwise shoot → attack). */
export function shootAnim(def, role) {
  const key = role.clipAlias?.shoot ?? (def.clips?.shoot ? 'shoot' : 'attack');
  return def.clips?.[key] ?? null;
}

/**
 * Release and aim of a two-handed bow shot.
 * @returns {{ release: number, yaw: number } | null} release = fraction of the clip; yaw = turn of the figure (radians) that
 *   points the shot forward (+z)
 */
export function measureBowShot(g, clipName, n = 120) {
  const clip = g.animations.find((a) => a.name === clipName);
  if (!clip) return null;
  const h = idleHeight(g);
  const bone = (k) => g.scene.getObjectByName(k);
  const frames = [];
  for (let k = 0; k <= n; k++) {
    pose(g, clipName, (clip.duration * k) / n);
    const L = worldPos(bone('LeftHand')), R = worldPos(bone('RightHand')), H = worldPos(bone('Head'));
    const high = Math.abs(L.y - H.y) < 0.06 * h && Math.abs(R.y - H.y) < 0.06 * h;
    frames.push({ k, d: L.distanceTo(R), high, dir: L.clone().sub(R) });
  }
  const aimed = frames.filter((f) => f.high);
  if (!aimed.length) return null;
  const max = Math.max(...aimed.map((f) => f.d));
  // full draw: the run of frames (≥ 95 % of the widest span) around the widest frame; release at its end, aim = mean
  // direction over it
  const full = (f) => f && f.high && f.d >= 0.95 * max;
  let i = frames.findIndex((f) => f.high && f.d === max), j = i;
  while (full(frames[i + 1])) i++;
  while (full(frames[j - 1])) j--;
  const dir = frames.slice(j, i + 1).reduce((a, f) => a.add(f.dir.clone().setY(0).normalize()), frames[0].dir.clone().set(0, 0, 0));
  return { release: +(frames[i].k / n).toFixed(3), yaw: +(-Math.atan2(dir.x, dir.z)).toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const file = path.join(DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const want = new Map(); // model → animation
  for (const [k, r] of Object.entries(manifest.roles)) {
    if (!SHOOTER_ROLES.test(k)) continue;
    for (const m of [r.model, ...(r.variants ?? []).map((v) => v.model)].filter(Boolean)) {
      const anim = shootAnim(manifest.models[m], r);
      if (anim) want.set(m, anim);
    }
  }
  const only = process.argv.slice(2);
  for (const [m, anim] of want) {
    if (only.length && !only.includes(m)) continue;
    let shot;
    if (anim === 'rideShoot') shot = { release: RIDE_SHOT_RELEASE, yaw: 0 };
    else shot = measureBowShot(await threeOf(io, await io.read(path.join(DIR, `${m}.lod1.glb`))), anim);
    if (!shot) { console.log(`${m}: no shot found in ${anim}`); continue; }
    manifest.models[m].shots = { [anim]: shot };
    console.log(`${m}: ${anim} release ${shot.release}, turn ${((shot.yaw * 180) / Math.PI).toFixed(0)}°`);
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}
