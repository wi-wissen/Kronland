// Diplomacy of a foreign selection (src/game/relation.js) and its text key (hudLayout.relationKey).

import { describe, it, expect } from 'vitest';
import { relationOf, showsInterior } from '../../src/game/relation.js';
import { relationKey } from '../../src/ui/hud/hudLayout.js';
import { BANDIT_TEAM } from '../../src/sim/missions/runtime.js';

/** Small stand-in for the simulation: players and diplomacy as in Sim.relation */
function fakeSim(players, diplomacy = {}) {
  return {
    players,
    relation(a, b) {
      if (a === b) return 'allied';
      const d = diplomacy[a < b ? `${a}:${b}` : `${b}:${a}`];
      if (d) return d;
      return players[a].team === players[b].team ? 'allied' : 'hostile';
    },
  };
}

describe('Diplomacy of a foreign selection', () => {
  const sim = fakeSim([
    { id: 0, team: 0 }, { id: 1, team: 1 }, { id: 2, team: 0 }, { id: 3, team: BANDIT_TEAM, neutral: true },
    { id: 4, team: 104, neutral: true, village: 'Morvale' },
  ], { '0:3': 'neutral', '0:4': 'neutral' });

  it('distinguishes own, enemy, ally, neutral, robbers, village and nature', () => {
    expect(relationOf(sim, 0, 0).rel).toBe('own');
    expect(relationOf(sim, 0, 1).rel).toBe('hostile');
    expect(relationOf(sim, 0, 2).rel).toBe('allied');
    expect(relationOf(sim, 0, 3)).toEqual({ rel: 'neutral', bandits: true, village: null });
    expect(relationOf(sim, 0, 4)).toEqual({ rel: 'neutral', bandits: false, village: 'Morvale' });
    expect(relationOf(sim, 0, -1).rel).toBe('nature');
  });

  it('shows inner workings only for own and allied buildings', () => {
    expect(showsInterior(relationOf(sim, 0, 0))).toBe(true);
    expect(showsInterior(relationOf(sim, 0, 2))).toBe(true);
    expect(showsInterior(relationOf(sim, 0, 1))).toBe(false);
    expect(showsInterior(relationOf(sim, 0, 4))).toBe(false);
  });

  it('does not name neutral as enemy; robbers are called robbers', () => {
    expect(relationKey(relationOf(sim, 0, 1))).toBe('foreign.enemy');
    expect(relationKey(relationOf(sim, 0, 4))).toBe('foreign.neutral');
    expect(relationKey(relationOf(sim, 0, 2))).toBe('foreign.ally');
    expect(relationKey(relationOf(sim, 0, 3))).toBe('foreign.bandits');
    expect(relationKey(relationOf(sim, 0, 0))).toBe(null);
    expect(relationKey(null)).toBe(null);
  });
});

describe('Name of a foreign selection', async () => {
  const { foreignName } = await import('../../src/ui/hud/hudLayout.js');
  const t = (k) => k, name = { hero: (h) => 'H:' + h, unit: (u) => 'U:' + u, building: (b, l) => `B:${b}${l}` };
  it('names hero, unit, serf and ruin', () => {
    expect(foreignName({ entity: 'hero', hero: 'malvor' }, t, name)).toBe('H:malvor');
    expect(foreignName({ entity: 'leader', unit: 'sword1' }, t, name)).toBe('U:sword1');
    expect(foreignName({ entity: 'unit' }, t, name)).toBe('foreign.serf');
    expect(foreignName({ entity: 'ruin', type: 'farm', level: 1 }, t, name)).toBe('sys.ruin · B:farm1');
  });
});
