// Stage restart and world switch keep the WebGL renderer, figure renderings and tree/decoration models alive
// (src/render/Renderer.js `from`, Engine.restart/retire). Without WebGL: what can be checked is the hand-over logic.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/Renderer.js', () => {
  class Renderer {
    static made = [];
    constructor(canvas, sim, opts = {}) {
      this.sim = sim; this.opts = opts; this.log = [];
      this.rig = { target: { x: 1, z: 2 }, yaw: 0.5, dist: 20, pitch: 0.9, lookAt(x, z) { this.target = { x, z }; }, clamp() {} };
      this.grid = null;
      Renderer.made.push(this);
    }
    startup() { this.log.push('startup'); }
    dispose(o) { this.log.push(['dispose', o?.successor ?? null]); }
    setGrid() {}
    applyWeather() {}
  }
  return { Renderer };
});

const { Engine } = await import('../../src/game/Engine.js');
const { Renderer } = await import('../../src/render/Renderer.js');
const { collectHeld } = await import('../../src/render/retain.js');
const { CharacterSystem } = await import('../../src/render/characters.js');

afterEach(() => { vi.useRealTimers(); Renderer.made.length = 0; });

function engine() {
  const old = new Renderer({}, { id: 'old' });
  old.rig.target = { x: 7, z: 9 };
  const e = Object.create(Engine.prototype);
  Object.assign(e, {
    canvas: {}, player: 0, renderer: old, sim: { id: 'old' }, input: {}, selected: new Set([1, 2]), restarts: 0, missionView: { cameraSeq: 0 },
    resize() {}, syncTracks() {}, emitUi() {}, dev: null,
  });
  return { e, old };
}
const world = (id, ids = []) => ({ id, entities: new Map(ids.map((i) => [i, {}])), weather: { state: 'summer' }, trackModeFixed: true, mission: null });

describe('Engine.restart', () => {
  it('hands the old renderer to the new one, starts it, and frees the old one only after a delay', () => {
    vi.useFakeTimers();
    const { e, old } = engine();
    e.restart(world('new', [1]));
    const next = e.renderer;
    expect(next).not.toBe(old);
    expect(next.opts.from).toBe(old);
    expect(next.log).toEqual(['startup']);
    expect(e.input.rig).toBe(next.rig);
    // camera carried over, selection reduced to what still exists, counters
    expect(next.rig.target).toEqual({ x: 7, z: 9 });
    expect([...e.selected]).toEqual([1]);
    expect(e.restarts).toBe(1);
    // the old world is still alive: its materials hold the shader programs the new world may need a few frames later
    expect(old.log).toEqual([]);
    vi.advanceTimersByTime(60_000);
    expect(old.log).toEqual([['dispose', next]]);
  });

  it('frees retired renderers in order, and all of them when the engine ends', () => {
    vi.useFakeTimers();
    const { e, old } = engine();
    e.restart(world('b'));
    const b = e.renderer;
    e.restart(world('c'));
    const c = e.renderer;
    expect(c.opts.from).toBe(b);
    expect(old.log).toEqual([]);
    e.flushRetired();
    expect(old.log).toEqual([['dispose', b]]);
    expect(b.log).toEqual(['startup', ['dispose', c]]);
    expect(c.log).toEqual(['startup']);
    // timers are cancelled: nothing is disposed twice
    vi.advanceTimersByTime(60_000);
    expect(old.log.length).toBe(1);
    expect(b.log.length).toBe(2);
  });

  it('a failing disposal does not stop the others', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { e, old } = engine();
    old.dispose = () => { throw new Error('boom'); };
    e.restart(world('b'));
    const b = e.renderer;
    e.restart(world('c'));
    e.flushRetired();
    expect(warn).toHaveBeenCalledOnce();
    expect(b.log).toContainEqual(['dispose', e.renderer]);
    warn.mockRestore();
  });
});

describe('collectHeld', () => {
  it('collects geometries, materials and their textures of every scene root', () => {
    const tex = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    const mat2 = new THREE.MeshBasicMaterial();
    const geo = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geo, [mat, mat2]), new THREE.Group());
    const held = collectHeld([root, null, undefined]);
    expect(held.size).toBe(4);
    for (const x of [geo, mat, mat2, tex]) expect(held.has(x)).toBe(true);
    // extends a given set
    const into = new Set(['x']);
    expect(collectHeld([root], into)).toBe(into);
    expect(into.has('x') && into.has(geo)).toBe(true);
  });
});

describe('CharacterSystem.adoptVariants', () => {
  const quality = { tier: 'high', characterModels: 'procedural', shadows: false };
  const variantWith = () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.count = 5;
    return { key: 'serf', meshes: [mesh, null], mesh };
  };

  it('takes over finished renderings with their meshes; the figures start empty', () => {
    const a = new CharacterSystem(new THREE.Scene(), quality, { procedural: {} });
    const v = variantWith();
    a.variants.set('serf', v);
    a.variants.set('broken', null);
    a.group.add(v.mesh);
    a.records.set(3, { id: 3 });
    const b = new CharacterSystem(new THREE.Scene(), quality, { procedural: {} });
    expect(b.adoptVariants(a)).toBe(true);
    expect(b.variants.get('serf')).toBe(v);
    expect(b.variants.has('broken')).toBe(true);
    expect(b.records.size).toBe(0);
    expect(v.mesh.parent).toBe(b.group);
    expect(v.mesh.count).toBe(0);
    expect(a.variants.size).toBe(0);
    expect(a.group.children).not.toContain(v.mesh);
  });

  it('does not take them over when the figure model setting differs', () => {
    const a = new CharacterSystem(new THREE.Scene(), quality, { procedural: {} });
    a.variants.set('serf', variantWith());
    const b = new CharacterSystem(new THREE.Scene(), { ...quality, characterModels: 'gpu' }, { procedural: {} });
    expect(b.adoptVariants(a)).toBe(false);
    expect(b.variants.size).toBe(0);
    expect(a.variants.size).toBe(1);
  });
});
