// Terrain mesh: apply sim height changes region by region (building on a slope).
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/textures.js', () => ({
  TEX_REPEAT: 6, ROCK_REPEAT: 9,
  terrainTextures: () => new Proxy({}, { get: () => new THREE.Texture() }),
}));

const { Terrain } = await import('../../src/render/terrain.js');
const { QUALITY_PRESETS } = await import('../../src/render/quality.js');
const { ChunkedInstances } = await import('../../src/render/lod.js');
const { Sim } = await import('../../src/sim/sim.js');
const { levelSite } = await import('../../src/sim/systems/terrain.js');
const { WATER, OCCUPIED, RESERVED, CLIFF } = await import('../../src/sim/map.js');

const Q = { ...QUALITY_PRESETS.medium, tier: 'medium', margin: 4 };

/** Find a 3×3 slope area. */
function slopeSite(sim) {
  const m = sim.map;
  for (let y = 4; y < m.height - 8; y++) for (let x = 4; x < m.width - 8; x++) {
    if (!m.rectFree(x - 1, y - 1, 5, 5, WATER | OCCUPIED | RESERVED | CLIFF)) continue;
    if (m.slope(x, y, 3, 3) >= 150) return { x, y };
  }
  return null;
}

const maxDiff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };

describe('Terrain.updateArea', () => {
  it('yields the same mesh after levelling as a rebuild', () => {
    const sim = new Sim({ seed: 42 });
    const t = new Terrain(sim.map, sim.waterLevel, Q);
    const site = slopeSite(sim);
    expect(levelSite(sim, site.x, site.y, 3, 3)).toBe(true);
    const ev = sim.events.find((e) => e.type === 'terrainChanged');
    t.updateArea(ev.x, ev.y, ev.w, ev.h);
    const fresh = new Terrain(sim.map, sim.waterLevel, Q);
    expect(maxDiff(t.grid, fresh.grid)).toBeLessThan(1e-6);
    expect(maxDiff(t.geometry.attributes.position.array, fresh.geometry.attributes.position.array)).toBeLessThan(1e-6);
    expect(maxDiff(t.geometry.attributes.normal.array, fresh.geometry.attributes.normal.array)).toBeLessThan(1e-4);
    expect(maxDiff(t.splatA, fresh.splatA)).toBeLessThan(1e-4);
  });

  it('building area (setPad) is exactly flat in the mesh at the sim height', () => {
    const sim = new Sim({ seed: 42 });
    const site = slopeSite(sim);
    levelSite(sim, site.x, site.y, 3, 3);
    const t = new Terrain(sim.map, sim.waterLevel, Q);
    t.setPad(1, site.x, site.y, 3, 3);
    const y = t.padY(sim.map.heights[sim.map.idx(site.x, site.y)]);
    for (let j = 0; j <= 12; j++) for (let i = 0; i <= 12; i++) {
      expect(Math.abs(t.heightAt(site.x + i / 4, site.y + j / 4) - y)).toBeLessThan(1e-5);
    }
    // demolition: pad gone, mesh as without pad
    t.clearPad(1);
    const fresh = new Terrain(sim.map, sim.waterLevel, Q);
    expect(maxDiff(t.grid, fresh.grid)).toBeLessThan(1e-6);
  });
});

describe('ChunkedInstances.shiftY', () => {
  it('shifts only visible instances in the range', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const ci = new ChunkedInstances({ name: 't', chunkSize: 4, levels: [{ geometry: geo, material: new THREE.MeshBasicMaterial() }] });
    const m = new THREE.Matrix4();
    const a = ci.add(1, 1, m.clone().setPosition(1, 0, 1));
    ci.add(10, 10, m.clone().setPosition(10, 0, 10));
    const c = ci.add(2, 2, m.clone().setPosition(2, 0, 2));
    ci.finalize(new THREE.Group());
    ci.hide(c);
    ci.shiftY(0, 0, 5, 5, () => 0.5);
    const chunk = ci.chunks[ci.keyToChunk.get(a.key)];
    expect(chunk.matrices[a.index * 16 + 13]).toBeCloseTo(0.5);
    expect(chunk.matrices[c.index * 16 + 13]).toBe(0); // hidden stays hidden
    const far = ci.chunks.find((ch) => ch !== chunk);
    expect(far.matrices[13]).toBe(0);
  });
});
