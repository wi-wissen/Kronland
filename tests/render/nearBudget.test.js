// Near-model budget and spread-out variant rebuilds of the figures (crowd mission on high-density displays).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CharacterSystem, limitNear, NEAR_KEEP } from '../../src/render/characters.js';
import { lodSettings } from '../../src/render/lod.js';
import { QUALITY_PRESETS } from '../../src/render/quality.js';

const rec = (px, slot = false) => ({ drawLvl: 0, lodPx: px, nearSlot: slot });

describe('limitNear', () => {
  it('within the budget nothing changes', () => {
    const shown = [rec(200), rec(100), { drawLvl: 1, lodPx: 50 }];
    limitNear(shown, 2, 32);
    expect(shown.map((r) => r.drawLvl)).toEqual([0, 0, 1]);
    expect(shown.map((r) => r.nearSlot)).toEqual([true, true, false]);
  });

  it('only the largest figures on screen keep the near model', () => {
    const shown = Array.from({ length: 50 }, (_, i) => rec(100 + i));
    limitNear(shown, 50, 32);
    const near = shown.filter((r) => r.drawLvl === 0);
    expect(near).toHaveLength(32);
    expect(Math.min(...near.map((r) => r.lodPx))).toBe(118);
    expect(shown.filter((r) => r.drawLvl === 1).every((r) => r.lodPx < 118 && !r.nearSlot)).toBe(true);
  });

  it('hysteresis: a figure with a slot keeps it against a slightly larger one', () => {
    const holder = rec(100, true), close = rec(100 * NEAR_KEEP * 0.95), far = rec(100 * NEAR_KEEP * 1.1);
    limitNear([holder, close], 2, 1);
    expect([holder.drawLvl, close.drawLvl]).toEqual([0, 1]);
    limitNear([holder, far], 2, 1);
    expect([holder.drawLvl, far.drawLvl]).toEqual([1, 0]);
  });

  it('the figure profile has a budget', () => {
    for (const tier of ['low', 'medium', 'high']) expect(lodSettings('character', tier).nearMax).toBe(32);
  });
});

/** Minimal figure rendering: two mesh levels (near, game model), one clip. */
function fakeVariant(key) {
  const geo = new THREE.BoxGeometry(0.4, 1, 0.4);
  const clip = { key: 'idle', start: 0, frames: 1, duration: 1, loop: true, shot: null };
  return {
    key, worldHeight: 1, levels: [geo, geo.clone()], attach: [], meshes: [], yaw: 0, scale: 1, seat: 0,
    material: new THREE.MeshBasicMaterial(), materials: null, depth: null, bake: { fps: 30 }, names: {},
    has: () => true, clip: () => clip, moveSpeed: () => 0,
  };
}

describe('CharacterSystem', () => {
  it('draws at most nearMax figures with the near model, the largest ones', () => {
    const chars = new CharacterSystem(new THREE.Scene(), QUALITY_PRESETS.high, { procedural: {} });
    chars.buildVariant = (k) => fakeVariant(k);
    chars.viewH = 900; chars.pixelRatio = 2;
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.3, 700);
    cam.position.set(0, 0.5, 0); cam.lookAt(0, 0.5, -10); cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    chars.begin(1);
    // 60 figures 3–9 tiles in front of the camera: all large enough for the near model
    for (let i = 0; i < 60; i++) chars.set(i + 1, 'serf', { x: (i % 6) - 2.5, y: 0, z: -3 - i / 10, yaw: 0, clip: 'idle', team: 0xff0000 });
    chars.render(cam, frustum);
    expect(chars.stats.drawn).toBe(60);
    expect(chars.stats.levels[0]).toBe(32);
    expect(chars.stats.levels[1]).toBe(28);
    const v = chars.variants.get('serf');
    expect(v.meshes[0].count).toBe(32);
    // the closest figure (z = −3) keeps the near model
    expect(chars.records.get(1).drawLvl).toBe(0);
    expect(chars.records.get(60).drawLvl).toBe(1);
  });

  it('rebuilds at most one stale rendering per frame', () => {
    const chars = new CharacterSystem(new THREE.Scene(), QUALITY_PRESETS.high, { procedural: {} });
    let built = 0;
    let stale = true;
    // the renderings of the first appearance wait for a model; rebuilt ones are complete
    chars.buildVariant = (k) => { const n = ++built; return { ...fakeVariant(k), pendingCheck: () => stale && n <= 2 }; };
    const s = { x: 0, y: 0, z: 0, yaw: 0, clip: 'idle', team: 0 };
    chars.begin(0);
    chars.set(1, 'a', s); chars.set(2, 'b', s); chars.set(3, 'a', s);
    expect(built).toBe(2); // first appearance: built right away
    chars.begin(0.1);
    chars.set(1, 'a', s); chars.set(2, 'b', s); chars.set(3, 'a', s);
    expect(built).toBe(3); // only 'a' rebuilt; figure 3 takes over the new rendering of 'a'
    expect(chars.records.get(3).variant).toBe(chars.records.get(1).variant);
    stale = false;
    chars.begin(0.2);
    chars.set(2, 'b', s);
    expect(built).toBe(3); // 'b' is no longer stale
  });
});

describe('Renderer.shadersReady', () => {
  it('compiles a model arriving mid-game in the background once, then reports it ready', async () => {
    const { Renderer } = await import('../../src/render/Renderer.js');
    let calls = 0, finish;
    const ctx = {
      camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(),
      renderer: { compileAsync: () => { calls++; return new Promise((r) => { finish = r; }); } },
    };
    const make = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const ready = (k) => Renderer.prototype.shadersReady.call(ctx, k, make);
    expect(ready('ruin:residence')).toBe(false);
    expect(ready('ruin:residence')).toBe(false); // still compiling: keep the placeholder
    expect(calls).toBe(1);
    finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(ready('ruin:residence')).toBe(true);
    expect(calls).toBe(1);
    // without parallel compilation (error): ready at once, the first draw compiles as before
    ctx.renderer.compileAsync = () => { throw new Error('no context'); };
    expect(ready('ruin:villageCenter')).toBe(true);
  });
});

describe('Near level compiled in the background', () => {
  it('figures keep the game model until the shader of the near level is compiled', async () => {
    const chars = new CharacterSystem(new THREE.Scene(), QUALITY_PRESETS.high, { procedural: {} });
    let builds = 0, finish, compiled = 0;
    // the first rendering waits for the near model, the second has it
    chars.buildVariant = (k) => ({ ...fakeVariant(k), pendingCheck: builds++ === 0 ? () => true : undefined });
    chars.compile = (m) => { compiled++; expect(m.visible).toBe(true); return new Promise((r) => { finish = r; }); };
    chars.viewH = 900; chars.pixelRatio = 1;
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.3, 700);
    cam.position.set(0, 0.5, 0); cam.lookAt(0, 0.5, -10); cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const s = { x: 0, y: 0, z: -3, yaw: 0, clip: 'idle', team: 0 };
    chars.begin(0); chars.set(1, 'serf', s);
    chars.begin(0.1); chars.set(1, 'serf', s); // near model arrived: rebuilt, compiling starts
    expect(compiled).toBe(1);
    const v = chars.variants.get('serf');
    expect(v.nearReady).toBe(false);
    expect(v.meshes[0].count).toBe(0); // drew one instance only for the compilation
    chars.render(cam, frustum);
    expect(chars.stats.levels[0]).toBe(0);
    expect(chars.stats.levels[1]).toBe(1);
    finish();
    await new Promise((r) => setTimeout(r, 0));
    chars.begin(0.2); chars.set(1, 'serf', s); chars.render(cam, frustum);
    expect(chars.stats.levels[0]).toBe(1);
    expect(compiled).toBe(1);
  });
});
