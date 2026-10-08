import { describe, it, expect } from 'vitest';
import { abilityKeyMap, ABILITY_KEYS } from '../../src/ui/hud/abilityKeys.js';

const hero = (id, abilities) => ({ id, abilities: abilities.map((a) => ({ id: a, readyIn: 0 })) });

describe('Hero ability keys', () => {
  it('the abilities of the selected hero get X and C, every hero the same', () => {
    for (const h of [hero(1, ['farsight', 'courage']), hero(2, ['bribe', 'salve'])]) {
      expect(abilityKeyMap([h]).map((x) => x.key)).toEqual(['x', 'c']);
    }
    expect(abilityKeyMap([])).toEqual([]);
  });

  it('keys do not collide with camera and bar keys', () => {
    for (const k of ['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'h', 'b', 'm']) expect(ABILITY_KEYS).not.toContain(k);
  });
});
