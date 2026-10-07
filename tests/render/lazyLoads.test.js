// Loading screen waits for on-demand models only if they are all cached (src/render/lazyLoads.js).
import { describe, it, expect } from 'vitest';
import { trackLoad, pendingLoads, settleLazyLoads } from '../../src/render/lazyLoads.js';

const frame = () => Promise.resolve();
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

describe('settleLazyLoads', () => {
  it('nothing pending: returns at once', async () => {
    expect(await settleLazyLoads({ frame, isCached: async () => true })).toBe('none');
  });

  it('all files cached: waits until the loads are done, including loads they trigger', async () => {
    let second = null;
    trackLoad(later(20).then(() => { second = trackLoad(later(20), ['b.glb']); }), ['a.glb']);
    expect(await settleLazyLoads({ frame, isCached: async () => true })).toBe('done');
    expect(second).not.toBeNull();
    expect(pendingLoads()).toEqual([]);
  });

  it('first visit (a file not cached): does not wait', async () => {
    const p = trackLoad(later(200), ['a.glb', 'b.glb']);
    const t0 = Date.now();
    expect(await settleLazyLoads({ frame, isCached: async (u) => u === 'a.glb' })).toBe('cold');
    expect(Date.now() - t0).toBeLessThan(150);
    await p;
  });

  it('gives up after maxMs; a failed load does not block', async () => {
    const p = trackLoad(later(300), ['slow.glb']);
    trackLoad(Promise.reject(new Error('404')), ['gone.glb']).catch(() => {});
    expect(await settleLazyLoads({ frame, isCached: async () => true, maxMs: 50 })).toBe('timeout');
    await p;
    expect(pendingLoads()).toEqual([]);
  });
});
