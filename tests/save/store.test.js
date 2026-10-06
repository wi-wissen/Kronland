// Management of the save game slots with an in-memory store mock.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame } from '../../src/sim/serialize.js';
import { SaveStore, AUTO_ID, LEGACY_KEY } from '../../src/save/store.js';
import { MemoryBackend, LocalStorageBackend } from '../../src/save/backends.js';
import { SaveError, createSaveDoc } from '../../src/save/format.js';
import { autosaveDue, autosaveStart, snapshotText, AUTOSAVE_TICKS, AUTOSAVE_FIRST_TICKS } from '../../src/save/index.js';

const stateAt = (ticks, seed = 3) => { const s = new Sim({ seed }); for (let i = 0; i < ticks; i++) s.step(); return saveGame(s); };
const s10 = stateAt(10), s20 = stateAt(20), s30 = stateAt(30);

/** localStorage mock */
class FakeStorage {
  constructor(limit = Infinity) { this.m = new Map(); this.limit = limit; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    let used = String(v).length;
    for (const [kk, vv] of this.m) if (kk !== k) used += vv.length;
    if (used > this.limit) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, String(v));
  }
  removeItem(k) { this.m.delete(k); }
}

describe('Save game slots', () => {
  it('save, list (newest first), load', async () => {
    const store = new SaveStore(new MemoryBackend());
    expect(await store.list()).toEqual([]);
    expect(await store.latest()).toBe(null);
    const a = await store.save(s10, { name: 'Erster', savedAt: new Date('2026-10-01T10:00:00Z'), thumb: 'data:image/png;base64,AAAA' });
    const b = await store.save(s20, { name: 'Zweiter', savedAt: new Date('2026-10-02T10:00:00Z') });
    expect(a.id).not.toBe(b.id);
    const list = await store.list();
    expect(list.map((e) => e.name)).toEqual(['Zweiter', 'Erster']);
    expect(list[1]).toMatchObject({ tick: 10, mode: 'free', seed: 3, players: 2, thumb: 'data:image/png;base64,AAAA', auto: false });
    expect(list[0].size).toBeGreaterThan(100);
    expect((await store.latest()).id).toBe(b.id);
    const doc = await store.load(a.id);
    expect(doc.state.tick).toBe(10);
    expect(doc.meta.name).toBe('Erster');
  });

  it('overwriting keeps the ID, replaces the content', async () => {
    const store = new SaveStore(new MemoryBackend());
    const a = await store.save(s10, { name: 'Burg' });
    await store.save(s30, { id: a.id, name: 'Burg' });
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: a.id, tick: 30 });
    expect((await store.load(a.id)).state.tick).toBe(30);
  });

  it('renaming affects list and loaded envelope; empty name keeps the old one', async () => {
    const store = new SaveStore(new MemoryBackend());
    const a = await store.save(s10, { name: 'Alt' });
    await store.rename(a.id, '  Neu  ');
    expect((await store.list())[0].name).toBe('Neu');
    expect((await store.load(a.id)).meta.name).toBe('Neu');
    await store.rename(a.id, '   ');
    expect((await store.list())[0].name).toBe('Neu');
    await expect(store.rename('doesnotexist', 'x')).rejects.toMatchObject({ code: 'saves.err.missing' });
  });

  it('deleting removes entry and data', async () => {
    const backend = new MemoryBackend();
    const store = new SaveStore(backend);
    const a = await store.save(s10, { name: 'Weg' });
    const b = await store.save(s20, { name: 'Bleibt' });
    await store.remove(a.id);
    expect((await store.list()).map((e) => e.id)).toEqual([b.id]);
    expect(await backend.get('slot:' + a.id)).toBe(null);
    await expect(store.load(a.id)).rejects.toMatchObject({ code: 'saves.err.missing' });
  });

  it('autosave uses a fixed slot', async () => {
    const store = new SaveStore(new MemoryBackend());
    await store.save(s10, { id: AUTO_ID, name: 'Auto 1' });
    await store.save(s20, { id: AUTO_ID, name: 'Auto 2' });
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: AUTO_ID, auto: true, name: 'Auto 2', tick: 20 });
    expect(autosaveDue(AUTOSAVE_TICKS - 1, 0)).toBe(false);
    expect(autosaveDue(AUTOSAVE_TICKS + 100, 100)).toBe(true);
    expect(AUTOSAVE_TICKS).toBe(1200); // 2 game minutes at 600 ticks
  });

  it('first autosave shortly after start or load, then at a fixed interval', () => {
    for (const start of [0, 5000]) {
      const base = autosaveStart(start);
      expect(autosaveDue(start + AUTOSAVE_FIRST_TICKS - 1, base)).toBe(false);
      expect(autosaveDue(start + AUTOSAVE_FIRST_TICKS, base)).toBe(true);
      expect(AUTOSAVE_FIRST_TICKS).toBe(300); // 30 game seconds
    }
  });

  it('autosave as text without a deep copy: same content, slot loads like a normal save game', async () => {
    const sim = new Sim({ seed: 3 });
    sim.run(40);
    const savedAt = new Date('2026-10-03T10:00:00Z');
    const snap = snapshotText(saveGame(sim, { ais: [] }, { clone: false }), { name: 'Auto', savedAt });
    // same snapshot as with a copy
    expect(snap.text).toBe(JSON.stringify(createSaveDoc(saveGame(sim, { ais: [] }), { name: 'Auto', savedAt })));
    expect(snap.meta).toMatchObject({ name: 'Auto', tick: 40, mode: 'free', seed: 3, players: 2 });
    // continuing afterwards no longer changes the text
    sim.run(5);
    const store = new SaveStore(new MemoryBackend());
    const entry = await store.saveText(snap.text, snap.meta, { id: AUTO_ID, thumb: null });
    expect(entry).toMatchObject({ id: AUTO_ID, auto: true, tick: 40, name: 'Auto', savedAt: savedAt.toISOString() });
    const doc = await store.load(AUTO_ID);
    expect(doc.state.tick).toBe(40);
    expect((await store.latest()).id).toBe(AUTO_ID);
  });

  it('parallel save operations do not lose entries (queue)', async () => {
    const store = new SaveStore(new MemoryBackend());
    await Promise.all([s10, s20, s30].map((s, i) => store.save(s, { name: 'P' + i })));
    expect((await store.list()).map((e) => e.name).sort()).toEqual(['P0', 'P1', 'P2']);
  });

  it('storage full: understandable error, existing saves stay intact', async () => {
    const backend = new MemoryBackend();
    const store = new SaveStore(backend);
    const a = await store.save(s10, { name: 'Passt' });
    backend.limit = [...backend.map.values()].reduce((n, v) => n + v.length, 0) + 5000;
    const big = stateAt(10, 4);
    // random ballast cannot be compressed away
    let x = 1;
    big.extra = { ballast: Array.from({ length: 50000 }, () => ((x = (x * 48271) % 2147483647) % 36).toString(36)).join('') };
    await expect(store.save(big, { name: 'Zu groß' })).rejects.toMatchObject({ name: 'SaveError', code: 'saves.err.quota' });
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual([a.id]);
    expect((await store.load(a.id)).state.tick).toBe(10);
  });

  it('localStorage fallback: compressed, quota error as saves.err.quota', async () => {
    const ls = new FakeStorage();
    const store = new SaveStore(new LocalStorageBackend(ls));
    const a = await store.save(s10, { name: 'LS' });
    const raw = ls.getItem('kronland-saves:slot:' + a.id);
    expect(raw.startsWith('gz:')).toBe(true);
    expect(raw.length).toBeLessThan(JSON.stringify(s10).length / 3);
    ls.limit = 0;
    await expect(store.save(s20, { name: 'full' })).rejects.toMatchObject({ code: 'saves.err.quota' });
    const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() {} };
    expect(LocalStorageBackend.usable(blocked)).toBe(false);
    await expect(new LocalStorageBackend(blocked).set('a', 'b')).rejects.toMatchObject({ code: 'saves.err.storage' });
  });

  it('broken data in a slot: damaged error instead of a crash', async () => {
    const backend = new MemoryBackend();
    const store = new SaveStore(backend);
    const a = await store.save(s10, { name: 'Defekt' });
    await backend.set('slot:' + a.id, 'gz:%%%');
    await expect(store.load(a.id)).rejects.toBeInstanceOf(SaveError);
    await backend.set('index', '{broken');
    expect(await store.list()).toEqual([]);
  });

  it('earlier single save game from localStorage is taken over and removed there', async () => {
    const ls = new FakeStorage();
    ls.setItem(LEGACY_KEY, JSON.stringify(s20));
    const store = new SaveStore(new MemoryBackend());
    const e = await store.migrateLegacy(ls, 'Früherer Spielstand');
    expect(e).toMatchObject({ name: 'Früherer Spielstand', tick: 20 });
    expect(ls.getItem(LEGACY_KEY)).toBe(null);
    expect((await store.load(e.id)).state.tick).toBe(20);
    expect(await store.migrateLegacy(ls)).toBe(null);
    // broken old save is discarded, not retried again and again
    ls.setItem(LEGACY_KEY, '{"broken":');
    expect(await store.migrateLegacy(ls)).toBe(null);
    expect(ls.getItem(LEGACY_KEY)).toBe(null);
  });

  it('imported envelope is stored as a new slot', async () => {
    const store = new SaveStore(new MemoryBackend());
    const doc = createSaveDoc(s30, { name: 'Vom Freund', savedAt: new Date('2025-01-01T00:00:00Z') });
    const e = await store.importDoc(doc);
    expect(e).toMatchObject({ name: 'Vom Freund', savedAt: '2025-01-01T00:00:00.000Z', tick: 30, thumb: null });
  });

  it('overwriting with full storage: old content and list stay (rollback)', async () => {
    const ls = new FakeStorage();
    const store = new SaveStore(new LocalStorageBackend(ls));
    const a = await store.save(s10, { name: 'Alt' });
    const before = ls.getItem('kronland-saves:slot:' + a.id), index = ls.getItem('kronland-saves:index');
    // slot just fits, the list no longer → slot is reset
    let calls = 0;
    const orig = ls.setItem.bind(ls);
    ls.setItem = (k, v) => { if (k.endsWith('index') && ++calls) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } orig(k, v); };
    await expect(store.save(s30, { id: a.id, name: 'Neu' })).rejects.toMatchObject({ code: 'saves.err.quota' });
    expect(calls).toBe(1);
    expect(ls.getItem('kronland-saves:slot:' + a.id)).toBe(before);
    expect(ls.getItem('kronland-saves:index')).toBe(index);
    ls.setItem = orig;
    expect((await store.load(a.id)).state.tick).toBe(10);
  });

  it('two store objects on the same storage (two tabs) do not lose entries', async () => {
    const backend = new MemoryBackend();
    const tabA = new SaveStore(backend), tabB = new SaveStore(backend);
    await Promise.all([tabA.save(s10, { name: 'A' }), tabB.save(s20, { name: 'B' }), tabA.save(s30, { name: 'A2' })]);
    expect((await tabB.list()).map((e) => e.name).sort()).toEqual(['A', 'A2', 'B']);
    const [x] = await tabA.list();
    await Promise.all([tabA.rename(x.id, 'Umbenannt'), tabB.save(s10, { name: 'B2' })]);
    const names = (await tabA.list()).map((e) => e.name);
    expect(names).toContain('Umbenannt');
    expect(names).toContain('B2');
  });

  it('renaming/deleting a missing slot', async () => {
    const backend = new MemoryBackend();
    const store = new SaveStore(backend);
    const a = await store.save(s10, { name: 'Da' });
    await expect(store.rename('doesnotexist', 'x')).rejects.toMatchObject({ code: 'saves.err.missing' });
    expect((await store.list())[0].name).toBe('Da');
    await store.remove(a.id);
    expect(await backend.get('slot:' + a.id)).toBe(null);
    await expect(store.load(a.id)).rejects.toMatchObject({ code: 'saves.err.missing' });
  });

  it('saves from the localStorage fallback store are taken over (newer wins)', async () => {
    const ls = new FakeStorage();
    const fallback = new SaveStore(new LocalStorageBackend(ls));
    const x = await fallback.save(s20, { name: 'Aus LS', savedAt: new Date('2026-10-03T10:00:00Z') });
    await fallback.save(s10, { id: AUTO_ID, name: 'Auto alt', savedAt: new Date('2026-10-01T10:00:00Z') });
    const store = new SaveStore(new MemoryBackend());
    await store.save(s30, { id: AUTO_ID, name: 'Auto neu', savedAt: new Date('2026-10-02T10:00:00Z') });
    expect(await store.adoptFrom(new LocalStorageBackend(ls))).toBe(1);
    const list = await store.list();
    expect(list.map((e) => e.name)).toEqual(['Aus LS', 'Auto neu']);
    expect((await store.load(x.id)).state.tick).toBe(20);
    expect([...ls.m.keys()]).toEqual([]);
    expect(await store.adoptFrom(new LocalStorageBackend(ls))).toBe(0);
  });
});
