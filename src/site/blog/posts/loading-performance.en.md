---
title: Loading, caching and character polish
date: 2026-10-06T09:11:03+02:00
teaser: A content hash for every file, close-up models only on zoom-in: a free game loads 19 instead of 35 MB. Plus attack warnings and equal-sized characters.
milestone: true
---

## What was built {#what}

- **Loading and caching:** every file from `public/` gets a content hash in its name at build time and may stay in
  the cache forever; a load report measures what each scenario really loads; special maps with a stress test; a tool for
  the pipeline’s raw files, which no longer belong in Git.
- **Characters:** animations live in the game model, the close-up model loads only on zoom-in.
- **Recognising threats:** storm bell, voiced cries for help and a red pulse on the minimap; serfs flee when
  attacked or fight back like chopping wood.
- all characters the same size, legs moving at the speed of travel, fixed spots at building sites, trees and
  campfires, calmer sound; a more robust dialogue test on phones.

## How {#how}

- Measure first: `scripts/load-report.mjs` opens every scenario three times (empty, with service worker, from cache) and counts every response.
- A rule for every session: every address of a file from `public/` goes through `siteUrl()`/`assetUrl()` – only then does the build find the hashed file.

## What didn’t work {#problems}

- Half of the start-up data were the characters’ close-up models (~2.4 MB each), only because they contained skeleton
  and animations. After the rework: free game 35 → 19 MB, phone 19 → 14.5 MB, nothing from the network on the second visit.
- Loading a file directly with `fetch('../models/x.glb')` gives a 404 in the build – hence the rule above and an E2E pattern `hashed()`.
- Enlarged heroes and captains looked wrong; the game now measures the idle pose and makes everyone the same size.
- An E2E test for the attack warning failed because the enemy AI sent the test unit away – it is now placed right before the click.

## Try it yourself {#tips}

- Measure before optimising: a load report per scenario shows at once where the megabytes are.
- Content hash plus “CacheFirst” in the service worker: load once, never ask again.
- Keep the asset pipeline’s raw files out of Git early, or the repository grows with every run.
