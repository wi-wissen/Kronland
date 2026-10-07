---
title: Simulation core
date: 2026-10-03T11:51:52+02:00
teaser: Before anything was visible, the simulation was in place: a game loop with a fixed tick, integers, seeded randomness, a tile grid and A* pathfinding – a game that runs without any screen at all.
milestone: true
---

## What was built {#what}

The very first commit of Kronland contains not a single image and not a single button. It consists of 25 files: a
tile map with a map generator, pathfinding, serfs who build and gather resources, payday – and automated tests. Two
text files record *what* is to be built (`docs/SPIELREGELN.md`, the game rules) and *how* (`docs/ARCHITEKTUR.md`).

That sounds unspectacular, but it is the most important decision of the whole project: **the game rules are a
program of their own that knows nothing about graphics.** This article explains what that means and which computer
science ideas are behind it: the game loop, determinism, pseudo-randomness, hash functions, grids, graphs and
pathfinding with A\*.

## A game is a loop {#loop}

At its core every real-time game is a loop: read the input, advance the world by a small step, show the result – over
and over again. You may know this [game loop](https://en.wikipedia.org/wiki/Video_game_programming#Game_structure)
from Scratch or Processing, where `draw()` is called 60 times per second.

Kronland separates two things that are often mixed up: **computing** and **drawing**. Computing happens in fixed
steps called *ticks*: exactly ten per second, each one standing for 100 ms of game time. Drawing happens as often as
the screen can manage. One tick looks like this (trimmed):

```js src/sim/sim.js
/** Compute one tick (100 ms). */
step(commands = []) {
  this.events = [];
  const cmds = this.pending.concat(commands);
  this.pending = [];
  for (const c of cmds) this.applyCommand(c);    // 1. apply commands

  for (const e of [...this.entities.values()]) { // 2. every figure one step
    if (e.kind === 'unit') updateSerf(this, e);
  }
  updatePayday(this);                            // 3. payday every 120 s
  this.tick++;
  return this.events;                            // 4. events for the display
}
```

Why a fixed tick? Because then every rule can be expressed in ticks: a serf chops wood in 40 ticks, payday comes every
1,200 ticks. Whether your computer manages 30 or 144 frames per second changes nothing about the course of the game –
only how smooth it looks. How ten ticks per second still turn into smooth movement is explained in the
[next article](blog/rendering/#loop).

## Same input, same game {#determinism}

The strictest rule of the project: the simulation is
[deterministic](https://en.wikipedia.org/wiki/Deterministic_algorithm). The same starting value and the same commands
produce *bit for bit* the same game on every computer, in every browser, on every run. Three things make that hard –
and each has a solution.

### No floating point

[Floating-point numbers](https://en.wikipedia.org/wiki/Floating-point_arithmetic) are approximations: in JavaScript
`0.1 + 0.2` is `0.30000000000000004`. Different calculation paths or libraries may round the last bit differently, and
in a game that runs for tens of thousands of ticks such a bit grows into a different world. Kronland therefore only
computes with **integers**: positions are stored in *milli-tiles* (one tile = 1,000 units), and distances use an
integer square root:

```js src/sim/fixed.js
export const UNIT = 1000;             // 1 tile = 1000 milli-tiles

/** Integer square root (rounded down). */
export function isqrt(n) {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;              // make sure of the result …
  while ((r + 1) * (r + 1) <= n) r++; // … in both directions
  return r;
}
```

Trigonometric functions like `Math.sin` are banned from the game logic as well; where directions are needed, they are
a table in the code.

### Randomness that repeats

`Math.random()` returns something different on every call – useless for a deterministic game. Instead Kronland uses a
[pseudorandom number generator](https://en.wikipedia.org/wiki/Pseudorandom_number_generator): from a starting value,
the **seed**, it computes a sequence of numbers that *looks* random but is completely fixed. The algorithm is called
*sfc32* and needs nothing but additions, bit shifts and XOR on 32-bit numbers:

```js src/sim/rng.js
next() {
  let { a, b, c, d } = this;           // state: four 32-bit numbers
  const t = (((a + b) | 0) + d) | 0;   // | 0 cuts down to 32 bits
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  this.a = a; this.b = b; this.c = c; this.d = d;
  return t >>> 0;                      // 0 … 2^32 − 1
}
```

Whoever knows the state – the four numbers – knows all the following “random” numbers. That is exactly what saving
needs later on: a save game simply stores the four numbers too.

### One number for the whole state

How do you check whether two runs are *really* identical? You condense the entire state – every stock, every
position, every counter – into a single number, a [hash](https://en.wikipedia.org/wiki/Hash_function). Kronland uses
*FNV-1a*: every byte is XORed into the value so far and the result is multiplied by a large prime. If a single bit
changes anywhere, the hash is completely different. A test runs the same scenario twice and compares the hashes:

```js tests/sim/determinism.test.js
it('same seed and same commands yield exactly the same course', () => {
  const a = scenario(42), b = scenario(42);
  expect(a.hashes).toEqual(b.hashes);
});
```

Why all this effort? It enables four things the project needs later: **tests** that always give the same result;
**save games** that continue exactly the same after loading; **bots** that play thousands of matches without graphics;
and **lockstep multiplayer**. There every computer runs the whole simulation itself and only the commands travel over
the network – a few bytes instead of the positions of hundreds of figures. If a hash differs, one computer has fallen
out of step, and you know immediately in which tick.

## Commands as the only input {#commands}

When the player builds a house, the interface does not call something like `createBuilding()`. It sends a
**command** – a plain object:

```js
{ type: 'placeBuilding', player: 0, building: 'residence', x: 41, y: 37, units: [12, 13] }
```

The simulation checks it in the next tick: does the player exist? Is the spot free, level enough, affordable? If not,
it rejects the command and reports the reason as an event. There is no other way to change the state.

![The structure: everything that changes the game comes in as a command; rendering and interface only read.](blog/simulation-core/architecture-en.svg)

That has a nice side effect: the simulation does not care *who* sends a command – a human with a mouse, an AI
opponent, a test, or later a player over the network. Everyone uses the same
[interface](https://en.wikipedia.org/wiki/Interface_%28computing%29), and nobody can cheat. In software engineering this
pattern is called the [command pattern](https://en.wikipedia.org/wiki/Command_pattern).

## A game without a screen {#headless}

Because the simulation needs neither a browser window nor a graphics card, it runs wherever JavaScript runs – for
example with [Node.js](https://en.wikipedia.org/wiki/Node.js) on the command line. The following small script was
written for this article against the code of the first commit. It starts a game, sends a build command, computes 600
ticks (one minute of game time) and prints part of the map as text:

```js demo/headless.mjs
import { Sim } from '../src/sim/sim.js';

const sim = new Sim({ seed: 42 });
const hq = sim.findBuilding(0, 'headquarters');
const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).map((e) => e.id);
const pos = sim.findPlacement(0, 'residence', hq.x + 2, hq.y + 2);
sim.command({ type: 'placeBuilding', player: 0, building: 'residence', x: pos.x, y: pos.y, units: serfs });

for (let t = 1; t <= 600; t++) {
  sim.step();
  if (t % 150 === 0) console.log(`Tick ${t}: hash ${sim.hash().toString(16)}`);
}
// … then print the map around the castle character by character
```

The output – the same on every run and every computer:

```text
Tick 150: hash bf6560f2
Tick 300: hash 3d08d762
Tick 450: hash f9fa5a1e
Tick 600: hash a601ae71
TTTT......HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHH..DDDD...............
..........HHHHHs....................
...............sWWW.................
................WWW.................
..o.TT.o........WWW.................
```

`H` is the castle, `D` the village centre, `W` the new residence, `s` are serfs, `T` trees and `o` resource piles.
That is the entire world of the first milestone – without a single polygon.

The tests work the same way. [Vitest](https://vitest.dev/) starts simulations, sends commands and checks claims such
as “four serfs build a house in about the build time” or “one serf needs about four times as long”. All tests of the
first commit together run in under four seconds:

```text
$ npx vitest run --reporter=verbose
 ✓ tests/sim/mapgen.test.js > Map generator > is deterministic
 ✓ tests/sim/economy.test.js > Building > 4 serfs finish building a house in about the build time
 ✓ tests/sim/economy.test.js > Building > 1 serf needs about 4 times as long
 ✓ tests/sim/economy.test.js > Mining resources > serfs fell wood and then go to the next tree
 ✓ tests/sim/determinism.test.js > Determinism > same seed and same commands yield exactly the same course
 ✓ tests/sim/basics.test.js > Pathfinding > does not cut corners
 …
 Test Files  4 passed (4)
```

For comparison: a single test that starts the game in a browser takes half a minute without a graphics card.

## The world as a grid {#grid}

How do you represent a game world in memory? There are two big families. Many 3D games describe walkable areas with
**polygons**, a so-called navigation mesh (*navmesh*): the world is split into convex polygons and figures walk from
polygon to polygon. That is precise and saves memory on large open areas. The other family is the **grid** – the world
as a chessboard of equally sized tiles.

Kronland uses a grid, for good reasons: buildings stand on tiles anyway (a residence occupies 3 × 3), trees and
resource piles on one. Whether a spot is free is a simple lookup. Above all, a grid can be described exactly with
integers – a navmesh would need geometry with floating point. The map is nothing more than a few long arrays, one per
property:

```js src/sim/map.js
export const WATER = 1;      // not walkable, not buildable
export const OCCUPIED = 2;   // building, tree, resource pile
export const RESERVED = 4;   // settlement spot or shaft

export class TileMap {
  constructor(width, height) {
    this.heights = new Int32Array(width * height); // height in cm
    this.flags = new Uint8Array(width * height);   // bits: WATER | OCCUPIED | RESERVED
    this.owner = new Int32Array(width * height);   // which object stands here?
  }
  idx(x, y) { return y * this.width + x; }         // 2D → 1D
  walkable(x, y) {
    return this.inBounds(x, y) && (this.flags[this.idx(x, y)] & (WATER | OCCUPIED)) === 0;
  }
}
```

Two tricks are hidden in there: a two-dimensional field is stored as a one-dimensional array (`y * width + x`), and
several yes/no properties share one byte as a [bit mask](https://en.wikipedia.org/wiki/Mask_%28computing%29):
`flags & WATER` asks for exactly one bit.

## Random maps that repeat {#mapgen}

Every new match gets a new map – and yet the same map number always gives the same world, because the map number *is*
the seed. The generator in `src/sim/mapgen.js` works in steps:

1. **Heights from noise.** Each tile gets a height from *value noise*: on a coarse grid every grid point gets a random
   value from (x, y, seed) via a [hash function](https://en.wikipedia.org/wiki/Hash_function), and in between values are
   blended smoothly. Three such layers with a grid spacing of 32, 16 and 8 tiles are added with weights (4 : 2 : 1) –
   the coarse one shapes hills, the fine one bumps. More in the article
   [Terrain and graphics](blog/terrain-graphics/#noise).
2. **Water level as a quantile.** Instead of a fixed height the generator sorts all heights and sets the water level
   so that exactly the lowest 12 % are under water. That way every map has a similar amount of water.
3. **Starts in the corners, levelled.** The castles stand in fixed corners; within 14 tiles the terrain is flattened
   so that you can build there.
4. **The same for everyone.** Every player gets the same set: six shafts (clay, stone, two iron, two sulphur) 12 to 20
   tiles away, six resource piles closer by and settlement spots on the way to the centre of the map. The generator
   rolls the exact position with the seed until it finds a free spot.
5. **Forests.** Another noise decides where forest is dense; a grove near every castle guarantees wood for the start.

![Left the heights of map 42 (bright = high), in the middle the same map with water, forest, castles (red), shafts and settlement spots (white frames), right map 7 – generated with the generator of the first commit.](blog/simulation-core/maps.webp)

So the maps are fair not because they are mirror images, but because the generator makes every player the same
promises – and a test checks that for several seeds.

## How figures find their way {#pathfinding}

If you send a serf to a tree behind a lake, he does not walk straight into the water but around it. How does he find
that path?

### The map as a graph

For pathfinding the map is a [graph](https://en.wikipedia.org/wiki/Graph_%28discrete_mathematics%29): every walkable tile
is a node connected to its up to eight neighbours. A straight step costs 10, a diagonal one 14 – the diagonal of a
square is √2 ≈ 1.414 times as long, and 14 is the integer approximation. We want the *cheapest* path from start to goal.

### Breadth-first search: everything in turn

The simplest idea is [breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search): starting from the
start, you first examine all neighbours, then their neighbours and so on – like ripples spreading on a pond. For every
tile you reach you remember where you came from. At the goal you follow these pointers backwards and have your path.

```pseudo
function breadth_first(start, goal):
  queue = [start]
  came_from = { start: nothing }
  while queue not empty:
    k = queue.take_front()
    if k == goal: return path_backwards(came_from, goal)
    for each neighbour n of k:
      if n walkable and n not in came_from:
        came_from[n] = k
        queue.append(n)
  return "no path"
```

Breadth-first search finds the path with the fewest *steps*. If steps have different costs (straight 10, diagonal 14),
you need its big sister, [Dijkstra’s algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm): instead of a
plain queue it always takes the tile with the *lowest cost so far* next. Both share a problem: they search in all
directions at once, including those where the goal certainly is not.

### A\*: heading for the goal with an estimate

The [A\* algorithm](https://en.wikipedia.org/wiki/A%2A_search_algorithm) adds an **estimate** to Dijkstra of how far it
still is from a tile to the goal. For each tile it knows:

- **g** – the actual cost from the start to here,
- **h** – the estimated remaining cost to the goal, the [heuristic](https://en.wikipedia.org/wiki/Heuristic_%28computer_science%29),
- **f = g + h** – the estimated total cost of a path through this tile.

It always examines the tile with the smallest f. Tiles in the direction of the goal have a small h and therefore come
first; detours are only considered when the direct way is blocked.

![The same search twice: left without an estimate (Dijkstra), right with an estimate (A*). Both find an equally short path, but A* examines only a quarter of the tiles. Computed with the same rules as in the game.](blog/simulation-core/astar-en.svg)

Kronland estimates with the *octile distance*: as many diagonal steps as possible, the rest straight. On open ground
that is exactly right; with obstacles the real path is longer – so the estimate is never too high. That is the
crucial condition (the estimate is called *admissible*): only then is A\* guaranteed to find a shortest path.

```js src/sim/pathfinding.js
const STRAIGHT = 10, DIAG = 14;

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy);
}
```

The core of the search, trimmed and slightly simplified:

```js src/sim/pathfinding.js
while (open.size) {
  const cur = open.pop();                      // tile with the smallest f
  if (closed.has(cur.i)) continue;
  if (goalSet.has(cur.i)) return reconstruct(cur.i); // follow the pointers back
  closed.add(cur.i);
  if (++expanded > maxNodes) return null;      // emergency brake: 20,000 tiles
  for (let d = 0; d < 8; d++) {
    const nx = cx + DX[d], ny = cy + DY[d];
    if (!map.walkable(nx, ny)) continue;
    // diagonal only if both neighbours are free: no corner cutting
    if (d >= 4 && (!map.walkable(cx + DX[d], cy) || !map.walkable(cx, cy + DY[d]))) continue;
    const ni = ny * W + nx, ng = cg + (d < 4 ? STRAIGHT : DIAG);
    if (g.has(ni) && g.get(ni) <= ng) continue; // already reached more cheaply
    g.set(ni, ng);
    parent.set(ni, cur.i);
    open.push({ i: ni, f: ng + h(nx, ny), h: h(nx, ny) });
  }
}
```

Three details are typical for a game:

- **The open list is a heap.** The candidates sit in a [binary heap](https://en.wikipedia.org/wiki/Binary_heap) that
  returns the minimum in O(log n) – a sorted list would be far too slow with thousands of tiles.
- **Ties are broken in a fixed way.** If two tiles have the same f, the smaller h wins, then the smaller tile number.
  Otherwise two computers could pick different paths of the same length – and determinism would be gone.
- **Several goals.** Whoever wants to reach a building may arrive at any free tile around it; the estimate uses the
  distance to the nearest of these goals.

## What did not work {#problems}

There was no failure in this step – the value of the strict rules only showed later. When a QA session wrote
[fuzz tests](blog/qa-fog/#fuzz) the next morning, command sequences could be recorded and replayed bit for bit, and
saving and loading in the middle of a game had to produce the same final state. That only works with a deterministic
simulation.

One weakness of the pathfinding also only surfaced there: A\* does not know whether a goal is reachable *at all*. If it
lies on an island, it searches the entire reachable area until the emergency brake kicks in – up to 20,000 tiles. With
AI opponents that often picked unreachable goals, that caused stutters of over a second. The solution with region
numbers is in the article [QA rounds](blog/qa-fog/#regions).

## Try it yourself {#tips}

- **Start with rules and simulation, not graphics.** A simulation without rendering can be tested in milliseconds, and
  you find out early whether your game idea works.
- **Ban `Math.random`, `Date` and floating point from the game logic from day one** – retrofitting is painful.
- **Try it:** the code of this milestone is linked above. After `npm install` the tests run with `npx vitest run`, and
  you can start a script like the one above with `node`.
- **Write rules and architecture as Markdown into the repository.** Every new session – human or AI – reads them too.
