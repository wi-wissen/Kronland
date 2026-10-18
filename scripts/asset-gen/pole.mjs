// Replace a held weapon or tool of the Meshy mesh by a simple one: a round pole with a metal tip (spearmen) or a
// frame saw (sawyer).
//
// Meshy's spears are flat, bent planks and the saw's blade is welded into the thigh; even bound to the hand
// (weapons.mjs) they look odd. This script finds what the hand holds as weapons.mjs does (axis or, for a flat
// tool, plane of the held vertices, surface fill around it), cuts it out (every triangle with a vertex of it beyond
// the fingers, plus loose leftovers) and adds the new one in the same place, 100 % on the hand: an 8-sided shaft with
// a cone tip along the axis, or a saw frame along the old saw's smallest rectangle with a handle into the hand. For
// the saw the hand is also detached from the thigh it was welded to. Colours come from the old tool's texture (UVs),
// so no texture changes.
//
//   node scripts/asset-gen/pole.mjs <Model> [hand=RightHand] [pole|saw]     (near and game model)
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
import { weaponVertices, mainAxis, lineDistance, flatPart, mainMesh, skinned, dominantBones, neighbours, GRIP } from './weapons.mjs';

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

/**
 * Square bar from `from` to `to` with half extents `hw` (along unit `w`) and `hd` (along unit `d`), flat faces.
 * Appends to `g` (same layout as poleGeometry).
 */
function bar(g, from, to, w, hw, d, hd, metal) {
  const corner = (p, sw, sd) => [0, 1, 2].map((k) => p[k] + w[k] * hw * sw + d[k] * hd * sd);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) || 1;
  const ax = [0, 1, 2].map((k) => (to[k] - from[k]) / len);
  const face = (pts, nrm) => {
    const b = g.pos.length / 3;
    for (const p of pts) { g.pos.push(...p); g.nrm.push(...nrm); g.tip.push(metal); }
    g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const neg = (v) => v.map((x) => -x);
  // sides along the bar; the winding follows the outward normal
  face([corner(from, 1, -1), corner(to, 1, -1), corner(to, 1, 1), corner(from, 1, 1)], w);
  face([corner(from, -1, 1), corner(to, -1, 1), corner(to, -1, -1), corner(from, -1, -1)], neg(w));
  face([corner(from, 1, 1), corner(to, 1, 1), corner(to, -1, 1), corner(from, -1, 1)], d);
  face([corner(from, -1, -1), corner(to, -1, -1), corner(to, 1, -1), corner(from, 1, -1)], neg(d));
  face([corner(from, 1, 1), corner(from, -1, 1), corner(from, -1, -1), corner(from, 1, -1)], neg(ax));
  face([corner(to, 1, -1), corner(to, -1, -1), corner(to, -1, 1), corner(to, 1, 1)], ax);
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

/**
 * Smallest rectangle around 2D points (1° steps). Pure (tested).
 * @param {number[][]} pts @returns {{ a: number[], b: number[], c: number[], h: number[] }} axes, centre, half sizes
 */
export function minRect(pts) {
  let best = null;
  for (let deg = 0; deg < 90; deg++) {
    const t = (deg * Math.PI) / 180, a = [Math.cos(t), Math.sin(t)], b = [-Math.sin(t), Math.cos(t)];
    const pa = pts.map((p) => p[0] * a[0] + p[1] * a[1]), pb = pts.map((p) => p[0] * b[0] + p[1] * b[1]);
    const [a0, a1, b0, b1] = [Math.min(...pa), Math.max(...pa), Math.min(...pb), Math.max(...pb)];
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) {
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      best = { area, a, b, c: [a[0] * ca + b[0] * cb, a[1] * ca + b[1] * cb], h: [(a1 - a0) / 2, (b1 - b0) / 2] };
    }
  }
  return { a: best.a, b: best.b, c: best.c, h: best.h };
}

/**
 * Frame saw in the plane (u, v): two wooden arms across, a stretcher in the middle, a metal blade at one end and a
 * cord at the other; optionally the first arm runs on into a handle up to `handle` (v). Pure (tested). `at(pu, pv)` maps plane coordinates to positions.
 * @returns {{ pos: number[], nrm: number[], tip: boolean[], idx: number[] }} tip = metal
 */
export function sawGeometry({ u, v, n, at, u0, u1, vb, vc, vm, r, blade, bladeThick, handle }) {
  const g = { pos: [], nrm: [], tip: [], idx: [] };
  bar(g, at(u0, vb), at(u0, vc), u, r, n, r, false);
  bar(g, at(u1, vb), at(u1, vc), u, r, n, r, false);
  bar(g, at(u0, vm), at(u1, vm), v, r * 0.8, n, r * 0.8, false);
  bar(g, at(u0, vc), at(u1, vc), v, r * 0.3, n, r * 0.3, false);
  bar(g, at(Math.min(u0, u1) - r, vb), at(Math.max(u0, u1) + r, vb), v, blade, n, bladeThick, true);
  // handle: the arm at the hand runs on into the grip
  if (handle !== undefined && Math.abs(handle) > Math.abs(vc)) bar(g, at(u0, vc), at(u0, handle), u, r * 1.2, n, r * 1.2, false);
  return g;
}

/**
 * Replace the weapon or tool of `hand` in one file by a pole or a frame saw.
 * @param {string} file @param {string} hand @param {'pole'|'saw'} kind @returns {Promise<string>}
 */
export async function replaceHeld(file, hand = 'RightHand', kind = 'pole') {
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
  let lymin = Infinity, lymax = -Infinity;
  for (let i = 1; i < P.length; i += 3) { lymin = Math.min(lymin, P[i]); lymax = Math.max(lymax, P[i]); }
  const lh = lymax - lymin, farList = [...far], loc = farList.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
  const beyondGrip = (i) => Math.hypot(rest[i * 3] - wrist[0], rest[i * 3 + 1] - wrist[1], rest[i * 3 + 2] - wrist[2]) > GRIP * height * 0.6;
  /** @type {{ pos: number[], nrm: number[], tip: boolean[], idx: number[] }} */
  let geo;
  let woodUv, metalUv;
  /** distance of a vertex from the old tool's line or plane, relative to the height (loose leftovers) */
  let offTool;
  if (kind === 'saw') {
    const flat = flatPart(loc);
    if (!flat) return `${hand}: the held tool is not flat, no saw`;
    const { c, n } = flat;
    // the frame's own directions: the smallest rectangle around the old saw in its plane (PCA axes are arbitrary
    // for a nearly square frame)
    const rect = minRect(loc.map((p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [d[0] * flat.u[0] + d[1] * flat.u[1] + d[2] * flat.u[2], d[0] * flat.v[0] + d[1] * flat.v[1] + d[2] * flat.v[2]]; }));
    const dir = (e) => [0, 1, 2].map((k) => flat.u[k] * e[0] + flat.v[k] * e[1]);
    // the wrist in mesh space: the rest pose maps mesh space affinely to the world, fitted on four spread vertices
    const wl = new THREE.Vector3(...wrist).applyMatrix4(worldToMesh(rest, P)).toArray();
    const wd = [wl[0] - c[0], wl[1] - c[1], wl[2] - c[2]];
    const dot = (d, e) => d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
    // arms run towards the hand (the hand holds the end of one arm); the other direction spans the frame
    const [e1, e2] = [dir(rect.a), dir(rect.b)];
    const wa = [dot(wd, e1), dot(wd, e2)];
    const out1 = Math.max(0, Math.abs(wa[0]) - rect.h[0]), out2 = Math.max(0, Math.abs(wa[1]) - rect.h[1]);
    const armsAlong1 = out1 >= out2;
    const v = armsAlong1 ? e1 : e2, u = armsAlong1 ? e2 : e1, hv = armsAlong1 ? rect.h[0] : rect.h[1], hu = armsAlong1 ? rect.h[1] : rect.h[0];
    const rc = [0, 1, 2].map((k) => c[k] + dir(rect.c)[k]);
    const rel = (i) => [P[i * 3] - rc[0], P[i * 3 + 1] - rc[1], P[i * 3 + 2] - rc[2]];
    const at = (pu, pv) => [0, 1, 2].map((k) => rc[k] + u[k] * pu + v[k] * pv);
    const wr = [wl[0] - rc[0], wl[1] - rc[1], wl[2] - rc[2]], wu = dot(wr, u), wv = dot(wr, v);
    const r = 0.008 * lh;
    // the arm next to the hand gets a handle up to the wrist; the blade runs along the far end
    const handSide = wu >= 0 ? 1 : -1, handEnd = wv >= 0 ? 1 : -1;
    const u0 = handSide * (hu - r), u1 = -handSide * (hu - r), vc = handEnd * (hv - r), vb = -handEnd * (hv - r), vm = 0;
    const box = [-hu, hu, -hv, hv];
    geo = sawGeometry({ u, v, n, at, u0, u1, vb, vc, vm, r, blade: 0.012 * lh, bladeThick: 0.0015 * lh, handle: wv });
    // colours: wood from the middle of the frame, metal from the old blade's end of it
    const nearest = (pu0, pv0, list) => list.reduce((b, i) => { const d = rel(i), e = Math.hypot(dot(d, u) - pu0, dot(d, v) - pv0); return e < b[1] ? [i, e] : b; }, [list[0], Infinity])[0];
    const wi = nearest(u0, vm, farList), mi = nearest((u0 + u1) / 2, vb, farList);
    woodUv = [UV[wi * 2], UV[wi * 2 + 1]]; metalUv = [UV[mi * 2], UV[mi * 2 + 1]];
    // the old tool's parts on other bones: everything in its slab and extent
    const m = 0.02 * lh;
    const out = (i) => { const d = rel(i), pu = dot(d, u), pvv = dot(d, v); return Math.max(0, box[0] - pu, pu - box[1], box[2] - pvv, pvv - box[3]); };
    for (let i = 0; i < P.length / 3; i++) if (!far.has(i) && Math.abs(dot(rel(i), n)) < flat.thick && out(i) < m && beyondGrip(i)) far.add(i);
    offTool = (i) => Math.max(Math.abs(dot(rel(i), n)), out(i)) / lh;
  } else {
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
    woodUv = uvAt(0.45); metalUv = uvAt(0.97);
    geo = poleGeometry(from, to, 0.011 * lh);
    // leftovers of the old weapon that hang on other bones: everything close to the axis between both ends
    // (beyond the fingers), whatever it is weighted to
    const along = (i) => (P[i * 3] - c[0]) * a[0] + (P[i * 3 + 1] - c[1]) * a[1] + (P[i * 3 + 2] - c[2]) * a[2];
    offTool = (i) => lineDistance([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], c, a) / lh;
    for (let i = 0; i < P.length / 3; i++) {
      if (far.has(i) || along(i) < tmin || along(i) > tmax || offTool(i) > 0.02 || !beyondGrip(i)) continue;
      far.add(i);
    }
  }
  // the hand welded to the thigh (Meshy weights the fingers partly to the leg): around the wrist, drop the leg's
  // share and cut the seam between hand and leg
  const loose = new Set();
  if (kind === 'saw') {
    const J = prim.getAttribute('JOINTS_0').getArray(), Wt = prim.getAttribute('WEIGHTS_0').getArray();
    const side = hand.slice(0, -4), arm = new Set([bones.indexOf(hand), bones.indexOf(`${side}ForeArm`), bones.indexOf(`${side}Arm`)]);
    const leg = new Set(bones.map((b, k) => (new RegExp(`^${side}(UpLeg|Leg)$`).test(b) ? k : -1)).filter((k) => k >= 0));
    for (let i = 0; i < P.length / 3; i++) {
      if (far.has(i) || Math.hypot(rest[i * 3] - wrist[0], rest[i * 3 + 1] - wrist[1], rest[i * 3 + 2] - wrist[2]) > 2 * GRIP * height) continue;
      let onArm = 0, onLeg = 0;
      for (let k = 0; k < 4; k++) { if (arm.has(J[i * 4 + k])) onArm += Wt[i * 4 + k]; if (leg.has(J[i * 4 + k])) onLeg += Wt[i * 4 + k]; }
      if (onArm < 0.2 || onLeg === 0) continue;
      for (let k = 0; k < 4; k++) if (leg.has(J[i * 4 + k])) Wt[i * 4 + k] = 0;
      for (let k = 0; k < 4; k++) Wt[i * 4 + k] /= 1 - onLeg;
      loose.add(i);
    }
    var legDominant = (i) => leg.has(J[i * 4 + [0, 1, 2, 3].reduce((b, k) => (Wt[i * 4 + k] > Wt[i * 4 + b] ? k : b), 0)]);
  }
  // cut out the old weapon
  const I = prim.getIndices().getArray();
  const kept = [];
  let cut = 0;
  for (let t = 0; t < I.length; t += 3) {
    const n = (far.has(I[t]) ? 1 : 0) + (far.has(I[t + 1]) ? 1 : 0) + (far.has(I[t + 2]) ? 1 : 0);
    if (n >= 1) { cut++; continue; } // one is enough: a single old weapon vertex would stretch the rest into a strand
    const tri = [I[t], I[t + 1], I[t + 2]];
    if (loose.size && tri.some((i) => loose.has(i)) && tri.some((i) => legDominant(i))) { cut++; continue; }
    kept.push(I[t], I[t + 1], I[t + 2]);
  }
  // loose pieces of the old weapon (a spear's lower end hung on the foot): small parts apart from the body
  // close to the old tool's line or plane, also beyond its ends
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
    const drop = new Set(parts.filter((x) => x !== body && x.length < body.length / 20 && x.some((i) => used.has(i)) && Math.min(...x.map(offTool)) < 0.1).flat()); // 0.1: the old weapon may be bent away
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
  return `${hand}: cut ${cut} triangles of the old ${kind === 'saw' ? 'tool' : 'weapon'}, ${kind} ${geo.idx.length / 3} triangles`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [model, hand = 'RightHand', kind = 'pole'] = process.argv.slice(2);
  for (const f of [`${model}.lod1.glb`, `${model}.glb`]) console.log(`${f}: ${await replaceHeld(path.join(DIR, f), hand, kind)}`);
}
