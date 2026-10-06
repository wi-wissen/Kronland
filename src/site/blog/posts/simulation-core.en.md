---
title: Simulation core
date: 2026-10-03T11:51:52+02:00
teaser: Before anything was visible, the simulation was in place: integers, seeded randomness, a fixed tick and a hash over the whole state.
milestone: true
---

## What was built {#what}

The very first commit contains no image and no button, only the core of the game: a tile map with a map generator,
A\* path finding, serfs who build and gather resources, and payday. It also brings the game rules
(`docs/SPIELREGELN.md`) and the architecture (`docs/ARCHITEKTUR.md`) – written down before there was anything to play.

## How {#how}

- The simulation in `src/sim` uses integers only (positions in milli-tiles), rolls dice with its own seeded random
  generator (`rng.js`) and runs on a fixed 100 ms tick. Commands are its only input.
- `hash.js` hashes the state. The same commands produce the same hash sequence on every machine – the basis for tests,
  saves, bots and later lockstep multiplayer.
- From the start, Vitest checks basic rules, economy, map generator and determinism.
- The numbers follow the community documentation of the model, “The Settlers – Heritage of Kings”; names and texts
  are original.

## What didn’t work {#problems}

There was no failure in this step. The value of the strict rules only showed later: when a QA session wrote
fuzz tests the next morning, command sequences could be logged and replayed bit for bit, and saving and loading
mid-game had to lead to the same final state – only possible with a deterministic simulation.

## Try it yourself {#tips}

- Start with rules and simulation, not graphics. A simulation without rendering can be tested in milliseconds.
- Ban `Math.random`, `Date` and floating-point logic in the simulation from day one – retrofitting it is painful.
- Put rules and architecture into the repository as Markdown: every new agent session reads them.
