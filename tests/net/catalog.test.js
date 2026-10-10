import { describe, it, expect, vi } from 'vitest';
import { parseCatalog, loadCatalog, mergeCatalogs, loadAll } from '../../src/net/catalog.js';
import { fixJson, fixtureFetch, ORIGIN } from './helpers.js';

describe('catalog', () => {
  it('relative addresses refer to the catalog', () => {
    const c = parseCatalog(fixJson('catalog-static.json'), `${ORIGIN}/levels/catalog.json`);
    expect(c.packs[0].manifest).toBe(`${ORIGIN}/levels/pack-adventures-2/pack.json`);
    expect(c.packs[0].preview).toMatch(new RegExp(`^${ORIGIN}/levels/pack-adventures-2/[0-9a-f]{64}\\.png$`));
    expect(c.name.en).toMatch(/example/);
  });

  it('locked packs keep their link and have no manifest', () => {
    const c = parseCatalog(fixJson('catalog-server.json'), `${ORIGIN}/catalog.json`);
    const locked = c.packs.find((p) => p.access === 'locked');
    expect(locked.link).toBe('https://api.kronland.example/packs/wi7.python-pro');
    expect(locked.manifest).toBeUndefined();
  });

  it('drops single broken entries but rejects a broken frame', () => {
    const json = fixJson('catalog-server.json');
    json.packs.push({ id: 'Bad Id', title: { de: 'x', en: 'x' }, access: 'open', manifest: 'x' });
    const c = parseCatalog(json, `${ORIGIN}/catalog.json`);
    expect(c.packs).toHaveLength(2);
    expect(c.dropped).toBe(1);
    expect(() => parseCatalog({ format: 'kronland-catalog', version: 1 }, ORIGIN)).toThrow(/packs.err.catalog/);
    expect(() => parseCatalog({ format: 'nope' }, ORIGIN)).toThrow(/packs.err.catalog/);
  });

  it('newer and older formats have their own codes', () => {
    expect(() => parseCatalog({ format: 'kronland-catalog', version: 2, packs: [] }, ORIGIN)).toThrow(/packs.err.newer/);
    expect(() => parseCatalog({ format: 'kronland-catalog', version: 0, packs: [] }, ORIGIN)).toThrow(/packs.err.outdated/);
  });

  it('loadCatalog: network and not-found errors', async () => {
    const f = fixtureFetch();
    expect((await loadCatalog(`${ORIGIN}/catalog.json`, f)).packs).toHaveLength(1);
    await expect(loadCatalog(`${ORIGIN}/missing.json`, f)).rejects.toMatchObject({ code: 'packs.err.notFound' });
    f.state.down = true;
    await expect(loadCatalog(`${ORIGIN}/catalog.json`, f)).rejects.toMatchObject({ code: 'packs.err.network' });
  });

  it('merge: first source wins on the same id, origin is recorded', () => {
    const entry = (id, title) => ({ id, title: { de: title, en: title }, access: 'open', manifest: `https://x/${id}` });
    const merged = mergeCatalogs([
      { source: { url: 'https://server/catalog.json', kind: 'server' }, name: { de: 'S', en: 'S' }, packs: [entry('a', 'from server'), entry('b', 'b')] },
      { source: { url: 'https://other/catalog.json', kind: 'config' }, name: null, packs: [entry('a', 'from other'), entry('c', 'c')] },
    ]);
    expect(merged.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(merged[0].title.en).toBe('from server');
    expect(merged[0].origin).toEqual({ url: 'https://server/catalog.json', kind: 'server', name: { de: 'S', en: 'S' } });
    expect(merged[2].origin.kind).toBe('config');
  });

  it('loadAll: unreachable and broken sources are reported, the rest still loads', async () => {
    const f = fixtureFetch({ '/broken.json': '{nope' });
    const sources = [
      { url: `${ORIGIN}/catalog.json`, kind: 'config' },
      { url: `${ORIGIN}/broken.json`, kind: 'player' },
      { url: `${ORIGIN}/missing.json`, kind: 'player' },
    ];
    const r = await loadAll({ sources, fetch: f });
    expect(r.packs.map((p) => p.id)).toEqual(['wi7.adventures-2']);
    expect(r.errors.map((e) => [e.source.split('/').pop(), e.error.code])).toEqual(expect.arrayContaining([['broken.json', 'packs.err.catalog'], ['missing.json', 'packs.err.notFound']]));
  });

  it('loadAll: the signed-in list comes first and replaces the public entry of the same id', async () => {
    const mine = parseCatalog(fixJson('packs-me.json'), `${ORIGIN}/`);
    const server = parseCatalog(fixJson('catalog-server.json'), `${ORIGIN}/catalog.json`);
    const f = vi.fn(async () => new Response(JSON.stringify(fixJson('catalog-server.json'))));
    const r = await loadAll({ sources: [{ url: `${ORIGIN}/catalog.json`, kind: 'server' }], fetch: f, first: [{ source: { url: 'me', kind: 'server' }, name: null, packs: mine.packs }] });
    expect(r.packs.map((p) => p.id)).toEqual(['wi7.adventures-2', 'wi7.python-pro', 'k7m2q9']);
    expect(r.packs.find((p) => p.id === 'k7m2q9').own).toBe(true);
    expect(r.packs[0].origin.url).toBe('me');
    expect(server.packs.length).toBe(2);
  });
});
