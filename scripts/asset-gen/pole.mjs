// Replace a held weapon of the Meshy mesh by a simple round pole with a small metal tip (spearmen).
//
// Meshy's spears are flat, bent planks welded to forearm and leg; even bound to the hand (weapons.mjs) they look odd.
// This script finds the weapon held by a hand as weapons.mjs does (axis of the held vertices, surface fill around
// it), cuts it out (every triangle with a weapon vertex beyond the fingers) and adds a pole along the same
// axis: 8-sided shaft plus a cone tip, 100 % on the hand. Colours come from the old weapon's texture (UV of the
// shaft's middle and of its tip end), so no texture changes.
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
import { weaponVertices, mainAxis, mainMesh, skinned, dominantBones, neighbours, GRIP } from './weapons.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'models', 'characters');
const SIDES = 8;
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
  // the weapon beyond the fingers (the hand itself stays)
  const far = new Set(w.verts.filter((i) => Math.hypot(rest[i * 3] - wrist[0], rest[i * 3 + 1] - wrist[1], rest[i * 3 + 2] - wrist[2]) > GRIP * height * 0.6));
  // document primitive: the main skinned mesh; local (mesh space) arrays, same vertex order as three
  const node = doc.getRoot().listNodes().filter((x) => x.getMesh() && x.getSkin())
    .sort((a, b) => b.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount() - a.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount())[0];
  const prim = node.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray();
  // axis in mesh space from the weapon's vertices; ends = extent along it; tip = the end higher up in the rest pose
  const loc = [...far].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
  const { c, a } = mainAxis(loc);
  const ts = loc.map((p) => (p[0] - c[0]) * a[0] + (p[1] - c[1]) * a[1] + (p[2] - c[2]) * a[2]);
  const tmin = Math.min(...ts), tmax = Math.max(...ts);
  const end = (t) => [c[0] + a[0] * t, c[1] + a[1] * t, c[2] + a[2] * t];
  // which end is up in the world (rest pose): compare the world height of the vertices at both ends
  const farList = [...far];
  const yAt = (t) => { let best = farList[0], d = Infinity; ts.forEach((tt, k) => { if (Math.abs(tt - t) < d) { d = Math.abs(tt - t); best = farList[k]; } }); return rest[best * 3 + 1]; };
  const up = yAt(tmax) >= yAt(tmin);
  const from = end(up ? tmin : tmax), to = end(up ? tmax : tmin);
  // colours: UV of weapon vertices at the middle of the shaft and at the tip end
  const uvNear = (tFrac) => {
    const target = up ? tmin + (tmax - tmin) * tFrac : tmax - (tmax - tmin) * tFrac;
    let best = farList[0], d = Infinity;
    ts.forEach((tt, k) => { if (Math.abs(tt - target) < d) { d = Math.abs(tt - target); best = farList[k]; } });
    return [UV[best * 2], UV[best * 2 + 1]];
  };
  const shaftUv = uvNear(0.45), tipUv = uvNear(0.97);
  // shaft radius: thin, relative to the figure (mesh space height)
  let lymin = Infinity, lymax = -Infinity;
  for (let i = 1; i < P.length; i += 3) { lymin = Math.min(lymin, P[i]); lymax = Math.max(lymax, P[i]); }
  const pole = poleGeometry(from, to, 0.011 * (lymax - lymin));
  // leftovers of the old weapon that hang on other bones: everything close to the axis between both ends
  // (beyond the fingers), whatever it is weighted to
  const close = 0.02 * (lymax - lymin);
  for (let i = 0; i < P.length / 3; i++) {
    if (far.has(i)) continue;
    const d = [P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]];
    const t = d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
    if (t < tmin || t > tmax) continue;
    const r = Math.hypot(d[0] - t * a[0], d[1] - t * a[1], d[2] - t * a[2]);
    if (r > close) continue;
    if (Math.hypot(rest[i * 3] - wrist[0], rest[i * 3 + 1] - wrist[1], rest[i * 3 + 2] - wrist[2]) <= GRIP * height * 0.6) continue;
    far.add(i);
  }
  // cut out the old weapon
  const I = prim.getIndices().getArray();
  const kept = [];
  let cut = 0;
  for (let t = 0; t < I.length; t += 3) {
    const n = (far.has(I[t]) ? 1 : 0) + (far.has(I[t + 1]) ? 1 : 0) + (far.has(I[t + 2]) ? 1 : 0);
    if (n >= 1) { cut++; continue; } // one is enough: a single old weapon vertex would stretch the rest into a strand
    kept.push(I[t], I[t + 1], I[t + 2]);
  }
  // loose pieces of the old weapon (its lower end hung on the foot): small parts apart from the body that
  // touch the axis line, also beyond its ends
  {
    const nbr = neighbours(P, kept), seen = new Int32Array(P.length / 3).fill(-1), parts = [];
    for (let s = 0; s < P.length / 3; s++) {
      if (seen[s] >= 0 || !nbr[s].length) continue;
      const part = [s]; seen[s] = parts.length;
      for (let q = 0; q < part.length; q++) for (const j of nbr[part[q]]) if (seen[j] < 0) { seen[j] = parts.length; part.push(j); }
      parts.push(part);
    }
    const body = parts.reduce((m, x) => (x.length > m.length ? x : m), []);
    const used = new Set(kept);
    // distance from the axis line relative to the height (the old weapon may be bent away from it)
    const lineD = (i) => { const d = [P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]], t = d[0] * a[0] + d[1] * a[1] + d[2] * a[2]; return Math.hypot(d[0] - t * a[0], d[1] - t * a[1], d[2] - t * a[2]) / (lymax - lymin); };
    const drop = new Set(parts.filter((x) => x !== body && x.length < body.length / 20 && x.some((i) => used.has(i)) && Math.min(...x.map(lineD)) < 0.1).flat());
    if (drop.size) {
      const k2 = [];
      for (let t = 0; t < kept.length; t += 3) if (drop.has(kept[t])) cut++; else k2.push(kept[t], kept[t + 1], kept[t + 2]);
      kept.length = 0; kept.push(...k2);
    }
  }
  // append the pole's vertices to every attribute
  const n0 = prim.getAttribute('POSITION').getCount(), nNew = pole.pos.length / 3, handIdx = bones.indexOf(hand);
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), old = acc.getArray(), size = acc.getElementSize();
    const out = new (old.constructor)(old.length + nNew * size);
    out.set(old);
    for (let k = 0; k < nNew; k++) {
      const o = (n0 + k) * size;
      if (sem === 'POSITION') out.set(pole.pos.slice(k * 3, k * 3 + 3), o);
      else if (sem === 'NORMAL') out.set(pole.nrm.slice(k * 3, k * 3 + 3), o);
      else if (sem === 'TEXCOORD_0') out.set(pole.tip[k] ? tipUv : shaftUv, o);
      else if (sem === 'TANGENT') { const nx = pole.nrm[k * 3], ny = pole.nrm[k * 3 + 1], nz = pole.nrm[k * 3 + 2]; const t = Math.abs(ny) < 0.9 ? [nz, 0, -nx] : [1, 0, 0]; const l = Math.hypot(...t) || 1; out.set([t[0] / l, t[1] / l, t[2] / l, 1], o); }
      else if (sem === 'JOINTS_0') out.set([handIdx, 0, 0, 0], o);
      else if (sem === 'WEIGHTS_0') out.set([old instanceof Uint8Array ? 255 : old instanceof Uint16Array ? 65535 : 1, 0, 0, 0], o);
      // other attributes (colours …): copy the first vertex
      else out.set(old.slice(0, size), o);
    }
    acc.setArray(out);
  }
  const newIdx = [...kept, ...pole.idx.map((i) => i + n0)];
  const total = n0 + nNew;
  prim.getIndices().setArray(total > 65535 ? new Uint32Array(newIdx) : new Uint16Array(newIdx));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' })); // quantized again like the other models
  await io.write(file, doc);
  return `${hand}: cut ${cut} triangles of the old weapon, pole ${pole.idx.length / 3} triangles`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [model, hand = 'RightHand'] = process.argv.slice(2);
  for (const f of [`${model}.lod1.glb`, `${model}.glb`]) console.log(`${f}: ${await replaceWithPole(path.join(DIR, f), hand)}`);
}
