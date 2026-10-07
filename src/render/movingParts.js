// Moving parts of own building models (windmill sails, water wheels, weather vanes).
// Meshy delivers every building as ONE mesh. When a model is loaded, the triangles inside a cylinder around the
// part's axis are cut out into their own mesh below a pivot group, which the renderer turns (Renderer.syncBuilding).
// Coordinates are in model space of the original GLB; the detail levels (<name>.lod1/2) share it.
// Find and check the values with tools/moving-parts.html (node scripts/asset-gen/moving-parts.mjs <model>).

import * as THREE from 'three';

/**
 * @typedef {object} MovingPart
 * @property {number[]} pivot point on the axis (model space)
 * @property {number[]} axis direction of the axis (normalised on use); the part turns around it
 * @property {number} radius cylinder radius around the axis: triangles whose centre lies inside belong to the part
 * @property {number[]} span [from, to] along the axis, measured from the pivot
 * @property {number} speed radians per second (sign = direction)
 * @property {number[][]} [exclude] boxes [minX, minY, minZ, maxX, maxY, maxZ] that stay with the building
 * @property {number[]} [half] direction across the axis: only the half on this side is kept and copied, turned by 180°,
 *   onto the other side (for a rotor whose one half Meshy got wrong)
 * @property {number} [bridge] triangles whose corners lie on both sides of the cut and whose longest edge is longer
 *   than this are dropped (Meshy slivers that join e.g. a sail to the tower; default 0.08)
 */

/** @type {Record<string, MovingPart[]>} model name (without folder and LOD suffix) → parts */
export const MOVING_PARTS = {
  // wind wheel: two wheels on one axle across the tower top (without stone top, flag pole and flag); their lower half
  // is flattened and frayed in the model, so the upper half is used twice
  windwheel: [{
    pivot: [0, 0.455, 0.028], axis: [1, 0, 0], radius: 0.31, span: [-0.33, 0.33], speed: 1.5, half: [0, 1, 0],
    exclude: [[-0.13, -1, -0.16, 0.13, 0.335, 0.2], [-0.09, 0.55, -0.06, -0.01, 1, 0.04], [-0.12, 0.74, -0.4, 0.05, 1, 0.03]],
  }],
  // weather tower: weathercock turns slowly, the cup anemometer below it fast
  weather_tower: [
    { pivot: [-0.164, 0.585, 0.118], axis: [0, 1, 0], radius: 0.115, span: [0, 0.2], speed: 0.5 },
    { pivot: [-0.164, 0.485, 0.118], axis: [0, 1, 0], radius: 0.115, span: [0, 0.1], speed: 3 },
  ],
  // farm level 2: sails on the wooden trestle (without its head, legs and the house roof)
  farm2: [{
    pivot: [-0.43, 0.405, -0.32], axis: [0.97, 0, -0.235], radius: 0.72, span: [-0.3, 0.1], speed: 1.2,
    exclude: [
      [-0.75, 0.3, -0.5, -0.56, 0.52, -0.1], [-0.75, -1, -0.41, -0.3, 0.3, -0.23], [-0.8, -1, -0.53, -0.505, 0.12, -0.12],
      [-0.8, -1, -0.6, -0.49, 0, -0.05], [-0.8, -1, -0.45, -0.3, 0.06, -0.2], [-0.5, -1, -0.3, -0.2, -0.135, 0.25],
      [-0.265, -1, -0.1, 1, 0.3, 1], [-0.36, -1, 0.17, 1, 0.3, 1],
    ],
  }],
  // farm level 3: sails in front of the stone mill tower (without the tower wall below)
  farm3: [{
    pivot: [-0.05, 0.425, -0.83], axis: [0, 0, 1], radius: 0.82, span: [-0.08, 0.055], speed: 1.2,
    exclude: [[-0.25, -1, -1, 0.1, 0.18, 1], [-0.35, -1, -1, -0.25, 0.06, 1]],
  }],
  // sawmill level 2: water wheel on the east wall (its back is painted onto the wall and stays)
  sawmill2: [{
    pivot: [0.66, -0.545, 0.235], axis: [1, 0, 0], radius: 0.4, span: [-0.11, 0.05], speed: 1,
    exclude: [[0.4, -1, 0.5, 1, -0.8, 1], [0.4, -1, -1, 1, -0.8, -0.08], [0.4, -1, -1, 1, -0.915, 1]],
  }],
  // stonemason level 2: wheel on its stand behind the house
  stonemason2: [{
    pivot: [0.38, -0.505, -0.515], axis: [1, 0, 0], radius: 0.185, span: [-0.07, 0.07], speed: 1,
    exclude: [[-1, -1, -0.365, 1, 1, 1], [-1, -1, -1, 1, -0.665, 1]],
  }],
};

const v = new THREE.Vector3(), a = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3();

/**
 * Index of the part a point belongs to, or -1.
 * @param {MovingPart[]} parts @param {THREE.Vector3} q
 */
export function partAt(parts, q) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    a.fromArray(part.axis).normalize();
    p.fromArray(part.pivot);
    d.subVectors(q, p);
    const along = d.dot(a);
    if (along < part.span[0] || along > part.span[1]) continue;
    if (d.addScaledVector(a, -along).lengthSq() > part.radius * part.radius) continue;
    if (part.exclude?.some((b) => q.x >= b[0] && q.y >= b[1] && q.z >= b[2] && q.x <= b[3] && q.y <= b[4] && q.z <= b[5])) continue;
    return i;
  }
  return -1;
}

/**
 * Splits one geometry (already in model space) by triangle centre into the rest and one geometry per part.
 * Non-indexed output; attributes are copied as floats (meshopt stores them quantised).
 * @param {THREE.BufferGeometry} geo @param {MovingPart[]} parts
 * @returns {{rest: THREE.BufferGeometry, parts: (THREE.BufferGeometry|null)[]}}
 */
export function splitGeometry(geo, parts) {
  const pos = geo.attributes.position, idx = geo.index;
  const count = idx ? idx.count : pos.count;
  const owner = new Int16Array(count / 3);
  const sizes = new Array(parts.length + 1).fill(0);
  const corner = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < count / 3; t++) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
      corner[k].set(pos.getX(i), pos.getY(i), pos.getZ(i));
      v.addScaledVector(corner[k], 1 / 3);
    }
    const o = partAt(parts, v);
    // long sliver across the cut: belongs to neither side
    if (corner.some((c) => partAt(parts, c) !== o)) {
      const bridge = parts[o]?.bridge ?? parts.find((_, k) => corner.some((c) => partAt(parts, c) === k))?.bridge ?? 0.08;
      const edge = Math.max(corner[0].distanceTo(corner[1]), corner[1].distanceTo(corner[2]), corner[2].distanceTo(corner[0]));
      if (edge > bridge) { owner[t] = -1; continue; }
    }
    owner[t] = o + 1;
    sizes[owner[t]]++;
  }
  const out = sizes.map((n) => {
    if (!n) return null;
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3 * attr.itemSize), attr.itemSize));
    }
    return { g, n: 0 };
  });
  const names = Object.keys(geo.attributes);
  for (let t = 0; t < count / 3; t++) {
    if (owner[t] < 0) continue;
    const o = out[owner[t]];
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
      const at = o.n * 3 + k;
      for (const name of names) {
        const src = geo.attributes[name], dst = o.g.attributes[name];
        for (let c = 0; c < src.itemSize; c++) dst.array[at * src.itemSize + c] = src.getComponent(i, c);
      }
    }
    o.n++;
  }
  for (const o of out) if (o) o.g.computeBoundingSphere();
  return { rest: out[0]?.g ?? new THREE.BufferGeometry(), parts: out.slice(1).map((o) => o?.g ?? null) };
}

/**
 * Keeps the triangles on the `half` side of the axis (centre test) and adds a copy of them turned by 180° around it.
 * Geometry relative to the pivot, non-indexed with float attributes (output of splitGeometry).
 * @param {THREE.BufferGeometry} geo @param {number[]} axis @param {number[]} half
 */
export function doubleHalf(geo, axis, half) {
  const pos = geo.attributes.position, h = new THREE.Vector3().fromArray(half);
  const keep = [];
  for (let t = 0; t < pos.count / 3; t++) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.x += pos.getX(t * 3 + k), v.y += pos.getY(t * 3 + k), v.z += pos.getZ(t * 3 + k);
    if (v.dot(h) >= 0) keep.push(t);
  }
  const turn = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3().fromArray(axis).normalize(), Math.PI);
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const n = attr.itemSize, f = new Float32Array(keep.length * 2 * 3 * n);
    keep.forEach((t, j) => {
      f.set(attr.array.subarray(t * 3 * n, (t + 1) * 3 * n), j * 3 * n);
      f.set(attr.array.subarray(t * 3 * n, (t + 1) * 3 * n), (keep.length + j) * 3 * n);
    });
    const a = new THREE.BufferAttribute(f, n);
    out.setAttribute(name, a);
  }
  // turn the copy: positions and directions (normal, tangent)
  for (const name of ['position', 'normal', 'tangent']) {
    const a = out.attributes[name];
    if (!a) continue;
    for (let i = keep.length * 3; i < a.count; i++) {
      v.set(a.getX(i), a.getY(i), a.getZ(i));
      if (name === 'position') v.applyMatrix4(turn); else v.transformDirection(turn);
      a.setXYZ(i, v.x, v.y, v.z);
    }
  }
  out.computeBoundingSphere();
  return out;
}

/** Copy with float attributes (meshopt quantises; transforming normalised ints would clip values outside [-1, 1]). */
function floatGeometry(src) {
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const [name, attr] of Object.entries(src.attributes)) {
    const f = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) f[i * attr.itemSize + c] = attr.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(f, attr.itemSize));
  }
  return g;
}

/**
 * Cuts the moving parts out of a loaded model (in place). Each part becomes a group at its pivot
 * (userData.turn = {axis, speed}) holding a mesh with the part's triangles. Models without parts stay untouched.
 * @param {string} name model name, e.g. 'buildings/windwheel.lod1' @param {THREE.Object3D} scene
 * @returns {number} number of parts cut out
 */
export function splitMovingParts(name, scene) {
  const parts = MOVING_PARTS[name.replace(/^buildings\//, '').replace(/\.lod\d$/, '')];
  if (!parts) return 0;
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((m) => { if (m.isMesh) meshes.push(m); });
  const groups = parts.map((part) => {
    const g = new THREE.Group();
    g.name = 'turn';
    g.position.fromArray(part.pivot);
    g.userData.turn = { axis: new THREE.Vector3().fromArray(part.axis).normalize(), speed: part.speed };
    scene.add(g);
    return g;
  });
  for (const m of meshes) {
    const geo = floatGeometry(m.geometry).applyMatrix4(m.matrixWorld);
    const { rest, parts: cut } = splitGeometry(geo, parts);
    // the rest stays where the mesh was: back into its local space
    rest.applyMatrix4(m.matrixWorld.clone().invert());
    m.geometry = rest;
    cut.forEach((g, i) => {
      if (!g) return;
      g.translate(-parts[i].pivot[0], -parts[i].pivot[1], -parts[i].pivot[2]);
      if (parts[i].half) g = doubleHalf(g, parts[i].axis, parts[i].half);
      const pm = new THREE.Mesh(g, m.material);
      pm.name = m.name; // detail levels take the material of the original by mesh name
      pm.castShadow = m.castShadow; pm.receiveShadow = m.receiveShadow;
      groups[i].add(pm);
    });
  }
  return groups.filter((g) => g.children.length).length;
}

/**
 * Turns the moving parts to the given time (seconds).
 * @param {THREE.Object3D[]} spinners groups with userData.turn @param {number} time
 */
export function turnParts(spinners, time) {
  for (const g of spinners) g.quaternion.setFromAxisAngle(g.userData.turn.axis, time * g.userData.turn.speed);
}

/** Moving part groups below an object (cut-out parts and the procedural placeholders). @param {THREE.Object3D} root */
export function findSpinners(root) {
  const out = [];
  root.traverse((o) => { if (o.userData.turn) out.push(o); });
  return out;
}
