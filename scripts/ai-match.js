// AI vs AI without graphics: `node scripts/ai-match.js [seed] [minutes] [difficulty0] [difficulty1]`
import { Sim } from '../src/sim/sim.js';
import { aiOf } from '../src/ai/runner.js';

const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seed = Number(argv[0] ?? 1);
const minutes = Number(argv[1] ?? 40);
const diffs = [argv[2] ?? 'normal', argv[3] ?? 'normal'];
const sim = new Sim({ seed, ai: diffs });
const events = {};
const t0 = Date.now();
const rejects = {};
for (let t = 0; t < minutes * 600; t++) {
  const ev = sim.step();
  for (const e of ev) {
    if (e.type === 'rejected') rejects[e.reason] = (rejects[e.reason] ?? 0) + 1;
    // count bridges and hero abilities
    if (['bridgeBuilt', 'bridgeCollapsed', 'ability'].includes(e.type)) {
      const k = e.type === 'ability' ? `ability:${e.ability}` : e.type;
      events[k] = (events[k] ?? 0) + 1;
    }
  }
  if (ev.some((e) => e.type === 'victory')) { console.log(`Victory team ${sim.winner} after ${(sim.tick / 600).toFixed(1)} min`); break; }
  if (t % 3000 === 0) {
    const line = sim.players.map((p) => {
      const c = { b: 0, w: 0, s: 0, L: 0, sol: 0 };
      for (const e of sim.entities.values()) {
        if (e.owner !== p.id) continue;
        if (e.kind === 'building') c.b++; else if (e.kind === 'worker') c.w++; else if (e.kind === 'unit') c.s++;
        else if (e.kind === 'leader') c.L++; else if (e.kind === 'soldier') c.sol++;
      }
      const r = (k) => p.stock[k] + p.raw[k];
      return `P${p.id}: Bld ${c.b} Wrk ${c.w} Ser ${c.s} Cpt ${c.L}/${c.sol} T${p.techs.size} | ${r('gold')}G ${r('clay')}C ${r('wood')}W ${r('stone')}S ${r('iron')}I ${r('sulfur')}Su ${aiOf(sim, p.id).armyState}`;
    }).join('  ||  ');
    console.log(`${(t / 600).toFixed(0).padStart(3)} min  ${line}`);
  }
}
console.log('Runtime', ((Date.now() - t0) / 1000).toFixed(1), 's', 'Rejections', rejects);
console.log('Events', events);
