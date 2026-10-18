// Replace a held spear of the Meshy mesh by a simple round pole with a metal tip (spearmen).
//
// Meshy's spears are flat, bent planks welded to forearm and leg; even bound to the hand (weapons.mjs) they look odd.
// This script finds the weapon held by a hand as weapons.mjs does (axis of the held vertices, surface fill around
// it), cuts it out – every triangle with a weapon vertex beyond the fist, what lies close to the axis, long slivers
// of the old shaft at the fist and loose leftovers – and adds a pole along the same axis: 8-sided shaft plus a cone
// tip, 100 % on the hand. Colours come from the old weapon's texture (UV of the shaft's middle and of its tip end), so
// no texture changes. Afterwards hold.mjs turns the hand in the attack and cheer clips.
//
//   node scripts/asset-gen/pole.mjs <Model> [hand=RightHand]     (near and game model)
//
// Docs: docs/MODELLE.md#waffen-an-der-hand.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { threeOf, pose } from './rig3.mjs';
import { weaponVertices, mainAxis, lineDistance, mainMesh, skinned, dominantBones, neighbours } from './weapons.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'models', 'characters');
const SIDES = 8;
/** Kept around the wrist (share of the figure height): Meshy's fist closes around the old shaft well beyond weapons.mjs' GRIP. */
const FIST = 0.13;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/**
 * Shaft and tip as triangles along an axis. Pure (tested).
 * @param {number[]} from butt end @param {number[]} to tip end @param {number} radius shaft radius
 * @returns {{ pos: number[], nrm: number[], tip: boolean[], idx: number[] }} per vertex: tip = belongs to the metal tip
 */
export function poleGeometry(from, to, radius) {
  const a = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
  const L = a.length();
  a.normalize();
  const ref = Math.abs(a.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(a, ref).normalize(), w = new THREE.Vector3().crossVectors(a, u);
  const at = (t) => new THREE.Vector3(...from).addScaledVector(a, t * L);
  const pos = [], nrm = [], tip = [], idx = [];
  const ring = (t, r, isTip) => {
    const base = pos.length / 3;
    for (let k = 0; k < SIDES; k++) {
      const ang = (k / SIDES) * Math.PI * 2, d = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(w, Math.sin(ang));
      const p = at(t).addScaledVector(d, r);
      pos.push(p.x, p.y, p.z); nrm.push(d.x, d.y, d.z); tip.push(isTip);
    }
    return base;
  };
  const tube = (b0, b1) => { for (let k = 0; k < SIDES; k++) { const k1 = (k + 1) % SIDES; idx.push(b0 + k, b0 + k1, b1 + k, b1 + k, b0 + k1, b1 + k1); } };
  const TIP = 0.12;
  const s0 = ring(0, radius, false), s1 = ring(1 - TIP, radius, false);
  tube(s0, s1);
  // butt cap
  const c0 = pos.length / 3; { const p = at(0); pos.push(p.x, p.y, p.z); nrm.push(-a.x, -a.y, -a.z); tip.push(false); }
  for (let k = 0; k < SIDES; k++) idx.push(c0, s0 + (k + 1) % SIDES, s0 + k);
  // tip: collar then point
  const t0 = ring(1 - TIP, radius * 2.2, true);
  const c1 = pos.length / 3; { const p = at(1); pos.push(p.x, p.y, p.z); nrm.push(a.x, a.y, a.z); tip.push(true); }
  for (let k = 0; k < SIDES; k++) idx.push(t0 + k, t0 + (k + 1) % SIDES, c1);
  const c2 = pos.length / 3; { const p = at(1 - TIP); pos.push(p.x, p.y, p.z); nrm.push(-a.x, -a.y, -a.z); tip.push(true); }
  for (let k = 0; k < SIDES; k++) idx.push(c2, t0 + (k + 1) % SIDES, t0 + k);
  return { pos, nrm, tip, idx };
}

/** Affine map from rest (world) positions to mesh space, from four spread, non-coplanar vertices. */
function worldToMesh(rest, P) {
  const n = P.length / 3, pick = [];
  const ext = (k, sgn) => { let b = 0; for (let i = 1; i < n; i++) if (sgn * P[i * 3 + k] > sgn * P[b * 3 + k]) b = i; return b; };
  for (const [k, sgn] of [[1, -1], [1, 1], [0, -1], [0, 1], [2, -1], [2, 1]]) pick.push(ext(k, sgn));
  const homog = (arr, i) => new THREE.Vector4(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2], 1);
  // the four of the six extremes with the largest volume
  let best = null, bestVol = -1;
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) for (let d = c + 1; d < 6; d++) {
    const q = [pick[a], pick[b], pick[c], pick[d]];
    const W = new THREE.Matrix4();
    W.set(...[0, 1, 2, 3].flatMap((row) => q.map((i) => homog(rest, i).getComponent(row))));
    const vol = Math.abs(W.determinant());
    if (vol > bestVol) { bestVol = vol; best = q; }
  }
  const W = new THREE.Matrix4(), L = new THREE.Matrix4();
  W.set(...[0, 1, 2, 3].flatMap((row) => best.map((i) => homog(rest, i).getComponent(row))));
  L.set(...[0, 1, 2, 3].flatMap((row) => best.map((i) => homog(P, i).getComponent(row))));
  return L.multiply(W.invert());
}

/** Replace the weapon of `hand` in one file by a pole. @returns {Promise<string>} */
export async function replaceWithPole(file, hand = 'RightHand') {
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const g = await threeOf(io, doc);
  pose(g, null);
  const mesh = mainMesh(g);
  const rest = skinned(mesh), idx = mesh.geometry.index.array, boneOf = dominantBones(mesh), bones = mesh.skeleton.bones.map((b) => b.name);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 1; i < rest.length; i += 3) { ymin = Math.min(ymin, rest[i]); ymax = Math.max(ymax, rest[i]); }
  const height = ymax - ymin;
  const wrist = mesh.skeleton.bones[bones.indexOf(hand)].getWorldPosition(new THREE.Vector3()).toArray();
  const w = weaponVertices(rest, boneOf, neighbours(rest, idx), hand, wrist, height);
  if (!w) return `${hand}: no weapon found`;
  // the weapon beyond the fist (the hand itself stays)
  const beyondFist = (i) => Math.hypot(rest[i * 3] - wrist[0], rest[i * 3 + 1] - wrist[1], rest[i * 3 + 2] - wrist[2]) > FIST * height;
  const far = new Set(w.verts.filter(beyondFist));
  // document primitive: the main skinned mesh; local (mesh space) arrays, same vertex order as three
  const node = doc.getRoot().listNodes().filter((x) => x.getMesh() && x.getSkin())
    .sort((a, b) => b.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount() - a.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount())[0];
  const prim = node.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray();
  let lymin = Infinity, lymax = -Infinity;
  for (let i = 1; i < P.length; i += 3) { lymin = Math.min(lymin, P[i]); lymax = Math.max(lymax, P[i]); }
  const lh = lymax - lymin, farList = [...far], loc = farList.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
  const armBones = new RegExp(`^${hand.slice(0, -4)}(Hand|ForeArm|Arm)$`);
  // axis in mesh space from the weapon's vertices; ends = extent along it; tip = the end higher up in the rest pose
  const { c, a } = mainAxis(loc);
  const ts = loc.map((p) => (p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2]);
  const tmin = Math.min(...ts), tmax = Math.max(...ts);
  const end = (t) => [c[0] + a[0] * t, c[1] + a[1] * t, c[2] + a[2] * t];
  const nearestAt = (t) => { let best = farList[0], d = Infinity; ts.forEach((tt, k) => { if (Math.abs(tt - t) < d) { d = Math.abs(tt - t); best = farList[k]; } }); return best; };
  const up = rest[nearestAt(tmax) * 3 + 1] >= rest[nearestAt(tmin) * 3 + 1];
  const from = end(up ? tmin : tmax), to = end(up ? tmax : tmin);
  // colours: UV of weapon vertices at the middle of the shaft and at the tip end
  const uvAt = (frac) => { const i = nearestAt(up ? tmin + (tmax - tmin) * frac : tmax - (tmax - tmin) * frac); return [UV[i * 2], UV[i * 2 + 1]]; };
  const woodUv = uvAt(0.45), metalUv = uvAt(0.97);
  const geo = poleGeometry(from, to, 0.011 * lh);
  // leftovers of the old weapon that hang on other bones: everything close to the axis between both ends, whatever
  // it is weighted to
  const along = (i) => (P[i * 3] - c[0]) * a[0] + (P[i * 3 + 1] - c[1]) * a[1] + (P[i * 3 + 2] - c[2]) * a[2];
  /** distance from the old weapon's axis relative to the height */
  const offAxis = (i) => lineDistance([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], c, a) / lh;
  // where along the axis the fist sits: the wrist's projection
  const wl = new THREE.Vector3(...wrist).applyMatrix4(worldToMesh(rest, P)).toArray();
  const fistAt = (wl[0] - c[0]) * a[0] + (wl[1] - c[1]) * a[1] + (wl[2] - c[2]) * a[2];
  for (let i = 0; i < P.length / 3; i++) {
    if (far.has(i) || offAxis(i) > 0.02) continue;
    // at the fist only what hangs on other bones than the arm (the old shaft welded to the thigh) and the old
    // shaft sticking out of the fist along the axis
    if (!beyondFist(i) && armBones.test(boneOf[i]) && Math.abs(along(i) - fistAt) < 0.045 * lh) continue;
    if (beyondFist(i) && (along(i) < tmin || along(i) > tmax)) continue;
    far.add(i);
  }
  const longest = (tri) => Math.max(...[[0, 1], [1, 2], [0, 2]].map(([x, y]) => Math.hypot(rest[tri[x] * 3] - rest[tri[y] * 3], rest[tri[x] * 3 + 1] - rest[tri[y] * 3 + 1], rest[tri[x] * 3 + 2] - rest[tri[y] * 3 + 2])));
  // cut out the old weapon
  const I = prim.getIndices().getArray();
  const kept = [];
  let cut = 0;
  for (let t = 0; t < I.length; t += 3) {
    const n = (far.has(I[t]) ? 1 : 0) + (far.has(I[t + 1]) ? 1 : 0) + (far.has(I[t + 2]) ? 1 : 0);
    if (n >= 1) { cut++; continue; } // one is enough: a single old weapon vertex would stretch the rest into a strand
    const tri = [I[t], I[t + 1], I[t + 2]];
    // long slivers of the old shaft from the fist down to the foot (body triangles are far shorter)
    if (tri.some((i) => boneOf[i] === hand) && longest(tri) > 0.12 * height) { cut++; continue; }
    kept.push(I[t], I[t + 1], I[t + 2]);
  }
  // loose pieces of the old weapon (a spear's lower end hung on the foot): small parts apart from the body
  // close to the old weapon's axis, also beyond its ends
  {
    const used = new Set(kept), nbr = neighbours(P, kept), seen = new Int32Array(P.length / 3).fill(-1), parts = [];
    for (const s of used) {
      if (seen[s] >= 0) continue;
      const part = [s]; seen[s] = parts.length;
      for (let q = 0; q < part.length; q++) for (const j of nbr[part[q]]) if (seen[j] < 0 && used.has(j)) { seen[j] = parts.length; part.push(j); }
      parts.push(part);
    }
    const body = parts.reduce((m, x) => (x.length > m.length ? x : m), []);
    // 0.1: the old weapon may be bent away from its line; tiny parts (Meshy meshes are one piece): slivers anywhere
    const drop = new Set(parts.filter((x) => x !== body && x.length < body.length / 20 && (x.length <= Math.max(6, body.length / 200) || Math.min(...x.map(offAxis)) < 0.1)).flat());
    if (drop.size) {
      const k2 = [];
      for (let t = 0; t < kept.length; t += 3) if (drop.has(kept[t])) cut++; else k2.push(kept[t], kept[t + 1], kept[t + 2]);
      kept.length = 0; kept.push(...k2);
    }
  }
  // append the pole's vertices to every attribute
  const n0 = prim.getAttribute('POSITION').getCount(), nNew = geo.pos.length / 3, handIdx = bones.indexOf(hand);
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), old = acc.getArray(), size = acc.getElementSize();
    const out = new (old.constructor)(old.length + nNew * size);
    out.set(old);
    for (let k = 0; k < nNew; k++) {
      const o = (n0 + k) * size;
      if (sem === 'POSITION') out.set(geo.pos.slice(k * 3, k * 3 + 3), o);
      else if (sem === 'NORMAL') out.set(geo.nrm.slice(k * 3, k * 3 + 3), o);
      else if (sem === 'TEXCOORD_0') out.set(geo.tip[k] ? metalUv : woodUv, o);
      else if (sem === 'TANGENT') { const nx = geo.nrm[k * 3], ny = geo.nrm[k * 3 + 1], nz = geo.nrm[k * 3 + 2]; const t = Math.abs(ny) < 0.9 ? [nz, 0, -nx] : [1, 0, 0]; const l = Math.hypot(...t) || 1; out.set([t[0] / l, t[1] / l, t[2] / l, 1], o); }
      else if (sem === 'JOINTS_0') out.set([handIdx, 0, 0, 0], o);
      else if (sem === 'WEIGHTS_0') out.set([old instanceof Uint8Array ? 255 : old instanceof Uint16Array ? 65535 : 1, 0, 0, 0], o);
      // other attributes (colours …): copy the first vertex
      else out.set(old.slice(0, size), o);
    }
    acc.setArray(out);
  }
  const newIdx = [...kept, ...geo.idx.map((i) => i + n0)];
  const total = n0 + nNew;
  prim.getIndices().setArray(total > 65535 ? new Uint32Array(newIdx) : new Uint16Array(newIdx));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' })); // quantized again like the other models
  await io.write(file, doc);
  return `${hand}: cut ${cut} triangles of the old weapon, pole ${geo.idx.length / 3} triangles`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [model, hand = 'RightHand'] = process.argv.slice(2);
  for (const f of [`${model}.lod1.glb`, `${model}.glb`]) console.log(`${f}: ${await replaceWithPole(path.join(DIR, f), hand)}`);
}
