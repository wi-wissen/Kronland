// Own tree models: species choice, winter swap, cross geometry of flat models, fitting to game height.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  TREE_MODELS, BUSH_MODEL, pickTreeVariant, treeSpecies, neighborCount, forestType, treeHash, seasonLevels, applySeason, SUMMER_NATURE_MODELS, WINTER_NATURE_MODELS,
} from '../../src/render/treeModels.js';
import { crossGeometry, fitNatureGeometry } from '../../src/render/nature.js';

const byKind = { leafy: [0, 1], birch: [2], conifer: [3, 4] };

const byModel = { tree_oak: 0, tree_beech: 1, tree_birch: 2, tree_spruce: 3, tree_pine: 4 };
const tree = (id, alt, neighbors = 10, x = id % 61, z = (id * 7) % 53) => ({ x: x + 0.5, z: z + 0.5, alt, neighbors, h: treeHash(id, x, z) });

describe('Tree species (naturally grown)', () => {
  it('is deterministic per tree (same id and tile = same species)', () => {
    for (let id = 1; id < 200; id++) expect(pickTreeVariant(tree(id, 1), byKind, byModel)).toBe(pickTreeVariant(tree(id, 1), byKind, byModel));
  });

  it('normally deciduous and mixed forest (conifers only in the mountains), cold worlds mostly conifer forest', () => {
    const share = (alt, forest) => {
      let c = 0;
      for (let id = 1; id <= 4000; id++) if (['tree_spruce', 'tree_pine'].includes(treeSpecies({ ...tree(id, alt), forest }))) c++;
      return c / 4000;
    };
    expect(share(0, 'mixed')).toBeLessThan(0.12);
    expect(share(3, 'mixed')).toBeLessThan(0.2);
    expect(share(10, 'mixed')).toBeGreaterThan(0.4);
    expect(share(10, 'mixed')).toBeLessThan(0.8);
    expect(share(2, 'conifer')).toBeGreaterThan(0.45);
    expect(share(8, 'conifer')).toBeGreaterThan(0.85);
  });

  it('forest type: from the mission, otherwise from the weather (lots of winter = conifer forest)', () => {
    expect(forestType({ weatherCycle: [['summer', 6000], ['rain', 1200], ['summer', 6000], ['winter', 1800]] })).toBe('mixed');
    expect(forestType({ weatherCycle: [['winter', 9000], ['summer', 1000]] })).toBe('conifer');
    expect(forestType({ mission: { def: { forest: 'leafy' } }, weatherCycle: [['winter', 1]] })).toBe('leafy');
  });

  it('same species stand in stands: neighbouring tiles mostly have the same species', () => {
    let same = 0, n = 0;
    for (let x = 0; x < 60; x++) for (let z = 0; z < 60; z++) {
      const a = treeSpecies({ x, z, alt: 3, neighbors: 10, h: treeHash(1, x, z) });
      const b = treeSpecies({ x: x + 1, z, alt: 3, neighbors: 10, h: treeHash(2, x + 1, z) });
      same += a === b ? 1 : 0; n++;
    }
    expect(same / n).toBeGreaterThan(0.65); // random would be about 0.3 with four species
  });

  it('pines only in dense forest, single trees mostly oaks or birches', () => {
    for (let id = 1; id < 2000; id++) expect(treeSpecies({ ...tree(id, 8, 3), forest: 'conifer' })).not.toBe('tree_pine');
    let oak = 0;
    for (let id = 1; id < 2000; id++) { const s = treeSpecies(tree(id, 0, 1)); expect(['tree_oak', 'tree_birch', 'tree_spruce']).toContain(s); oak += s === 'tree_oak' ? 1 : 0; }
    expect(oak).toBeGreaterThan(900);
  });

  it('counts neighbouring trees and falls back to the genus without models', () => {
    const W = 10, set = new Set([5 * W + 5, 5 * W + 6, 6 * W + 5, 9 * W + 9]);
    expect(neighborCount(set, 5, 5, W)).toBe(2);
    for (let id = 1; id < 500; id++) expect(pickTreeVariant(tree(id, 0), { leafy: [0], birch: [], conifer: [1] })).toBeGreaterThanOrEqual(0);
  });
});

describe('Model tables', () => {
  it('every species has a winter version; deciduous trees taller than house level 1, conifers tallest', () => {
    for (const t of TREE_MODELS) expect(t.winter.name).toBe(`${t.name}_winter`);
    const h = Object.fromEntries(TREE_MODELS.map((t) => [t.name, t.height]));
    expect(h.tree_oak).toBeGreaterThan(3);
    expect(h.tree_pine).toBeGreaterThan(h.tree_beech);
    expect(BUSH_MODEL.height).toBeLessThan(1.2);
    expect(SUMMER_NATURE_MODELS).toHaveLength(6);
    expect(WINTER_NATURE_MODELS).toContain('bush_winter');
  });
});

describe('seasonLevels', () => {
  it('fills missing levels with the next coarser, otherwise the finer one; entirely without winter null', () => {
    expect(seasonLevels(['a', null, 'c'])).toEqual(['a', 'c', 'c']);
    expect(seasonLevels(['a', 'b', null])).toEqual(['a', 'b', 'b']);
    expect(seasonLevels([null, null])).toBeNull();
  });
});

describe('applySeason (winter swap)', () => {
  const group = (season) => {
    const summer = { levels: ['s0', 's1', 's2'], material: 'mS' };
    return { meshes: [{ geometry: 's0', material: 'mS' }, { geometry: 's1', material: 'mS' }, { geometry: 's2', material: 'mS' }], userData: { summer, season } };
  };

  it('swaps only geometry and material per level and back', () => {
    const winter = { levels: ['w0', 'w1', 'w2'], material: 'mW' };
    const g = group(() => winter);
    const plain = { meshes: [{ geometry: 'x', material: 'y' }], userData: {} };
    expect(applySeason([g, plain], true)).toEqual({ missing: false, materials: ['mW'] });
    expect(g.meshes.map((m) => m.geometry)).toEqual(['w0', 'w1', 'w2']);
    expect(g.meshes.every((m) => m.material === 'mW')).toBe(true);
    expect(plain.meshes[0]).toEqual({ geometry: 'x', material: 'y' });
    applySeason([g], false);
    expect(g.meshes.map((m) => m.geometry)).toEqual(['s0', 's1', 's2']);
    expect(g.meshes[0].material).toBe('mS');
  });

  it('if the winter version is missing (not yet loaded), summer stays and missing reports it', () => {
    const g = group(() => null);
    expect(applySeason([g], true).missing).toBe(true);
    expect(g.meshes[2].geometry).toBe('s2');
  });
});

describe('Geometry of the models', () => {
  it('fitNatureGeometry puts it on the ground, centred, at target height', () => {
    const g = new THREE.BoxGeometry(2, 1.9, 0.6);
    g.translate(0.3, 0, -0.2);
    g.computeBoundingBox();
    const ref = g.boundingBox.clone();
    const out = fitNatureGeometry(g, ref, 3.8);
    const b = out.boundingBox;
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(3.8, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(0, 5);
  });

  it('cross geometry: two copies in one geometry, the second rotated by 90° – wide from all sides', () => {
    const flat = new THREE.BoxGeometry(2, 2, 0.2);
    const tris = flat.index.count / 3;
    const ref = (flat.computeBoundingBox(), flat.boundingBox.clone());
    const out = fitNatureGeometry(flat, ref, 2, true);
    expect(out.index.count / 3).toBe(tris * 2);
    const b = out.boundingBox;
    expect(b.max.x - b.min.x).toBeCloseTo(2, 4);
    expect(b.max.z - b.min.z).toBeCloseTo(2, 4);
    const c = crossGeometry(new THREE.PlaneGeometry(1, 1));
    expect(c.attributes.position.count).toBe(8);
  });
});
