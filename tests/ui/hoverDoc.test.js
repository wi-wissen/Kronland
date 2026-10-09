// Command under a position in the code (hover cards, Ctrl/Cmd+click, long-press) – src/ui/script/hoverDoc.js.
import { describe, it, expect } from 'vitest';
import { identAt, candidatesAt, commandAt, offsetAt } from '../../src/ui/script/hoverDoc.js';
import { isKnown, cardFor, commandList } from '../../src/ui/script/docCards.js';
import { commandDoc } from '../../src/ui/script/commandDocs.js';

/** Command at the first occurrence of `needle` (+ delta characters into it). */
const at = (src, needle, delta = 0) => commandAt(src, src.indexOf(needle) + delta, isKnown);

describe('identAt', () => {
  it('finds the identifier around a character', () => {
    expect(identAt('nelia.step(2)', 6)).toEqual({ from: 6, to: 10, word: 'step' });
    expect(identAt('nelia.step(2)', 5)).toBeNull(); // the dot
    expect(identAt('x = 42', 4)).toBeNull(); // numbers are no names
    expect(identAt('größe = 1', 2)).toEqual({ from: 0, to: 5, word: 'größe' });
  });
});

describe('commandAt', () => {
  it('resolves dotted game commands and their object', () => {
    const src = 'while nelia.can_step():\n    nelia.step()\n';
    expect(at(src, 'nelia.step()', 7)).toMatchObject({ name: 'nelia.step' });
    expect(at(src, 'can_step')).toMatchObject({ name: 'nelia.can_step', from: src.indexOf('can_step'), to: src.indexOf('can_step') + 8 });
    expect(at(src, 'nelia')).toMatchObject({ name: 'nelia' });
    expect(at('orrin.step()', 'orrin')).toMatchObject({ name: 'orrin' });
    expect(at('orrin.step()', 'step')).toMatchObject({ name: 'nelia.step' });
    // Any figure: the basic commands are explained once under nelia.…, serf and troop commands under their class
    expect(at('bran.front()', 'front')).toMatchObject({ name: 'nelia.front' });
    expect(at('s.chop()', 'chop')).toMatchObject({ name: 'serf.chop' });
    expect(commandDoc(at('t.defend()', 'defend').name).name).toBe('troop.hold');
  });

  it('resolves built-ins, modules and names explained together with another', () => {
    expect(at('n = len(xs)', 'len')).toMatchObject({ name: 'len' });
    expect(at('print(max(1, 2))', 'max')).toMatchObject({ name: 'max' });
    expect(at('import math\nr = math.sqrt(2)', 'sqrt')).toMatchObject({ name: 'math.sqrt' });
    expect(at('wait(1)', 'wait')).toMatchObject({ name: 'wait' });
  });

  it('resolves methods on literals by type and on unknown values by name', () => {
    expect(at('"a b".split()', 'split')).toMatchObject({ name: 'str.split' });
    expect(at('[3, 1].sort()', 'sort')).toMatchObject({ name: 'list.sort' });
    expect(at('{}.get("k")', 'get')).toMatchObject({ name: 'dict.get' });
    expect(at('xs.append(1)', 'append')).toMatchObject({ name: 'list.append' });
    expect(at('d.items()', 'items')).toMatchObject({ name: 'dict.items' });
  });

  it('ignores strings, comments, keywords, unknown names and methods that do not exist', () => {
    expect(at('print("nelia.step")', 'step')).toBeNull();
    expect(at('# nelia.step()', 'step')).toBeNull();
    expect(at('for i in range(3):', 'for')).toBeNull();
    expect(at('wood = 3', 'wood')).toBeNull();
    expect(at('x.wiggle()', 'wiggle')).toBeNull();
    // A builtin name after a dot is not the builtin
    expect(at('obj.len', 'len')).toBeNull();
  });

  it('lists candidates best first', () => {
    const c = candidatesAt('a.b.split()', 4);
    expect(c.names[0]).toBe('a.b.split');
    expect(c.names).toContain('b.split');
    expect(c.names).toContain('str.split');
  });
});

describe('offsetAt', () => {
  it('maps visual line/column to a character offset', () => {
    const src = 'ab\n\tc\nxyz';
    expect(offsetAt(src, 0, 1)).toBe(1);
    expect(offsetAt(src, 0, 2)).toBe(-1); // behind the end of the line
    expect(offsetAt(src, 1, 0)).toBe(3); // tab covers columns 0–3
    expect(offsetAt(src, 1, 3)).toBe(3);
    expect(offsetAt(src, 1, 4)).toBe(4);
    expect(offsetAt(src, 2, 2)).toBe(8);
    expect(offsetAt(src, 3, 0)).toBe(-1);
    expect(offsetAt(src, -1, 0)).toBe(-1);
  });
});

describe('doc cards', () => {
  it('render signature, texts, parameters and the reference link in both languages', () => {
    for (const lang of ['de', 'en']) {
      const c = cardFor('nelia.step', lang);
      expect(c.sig).toBe('nelia.step(n=1)');
      expect(c.shortHtml.length).toBeGreaterThan(5);
      expect(c.descHtml).toContain('<code>');
      expect(c.params[0].name).toBe('n');
      expect(c.returnsHtml).toContain('None');
      expect(c.url).toMatch(/scripting\/#nelia\.step$/);
    }
    expect(cardFor('nope', 'de')).toBeNull();
    // Removed names have no entry
    for (const n of ['hero', 'hero.step', 'units_in', 'nelia.ahead']) expect(cardFor(n, 'de')).toBeNull();
    expect(commandList('en').some((c) => c.name === 'str.split' && c.py)).toBe(true);
  });
});
