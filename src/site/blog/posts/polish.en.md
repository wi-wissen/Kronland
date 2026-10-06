---
title: Polish: crowds, melee, mount
date: 2026-10-06T19:12:10+02:00
teaser: A stress test with about 2,500 entities reveals hangs. Then: a robust game loop, surrounding in melee, a new Nelia and a horse with its own gaits.
milestone: true
---

## What was built {#what}

On the afternoon of 6 October seven tasks run in parallel and land on `main` within 22 minutes: painted menu
icons, double-click selects all visible units of the same kind, melee in a circle, buildings
without colour streaks at the widest zoom, hangs in the “Crowd” map fixed, a new Nelia and the
Meshy horse as a mount.

## How {#how}

- **Crowd** (`?mission=bustle`): about 2,500 entities, four AI opponents, two endless battles – measured without
  graphics with `scripts/stress-run.js`. State hashes must be identical before and after.
- **Nelia** was made this time by editing the female serf’s sheet instead of from scratch: same build, only hair,
  cloak and trousers changed.
- **Horse:** rigged by hand in the Meshy web interface (by the project owner), gaits written with an own script, game
  model remeshed to about 2,000 triangles.

## What didn’t work {#problems}

- **Hangs:** the enemy search took 42 % of the computing time; faster search and region updates brought the tick from
  19.9 down to about 7 ms. The game loop now has a time budget per frame and drops backlog instead of entering a death spiral.
- **Autosave:** `toDataURL` on a GPU canvas waited for all WebGL frames and froze the game – the thumbnail is now drawn
  on a canvas in main memory.
- **Shaders compiled mid-game** froze the game for up to 70 s under software rendering; models that appear later are drawn once during warm-up.
- Generated from scratch, Nelia came out bulky although the template was slender; Gemini painted the cloak raspberry
  red and Meshy shifted it towards violet – a recolouring step turns both back to the team colour.

## Try it yourself {#tips}

- Build your stress test as a normal map – then it can be played and measured at any time.
- Optimise with hash comparison: identical behaviour is proven, not just felt.
- When a generator misses the character, edit a successful template instead of rolling the dice again.
