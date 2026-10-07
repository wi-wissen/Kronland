// Procedural low-poly models (placeholders until CC0 assets are integrated).
// Each model: origin at the centre of the footprint, y = 0 is the ground. 1 unit = 1 tile.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildingAssetName, fittedModel, assetLods, hasAsset, isOwnBuildingModel, ownBuildingFill, ownBuildingPit, ownAsset, instancedParts, BRIDGE_ASSET } from './assets.js';
import { MARKER_PARS } from './characters.js';
import { playerHex } from './playerColors.js';
import { paintObject } from './painted.js';

export { PLAYER_COLOR_HEX as PLAYER_COLORS } from './playerColors.js';
export const RES_COLORS = {
  gold: 0xe0b13a, clay: 0xb5653a, wood: 0x8a5a2b, stone: 0x9a968e, iron: 0x6d717c, sulfur: 0xd8c33a,
};

const BEAM = 0x5a3b22, DARK = 0x3a2a1c, STONE = 0x9b968c, PLASTER = 0xe3d6b8, THATCH = 0x9a7b45, ROOF = 0xa8503a;

const cache = new Map();
const teamCache = new Map();
/**
 * Material of an own building model with team colour: magenta in the texture becomes the player colour (same rule as
 * for the figures, charMarker). One material per source material and player, the textures stay shared.
 */
export function teamMaterial(src, owner) {
  const hex = playerHex(owner);
  const key = `${src.uuid}:${hex}`; // by colour, not player: the colour choice can change between games
  if (teamCache.has(key)) return teamCache.get(key);
  const m = src.clone();
  const team = new THREE.Color(hex);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTeam = { value: team };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uTeam;
${MARKER_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float w = charMarker(diffuseColor.rgb);
  float v = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
  diffuseColor.rgb = mix(diffuseColor.rgb, uTeam * clamp(v / 0.75, 0.45, 1.6), w);
}`);
  };
  m.customProgramCacheKey = () => 'kr-bld-team';
  teamCache.set(key, m);
  return m;
}
/** Team-colour materials (for Renderer.dispose). */
export const sharedTeamMaterials = () => [...teamCache.values()];
/** Shared materials (for Renderer.dispose). */
export const sharedModelMaterials = () => [...cache.values(), ...teamCache.values()];
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
  clock(g) {
    g.add(box(0.6, 0.3, 0.6, STONE));
    g.add(box(0.36, 1.5, 0.36, 0xd9cfb8, 0, 0.3, 0));
    const face = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), 0xf4efe2);
    face.rotation.x = Math.PI / 2; face.position.set(0, 1.55, 0.2); g.add(face);
    g.add(cone(0.28, 0.4, 0x5a6670, 0, 1.8, 0, 4));
  },
  /** Weather tower: slender stone tower with measuring platform, wind vane and glass sphere (forecast). */
  weatherTower(g, w, d, level, pc) {
    g.add(cyl(0.5, 0.62, 2.6, STONE, 0, 0, 0, 8));
    g.add(box(0.3, 0.5, 0.05, DARK, 0, 0, 0.6));
    g.add(cyl(0.72, 0.72, 0.14, BEAM, 0, 2.6, 0, 8));
    for (let i = 0; i < 8; i++) g.add(box(0.05, 0.3, 0.05, BEAM, Math.sin(i * 0.785) * 0.66, 2.74, Math.cos(i * 0.785) * 0.66));
    g.add(cone(0.62, 0.7, pc, 0, 3.05, 0, 8));
    const orb = mesh(new THREE.SphereGeometry(0.17, 10, 8), 0x9fd0f0);
    orb.material = mat(0x9fd0f0, { roughness: 0.25, metalness: 0.1, emissive: 0x24506a, emissiveIntensity: 0.6 });
    orb.position.set(0, 3.85, 0); g.add(orb);
    // wind vane (turns like the windmill)
    const vane = new THREE.Group(); vane.position.set(0, 4.05, 0); vane.userData.turn = { axis: new THREE.Vector3(0, 1, 0), speed: 2.2 };
    vane.add(box(0.03, 0.4, 0.03, DARK, 0, 0, 0));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.SphereGeometry(0.06, 6, 4), 0xc9c2b0); c.position.set(Math.sin(i * 1.571) * 0.22, 0.3, Math.cos(i * 1.571) * 0.22); vane.add(c); vane.add(box(0.22, 0.02, 0.02, DARK, Math.sin(i * 1.571) * 0.11, 0.29, Math.cos(i * 1.571) * 0.11)); }
    g.add(vane);
  },
  /** Weather power plant: workshop hall with power pole, copper coils and glowing weather sphere. */
  weatherPlant(g, w, d, level, pc) {
    house(g, { w: w - 1.6, d: d - 1, h: 1.3, wall: 0xb9b2a4, roof: 0x5a6670, x: -0.6 });
    const mx = w / 2 - 0.8;
    g.add(box(0.7, 0.4, 0.7, STONE, mx, 0, 0));
    g.add(cyl(0.12, 0.18, 2.8, 0x6d717c, mx, 0.4, 0, 6));
    for (let i = 0; i < 3; i++) g.add(cyl(0.26, 0.26, 0.12, 0xb87333, mx, 1.2 + i * 0.45, 0, 10));
    const orb = mesh(new THREE.SphereGeometry(0.34, 12, 8), 0x9fd0f0);
    orb.material = mat(0x9fd0f0, { roughness: 0.2, metalness: 0.15, emissive: 0x3a78a0, emissiveIntensity: 0.8 });
    orb.position.set(mx, 3.45, 0); g.add(orb);
    g.add(box(1.1, 0.06, 0.06, 0xb87333, mx - 0.55, 2.3, 0));
    flag(g, pc, -w / 2 + 0.6, 0, d / 2 - 0.5);
  },
  windwheel(g) {
    g.add(cyl(0.06, 0.1, 1.8, BEAM));
    const hub = new THREE.Group(); hub.position.set(0, 1.8, 0.1); hub.userData.turn = { axis: new THREE.Vector3(0, 0, 1), speed: 1.5 };
    for (let i = 0; i < 6; i++) { const b = box(0.08, 0.6, 0.02, 0xf3ecdc, 0, 0, 0); b.position.set(Math.sin(i * 1.047) * 0.3, Math.cos(i * 1.047) * 0.3, 0); b.rotation.z = -i * 1.047; hub.add(b); }
    g.add(hub);
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

/**
 * Creates the model of a building. For KayKit models g.userData.lods holds the LOD levels
 * (only one is visible; chosen in the renderer by distance), for procedural buildings one level.
 */
export function buildingModel(type, w, d, level, owner) {
  if (type === 'bridge') return bridgeModel(w, d, owner);
  const g = new THREE.Group();
  const asset = buildingAssetName(type, level, owner);
  // stone base only for KayKit and procedural buildings; own models bring their foundation with them
  if (!isOwnBuildingModel(asset)) foundation(g, w - 0.2, d - 0.2);
  if (asset) {
    // castle and towers fill their area, workshops leave some margin
    const fill = (type === 'headquarters' ? 1.05 : type === 'tower' ? 1.0 : type.endsWith('Mine') ? 1.05 : 0.92) * ownBuildingFill(asset);
    const body = new THREE.Group();
    body.name = 'body';
    const own = isOwnBuildingModel(asset);
    const lods = assetLods(asset).map((n, i) => {
      const m = fittedModel(n, w, d, fill, asset, ownBuildingPit(asset));
      // own models: pennant (magenta) is turned into the player colour when drawing
      if (own) m.traverse((o) => { if (o.isMesh && !o.userData.noTeam) o.material = teamMaterial(o.material, owner); });
      m.visible = i === 0;
      m.name = 'lod' + i;
      // fine levels cast shadows; the coarsest only if there is no other
      body.add(m);
      return m;
    });
    g.add(body);
    g.userData.lods = lods;
    return g;
  }
  const inner = new THREE.Group();
  (BUILDERS[type] ?? BUILDERS.residence)(inner, w, d, level, playerHex(owner));
  inner.name = 'body';
  g.add(inner);
  return g;
}

/** Construction phases (KayKit stage_A–C) available? */
export const hasConstructionStages = () => hasAsset('buildings/stage_A') && hasAsset('buildings/stage_C');

/**
 * Construction site in a phase: 0–2 = stage_A/B/C (foundation, walls, roof truss).
 * @returns {THREE.Group|null}
 */
export function constructionStage(stage, w, d) {
  const n = `buildings/stage_${'ABC'[stage]}`;
  return paintObject(fittedModel(n, w, d, 0.92));
}

/** Own campfire model (assets-src/buildings/campfire). */
export const CAMPFIRE_ASSET = 'campfire';

/** Own ruin models per building type (otherwise the general rubble). */
export const RUIN_ASSETS = { villageCenter: 'village_ruin', residence: 'house_ruin' };

/**
 * Ruin on the footprint w × d (tiles). With an own model (RUIN_ASSETS) once it is loaded;
 * until then rubble and userData.pending (the renderer then rebuilds).
 */
export function ruinModel(w, d, type) {
  const file = RUIN_ASSETS[type];
  if (file) {
    if (ownAsset(file)) {
      const own = fittedModel(`buildings/${file}`, w, d, 0.92);
      own.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      return own;
    }
  }
  const g = paintObject(fittedModel('buildings/destroyed', w - 0.6, d - 0.6, 0.95));
  if (g) { g.userData.pending = !!file; return g; }
  w -= 0.6; d -= 0.6;
  const r = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const b = box(0.3 + (i % 3) * 0.15, 0.25 + (i % 2) * 0.3, 0.3, i % 2 ? STONE : 0x4a3a2c, ((i * 37) % 10) / 10 * w * 0.6 - w * 0.3, 0, ((i * 53) % 10) / 10 * d * 0.6 - d * 0.3);
    b.rotation.y = i; r.add(b);
  }
  return r;
}

/** Scaffolding for construction sites. */
export function scaffold(w, d) {
  const kk = paintObject(fittedModel('buildings/scaffolding', w, d, 0.95));
  if (kk) return kk;
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
export function serfModel(owner, tunic = 0xc39a5e) {
  const g = new THREE.Group();
  const b = new THREE.Group(); g.add(b);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.05, 0.25, 0);
    const leg = box(0.07, 0.25, 0.07, 0x4a3a2a, 0, -0.25, 0); hip.add(leg); b.add(hip); legs.push(hip);
  }
  b.add(cyl(0.1, 0.15, 0.32, tunic, 0, 0.24, 0));
  const head = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xe6c2a0); head.position.y = 0.64; b.add(head);
  b.add(cyl(0.06, 0.11, 0.08, playerHex(owner), 0, 0.7, 0));
  const tool = box(0.04, 0.3, 0.04, BEAM, 0.12, 0.3, 0.05); b.add(tool);
  g.scale.setScalar(1.25);
  g.userData = { body: b, legs, tool };
  return g;
}

/** Smock colour per profession. */
export const PROF_COLORS = {
  farmer: 0xb8862d, scholar: 0x4a5a8a, miner: 0x5a5048, brickmaker: 0xa0583a, sawyer: 0x6b7a3a,
  mason: 0x8a8a92, smith: 0x4a4a52, alchemist: 0x7a4a8a, treasurer: 0x9a7a2a, priest: 0xe6e0d0, trader: 0x3a7a7a,
};

/** Campfire (workers without bed or dining spot, bandit camp). */
export function campfireModel() {
  // own model (stone ring, logs, pot): flames then come as particles from the renderer
  if (ownAsset(CAMPFIRE_ASSET)) {
    const own = fittedModel(`buildings/${CAMPFIRE_ASSET}`, 1.15, 1.15, 1);
    own.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    own.userData.own = true;
    return own;
  }
  const g = new THREE.Group();
  g.userData.pending = true;
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.DodecahedronGeometry(0.1, 0), 0x6d6a64);
    s.position.set(Math.cos(i * 1.256) * 0.28, 0.06, Math.sin(i * 1.256) * 0.28); g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const l = cyl(0.04, 0.04, 0.45, 0x6b4626, 0, 0.05, 0, 5);
    l.rotation.set(Math.PI / 2.6, i * 2.1, 0); g.add(l);
  }
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0xffa632 }));
  f.position.y = 0.2; f.name = 'flame'; g.add(f);
  return g;
}

// ---------- Military ----------

const METAL = 0x9aa0a8, LEATHER = 0x7a5a3a;

function humanoid(tunic, owner, opts = {}) {
  const g = new THREE.Group();
  const b = new THREE.Group(); g.add(b);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.05, 0.25, 0);
    hip.add(box(0.07, 0.25, 0.07, 0x3a3028, 0, -0.25, 0)); b.add(hip); legs.push(hip);
  }
  b.add(cyl(0.1, 0.15, 0.32, tunic, 0, 0.24, 0));
  const head = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xe6c2a0); head.position.y = 0.64; b.add(head);
  if (opts.helmet !== false) b.add(cyl(0.07, 0.1, 0.08, opts.helmetColor ?? METAL, 0, 0.68, 0));
  // shoulder sash in player colour
  b.add(box(0.22, 0.05, 0.16, playerHex(owner), 0, 0.5, 0));
  const arm = new THREE.Group(); arm.position.set(0.14, 0.5, 0); b.add(arm);
  g.userData = { body: b, legs, arm };
  return g;
}

/** Own cannon model (assets-src/buildings/cannon): muzzle towards +z, pennant in magenta (team colour). */
export const CANNON_ASSET = 'cannon';
/** Length of the cannon in tiles (largest extent in the plan, like the previous shape). */
const CANNON_LENGTH = 1.05;

/** Cannon as an own model with texture, pennant in player colour (field gun), or null (still loading). */
function ownCannon(owner) {
  if (!ownAsset(CANNON_ASSET)) return null;
  const g = fittedModel(`buildings/${CANNON_ASSET}`, CANNON_LENGTH, CANNON_LENGTH, 1);
  g?.traverse((o) => { if (o.isMesh) { o.material = teamMaterial(o.material, owner); o.castShadow = o.receiveShadow = true; } });
  return g;
}

/** Team area in the texture (magenta like charMarker), colour sRGB 0…255. */
export const isMagenta = (r, g, b) => r > 120 && b > 120 && g < Math.min(r, b) * 0.55;

/** Stand geometries together on the ground, centre them, scale the largest plan extent to `len`. */
export function normalizeToLength(geos, len) {
  const box = new THREE.Box3();
  for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = len / Math.max(size.x, size.z, 1e-6);
  for (const g of geos) { g.translate(-c.x, -box.min.y, -c.z); g.scale(k, k, k); }
  return geos;
}

let cannonGeo;
/**
 * Cannon for the figure system (baked vertex colours instead of texture): middle LOD level of the own model, per
 * triangle the texture colour of the face centre; magenta becomes the team area (attribute teamMask). null while the
 * model is loading or without a canvas (tests).
 */
function cannonFigureGeometry() {
  if (cannonGeo !== undefined) return cannonGeo;
  if (!ownAsset(CANNON_ASSET) || typeof document === 'undefined') return null;
  const name = `buildings/${CANNON_ASSET}`, main = instancedParts(name), parts = instancedParts(`${name}.lod1`) ?? main;
  const img = main[0].material.map?.image;
  if (!img) return (cannonGeo = null);
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  const geos = normalizeToLength(parts.map(({ geometry }) => (geometry.index ? geometry.toNonIndexed() : geometry)), CANNON_LENGTH);
  const col = new THREE.Color();
  for (const g of geos) {
    const uv = g.attributes.uv, n = g.attributes.position.count;
    const color = new Float32Array(n * 3), team = new Float32Array(n);
    for (let i = 0; i + 2 < n; i += 3) {
      // glTF textures: UV (0, 0) top left
      const u = (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3, v = (uv.getY(i) + uv.getY(i + 1) + uv.getY(i + 2)) / 3;
      const x = Math.min(S - 1, Math.max(0, Math.floor((u - Math.floor(u)) * S))), y = Math.min(S - 1, Math.max(0, Math.floor((v - Math.floor(v)) * S)));
      const o = (y * S + x) * 4;
      col.setRGB(px[o] / 255, px[o + 1] / 255, px[o + 2] / 255, THREE.SRGBColorSpace);
      const t = isMagenta(px[o], px[o + 1], px[o + 2]) ? 1 : 0;
      for (let k = 0; k < 3; k++) { color.set([col.r, col.g, col.b], (i + k) * 3); team[i + k] = t; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute('teamMask', new THREE.BufferAttribute(team, 1));
  }
  cannonGeo = mergeGeometries(geos.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'teamMask'].includes(k)) g.deleteAttribute(k); return g; }));
  return cannonGeo;
}

/**
 * Foot soldier, rider or cannon. Cannon: own model (opts.figure: baked vertex colours for the figure system),
 * until it is loaded the procedural shape with userData.pendingAsset.
 * @param {{figure?: boolean}} [opts]
 */
export function unitModel(line, owner, leader = false, opts = {}) {
  if (line === 'cannon') {
    const geo = opts.figure ? cannonFigureGeometry() : null;
    const own = geo ? new THREE.Group().add(new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true }))) : opts.figure ? null : ownCannon(owner);
    if (own) { own.userData = { body: own, legs: [], arm: new THREE.Group() }; return own; }
    const g = new THREE.Group();
    const barrel = cyl(0.09, 0.12, 0.8, 0x3a3a40, 0, 0, 0, 8);
    barrel.rotation.x = Math.PI / 2 - 0.25; barrel.position.set(0, 0.32, 0.1); g.add(barrel);
    for (const s of [-1, 1]) {
      const w = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), BEAM);
      w.rotation.z = Math.PI / 2; w.position.set(s * 0.18, 0.2, -0.05); g.add(w);
    }
    g.add(box(0.26, 0.08, 0.5, BEAM, 0, 0.14, -0.1));
    g.add(box(0.12, 0.12, 0.12, playerHex(owner), 0, 0.22, -0.35));
    g.userData = { body: g, legs: [], arm: new THREE.Group(), pendingAsset: `buildings/${CANNON_ASSET}` };
    return g;
  }
  const cav = line === 'lightCav' || line === 'heavyCav';
  const tunic = line === 'sword' ? 0x6a6f78 : line === 'spear' ? 0x6b5a3a : line === 'bow' ? 0x4f6a3a : line === 'heavyCav' ? 0x8a8f98 : 0x6b5a3a;
  const g = humanoid(tunic, owner);
  const { arm } = g.userData;
  if (line === 'sword' || line === 'heavyCav') arm.add(box(0.03, 0.42, 0.03, METAL, 0, -0.05, 0.08));
  if (line === 'spear') { const s = box(0.025, 0.9, 0.025, BEAM, 0, -0.25, 0.05); arm.add(s); arm.add(cone(0.035, 0.1, METAL, 0, 0.65, 0.05, 5)); }
  if (line === 'bow' || line === 'lightCav') {
    const bow = mesh(new THREE.TorusGeometry(0.18, 0.015, 4, 10, Math.PI), BEAM);
    bow.rotation.y = Math.PI / 2; bow.position.set(0.02, 0, 0.05); arm.add(bow);
  }
  if (line === 'sword') {
    const shield = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 8), playerHex(owner));
    shield.rotation.z = Math.PI / 2; shield.position.set(-0.15, 0.36, 0.05); g.userData.body.add(shield);
  }
  if (leader) {
    const pole = box(0.02, 0.7, 0.02, BEAM, -0.08, 0.45, -0.1); g.userData.body.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.16), mat(playerHex(owner), { side: THREE.DoubleSide }));
    fl.position.set(-0.08 + 0.12, 1.07, -0.1); fl.rotation.y = Math.PI / 2; g.userData.body.add(fl);
  }
  if (cav) {
    const horse = horseModel(line === 'heavyCav' ? 0x4a3a2a : 0x8a6a4a, owner);
    g.add(horse);
    g.userData.body.position.y = 0.38;
    g.userData.legs.forEach((l) => { l.visible = false; });
    g.userData.horse = horse;
    g.userData.horseLegs = horse.userData.legs;
  }
  g.scale.setScalar(1.25);
  return g;
}

/**
 * Horse with movable legs (for riders; also as a mount under figure models).
 * Head towards +z. userData.legs: four hip groups; userData.saddle: saddle height.
 */
export function horseModel(color = 0x8a6a4a, owner = 0, scale = 1) {
  const horse = new THREE.Group();
  const dark = 0x2a1e14;
  horse.add(box(0.24, 0.27, 0.62, color, 0, 0.36, -0.02));            // body
  horse.add(box(0.26, 0.29, 0.2, color, 0, 0.35, 0.22));              // chest
  const neck = box(0.14, 0.34, 0.16, color, 0, 0, 0);
  neck.position.set(0, 0.52, 0.3); neck.rotation.x = 0.55; horse.add(neck);
  const head = box(0.13, 0.13, 0.3, color, 0, 0, 0);
  head.position.set(0, 0.78, 0.47); head.rotation.x = 0.35; horse.add(head);
  horse.add(box(0.1, 0.09, 0.08, 0x3a2a1c, 0, 0.71, 0.6));            // muzzle
  for (const sx of [-1, 1]) horse.add(box(0.03, 0.08, 0.03, color, sx * 0.04, 0.86, 0.38)); // ears
  const mane = box(0.05, 0.3, 0.14, dark, 0, 0, 0);
  mane.position.set(0, 0.58, 0.25); mane.rotation.x = 0.55; horse.add(mane);
  const tail = box(0.05, 0.3, 0.07, dark, 0, 0, 0);
  tail.position.set(0, 0.32, -0.35); tail.rotation.x = -0.35; horse.add(tail);
  horse.add(box(0.27, 0.04, 0.26, playerHex(owner), 0, 0.62, -0.04)); // saddle blanket
  horse.add(box(0.16, 0.05, 0.16, 0x5a3b22, 0, 0.66, -0.04));          // saddle
  const legs = [];
  for (const sz of [1, -1]) for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.08, 0.36, sz * 0.22 - 0.02);
    hip.add(box(0.065, 0.32, 0.065, color, 0, -0.32, 0));
    hip.add(box(0.07, 0.05, 0.075, dark, 0, -0.36, 0.005));            // hoof
    horse.add(hip); legs.push(hip);
  }
  horse.scale.setScalar(scale);
  horse.userData = { legs, saddle: 0.66 * scale };
  return horse;
}

/** Hero: larger, with cloak (placeholder until the figures from the concept sheets are done). */
export function heroModel(hero, owner) {
  const colors = { nelia: 0xb08452, orrin: 0xc26a3a, taran: 0x6a6f76, malvor: 0x3d4a5e };
  const g = humanoid(colors[hero] ?? 0x9aa0a8, owner, { helmet: hero === 'taran' });
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.4), mat(playerHex(owner), { side: THREE.DoubleSide }));
  cape.position.set(0, 0.32, -0.12); cape.rotation.x = 0.15; g.userData.body.add(cape);
  const { arm } = g.userData;
  if (hero === 'nelia') { arm.add(box(0.03, 0.35, 0.03, BEAM, 0, -0.05, 0.08)); arm.add(box(0.1, 0.07, 0.03, METAL, 0.04, -0.2, 0.08)); }
  if (hero === 'taran') arm.add(box(0.035, 0.5, 0.035, METAL, 0, -0.05, 0.1));
  if (hero === 'malvor') arm.add(box(0.03, 0.55, 0.03, METAL, 0, -0.08, 0.08));
  if (hero === 'orrin') arm.add(box(0.12, 0.12, 0.08, 0x7a4f28, 0, -0.22, 0.06));
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.012, 4, 12), 0xe0b13a);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.78; g.userData.body.add(ring);
  g.scale.setScalar(1.45);
  return g;
}

/** Trap, bomb, self-firing cannon. */
export function gadgetModel(kind, owner) {
  const g = new THREE.Group();
  if (kind === 'trap') {
    g.add(cyl(0.25, 0.25, 0.04, 0x5a4a3a));
    for (let i = 0; i < 6; i++) g.add(cone(0.03, 0.12, METAL, Math.cos(i) * 0.18, 0.04, Math.sin(i) * 0.18, 4));
  } else if (kind === 'bomb') {
    const b = mesh(new THREE.SphereGeometry(0.14, 8, 6), 0x2a2a2e); b.position.y = 0.14; g.add(b);
    g.add(box(0.02, 0.1, 0.02, 0xffa632, 0, 0.27, 0));
  } else {
    const c = unitModel('cannon', owner);
    g.add(c);
    g.userData.pendingAsset = c.userData.pendingAsset; // field gun: rebuild after loading
  }
  return g;
}

// ---------- Bridge and ornaments (procedural, when no KayKit model is assigned) ----------
Object.assign(BUILDERS, {
  fountain(g, w, d) {
    g.add(cyl(w / 2 - 0.15, w / 2 - 0.1, 0.3, STONE));
    const water = cyl(w / 2 - 0.3, w / 2 - 0.3, 0.05, 0x5a9ad0, 0, 0.27, 0); g.add(water);
    g.add(cyl(0.12, 0.16, 0.9, STONE, 0, 0.2, 0));
    g.add(cyl(0.35, 0.2, 0.08, STONE, 0, 1.05, 0));
  },
  statue(g) {
    g.add(box(1.2, 0.5, 1.2, STONE));
    g.add(box(0.9, 0.2, 0.9, 0xcfc9bf, 0, 0.5, 0));
    const body = cyl(0.16, 0.22, 0.8, 0xc8b071, 0, 0.7, 0); g.add(body);
    const head = mesh(new THREE.SphereGeometry(0.13, 10, 8), 0xc8b071); head.position.y = 1.62; g.add(head);
    const arm = box(0.06, 0.5, 0.06, 0xc8b071, 0.2, 1.3, 0); arm.rotation.z = -0.6; g.add(arm);
  },
});

/**
 * Bridge: wooden deck on piers over the full length of the bridge site; y = 0 is the
 * deck top edge (the renderer sets it to shore height), piers reach into the water.
 */
export function bridgeModel(w, d, owner) {
  const own = ownAsset(BRIDGE_ASSET);
  if (own) return bridgeAssetModel(own, w, d, owner);
  const g = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  const along = w >= d ? 'x' : 'z', len = Math.max(w, d) + 0.6, wid = Math.min(w, d) - 0.15;
  const deck = along === 'x' ? box(len, 0.14, wid, 0x9a6a3a, 0, -0.14, 0) : box(wid, 0.14, len, 0x9a6a3a, 0, -0.14, 0);
  body.add(deck);
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (i * len) / n;
    for (const s of [-1, 1]) {
      const px = along === 'x' ? t : s * (wid / 2 - 0.05), pz = along === 'x' ? s * (wid / 2 - 0.05) : t;
      body.add(box(0.07, 0.45, 0.07, BEAM, px, 0, pz));
      if (i > 0 && i < n) body.add(box(0.16, 1.8, 0.16, 0x6a4a2a, px, -1.9, pz));
    }
  }
  for (const s of [-1, 1]) {
    const rail = along === 'x' ? box(len, 0.06, 0.06, BEAM, 0, 0.42, s * (wid / 2 - 0.05)) : box(0.06, 0.06, len, BEAM, s * (wid / 2 - 0.05), 0.42, 0);
    body.add(rail);
  }
  // pennant in player colour at the bridgehead
  const pc = playerHex(owner);
  flag(body, pc, along === 'x' ? -len / 2 + 0.1 : wid / 2 - 0.05, 0, along === 'x' ? wid / 2 - 0.05 : -len / 2 + 0.1);
  g.add(body);
  return g;
}

/**
 * Own bridge model (Meshy): a whole bridge with two abutments. The ends (BRIDGE_END of the length)
 * stay undistorted, only the uniform middle part is stretched to the length of the bridge site.
 * Deck top edge at BRIDGE_DECK of the model height → y = 0.
 */
const BRIDGE_END = 0.17, BRIDGE_DECK = 0.36;
export function bridgeAssetModel(src, w, d, owner) {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  src.updateMatrixWorld(true);
  const meshes = [];
  src.traverse((m) => {
    if (!m.isMesh) return;
    const mesh = new THREE.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld), teamMaterial(m.material, owner));
    mesh.castShadow = mesh.receiveShadow = true;
    meshes.push(mesh);
  });
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  const size = box.getSize(new THREE.Vector3());
  // longitudinal axis of the model (Meshy delivers it in x or z depending on the view)
  const ax = size.z >= size.x ? 2 : 0, cross = ax === 2 ? size.x : size.z, long = ax === 2 ? size.z : size.x;
  const lo = ax === 2 ? box.min.z : box.min.x;
  const len = Math.max(w, d) + 0.6, wid = Math.min(w, d) - 0.1;
  const s = wid / cross, e = BRIDGE_END * long, mid = long - 2 * e;
  // middle part to the target length; for very short bridges also squash the ends a little
  const midT = Math.max(len / s - 2 * e, 0.25 * mid), k = len / s / (2 * e + midT);
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getComponent(i, ax) - lo;
      const v = u < e ? u : u > long - e ? u - long + 2 * e + midT : e + ((u - e) * midT) / mid;
      pos.setComponent(i, ax, (v - (2 * e + midT) / 2) * k);
    }
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingSphere();
    body.add(m);
  }
  body.scale.setScalar(s);
  body.position.y = -(box.min.y + BRIDGE_DECK * size.y) * s;
  // centre across, rotate the longitudinal axis onto that of the bridge site
  const cc = ax === 2 ? (box.min.x + box.max.x) / 2 : (box.min.z + box.max.z) / 2;
  for (const m of meshes) m.geometry.translate(ax === 2 ? -cc : 0, 0, ax === 2 ? 0 : -cc);
  const alongX = w >= d;
  body.rotation.y = (ax === 2) === alongX ? Math.PI / 2 : 0;
  g.add(body);
  return g;
}

Object.assign(BUILDERS, {
  barracks(g, w, d, level, pc) {
    house(g, { w: w - 1, d: d - 1.6, h: 1.3 + level * 0.3, wall: 0xb9a68c, roof: 0x6b4a2e, z: -0.5 });
    for (let i = 0; i < 3; i++) g.add(box(0.03, 0.6, 0.03, METAL, -0.6 + i * 0.25, 0, d / 2 - 0.5));
    g.add(box(1.0, 0.05, 0.05, BEAM, -0.35, 0.5, d / 2 - 0.5));
    flag(g, pc, w / 2 - 0.5, 0, d / 2 - 0.5);
  },
  archery(g, w, d, level, pc) {
    house(g, { w: 1.8, d: 1.6, h: 1.2 + level * 0.3, roof: 0x6b4a2e, x: -w / 2 + 1.2, z: -0.2 });
    for (let i = 0; i < 2; i++) {
      const t = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), 0xe6dcc4);
      t.rotation.x = Math.PI / 2; t.position.set(w / 2 - 0.7, 0.5, -0.8 + i * 1.2); g.add(t);
      const c = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10), 0xa83232);
      c.rotation.x = Math.PI / 2; c.position.set(w / 2 - 0.7, 0.5, -0.8 + i * 1.2); g.add(c);
    }
    flag(g, pc, 0.3, 0, d / 2 - 0.4);
  },
  stable(g, w, d, level, pc) {
    house(g, { w: w - 0.8, d: d - 1.8, h: 1.2 + level * 0.3, wall: 0x8a6a4a, roof: THATCH, z: -0.6 });
    for (let i = 0; i < 4; i++) g.add(box(0.06, 0.4, 0.06, BEAM, -w / 2 + 0.6 + i * ((w - 1.2) / 3), 0, d / 2 - 0.4));
    g.add(box(w - 1.2, 0.05, 0.05, BEAM, 0, 0.3, d / 2 - 0.4));
    flag(g, pc, w / 2 - 0.4, 0, -d / 2 + 0.4);
  },
  foundry(g, w, d, level, pc) {
    house(g, { w: 2, d: 1.6, h: 1.3 + level * 0.3, wall: 0x9a8a7a, roof: 0x4a4a52, x: -0.6, z: -0.3 });
    g.add(box(0.4, 2.2, 0.4, 0x6d5a4a, 0.8, 0, -0.6));
    const c = unitModel('cannon', 0); c.position.set(0.9, 0, d / 2 - 0.6); c.scale.setScalar(1.1); g.add(c);
    flag(g, pc, -w / 2 + 0.4, 0, d / 2 - 0.4);
  },
  tower(g, w, d, level, pc) {
    g.add(box(1.3, 2.4 + level * 0.4, 1.3, STONE));
    const top = 2.4 + level * 0.4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.25, 0.25, 0.25, STONE, sx * 0.52, top, sz * 0.52));
    if (level === 0) g.add(cone(0.9, 0.8, pc, 0, top, 0, 4));
    if (level === 1) { g.add(box(0.5, 0.12, 0.12, BEAM, 0, top + 0.1, 0)); g.add(box(0.08, 0.1, 0.6, BEAM, 0, top + 0.2, 0.1)); }
    if (level === 2) { const c = unitModel('cannon', 0); c.position.y = top; c.scale.setScalar(0.9); g.add(c); }
    flag(g, pc, -0.5, top, -0.5);
  },
});

// Bandit camp (missions): two tents, palisade, campfire
BUILDERS.banditCamp = (g, w, d, level, pc) => {
  for (const [x, z, c] of [[-0.6, -0.4, 0x7a5a3a], [0.7, 0.1, 0x5e4a36]]) {
    const tent = cone(0.75, 1.1, c, x, 0, z, 4);
    tent.rotation.y = Math.PI / 4; g.add(tent);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 1.6 + 0.9;
    g.add(cyl(0.06, 0.07, 0.75, BEAM, Math.cos(a) * (w / 2 - 0.25), 0, Math.sin(a) * (d / 2 - 0.25), 5));
  }
  const fire = campfireModel(); fire.position.set(0.1, 0, 0.9); g.add(fire);
  flag(g, pc, -w / 2 + 0.4, 0, d / 2 - 0.4);
};

/** Health bar (billboard). */
export function healthBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.07), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.07), new THREE.MeshBasicMaterial({ color: 0x6fcf7a, depthTest: false }));
  fg.position.z = 0.001; fg.name = 'fg';
  bg.renderOrder = 10; fg.renderOrder = 11;
  g.add(bg, fg);
  return g;
}
