// "Save to server" of the world editor: media get hash names, the level's references follow, the pack plays back.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockServer } from '../../scripts/mock-server.mjs';
import { buildDocument, saveToServer, loadOwnPack, newPackId } from '../../src/net/serverPacks.js';
import { loadPack, sha256Hex } from '../../src/net/packs.js';
import { parseCatalog } from '../../src/net/catalog.js';
import { memoryKv } from '../../src/net/kv.js';
import { emptyScenario, validateScenario } from '../../src/sim/scripting/scenario.js';
import { validate } from '../../src/net/schema.js';
import { signIn, schemaOf } from './helpers.js';

let mock, session;
beforeAll(async () => { mock = await startMockServer(); session = await signIn(mock.url); });
afterAll(() => mock.close());

const png = () => new Blob([Uint8Array.from([137, 80, 78, 71, 1, 2, 3, 4])], { type: 'image/png' });
const level = () => {
  const s = emptyScenario({ id: 'my-level' });
  s.title = { de: 'Mein Level', en: 'My level' };
  s.speakers = { guide: { name: 'Guide', portrait: 'assets/guide.png' } };
  return s;
};

describe('pack ids', () => {
  it('7 characters, lower case and digits', () => {
    const id = newPackId();
    expect(id).toMatch(/^[a-z0-9]{7}$/);
    expect(newPackId()).not.toBe(id);
  });
});

describe('buildDocument', () => {
  it('renames used media to their SHA-256 and rewrites the references; unused files stay home', async () => {
    const files = new Map([['assets/guide.png', png()], ['assets/unused.png', png()]]);
    const { doc, uploads } = await buildDocument(level(), files, 'abc1234');
    const hash = await sha256Hex(new Uint8Array(await png().arrayBuffer()));
    expect(uploads.map((u) => u.name)).toEqual([`${hash}.png`]);
    expect(doc.levels[0].scenario.speakers.guide.portrait).toBe(`assets/${hash}.png`);
    expect(doc.media).toEqual({ [`${hash}.png`]: { type: 'image/png', bytes: 8 } });
    expect(validate(schemaOf('pack-document'), doc)).toEqual([]);
    expect(validateScenario(doc.levels[0].scenario)).toEqual([]);
  });

  it('title becomes {de,en} from a string or a half-filled text; no media = no media field', async () => {
    const s = level();
    s.title = 'Nur einer';
    s.summary = { de: 'Zusammenfassung' };
    const { doc } = await buildDocument(s, new Map(), 'abc1234');
    expect(doc.title).toEqual({ de: 'Nur einer', en: 'Nur einer' });
    expect(doc.summary).toEqual({ de: 'Zusammenfassung', en: 'Zusammenfassung' });
    expect('media' in doc).toBe(false);
  });
});

describe('against the server', () => {
  it('save, find in my packs, load like any pack (hash-checked), open in the editor, delete', async () => {
    const id = newPackId();
    const files = new Map([['assets/guide.png', png()]]);
    await saveToServer(session.api, level(), files, id);

    const mine = parseCatalog(await session.api.get('/api/v1/packs'), `${mock.url}/`);
    const entry = mine.packs.find((p) => p.id === id);
    expect(entry).toMatchObject({ own: true, access: 'open', levels: 1 });

    const pack = await loadPack(entry, { fetch: session.api.fetch, cache: memoryKv() });
    expect(pack.levels[0].scenario.id).toBe('my-level');
    expect(pack.media.size).toBe(1);

    const own = await loadOwnPack(session.api, id);
    expect(own.scenario.id).toBe('my-level');
    expect([...own.files.keys()][0]).toMatch(/^assets\/[0-9a-f]{64}\.png$/);
    expect(own.files.values().next().value.size).toBe(8);

    // saving again replaces the pack
    const changed = level();
    changed.title = { de: 'Zweiter Stand', en: 'Second state' };
    await saveToServer(session.api, changed, files, id);
    expect((await loadOwnPack(session.api, id)).scenario.title.en).toBe('Second state');

    await session.api.del(`/api/v1/packs/${id}`);
    expect((await session.api.get('/api/v1/packs')).packs.some((p) => p.id === id)).toBe(false);
  });
});
