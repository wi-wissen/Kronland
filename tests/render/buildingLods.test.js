import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { OWN_BUILDING_ASSETS, BUILDING_LODS, isBakedGeometry, assetState, assetPending } from '../../src/render/assets.js';

// Far level of the buildings (scripts/build-lods.mjs, "bake"): corner colours instead of a texture, self-contained without the original.

describe('Far level of the buildings', () => {
  it('recognises meshes with corner colours and without UV as self-contained', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    expect(isBakedGeometry(g)).toBe(false);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
    expect(isBakedGeometry(g)).toBe(true);
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2));
    expect(isBakedGeometry(g)).toBe(false);
  });

  it('load state without loaded models: nothing there, types without own model count as done', () => {
    expect(assetState('headquarters', 0)).toBe(0);
    expect(assetPending('headquarters', 0)).toBe(true);
    expect(assetState('unknown', 0)).toBe(2);
    expect(assetState('bridge', 0)).toBe(2); // without loader (no loadAssets)
  });

  it('all own building models have a far level with corner colours, without UV and texture', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const files = [...new Set(Object.values(OWN_BUILDING_ASSETS).flat())];
    for (const f of files) {
      const path = `public/models/buildings/${f}.lod${BUILDING_LODS}.glb`;
      expect(existsSync(path), path).toBe(true);
      const root = (await io.read(path)).getRoot();
      expect(root.listTextures(), f).toHaveLength(0);
      let tris = 0;
      for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
        expect(p.getAttribute('COLOR_0'), f).toBeTruthy();
        expect(p.getAttribute('TEXCOORD_0'), f).toBeNull();
        tris += p.getIndices().getCount() / 3;
      }
      // clearly simpler than the original (~8,000–16,000 triangles)
      expect(tris, f).toBeLessThan(6500);
    }
  }, 60_000);
});
