---
title: Economy
date: 2026-10-03T12:17:09+02:00
teaser: Workers who eat and sleep, workshops, taxes and research: the economic loop of the original in one step.
milestone: true
---

## What was built {#what}

Serfs and resources become an economy: workers with a workplace, a house and a farm, mines, refining in workshops,
motivation, taxes, research and buildings upgraded in levels.

## How {#how}

- Every value lives in data tables under `src/sim/data/` (buildings, professions, balance), not scattered through the
  code. That pays off twice: balance changes are one line, and the website’s compendium later generates its tables
  straight from this data.
- Twenty new Vitest cases check the loop of work – food – sleep – motivation – payday.

## What didn’t work {#problems}

The first values were an approximation. A day later a separate task revisited the balance: an analysis
of the refiners tuned motivation, houses and farms, troops got their own values with the ratios of the original, and
every map got a guaranteed supply of wood nearby.

## Try it yourself {#tips}

- Balance belongs in data, not in code. Then an agent can change it precisely without touching logic.
- Note the source of every rule (for us the community documentation of the original) – so you can check later whether something is intentional.
