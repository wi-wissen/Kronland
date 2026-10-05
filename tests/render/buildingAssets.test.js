import { describe, it, expect } from 'vitest';
import { BUILDING_ASSETS, OWN_BUILDING_ASSETS, isOwnBuildingModel, ownBuildingFill, ownBuildingPit, convexHull, buildingAssetName, assetPending } from '../../src/render/assets.js';

describe('Own building models', () => {
  it('have their own model per upgrade level and no stone base', () => {
    for (const type of ['residence', 'headquarters', 'villageCenter', 'farm', 'chapel']) expect(BUILDING_ASSETS[type]).toHaveLength(3);
    for (const type of ['storehouse', 'university', 'bank', 'smithy']) expect(BUILDING_ASSETS[type]).toHaveLength(2);
    for (const n of Object.values(OWN_BUILDING_ASSETS).flat()) expect(isOwnBuildingModel(`buildings/${n}`)).toBe(true);
    expect(isOwnBuildingModel('buildings/watchtower_blue')).toBe(false);
  });
  it('exist once (team colour in the shader) and are only loaded on demand', () => {
    // without a loaded model: no name (procedural placeholder), reloading is pending
    expect(buildingAssetName('residence', 0, 2)).toBe(null);
    expect(assetPending('residence', 0)).toBe(true);
    expect(assetPending('bridge', 0)).toBe(false);
  });
  it('enlarge mills whose sails extend beyond the footprint', () => {
    expect(ownBuildingFill('buildings/farm3')).toBeGreaterThan(1);
    expect(ownBuildingFill('buildings/house')).toBe(1);
    expect(ownBuildingFill(null)).toBe(1);
  });
  it('cover all building types except the bridge, pits sunk', async () => {
    const { BUILDINGS } = await import('../../src/sim/data/buildings.js');
    for (const [type, b] of Object.entries(BUILDINGS)) {
      if (type === 'bridge') continue;
      expect(OWN_BUILDING_ASSETS[type], type).toHaveLength(b.levels.length);
    }
    expect(ownBuildingPit('buildings/iron_mine.lod1').ground).toBeGreaterThan(0);
    expect(ownBuildingPit('buildings/stone_mine')).toBe(null);
  });
  it('fill pits with the convex hull (even with a hole in the middle)', () => {
    const ring = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push([Math.cos(a), Math.sin(a)], [0.5 * Math.cos(a), 0.5 * Math.sin(a)]); }
    const hull = convexHull(ring);
    expect(hull).toHaveLength(16); // only the outer ring
    for (const [x, z] of hull) expect(Math.hypot(x, z)).toBeCloseTo(1);
  });
});
