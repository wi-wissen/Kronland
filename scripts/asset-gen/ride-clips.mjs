// Attack in the saddle for the rider characters: the Meshy attacks were recorded standing – the hips turn up to ~45°
// along, the legs stand. On the horse that left the rider sitting sideways. This creates the clip `rideAttack` per character:
// upper body, arms, head (and tools) from `attack`, hips (rotation and position) and legs from the first pose of
// `ride`. In addition the rotation of the chest around the vertical axis is damped to 30 % (compensated at the lowest
// spine bone): the figure thus always looks in the riding direction, the upper body only turns slightly for the blow/shot.
//
//   node scripts/asset-gen/ride-clips.mjs                      # all models with a "ride" clip in the manifest
//   node scripts/asset-gen/ride-clips.mjs LightRider …
//
// Writes into the game model (<model>.lod1.glb, where the animations live). Repeatable (replaces the clip).

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import { threeOf, pose, skinnedPoints, idleHeight, worldPos, worldQuat, swing, setWorldQuat, ik2 } from './rig3.mjs';

const DIR = process.env.CHAR_DIR ?? 'public/models/characters';
/** Spine chain from the bottom (compensation) to the chest (measure of the facing direction). */
export const SPINE = ['Spine02', 'Spine01', 'Spine'];
/** Fraction of the chest rotation (around the vertical axis) that stays in the saddle. */
export const KEEP_TWIST = 0.3;
/** Bones that follow the riding pose in the saddle (hips and legs). */
export const SEAT_BONES = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))$/;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/**
 * Write the clip `rideAttack` into a document. @returns {number} number of channels
 * @param {import('@gltf-transform/core').Document} doc
 */
export function addRideAttack(doc, { from = 'attack', seat = 'ride', name = 'rideAttack' } = {}) {
  const root = doc.getRoot();
  const anims = new Map(root.listAnimations().map((a) => [a.getName(), a]));
  const atk = anims.get(from), ride = anims.get(seat);
  if (!atk || !ride) return 0;
  anims.get(name)?.dispose();
  const buffer = root.listBuffers()[0];
  const out = doc.createAnimation(name);
  // riding pose: first value per channel
  const seatVal = new Map();
  for (const ch of ride.listChannels()) {
    const s = ch.getSampler(), size = ch.getTargetPath() === 'rotation' ? 4 : 3;
    seatVal.set(`${ch.getTargetNode().getName()}.${ch.getTargetPath()}`, s.getOutput().getArray().slice(0, size));
  }
  const samplers = new Map();
  let n = 0;
  for (const ch of atk.listChannels()) {
    const node = ch.getTargetNode(), p = ch.getTargetPath(), key = `${node.getName()}.${p}`;
    const src = ch.getSampler();
    let s;
    if (SEAT_BONES.test(node.getName()) && seatVal.has(key)) {
      // fixed in the riding pose, on the same time axis as the attack (two keys suffice)
      const t = src.getInput().getArray();
      const v = seatVal.get(key);
      s = doc.createAnimationSampler().setInterpolation('LINEAR')
        .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array([t[0], t[t.length - 1]])).setBuffer(buffer))
        .setOutput(doc.createAccessor().setType(v.length === 4 ? 'VEC4' : 'VEC3').setArray(new Float32Array([...v, ...v])).setBuffer(buffer));
    } else {
      s = samplers.get(src);
      if (!s) {
        s = doc.createAnimationSampler().setInterpolation(src.getInterpolation())
          .setInput(doc.createAccessor().setType('SCALAR').setArray(src.getInput().getArray().slice()).setBuffer(buffer))
          .setOutput(doc.createAccessor().setType(src.getOutput().getType()).setArray(src.getOutput().getArray().slice()).setNormalized(src.getOutput().getNormalized()).setBuffer(buffer));
        samplers.set(src, s);
      }
    }
    out.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(p).setSampler(s));
    n++;
  }
  dampTwist(doc, out, seatVal);
  return n;
}

/** Hip joints this far above the saddle point (world units): the backside rests on the saddle. */
export const SEAT_LIFT = 0.02;
/** Gap between the rider's legs and the horse's barrel (world units). */
export const LEG_GAP = 0.012;
/** Below the saddle pad (world units under the saddle point) the legs must lie outside the horse. */
export const PAD = 0.14;

/**
 * Cross-section of the horse around the saddle: per cell (y, z) the extent in x of all vertices (world units).
 * @param {{ p: THREE.Vector3 }[]} pts horse vertices in world units
 */
export function barrel(pts, cell = 0.03) {
  const m = new Map();
  for (const { p } of pts) {
    const k = `${Math.round(p.y / cell)},${Math.round(p.z / cell)}`;
    const c = m.get(k) ?? { lo: Infinity, hi: -Infinity };
    c.lo = Math.min(c.lo, p.x); c.hi = Math.max(c.hi, p.x);
    m.set(k, c);
  }
  /** Depth of a point inside the horse (0 = outside), with gap. */
  const depth = (p, gap = LEG_GAP) => {
    const c = m.get(`${Math.round(p.y / cell)},${Math.round(p.z / cell)}`);
    if (!c) return 0;
    const lo = c.lo - gap, hi = c.hi + gap;
    return p.x > lo && p.x < hi ? Math.min(p.x - lo, hi - p.x) : 0;
  };
  /** Half width of the horse at height y around z (largest |x| in the neighbouring cells). */
  const half = (y, z) => {
    let w = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const c = m.get(`${Math.round(y / cell) + dy},${Math.round(z / cell) + dz}`);
      if (c) w = Math.max(w, Math.abs(c.lo), Math.abs(c.hi));
    }
    return w;
  };
  return { depth, half };
}

const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/;
/** Riding leg: knee this far in front of the hip (× thigh length), ankle this far behind the knee (× shin length). */
export const KNEE_FORWARD = 0.5, ANKLE_BACK = 0.15;

/**
 * Seat of a rider in the saddle. The rider (three scene, posed in the riding pose) is changed in place:
 * hips centred over the saddle and the hip joints lifted to `saddleY + SEAT_LIFT`; per leg the knee lies at the side of
 * the horse in front of the hip, the shin hangs down along the flank, the foot keeps its orientation. The distance
 * from the flank grows until no leg vertex below the saddle pad lies in the horse.
 * @param {(p: THREE.Vector3) => THREE.Vector3} toWorld model → world units (rider placement in the game)
 * @param {ReturnType<typeof barrel>} horse
 * @returns {{ shift: THREE.Vector3, legs: { side: string, gap: number, depth: number }[], local: Map<string, THREE.Quaternion> }}
 *   shift in world units; local = new local rotation of the leg bones
 */
export function fitSeat(rider, toWorld, horse, saddleY, scale) {
  const bone = (n) => rider.scene.getObjectByName(n);
  const W = (o) => toWorld(worldPos(o));
  const L = W(bone('LeftUpLeg')), R = W(bone('RightUpLeg'));
  const shift = new THREE.Vector3(-(L.x + R.x) / 2, saddleY + SEAT_LIFT - (L.y + R.y) / 2, 0);
  // the shift moves the whole figure: express targets in the unshifted model space
  const toModel = (w) => { const p0 = toWorld(new THREE.Vector3()); return w.clone().sub(shift).sub(p0).divideScalar(scale); };
  const legs = [], local = new Map();
  // penetration of a leg: deep quantile of its vertices below the saddle pad (single stray vertices – boot straps,
  // weights of hanging gear – do not push the leg out)
  const legDepth = (side) => {
    const d = [];
    for (const v of skinnedPoints(rider)) {
      if (!v.bone.startsWith(side) || !LEG.test(v.bone)) continue;
      const p = toWorld(v.p).add(shift);
      if (p.y < saddleY - PAD) d.push(horse.depth(p));
    }
    d.sort((x, y) => x - y);
    return d.length ? d[Math.floor(d.length * 0.985)] : 0;
  };
  for (const side of ['Left', 'Right']) {
    const up = bone(side + 'UpLeg'), leg = bone(side + 'Leg'), foot = bone(side + 'Foot');
    const footQ = worldQuat(foot), rest = [up, leg, foot].map((o) => o.quaternion.clone());
    const hip = W(up).add(shift), a = W(leg).distanceTo(W(up)), b = W(foot).distanceTo(W(leg));
    const s = Math.sign(hip.x) || (side === 'Left' ? 1 : -1);
    const place = (gap) => {
      // knee: at the flank (gap outside), KNEE_FORWARD × a in front of the hip, height so that the thigh keeps its length
      const K = new THREE.Vector3(0, hip.y - a * 0.6, hip.z + a * KNEE_FORWARD);
      for (let i = 0; i < 4; i++) {
        K.x = s * (horse.half(K.y, K.z) + gap);
        const dx = K.x - hip.x, dz = K.z - hip.z;
        K.y = hip.y - Math.sqrt(Math.max(0, a * a - dx * dx - dz * dz));
      }
      const A = new THREE.Vector3(0, K.y - b, K.z - b * ANKLE_BACK);
      for (let i = 0; i < 4; i++) {
        A.x = s * (horse.half(A.y, A.z) + gap * 0.8);
        const dx = A.x - K.x, dz = A.z - K.z;
        A.y = K.y - Math.sqrt(Math.max(0, b * b - dx * dx - dz * dz));
      }
      [up, leg, foot].forEach((o, i) => { o.quaternion.copy(rest[i]); });
      rider.scene.updateMatrixWorld(true);
      swing(up, leg, toModel(K));
      swing(leg, foot, toModel(A));
      setWorldQuat(foot, footQ);
    };
    let gap = 0.02, depth = Infinity;
    for (; gap <= 0.2; gap += 0.005) {
      place(gap);
      depth = legDepth(side);
      if (depth <= 0.006) break;
    }
    legs.push({ side, gap, depth, place, bones: [up, leg, foot] });
  }
  // both legs equally far from the flank (symmetric seat)
  const gap = Math.max(...legs.map((l) => l.gap));
  for (const l of legs) {
    l.place(gap);
    l.gap = gap; l.depth = legDepth(l.side);
    for (const o of l.bones) local.set(o.name, o.quaternion.clone());
    delete l.place; delete l.bones;
  }
  return { shift, legs, local };
}

/**
 * Write a seat (fitSeat) into a clip: Hips translation shifted; the leg bones get the change of their local rotation at the
 * fitted frame (new · old⁻¹) on every key. `old` = local rotations before fitSeat.
 * @param {number} scale rider scale (model units → world units)
 */
export function applySeat(doc, rider, seat, old, scale, clip = 'ride') {
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === clip);
  if (!anim) return;
  const chan = (n, path) => anim.listChannels().find((c) => c.getTargetNode().getName() === n && c.getTargetPath() === path);
  const buffer = doc.getRoot().listBuffers()[0];
  const edit = (ch, fn) => {
    if (!ch) return;
    const s = ch.getSampler(), out = s.getOutput().getArray().slice();
    fn(out);
    const ns = doc.createAnimationSampler().setInterpolation(s.getInterpolation()).setInput(s.getInput())
      .setOutput(doc.createAccessor().setType(s.getOutput().getType()).setArray(out).setBuffer(buffer));
    anim.addSampler(ns);
    ch.setSampler(ns);
  };
  // shift: world units → model units → local space of the hips' parent
  const hips = rider.scene.getObjectByName('Hips');
  const pm = hips.parent.matrixWorld;
  const local = seat.shift.clone().divideScalar(scale).applyMatrix4(new THREE.Matrix4().extractRotation(pm).invert())
    .divide(new THREE.Vector3().setFromMatrixScale(pm));
  // nothing to do on a repeated run (the seat is already right)
  if (seat.shift.length() > 1e-4) edit(chan('Hips', 'translation'), (a) => { for (let i = 0; i < a.length; i += 3) { a[i] += local.x; a[i + 1] += local.y; a[i + 2] += local.z; } });
  for (const [n, q] of seat.local) {
    const d = q.clone().multiply(old.get(n).clone().invert());
    if (Math.abs(d.w) > 1 - 1e-7) continue;
    edit(chan(n, 'rotation'), (a) => {
      const k = new THREE.Quaternion();
      for (let i = 0; i < a.length; i += 4) k.fromArray(a, i).premultiply(d).normalize().toArray(a, i);
    });
  }
}

/** Yaw angle of a world rotation (facing +z around the vertical axis). */
const yawOf = (q) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };

/**
 * Damp the chest rotation around the vertical axis: per keyframe measure the rotation of the chest (SPINE[last]) relative to the
 * riding pose and rotate it back by (1 − KEEP_TWIST) at the lowest spine bone (SPINE[0]). Needs identical time axes of the
 * spine channels (Meshy clips: yes); otherwise the clip stays unchanged.
 */
function dampTwist(doc, anim, seatVal) {
  const ch = (name) => anim.listChannels().find((c) => c.getTargetNode().getName() === name && c.getTargetPath() === 'rotation');
  const chans = SPINE.map(ch), hips = ch('Hips');
  if (chans.some((c) => !c) || !hips) return;
  const nKeys = chans[0].getSampler().getInput().getCount();
  if (chans.some((c) => c.getSampler().getInput().getCount() !== nKeys)) return;
  // world rotation above the hips (armature etc.)
  const top = new THREE.Quaternion();
  for (let p = hips.getTargetNode().getParentNode(); p; p = p.getParentNode()) top.premultiply(new THREE.Quaternion().fromArray(p.getRotation()));
  const hipsQ = new THREE.Quaternion().fromArray(seatVal.get('Hips.rotation'));
  const parentW = top.clone().multiply(hipsQ); // parent of the lowest spine bone
  const chest = (qs) => qs.reduce((acc, q) => acc.multiply(q), parentW.clone());
  const ref = yawOf(chest(SPINE.map((b) => new THREE.Quaternion().fromArray(seatVal.get(`${b}.rotation`) ?? [0, 0, 0, 1]))));
  const outs = chans.map((c) => c.getSampler().getOutput().getArray());
  const low = Float32Array.from(outs[0]);
  const inv = parentW.clone().invert();
  for (let k = 0; k < nKeys; k++) {
    const qs = outs.map((a) => new THREE.Quaternion().fromArray(a, k * 4));
    let e = yawOf(chest(qs)) - ref;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    const fix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -e * (1 - KEEP_TWIST));
    // local' = parent⁻¹ · fix · parent · local
    inv.clone().multiply(fix).multiply(parentW).multiply(qs[0]).toArray(low, k * 4);
  }
  const s0 = chans[0].getSampler();
  const s = doc.createAnimationSampler().setInterpolation(s0.getInterpolation()).setInput(s0.getInput())
    .setOutput(doc.createAccessor().setType('VEC4').setArray(low).setBuffer(doc.getRoot().listBuffers()[0]));
  anim.addSampler(s);
  chans[0].setSampler(s);
}

/** Shot in the saddle (`rideShoot`): key times (fraction of the clip) and the pose per key. Release = RIDE_SHOT_RELEASE. */
export const RIDE_SHOT = { duration: 2, keys: [[0, 'rest'], [0.22, 'aim'], [0.5, 'aim'], [0.55, 'recoil'], [0.68, 'aim'], [0.8, 'aim'], [1, 'rest']] };
export const RIDE_SHOT_RELEASE = 0.5;
const ARMS = ['RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'];

/**
 * Axis of a weapon held in a hand, in the hand's local frame: from the wrist to the centre of the vertices that hang
 * on the hand beyond the palm (`stock`), and across it the main direction of their spread (`across`, the crossbow's prod).
 * @returns {{ stock: THREE.Vector3, across: THREE.Vector3, length: number } | null} length in model units
 */
export function heldAxis(g, handName) {
  const hand = g.scene.getObjectByName(handName);
  const wrist = worldPos(hand), reach = wrist.distanceTo(worldPos(hand.parent)) * 0.6;
  const inv = hand.matrixWorld.clone().invert();
  const pts = skinnedPoints(g).filter((v) => v.bone === handName && v.p.distanceTo(wrist) > reach).map((v) => v.p);
  if (pts.length < 8) return null;
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const stockW = c.clone().sub(wrist).normalize();
  // spread across the stock: power iteration on the covariance of the perpendicular parts
  const perp = pts.map((p) => { const d = p.clone().sub(c); return d.addScaledVector(stockW, -d.dot(stockW)); });
  let v = new THREE.Vector3(1, 0.3, 0.2).addScaledVector(stockW, -stockW.dot(new THREE.Vector3(1, 0.3, 0.2))).normalize();
  for (let it = 0; it < 50; it++) {
    const n = new THREE.Vector3();
    for (const d of perp) n.addScaledVector(d, d.dot(v));
    if (n.lengthSq() < 1e-12) break;
    v = n.normalize();
  }
  const rot = new THREE.Matrix4().extractRotation(inv);
  return { stock: stockW.applyMatrix4(rot).normalize(), across: v.applyMatrix4(rot).normalize(), length: c.distanceTo(wrist) * 2 };
}

/**
 * Write the clip `rideShoot` (crossbow in the right hand): riding pose of `seat`, the arms raise the weapon to the
 * eye, it points forward (slightly down), the left hand supports the stock; short recoil at the release, then it
 * comes down again. Hips, legs and spine stay in the riding pose – the rider looks in the riding direction.
 * @param {Awaited<ReturnType<typeof threeOf>>} g three scene of the same document (with the final `seat` clip)
 * @returns {boolean}
 */
export function addRideShoot(doc, g, { seat = 'ride', name = 'rideShoot', hand = 'RightHand' } = {}) {
  const root = doc.getRoot();
  const ride = root.listAnimations().find((a) => a.getName() === seat);
  if (!ride) return false;
  root.listAnimations().find((a) => a.getName() === name)?.dispose();
  pose(g, seat, 0);
  const axis = heldAxis(g, hand);
  if (!axis) return false;
  const bone = (n) => g.scene.getObjectByName(n);
  const rest = new Map(ARMS.map((n) => [n, bone(n).quaternion.clone()]));
  const chest = worldPos(bone('Spine02')), head = worldPos(bone('Head')), shoulder = worldPos(bone('RightArm'));
  const arm = shoulder.distanceTo(worldPos(bone('RightForeArm'))) + worldPos(bone('RightForeArm')).distanceTo(worldPos(bone(hand)));
  const solve = (recoil) => {
    for (const n of ARMS) bone(n).quaternion.copy(rest.get(n));
    g.scene.updateMatrixWorld(true);
    // weapon direction: forward, a little down; recoil lifts the muzzle and pushes the hand back
    const D = new THREE.Vector3(0, recoil ? 0.1 : -0.08, 1).normalize();
    const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), D).normalize();
    const T = new THREE.Vector3((shoulder.x + chest.x) / 2, shoulder.y + (head.y - shoulder.y) * 0.25, shoulder.z + arm * (recoil ? 0.4 : 0.45));
    ik2(bone('RightArm'), bone('RightForeArm'), bone(hand), T, new THREE.Vector3(Math.sign(shoulder.x - chest.x) || -1, -1, 0).normalize());
    // hand orientation: (stock, across) of the weapon → (D, across)
    const local = new THREE.Matrix4().makeBasis(axis.stock, axis.across, new THREE.Vector3().crossVectors(axis.stock, axis.across).normalize());
    const want = new THREE.Matrix4().makeBasis(D, across, new THREE.Vector3().crossVectors(D, across).normalize());
    const q = new THREE.Quaternion().setFromRotationMatrix(want.multiply(local.invert()));
    // the prod may lie either way across: keep the variant closer to the riding pose
    const flip = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis.stock, Math.PI));
    const now = worldQuat(bone(hand));
    setWorldQuat(bone(hand), Math.abs(now.dot(q)) >= Math.abs(now.dot(flip)) ? q : flip);
    // left hand under the front of the stock
    const L = worldPos(bone(hand)).addScaledVector(D, axis.length * 0.55).add(new THREE.Vector3(0, -0.03 * arm, 0));
    const ls = worldPos(bone('LeftArm'));
    ik2(bone('LeftArm'), bone('LeftForeArm'), bone('LeftHand'), L, new THREE.Vector3(Math.sign(ls.x - chest.x) || 1, -1, 0).normalize());
    return new Map(ARMS.map((n) => [n, bone(n).quaternion.clone()]));
  };
  const poses = { rest, aim: solve(false), recoil: solve(true) };
  const buffer = root.listBuffers()[0];
  const out = doc.createAnimation(name);
  const T = RIDE_SHOT.duration;
  const times = new Float32Array(RIDE_SHOT.keys.map(([t]) => t * T));
  const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  const two = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, T])).setBuffer(buffer);
  for (const ch of ride.listChannels()) {
    const node = ch.getTargetNode(), p = ch.getTargetPath(), size = p === 'rotation' ? 4 : 3;
    let s;
    if (p === 'rotation' && ARMS.includes(node.getName())) {
      // arms: keyed poses, signs kept continuous
      const arr = new Float32Array(RIDE_SHOT.keys.length * 4);
      let prev = null;
      RIDE_SHOT.keys.forEach(([, k], i) => {
        const q = poses[k].get(node.getName()).clone();
        if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        q.toArray(arr, i * 4); prev = q;
      });
      s = doc.createAnimationSampler().setInterpolation('LINEAR').setInput(input).setOutput(doc.createAccessor().setType('VEC4').setArray(arr).setBuffer(buffer));
    } else {
      // everything else: first pose of the seat clip
      const v = ch.getSampler().getOutput().getArray().slice(0, size);
      s = doc.createAnimationSampler().setInterpolation('LINEAR').setInput(two)
        .setOutput(doc.createAccessor().setType(size === 4 ? 'VEC4' : 'VEC3').setArray(new Float32Array([...v, ...v])).setBuffer(buffer));
    }
    out.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(p).setSampler(s));
  }
  return true;
}

/** Role of a rider model in the manifest (seat offset, mount attachment). */
export function riderRole(manifest, model) {
  for (const r of Object.values(manifest.roles)) {
    const mount = r.attach?.find((a) => a.role === 'mount.horse');
    if (mount && (r.model === model || r.variants?.some((v) => v.model === model))) return { seatOffset: r.seatOffset ?? 0, mount };
  }
  return null;
}

/**
 * Seat a rider on the horse in the clip `ride` (fitSeat → applySeat). Game proportions from the manifest.
 * @returns {ReturnType<typeof fitSeat> | null}
 */
export async function seatRider(doc, horseDoc, manifest, model) {
  const role = riderRole(manifest, model);
  if (!role || !doc.getRoot().listAnimations().some((a) => a.getName() === 'ride')) return null;
  const hdef = manifest.models.Horse;
  const horse = await threeOf(io, horseDoc), rider = await threeOf(io, doc);
  const hs = (hdef.height / idleHeight(horse)) * (role.mount.scale ?? 1), rs = (manifest.models[model].height ?? 1) / idleHeight(rider);
  const off = new THREE.Vector3(...(role.mount.offset ?? [0, 0, 0]));
  pose(horse, 'idle', 0);
  const hpts = skinnedPoints(horse).map((v) => ({ p: v.p.multiplyScalar(hs).add(off) }));
  const saddleY = hdef.saddle.at[1] * hs + off.y, seat = saddleY + role.seatOffset;
  pose(rider, 'ride', 0);
  const old = new Map();
  rider.scene.traverse((o) => { if (LEG.test(o.name)) old.set(o.name, o.quaternion.clone()); });
  const fit = fitSeat(rider, (p) => p.clone().multiplyScalar(rs).add(new THREE.Vector3(0, seat, 0)), barrel(hpts), saddleY, rs);
  applySeat(doc, rider, fit, old, rs);
  return fit;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest.models).filter((k) => manifest.models[k].clips?.ride);
  const horseDoc = await io.read(path.join(DIR, 'Horse.lod1.glb'));
  for (const m of names) {
    const file = path.join(DIR, `${m}.lod1.glb`);
    const doc = await io.read(file);
    const fit = await seatRider(doc, horseDoc, manifest, m);
    const n = addRideAttack(doc);
    // crossbow riders: aimed shot (roles that play `rideShoot` for `shoot`)
    const shoots = Object.values(manifest.roles).some((r) => r.clipAlias?.shoot === 'rideShoot' && (r.model === m || r.variants?.some((v) => v.model === m)));
    const shot = shoots && addRideShoot(doc, await threeOf(io, doc));
    // replaced samplers leave their key data behind
    await doc.transform(prune({ propertyTypes: [PropertyType.ACCESSOR], keepAttributes: true, keepLeaves: true }));
    await io.write(file, doc);
    console.log(`${m}: seat shift ${fit ? fit.shift.toArray().map((v) => v.toFixed(3)).join(',') : '–'}, legs ${fit?.legs.map((l) => `${l.side} ${l.gap.toFixed(3)} off the flank (in horse ${l.depth.toFixed(3)})`).join(', ') ?? '–'}; rideAttack with ${n} channels${shot ? ', rideShoot' : ''}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
