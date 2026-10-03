// Procedural low-poly models (placeholders until CC0 assets are integrated).
// Each model: origin at the centre of the footprint, y = 0 is the ground. 1 unit = 1 tile.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PLAYER_COLORS = [0x2f5d9e, 0xa8323a, 0x3d8a4a, 0xc08a2a];
export const RES_COLORS = {
  gold: 0xe0b13a, clay: 0xb5653a, wood: 0x8a5a2b, stone: 0x9a968e, iron: 0x6d717c, sulfur: 0xd8c33a,
};

const BEAM = 0x5a3b22, DARK = 0x3a2a1c, STONE = 0x9b968c, PLASTER = 0xe3d6b8, THATCH = 0x9a7b45, ROOF = 0xa8503a;

const cache = new Map();
/** Shared material per colour. */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts }));
  return cache.get(key);
}

function mesh(geo, color) {
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color);
  m.position.set(x, y + h / 2, z);
  return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color);
  m.position.set(x, y + h / 2, z);
  return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = mesh(new THREE.ConeGeometry(r, h, seg), color);
  m.position.set(x, y + h / 2, z);
  return m;
}
function roofGeo(w, d, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

/** Half-timbered house. Front faces +z. */
function house(g, o) {
  const { w, d, h, wall = PLASTER, roof = ROOF, roofH = h * 0.7, x = 0, z = 0, door = true } = o;
  g.add(box(w, h, d, wall, x, 0, z));
  const r = mesh(roofGeo(w + 0.3, d + 0.3, roofH), roof);
  r.position.set(x, h, z); g.add(r);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, h, 0.1, BEAM, x + sx * w / 2, 0, z + sz * d / 2));
  g.add(box(w + 0.02, 0.08, d + 0.02, BEAM, x, h * 0.5, z));
  if (door) g.add(box(0.4, 0.65, 0.05, DARK, x, 0, z + d / 2 + 0.01));
  if (w > 1.4) for (const sx of [-1, 1]) g.add(box(0.26, 0.26, 0.04, 0x2c3a46, x + sx * w * 0.28, h * 0.62, z + d / 2 + 0.01));
}

function foundation(g, w, d) {
  g.add(box(w, 0.6, d, 0x8d8478, 0, -0.45, 0));
}

function flag(g, color, x, y, z) {
  g.add(cyl(0.025, 0.025, 1.2, BEAM, x, y, z, 5));
  const f = mesh(new THREE.PlaneGeometry(0.6, 0.36), color);
  f.material = mat(color, { side: THREE.DoubleSide });
  f.position.set(x + 0.3, y + 1.0, z);
  g.add(f);
}

/** @type {Record<string, (g: THREE.Group, w: number, d: number, level: number, pc: number) => void>} */
const BUILDERS = {
  headquarters(g, w, d, level, pc) {
    const k = 2.6 + level * 0.3;
    g.add(box(k, 2.2 + level * 0.5, k, STONE));
    const top = 2.2 + level * 0.5;
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) {
      g.add(box(0.25, 0.25, 0.25, STONE, i * k / 5, top, s * (k / 2 - 0.12)));
      g.add(box(0.25, 0.25, 0.25, STONE, s * (k / 2 - 0.12), top, i * k / 5));
    }
    const t = w / 2 - 0.55;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(cyl(0.5, 0.55, 3 + level * 0.5, 0xa29d93, sx * t, 0, sz * t, 10));
      g.add(cone(0.68, 1.2, pc, sx * t, 3 + level * 0.5, sz * t, 10));
    }
    g.add(box(0.8, 1.1, 0.06, DARK, 0, 0, k / 2 + 0.01));
    flag(g, pc, 0, top, 0);
  },
  villageCenter(g, w, d, level, pc) {
    house(g, { w: w - 1.2, d: d - 1.4, h: 1.4 + level * 0.3, roof: THATCH, z: -0.3 });
    g.add(box(0.7, 2.6 + level * 0.4, 0.7, STONE, w / 2 - 0.7, 0, -d / 2 + 0.7));
    g.add(cone(0.6, 0.9, pc, w / 2 - 0.7, 2.6 + level * 0.4, -d / 2 + 0.7, 4));
    g.add(cyl(0.35, 0.4, 0.4, STONE, -w / 2 + 0.7, 0, d / 2 - 0.6));
  },
  residence(g, w, d, level) {
    house(g, { w: w - 0.8, d: d - 1, h: 1.1 + level * 0.45, roof: level ? ROOF : THATCH });
    if (level) g.add(box(0.2, 0.7, 0.2, 0x8a6f5a, 0.4, 1.1 + level * 0.45 + 0.2, -0.3));
  },
  farm(g, w, d, level) {
    house(g, { w: 1.7, d: 1.6, h: 1.1, roof: THATCH, x: -w / 2 + 1.1, z: -0.3 });
    const field = mesh(new THREE.BoxGeometry(1.4, 0.05, d - 0.6), 0x7a5a3a);
    field.position.set(w / 2 - 0.9, 0.03, 0); g.add(field);
    for (let i = 0; i < 4; i++) g.add(box(1.2, 0.3, 0.12, 0xd9b44a, w / 2 - 0.9, 0.05, -d / 2 + 0.6 + i * 0.55));
    if (level >= 1) {
      g.add(cyl(0.35, 0.5, 1.6, 0xe8e0cc, -w / 2 + 0.6, 0, d / 2 - 0.5));
      g.add(cone(0.45, 0.5, BEAM, -w / 2 + 0.6, 1.6, d / 2 - 0.5));
    }
  },
  university(g, w, d, level) {
    g.add(box(w - 1, 1.6 + level * 0.4, d - 1.4, 0xd9cfb8, 0, 0, -0.2));
    const dome = mesh(new THREE.SphereGeometry(0.75 + level * 0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x4f7f8a);
    dome.position.set(0, 1.6 + level * 0.4, -0.2); g.add(dome);
    for (let i = -1; i <= 1; i++) g.add(cyl(0.09, 0.09, 1.3, 0xf0ead8, i * 0.6, 0, d / 2 - 0.55, 6));
    g.add(box(w - 1.4, 0.12, 0.5, 0xd9cfb8, 0, 1.3, d / 2 - 0.55));
  },
  chapel(g, w, d, level) {
    house(g, { w: w - 1, d: d - 1, h: 1.4 + level * 0.3, wall: 0xe6e0d0, roof: 0x5a6670, z: 0.2 });
    g.add(box(0.8, 2.6 + level * 0.6, 0.8, 0xe6e0d0, 0, 0, -d / 2 + 0.6));
    g.add(cone(0.6, 1.2, 0x5a6670, 0, 2.6 + level * 0.6, -d / 2 + 0.6, 4));
  },
  storehouse(g, w, d, level) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.12, 1.3, 0.12, BEAM, sx * (w / 2 - 0.5), 0, sz * (d / 2 - 0.5)));
    const r = mesh(roofGeo(w - 0.6, d - 0.6, 0.7), ROOF); r.position.y = 1.3; g.add(r);
    for (let i = 0; i < 3; i++) g.add(box(0.4, 0.4, 0.4, 0x9a7b45, -0.5 + i * 0.5, 0, 0));
    if (level) g.add(box(0.6, 0.5, 0.6, 0xc9a050, 0.5, 0, 0.5));
  },
  brickworks(g, w, d) {
    house(g, { w: 1.6, d: 1.6, h: 1.1, x: -0.4, z: -0.3 });
    g.add(cyl(0.45, 0.6, 1.0, 0xa0583a, w / 2 - 0.75, 0, d / 2 - 0.8));
    g.add(box(0.2, 1.2, 0.2, 0x7a4a32, w / 2 - 0.75, 1.0, d / 2 - 0.8));
    for (let i = 0; i < 3; i++) g.add(box(0.5, 0.15, 0.25, RES_COLORS.clay, -1 + i * 0.55, 0, d / 2 - 0.4));
  },
  sawmill(g, w, d) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, 1.0, 0.1, BEAM, sx * 0.9, 0, sz * 0.7 - 0.3));
    const r = mesh(roofGeo(2, 1.8, 0.6), THATCH); r.position.set(0, 1.0, -0.3); g.add(r);
    g.add(box(1.4, 0.35, 0.3, 0x8a5a2b, 0, 0, -0.3));
    for (let i = 0; i < 4; i++) {
      const log = cyl(0.09, 0.09, 1.1, RES_COLORS.wood, -0.6 + i * 0.22, 0, d / 2 - 0.5, 6);
      log.rotation.x = Math.PI / 2; log.position.y = 0.1; g.add(log);
    }
  },
  stonemason(g, w, d) {
    house(g, { w: 1.6, d: 1.6, h: 1.1, wall: 0xc9c3b5, roof: 0x5a6670, z: -0.3 });
    for (let i = 0; i < 4; i++) g.add(box(0.32, 0.28, 0.32, RES_COLORS.stone, -0.9 + i * 0.6, 0, d / 2 - 0.4));
  },
  smithy(g, w, d) {
    house(g, { w: 1.8, d: 1.6, h: 1.1, wall: 0xb9a68c, roof: 0x4a4a52, z: -0.3 });
    g.add(box(0.3, 1.5, 0.3, 0x6d5a4a, 0.6, 1.0, -0.6));
    g.add(box(0.35, 0.25, 0.2, 0x3a3a40, -0.7, 0, d / 2 - 0.5));
  },
  alchemist(g, w, d) {
    house(g, { w: 1.6, d: 1.6, h: 1.2, wall: 0xd8cfe0, roof: 0x5b4a7a, z: -0.3 });
    g.add(cyl(0.12, 0.18, 1.4, 0x6a5a8a, 0.55, 1.0, -0.6));
    const f = mesh(new THREE.SphereGeometry(0.18, 8, 6), RES_COLORS.sulfur);
    f.position.set(-0.8, 0.18, d / 2 - 0.4); g.add(f);
  },
  bank(g, w, d) {
    g.add(box(w - 1, 1.4, d - 1.2, 0xe0d8c4, 0, 0, -0.2));
    const r = mesh(roofGeo(w - 0.8, d - 1, 0.5), 0x6d7c8a); r.position.set(0, 1.4, -0.2); g.add(r);
    for (let i = -1; i <= 1; i++) g.add(cyl(0.08, 0.08, 1.2, 0xf4efe2, i * 0.5, 0, d / 2 - 0.45, 6));
    g.add(box(0.3, 0.2, 0.3, RES_COLORS.gold, 0.9, 0, d / 2 - 0.3));
  },
};

function mineBuilder(res) {
  return (g, w, d, level) => {
    const pit = mesh(new THREE.CylinderGeometry(0.7, 0.5, 0.1, 10), 0x2a2420);
    pit.position.y = 0.05; g.add(pit);
    for (const sx of [-1, 1]) g.add(box(0.12, 1.8 + level * 0.3, 0.12, BEAM, sx * 0.6, 0, 0));
    g.add(box(1.4, 0.12, 0.14, BEAM, 0, 1.8 + level * 0.3, 0));
    const wheel = mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), BEAM);
    wheel.position.set(0, 1.6 + level * 0.3, 0); g.add(wheel);
    for (let i = 0; i < 3 + level; i++) {
      const s = mesh(new THREE.DodecahedronGeometry(0.22, 0), RES_COLORS[res]);
      s.position.set(-w / 2 + 0.5 + (i % 3) * 0.35, 0.18 + Math.floor(i / 3) * 0.25, d / 2 - 0.4); g.add(s);
    }
    if (level) house(g, { w: 0.9, d: 0.8, h: 0.7, roof: THATCH, x: w / 2 - 0.6, z: -d / 2 + 0.6, door: false });
  };
}
BUILDERS.clayMine = mineBuilder('clay');
BUILDERS.stoneMine = mineBuilder('stone');
BUILDERS.ironMine = mineBuilder('iron');
BUILDERS.sulfurMine = mineBuilder('sulfur');

/** Creates the model of a building. */
export function buildingModel(type, w, d, level, owner) {
  const g = new THREE.Group();
  foundation(g, w - 0.2, d - 0.2);
  const inner = new THREE.Group();
  (BUILDERS[type] ?? BUILDERS.residence)(inner, w, d, level, PLAYER_COLORS[owner % 4]);
  inner.name = 'body';
  g.add(inner);
  return g;
}

/** Scaffolding for construction sites. */
export function scaffold(w, d) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, 1.6, 0.08, 0xb08a5a, sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4)));
  for (const y of [0.6, 1.3]) {
    g.add(box(w - 0.7, 0.06, 0.08, 0xb08a5a, 0, y, d / 2 - 0.4));
    g.add(box(w - 0.7, 0.06, 0.08, 0xb08a5a, 0, y, -d / 2 + 0.4));
  }
  g.add(box(0.5, 0.25, 0.5, RES_COLORS.wood, -w / 2 + 0.6, 0, d / 2 - 0.2));
  return g;
}

/** Serf: figure with legs for animating. */
export function serfModel(owner) {
  const g = new THREE.Group();
  const b = new THREE.Group(); g.add(b);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.05, 0.25, 0);
    const leg = box(0.07, 0.25, 0.07, 0x4a3a2a, 0, -0.25, 0); hip.add(leg); b.add(hip); legs.push(hip);
  }
  b.add(cyl(0.1, 0.15, 0.32, 0xc39a5e, 0, 0.24, 0));
  const head = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xe6c2a0); head.position.y = 0.64; b.add(head);
  b.add(cyl(0.06, 0.11, 0.08, PLAYER_COLORS[owner % 4], 0, 0.7, 0));
  const tool = box(0.04, 0.3, 0.04, BEAM, 0.12, 0.3, 0.05); b.add(tool);
  g.scale.setScalar(1.25);
  g.userData = { body: b, legs, tool };
  return g;
}

/** Geometries for instanced trees. */
export function treeGeometries() {
  const trunk = new THREE.CylinderGeometry(0.07, 0.11, 0.6, 6); trunk.translate(0, 0.3, 0);
  const cones = [0, 1, 2].map((i) => { const c = new THREE.ConeGeometry(0.55 - i * 0.14, 0.7, 7); c.translate(0, 0.75 + i * 0.4, 0); return c; });
  const conifer = mergeGeometries(cones);
  const leafy = new THREE.IcosahedronGeometry(0.55, 0); leafy.scale(1, 1.1, 1); leafy.translate(0, 1.05, 0);
  return { trunk, conifer, leafy };
}

/** Rohstoffhaufen. */
export function pileModel(res) {
  const g = new THREE.Group();
  const offs = [[0, 0, 0.32], [0.25, 0.12, 0.22], [-0.22, 0.18, 0.25], [0.05, -0.25, 0.2], [0, 0.02, 0.18]];
  offs.forEach(([x, z, r], i) => {
    const m = mesh(new THREE.DodecahedronGeometry(r, 0), RES_COLORS[res]);
    m.position.set(x, r * 0.6 + (i === 4 ? 0.25 : 0), z); m.scale.y = 0.75; g.add(m);
  });
  return g;
}

/** Shaft marker (before the mine is built). */
export function shaftModel(res) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 10), 0x5a4d40); ring.position.set(0, 0.06, 0); g.add(ring);
  const hole = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.13, 10), 0x1e1a16); hole.position.set(0, 0.07, 0); g.add(hole);
  for (const [x, z] of [[0.9, 0.5], [-0.8, 0.7], [0.6, -0.9]]) {
    const s = mesh(new THREE.DodecahedronGeometry(0.2, 0), RES_COLORS[res]); s.position.set(x, 0.14, z); g.add(s);
  }
  return g;
}

/** Siedlungsplatz-Markierung. */
export function spotModel() {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    g.add(box(0.14, 0.5, 0.14, 0xc8b89a, x, 0, z));
  }
  flag(g, 0xf0e6c8, 0, 0, 0);
  return g;
}
