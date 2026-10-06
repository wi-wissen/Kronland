---
title: QA rounds, balance and fog of war
date: 2026-10-04T09:51:07+02:00
teaser: An independent QA session finds 26 issues, a bot wins the campaign on four maps, and fog of war arrives – with a fair AI.
milestone: true
---

## What was built {#what}

In the night to 4 October a separate QA session checks the game independently of the development team: playing in
the browser on desktop and phone (portrait and landscape, German and English), fuzz and endurance tests, a review of
the risky areas. In parallel a mission bot plays every campaign mission until it wins all of them on four maps within
the time limit. In the morning fog of war follows: vision per team, explored areas, last-seen buildings and an AI
that only knows what it has seen.

## How {#how}

- Seeded fuzz tests send long command sequences including nonsense (prototype keys, foreign IDs, NaN) through the
  simulation and check invariants every 250 ticks; saving and loading halfway must lead to the same final state.
- `scripts/campaign-matrix.js` plays every mission on several maps; the results are a table in `docs/MISSIONEN.md`.
- Every finding is recorded with severity, reproduction and fix in `docs/QA-BERICHT.md`.

## What didn’t work {#problems}

- **Memory leak:** every game start left the old renderer and its WebGL context in memory (50 → 96 MB after five
  starts). Fix: `Renderer.dispose()` releases everything – afterwards 50 → 52 MB.
- **Stutters of over a second:** futile path searches to unreachable targets. Region numbers stop them at once; the
  60-minute endurance run with four AI opponents then took 34 s instead of about 10 min.
- **A crash from one command** such as `building: 'toString'` – fatal for multiplayer. Tables are now looked up with own keys only.
- **Troops cut water corners** and got stuck; every sub-step now goes to at most one neighbouring tile, diagonally only if both neighbours are walkable.

## Try it yourself {#tips}

- Have the game checked by a session that didn’t write the code – with the explicit task of finding bugs.
- A bot that has to win the campaign is a balance test that never gets tired.
- AI fairness is a rule of the simulation, not of the AI: it only receives what its team can see.
