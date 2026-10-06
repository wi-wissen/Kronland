// Alarm calls on attacks (src/audio/barks.js): who calls, and never a wrong substitute bark.
// Coverage: every attack notice with a voice line finds a recording for every unit that can be hit (de + en).
// Previously "Your troops are under attack!" stayed silent when a soldier (not the captain) was hit:
// soldiers had no voice role. Militia called spearman lines that do not exist in the serf voice.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BARKS, alarmRole, alarmVoices, chooseBark, ALARM_TOASTS, BarkGate } from '../../src/audio/barks.js';
import { GameAudio } from '../../src/audio/GameAudio.js';
import { setVoiceIndex } from '../../src/audio/voiceLines.js';
import { setLang } from '../../src/i18n/index.js';
import { UNITS, HEROES } from '../../src/sim/data/units.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';

const index = JSON.parse(readFileSync(new URL('../../public/audio/voice/index.json', import.meta.url), 'utf8')).files;
const chars = JSON.parse(readFileSync(new URL('../../public/models/characters/manifest.json', import.meta.url), 'utf8'));

describe('Alarm calls', () => {
  it('building: a serf calls for the village; otherwise the unit that was hit (worker with serf voice)', () => {
    expect(alarmRole({ kind: 'building' })).toBe('serf');
    expect(alarmRole({ kind: 'worker' })).toBe('serf');
    // Female workers call with a female voice (GameAudio.voiceOf by figureSex)
    expect(alarmRole({ kind: 'worker' }, undefined, () => 'serfF')).toBe('serfF');
    expect(alarmRole({ kind: 'unit' }, undefined, () => 'serfF')).toBe('serfF');
    expect(alarmRole({ kind: 'hero', hero: 'nelia' })).toBe('nelia');
    expect(alarmRole({ kind: 'leader' }, 'bow')).toBe('bow');
  });

  it('every voice role has alarm calls; without an alarm call no substitute from "move"', () => {
    for (const [role, set] of Object.entries(BARKS)) expect(set.alarm?.length, role).toBeGreaterThan(0);
    expect(chooseBark({ move: [{ de: 'x', en: 'x' }] }, 'alarm', () => 0)).toBe(null);
  });

  it('soldiers call like their captain; militia with serf voice; hero without alarm calls: substitute', () => {
    expect(alarmRole({ kind: 'soldier' }, 'bow')).toBe('bow');
    expect(alarmRole({ kind: 'soldier' }, 'heavyCav')).toBe('cavalry');
    expect(alarmRole({ kind: 'unit', militia: true }, undefined, () => 'serfF')).toBe('serfF');
    expect(alarmVoices({ kind: 'hero', hero: 'malvor' }, undefined, (e) => e.hero)).toEqual([{ role: 'sword', voice: 'sword' }]);
  });

  it('barks block alarm calls only while the recording plays (not during the rest pause)', () => {
    const g = new BarkGate();
    g.spoke(10, 2, 'rare');
    expect(g.playingUntil).toBe(12);
    expect(g.busyUntil).toBe(20);
  });
});

/** Figures per kind, as they can be hit in the game */
function targets(kind) {
  const lines = [...new Set(Object.values(UNITS).map((u) => u.line))];
  const defOf = (line) => Object.values(UNITS).find((u) => u.line === line).id;
  if (kind === 'building') return [{ kind, type: 'headquarters' }];
  if (kind === 'worker') return [{ kind, id: 3 }];
  if (kind === 'unit') return [0, 1, 2, 3].map((id) => ({ kind, id })).concat([{ kind, id: 5, militia: true }]);
  if (kind === 'hero') return Object.keys(HEROES).map((hero) => ({ kind, hero }));
  return lines.map((line) => ({ kind, def: defOf(line) }));
}

/** Voice as GameAudio.voiceOf with a loaded figure manifest */
function manifestVoice(e) {
  if (e.kind === 'hero') return e.hero;
  if (e.kind === 'unit') { const v = chars.roles.serf.variants; return v[e.id % v.length].voice ?? 'serf'; }
  const line = UNITS[e.def]?.line;
  return chars.roles[`soldier.${line}.leader`]?.voice ?? chars.roles[`soldier.${line}`]?.voice ?? 'sword';
}

function audioFor(voiceOf) {
  const g = Object.create(GameAudio.prototype);
  g.audio = { rnd: () => 0.3 };
  if (voiceOf) g.voiceOf = voiceOf;
  return g;
}

describe('Alarm calls: notice coverage', () => {
  it('every notice with an alarm call has texts in both languages', () => {
    for (const key of Object.keys(ALARM_TOASTS)) { expect(de[key], key).toBeTruthy(); expect(en[key], key).toBeTruthy(); }
  });

  it('every unit that is hit finds an alarm call with a recording in de and en (with and without figure manifest)', () => {
    setVoiceIndex(index);
    const missing = [];
    for (const [toast, kinds] of Object.entries(ALARM_TOASTS)) {
      for (const kind of kinds) for (const target of targets(kind)) for (const lang of ['de', 'en']) {
        setLang(lang);
        for (const g of [audioFor(manifestVoice), audioFor(null)]) {
          const pick = g.alarmLine(target);
          if (!pick?.url) missing.push(`${toast} ${JSON.stringify(target)} ${lang}`);
          else expect(index[`${pick.voice}|${lang}|${pick.line[lang]}`]).toBeTruthy();
        }
      }
    }
    setLang('de');
    expect(missing).toEqual([]);
  });

  it('the alarm call recordings exist as files', () => {
    for (const [k, f] of Object.entries(index)) {
      if (!Object.values(BARKS).some((s) => s.alarm?.some((l) => k.endsWith(`|${l.de}`) || k.endsWith(`|${l.en}`)))) continue;
      expect(() => readFileSync(new URL(`../../public/audio/voice/${f}`, import.meta.url)), k).not.toThrow();
    }
  });
});
