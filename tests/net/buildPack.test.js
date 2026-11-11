// Building packs: levels and files become hash-named pack files that load like any pack; the CLI writes a static source.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPackFiles, hashMedia, bothLanguages } from '../../src/net/packBuild.js';
import { loadPack, sha256Hex } from '../../src/net/packs.js';
import { writeLevelZip } from '../../src/levels/package.js';
import { emptyScenario } from '../../src/sim/scripting/scenario.js';
import { validate } from '../../src/net/schema.js';
import { schemaOf } from './helpers.js';

const png = () => new Blob([Uint8Array.from([137, 80, 78, 71, 9, 8, 7])], { type: 'image/png' });
const level = (id) => { const s = emptyScenario({ id }); s.speakers = { guide: { name: 'G', portrait: 'assets/guide.png' } }; return s; };

describe('buildPackFiles', () => {
  it('hash-named files, valid manifest, preview from the first image', async () => {
    const info = { id: 'test.pack', title: 'Nur Deutsch', author: 'me', license: 'CC0-1.0' };
    const { manifest, hash, files, pack } = await buildPackFiles(info, [{ scenario: level('l-one'), files: new Map([['assets/guide.png', png()], ['assets/unused.png', png()]]) }, { scenario: level('l-two') }]);
    expect(validate(schemaOf('pack'), pack)).toEqual([]);
    expect(pack.title).toEqual({ de: 'Nur Deutsch', en: 'Nur Deutsch' });
    expect(pack.levels.map((l) => l.id)).toEqual(['l-one', 'l-two']);
    expect(pack.preview).toMatch(/^[0-9a-f]{64}\.png$/);
    expect(Object.keys(pack.media)).toHaveLength(1);
    expect(hash).toBe(await sha256Hex(manifest));
    for (const [name, data] of files) expect(await sha256Hex(data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data)).toBe(name.replace(/\.\w+$/, ''));
  });

  it('loadPack accepts what was built', async () => {
    const { manifest, hash, files } = await buildPackFiles({ id: 'test.pack', title: { de: 'A', en: 'B' } }, [{ scenario: level('l-one'), files: new Map([['assets/guide.png', png()]]) }]);
    const f = async (url) => {
      const name = new URL(url).pathname.split('/').pop();
      const data = name === 'pack.json' ? manifest : files.get(name);
      if (data === undefined) return new Response('', { status: 404 });
      return new Response(data instanceof Blob ? await data.arrayBuffer() : data);
    };
    const pack = await loadPack({ id: 'test.pack', access: 'open', manifest: 'https://x.example/p/pack.json', sha256: hash }, { fetch: f });
    expect(pack.levels[0].id).toBe('l-one');
    expect(pack.media.size).toBe(1);
  });

  it('texts and media helpers', async () => {
    expect(bothLanguages({ en: 'x' })).toEqual({ de: 'x', en: 'x' });
    expect(bothLanguages(undefined, 'fallback')).toEqual({ de: 'fallback', en: 'fallback' });
    const r = await hashMedia(level('a'), new Map([['assets/guide.png', png()]]));
    expect(JSON.stringify(r.scenario)).not.toContain('assets/guide.png');
  });
});

describe('scripts/build-pack.mjs', () => {
  it('writes pack files and the catalog of a static source', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kpack-'));
    const zip = join(dir, 'level.zip');
    writeFileSync(zip, await writeLevelZip(level('zip-level'), new Map([['assets/guide.png', png()]])));
    const run = (id) => execFileSync('node', ['scripts/build-pack.mjs', '--id', id, '--title', 'Titel|Title', '--out', join(dir, 'site'), zip], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
    run('test.first');
    run('test.second');
    run('test.first'); // again: replaced, not duplicated
    const catalog = JSON.parse(readFileSync(join(dir, 'site', 'catalog.json'), 'utf8'));
    expect(catalog.packs.map((p) => p.id)).toEqual(['test.second', 'test.first']);
    expect(validate(schemaOf('catalog'), catalog)).toEqual([]);
    const entry = catalog.packs.find((p) => p.id === 'test.first');
    const manifest = readFileSync(join(dir, 'site', entry.manifest), 'utf8');
    expect(await sha256Hex(manifest)).toBe(entry.sha256);
    expect(readdirSync(join(dir, 'site', 'packs', 'test.first')).length).toBe(3); // pack.json, level, image
  });
});
