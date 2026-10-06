// Figure manifest: role resolution, clip fallbacks, animation frames, masks (without WebGL).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  resolveRole, resolveClip, clipFrames, uvInMask, animStep, usedModels, clipNamesFor, modelFiles, PROCEDURAL_DEFAULT, CLIP_KEYS,
} from '../../src/render/characters.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/models/characters/manifest.json', import.meta.url), 'utf8'));

describe('resolveRole', () => {
  const all = () => true;
  it('finds roles directly', () => {
    const r = resolveRole(manifest, 'soldier.sword', all);
    expect(r.model).toBe('Swordsman');
  });
  it('falls back from specific to more general keys', () => {
    const m = { roles: { soldier: { model: 'A' }, 'soldier.bow': { model: 'B' } } };
    expect(resolveRole(m, 'soldier.bow.leader', all).model).toBe('B');
    expect(resolveRole(m, 'soldier.spear.leader', all).model).toBe('A');
  });
  it('follows "fallback" references', () => {
    const m = { roles: { a: { model: 'A' }, 'a.leader': { fallback: 'a' } } };
    const r = resolveRole(m, 'a.leader', all);
    expect(r.key).toBe('a');
    expect(r.model).toBe('A');
  });
  it('uses the procedural figure when the model is missing', () => {
    const r = resolveRole(manifest, 'soldier.bow', () => false);
    expect(r.model).toBeNull();
    expect(r.procedural).toBe('bow');
  });
  it('roles without a model (cannon) are procedural', () => {
    const r = resolveRole(manifest, 'soldier.cannon', all);
    expect(r.model).toBeNull();
    expect(r.procedural).toBe('cannon');
  });
  it('returns null for completely unknown roles', () => {
    expect(resolveRole({ roles: {} }, 'dragon', all)).toBeNull();
  });
  it('aborts on cyclic references', () => {
    const m = { roles: { a: { fallback: 'b' }, b: { fallback: 'a', procedural: 'serf' } } };
    expect(() => resolveRole(m, 'a', all)).not.toThrow();
  });
});

describe('Manifest', () => {
  it('every role the game uses is resolvable', () => {
    const roles = ['serf', 'worker', 'hero.nelia', 'hero.orrin', 'hero.taran', 'hero.malvor', 'bandit', 'bandit.bow', 'mount.horse', 'crew'];
    for (const line of ['sword', 'spear', 'bow', 'lightCav', 'heavyCav', 'cannon']) roles.push(`soldier.${line}`, `soldier.${line}.leader`);
    for (const k of roles) {
      const r = resolveRole(manifest, k, (m) => !!manifest.models[m]);
      expect(r, k).not.toBeNull();
      expect(r.model || r.procedural, k).toBeTruthy();
    }
  });
  it('models only name known clip keys and roles only known models', () => {
    for (const [name, def] of Object.entries(manifest.models)) {
      for (const k of Object.keys(def.clips)) expect([...CLIP_KEYS, 'ride', 'block'], `${name}.${k}`).toContain(k);
    }
    for (const [k, r] of Object.entries(manifest.roles)) {
      if (r.model) expect(manifest.models[r.model], k).toBeTruthy();
      for (const inc of r.include ?? []) if (inc.includes(':')) expect(manifest.models[inc.split(':')[0]], `${k}: ${inc}`).toBeTruthy();
      for (const a of r.attach ?? []) expect(manifest.roles[a.role], `${k} → ${a.role}`).toBeTruthy();
    }
  });
  it('collects used models (also part donors) and their clip names', () => {
    const used = usedModels(manifest);
    expect(used).toEqual(expect.arrayContaining(['Swordsman', 'SwordsmanF', 'Spearman', 'ArcherF', 'Gunner', 'Farmer', 'Nelia', 'LightRider']));
    // role override of clips counts too (own mini manifest)
    const m = { models: { K: { clips: { idle: 'Idle', walk: 'Walking_A' } } }, roles: { s: { model: 'K', clips: { attack: 'Stab' } } } };
    const clips = clipNamesFor(m, 'K');
    expect(clips).toContain('Walking_A');
    expect(clips).toContain('Stab');
  });
  it('file names of the LOD levels', () => {
    expect(modelFiles('Knight', { lods: 2 })).toEqual(['Knight.glb', 'Knight.lod1.glb', 'Knight.lod2.glb']);
    expect(modelFiles('X', { file: 'sub/x.glb' })).toEqual(['sub/x.glb']);
  });
});

describe('resolveClip', () => {
  const has = (set) => (k) => set.includes(k);
  it('takes the clip itself if present', () => expect(resolveClip('chop', has(['chop', 'idle']))).toBe('chop'));
  it('follows the fallback chain', () => {
    expect(resolveClip('mine', has(['attack', 'idle']))).toBe('attack');   // mine → chop → attack
    expect(resolveClip('build', has(['walk', 'idle']))).toBe('idle');      // build → hammer → chop → attack → idle
    expect(resolveClip('run', has(['walk', 'idle']))).toBe('walk');
  });
  it('returns null if nothing is there at all', () => expect(resolveClip('die', has([]))).toBeNull());
});

describe('clipFrames', () => {
  const clip = { start: 100, frames: 24 };
  it('repeats loops', () => {
    expect(clipFrames(clip, 0, 24, true)).toEqual([100, 101, 0]);
    const [a, b, w] = clipFrames(clip, 1.0 + 0.5 / 24, 24, true); // frame 0.5 of the 2nd round
    expect(a).toBe(100); expect(b).toBe(101); expect(w).toBeCloseTo(0.5, 5);
    const [a2, b2] = clipFrames(clip, 23.5 / 24, 24, true); // last frame blends into the first
    expect(a2).toBe(123); expect(b2).toBe(100);
  });
  it('stays on the last frame for one-shot clips', () => {
    expect(clipFrames(clip, 10, 24, false)).toEqual([123, 123, 0]);
  });
  it('single-frame clips', () => expect(clipFrames({ start: 0, frames: 1 }, 3, 24, true)).toEqual([0, 0, 0]));
});

describe('uvInMask / animStep / procedural', () => {
  it('recognises cells and rectangles', () => {
    expect(uvInMask(0.1, 0.3, { uvCells: [[0, 1]] })).toBe(true);   // cell (0,1) in the 8×4 grid
    expect(uvInMask(0.2, 0.3, { uvCells: [[0, 1]] })).toBe(false);
    expect(uvInMask(0.5, 0.5, { uvRects: [[0.4, 0.4, 0.6, 0.6]] })).toBe(true);
    expect(uvInMask(0.5, 0.5, {})).toBe(false);
  });
  it('throttles animations by level', () => {
    expect(animStep(0)).toBe(0);
    expect(animStep(1)).toBeGreaterThan(0);
    expect(animStep(2)).toBeGreaterThan(animStep(1));
    expect(animStep(3)).toBe(Infinity);
  });
  it('derives procedural kinds from roles', () => {
    expect(PROCEDURAL_DEFAULT('soldier.bow.leader')).toBe('bow');
    expect(PROCEDURAL_DEFAULT('hero.orrin')).toBe('hero:orrin');
    expect(PROCEDURAL_DEFAULT('serf')).toBe('serf');
  });
});

import { startModels } from '../../src/render/characters.js';
describe('Loading figures on demand', () => {
  it('only loads the serf models at start', () => {
    const start = startModels(manifest);
    expect(start).toEqual(expect.arrayContaining(['Serf', 'SerfF']));
    expect(start).not.toContain('Spearman');
    expect(start).not.toContain('Swordsman');
  });
});

import { firstFiles, levelMaskFiles } from '../../src/render/characters.js';
describe('Near model only on demand', () => {
  it('first loads only the game model and its masks', () => {
    expect(firstFiles('Farmer', { lods: 1 })).toEqual({ models: ['Farmer.lod1.glb'], masks: [] });
    // mask only for the near level: comes with the near model
    expect(firstFiles('Farmer', { lods: 1, mask: ['Farmer.mask.png', null] })).toEqual({ models: ['Farmer.lod1.glb'], masks: [] });
    // one mask for all levels: comes along right away
    expect(firstFiles('Farmer', { lods: 2, mask: 'm.png' })).toEqual({ models: ['Farmer.lod1.glb', 'Farmer.lod2.glb'], masks: ['m.png'] });
    // without LOD levels there is only the original
    expect(firstFiles('X', { mask: 'x.png' })).toEqual({ models: ['X.glb'], masks: ['x.png'] });
  });

  it('masks per level range', () => {
    const def = { mask: ['near.png', 'game.png'] };
    expect(levelMaskFiles(def, 0, 0)).toEqual(['near.png']);
    expect(levelMaskFiles(def, 1, 3)).toEqual(['game.png']);
  });

  it('all shipped figures have a game model (otherwise the game immediately loads the near model)', () => {
    for (const [name, def] of Object.entries(manifest.models)) expect(def.lods ?? 0, name).toBeGreaterThanOrEqual(1);
  });
});
