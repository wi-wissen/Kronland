// Bind weapons rigidly to the hand. Meshy spreads the vertices of a blade over several bones (hand, forearm,
// even the knee) – in motion it then bends. Here all vertices within a cylinder from the hand
// to the blade tip are assigned 100 % to the hand bone.
//
// spec.rigid: [{ "joint": "RightHand", "tip": [x, y, z], "radius": 0.05, "start": 0.08 }]
//   tip: blade tip in model coordinates (rigged.glb, rest pose), radius: cylinder around the hand → tip line,
//   start: fraction of the distance from which binding starts (the fist itself stays as Meshy weighted it).

import * as THREE from 'three';

/**
 * Bind vertices within the cylinder a → b rigidly to a bone.
 * @param {ArrayLike<number>} pos positions (xyz)
 * @param {{ [i: number]: number, length: number }} joints JOINTS_0 (4 per vertex), is modified
 * @param {{ [i: number]: number, length: number }} weights WEIGHTS_0 (4 per vertex), is modified
 * @returns {number} number of bound vertices
 */
export function bindCylinder(pos, joints, weights, a, b, radius, joint, start = 0.08) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  let n = 0;
  for (let i = 0; i < pos.length / 3; i++) {
    const v = [pos[i * 3] - a[0], pos[i * 3 + 1] - a[1], pos[i * 3 + 2] - a[2]];
    const t = (v[0] * ab[0] + v[1] * ab[1] + v[2] * ab[2]) / L2;
    if (t < start || t > 1.03) continue;
    const d2 = (v[0] - ab[0] * t) ** 2 + (v[1] - ab[1] * t) ** 2 + (v[2] - ab[2] * t) ** 2;
    if (d2 > radius * radius) continue;
    for (let k = 0; k < 4; k++) { joints[i * 4 + k] = k === 0 ? joint : 0; weights[i * 4 + k] = k === 0 ? 1 : 0; }
    n++;
  }
  return n;
}

/** Apply spec.rigid to the skin mesh of a document (rest pose = bind pose). */
export function applyRigid(doc, list = []) {
  if (!list.length) return [];
  const skin = doc.getRoot().listSkins()[0];
  const names = skin.listJoints().map((j) => j.getName());
  const ibm = skin.getInverseBindMatrices().getArray();
  const jointPos = (k) => new THREE.Vector3().applyMatrix4(new THREE.Matrix4().fromArray(ibm, k * 16).invert()).toArray();
  const out = [];
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W) continue;
    const pos = prim.getAttribute('POSITION').getArray(), joints = J.getArray().slice(), weights = W.getArray().slice();
    for (const r of list) {
      const k = names.indexOf(r.joint);
      if (k < 0) throw new Error(`Bone ${r.joint} missing`);
      out.push(`${r.joint}: ${bindCylinder(pos, joints, weights, r.from ?? jointPos(k), r.tip, r.radius ?? 0.05, k, r.start ?? 0.08)} vertices`);
    }
    J.setArray(joints); W.setArray(weights);
  }
  return out;
}

/**
 * Remove superfluous parts (e.g. a second ramrod that Meshy made up): all triangles whose three
 * vertices lie in the cylinder a → b are dropped. spec.remove: [{ "from": [x,y,z], "tip": [x,y,z], "radius": 0.05, "start": 0.1 }]
 * @returns {number} removed triangles
 */
export function removeCylinder(doc, list = []) {
  if (!list.length) return 0;
  let removed = 0;
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices();
    if (!idx) continue;
    const arr = idx.getArray();
    const inside = new Uint8Array(pos.length / 3);
    for (const r of list) {
      const a = r.from, b = r.tip, ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2, rad2 = (r.radius ?? 0.05) ** 2, start = r.start ?? 0.1;
      for (let i = 0; i < inside.length; i++) {
        const v = [pos[i * 3] - a[0], pos[i * 3 + 1] - a[1], pos[i * 3 + 2] - a[2]];
        const t = (v[0] * ab[0] + v[1] * ab[1] + v[2] * ab[2]) / L2;
        if (t < start || t > 1.05) continue;
        if ((v[0] - ab[0] * t) ** 2 + (v[1] - ab[1] * t) ** 2 + (v[2] - ab[2] * t) ** 2 <= rad2) inside[i] = 1;
      }
    }
    const keep = [];
    for (let t = 0; t < arr.length; t += 3) {
      if (inside[arr[t]] && inside[arr[t + 1]] && inside[arr[t + 2]]) { removed++; continue; }
      keep.push(arr[t], arr[t + 1], arr[t + 2]);
    }
    idx.setArray(new arr.constructor(keep));
  }
  return removed;
}
