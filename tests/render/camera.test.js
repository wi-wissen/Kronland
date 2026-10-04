// Camera: keep the target visible above a panel at the bottom edge (tutorial in portrait mode, QA finding D),
// graphics level in a running game (QA finding E) – pure logic without WebGL.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../../src/render/CameraRig.js';
import { Environment } from '../../src/render/environment.js';
import { QUALITY_PRESETS } from '../../src/render/quality.js';
import { CharacterSystem } from '../../src/render/characters.js';
import { lodSettings } from '../../src/render/lod.js';

function rigFor(w, h) {
  const cam = new THREE.PerspectiveCamera(w < h ? 55 : 40, w / h, 0.3, 700);
  cam.updateProjectionMatrix();
  const rig = new CameraRig(cam, { w: 128, h: 128 });
  rig.groundAt = (x, z) => Math.sin(x * 0.2) + Math.cos(z * 0.15);
  return { cam, rig };
}

const screenY = (rig, cam, x, z, h) => {
  rig.update(0);
  cam.updateMatrixWorld();
  const p = new THREE.Vector3(x, rig.groundAt(x, z), z).project(cam);
  return ((1 - p.y) / 2) * h;
};

describe('CameraRig.lookAtScreen', () => {
  it('puts the point in portrait mode at the desired screen height (above the panel)', () => {
    const W = 412, H = 915;
    for (const yaw of [0, 0.7, 2.5, -1.9]) for (const dist of [14, 28, 60]) {
      const { cam, rig } = rigFor(W, H);
      rig.yaw = yaw; rig.dist = dist;
      const want = 260;
      rig.lookAtScreen(64, 70, want, H);
      expect(Math.abs(screenY(rig, cam, 64, 70, H) - want)).toBeLessThan(6);
    }
  });

  it('without offset the point stays at the screen centre (like lookAt)', () => {
    const { cam, rig } = rigFor(1280, 800);
    rig.lookAtScreen(40, 50, 400, 800);
    expect(Math.abs(screenY(rig, cam, 40, 50, 800) - 400)).toBeLessThan(6);
    expect(Math.hypot(rig.target.x - 40, rig.target.z - 50)).toBeLessThan(0.5);
  });

  it('at the map edge: limited, no endless loop', () => {
    const { rig } = rigFor(412, 915);
    rig.yaw = Math.PI; // view such that "up in the image" leads off the map
    rig.lookAtScreen(0, 0, 100, 915);
    expect(rig.target.x).toBeGreaterThanOrEqual(0);
    expect(rig.target.z).toBeGreaterThanOrEqual(0);
  });
});

describe('Graphics level in a running game: shadows', () => {
  const fakeRenderer = () => ({ shadowMap: { enabled: false, type: 0, needsUpdate: false } });

  it('Environment.setQuality switches shadows and map size', () => {
    const r = fakeRenderer();
    const env = new Environment(r, new THREE.Scene(), QUALITY_PRESETS.high);
    expect(r.shadowMap.enabled).toBe(true);
    expect(env.sun.shadow.mapSize.x).toBe(4096);
    // software level "low" without shadows
    let toggled = env.setQuality({ ...QUALITY_PRESETS.low, shadows: false, shadowMapSize: 512 });
    expect(toggled).toBe(true);
    expect(r.shadowMap.enabled).toBe(false);
    expect(env.sun.castShadow).toBe(false);
    expect(env.sun.shadow.mapSize.x).toBe(512);
    expect(env.sun.shadow.map).toBeNull();
    toggled = env.setQuality(QUALITY_PRESETS.medium);
    expect(toggled).toBe(true);
    expect(r.shadowMap.enabled).toBe(true);
    expect(env.sun.shadow.mapSize.x).toBe(2048);
    expect(env.sun.shadow.radius).toBe(QUALITY_PRESETS.medium.shadowRadius);
    expect(env.setQuality(QUALITY_PRESETS.high)).toBe(false); // size only, no shader recompilation
  });

  it('Figures: LOD boundaries and blob shadows follow the level', () => {
    const scene = new THREE.Scene();
    const chars = new CharacterSystem(scene, QUALITY_PRESETS.high, { procedural: {} });
    expect(chars.blob).toBe(false);
    chars.setQuality(QUALITY_PRESETS.low);
    expect(chars.blob).toBe(true);
    expect(chars.blobs).toBeTruthy();
    expect(chars.lodSettings).toEqual(lodSettings('character', 'low'));
    chars.setQuality(QUALITY_PRESETS.medium);
    expect(chars.blob).toBe(false);
    expect(chars.blobs.visible).toBe(false);
    expect(chars.lodSettings).toEqual(lodSettings('character', 'medium'));
  });
});
