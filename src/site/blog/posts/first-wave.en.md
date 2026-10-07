---
title: The first wave: developer mode, slopes, saves, website
date: 2026-10-04T16:31:12+02:00
teaser: A CLAUDE.md for every session, then a dozen tasks in parallel. How to watch A* while it searches, how a slope becomes a building site and how a save game stays loadable a year from now.
milestone: true
---

## What this is about {#what}

Up to this milestone, sessions mostly worked on the game one after another. On 4 October that changes: between
10:29 and 11:15 five tasks start at the same time, and more follow until the afternoon. Each one runs in its own
session on its own Git branch. At 13:30 a file called `CLAUDE.md` lands in the repository, after which the results
are merged into `main` one by one.

What gets built:

- **Developer mode:** wireframes, levels of detail, A\* pathfinding you can watch, grid views and statistics –
  explicitly meant for computer science lessons too.
- **Building on slopes:** the simulation levels the building site, and the build preview shows it in yellow.
- **Save games:** several slots, autosave, export and import as a file.
- **Website:** the game moves to `play/`; next to it there are a home page, a manual and a reference that reads its
  tables straight from the game data.
- Plus expansion content, long-press tooltips on phones, a close zoom, an icon atlas from an image model and a camera
  that handles like a map app.

This article picks three topics that show a lot of computer science: watching the pathfinding, levelling a slope and
the file format of save games. But first: how do you get many tasks worked on at once?

## Many sessions, one rulebook {#rules}

An AI session starts without any memory of earlier sessions. It sees only the code and what it is told. When five
sessions work at once, each one has to find out on its own that the simulation may only use integers, that every
text must be bilingual and that the game has to work on phones. That costs time, and each one may draw different
conclusions.

The solution is simple: a file in the root directory that every session reads first. `CLAUDE.md` is short and
contains only what really applies to everyone – the tech stack, the most important commands and a list of fixed
rules. An excerpt:

```text CLAUDE.md (translated)
- Simulation (src/sim) is deterministic: integers only (milli-tiles, isqrt),
  seeded RNG, no Math.random, no Date, fixed 100 ms tick. …
- All texts bilingual via src/i18n (de.js, en.js, t()) …
- Think of phones: touch, no hover, small screens.
- New logic gets Vitest tests, visible features a Playwright spec.
```

(The original file is in German; this is a translation.) Why the simulation has to be this strict is explained in
[article 1](blog/simulation-core/). What matters here is something else: with this file, one long conversation
becomes many short, independent assignments. Each task gets a branch, and before it is merged into `main` it pulls in
the current state of `main` and runs all tests. That way a conflict between two tasks shows up when merging, not
later while playing.

![From 4 October several sessions work in parallel, each on its own branch. The results are merged into main one after another.](blog/first-wave/branches-en.svg)

You know this principle from any software project with several people. If you are curious about the tools, start
with [Git](https://en.wikipedia.org/wiki/Git) and [version control](https://en.wikipedia.org/wiki/Version_control).

## Watching the pathfinding {#astar}

How characters find their way is explained in [article 1](blog/simulation-core/): the map is a grid of tiles, and the
[A\* algorithm](https://en.wikipedia.org/wiki/A%2A_search_algorithm) searches it for the shortest path. A quick
reminder: A\* rates each tile with

```pseudo
f = g + h
g = cost so far from the start (straight steps 10, diagonal 14)
h = estimated remaining cost to the goal (octile distance)
```

and always examines the tile with the smallest `f` next. The *open list* holds tiles that have been discovered but
not examined yet, the *closed list* the ones already examined.

Developer mode lets you watch exactly that. You pick a character, tap a goal, and the game replays the search step by
step: turquoise is the open list, orange the closed list, yellow the path found.

![In the middle of the search: the character stands by the castle, the goal (magenta) lies behind a rocky ridge. Orange marks the tiles already examined, turquoise the edge of the search. The panel keeps count: 34 open, 297 closed.](blog/first-wave/astar-mid.webp)

![At the end: the yellow path leads around the rock. For a path of 57 steps A* examined 706 tiles – heading straight for the goal simply does not work here.](blog/first-wave/astar-end.webp)

### Measuring without interfering

What is interesting is how this is built. The simulation must not notice the display at all – otherwise two
computers with and without developer mode would no longer be in the same state. So developer mode runs the search
**a second time** with exactly the same function `findPath` and passes it an *observer*: a function that is called
at every step and takes notes.

```js src/dev/astar.js
export function recordSearch(map, sx, sy, goals, maxNodes = 20000) {
  …
  const observer = (kind, i, gv, hv, p) => {
    type[n] = kind === 'open' ? EV_OPEN : kind === 'close' ? EV_CLOSE : EV_GOAL;
    tile[n] = i; g[n] = gv; h[n] = hv; parent[n] = p;
    n++;
  };
  const path = findPath(map, sx, sy, goals, maxNodes, observer);
  …
}
```

In normal play the observer is `null`. The pathfinding then only checks `if (observer)` at each point – which costs
practically nothing. A Vitest test makes sure the search returns the same paths with and without an observer and that
the simulation's state hash stays unchanged.

The recording is a list of events in [typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays)
(`Uint8Array`, `Int32Array`). For playback, `SearchPlayback` rebuilds the state of every tile up to any step: forwards
step by step, backwards simply from the start again. Instead of storing the state at every moment, you store the
events and recompute the state when needed. This pattern is called
event sourcing.

### Ideas for lessons

The developer mode documentation (`docs/ENTWICKLERMODUS.md`) contains lesson ideas. Two of them:

- **Understanding the heuristic:** pick a goal on open grass and one behind an obstacle. Why is the closed list narrow
  in the first case and wide in the second? What would happen if `h` were always 0? (Then A\* turns into
  [Dijkstra's algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm), which searches equally far in all
  directions.)
- **Checking reachability first:** “colour regions” shows connected walkable areas. If the goal is on an island, the
  game does not even start searching. How do you find such regions? (With a
  [breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search) that colours every reachable tile; more in [article 8](blog/qa-fog/).)

## Building on slopes {#slope}

Until now you could only build on flat ground. The original game also allows buildings on slopes and digs the site
flat. The rule is simple: there may be at most 4 m of height difference under a building (`BALANCE.maxSlope`). If
that holds, the simulation levels the ground when the construction site is placed.

Heights are stored as integers in centimetres in an array, one number per tile. Levelling happens in two steps:

1. The **target height** is the rounded mean of all tiles under the building. Each of these tiles is set to the
   target height.
2. **Transition:** a ring one tile wide around it moves along. Tiles on an edge move half the way to the target
   height, tiles on a corner a quarter. That way no vertical step appears.

![Cross-section of a slope. Blue is the ground before, the columns show the heights after: the site sits at the mean, the border tiles move half the way.](blog/first-wave/slope-en.svg)

The code is short:

```js src/sim/systems/terrain.js
export function padHeight(map, x, y, w, h) {
  let sum = 0, n = 0;
  for (…) { sum += map.heights[map.idx(i, j)]; n++; }
  return Math.floor((2 * sum + n) / (2 * n));   // rounded, integers only
}

export function levelSite(sim, x, y, w, h) {
  const target = padHeight(map, x, y, w, h);
  // 1. site to the target height
  for (…) H[k] = target;
  // 2. ring around it: edge half, corner a quarter
  for (…) {
    if (F[k] & KEEP) continue;              // water, cliffs, neighbouring buildings stay
    const d = target - H[k];
    H[k] += corner ? Math.trunc(d / 4) : Math.trunc(d / 2);
  }
  sim.events.push({ type: 'terrainChanged', x: x - 1, y: y - 1, w: w + 2, h: h + 2 });
}
```

Two things here are typical of the whole project. First: the mean is rounded with
`Math.floor((2 * sum + n) / (2 * n))`. That is a trick to round half up without decimals, because the simulation only
knows integers. Second: the simulation only changes its numbers and reports an event `terrainChanged` with the
affected rectangle. The rendering listens for it and rebuilds just that part of the terrain mesh. Simulation and
graphics stay separate.

The ring around the site leaves water, cliffs and neighbouring buildings alone (`F[k] & KEEP` checks the tile's
[bit flags](https://en.wikipedia.org/wiki/Bit_field)). Otherwise a new house would shift its neighbour's foundation.

## Save games that may grow old {#saves}

Saving sounds easy: turn the state into text, store it, done. It gets hard over time. The game changes constantly,
new buildings are added, fields are renamed. A save from today must still load in the game a year from now.

### The envelope

That is why a save consists of two parts: an *envelope* with format information and metadata, and the actual
simulation state.

```json
{
  "format": "kronland-save",
  "formatVersion": 1,
  "gameVersion": "1.0.0",
  "meta": { "name": "Mission 2 – 0:42:10", "savedAt": "…", "tick": 25300,
            "mode": "mission", "mission": "c2", "seed": 42, "players": 2, "fog": true },
  "state": { … }
}
```

The list of save slots only reads `meta` – it does not need to understand the whole state. `state`, on the other
hand, is exactly what `saveGame()` returns from the simulation.

### Migrations

When the format changes, `formatVersion` goes up. For each step there is a small function that lifts a document from
version *v* to *v + 1*. When loading, they are applied in order:

```js src/save/format.js
export const MIGRATIONS = {
  // version 0: the earlier "bare" save without an envelope
  0: (state) => ({ format: FORMAT, formatVersion: 1, gameVersion: 'unknown',
                   meta: { name: '', savedAt: new Date(0).toISOString(), ...describeState(state) },
                   state }),
};
```

```pseudo
// when loading, as pseudocode:
v = detectVersion(doc)
while v < FORMAT_VERSION:
    doc = MIGRATIONS[v](doc)
    v = v + 1
```

Each migration only needs to know the difference between two neighbouring versions; an ancient save simply walks
through all the steps. Databases do exactly the same; there it is called
[schema migration](https://en.wikipedia.org/wiki/Schema_migration).

### Where the data lives

The browser has two stores. `localStorage` is simple but small (usually about 5 MB) and *synchronous*: while it
writes, the page stands still. [IndexedDB](https://en.wikipedia.org/wiki/IndexedDB) is a small database in the browser
with much more room, and it works *asynchronously*. The game tries IndexedDB first, then `localStorage`. If both are
missing (some private windows), it at least keeps saves in memory and says so. Everything is stored compressed.

## What did not work {#problems}

- **Save games** needed six follow-up fixes. A timeout for IndexedDB fired when the game was keeping the main thread
  fully busy. Changes from several open tabs had to become *atomic* – read, modify and write in a single
  [transaction](https://en.wikipedia.org/wiki/Database_transaction) – otherwise one tab overwrites the other's change.
  And dragging a file onto the page accidentally opened it in the browser instead of importing it.
- **Icon atlas:** Gemini delivered a beautiful sheet, but in the wrong grid (14 × 7), with invented and duplicate
  icons and the word “TAX” despite being told not to. It could not be mapped automatically. The GPT image model kept
  to the grid.
- **E2E under software rendering:** the Playwright tests run without a graphics card, every frame is computed on the
  CPU. Save/load, labels and groups needed much longer timeouts.

## Try it yourself {#tips}

- Write down the shared rules before you parallelise – otherwise every session works them out again.
- Small tasks with a clear, testable result are best suited for parallel work.
- If you want to watch an algorithm, call it a second time with an observer instead of rebuilding it.
- Give every file format a version number from the start. Migrations are cheap if you plan for them early.
- Plan relative paths (`siteUrl()`) early if a website is going to grow next to the game.
