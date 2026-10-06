---
title: Start menu, saving, PWA and CC0 models
date: 2026-10-03T12:48:26+02:00
teaser: With free KayKit models, a start menu, saves, PWA and CI, Kronland is fully playable for the first time, one hour after the first commit.
milestone: true
---

## What was built {#what}

The step with the most files of the first day (116): CC0 models from Kay Lousberg’s KayKit Medieval Hexagon Pack,
a start menu, saving and loading, offline support as a progressive web app and a CI pipeline that runs Vitest and
Playwright on every push. Three minutes later the model file extension becomes configurable.

## How {#how}

- Free placeholder models instead of own art: the game looked like something right away, and rendering could be
  developed against real models.
- GitHub Actions runs `npm test` and the E2E tests; on failure the Playwright results are attached.

## What didn’t work {#problems}

Some web hosts don’t serve `.glb` files. Fix: `window.KRONLAND_MODEL_EXT` allows another extension (e.g. `.json`).
The KayKit models themselves stayed only two days – on 5 October own art replaced almost all of them; scaffolding,
construction stages, rubble and rocks remain.

## Try it yourself {#tips}

- Get playable early with CC0 packs, make your own art later. The CC0 licence avoids every legal question.
- Set up CI on day one: agents rely on green tests, and CI notices what a session forgot.
