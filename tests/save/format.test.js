// Import check, format detection, migration, file name.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame } from '../../src/sim/serialize.js';
import {
  FORMAT, FORMAT_VERSION, GAME_VERSION, MIGRATIONS, SaveError,
  createSaveDoc, parseSaveText, migrate, detectVersion, exportFileName, defaultSaveName, stringifyDoc,
} from '../../src/save/format.js';
import { encode, decode } from '../../src/save/codec.js';
import { t } from '../../src/i18n/index.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';

const state = (() => { const s = new Sim({ seed: 5 }); for (let i = 0; i < 50; i++) s.step(); return saveGame(s); })();
const docText = (mut = (d) => d) => JSON.stringify(mut(structuredClone(createSaveDoc(state, { name: 'Prüfung', savedAt: new Date('2026-10-04T12:00:00Z') }))));
/** Error code when reading */
const codeOf = (text, opts) => { try { parseSaveText(text, opts); return null; } catch (e) { expect(e).toBeInstanceOf(SaveError); return e.code; } };

describe('Save format', () => {
  it('envelope contains marker, versions, metadata and state', () => {
    const doc = JSON.parse(docText());
    expect(doc).toMatchObject({ format: FORMAT, formatVersion: FORMAT_VERSION, gameVersion: GAME_VERSION });
    expect(doc.meta).toEqual({ name: 'Prüfung', savedAt: '2026-10-04T12:00:00.000Z', tick: 50, mode: 'free', mission: null, seed: 5, players: 2, fog: true });
    expect(doc.state.tick).toBe(50);
    expect(Object.keys(doc)).toEqual(['format', 'formatVersion', 'gameVersion', 'meta', 'state']);
  });

  it('valid file is accepted (also deeply checked)', () => {
    const doc = parseSaveText(docText(), { deep: true });
    expect(doc.meta.name).toBe('Prüfung');
  });

  it('import validation: clear error codes', () => {
    expect(codeOf('das ist kein json')).toBe('saves.err.notJson');
    expect(codeOf('')).toBe('saves.err.notJson');
    expect(codeOf('[1,2,3]')).toBe('saves.err.wrongFormat');
    expect(codeOf('{"hello":"world"}')).toBe('saves.err.wrongFormat');
    expect(codeOf(docText((d) => { d.format = 'other-game'; return d; }))).toBe('saves.err.wrongFormat');
    expect(codeOf(docText((d) => { d.formatVersion = FORMAT_VERSION + 1; d.gameVersion = '9.0.0'; return d; }))).toBe('saves.err.newer');
    expect(codeOf(docText((d) => { d.formatVersion = 'one'; return d; }))).toBe('saves.err.broken');
    expect(codeOf(docText((d) => { delete d.state; return d; }))).toBe('saves.err.broken');
    expect(codeOf(docText((d) => { d.state.map.width = 'wide'; return d; }))).toBe('saves.err.broken');
    expect(codeOf(docText((d) => { d.state.entities = {}; return d; }))).toBe('saves.err.broken');
    expect(codeOf(docText((d) => { d.state.players = []; return d; }))).toBe('saves.err.broken');
    expect(codeOf(docText((d) => { d.state.mission = { id: 'doesnotexist' }; return d; }))).toBe('saves.err.unknownMission');
    // mission 1 moved from a mission file into a level folder (Python): its old saves carry no scenario
    expect(codeOf(docText((d) => { d.state.mission = { id: 'c1', scenario: null }; return d; }))).toBe('saves.err.missionChanged');
    try { parseSaveText(docText((d) => { d.state.mission = { id: 'c1' }; return d; })); } catch (e) {
      expect(t(e.code, e.params, 'de')).toContain('Lindgrund');
      expect(t(e.code, e.params, 'en')).not.toMatch(/\{\w+\}/);
    }
    // save game from the time before "Krone aus Eis" (game state version 1): outdated, not damaged
    expect(codeOf(docText((d) => { d.state.version = 1; return d; }))).toBe('saves.err.outdated');
    // truncated file
    const text = docText();
    expect(codeOf(text.slice(0, text.length / 2))).toBe('saves.err.notJson');
  });

  it('broken map data is only noticed in the deep check', () => {
    const bad = docText((d) => { d.state.map.heights = '###kein base64###'; return d; });
    expect(codeOf(bad)).toBe(null);
    expect(codeOf(bad, { deep: true })).toBe('saves.err.broken');
  });

  it('error messages exist in both languages and fill placeholders', () => {
    for (const code of ['notJson', 'wrongFormat', 'newer', 'outdated', 'broken', 'unknownMission', 'missionChanged', 'tooLarge', 'quota', 'storage', 'missing', 'read']) {
      expect(de['saves.err.' + code]).toBeTruthy();
      expect(en['saves.err.' + code]).toBeTruthy();
    }
    try { parseSaveText(docText((d) => { d.formatVersion = 7; d.gameVersion = '3.1.0'; return d; })); } catch (e) {
      expect(t(e.code, e.params, 'de')).toContain('3.1.0');
      expect(t(e.code, e.params, 'de')).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('Migration', () => {
  it('earlier save game without envelope (format version 0) becomes v1', () => {
    expect(detectVersion(state)).toBe(0);
    const doc = parseSaveText(JSON.stringify(state));
    expect(doc.format).toBe(FORMAT);
    expect(doc.formatVersion).toBe(1);
    expect(doc.meta).toMatchObject({ tick: 50, mode: 'free', seed: 5, players: 2 });
    expect(doc.state.tick).toBe(50);
  });

  it('runs step by step up to the target version and checks every step', () => {
    const v1 = JSON.parse(docText());
    // imagined future formats: v2 renames meta.name, v3 adds a field
    const migrations = {
      ...MIGRATIONS,
      1: (d) => ({ ...d, formatVersion: 2, meta: { ...d.meta, title: d.meta.name } }),
      2: (d) => ({ ...d, formatVersion: 3, extraField: true }),
    };
    const v3 = migrate(v1, migrations, 3);
    expect(v3).toMatchObject({ formatVersion: 3, extraField: true, meta: { title: 'Prüfung' } });
    // from v0 to v3 in one go
    expect(migrate(structuredClone(state), migrations, 3).formatVersion).toBe(3);
    // missing migration and wrongly set version report as damaged
    expect(() => migrate(v1, MIGRATIONS, 2)).toThrow(SaveError);
    expect(() => migrate(v1, { 1: (d) => ({ ...d }) }, 2)).toThrow(SaveError);
    // newer file than known
    expect(() => migrate({ ...v1, formatVersion: 4 }, migrations, 3)).toThrow(/newer/);
  });

  it('there is a migration for every older format version', () => {
    for (let v = 0; v < FORMAT_VERSION; v++) expect(typeof MIGRATIONS[v]).toBe('function');
  });
});

describe('Helpers', () => {
  it('file name kronland-<name>-<date>.json, umlauts and special characters replaced', () => {
    const d = new Date(2026, 9, 4);
    expect(exportFileName('Mission 2 – 0:42:10', d)).toBe('kronland-mission-2-0-42-10-2026-10-04.json');
    expect(exportFileName('Größte Burg ölig', d)).toBe('kronland-groesste-burg-oelig-2026-10-04.json');
    expect(exportFileName('', d)).toBe('kronland-savegame-2026-10-04.json');
    expect(exportFileName('🙂🙂', d)).toBe('kronland-savegame-2026-10-04.json');
    expect(exportFileName('x'.repeat(200), d).length).toBeLessThan(70);
  });

  it('name suggestion by mode and play time', () => {
    const tt = (k, p) => t(k, p, 'de');
    expect(defaultSaveName({ tick: 25200, mode: 'mission', mission: 'c2', seed: 1 }, tt)).toBe('Mission 2 – 42:00');
    expect(defaultSaveName({ tick: 36610, mode: 'free', mission: null, seed: 42 }, tt)).toBe('Freies Spiel, Karte 42 – 1:01:01');
    expect(defaultSaveName({ tick: 0, mode: 'mission', mission: 'tutorial', seed: 1 }, tt)).toBe('Tutorial – 0:00');
  });

  it('compression: gzip round trip and clearly smaller; uncompressed fallback readable', async () => {
    const text = stringifyDoc(JSON.parse(docText()), { compact: true });
    const gz = await encode(text);
    expect(gz.startsWith('gz:')).toBe(true);
    expect(gz.length).toBeLessThan(text.length / 3);
    expect(await decode(gz)).toBe(text);
    const plain = await encode(text, { compress: false });
    expect(plain.startsWith('js:')).toBe(true);
    expect(await decode(plain)).toBe(text);
    expect(await decode(text)).toBe(text);
  });
});
