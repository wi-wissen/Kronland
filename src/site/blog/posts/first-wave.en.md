---
title: The first wave: developer mode, slopes, saves, website
date: 2026-10-04T16:31:12+02:00
teaser: A CLAUDE.md for every session, then a dozen tasks in parallel: developer mode, building on slopes, saves, website and more.
milestone: true
---

## What was built {#what}

On 4 October five tasks start between 10:29 and 11:15, more follow until the afternoon. At 13:30 `CLAUDE.md` is
added to the repository, and then the results land on `main` one after another:

- **Developer mode:** wireframe and levels of detail, A\* path finding step by step, grid overlays, statistics – also for computer science lessons.
- **Building on slopes:** the simulation levels the building site, the preview shows it in yellow.
- **Save slots:** several slots in IndexedDB (otherwise localStorage), autosave, export and import as JSON with format version and migration.
- **Expansion content**, long-press tooltips on phones, close zoom, spreading groups, an icon atlas from an image model, a camera like a map app.
- **Website:** the game moves to `play/`, plus home page, a bilingual manual and a wiki generated from the game data.

## How {#how}

- Every task is its own session with its own branch; the current `main` goes into it before it is taken over.
- `CLAUDE.md` records what every session must know: stack, deterministic simulation, two languages, phones, licences, tests before taking a change over.
- Paths to the website root go through `src/paths.js` – the basis for the game, the manual and later this blog living in subfolders.

## What didn’t work {#problems}

- **Save slots** needed six follow-up fixes: the IndexedDB deadline fired when the main thread was busy, changes across
  several tabs had to become atomic, drag and drop accidentally opened the file in the browser.
- **Icon atlas:** Gemini delivered a beautiful sheet, but in the wrong grid (14 × 7) with invented and duplicate icons
  and the word “TAX” despite the instruction – impossible to map automatically. The GPT image model kept the grid.
- **E2E under software rendering:** save/load, labels and groups needed longer time limits.

## Try it yourself {#tips}

- Write down the shared rules before you parallelise – otherwise every session works them out again.
- Small tasks with a clear result suit parallel agents best.
- Plan multi-page paths (`siteUrl()`) early if a website is to grow next to the game.
