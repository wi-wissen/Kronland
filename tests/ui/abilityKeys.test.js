import { describe, it, expect } from 'vitest';
import { abilityKeyMap, ABILITY_KEYS } from '../../src/ui/hud/abilityKeys.js';

const hero = (id, abilities) => ({ id, abilities: abilities.map((a) => ({ id: a, readyIn: 0 })) });

describe('Hero ability keys', () => {
  it('every ability of several selected heroes gets its own key', () => {
    const map = abilityKeyMap([hero(1, ['farsight', 'courage']), hero(2, ['bribe', 'salve']), hero(3, ['shieldBash', 'intimidate'])]);
    expect(map.map((x) => `${x.key}:${x.ability.id}`)).toEqual(['x:farsight', 'c:courage', 'v:bribe', 'g:salve', 't:shieldBash', 'n:intimidate']);
    expect(new Set(map.map((x) => x.key)).size).toBe(map.length);
  });

  it('keys do not collide with camera and bar keys', () => {
    for (const k of ['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'h', 'b', 'm']) expect(ABILITY_KEYS).not.toContain(k);
  });
});
