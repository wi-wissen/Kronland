import { describe, it, expect } from 'vitest';
import { parseConfig, loadConfig, cleanSourceUrl, sourceParam, configOverride, addPlayerSource, removePlayerSource, loadPlayerSources, sourceList } from '../../src/net/config.js';
import { NetError } from '../../src/net/errors.js';
import { FakeStorage } from './helpers.js';

const cfg = (extra = {}) => ({ format: 'kronland-config', version: 1, ...extra });
const respond = (body, status = 200) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('kronland.config.json', () => {
  it('stage 0: no server, no sources', () => {
    expect(parseConfig(cfg())).toEqual({ server: null, sources: [] });
  });

  it('server and sources', () => {
    const c = parseConfig(cfg({ server: 'https://api.kronland.example', sources: ['https://a.example/catalog.json', 'https://a.example/catalog.json'] }));
    expect(c).toEqual({ server: 'https://api.kronland.example', sources: ['https://a.example/catalog.json'] });
  });

  it('wrong format, bad address and newer version are errors with codes', () => {
    expect(() => parseConfig({ format: 'x', version: 1 })).toThrow(NetError);
    expect(() => parseConfig(cfg({ server: 'ftp://x' }))).toThrow(/packs.err.config/);
    expect(() => parseConfig(cfg({ sources: 'a' }))).toThrow(/packs.err.config/);
    try { parseConfig(cfg({ version: 2 })); } catch (e) { expect(e.code).toBe('packs.err.newer'); expect(e.params.what).toBe('config'); }
  });

  it('loadConfig: network first, remembers the file, offline uses the copy', async () => {
    const storage = new FakeStorage();
    expect(await loadConfig({ fetch: respond(cfg({ server: 'https://s.example' })), storage })).toEqual({ server: 'https://s.example', sources: [] });
    const offline = async () => { throw new TypeError('offline'); };
    expect(await loadConfig({ fetch: offline, storage })).toEqual({ server: 'https://s.example', sources: [] });
  });

  it('loadConfig never throws: missing, broken or unreachable = stage 0', async () => {
    const empty = { server: null, sources: [] };
    expect(await loadConfig({ fetch: respond('', 404), storage: new FakeStorage() })).toEqual(empty);
    expect(await loadConfig({ fetch: respond('{nope'), storage: new FakeStorage() })).toEqual(empty);
    expect(await loadConfig({ fetch: respond({ format: 'other' }), storage: new FakeStorage() })).toEqual(empty);
    expect(await loadConfig({ fetch: async () => { throw new TypeError('x'); }, storage: new FakeStorage() })).toEqual(empty);
  });

  it('the template kronland.config.example.json is stage 0', async () => {
    const { readFileSync } = await import('node:fs');
    const c = parseConfig(JSON.parse(readFileSync(new URL('../../kronland.config.example.json', import.meta.url), 'utf8')));
    expect(c.server).toBeNull();
    expect(c.sources).toEqual([]);
  });
});

describe('source addresses', () => {
  it('https only (http for localhost), folder gets catalog.json, no fragment', () => {
    expect(cleanSourceUrl('https://x.example/levels/')).toBe('https://x.example/levels/catalog.json');
    expect(cleanSourceUrl('https://x.example/c.json#top')).toBe('https://x.example/c.json');
    expect(cleanSourceUrl('http://localhost:4400/catalog.json')).toBe('http://localhost:4400/catalog.json');
    expect(cleanSourceUrl('http://evil.example/catalog.json')).toBeNull();
    expect(cleanSourceUrl('javascript:alert(1)')).toBeNull();
    expect(cleanSourceUrl('   ')).toBeNull();
    expect(cleanSourceUrl('https://x.example/' + 'a'.repeat(600))).toBeNull();
  });

  it('?source= and ?config= (config only on localhost)', () => {
    expect(sourceParam('?source=https%3A%2F%2Fx.example%2F')).toBe('https://x.example/catalog.json');
    expect(sourceParam('?seed=4')).toBeNull();
    expect(sourceParam('?source=http://evil.example/c.json')).toBeNull();
    expect(configOverride('?config=http://localhost:4400/kronland.config.json', 'localhost')).toBe('http://localhost:4400/kronland.config.json');
    expect(configOverride('?config=http://localhost:4400/kronland.config.json', 'kronland.wi7.net')).toBeNull();
  });

  it('player sources: add, duplicate, remove, limit; order server > file > player', () => {
    const storage = new FakeStorage();
    const config = { server: 'https://api.example', sources: ['https://a.example/catalog.json'] };
    expect(addPlayerSource('https://b.example/', config, storage)).toBe('https://b.example/catalog.json');
    expect(() => addPlayerSource('https://b.example/catalog.json', config, storage)).toThrow(/sourceKnown/);
    expect(() => addPlayerSource('https://a.example/catalog.json', config, storage)).toThrow(/sourceKnown/);
    expect(() => addPlayerSource('nope', config, storage)).toThrow(/packs.err.source/);
    expect(sourceList(config, loadPlayerSources(storage))).toEqual([
      { url: 'https://api.example/catalog.json', kind: 'server' },
      { url: 'https://a.example/catalog.json', kind: 'config' },
      { url: 'https://b.example/catalog.json', kind: 'player' },
    ]);
    removePlayerSource('https://b.example/catalog.json', storage);
    expect(loadPlayerSources(storage)).toEqual([]);
    for (let i = 0; i < 20; i++) addPlayerSource(`https://p${i}.example/`, config, storage);
    expect(() => addPlayerSource('https://one-more.example/', config, storage)).toThrow(/sourceMax/);
  });

  it('broken storage content is ignored', () => {
    const s = new FakeStorage();
    s.setItem('kronland-sources', '{"a":1}');
    expect(loadPlayerSources(s)).toEqual([]);
    s.setItem('kronland-sources', 'garbage');
    expect(loadPlayerSources(s)).toEqual([]);
  });
});
