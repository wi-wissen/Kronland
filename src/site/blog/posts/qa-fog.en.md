---
title: QA rounds, balance and fog of war
date: 2026-10-04T09:51:07+02:00
teaser: An independent QA session finds 26 issues, fuzz tests throw nonsense at the simulation, a bot wins the campaign on four maps, and fog of war arrives – with an AI that does not cheat.
milestone: true
---

## What was built {#what}

In the night to 4 October a separate QA session examines the game – QA stands for
[quality assurance](https://en.wikipedia.org/wiki/Quality_assurance). It plays in the browser on desktop and phone
(portrait and landscape, German and English), writes fuzz and endurance tests and reviews the risky areas of the code.
In parallel a mission bot plays every campaign mission until it wins all of them on four maps within the time limit.
In the morning fog of war follows: vision per team, explored areas, buildings as last seen – and an AI that only knows
what it has seen. 57 new Vitest tests come with it.

## Testing by someone who did not build it {#independent}

Whoever wrote the code tests it with the assumptions they wrote it with – and overlooks the same cases twice. So a
*new* session that had not written a single line of the game got an explicit brief: find bugs, do not confirm that
everything works. Every finding goes into `docs/QA-BERICHT.md` with severity, steps to reproduce and fix. In the end it
lists 26 findings, all fixed. A selection:

| Severity | Finding | Fix |
|---|---|---|
| High | Every game start left the old renderer including its WebGL context in memory: 50 → 96 MB after five starts. | `Renderer.dispose()` frees scene, caches, terrain and water – afterwards 50 → 52 MB. |
| High | Stutters of more than a second per tick with AI opponents. | Region numbers (see below) – a 60-minute AI endurance run in 34 s instead of about 10 min. |
| Medium | A command with `building: 'toString'` crashed the simulation. | Tables are only looked up with their own keys (`Object.hasOwn`). |
| Medium | Towers of defeated players kept shooting and could not be attacked. | The “is enemy?” check now works in both directions. |
| Low | State hash without weather, frost and troop levels. | Fields added to the hash – otherwise a divergence would only show up late. |

A [memory leak](https://en.wikipedia.org/wiki/Memory_leak) in JavaScript? Yes, it exists even though the browser
cleans up memory automatically: [garbage collection](https://en.wikipedia.org/wiki/Garbage_collection_%28computer_science%29)
only removes objects that *nothing refers to any more*. If some cache or event listener still holds a reference to the
old renderer, everything attached to it stays – graphics memory included. The chain was found with a heap snapshot in
the developer tools.

## Fuzzing: nonsense with a system {#fuzz}

[Fuzzing](https://en.wikipedia.org/wiki/Fuzzing) means bombarding a program with random, often absurd input and
watching whether it crashes or ends up in an impossible state. For Kronland this matters a lot, because in the planned
multiplayer mode commands come from other people’s computers – and *one* malicious command that crashes the simulation
would hit every player.

The fuzz test uses a seeded random generator to create long command sequences from several players. Most are plausible
(build, buy, attack), but nonsense keeps turning up:

```js tests/sim/fuzzHelpers.js
const GARBAGE = ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'nope', null, 42, …];
…
{ type: 'buySerf', player: p, count: r.pick([-3, 0, 1e9, NaN, 2.5]) },
{ type: 'setTax', player: p, level: r.pick([-1, 5, 2.5, 'x', NaN]) },
```

Every 250 ticks the test checks **invariants** – statements that must *always* be true, whatever happened:

```js tests/sim/fuzzHelpers.js
for (const r of RESOURCES) {
  const v = p[acc][r];
  if (!Number.isInteger(v) || v < 0) bad.push(`P${p.id} ${acc}.${r}=${v}`);   // stock: integer, never negative
}
…
if (e.px < 0 || e.py < 0 || e.px >= W || e.py >= H) bad.push(`${tag} outside …`); // nobody outside the map
if (!wp || !wp.workers.includes(e.id)) bad.push(`${tag} workplace …`);            // references in both directions
```

The clever part comes from the determinism of the [first article](blog/simulation-core/#determinism): the test records
every command. If it finds a bug, it can be reproduced *bit for bit* as often as you like with the same command list. And
it checks saving on top: run to the middle, save, load via JSON, continue with the same commands – the final state must
be exactly the same as without the interruption.

```js tests/sim/fuzz.test.js
const b = fuzzRun({ ...c, replay: a.log });
expect(b.hashes).toEqual(a.hashes);                         // replay = identical
const first = fuzzRun({ ...c, ticks: half, replay: a.log });
const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(first.sim))));
const rest = fuzzRun({ ...c, sim: loaded, from: half, replay: a.log });
expect(loaded.hash()).toBe(a.sim.hash());                   // save + load = no interruption
```

That is how the fuzz test found the crash caused by `building: 'toString'` in tick 1,259: the simulation looked up
`BUILDINGS['toString']` – and found the built-in method every JavaScript object has instead of a building.

## Regions: check first, then search {#regions}

The most expensive finding concerned the pathfinding from the [first article](blog/simulation-core/#pathfinding). A\*
quickly finds a path *if there is one*. If there is none – the goal is on an island or across the river – it first has
to search the whole reachable area before it can give up. And that happened all the time, because the AI opponents
sent serfs to unreachable trees: up to 1,724 futile searches in 150 seconds.

The solution: the map numbers its **regions** in advance – connected walkable areas, in graph theory
[connected components](https://en.wikipedia.org/wiki/Component_%28graph_theory%29). A flood fill starts at every walkable
tile that has no number yet and gives all reachable tiles the same number:

![Regions via flood fill: water splits the map into region 1 and 2, an enclosed pond holds region 3. If start and goal lie in different regions, the answer is immediate.](blog/qa-fog/regions-en.svg)

```js src/sim/map.js
computeRegions(frozen) {
  const reg = new Int32Array(n), queue = new Int32Array(n);
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (reg[s] || !ok(s)) continue;               // already numbered or not walkable
    id++;
    let head = 0, tail = 0;
    queue[tail++] = s; reg[s] = id;
    while (head < tail) {                          // breadth-first search
      const k = queue[head++], x = k % W, y = (k / W) | 0;
      if (x > 0     && !reg[k - 1] && ok(k - 1)) { reg[k - 1] = id; queue[tail++] = k - 1; }
      if (x < W - 1 && !reg[k + 1] && ok(k + 1)) { reg[k + 1] = id; queue[tail++] = k + 1; }
      if (y > 0     && !reg[k - W] && ok(k - W)) { reg[k - W] = id; queue[tail++] = k - W; }
      if (y < H - 1 && !reg[k + W] && ok(k + W)) { reg[k + W] = id; queue[tail++] = k + W; }
    }
  }
  return reg;
}
```

After that, “reachable?” is a single lookup: `regionAt(start) === regionAt(goal)`. The numbering is only recomputed
when something changes (a tree falls, a house is built) – for that the map increments a version counter on every
change, and only the next lookup recomputes (*lazy evaluation*). In winter, when the ice holds, there is a second
numbering.

Result: the 60-minute endurance run with four AI opponents on the largest map took 34 seconds instead of about ten
minutes, the slowest tick 120 ms instead of 1.6 s. And since then the AI opponents only plan reachable goals.

## A bot plays the campaign {#bot}

Is a mission too hard or too easy? You can measure that. The mission bot is a player program that – like the AI – only
issues commands the interface could issue too. It has a strategy per mission (build plan, research, recruiting plan)
and plays it through without a screen. `scripts/campaign-matrix.js` has it play every mission on four maps and writes
a table:

| Mission | Time limit | Wins | Duration (min) | Passive bot |
|---|---:|---:|---:|---|
| c1 | 20 | 4/4 | 3.2–4.0 | – |
| c2 | 30 | 4/4 | 9.6–9.8 | loses (min 6–8) |
| c3 | 40 | 4/4 | 16.3–19.7 | loses or gets stuck |
| c4 | 40 | 4/4 | 3.4–3.9 | loses when the thaw comes |
| c5 | 60 | 4/4 | 16.5–23.1 | loses (min 19–20) |

The last column is a **control test**: a “passive” bot only builds its economy and does not fight. It *must* lose –
otherwise the mission would be no challenge. Before the tuning the bot won mission 5 on only one or two of four maps;
afterwards on all of them.

## Fog of war {#fog}

Until now every player saw the whole map – the enemy castle and every enemy troop included.
[Fog of war](https://en.wikipedia.org/wiki/Fog_of_war#In_video_games) changes that. For every team each tile is in one
of three states:

- **unexplored** – black, you know nothing;
- **explored** – the terrain is known, enemy buildings appear as you *last saw* them;
- **visible** – right now in view of one of your figures or buildings.

![The start with fog: only the surroundings of the castle are explored, the rest of the map (and the minimap at the bottom left) is black.](blog/qa-fog/fog.webp)

The fog belongs to the **simulation**, not the graphics – because it decides what a player (and the AI) may know. Every
five ticks the vision circles of all figures and buildings are “stamped” again. To make that fast, the circles are
stored in advance as row widths, and each row is a single `fill()` call on a byte array:

```js src/sim/systems/vision.js
function stamp(v, vis, exp, cx, cy, r) {
  const s = spans(r);                                // half width per row, precomputed
  for (let y = Math.max(0, cy - r); y <= Math.min(v.H - 1, cy + r); y++) {
    const hw = s[y - cy + r];
    const x0 = Math.max(0, cx - hw), x1 = Math.min(v.W - 1, cx + hw);
    const k = y * v.W;
    if (vis) vis.fill(1, k + x0, k + x1 + 1);        // visible
    if (exp) exp.fill(1, k + x0, k + x1 + 1);        // explored (never cleared)
  }
}
```

The vision ranges live – of course – in a data table: castle and towers see far, workers barely beyond their farm, rain
and snow shorten the view.

And the AI? It gets **the same information** as a human. It only knows enemy troops if its team sees them, enemy
buildings only as last seen. As in the original, it only knows the start positions at first. So fairness is not a
property of the AI but a rule of the simulation: the AI simply *cannot* know more. The one exception: the hard level
notices enemies near its own castle even in the fog.

## What did not work {#problems}

Besides the findings above there was one that shows how tricky pathfinding can be: **troops cut water corners** and got
stuck. The search forbade diagonal steps at corners (see [Simulation core](blog/simulation-core/#pathfinding)), but the
movement between two waypoints ran in several sub-steps – and a sub-step could still slip across the corner. Since then
every sub-step goes at most into a neighbouring tile, diagonally only if both neighbours are walkable: the same rule as
in the search.

And the fog raised an uncomfortable question: until then the AI had played with perfect information. How should it
attack if it cannot see the enemy? The answer follows the original: it marches to the known start positions and
attacks whatever it sees there.

## Try it yourself {#tips}

- **Have the code checked by a session that did not write it** – with the explicit brief to find bugs.
- **Write down invariants** (“stock never negative”, “nobody outside the map”) and check them in fuzz and endurance
  tests. They find bugs nobody thought of.
- **A bot that has to win the campaign is a balance test that never gets tired** – with a control test.
- **The AI’s fairness is a rule of the simulation, not of the AI:** it only gets what its team sees.
