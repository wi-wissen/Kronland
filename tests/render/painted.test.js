import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { paintedMaterial, paintObject } from '../../src/render/painted.js';

describe('Painted wood and stone structure', () => {
  it('leaves materials without loaded images unchanged (fallback as before)', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x8a5a3a });
    expect(paintedMaterial(m)).toBe(m);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    expect(paintObject(g).children[0].material).toBe(m);
    expect(paintObject(null)).toBe(null);
  });
});
