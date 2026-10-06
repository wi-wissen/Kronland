// Check the baked figure animation against three.js: the game bakes the bone texture from the file with the
// animations (game model, older files: near model) and combines the geometry of every level with it via the
// bone names (mergeCharacterGeometry). The result must match three.js CPU skinning,
// which applies the same clips directly to the near model – then the figure looks exactly like before.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder as MD, MeshoptEncoder as ME } from 'meshoptimizer';
import { bakeGltfAnimations, mergeCharacterGeometry, propClipNames, clipNamesFor } from '../../src/render/characters.js';

const DIR = new URL('../../public/models/characters/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));

/** Load GLB without textures (Node cannot decode images). */
async function loadGlb(file) {
  await Promise.all([MD.ready, ME.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MD, 'meshopt.encoder': ME });
  const doc = await io.read(new URL(file, DIR).pathname);
  for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  const bin = await io.writeBinary(doc);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '');
}

/** Baked position of a vertex (as in the shader: sum of the weighted bone matrices). */
function bakedPosition(geo, bake, frame, i) {
  const tex = bake.texture.image, W = tex.width, d = tex.data;
  const v = new THREE.Vector3(), acc = new THREE.Vector3(), m = new THREE.Matrix4();
  for (let c = 0; c < 4; c++) {
    const w = geo.attributes.aBoneW.getComponent(i, c);
    if (!w) continue;
    m.fromArray(d, (frame * W + geo.attributes.aBoneIdx.getComponent(i, c) * 4) * 4);
    acc.addScaledVector(v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(m), w);
  }
  return acc;
}

describe('Figures: baked animation = three.js skinning', () => {
  for (const model of Object.keys(manifest.models)) {
    it(model, async () => {
      const def = manifest.models[model];
      const near = await loadGlb(`${model}.glb`);
      const game = def.lods ? await loadGlb(`${model}.lod1.glb`) : null;
      const anim = [game, near].find((g) => g?.animations.length);
      expect(anim, 'file with animations').toBeTruthy();
      // animations are in the game model so that the near model only has to be loaded on demand
      if (game) { expect(anim).toBe(game); expect(near.animations).toHaveLength(0); }
      const fps = manifest.fps ?? 24;
      const bake = bakeGltfAnimations(anim, clipNamesFor(manifest, model), fps, propClipNames(def.props, def.clips));
      // body of the near model (first skinned mesh) – order as in mergeCharacterGeometry
      let body = null;
      near.scene.traverse((o) => { if (!body && o.isSkinnedMesh) body = o; });
      const geo = mergeCharacterGeometry(near.scene, bake, { include: [] }, [8, 4]);
      const mixer = new THREE.AnimationMixer(near.scene);
      const box = new THREE.Box3().setFromObject(near.scene);
      const height = box.max.y - box.min.y;
      let worst = 0;
      for (const name of ['idle', 'walk', 'run'].map((k) => def.clips?.[k]).filter((n) => bake.clips[n])) {
        const clip = anim.animations.find((c) => c.name === name);
        const action = mixer.clipAction(clip).play();
        for (const k of [0, 3, 7]) {
          if (k >= bake.clips[name].frames) continue;
          mixer.setTime(Math.min(clip.duration, k / fps));
          near.scene.updateMatrixWorld(true);
          const rootInv = near.scene.matrixWorld.clone().invert();
          const step = Math.max(1, Math.floor(body.geometry.attributes.position.count / 200));
          for (let i = 0; i < body.geometry.attributes.position.count; i += step) {
            const truth = body.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(body.matrixWorld).applyMatrix4(rootInv);
            worst = Math.max(worst, truth.distanceTo(bakedPosition(geo, bake, bake.clips[name].start + k, i)));
          }
        }
        action.stop();
        mixer.uncacheAction(clip);
      }
      // at most 1 % of the figure height deviation (quantisation of the files)
      expect(worst / height).toBeLessThan(0.01);
    }, 60_000);
  }

  for (const model of Object.keys(manifest.models).filter((m) => manifest.models[m].props)) it(`Tools: ${model}`, async () => {
    const def = manifest.models[model];
    const near = await loadGlb(`${model}.glb`);
    const game = def.lods ? await loadGlb(`${model}.lod1.glb`) : null;
    const anim = [game, near].find((g) => g?.animations.length);
    const fps = manifest.fps ?? 24;
    const bake = bakeGltfAnimations(anim, clipNamesFor(manifest, model), fps, propClipNames(def.props, def.clips));
    const include = Object.keys(def.props);
    const geo = mergeCharacterGeometry(near.scene, bake, { include }, [8, 4]);
    // position of each part in the merged geometry (same order as mergeCharacterGeometry)
    // (if not all parts are indexed, all are unrolled: vertex j of a part = index j)
    const meshes = [];
    // part name as there: animated node "Axe" with child mesh "Axe_1" counts as "Axe"
    const partName = (o) => (o.parent && include.includes(o.parent.name) && o.name.startsWith(o.parent.name) ? o.parent.name : o.name);
    near.scene.traverse((o) => { if (o.isMesh && (o.isSkinnedMesh || include.includes(partName(o)))) meshes.push(o); });
    const flat = !meshes.every((o) => o.geometry.index);
    const parts = [];
    let off = 0;
    for (const o of meshes) {
      const g = o.geometry;
      parts.push([o, off, flat && g.index ? (j) => g.index.getX(j) : (j) => j, flat && g.index ? g.index.count : g.attributes.position.count]);
      off += flat && g.index ? g.index.count : g.attributes.position.count;
    }
    expect(off).toBe(geo.attributes.position.count);
    const height = new THREE.Box3().setFromObject(near.scene).getSize(new THREE.Vector3()).y;
    const mixer = new THREE.AnimationMixer(near.scene);
    // per tool the first clip in which it is visible
    for (const [part, keys] of Object.entries(def.props)) {
      const name = def.clips[keys.find((k) => def.clips[k] && bake.clips[def.clips[k]])];
      if (!name) continue;
      const clip = anim.animations.find((c) => c.name === name);
      const action = mixer.clipAction(clip).play();
      const [mesh, start, src, count] = parts.find(([o]) => partName(o) === part);
      let worst = 0;
      for (const k of [0, 4, 9]) {
        mixer.setTime(Math.min(clip.duration, k / fps));
        near.scene.updateMatrixWorld(true);
        const rootInv = near.scene.matrixWorld.clone().invert();
        for (let i = 0; i < count; i += 3) {
          const truth = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, src(i)).applyMatrix4(mesh.matrixWorld).applyMatrix4(rootInv);
          worst = Math.max(worst, truth.distanceTo(bakedPosition(geo, bake, bake.clips[name].start + k, start + i)));
        }
      }
      action.stop();
      mixer.uncacheAction(clip);
      expect(worst / height, part).toBeLessThan(0.01);
      // game model: the same tool at the same place (centroid; own, coarser mesh)
      if (game) {
        const gGeo = mergeCharacterGeometry(game.scene, bake, { include }, [8, 4]);
        const centroid = (g, from, n, frame) => { const c = new THREE.Vector3(); for (let i = 0; i < n; i++) c.add(bakedPosition(g, bake, frame, from + i)); return c.divideScalar(n); };
        const gm = [];
        game.scene.traverse((o) => { if (o.isMesh && (o.isSkinnedMesh || include.includes(partName(o)))) gm.push(o); });
        const gFlat = !gm.every((o) => o.geometry.index);
        let gOff = 0, gStart = -1, gCount = 0;
        for (const o of gm) {
          const n = gFlat && o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
          if (partName(o) === part) { gStart = gOff; gCount = n; }
          gOff += n;
        }
        const frame = bake.clips[name].start + 4;
        const d = centroid(gGeo, gStart, gCount, frame).distanceTo(centroid(geo, start, count, frame));
        expect(d / height, `${part} in game model`).toBeLessThan(0.02);
      }
    }
  }, 60_000);
});
