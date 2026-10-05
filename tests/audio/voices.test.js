// Voices: barks (barks.js), voice matching the look, index of the voiced lines and completeness of the
// role casting (assets-src/voices/cast.json; raw files live outside Git, those checks are skipped without them).

import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BARKS, BARK_RULES, BarkGate, barkRole, chooseBark } from '../../src/audio/barks.js';
import { setVoiceIndex, voiceFile, voiceKey, speakerVoice } from '../../src/audio/voiceLines.js';
import { pickVariant } from '../../src/render/variants.js';
import { SPEAKERS } from '../../src/sim/missions/speakers.js';
import { mulberry32 } from '../../src/audio/rng.js';
import { similarity, spokenText } from '../../scripts/asset-gen/voice.mjs';

/** JSON from assets-src/ (local only, not in Git) or null if it is missing. */
const readSrc = (p) => { const u = new URL(`../../assets-src/${p}`, import.meta.url); return fs.existsSync(u) ? JSON.parse(fs.readFileSync(u, 'utf8')) : null; };
const cast = readSrc('voices/cast.json');
const manifest = JSON.parse(fs.readFileSync(new URL('../../public/models/characters/manifest.json', import.meta.url), 'utf8'));

describe('Barks', () => {
  it('every bark role has lines in both languages and a voice', () => {
    for (const [role, events] of Object.entries(BARKS)) {
      if (cast) {
        expect(cast.speakers[role]?.length, role).toBeGreaterThan(0);
        for (const v of cast.speakers[role]) expect(cast.roles[v], `${role} → ${v}`).toBeTruthy();
      }
      for (const lines of Object.values(events)) for (const l of lines) { expect(l.de).toBeTruthy(); expect(l.en).toBeTruthy(); }
      expect(events.select?.length, role).toBeGreaterThan(0);
    }
  });

  it('roles: serfs by look, troops by type, heroes by name, militia like spearmen', () => {
    expect(barkRole({ kind: 'hero', hero: 'nelia' })).toBe('nelia');
    expect(barkRole({ kind: 'hero', hero: 'malvor' })).toBeNull();
    expect(barkRole({ kind: 'unit', id: 3 }, undefined, () => 'serfF')).toBe('serfF');
    expect(barkRole({ kind: 'unit', id: 3, militia: true })).toBe('spear');
    expect(barkRole({ kind: 'leader' }, 'lightCav')).toBe('cavalry');
    expect(barkRole({ kind: 'worker' })).toBeNull();
  });

  it('voice matching the look: the serf variant carries its voice, troops have one voice', () => {
    const v = manifest.roles.serf.variants;
    expect(v.map((x) => x.voice).sort()).toEqual(['serf', 'serfF']);
    // same choice as the rendering: both voices across many ids
    const voices = new Set(Array.from({ length: 40 }, (_, id) => v[pickVariant(v, id)].voice));
    expect(voices).toEqual(new Set(['serf', 'serfF']));
    if (cast) for (const line of ['sword', 'spear', 'bow', 'heavyCav', 'lightCav']) expect(cast.roles[manifest.roles[`soldier.${line}`].voice], line).toBeTruthy();
  });

  it('selection: grumbling only on a repeated command, missing occasions fall back to move', () => {
    const rnd = mulberry32(5);
    const grumble = new Set(BARKS.serf.grumble.map((l) => l.de));
    let grumbled = 0;
    for (let i = 0; i < 200; i++) {
      expect(grumble.has(chooseBark(BARKS.serf, 'move', rnd, false).de)).toBe(false);
      if (grumble.has(chooseBark(BARKS.serf, 'move', rnd, true).de)) grumbled++;
    }
    expect(grumbled).toBeGreaterThan(50);
    expect(BARKS.sword.move.map((l) => l.de)).toContain(chooseBark(BARKS.sword, 'gather', rnd).de);
    expect(chooseBark(undefined, 'move', rnd)).toBeNull();
  });

  it('never the same line twice in a row', () => {
    const rnd = mulberry32(9);
    let last;
    for (let i = 0; i < 300; i++) {
      const l = chooseBark(BARKS.serf, 'move', rnd, false, last);
      expect(l).not.toBe(last);
      last = l;
    }
  });

  it('mostly silence, never two barks on top of each other, then rest', () => {
    const rnd = mulberry32(3);
    const gate = new BarkGate();
    let said = 0, now = 0;
    for (let i = 0; i < 1000; i++) {
      now += 30; // far apart: only the probability counts
      if (gate.choose({ mode: 'rare', role: 'serf', event: 'select', now, rnd })) said++;
    }
    expect(said / 1000).toBeGreaterThan(BARK_RULES.rare.select - 0.06);
    expect(said / 1000).toBeLessThan(BARK_RULES.rare.select + 0.06);
    // while a bark plays (3 s recording), everything is silent until end + rest
    const g2 = new BarkGate();
    g2.spoke(100, 3, 'rare');
    const always = () => 0;
    expect(g2.choose({ mode: 'rare', role: 'serf', event: 'move', now: 102, rnd: always })).toBeNull();
    expect(g2.choose({ mode: 'rare', role: 'serf', event: 'move', now: 100 + 3 + BARK_RULES.rare.rest - 0.1, rnd: always })).toBeNull();
    expect(g2.choose({ mode: 'rare', role: 'serf', event: 'move', now: 100 + 3 + BARK_RULES.rare.rest + 0.1, rnd: always })).not.toBeNull();
    // while a dialogue plays or when "off": nothing
    expect(new BarkGate().choose({ mode: 'rare', role: 'serf', event: 'move', now: 0, rnd: always, busy: true })).toBeNull();
    expect(new BarkGate().choose({ mode: 'off', role: 'serf', event: 'move', now: 0, rnd: always })).toBeNull();
  });

  it('sending back and forth is one action: with "Rare" only the first occasion speaks', () => {
    const gate = new BarkGate();
    expect(gate.touch(7, 0)).toBe(1);   // selected
    expect(gate.touch(7, 3)).toBe(2);   // sent off
    expect(gate.touch(7, 10)).toBe(3);  // sent on (distance to the last one counts)
    expect(gate.touch(7, 40)).toBe(1);  // later: new action
    expect(gate.touch(8, 40)).toBe(1);
    const always = () => 0;
    const say = (mode, nth, event = 'move') => new BarkGate().choose({ mode, role: 'serf', event, nth, now: 0, rnd: always });
    expect(say('rare', 1)).not.toBeNull();
    expect(say('rare', 2)).toBeNull();
    expect(say('rare', 5)).toBeNull();
    expect(say('often', 2)).not.toBeNull();
    // grumbling only with "Often" and only from the third occasion
    const grumble = new Set(BARKS.serf.grumble);
    const rnd = mulberry32(2);
    let g = 0;
    for (let i = 0; i < 100; i++) if (grumble.has(new BarkGate().choose({ mode: 'often', role: 'serf', event: 'move', nth: 3, now: 0, rnd }))) g++;
    expect(g).toBeGreaterThan(10);
    for (let i = 0; i < 100; i++) expect(grumble.has(new BarkGate().choose({ mode: 'often', role: 'serf', event: 'move', nth: 2, now: 0, rnd }))).toBe(false);
  });
});

describe('Voiced lines', () => {
  it('index: key from voice, language and text; speaker without own voice', () => {
    setVoiceIndex({ [voiceKey('nelia', 'de', 'Hier entlang!')]: 'de/nelia-1234abcd.mp3' });
    expect(voiceFile('nelia', 'de', 'Hier entlang!')).toMatch(/audio\/voice\/de\/nelia-1234abcd\.mp3$/);
    expect(voiceFile('nelia', 'en', 'Hier entlang!')).toBeNull();
    expect(voiceFile(null, 'de', 'x')).toBeNull();
    expect(speakerVoice('kunz')).toBe('bandit');
    setVoiceIndex(null);
  });

  it.skipIf(!cast)('every mission speaker has a chosen voice with a template', () => {
    for (const id of Object.keys(SPEAKERS)) {
      const v = speakerVoice(id);
      expect(cast.roles[v], id).toBeTruthy();
      expect(cast.roles[v].pick, id).not.toBeUndefined();
      expect(fs.existsSync(new URL(`../../assets-src/voices/${v}/voice.wav`, import.meta.url)), v).toBe(true);
    }
  });

  it('the index only points to existing files', () => {
    const url = new URL('../../public/audio/voice/index.json', import.meta.url);
    if (!fs.existsSync(url)) return;
    const { files } = JSON.parse(fs.readFileSync(url, 'utf8'));
    for (const f of Object.values(files)) expect(fs.existsSync(new URL(`../../public/audio/voice/${f}`, import.meta.url)), f).toBe(true);
  });
});

describe('Generation', () => {
  it('listening check: word comparison forgives one letter in longer words, text without long pauses', () => {
    expect(similarity('Orin! Stop it!', 'Orrin. Stop it.')).toBe(1);
    expect(similarity('Hi', 'Aye.')).toBe(0);
    expect(similarity('Tor!', 'Thaw!')).toBe(0);
    expect(spokenText('Nelia! Das Eis … es bricht …')).toBe('Nelia! Das Eis, es bricht.');
    expect(spokenText('Na gut.')).toBe('Na gut.');
  });
});
