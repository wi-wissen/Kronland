---
title: 3D rendering and controls
date: 2026-10-03T12:08:15+02:00
teaser: Three.js shows the world, mouse and touch control it, and Playwright checks it from day one on desktop and phone.
milestone: true
---

## What was built {#what}

Sixteen minutes after the simulation core, rendering arrives: Three.js draws terrain, buildings and characters,
controls work with mouse and touch, and there is a first interface. One minute later comes a one-line change: the
build gets a relative base path.

## How {#how}

- Rendering and interface only read the simulation state; they never change it directly but send commands.
- The first three Playwright tests run in two profiles: desktop and phone (Pixel 7).
- `base: './'` in the Vite config: every path is relative, so the game runs from any subfolder of a server.

## What didn’t work {#problems}

Absolute paths would have tied the game to the root of a server – hence the quick follow-up. Later the downside of
the E2E tests showed: without a graphics card they run on software WebGL (SwiftShader) and are slow. Time limits had
to be raised again and again; since then the rule in `CLAUDE.md` is: generous timeouts, run only the affected specs,
one port per session.

## Try it yourself {#tips}

- Keep simulation and rendering strictly apart. Then the graphics can be replaced completely without touching the rules.
- Set up Playwright with a phone profile before the interface grows – adding touch later costs more.
- Use relative paths from the start if the game should run on any web space.
