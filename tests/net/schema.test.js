// The minimal validator and the contract: schemas accept the fixtures and reject typical mistakes.
import { describe, it, expect } from 'vitest';
import { validate, validateDef } from '../../src/net/schema.js';
import { fixJson, schemaOf, packFiles, fix } from './helpers.js';

describe('validate()', () => {
  it('types, required, additionalProperties, patterns, enum, bounds', () => {
    const s = {
      type: 'object', required: ['a'], additionalProperties: false,
      properties: { a: { type: 'integer', minimum: 1, maximum: 3 }, b: { type: 'string', pattern: '^x+$', maxLength: 3 }, c: { enum: ['u', 'v'] }, d: { type: 'array', items: { type: 'string' }, maxItems: 1 } },
    };
    expect(validate(s, { a: 2, b: 'xx', c: 'u', d: ['q'] })).toEqual([]);
    expect(validate(s, {}).map((i) => i.path)).toEqual(['/a']);
    expect(validate(s, { a: 1.5 })[0]).toMatchObject({ path: '/a', keyword: 'type' });
    expect(validate(s, { a: 4 })[0].keyword).toBe('maximum');
    expect(validate(s, { a: 1, b: 'y' })[0].keyword).toBe('pattern');
    expect(validate(s, { a: 1, z: 1 })[0]).toMatchObject({ path: '/z', keyword: 'additionalProperties' });
    expect(validate(s, { a: 1, c: 'w' })[0].keyword).toBe('enum');
    expect(validate(s, { a: 1, d: ['p', 'q'] })[0].keyword).toBe('maxItems');
  });

  it('paths are JSON pointers with escaped keys', () => {
    const s = { type: 'object', patternProperties: { '^a/b$': { type: 'number' } } };
    expect(validate(s, { 'a/b': 'x' })[0].path).toBe('/a~1b');
  });

  it('anyOf, oneOf, const and local $ref', () => {
    const s = { $defs: { id: { type: 'string', minLength: 2 } }, type: 'object', properties: { x: { $ref: '#/$defs/id' }, k: { const: 7 }, y: { anyOf: [{ type: 'string' }, { type: 'null' }] }, z: { oneOf: [{ type: 'integer' }, { type: 'number' }] } } };
    expect(validate(s, { x: 'ab', k: 7, y: null })).toEqual([]);
    expect(validate(s, { x: 'a' })[0].path).toBe('/x');
    expect(validate(s, { k: 8 })[0].keyword).toBe('const');
    expect(validate(s, { y: 3 })[0].keyword).toBe('anyOf');
    expect(validate(s, { z: 1 })[0].keyword).toBe('oneOf'); // 1 is both integer and number
  });

  it('rejects NaN and non-finite numbers as numbers', () => {
    expect(validate({ type: 'number' }, NaN).length).toBe(1);
  });
});

describe('contract fixtures', () => {
  it('catalogs and the player list', () => {
    for (const f of ['catalog-static.json', 'catalog-server.json', 'packs-me.json']) expect(validate(schemaOf('catalog'), fixJson(f)), f).toEqual([]);
  });

  it('server catalog has a locked pack with a link and open packs with a manifest', () => {
    const packs = fixJson('catalog-server.json').packs;
    expect(packs.some((p) => p.access === 'locked' && p.link)).toBe(true);
    expect(packs.some((p) => p.access === 'open' && p.manifest)).toBe(true);
    expect(fixJson('packs-me.json').packs.some((p) => p.own)).toBe(true);
  });

  it('example pack: manifest valid, every file is named after its SHA-256', async () => {
    const { createHash } = await import('node:crypto');
    const pack = fixJson('pack-adventures-2/pack.json');
    expect(validate(schemaOf('pack'), pack)).toEqual([]);
    expect(pack.levels).toHaveLength(5);
    const names = packFiles().filter((n) => n !== 'pack.json');
    expect(names.sort()).toEqual([...pack.levels.map((l) => l.file), ...Object.keys(pack.media)].sort());
    for (const n of names) expect(createHash('sha256').update(fix(`pack-adventures-2/${n}`)).digest('hex')).toBe(n.replace(/\.\w+$/, ''));
    for (const l of pack.levels) expect(validate(schemaOf('scenario'), JSON.parse(fix(`pack-adventures-2/${l.file}`)))).toEqual([]);
  });

  it('catalog entry knows the SHA-256 of pack.json', async () => {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(fix('pack-adventures-2/pack.json')).digest('hex');
    for (const f of ['catalog-static.json', 'catalog-server.json', 'packs-me.json']) expect(fixJson(f).packs.find((p) => p.id === 'wi7.adventures-2').sha256, f).toBe(hash);
  });

  it('me, saves, own pack document and errors', () => {
    expect(validate(schemaOf('me'), fixJson('me.json'))).toEqual([]);
    expect(validate(schemaOf('saves'), fixJson('saves.json'))).toEqual([]);
    expect(validate(schemaOf('pack-document'), fixJson('pack-document.json'))).toEqual([]);
    for (const f of ['errors/packs-err-schema.json', 'errors/auth-err-invalid.json', 'errors/saves-err-conflict.json', 'errors/packs-err-notFound.json']) expect(validate(schemaOf('error'), fixJson(f)), f).toEqual([]);
    expect(validate(schemaOf('config'), { format: 'kronland-config', version: 1, server: 'https://api.kronland.example', sources: ['https://beispiel.github.io/kronland-level/catalog.json'] })).toEqual([]);
  });

  it('schemas reject typical mistakes', () => {
    const catalog = fixJson('catalog-server.json');
    catalog.packs[1].link = undefined; // locked without link
    expect(validate(schemaOf('catalog'), catalog)[0].path).toMatch(/^\/packs\/1/);
    const pack = fixJson('pack-adventures-2/pack.json');
    pack.levels[0].file = 'level.json';
    expect(validate(schemaOf('pack'), pack)[0].path).toBe('/levels/0/file');
    expect(validate(schemaOf('progress'), { events: [{ id: 'x', at: 'now', pack: 'a', level: 'b', type: 'dance' }] }).length).toBeGreaterThan(2);
    expect(validate(schemaOf('error'), { error: { params: {} } })[0].path).toBe('/error/code');
    expect(validateDef(schemaOf('saves'), 'entry', { id: 'a/b' }).length).toBeGreaterThan(0);
  });

  it('VERSION and openapi.yaml exist and describe the game API', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(new URL('../../contract/VERSION', import.meta.url), 'utf8').trim()).toMatch(/^\d+\.\d+\.\d+$/);
    const yaml = readFileSync(new URL('../../contract/openapi.yaml', import.meta.url), 'utf8');
    const paths = [...yaml.matchAll(/^ {2}(\/[^\s:]*):$/gm)].map((m) => m[1]);
    expect(paths).toEqual(expect.arrayContaining(['/api/v1/me', '/api/v1/packs', '/api/v1/packs/{id}', '/api/v1/packs/{id}/media', '/api/v1/packs/{id}/manifest', '/api/v1/saves', '/api/v1/saves/{id}', '/api/v1/progress', '/oauth/authorize', '/oauth/token', '/broadcasting/auth']));
    expect(yaml).toContain(`version: ${readFileSync(new URL('../../contract/VERSION', import.meta.url), 'utf8').trim()}`);
  });
});
