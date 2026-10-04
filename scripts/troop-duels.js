// Duel matrix: full unit against full unit on open ground, several seeds.
// Shows who wins and how much health is left – for tuning troop values
// (roles and ranking as in the model game, own numbers; docs/SPIELREGELN.md §8).
// `node scripts/troop-duels.js [seeds]`
import { Sim } from '../src/sim/sim.js';
import { UNITS, fullCost } from '../src/sim/data/units.js';

const seeds = Number(process.argv[2] ?? 4);
export const MATCHUPS = [
  ['sword1', 'spear1'], ['sword1', 'bow1'], ['spear1', 'bow1'], ['spear1', 'lightCav1'], ['sword1', 'lightCav1'],
  ['sword2', 'spear2'], ['bow2', 'lightCav1'], ['sword2', 'sword1'], ['spear2', 'spear1'], ['bow2', 'bow1'],
  ['sword3', 'spear3'], ['sword3', 'bow3'], ['spear3', 'heavyCav1'], ['sword3', 'heavyCav1'], ['bow3', 'heavyCav1'],
  ['sword4', 'spear4'], ['sword4', 'bow4'], ['spear4', 'heavyCav2'], ['sword4', 'heavyCav2'], ['bow4', 'heavyCav2'],
  ['sword4', 'sword3'], ['heavyCav2', 'heavyCav1'], ['lightCav2', 'lightCav1'], ['bow4', 'lightCav2'],
  ['cannon1', 'sword1'], ['cannon3', 'sword3'], ['cannon4', 'bow4'],
];

function openField(sim) {
  const m = sim.map, c = m.width >> 1;
  for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = c + dx, y = c + dy;
    let ok = true;
    for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 10 && ok; i++) if (!m.walkable(x + i, y + j)) ok = false;
    if (ok) return { x, y };
  }
  throw new Error('no open field');
}

const strength = (sim, L) => {
  if (!sim.entities.has(L.id)) return 0;
  const d = UNITS[L.def];
  const hp = L.hp + L.soldiers.reduce((s, id) => s + (sim.entities.get(id)?.hp ?? 0), 0);
  return hp / (d.hp + d.soldierHp * d.soldiers);
};

/** @returns {{ winA: number, left: number }} win rate of A (%), remaining strength of the winner (%) */
export function duel(a, b, n = seeds) {
  let winA = 0, left = 0, decided = 0;
  for (let s = 1; s <= n; s++) {
    const sim = new Sim({ seed: s * 101 });
    const f = openField(sim);
    const A = sim.spawnLeader(0, a, f.x, f.y), B = sim.spawnLeader(1, b, f.x + 7, f.y);
    for (let t = 0; t < 3000 && sim.entities.has(A.id) && sim.entities.has(B.id); t++) sim.step();
    const sa = strength(sim, A), sb = strength(sim, B);
    if (sa > sb) winA++;
    if (sa === 0 || sb === 0) decided++;
    left += Math.max(sa, sb);
  }
  return { winA: Math.round((100 * winA) / n), left: Math.round((100 * left) / n), decided };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const c = (id) => { const k = fullCost(UNITS[id]); return Object.entries(k).map(([r, v]) => `${v}${r[0]}`).join('+'); };
  console.log('A\tB\tA wins %\tWinner left %\tCost A | B');
  for (const [a, b] of MATCHUPS) {
    const r = duel(a, b);
    console.log(`${a}\t${b}\t${r.winA}\t\t${r.left}${r.decided < seeds ? '*' : ''}\t\t${c(a)} | ${c(b)}`);
  }
}
