import { describe, it, expect } from 'vitest';
import { loadPack, parseManifest, compareVersions, clientOk, filesBase, sha256Hex, levelPackage, levelDefs } from '../../src/net/packs.js';
import { memoryKv } from '../../src/net/kv.js';
import { fixJson, fix, fixtureFetch, ORIGIN, packFiles } from './helpers.js';
import { version as GAME } from '../../package.json';

const entry = (extra = {}) => ({ id: 'wi7.adventures-2', access: 'open', manifest: `${ORIGIN}/pack-adventures-2/pack.json`, sha256: fixJson('catalog-static.json').packs[0].sha256, ...extra });
const text = (o) => JSON.stringify(o);

describe('versions', () => {
  it('compareVersions / clientOk against the game version', () => {
    expect(compareVersions('1.4.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(clientOk(undefined)).toBe(true);
    expect(clientOk('0.0.1')).toBe(true);
    expect(clientOk('999.0.0')).toBe(false);
    expect(clientOk(GAME)).toBe(true);
  });

  it('filesBase: next to pack.json, or files/ for the manifest endpoint', () => {
    expect(filesBase('https://x.example/a/pack.json?x=1')).toBe('https://x.example/a/');
    expect(filesBase('https://api.example/api/v1/packs/k7m2q9/manifest')).toBe('https://api.example/api/v1/packs/k7m2q9/files/');
  });
});

describe('parseManifest', () => {
  it('accepts the example', () => {
    expect(parseManifest(fix('pack-adventures-2/pack.json').toString(), { id: 'wi7.adventures-2' }).levels).toHaveLength(5);
  });

  it('errors have packs.err.* codes and a JSON path', () => {
    const base = fixJson('pack-adventures-2/pack.json');
    const code = (o, opts) => { try { parseManifest(text(o), opts); } catch (e) { return [e.code, e.params.path]; } return null; };
    expect(code({ ...base, levels: [{ id: 'x', file: 'x' }] })).toEqual(['packs.err.schema', '/levels/0/file']);
    expect(code({ ...base, format: 'other' })).toEqual(['packs.err.schema', '/format']);
    expect(code({ ...base, version: 2 })[0]).toBe('packs.err.newer');
    expect(code({ ...base, version: 0 })[0]).toBe('packs.err.outdated');
    expect(code({ ...base, id: 'other' }, { id: 'wi7.adventures-2' })).toEqual(['packs.err.schema', '/id']);
    expect(code({ ...base, preview: '0'.repeat(64) + '.png' })).toEqual(['packs.err.schema', '/preview']);
    expect(code({ ...base, minClient: '99.0.0' })[0]).toBe('packs.err.minClient');
    expect(code('not an object')[0]).toBe('packs.err.schema');
    try { parseManifest('{nope'); } catch (e) { expect(e.code).toBe('packs.err.schema'); }
  });

  it('license is optional', () => {
    const base = fixJson('pack-adventures-2/pack.json');
    delete base.license;
    expect(() => parseManifest(text(base))).not.toThrow();
  });
});

describe('loadPack', () => {
  it('loads the example, verifies everything, resolves media for the level package', async () => {
    const f = fixtureFetch();
    const pack = await loadPack(entry(), { fetch: f });
    expect(pack.id).toBe('wi7.adventures-2');
    expect(pack.hash).toBe(entry().sha256);
    expect(pack.levels.map((l) => l.id)).toEqual(fixJson('pack-adventures-2/pack.json').levels.map((l) => l.id));
    expect(pack.offline).toBe(false);
    const portrait = pack.levels[0].scenario.speakers.nelia.portrait;
    expect(pack.media.get(portrait)).toBeInstanceOf(Blob);
    const pkg = levelPackage(pack, pack.levels[1].id);
    expect(pkg.scenario.id).toBe(pack.levels[1].id);
    expect(pkg.pack).toEqual({ id: 'wi7.adventures-2', hash: pack.hash, level: pack.levels[1].id });
    expect(levelPackage(pack, 'nope')).toBeNull();
    // the game turns the scenarios into mission definitions
    const defs = levelDefs(pack);
    expect(defs).toHaveLength(5);
    expect(defs[0].id).toBe(pack.levels[0].id);
  });

  it('a changed level file is caught by its name (hash)', async () => {
    const pack = fixJson('pack-adventures-2/pack.json');
    const name = pack.levels[0].file;
    const tampered = Buffer.from(fix(`pack-adventures-2/${name}`).toString().replace('"adventure"', '"mission"'));
    const f = fixtureFetch({ [`/pack-adventures-2/${name}`]: tampered });
    await expect(loadPack(entry(), { fetch: f })).rejects.toMatchObject({ code: 'packs.err.hash', params: { file: name } });
  });

  it('a changed media file and a changed manifest are caught', async () => {
    const pack = fixJson('pack-adventures-2/pack.json');
    const media = Object.keys(pack.media)[0];
    await expect(loadPack(entry(), { fetch: fixtureFetch({ [`/pack-adventures-2/${media}`]: Buffer.from('x') }) })).rejects.toMatchObject({ code: 'packs.err.hash' });
    const changed = { ...pack, author: 'someone else' };
    await expect(loadPack(entry(), { fetch: fixtureFetch({ '/pack-adventures-2/pack.json': text(changed) }) })).rejects.toMatchObject({ code: 'packs.err.hash', params: { file: 'pack.json' } });
  });

  it('minClient: from the catalog entry (before any download) and from the manifest', async () => {
    const f = fixtureFetch();
    await expect(loadPack(entry({ minClient: '99.0.0' }), { fetch: f })).rejects.toMatchObject({ code: 'packs.err.minClient', params: { need: '99.0.0' } });
    expect(f.calls).toHaveLength(0);
    const pack = { ...fixJson('pack-adventures-2/pack.json'), minClient: '99.0.0' };
    await expect(loadPack(entry({ sha256: undefined }), { fetch: fixtureFetch({ '/pack-adventures-2/pack.json': text(pack) }) })).rejects.toMatchObject({ code: 'packs.err.minClient' });
  });

  it('a level that fails the scenario check reports its path', async () => {
    const pack = fixJson('pack-adventures-2/pack.json');
    const bad = JSON.stringify({ ...JSON.parse(fix(`pack-adventures-2/${pack.levels[0].file}`)), players: [] });
    const name = `${await sha256Hex(bad)}.json`;
    pack.levels[0].file = name;
    const f = fixtureFetch({ '/pack-adventures-2/pack.json': text(pack), [`/pack-adventures-2/${name}`]: bad });
    await expect(loadPack(entry({ sha256: undefined }), { fetch: f })).rejects.toMatchObject({ code: 'packs.err.schema', params: { path: '/levels/0' } });
  });

  it('size limits and missing files', async () => {
    const pack = fixJson('pack-adventures-2/pack.json');
    const name = pack.levels[0].file;
    await expect(loadPack(entry(), { fetch: fixtureFetch({ [`/pack-adventures-2/${name}`]: Buffer.alloc(2_000_001) }) })).rejects.toMatchObject({ code: 'packs.err.size' });
    await expect(loadPack(entry(), { fetch: fixtureFetch({ [`/pack-adventures-2/${name}`]: new Response('', { status: 404 }) }) })).rejects.toMatchObject({ code: 'packs.err.notFound' });
  });

  it('locked packs are not loaded', async () => {
    await expect(loadPack({ id: 'x', access: 'locked', link: 'https://x' }, { fetch: fixtureFetch() })).rejects.toMatchObject({ code: 'packs.err.locked' });
  });

  it('cache: files are fetched once, the pack plays offline afterwards', async () => {
    const cache = memoryKv();
    const f = fixtureFetch();
    await loadPack(entry(), { fetch: f, cache });
    const first = f.calls.length;
    expect(first).toBe(1 + packFiles().length - 1);
    const again = await loadPack(entry(), { fetch: f, cache });
    expect(f.calls.length).toBe(first + 1); // only pack.json asked again
    expect(again.offline).toBe(false);
    f.state.down = true;
    const off = await loadPack(entry(), { fetch: f, cache });
    expect(off.offline).toBe(true);
    expect(off.levels).toHaveLength(5);
    expect(off.hash).toBe(entry().sha256);
    // never loaded before and offline: a network error
    await expect(loadPack(entry({ id: 'other', manifest: `${ORIGIN}/other/pack.json` }), { fetch: f, cache })).rejects.toMatchObject({ code: 'packs.err.network' });
  });

  it('the generated example is up to date (node contract/build-fixtures.mjs)', async () => {
    const { buildPack } = await import('../../contract/build-fixtures.mjs');
    const built = buildPack();
    expect(built.manifest).toBe(fix('pack-adventures-2/pack.json').toString());
    for (const [name, data] of built.files) expect(Buffer.from(data).equals(fix(`pack-adventures-2/${name}`)), name).toBe(true);
  });
});
