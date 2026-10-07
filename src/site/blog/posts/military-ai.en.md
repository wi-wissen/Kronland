---
title: Military and AI opponents
date: 2026-10-03T12:35:21+02:00
teaser: Combat, towers, heroes and weather – and an AI opponent that plays through the same commands as a human. How does such an AI “think”, and how do you play a thousand matches without a screen?
milestone: true
---

## What was built {#what}

Two steps in four minutes: first the military – captains with soldiers, towers, heroes with abilities, militia,
weather, victory and defeat –, then an AI opponent that builds, researches, raises an army, attacks and defends.
Since then Kronland has opponents, and with them the most important tool for endurance tests: computer versus computer.

![After almost 30 minutes of game time: the blue army attacks the red settlement, red troops defend. Both sides are played by the AI here; the image comes from the state of this milestone.](blog/military-ai/battle.webp)

## Fighting with integers {#combat}

In the simulation combat is not an animation but arithmetic. Every unit has hit points, attack, armour, an attack type
(pierce, slash, shot, siege …) and an armour type (none, padded, leather, iron, fortified). How well an attack type
works against an armour type is a percentage in a table – that gives the familiar rock-paper-scissors of strategy
games: spears against riders, bows against unarmoured troops, cannons against walls.

```js src/sim/data/combat.js
// damage = attack × factor(attack type, armour type) − armour + random 0…2
export function computeDamage(attack, attackType, armorType, armor, bonus = 0) {
  const f = DAMAGE_FACTORS[attackType]?.[armorType] ?? 100;   // percent
  return Math.max(1, Math.trunc((attack * f) / 100) - armor + bonus);
}
```

The random part `bonus` comes – of course – from the seeded generator (`sim.rng.int(3)`), not from `Math.random`.

Every combat system faces one problem: who is the nearest enemy? Comparing every unit with every other costs 250,000
comparisons with 500 units – in *every* tick. The solution is a coarse grid over the map (*spatial hashing*): at the
start of every tick each unit is sorted into its grid cell, and the search only looks into the cells nearby.

```js src/sim/systems/military.js
for (const e of sim.entities.values()) {
  const p = posOf(e);
  add(Math.floor(p.x / UNIT / C), Math.floor(p.y / UNIT / C), e);   // cell (cx, cy)
}
…
for (let cy = …; cy <= …; cy++) for (let cx = …; cx <= …; cx++) {
  for (const t of sim.grid.get(cy * 4096 + cx) ?? []) { /* only check neighbours */ }
}
```

It is the same idea as a [hash table](https://en.wikipedia.org/wiki/Hash_table): instead of searching everything, you
jump straight into the right “bucket”.

## Weather as a game rule {#weather}

The weather follows a fixed cycle: summer, rain, summer, winter. It is not decoration but changes the rules: in rain
ranged units hit less well, in winter everyone is slower – and rivers and lakes freeze over. Suddenly water is
walkable, and an attack can come across the ice. For pathfinding that means the map has two states, and a figure on
the ice when the thaw comes has a serious problem.

## How an AI opponent thinks {#ai}

The AI in `src/ai/AiPlayer.js` is not a neural network and does not learn anything. It is a **rule-based system** – a
list of priorities and states written down by a human. That is the norm in strategy games because it is predictable,
fast and easy to tune.

![The thinking loop of the AI opponent (left) and the three states of its army (right).](blog/military-ai/ai-en.svg)

Every few ticks – every 12 on “hard”, every 50 on “easy” – the thinking loop runs:

```js src/ai/AiPlayer.js
update() {
  if ((sim.tick + this.offset) % this.cfg.think !== 0) return;  // only every n ticks
  this.cmds = [];
  this.scan();       // assess: own buildings, serfs, troops, enemies near the castle
  this.economy();    // buy serfs, research, taxes, build, upgrade, assign work
  this.military();   // recruit, upgrade, refill, lead the army, heroes
  for (const c of this.cmds) sim.command({ ...c, player: this.player });
}
```

The last line is the most important one: what comes out is **only commands** – the same ones the interface sends. The
AI cannot conjure up buildings or invent resources.

### A build plan with priorities

What the AI builds is a wish list worked through from top to bottom:

```js src/ai/AiPlayer.js
const BUILD_PLAN = [
  ['residence', 1], ['farm', 1], ['university', 1], ['clayMine', 1], ['stoneMine', 1],
  ['residence', 2], ['farm', 2], ['sawmill', 1], ['ironMine', 1], ['brickworks', 1],
  ['barracks', 1], …
];
```

`['residence', 2]` means: “if there are not yet two residences, build one.” Urgent cases come before the list: if
workers lack beds or seats, a residence or farm comes first; if the population limit gets tight, a new village centre.
The AI places military buildings towards the enemy and residences around its castle.

### The army as a state machine

The army knows three states – **gather**, **attack**, **defend** – and the transitions are simple conditions:

```pseudo
if enemies near our own castle:            # defence always has priority
  all troops and heroes: attack-move to the enemy
  if the enemy is much stronger: arm the serfs (militia)
  state = defend
else if state == gather:
  troops to the rally point (8 tiles towards the enemy)
  if enough troops and minimum time passed: state = attack
else if state == attack:
  if strength < 35 % of the strength at departure: retreat, state = gather
  drive idle troops on again
```

The difficulty levels are nothing but different numbers in the same logic:

```js src/ai/AiPlayer.js
export const DIFFICULTY = {
  easy:   { think: 50, serfs: 14, attackSize: 3, firstAttack: 21000, maxSites: 2, bonusGold: 0,   … },
  normal: { think: 25, serfs: 22, attackSize: 5, firstAttack: 14400, maxSites: 3, bonusGold: 0,   … },
  hard:   { think: 12, serfs: 28, attackSize: 6, firstAttack: 9000,  maxSites: 4, bonusGold: 250, … },
};
```

“Hard” thinks more often, has more serfs, attacks earlier and with more troops (tick 9,000 = 15 minutes) and – as in
the original – regularly gets some extra gold. How the opponents behave from a player’s point of view is described in
the [compendium](compendium/).

The AI has to be deterministic too, because in lockstep multiplayer it would run on every computer. So it has its own
seeded random generator (for example to pick a building corner) and goes through everything in a fixed order.

## AI against AI without a screen {#headless}

Because the AI only sends commands and the simulation needs no screen, you can let two AI opponents play against each
other – in Node, as fast as the processor allows. The script `scripts/ai-match.js` does exactly that:

```js scripts/ai-match.js
const sim = new Sim({ seed });
const ais = diffs.map((d, i) => new AiPlayer(sim, i, d));
for (let t = 0; t < minutes * 600; t++) {
  for (const ai of ais) ai.update();
  const ev = sim.step();
  if (ev.some((e) => e.type === 'victory')) { console.log(`Victory team ${sim.winner} …`); break; }
  if (t % 3000 === 0) console.log(/* buildings, workers, troops, stock per player */);
}
```

Run with the code of this milestone – 30 minutes of game time in 13 seconds:

```text
$ node scripts/ai-match.js 1 30 normal normal
  0 min  P0: Bld 3 Wrk 0 Ser 8 Cpt 0/0 T0 | 300G 2300C 1600W …  gather  ||  P1: Bld 2 Wrk 0 Ser 4 …  gather
  5 min  P0: Bld 10 Wrk 14 Ser 13 Cpt 0/0 T1 | 125G 1235C 94W …  gather  ||  P1: Bld 10 Wrk 14 Ser 13 …  gather
 15 min  P0: Bld 22 Wrk 32 Ser 22 Cpt 0/0 T3 | 232G 1871C 393W …  gather  ||  P1: Bld 23 Wrk 33 Ser 22 …  gather
 20 min  P0: Bld 29 Wrk 39 Ser 22 Cpt 3/12 T4 | 237G 1709C 556W …  gather  ||  P1: Bld 29 Wrk 40 Ser 22 …  gather
 25 min  P0: Bld 36 Wrk 51 Ser 22 Cpt 5/20 T4 | 222G 1791C 350W …  attack  ||  P1: Bld 37 Wrk 55 Ser 22 …  gather
Runtime 13.0 s Rejections { 'Nicht genug Rohstoffe': 2 }
```

You can read quite a lot from it: both sides grow at a similar pace (a good sign for fair maps), after 20 minutes the
first captains appear (`Cpt 3/12`: three captains with twelve soldiers), after 25 minutes player 0 attacks. And the
`Rejections` line counts how often the simulation rejected an AI command (“not enough resources”) – a good hint at
flaws in the AI’s reasoning. Today the script runs with `node scripts/ai-match.js 1 60 hard easy` (seed, minutes, two
levels).

## What did not work {#problems}

At first the AI was too trusting. The next morning the QA round found that it kept sending serfs and troops to
unreachable goals – such as a tree on an island. Every time A\* searched the entire reachable map before giving up: up
to 1,724 futile path searches in 150 seconds and stutters of over a second. The solution came from the simulation:
region numbers tell immediately whether a goal is reachable (more in the [QA rounds](blog/qa-fog/#regions)), and since
then the AI only plans reachable building spots and goals. Afterwards: zero failed attempts in the same matches.

## Try it yourself {#tips}

- **Let the AI play through the public command interface,** never with special privileges – then it is fair, and every
  mistake it makes is one a human could make too.
- **Start with a priority list.** An AI made of “if … then …” and a wish list goes surprisingly far and is easy to
  understand.
- **AI against AI without graphics is the best endurance test** for simulation, balance and performance. Let it run
  while you do something else.
