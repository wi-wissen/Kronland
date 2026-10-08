// Level packages: .zip round trip, folders by link, limits for packages from other people.

import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readLevelZip, writeLevelZip, fetchLevel, levelFromFiles, PACKAGE_LIMITS } from '../../src/levels/package.js';
import { assetAllowed } from '../../src/levels/assets.js';
import { LEVELS } from '../../src/sim/missions/levels/index.js';
import { unpackLevel } from '../../src/sim/scripting/scenario.js';

const adv4 = () => structuredClone(LEVELS.find((l) => l.id === 'adv4'));
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Static host in memory: path → bytes. */
function host(files) {
  return async (url) => {
    const path = new URL(url).pathname;
    const data = files[path];
    return data
      ? { ok: true, status: 200, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }
      : { ok: false, status: 404 };
  };
}

describe('Level packages', () => {
  it('a .zip from the editor opens again with code and files', async () => {
    const s = adv4();
    const zip = await writeLevelZip(s, new Map([['assets/stone.png', png], ['notes.txt', strToU8('x')]]));
    const back = readLevelZip(zip);
    expect(back.problems).toEqual([]);
    const { folder, ...plain } = s;
    void folder;
    expect(back.scenario).toEqual(plain);
    expect([...back.assets.keys()]).toEqual(['assets/stone.png']);
    expect(new Uint8Array(await back.assets.get('assets/stone.png').arrayBuffer())).toEqual(png);
    // the same bytes every time (no clock in the file)
    expect(await writeLevelZip(s)).toEqual(await writeLevelZip(s));
  });

  it('a zipped folder ("lindgrund/scenario.json") and files from Windows editors work', () => {
    const { json, files } = unpackLevel(adv4());
    const zip = zipSync({
      'lindgrund/scenario.json': strToU8('﻿' + JSON.stringify(json)),
      ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`lindgrund/${k}`, strToU8(v.replace(/\n/g, '\r\n'))])),
      'lindgrund/assets/a.webp': png,
      '__MACOSX/lindgrund/._scenario.json': strToU8('junk'),
    });
    const r = readLevelZip(zip);
    expect(r.problems).toEqual([]);
    expect(r.scenario.sections.find((x) => x.id === 'player').code).toBe(files['player.py']);
    expect([...r.assets.keys()]).toEqual(['assets/a.webp']);
  });

  it('broken packages give a readable reason instead of a crash', () => {
    expect(readLevelZip(new Uint8Array([1, 2, 3])).problems[0]).toMatch(/not a zip/);
    expect(readLevelZip(zipSync({ 'x.py': strToU8('') })).problems).toEqual(['scenario.json missing']);
    expect(readLevelZip(zipSync({ 'scenario.json': strToU8('{') })).problems[0]).toMatch(/^scenario.json:/);
    const { json } = unpackLevel(adv4());
    expect(readLevelZip(zipSync({ 'scenario.json': strToU8(JSON.stringify(json)) })).problems.join()).toContain('file world.py missing');
    const many = Object.fromEntries(Array.from({ length: PACKAGE_LIMITS.files + 1 }, (_, i) => [`assets/f${i}.png`, png]));
    expect(levelFromFiles({ 'scenario.json': strToU8(JSON.stringify(json)), ...many }).problems[0]).toMatch(/at most/);
  });

  it('only known file types inside assets/, never outside the level', () => {
    expect(assetAllowed('assets/alchemist.glb')).toBe(true);
    expect(assetAllowed('assets/sub/voice.mp3')).toBe(true);
    for (const p of ['assets/run.exe', 'world.png', '../assets/x.png', 'assets/../../x.png', '/assets/x.png', 'https://x/assets/a.png', 'assets\\x.png']) {
      expect(assetAllowed(p), p).toBe(false);
    }
  });

  it('by link: a .zip, a folder or its scenario.json on a static host', async () => {
    const s = adv4();
    const { json, files } = unpackLevel(s);
    const zip = await writeLevelZip(s);
    const get = host({
      '/lv/adv4.zip': zip,
      '/lv/adv4/scenario.json': strToU8(JSON.stringify(json)),
      ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`/lv/adv4/${k}`, strToU8(v)])),
    });
    const a = await fetchLevel('https://teacher.example/lv/adv4.zip', get);
    expect(a.problems).toEqual([]);
    expect(a.base).toBeNull();
    for (const link of ['https://teacher.example/lv/adv4/', 'https://teacher.example/lv/adv4', 'https://teacher.example/lv/adv4/scenario.json']) {
      const b = await fetchLevel(link, get);
      expect(b.problems, link).toEqual([]);
      expect(b.base, link).toBe('https://teacher.example/lv/adv4/');
      expect(b.scenario.sections.map((x) => x.code)).toEqual(a.scenario.sections.map((x) => x.code));
    }
    expect((await fetchLevel('https://teacher.example/missing.zip', get)).problems).toEqual(['HTTP 404']);
    expect((await fetchLevel('javascript:alert(1)', get)).problems).toEqual(['only http(s) addresses']);
  });
});
