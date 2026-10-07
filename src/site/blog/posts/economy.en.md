---
title: Economy
date: 2026-10-03T12:17:09+02:00
teaser: Workers who eat and sleep, workshops, taxes and research: the economic loop of the original in one step – built from state machines and data tables.
milestone: true
---

## What was built {#what}

Nine minutes after the first 3D version, serfs and resources turn into an economy: workers with a workplace, residence
and farm, mines, refining in workshops, motivation, taxes, research and upgrading buildings in levels. With it come 20
new tests and an info panel for buildings.

![After ten minutes of game time: residences, farms with fields, college, clay and stone mine. The buildings were placed by a small test script using the same commands a human would send.](blog/economy/settlement.webp)

## The economic cycle {#loop}

The original has a clear loop, and Kronland adopts it:

1. **Serfs** (bought for thalers) construct buildings and gather resources from piles – wood, clay, stone, iron,
   sulphur.
2. Once a workshop or mine stands, a **worker** moves in from the **village centre**. Workers cannot be controlled;
   they pursue their profession.
3. **Mines** extract raw goods; **refiners** (brickworks, sawmill, stonemason, smithy, alchemist) turn them into more
   valuable goods.
4. Workers need **food** (farm) and **sleep** (residence) – otherwise they rest at the campfire, which takes a long time.
5. Every two minutes is **payday**: workers pay taxes, and with that you buy new serfs, buildings and research.

The exciting part is the [feedback](https://en.wikipedia.org/wiki/Feedback): more workers bring more taxes but need
more beds and seats. High taxes bring more money but lower motivation – and whoever is too unhappy moves away. A good
city builder is basically a web of such control loops.

## A worker as a state machine {#states}

How do you program a worker’s behaviour? With a [finite-state machine](https://en.wikipedia.org/wiki/Finite-state_machine).
A worker is always in exactly one state – working, walking, eating, sleeping, waiting – and certain conditions make
him switch to another.

![The states of a worker and the conditions for switching. Every work cycle costs stamina; whoever is exhausted eats and sleeps.](blog/economy/worker-states-en.svg)

In code this is a `switch` statement that runs for every worker in every tick. Most states just count a timer down;
when it reaches zero the next decision is made:

```js src/sim/systems/workers.js
switch (w.state) {
  case 'walk':
    if (moveAlong(sim, w, W.speed)) {               // goal reached?
      if (isAdjacent(w, target)) arrive(sim, w); else decide(sim, w);
    }
    return;
  case 'working':
    if (--w.timer > 0) return;                       // work cycle still running
    finishCycle(sim, w);                             // credit the yield, stamina −100
    decide(sim, w);
    return;
  case 'eating':
    if (--w.timer > 0) return;
    w.stamina = Math.min(W.maxStamina, w.stamina + Math.trunc((W.eatGain * motivationFactor(w)) / 100));
    w.ate = true;
    decide(sim, w);
    return;
  …
}
```

The actual logic is in `decide()` – a chain of if-then rules with priorities:

```pseudo
function decide(worker):
  if stamina < 100: resting = true
  if resting:
    if not eaten yet: go to the farm (otherwise campfire)
    else:             go to the residence (otherwise campfire)
  else if refiner and hands empty:
    if raw goods in store: go and fetch them
    else: wait at the workshop
  else: go to work
```

Note that food and sleep are multiplied by **motivation**: a happy worker recovers faster and therefore works more. A
single number thus affects the whole economy.

## Numbers belong in tables {#data}

How long is the smith’s work cycle? How much stone does a residence cost? Such values are not scattered across the
code but live in **data tables** under `src/sim/data/`:

```js src/sim/data/professions.js
export const PROFESSIONS = {
  farmer:     { name: 'Bauer',         building: 'farm',       kind: 'none',     cycle: 60 },
  scholar:    { name: 'Gelehrter',     building: 'university', kind: 'research', cycle: 50 },
  miner:      { name: 'Bergmann',      building: null,         kind: 'mine',     cycle: 50, yield: 5 },
  brickmaker: { name: 'Ziegelbrenner', building: 'brickworks', kind: 'refine',   cycle: 40, res: 'clay', yield: 2 },
  smith:      { name: 'Schmied',       building: 'smithy',     kind: 'refine',   cycle: 40, res: 'iron', yield: 2 },
  …
};
```

The principle is called [data-driven programming](https://en.wikipedia.org/wiki/Data-driven_programming): the code
describes *how* a profession works (mining, refining, research), the table says *how much*. That pays off several
times over. Balance changes are one line. An agent can change them precisely without touching logic. And the website’s
[compendium](compendium/) generates its tables straight from this data – so it can never be out of date.

Every value without a source carries the note `(A)` for “assumption” in the code; the others come from the original’s
community documentation. That way you can later tell whether a number is intentional or was a guess.

## Payday, taxes and motivation {#payday}

Every 1,200 ticks (120 seconds) `updatePayday` settles the accounts. Taxes have five levels from “none” to “very high”:

| Tax level | Thalers per worker | Motivation per payday |
|---|---:|---:|
| none | 0 | +8 |
| low | 2.5 | +4 |
| normal | 5 | ±0 |
| high | 7.5 | −6 |
| very high | 10 | −12 |

```js src/sim/systems/payday.js
export function taxIncome(workers, taxLevel) {
  return Math.trunc((workers * BALANCE.tax.perWorker * BALANCE.tax.factorsPercent[taxLevel]) / 100);
}
```

`Math.trunc` instead of floating point – the simulation stays integer here too. If a worker’s motivation drops below
25 %, he moves away; if the average is below 30 %, no new settlers arrive. Decorative buildings (clock, windwheel) and
the chapel’s blessings raise motivation. By the way, you can only set taxes once the college has researched
“education” – research is simply another profession whose yield is research points.

## How to test something like this {#tests}

An economy is full of relationships that are hard to verify while playing: does a stonemason with house and farm
really produce more than one at the campfire? The tests build exactly such situations and compare:

```text
✓ a stonemason comes from the village centre as soon as the workshop is built
✓ refiners fetch raw material and make more refined goods from it
✓ with house and farm clearly more is produced than at the campfire
✓ overtime increases output but costs motivation
✓ very high tax brings double and lowers motivation
✓ with too low motivation workers leave
✓ under 30 % average no new settlers arrive
```

Because the simulation is deterministic, such comparisons are fair: both runs start with the same seed, only one
building differs.

## What did not work {#problems}

The first values were an approximation. A day later a dedicated task revisited the balance: an analysis of the
refiners (how many goods per minute with which supply?) tuned motivation, house and farm, troops got their own values
with the strength ratios of the original, and every map got a wood guarantee around the start – before that a player
could end up with hardly any trees in reach.

## Try it yourself {#tips}

- **Balance belongs in data, not in code.** Then an agent can change it precisely without touching logic.
- **Model figures as state machines.** Draw the states on paper first – the diagram above is almost one to one the code.
- **Note the source of every rule** (for us the original’s community documentation or “assumption”) – so you can check
  later whether something is intentional.
