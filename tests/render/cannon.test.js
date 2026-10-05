import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { isMagenta, normalizeToLength, unitModel } from '../../src/render/models.js';

describe('Cannon (own model)', () => {
  it('recognises the team area in the texture', () => {
    expect(isMagenta(230, 20, 220)).toBe(true);
    expect(isMagenta(120, 90, 60)).toBe(false);
  });
  it('puts geometries on the ground, centred, with the desired length', () => {
    const g = new THREE.BoxGeometry(2, 1, 4).translate(5, 3, 1);
    normalizeToLength([g], 1.05);
    g.computeBoundingBox();
    const b = g.boundingBox;
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.z - b.min.z).toBeCloseTo(1.05);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0);
  });
  it('shows the procedural shape until loaded and remembers the reload', () => {
    expect(unitModel('cannon', 0).userData.pendingAsset).toBe('buildings/cannon');
  });
});

import { variantStale } from '../../src/render/characters.js';
describe('Cannon crew', () => {
  it('recognises placeholders whose model has arrived in the meantime – also in attachments', () => {
    const crew = { pendingCheck: () => true, attach: [] };
    expect(variantStale({ attach: [{ variant: crew }] })).toBe(true);
    expect(variantStale({ attach: [{ variant: { attach: [] } }] })).toBe(false);
    expect(variantStale(null)).toBe(false);
  });
});
