// Cloud saves: the normal SaveStore on top of the server (mock), with ETag conflicts and the ?save= link.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startMockServer } from '../../scripts/mock-server.mjs';
import { createCloudStore, CloudBackend, openSaveUrl } from '../../src/net/cloudSaves.js';
import { SaveError } from '../../src/save/format.js';
import { Sim } from '../../src/sim/sim.js';
import { saveGame } from '../../src/sim/serialize.js';
import { signIn } from './helpers.js';

let mock, session;
beforeAll(async () => { mock = await startMockServer(); session = await signIn(mock.url); });
afterAll(() => mock.close());
beforeEach(async () => { await fetch(`${mock.url}/mock/reset`, { method: 'POST' }); });

const state = (seed = 5) => { const s = new Sim({ seed }); for (let i = 0; i < 5; i++) s.step(); return saveGame(s); };

describe('SaveStore on the server', () => {
  it('lists the server saves, newest first', async () => {
    const store = createCloudStore(session.api);
    const list = await store.list();
    expect(list.map((e) => e.id)).toEqual(['s2', 's1']);
    expect(store.kind).toBe('cloud');
  });

  it('save, list, load, rename, delete round trip', async () => {
    const store = createCloudStore(session.api);
    const entry = await store.save(state(), { name: 'Cloud Test', thumb: 'data:image/png;base64,AAAA' });
    const list = await store.list();
    expect(list[0]).toMatchObject({ id: entry.id, name: 'Cloud Test', thumb: 'data:image/png;base64,AAAA', mode: 'free', seed: 5 });
    const doc = await store.load(entry.id);
    expect(doc.meta.name).toBe('Cloud Test');
    expect(doc.state.seed).toBe(5);

    await store.rename(entry.id, 'Umbenannt');
    expect((await store.list())[0]).toMatchObject({ name: 'Umbenannt', thumb: 'data:image/png;base64,AAAA' }); // thumbnail kept
    expect((await store.load(entry.id)).meta.name).toBe('Umbenannt');

    await store.remove(entry.id);
    expect((await store.list()).map((e) => e.id)).not.toContain(entry.id);
  });

  it('overwriting a save the player has not seen in its newest state is a conflict', async () => {
    const a = createCloudStore(session.api);
    const b = createCloudStore(session.api);
    const entry = await a.save(state(), { name: 'Shared' });
    await b.list(); // device B sees version 1
    await a.save(state(6), { id: entry.id, name: 'Shared' }); // device A overwrites: version 2
    await expect(b.save(state(7), { id: entry.id, name: 'Shared' })).rejects.toMatchObject({ code: 'saves.err.conflict' });
    await b.list(); // B looks again ...
    await b.save(state(7), { id: entry.id, name: 'Shared' }); // ... and may overwrite
    expect((await b.load(entry.id)).state.seed).toBe(7);
  });

  it('server errors become save errors the dialog knows', async () => {
    const backend = new CloudBackend(session.api);
    await expect(backend.write('x', JSON.stringify({ not: 'a save' }), null)).rejects.toBeInstanceOf(SaveError);
    await fetch(`${mock.url}/mock/revoke`, { method: 'POST' });
    const offline = new CloudBackend({ ...session.api, get: async () => { const { NetError } = await import('../../src/net/errors.js'); throw new NetError('net.err.offline'); } });
    const store = createCloudStore({ get: offline.api.get, server: mock.url });
    expect(await store.list()).toEqual([]);
    expect(store.backend.lastError).toMatchObject({ code: 'saves.err.offline' });
  });
});

describe('?save=<url>', () => {
  it('own save opens normally, a foreign one (signed link) read-only', async () => {
    const { id } = await createCloudStore(session.api).save(state(), { name: 'Link test' });
    const own = await openSaveUrl(`${mock.url}/api/v1/saves/${id}`, { api: session.api, signedIn: true });
    expect(own.readOnly).toBe(false);
    expect(own.doc.meta.name).toBe('Link test');
    const { url } = await (await fetch(`${mock.url}/mock/signed/${id}`)).json();
    const foreign = await openSaveUrl(url, { api: createCloudAnon(), signedIn: false });
    expect(foreign.readOnly).toBe(true);
    expect(foreign.doc.format).toBe('kronland-save');
    // a signed-in player who does not own it (id not in the list) is read-only as well
    await session.api.del(`/api/v1/saves/${id}`);
    mock.state.saves.set(id, { entry: { id }, envelope: own.doc, etag: 1 });
    const hidden = { ...session.api, get: async () => ({ saves: [] }) };
    expect((await openSaveUrl(url, { api: hidden, signedIn: true })).readOnly).toBe(true);
  });

  it('addresses of other servers and other paths are refused', async () => {
    await expect(openSaveUrl('https://evil.example/api/v1/saves/s1', { api: session.api, signedIn: true })).rejects.toMatchObject({ code: 'saves.err.foreignHost' });
    await expect(openSaveUrl(`${mock.url}/catalog.json`, { api: session.api, signedIn: true })).rejects.toMatchObject({ code: 'saves.err.foreignHost' });
    await expect(openSaveUrl('nonsense', { api: session.api, signedIn: true })).rejects.toBeInstanceOf(SaveError);
  });

  it('a bad signature is an error', async () => {
    const { url } = await (await fetch(`${mock.url}/mock/signed/s1`)).json();
    await expect(openSaveUrl(url.replace(/signature=\w+/, 'signature=bad'), { api: createCloudAnon(), signedIn: false })).rejects.toBeInstanceOf(SaveError);
  });
});

function createCloudAnon() {
  return { server: mock.url, send: (m, u) => fetch(u, { method: m }), get: async () => { throw new Error('no token'); } };
}
