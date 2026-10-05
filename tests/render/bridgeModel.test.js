import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { bridgeAssetModel } from '../../src/render/models.js';

/** Substitute model: long box along z (like the Meshy bridge after building). */
function fakeBridge() {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 1.9), new THREE.MeshStandardMaterial()));
  return root;
}
const extent = (g) => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()); };

describe('Own bridge model', () => {
  it('stretches to the length of the bridge site and fits across', () => {
    const along = extent(bridgeAssetModel(fakeBridge(), 7, 2, 0));
    expect(along.x).toBeCloseTo(7.6, 1); // length + 0.3 overhang each
    expect(along.z).toBeCloseTo(1.9, 1);
    const across = extent(bridgeAssetModel(fakeBridge(), 2, 4, 1));
    expect(across.z).toBeCloseTo(4.6, 1);
    expect(across.x).toBeCloseTo(1.9, 1);
  });
  it('sets the deck top edge to y = 0 (rest below)', () => {
    const g = bridgeAssetModel(fakeBridge(), 3, 2, 0);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    expect(b.min.y).toBeLessThan(0);
    expect(b.max.y).toBeGreaterThan(0);
  });
});
