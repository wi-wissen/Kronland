// Held weapons and tools fully on the hand.
//
// Meshy delivers each character as one connected mesh, and its auto-rig weights a weapon by distance: the part of a
// blade, spear or bow that rests against the thigh in the rest pose follows the leg. When the arm moves (attack,
// cheer) that part stays behind and the weapon stretches into a long membrane – it looks torn or shattered.
//
// Per hand: the vertices clearly on the hand and farther from the wrist than the fingers are the held part; their
// main axis (PCA) is the weapon's axis. From there a flood fill over the mesh surface collects every vertex within
// the weapon's radius around that axis – the whole blade, also the part at the leg – and binds it 100 % to the hand.
// Afterwards the clips are played (except `die`): triangles that still join the hand with the body and stretch
// strongly (the weld between weapon and thigh) are removed.
//
//   node scripts/asset-gen/weapons.mjs [Model …] [--dry]     (default: all characters except Horse)
//
// Near model (<Model>.glb, clips from the game model) and game model (<Model>.lod1.glb). Positions and the
// quantised storage stay untouched; only the weights and the index buffer change. Docs: docs/MODELLE.md#waffen-an-der-hand.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { threeOf, pose } from './rig3.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'models', 'characters');
const HANDS = ['LeftHand', 'RightHand'];
/** Held part: farther from the wrist than this share of the figure height (beyond the fingers). */
export const GRIP = 0.08;
/** Fewer held vertices than this: the hand holds nothing. */
const MIN_SEEDS = 12;
/** A hand counts as torn (and is repaired) only beyond this stretch with the original weights. */
export const TORN = 6;
/** Bridges: longest edge stretched beyond this factor against the rest pose. */
export const BRIDGE_STRETCH = 2.5;
/** … or its area grew beyond this factor (long thin triangles along a weapon open up rather than stretch). */
export const BRIDGE_AREA = 3;
const SAMPLES = 12;
/** Left as Meshy made them: binding looked worse (saw frame, hammer floating). */
const KEEP = ['Horse', 'Sawyer', 'Smith'];

/**
 * Main axis of points (power iteration on the covariance). @param {number[][]} pts
 * @returns {{ c: number[], a: number[] }} centre and unit axis
 */
export function mainAxis(pts) {
  const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  let a = [1, 1, 1];
  for (let it = 0; it < 50; it++) {
    const b = [0, 1, 2].map((i) => C[i][0] * a[0] + C[i][1] * a[1] + C[i][2] * a[2]);
    const l = Math.hypot(...b) || 1;
    a = b.map((v) => v / l);
  }
  return { c, a };
}

/** Distance of p from the line c + t·a. */
export function lineDistance(p, c, a) {
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const t = d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
  return Math.hypot(d[0] - t * a[0], d[1] - t * a[1], d[2] - t * a[2]);
}

/**
 * Vertices of the weapon held by one hand. Pure (tested): rest positions, dominant bone per vertex, mesh
 * neighbours, the hand bone and its position, figure height.
 * @param {Float32Array} pos rest positions (x,y,z per vertex) @param {string[]} boneOf @param {number[][]} nbr
 * @param {string} hand @param {number[]} wrist @param {number} height
 * @returns {{ verts: number[], radius: number }|null}
 */
export function weaponVertices(pos, boneOf, nbr, hand, wrist, height) {
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const seeds = [];
  for (let i = 0; i < boneOf.length; i++) {
    if (boneOf[i] !== hand) continue;
    const p = P(i);
    if (Math.hypot(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]) > GRIP * height) seeds.push(i);
  }
  if (seeds.length < MIN_SEEDS) return null;
  // never take what the other arm holds (a hammer in the right hand resting against the left glove)
  const other = hand.startsWith('Left') ? 'Right' : 'Left';
  const otherArm = new RegExp(`^${other}(Hand|ForeArm|Arm|Shoulder)$`);
  const fill = (c, a, radius) => {
    const inside = new Uint8Array(boneOf.length);
    const queue = [...seeds];
    for (const s of seeds) inside[s] = 1;
    while (queue.length) {
      const v = queue.pop();
      for (const w of nbr[v]) {
        if (inside[w] || otherArm.test(boneOf[w]) || lineDistance(P(w), c, a) > radius) continue;
        inside[w] = 1;
        queue.push(w);
      }
    }
    const verts = [];
    for (let i = 0; i < inside.length; i++) if (inside[i]) verts.push(i);
    return verts;
  };
  // the first axis also sees glove and fingers; refine it from the weapon part found so far (beyond the grip)
  let held = seeds, verts = seeds, radius = 0;
  for (let it = 0; it < 3; it++) {
    const { c, a } = mainAxis(held.map(P));
    // radius: most of the held part (blade, shaft, bow limb) lies within it; bounded so that no body is swallowed
    const dist = held.map((i) => lineDistance(P(i), c, a)).sort((x, y) => x - y);
    radius = Math.min(0.05 * height, Math.max(0.012 * height, dist[Math.floor(dist.length * 0.8)] * 1.3));
    verts = fill(c, a, radius);
    const far = verts.filter((i) => { const p = P(i); return Math.hypot(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]) > GRIP * height; });
    if (far.length < MIN_SEEDS) break;
    held = far;
  }
  return { verts, radius };
}

/**
 * Triangles that still join a hand with the body and stretch beyond the limit in some clip frame. Hand–forearm
 * triangles of the same side count only away from the wrist (a spear welded along the forearm), not at the joint.
 * @param {ArrayLike<number>} idx @param {Float32Array} rest @param {Float32Array[]} posed @param {string[]} boneOf
 * @param {Record<string, number[]>} wrists rest position per hand bone @param {number} height
 */
export function findBridges(idx, rest, posed, boneOf, wrists = {}, height = 1, limit = BRIDGE_STRETCH, areaLimit = BRIDGE_AREA) {
  const len = (a, i, j) => Math.hypot(a[i * 3] - a[j * 3], a[i * 3 + 1] - a[j * 3 + 1], a[i * 3 + 2] - a[j * 3 + 2]);
  const area = (a, [i, j, k]) => {
    const ux = a[j * 3] - a[i * 3], uy = a[j * 3 + 1] - a[i * 3 + 1], uz = a[j * 3 + 2] - a[i * 3 + 2];
    const wx = a[k * 3] - a[i * 3], wy = a[k * 3 + 1] - a[i * 3 + 1], wz = a[k * 3 + 2] - a[i * 3 + 2];
    return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
  };
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    const b = v.map((i) => boneOf[i]);
    const hand = b.find((x) => HANDS.includes(x));
    if (!hand) continue;
    const side = hand.slice(0, hand.length - 4); // Left / Right
    // within the holding arm (hand, forearm of the same side) at the joint it is the wrist, not a bridge
    if (b.every((x) => x === hand || x === `${side}ForeArm`)) {
      const w = wrists[hand];
      const cx = (rest[v[0] * 3] + rest[v[1] * 3] + rest[v[2] * 3]) / 3, cy = (rest[v[0] * 3 + 1] + rest[v[1] * 3 + 1] + rest[v[2] * 3 + 1]) / 3, cz = (rest[v[0] * 3 + 2] + rest[v[1] * 3 + 2] + rest[v[2] * 3 + 2]) / 3;
      if (!w || Math.hypot(cx - w[0], cy - w[1], cz - w[2]) < GRIP * height) continue;
    }
    // long thin triangles along a weapon hardly get longer but open up: also the area counts
    const area0 = area(rest, v);
    let worst = 0, opened = 0;
    for (const p of posed) {
      for (const [i, j] of [[v[0], v[1]], [v[1], v[2]], [v[0], v[2]]]) worst = Math.max(worst, len(p, i, j) / Math.max(1e-6, len(rest, i, j)));
      opened = Math.max(opened, area(p, v) / Math.max(1e-12, area0));
    }
    if (worst > limit || opened > areaLimit) out.push(t / 3);
  }
  return out;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

export function mainMesh(g) {
  let mesh = null;
  g.scene.traverse((o) => { if (o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = o; });
  return mesh;
}
function mainPrim(doc) {
  const node = doc.getRoot().listNodes().filter((x) => x.getMesh() && x.getSkin())
    .sort((a, b) => b.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount() - a.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount())[0];
  return { node, prim: node.getMesh().listPrimitives()[0] };
}
/** Skinned positions of a mesh in world space. */
export function skinned(mesh) {
  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  const n = mesh.geometry.attributes.position.count, a = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }
  return a;
}
export function dominantBones(mesh) {
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, names = mesh.skeleton.bones.map((b) => b.name);
  const out = [];
  for (let i = 0; i < si.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    out.push(names[si.getComponent(i, best)]);
  }
  return out;
}
/** Neighbours over the mesh surface; vertices at the same position (UV seams) count as one. */
export function neighbours(pos, idx) {
  const n = pos.length / 3, key = new Map(), rep = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    if (!key.has(k)) key.set(k, i);
    rep[i] = key.get(k);
  }
  const twins = new Map();
  for (let i = 0; i < n; i++) (twins.get(rep[i]) ?? twins.set(rep[i], []).get(rep[i])).push(i);
  const nbr = Array.from({ length: n }, () => new Set());
  const link = (a, b) => { for (const x of twins.get(rep[a])) for (const y of twins.get(rep[b])) { nbr[x].add(y); nbr[y].add(x); } };
  for (let t = 0; t < idx.length; t += 3) { link(idx[t], idx[t + 1]); link(idx[t + 1], idx[t + 2]); link(idx[t], idx[t + 2]); }
  for (let i = 0; i < n; i++) for (const j of twins.get(rep[i])) if (j !== i) nbr[i].add(j);
  return nbr.map((s) => [...s]);
}

/** Rest and posed positions (all clips but `die`) of the main skinned mesh, dominant bones, wrists. */
async function sampled(doc, clips) {
  const g = await threeOf(io, doc);
  g.animations = clips;
  const mesh = mainMesh(g);
  pose(g, null);
  const rest = skinned(mesh), boneOf = dominantBones(mesh), bones = mesh.skeleton.bones.map((b) => b.name);
  const wrists = {};
  for (const hand of HANDS) { const k = bones.indexOf(hand); if (k >= 0) wrists[hand] = mesh.skeleton.bones[k].getWorldPosition(new THREE.Vector3()).toArray(); }
  const posed = [];
  for (const clip of clips) {
    if (clip.name === 'die') continue;
    for (let s = 0; s < SAMPLES; s++) { pose(g, clip.name, (clip.duration * s) / SAMPLES); posed.push(skinned(mesh)); }
  }
  return { mesh, rest, posed, boneOf, bones, wrists, idx: mesh.geometry.index.array };
}

/** Hand of a triangle (the first vertex whose dominant bone is a hand). */
const handOf = (idx, boneOf, t) => [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]].map((v) => boneOf[v]).find((b) => HANDS.includes(b));

/**
 * Bind the held weapons to the hands and drop the remaining bridges in one file – only for hands that tear
 * with the original weights (stretch beyond TORN); everything else stays as it is.
 * @param {string} file @param {any[]} clips three clips (the game model's) @returns {Promise<string>} report
 */
export async function fixWeapons(file, clips, { dry = false } = {}) {
  const doc = await io.read(file);
  const a = await sampled(doc, clips);
  const box = new THREE.Box3();
  for (let i = 0; i < a.rest.length; i += 3) box.expandByPoint(new THREE.Vector3(a.rest[i], a.rest[i + 1], a.rest[i + 2]));
  const height = box.max.y - box.min.y;
  const torn = new Set(findBridges(a.idx, a.rest, a.posed, a.boneOf, a.wrists, height, TORN, TORN).map((t) => handOf(a.idx, a.boneOf, t)));
  if (!torn.size) return 'no torn weapon, unchanged';
  const nbr = neighbours(a.rest, a.idx);
  const { prim } = mainPrim(doc);
  const J = prim.getAttribute('JOINTS_0').getArray(), W = prim.getAttribute('WEIGHTS_0').getArray();
  const full = W instanceof Uint8Array ? 255 : W instanceof Uint16Array ? 65535 : 1;
  const report = [];
  for (const hand of torn) {
    const w = weaponVertices(a.rest, a.boneOf, nbr, hand, a.wrists[hand], height);
    if (!w) continue;
    let moved = 0;
    for (const v of w.verts) {
      if (a.boneOf[v] !== hand) moved++;
      J.set([a.bones.indexOf(hand), 0, 0, 0], v * 4);
      W.set([full, 0, 0, 0], v * 4);
    }
    report.push(`${hand} ${w.verts.length} vertices (${moved} from other bones, radius ${(w.radius / height).toFixed(3)} h)`);
  }
  // bridges with the new weights, only at the repaired hands
  const b = await sampled(doc, clips);
  const bridges = new Set(findBridges(b.idx, b.rest, b.posed, b.boneOf, b.wrists, height).filter((t) => torn.has(handOf(b.idx, b.boneOf, t))));
  const I = prim.getIndices(), src = I.getArray();
  if (bridges.size) {
    const keep = new (src.constructor)(src.length - bridges.size * 3);
    let o = 0;
    for (let t = 0; t < src.length / 3; t++) if (!bridges.has(t)) { keep[o++] = src[t * 3]; keep[o++] = src[t * 3 + 1]; keep[o++] = src[t * 3 + 2]; }
    I.setArray(keep);
  }
  report.push(`${bridges.size} bridge triangles removed`);
  if (!dry) await io.write(file, doc);
  return report.join(', ');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const models = args.filter((a) => !a.startsWith('--'));
  const list = models.length ? models : fs.readdirSync(DIR).filter((f) => f.endsWith('.lod1.glb')).map((f) => f.replace('.lod1.glb', '')).filter((m) => !KEEP.includes(m));
  for (const m of list) {
    const clips = (await threeOf(io, await io.read(path.join(DIR, `${m}.lod1.glb`)))).animations;
    console.log(`${m} game model: ${await fixWeapons(path.join(DIR, `${m}.lod1.glb`), clips, { dry })}`);
    if (fs.existsSync(path.join(DIR, `${m}.glb`))) console.log(`${m} near model: ${await fixWeapons(path.join(DIR, `${m}.glb`), clips, { dry })}`);
  }
}
