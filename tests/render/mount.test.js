// Mount: horse as a GLB figure under the riders – gait, saddle, run tempo and the clips of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder as MD, MeshoptEncoder as ME } from 'meshoptimizer';
import { cavalryGait, CAV_WALK_MAX, CAV_RUN_MIN, saddleTrack, Variant, resolveRole, bakeGltfAnimations, clipNamesFor, propClipNames, variantRole } from '../../src/render/characters.js';

const DIR = new URL('../../public/models/characters/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));

describe('Gait of the cavalry', () => {
  it('walk slow, gallop fast, in between it stays', () => {
    expect(cavalryGait(0.5, null)).toBe('walk');
    expect(cavalryGait(3, 'walk')).toBe('run');
    const mid = (CAV_WALK_MAX + CAV_RUN_MIN) / 2;
    expect(cavalryGait(mid, 'walk')).toBe('walk');
    expect(cavalryGait(mid, 'run')).toBe('run');
    expect(cavalryGait(mid, 'idle')).toBe('run');
  });
});

describe('Saddle', () => {
  it('follows the bone relative to frame 0 (dequantisation cancels out)', () => {
    // bone 0: frame 0 = bind matrix with scale 2 (as quantised), frame 1 = additionally raised by 0.1
    const W = 4, data = new Float32Array(W * 2 * 4);
    const ibm = new THREE.Matrix4().makeScale(2, 2, 2);
    ibm.toArray(data, 0);
    new THREE.Matrix4().makeTranslation(0, 0.1, 0).multiply(ibm).toArray(data, W * 4);
    const bake = { texture: { image: { width: W, height: 2, data } }, boneIndex: new Map([['Back', 0]]) };
    const t = saddleTrack(bake, { bone: 'Back', at: [0, 1.2, -0.1] });
    expect(t.y0).toBe(1.2);
    expect(t.dy[0]).toBeCloseTo(0, 6);
    expect(t.dy[1]).toBeCloseTo(0.1, 6);
    expect(saddleTrack(bake, { bone: 'missing', at: [0, 0, 0] })).toBeNull();
  });
});

describe('Rider run tempo = horse tempo', () => {
  const clips = { __bind: { start: 0, frames: 1, duration: 0 }, walk: { start: 1, frames: 4, duration: 1 }, gallop: { start: 5, frames: 4, duration: 0.5 } };
  const horse = new Variant('mount.horse', [], { clips }, null, null, { idle: '__bind', walk: 'walk', run: 'gallop' }, { scale: 0.5, stride: { walk: 1, run: 3.4 } });
  horse.saddle = 0.6;
  const rider = new Variant('soldier.lightCav', [], { clips: { __bind: clips.__bind, ride: { start: 1, frames: 4, duration: 1 } } }, null, null, { ride: 'ride' }, { alias: { walk: 'ride', run: 'ride' } });
  rider.attach.push({ variant: horse, offset: [0, 0, 0], scale: 1.2, alias: {} });
  it('rider measures with the gallop/walk of the horse (manifest value × scales)', () => {
    expect(rider.mount.variant).toBe(horse);
    expect(rider.moveSpeed('run')).toBeCloseTo(3.4 * 0.5 * 1.2, 6);
    expect(rider.moveSpeed('walk')).toBeCloseTo(1 * 0.5 * 1.2, 6);
  });
  it('without a mount the own clip counts', () => {
    expect(horse.mount).toBeNull();
    expect(horse.moveSpeed('run')).toBeCloseTo(1.7, 6);
  });
});

describe('Manifest: horse', () => {
  it('mount role points to the horse, procedural as fallback', () => {
    const r = resolveRole(manifest, 'mount.horse', (m) => !!manifest.models[m]);
    expect(r.model).toBe('Horse');
    expect(manifest.roles['mount.horse'].procedural).toBe('horse');
    const def = manifest.models.Horse;
    expect(def.teamMarker).toBe(true);
    expect(def.saddle.bone).toMatch(/^Bone_/);
    expect(Object.keys(def.stride)).toEqual(expect.arrayContaining(['walk', 'run']));
    expect(def.clips).toMatchObject({ idle: 'idle', walk: 'walk', run: 'gallop', die: 'die' });
  });
  it('all rider roles sit on the horse (without a fixed seat height)', () => {
    for (const k of ['soldier.lightCav', 'soldier.lightCav.leader', 'soldier.heavyCav', 'soldier.heavyCav.leader']) {
      const r = manifest.roles[k];
      expect(r.attach.map((a) => a.role), k).toContain('mount.horse');
      expect(r.seat, k).toBeUndefined();
      expect(r.seatOffset, k).toBeLessThan(0);
    }
  });
});

/** Load GLB without textures (Node cannot decode images). */
async function loadGlb(file) {
  await Promise.all([MD.ready, ME.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MD, 'meshopt.encoder': ME });
  const doc = await io.read(new URL(file, DIR).pathname);
  for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  const bin = await io.writeBinary(doc);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '');
}

describe('Horse.lod1.glb: hooves do not slide', () => {
  const TIPS = ['Bone_043', 'Bone_050', 'Bone_017', 'Bone_011']; // hoof tips LF, RF, LH, RH
  for (const [key, clip] of [['walk', 'walk'], ['run', 'gallop']]) {
    it(`${clip}: standing hooves slide at the manifest speed, no hoof in the ground`, async () => {
      const g = await loadGlb('Horse.lod1.glb');
      const anim = g.animations.find((a) => a.name === clip);
      expect(anim).toBeTruthy();
      const mixer = new THREE.AnimationMixer(g.scene);
      mixer.clipAction(anim).play();
      // at the keyframes (24/s, as the game bakes; in between it mixes the bone matrices linearly)
      const n = Math.round(anim.duration * 24), dt = anim.duration / n;
      const tips = TIPS.map((name) => g.scene.getObjectByName(name));
      const pos = [];
      for (let f = 0; f <= n; f++) {
        mixer.setTime(f * dt);
        g.scene.updateMatrixWorld(true);
        pos.push(tips.map((o) => o.getWorldPosition(new THREE.Vector3())));
      }
      const speeds = [];
      let minY = Infinity;
      for (let f = 0; f < n; f++) for (let k = 0; k < 4; k++) {
        const a = pos[f][k], b = pos[f + 1][k];
        minY = Math.min(minY, a.y);
        // on the ground (rest height of the hoof tip ~0.022) and in both frames: stance phase
        if (a.y < 0.035 && b.y < 0.035) speeds.push((a.z - b.z) / dt);
      }
      speeds.sort((x, y) => x - y);
      const med = speeds[speeds.length >> 1];
      expect(med).toBeCloseTo(manifest.models.Horse.stride[key], 1);
      expect(minY).toBeGreaterThan(-0.01);
    });
  }
});

describe('Riders look in the riding direction (never sideways on the horse)', () => {
  // Every clip a rider shows in the saddle (standing, walk, gallop, attack, shot, cheer) keeps the hips in
  // the direction of the horse; only the upper body may turn for the strike. Dying is excluded (falls off the horse).
  const roles = ['soldier.lightCav', 'soldier.lightCav.leader', 'soldier.heavyCav', 'soldier.heavyCav.leader'];
  const models = new Set();
  for (const k of roles) {
    const r = manifest.roles[k];
    for (let i = 0; i < (r.variants?.length ?? 1); i++) models.add(JSON.stringify([variantRole(r, i).model, r.clipAlias]));
  }
  for (const entry of models) {
    const [model, alias] = JSON.parse(entry);
    it(model, async () => {
      const def = manifest.models[model];
      const g = await loadGlb(`${model}.lod1.glb`);
      const bake = bakeGltfAnimations(g, clipNamesFor(manifest, model), manifest.fps ?? 24, propClipNames(def.props, def.clips));
      const v = new Variant(model, [], bake, null, null, def.clips, { alias });
      for (const key of ['idle', 'walk', 'run', 'attack', 'shoot', 'cheer']) {
        const c = v.clip(key);
        for (const bone of ['Hips', 'Spine']) { // hips and chest
          let worst = 0;
          for (let f = c.start; f < c.start + c.frames; f++) worst = Math.max(worst, Math.abs(v.bodyYaw(f, bone)));
          expect((worst * 180) / Math.PI, `${model} ${key} → ${c.key} (${bone})`).toBeLessThan(25);
        }
      }
    });
  }
});
