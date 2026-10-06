// Horse as a mount: own rig (set by the user in the Meshy UI, 65 unnamed bones) + self-
// written motions (standing, walk, gallop) → near and game model like the other characters.
//
//   node scripts/asset-gen/horse.mjs                       # assets-src/characters/horse/rigged.glb → public/models/characters/Horse(.lod1).glb
//   node scripts/asset-gen/horse.mjs --preview out.glb     # only rig + clips, uncompressed (for render.mjs)
//
// The bones are assigned by position and hierarchy (RIG below). Legs are solved per frame by IK in the side plane
// (gait.mjs): stance hooves glide backwards at ground speed (no slipping), swing hooves lift
// in an arc; joints flex per gait (carpus backwards, hock forwards). Trunk, neck,
// head, tail and ears follow curves per gait. The game measures the ground speed of the clips itself when loading
// (strideSpeed) and couples the playback rate to the walking speed.

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { SRC_DIR, OUT_DIR } from './lib.mjs';
import { GAITS, LEGS, hoofPath, legPreference, solveChain, bodyPose, gaitSpeed } from './gait.mjs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { keepTexture, finish, markerWeight } from './postprocess.mjs';
import { rasterTriangles, fillGutters } from './texraster.mjs';
import { markerWeightSrgb } from '../../src/render/characters.js';
import { ROOT } from './lib.mjs';
import { convert as animsToGame } from './anims-to-game.mjs';
import { fitTo, transferWeights } from './farmesh.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/**
 * Bones of the Meshy rig (names Bone_000 … Bone_064, meaningless) assigned by position. The horse faces +z,
 * +x is its left side. Legs: joint 0 shoulder/hip, 1 elbow/stifle, 2 carpus/hock,
 * 3 fetlock, 4 coronet (hoof), `tip` = hoof tip. Stirrups (Bone_023–026), reins/throat (Bone_059/060, Bone_030/031)
 * and the small side branches at the elbows (Bone_041/042, Bone_048/049) stay rigid.
 */
export const RIG = {
  root: 'Bone_000',
  spine: 'Bone_010',
  tail: ['Bone_007', 'Bone_006', 'Bone_005', 'Bone_004', 'Bone_003', 'Bone_002'],
  neck: ['Bone_040', 'Bone_039', 'Bone_038'],
  head: 'Bone_037',
  ears: ['Bone_062', 'Bone_064'],
  legs: {
    LF: { kind: 'front', joints: ['Bone_033', 'Bone_047', 'Bone_046', 'Bone_045', 'Bone_044'], tip: 'Bone_043' },
    RF: { kind: 'front', joints: ['Bone_035', 'Bone_054', 'Bone_053', 'Bone_052', 'Bone_051'], tip: 'Bone_050' },
    LH: { kind: 'hind', joints: ['Bone_022', 'Bone_021', 'Bone_020', 'Bone_019', 'Bone_018'], tip: 'Bone_017' },
    RH: { kind: 'hind', joints: ['Bone_016', 'Bone_015', 'Bone_014', 'Bone_013', 'Bone_012'], tip: 'Bone_011' },
  },
};

/** Saddle cloth (team area) in model space: magenta outside of it are speckles from Meshy (mane, tail, legs). */
export const CLOTH_BOX = { min: [-0.4, 0.68, -0.48], max: [0.4, 1.3, 0.12] };

/**
 * Paint over magenta speckles outside the saddle cloth (the shader would otherwise colour them as player colour): pixels
 * with marker colour in triangles outside CLOTH_BOX get the mean non-marker colour of their triangle;
 * afterwards the gaps between the UV islands are refilled.
 * @returns {Promise<number>} number of painted-over pixels
 */
export async function cleanMarker(doc) {
  const root = doc.getRoot();
  const tex = root.listMaterials()[0].getBaseColorTexture();
  const mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0];
  // Position in model space: quantised files carry offset and scale in the inverse bind matrices,
  // so via the skinning of the rest pose (bone world matrix · inverse bind matrix of the first bone per vertex)
  const skin = root.listNodes().find((n) => n.getMesh() === mesh)?.getSkin();
  const joints = skin.listJoints(), ibm = skin.getInverseBindMatrices();
  const mats = joints.map((j, k) => new THREE.Matrix4().fromArray(j.getWorldMatrix()).multiply(new THREE.Matrix4().fromArray(ibm.getElement(k, []))));
  const local = prim.getAttribute('POSITION').getArray(), J = prim.getAttribute('JOINTS_0').getArray();
  const pos = new Float32Array(local.length), v = new THREE.Vector3();
  for (let i = 0; i < local.length / 3; i++) v.fromArray(local, i * 3).applyMatrix4(mats[J[i * 4]]).toArray(pos, i * 3);
  const uv = prim.getAttribute('TEXCOORD_0').getArray(), idx = prim.getIndices().getArray();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const id = rasterTriangles(uv, idx, W, H);
  const nt = idx.length / 3;
  const inside = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const a = idx[t * 3 + k] * 3;
      for (let c = 0; c < 3; c++) if (pos[a + c] < CLOTH_BOX.min[c] || pos[a + c] > CLOTH_BOX.max[c]) ok = false;
    }
    inside[t] = ok ? 1 : 0;
  }
  const sum = new Float64Array(nt * 4), w = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const t = id[i];
    if (t < 0 || inside[t]) continue;
    // like the shader (charMarker, also dark tones) and like the pipeline (markerWeight)
    const r = data[i * 3], gg = data[i * 3 + 1], b = data[i * 3 + 2];
    w[i] = Math.max(markerWeight(r, gg, b), markerWeightSrgb(r, gg, b));
    if (w[i] === 0) { for (let c = 0; c < 3; c++) sum[t * 4 + c] += data[i * 3 + c]; sum[t * 4 + 3]++; }
  }
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!(w[i] > 0)) continue;
    const t = id[i], k = sum[t * 4 + 3];
    const v = Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    const col = k ? [sum[t * 4] / k, sum[t * 4 + 1] / k, sum[t * 4 + 2] / k] : [v * 0.55, v * 0.32, v * 0.2]; // otherwise fur brown
    for (let c = 0; c < 3; c++) data[i * 3 + c] = Math.round(col[c]);
    n++;
  }
  // Fill gaps between the UV islands from the own island: Meshy partly has saddle-cloth magenta there
  // that would otherwise slip into neighbouring triangles when simplifying (game model)
  fillGutters(id, W, H, [{ data, ch: 3 }], W);
  const img = sharp(data, { raw: { width: W, height: H, channels: 3 } });
  if (tex.getMimeType() === 'image/jpeg') tex.setImage(await img.jpeg({ quality: 90, mozjpeg: true }).toBuffer());
  else tex.setImage(await img.png().toBuffer()).setMimeType('image/png');
  return n;
}

/** Clips: name in the GLB → gait; standing 4 s. */
export const CLIPS = { idle: { period: 4 }, walk: GAITS.walk, gallop: GAITS.gallop, die: { period: 1.25, once: true } };
const FPS = 24;
/** Pivot for the trunk's pitching (middle between hip and shoulder). */
const PIVOT = new THREE.Vector3(0, 0.95, -0.15);
/** Stiffness per leg joint (0 = shoulder/hip free, the rest close to the preferred flexion). */
const STIFF = [0.002, 0.05, 0.08, 0.08];

/** Bone tree of the rig as three.js objects (rest pose from the nodes). */
function skeletonOf(doc) {
  const objs = new Map();
  const build = (node, parent) => {
    const o = new THREE.Object3D();
    o.name = node.getName();
    o.position.fromArray(node.getTranslation()); o.quaternion.fromArray(node.getRotation()); o.scale.fromArray(node.getScale());
    parent.add(o);
    objs.set(o.name, o);
    for (const c of node.listChildren()) build(c, o);
  };
  const top = new THREE.Object3D();
  for (const n of doc.getRoot().listScenes()[0].listChildren()) build(n, top);
  top.updateMatrixWorld(true);
  const rest = new Map();
  for (const [name, o] of objs) {
    rest.set(name, {
      q: o.quaternion.clone(), p: o.position.clone(),
      world: o.getWorldPosition(new THREE.Vector3()), parentQ: o.parent.getWorldQuaternion(new THREE.Quaternion()),
    });
  }
  return { top, objs, rest };
}

/**
 * Apply rotation `d` (in the rest pose's world space, about the joint point) to a bone – relative to its parent,
 * so parent rotations come on top (forward kinematics).
 */
function setDelta(sk, name, d) {
  const o = sk.objs.get(name), r = sk.rest.get(name);
  o.quaternion.copy(r.parentQ).invert().multiply(d).multiply(r.parentQ).multiply(r.q);
}
const qX = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -a); // a > 0 = forward
const zy = (v) => [v.z, v.y];

/** All bones to rest pose. */
function resetPose(sk) {
  for (const [name, o] of sk.objs) { const r = sk.rest.get(name); o.quaternion.copy(r.q); o.position.copy(r.p); }
}

/** Sideways bending of a tail segment: axis perpendicular to segment and transverse axis. */
function sideAxis(sk, name, next) {
  const a = sk.rest.get(name).world, b = next ? sk.rest.get(next).world : a.clone().add(new THREE.Vector3(0, -1, 0));
  const dir = b.clone().sub(a).normalize();
  const ax = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0));
  return ax.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, 1) : ax.normalize();
}

/**
 * Set a pose: trunk, neck, tail, ears from bodyPose, legs by IK.
 * @returns {{ err: number }} largest deviation of a hoof from the target (model units)
 */
function pose(sk, clip, p) {
  resetPose(sk);
  if (clip === 'die') return dyingPose(sk, p);
  const g = GAITS[clip];
  const b = bodyPose(clip, p);
  // trunk: pitching about PIVOT, lifting/lowering
  const root = sk.objs.get(RIG.root), rr = sk.rest.get(RIG.root);
  const dq = qX(b.pitch);
  root.quaternion.copy(dq).multiply(rr.q);
  root.position.copy(rr.p).sub(PIVOT).applyQuaternion(dq).add(PIVOT).add(new THREE.Vector3(0, b.dy, 0));
  setDelta(sk, RIG.spine, qX(b.spine));
  RIG.neck.forEach((n, i) => setDelta(sk, n, i === 0 ? qX(b.neck[i]).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw)) : qX(b.neck[i])));
  setDelta(sk, RIG.head, qX(b.head));
  RIG.tail.forEach((n, i) => {
    const side = new THREE.Quaternion().setFromAxisAngle(sideAxis(sk, n, RIG.tail[i + 1]), b.tailSide[i]);
    setDelta(sk, n, side.multiply(qX(b.tailX[i])));
  });
  RIG.ears.forEach((n, i) => setDelta(sk, n, qX(b.ears[i])));
  sk.top.updateMatrixWorld(true);
  let err = 0;
  for (const leg of LEGS) {
    const L = RIG.legs[leg];
    const restPts = [...L.joints].map((n) => zy(sk.rest.get(n).world));
    const segs = restPts.slice(1).map((q, i) => [q[0] - restPts[i][0], q[1] - restPts[i][1]]);
    const j0 = sk.objs.get(L.joints[0]);
    const base = zy(j0.getWorldPosition(new THREE.Vector3()));
    // rotation of the parent relative to rest (only about x: trunk, back)
    const pq = j0.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(sk.rest.get(L.joints[0]).parentQ.clone().invert());
    const baseAngle = -2 * Math.atan2(pq.x, pq.w);
    const hp = g ? hoofPath(g, leg, p) : { dz: 0, dy: 0, stance: true, s: 0.5 };
    const pref = legPreference(L.kind, hp, g?.flex ?? 0);
    const rest4 = restPts[4];
    // stance phase centred under shoulder/hip (at rest the hoof stands slightly behind)
    const center = g ? rest4[0] + (restPts[0][0] - rest4[0]) * 0.7 : rest4[0];
    const target = [center + hp.dz, rest4[1] + hp.dy];
    const { a, err: e } = solveChain(base, baseAngle, segs, target, [0, pref[0], pref[1], pref[2]], STIFF);
    err = Math.max(err, hp.stance ? e : 0);
    // hoof: in the stance phase flat on the ground (absolute), otherwise preferred flexion; transitions soft
    const cum = baseAngle + a[0] + a[1] + a[2] + a[3];
    const flat = -cum + pref[3];
    let hoof = flat;
    if (!hp.stance) {
      const w = Math.max(0, 1 - hp.s / 0.25, (hp.s - 0.6) / 0.4);
      const k = Math.min(1, w) ** 2 * (3 - 2 * Math.min(1, w));
      hoof = pref[3] + (-cum + (hp.s < 0.5 ? -0.35 : 0) - pref[3]) * k;
    }
    for (let i = 0; i < 4; i++) setDelta(sk, L.joints[i], qX(a[i]));
    setDelta(sk, L.joints[4], qX(hoof));
  }
  sk.top.updateMatrixWorld(true);
  return { err };
}

/**
 * Dying (once, stays lying): front legs buckle, the hindquarters sag, the horse tips onto its
 * right side; neck and head sink, the tail falls. Without IK – the legs fold freely.
 */
function dyingPose(sk, p) {
  const sm = (a, b) => { const x = Math.min(1, Math.max(0, (p - a) / (b - a))); return x * x * (3 - 2 * x); };
  const knees = sm(0, 0.35), sink = sm(0.1, 0.55), tip = sm(0.4, 0.9);
  const root = sk.objs.get(RIG.root), rr = sk.rest.get(RIG.root);
  // first forward onto the knees, then onto the side (rotation about the longitudinal axis just above the ground)
  const pitch = qX(-0.22 * knees + 0.16 * sink);
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.25 * tip);
  const dq = roll.clone().multiply(pitch);
  const pivot = new THREE.Vector3(-0.3, 0.05, -0.15);
  root.quaternion.copy(dq).multiply(rr.q);
  root.position.copy(rr.p).add(new THREE.Vector3(0, -0.3 * sink + 1.15 * tip, 0)).sub(pivot).applyQuaternion(dq).add(pivot);
  RIG.neck.forEach((n, i) => setDelta(sk, n, qX(-0.35 * sink - 0.15 * tip * (i === 0 ? 1 : 0.5))));
  setDelta(sk, RIG.head, qX(-0.2 * sink));
  RIG.tail.forEach((n, i) => setDelta(sk, n, qX(0.08 * sink * (i + 1) / 3)));
  RIG.ears.forEach((n) => setDelta(sk, n, qX(0.5 * sink)));
  for (const leg of LEGS) {
    const L = RIG.legs[leg];
    const f = L.kind === 'front' ? [0.35 * knees, 0.1 * knees, -1.6 * knees, -0.6 * knees, -0.3 * knees] : [0.45 * sink, -1.1 * sink, 1.5 * sink, -0.5 * sink, -0.3 * sink];
    L.joints.forEach((n, i) => setDelta(sk, n, qX(f[i])));
  }
  sk.top.updateMatrixWorld(true);
  return { err: 0 };
}

/**
 * Write clips into the document (rotations of all moving bones, position of the root bone). Every clip has
 * the same channels (otherwise when baking the pose of the previous clip would stick to unmoved bones).
 * @returns {Record<string, {frames:number, err:number, minTip:number}>} report
 */
export function authorClips(doc) {
  const sk = skeletonOf(doc);
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buffer = doc.getRoot().listBuffers()[0];
  const animated = [RIG.root, RIG.spine, ...RIG.neck, RIG.head, ...RIG.tail, ...RIG.ears, ...Object.values(RIG.legs).flatMap((l) => l.joints)];
  const report = {};
  for (const [name, def] of Object.entries(CLIPS)) {
    const clip = name === 'idle' ? 'idle' : name;
    const n = Math.round(def.period * FPS);
    const times = [], rot = new Map(animated.map((b) => [b, []])), pos = [];
    let err = 0, minTip = Infinity;
    for (let f = 0; f <= n; f++) {
      const r = pose(sk, clip, def.once ? f / n : (f % n) / n);
      err = Math.max(err, r.err);
      for (const leg of Object.values(RIG.legs)) minTip = Math.min(minTip, sk.objs.get(leg.tip).getWorldPosition(new THREE.Vector3()).y);
      times.push(f / FPS);
      for (const b of animated) rot.get(b).push(...sk.objs.get(b).quaternion.toArray());
      pos.push(...sk.objs.get(RIG.root).position.toArray());
    }
    // keep the quaternion signs continuous (otherwise interpolation takes the long way round)
    for (const arr of rot.values()) for (let i = 4; i < arr.length; i += 4) {
      if (arr[i] * arr[i - 4] + arr[i + 1] * arr[i - 3] + arr[i + 2] * arr[i - 2] + arr[i + 3] * arr[i - 1] < 0) for (let k = 0; k < 4; k++) arr[i + k] = -arr[i + k];
    }
    const anim = doc.createAnimation(name);
    const input = doc.createAccessor(`${name}_t`).setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const add = (node, pathName, type, arr) => {
      const s = doc.createAnimationSampler().setInput(input).setInterpolation('LINEAR')
        .setOutput(doc.createAccessor().setType(type).setArray(new Float32Array(arr)).setBuffer(buffer));
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes.get(node)).setTargetPath(pathName).setSampler(s));
    };
    for (const b of animated) add(b, 'rotation', 'VEC4', rot.get(b));
    add(RIG.root, 'translation', 'VEC3', pos);
    report[name] = { frames: n, err: +err.toFixed(4), minTip: +minTip.toFixed(4), speed: def.stride ? +gaitSpeed(def).toFixed(3) : 0 };
  }
  resetPose(sk);
  return report;
}

/** Rest pose of the hoof tips (for the report: ground). */
function restTips(doc) {
  const sk = skeletonOf(doc);
  return Math.min(...Object.values(RIG.legs).map((l) => sk.rest.get(l.tip).world.y));
}

/**
 * Game model from the Meshy remesh (assets-src/characters/horse_far/remeshed.glb): geometry, UV and textures of the
 * remesh, fitted to the rig's rest pose (same height and centre), skin weights from the nearest vertices of the
 * rig (farmesh.mjs). Skeleton, bone names and thus all clips stay those of the rig.
 */
async function remeshedGame(src, farFile) {
  const doc = await io.read(src);
  const root = doc.getRoot(), buffer = root.listBuffers()[0];
  const far = await io.read(farFile);
  const fpos = [], fuv = [], fnrm = [], fidx = [];
  for (const node of far.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = new THREE.Matrix4().fromArray(node.getWorldMatrix()), nm = new THREE.Matrix3().getNormalMatrix(m);
    for (const prim of mesh.listPrimitives()) {
      const p = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray(), nr = prim.getAttribute('NORMAL')?.getArray();
      const base = fpos.length / 3, v = new THREE.Vector3();
      for (let i = 0; i < p.length; i += 3) {
        fpos.push(...v.fromArray(p, i).applyMatrix4(m).toArray());
        fnrm.push(...(nr ? v.fromArray(nr, i).applyMatrix3(nm).normalize().toArray() : [0, 1, 0]));
      }
      fuv.push(...uv);
      for (const i of prim.getIndices()?.getArray() ?? Array.from({ length: p.length / 3 }, (_, k) => k)) fidx.push(i + base);
    }
  }
  const prim = root.listMeshes()[0].listPrimitives()[0];
  const nearPos = prim.getAttribute('POSITION').getArray();
  const pos = fitTo(new Float32Array(fpos), nearPos);
  const { joints, weights } = transferWeights({ pos: nearPos, joints: prim.getAttribute('JOINTS_0').getArray(), weights: prim.getAttribute('WEIGHTS_0').getArray() }, pos);
  const J = prim.getAttribute('JOINTS_0').getArray().constructor;
  for (const sem of prim.listSemantics()) prim.setAttribute(sem, null);
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  prim.setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', new Float32Array(fnrm)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(fuv)))
    .setAttribute('JOINTS_0', acc('VEC4', new J(joints))).setAttribute('WEIGHTS_0', acc('VEC4', weights))
    .setIndices(acc('SCALAR', new Uint32Array(fidx)));
  const fm = far.getRoot().listMaterials()[0], dm = root.listMaterials()[0];
  dm.getBaseColorTexture().setImage(fm.getBaseColorTexture().getImage()).setMimeType(fm.getBaseColorTexture().getMimeType());
  if (fm.getNormalTexture()) dm.getNormalTexture().setImage(fm.getNormalTexture().getImage()).setMimeType(fm.getNormalTexture().getMimeType());
  else dm.setNormalTexture(null);
  console.log(`Game model from remesh: ${fidx.length / 3} triangles`);
  return doc;
}

/** Game model without remesh: near model simplified, textures from the raw file (cleaned). */
async function simplifiedGame(src, nearFile, ratio, strict, outDir, model) {
  const tmp = path.join(outDir, `${model}.tmp.lod{n}.glb`);
  // fixed UV seams (otherwise fur, mane and saddle-cloth magenta run into each other as streaks); Meshy's many
  // islands then allow only ~5200 triangles. --loose-seams: ~2800 triangles, but with colour streaks
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-lods.mjs'), nearFile, '--ratios', ratio, '--errors', '0.02',
    '--keep-textures', ...(strict ? ['--strict-seams'] : []), '--out', tmp], { stdio: 'inherit' });
  const game = await io.read(tmp.replace('{n}', '1'));
  fs.unlinkSync(tmp.replace('{n}', '1'));
  await game.transform(dequantize());
  const raw = await io.read(src);
  await cleanMarker(raw);
  const rm = raw.getRoot().listMaterials()[0], gm = game.getRoot().listMaterials()[0];
  gm.getBaseColorTexture().setImage(rm.getBaseColorTexture().getImage()).setMimeType(rm.getBaseColorTexture().getMimeType());
  if (gm.getNormalTexture() && rm.getNormalTexture()) gm.getNormalTexture().setImage(rm.getNormalTexture().getImage()).setMimeType(rm.getNormalTexture().getMimeType());
  return game;
}

export async function buildHorse({ src = path.join(SRC_DIR, 'horse', 'rigged.glb'), outDir = OUT_DIR, model = 'Horse', preview = null, ratio = '0.22', strict = true, far = path.join(SRC_DIR, 'horse_far', 'remeshed.glb') } = {}) {
  const anim = await io.read(src);
  const report = authorClips(anim);
  console.log(`Rest pose hoof tips y=${restTips(anim).toFixed(4)}`);
  for (const [k, r] of Object.entries(report)) console.log(`${k}: ${r.frames} frames, hoof deviation stance ≤ ${r.err}, lowest hoof tip ${r.minTip}${r.speed ? `, ${r.speed} units/s` : ''}`);
  if (preview) { await io.write(preview, anim); console.log(`Preview: ${preview}`); return report; }
  // near model: texture 2048 (gaps filled), no animations
  const near = await io.read(src);
  console.log(`Magenta speckles painted over: ${await cleanMarker(near)} pixels`);
  await keepTexture(near, {}, 2048, false);
  const nearFile = path.join(outDir, `${model}.glb`);
  const kb0 = await finish(near, model, nearFile);
  // Game model: Meshy remesh (~2,000 triangles, own UV and texture) put onto the rig, weights transferred from the rig;
  // without remesh the near model simplified (fixed UV seams, ~5,500 triangles)
  const game = fs.existsSync(far) ? await remeshedGame(src, far) : await simplifiedGame(src, nearFile, ratio, strict, outDir, model);
  await keepTexture(game, {}, 1024, false);
  // paint over speckles and gaps next to the saddle cloth (new UV islands) in the game model once more
  console.log(`Game model: ${await cleanMarker(game)} pixels painted over`);
  const kb1 = await finish(game, model, path.join(outDir, `${model}.lod1.glb`));
  console.log(`${model}.glb ${kb0} KB, ${model}.lod1.glb ${kb1} KB (before clips)`);
  console.log(await animsToGame(model, outDir, { animsFrom: anim }));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  requireAssetsSrc('characters');
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
  await buildHorse({ preview: opt('--preview'), src: opt('--src'), outDir: opt('--out-dir'), ratio: opt('--ratio'), strict: !args.includes('--loose-seams'), far: args.includes('--no-remesh') ? '' : undefined });
}
