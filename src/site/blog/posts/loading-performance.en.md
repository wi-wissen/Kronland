---
title: Loading, caching and character polish
date: 2026-10-06T09:11:03+02:00
teaser: Measure first, then optimise. A content hash in the file name, a service worker that never asks twice, and close-up models only on zoom-in – a free game loads 19 instead of 35 MB. Plus: how to measure whether feet slide across the ground.
milestone: true
---

## What this is about {#what}

With the own models from [article 13](blog/own-art/) Kronland has become beautiful – and heavy. A browser game has a
problem an installed game does not: every file first has to come over the network, and a phone on mobile data feels
every megabyte. This milestone is therefore mostly about one question: **what does the game actually load, and does it
have to?**

What gets built:

- **Loading and caching:** every game file gets a content hash in its name at build time and may then stay in the cache
  forever. A load report measures what each scenario really loads.
- **Close-up models on demand:** the detailed characters only arrive when you zoom in.
- **Raw files out of Git:** a tool packs the intermediate files of the asset pipeline into an archive of their own.
- **Recognising threats:** alarm bell, voiced calls for help and a red pulse on the minimap; serfs flee from an attack
  or fight back.
- **Characters:** all the same height, legs moving at the pace of movement, fixed spots at construction sites, trees
  and campfires.

## Measure first {#measure}

Optimising without measuring is guessing. So it starts with a tool: `scripts/load-report.mjs` builds the game, starts a
local server and uses Playwright to open every scenario three times in the same browser profile:

1. **first visit** – the cache is empty,
2. **second visit** – the service worker is installed,
3. **third visit** – everything should come from the cache.

It counts every server response, sorted by type (characters, buildings, trees, textures, code …). The result before
the rework was clear: half of the start-up data were **close-up models of the characters**, about 2.4 MB per
character – although you only see them when you zoom in close.

```bash
npm run build
node scripts/load-report.mjs              # all scenarios
node scripts/load-report.mjs game --list  # every loaded file
```

## Load only what is needed {#lazy}

Why were the close-up models loaded immediately at all? Because only they contained the skeleton and the animations.
The game model (the simplified version for distance, see [article 10](blog/characters-coding/)) borrowed both from the
close-up model. So the close-up model always had to come first.

The rework turns this around: the animations move into the **game model**. The close-up model now contains only mesh
and texture, and `requestNearModel` requests it only when a character of this model first appears large enough on
screen (over ~80 pixels). Until it arrives, the game simply keeps drawing the game model – nobody notices the delay.

The same principle applies everywhere: at start the game loads only the buildings of the first upgrade level, the
serfs, the trees of the current season and the textures of the chosen quality level. Higher building levels,
professions, troops, winter trees and music tracks come when they first appear. This is called
[lazy loading](https://en.wikipedia.org/wiki/Lazy_loading).

![Data loaded on the first visit, before and after the rework. Measured with load-report.mjs in October 2026.](blog/loading-performance/load-chart-en.svg)

| Scenario | 1st visit | before | of which characters | 2nd visit from network |
|---|--:|--:|--:|--:|
| Start menu | 2.9 MB | 2.9 MB | – | 0 |
| Free game, desktop “high” | **19 MB** | 35 MB | 6.5 MB | 0 |
| Free game, phone “low” | **14.5 MB** | 19 MB | 2.1 MB | 0 |
| Campaign mission 1 | **25 MB** | 43 MB | 7.3 MB | 0 |
| Showcase (almost everything once) | **116 MB** | 192 MB | 30.5 MB | 0 |

Everything in `public/` adds up to about 250 MB. So a free game loads less than a tenth of it at start.

## The content hash {#hash}

Now the really interesting part: how do you make sure a browser **never** loads a file twice – and still gets the new
version immediately when it changes?

### The cache dilemma

Browsers have a [cache](https://en.wikipedia.org/wiki/Cache_(computing)): they remember loaded files. Next time they at
most ask the server “has `castle.lod1.glb` changed?”. Even that question costs a round trip over the network – with 100
files, 100 round trips. If instead you tell the browser “this file never changes”, it never asks again – and never
sees a changed version either.

### A name from the content

The solution: the file name contains a **fingerprint of its content**. At build time a Vite plugin computes a
[SHA-256 hash](https://en.wikipedia.org/wiki/SHA-2) for every file and appends its first ten hexadecimal digits to the
name:

```
public/models/buildings/castle.lod1.glb  →  dist/models/buildings/castle.lod1.6792949877.glb
```

```js
// scripts/vite-hashed-assets.js (trimmed)
export function buildAssetMap(publicDir) {
  const map = {};
  for (const f of listFiles(publicDir)) {
    if (!isHashed(f) || EXCLUDE.test(f)) continue;
    const hash = createHash('sha256').update(readFileSync(join(publicDir, f))).digest('hex');
    map[f] = hashedName(f, hash);          // 'models/a/b.glb' → 'models/a/b.<10 hex>.glb'
  }
  return map;
}
```

A [cryptographic hash function](https://en.wikipedia.org/wiki/Cryptographic_hash_function) like SHA-256 has exactly
the right properties: the same content always gives the same hash, and even a single changed bit gives a completely
different one. So: **same name means same content.** A file with a hash in its name may stay in the cache forever. If
it changes, it has a new name, and the browser reloads only that one.

Vite already does this for the JavaScript code (`assets/play-BySqDWCD.js`), but copies the `public/` folder unchanged.
The plugin closes this gap for ~850 game files.

### How the code finds the files

The game code of course does not know the hashed names – it wants to load `models/buildings/castle.lod1.glb`. So the
plugin writes the mapping “logical path → file” into the code as a constant `__KRONLAND_ASSETS__` (about 15 KB
compressed). Every file access goes through a small function:

```js
// src/paths.js (trimmed)
export function assetPath(path, map = ASSETS) {
  const p = clean(path);
  return map?.[p] ?? p;     // in the build: hashed name; in the dev server: unchanged
}
export function siteUrl(path) {
  return siteRoot() + assetPath(path);
}
```

This leads to a rule for all sessions that has been in `CLAUDE.md` ever since: every address of a file from `public/`
goes through `siteUrl()` or `assetUrl()`. Write `fetch('../models/x.glb')` directly and you get a 404 in the build,
because the file has a different name there.

## The service worker {#sw}

A [service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) is a small program the browser
places between page and network. Every request of the page goes to it first, and it decides: answer from its own store
or pass it on to the network. That makes Kronland a [PWA](https://en.wikipedia.org/wiki/Progressive_web_app) that also
starts offline.

For hashed files the strategy is **CacheFirst**: if the file is in the cache, the server is never asked again.

![Top: the build – the content decides the name. Bottom: the browser – what is in the cache comes without the network.](blog/loading-performance/hash-cache-en.svg)

| What | Strategy |
|---|---|
| Code, pages, CSS, interface images | in advance on the first visit, in the background (~3.6 MB) |
| Models, character manifest | CacheFirst, on first load |
| Ground and nature textures | CacheFirst, only the size of the quality level |
| Music, effects, voices | CacheFirst, on first playback |

CacheFirst would be dangerous without a hash: a changed file under its old name would stay stale forever. With a hash
it is exactly right. After an update, though, the old versions are still in the cache. So `src/cacheCleanup.js` deletes
all hashed entries the current build no longer knows, 30 seconds after loading.

The only files that must always be fetched fresh are the HTML pages and `sw.js` itself – otherwise the browser never
learns that there is a new version.

The result is in the last column of the table above: on the second visit **nothing** comes from the network any more.

### Compression

Code and JSON additionally travel compressed with [gzip](https://en.wikipedia.org/wiki/Gzip): the game code shrinks
from 1.4 MB to 0.4 MB. Models, images and sound are already compressed (Meshopt, WebP, MP3); compressing them again
gains almost nothing.

## Character polish {#figures}

### All the same height

Heroes and captains were taller in the game than serfs. That was not intended; it came from the measurement: the game
scales every character to a target height and measured the model's base pose for it (frame 0). With heroes and soldiers
that base pose is hunched, so they were measured too short and therefore drawn too tall – by about 20 %.

Now the game measures the **rest pose**: the first frame of the `idle` animation, without tools. Because the animations
now live in the game model, it always measures the same file – so the size does not jump when the close-up model
arrives later. Since then all characters are 0.81 tiles tall.

### Feet that do not slide

A classic of game programming: the character moves across the map at one speed, but the walk animation has its own
pace. If the two do not match, the feet slide over the ground as if on ice. This is called *foot sliding*.

The solution: measure how fast the animation walks “by itself”, then play it as fast as the character moves. How do you
measure that? The foot that is on the ground glides backwards relative to the body at exactly the walking speed. So for
each frame of the baked animation the game looks for the lowest points of the mesh (the bottom 3 % of the height, the
sole) and tracks how fast they move:

```js
// src/render/characters.js (trimmed)
export function strideSpeed(geo, bake, clip) {
  const feet = [];
  for (let f = 0; f < clip.frames; f++) {
    // all vertices in this frame: position = Σ weight · bone matrix · rest position
    …
    const lim = minY + (maxY - minY) * 0.03;            // sole: bottom 3 %
    feet.push(mean of the points with y ≤ lim);
  }
  const vel = [];
  for (let f = 0; f < feet.length; f++) {
    const p = feet[f], q = feet[(f + 1) % feet.length];
    vel.push(Math.hypot(q[0] - p[0], q[1] - p[1]) / dt);  // speed of the sole
  }
  vel.sort((x, y) => x - y);
  return vel[vel.length >> 1];                            // median
}
```

Why the [median](https://en.wikipedia.org/wiki/Median) and not the mean? When the feet switch, the lowest point
suddenly jumps from one foot to the other – that gives huge speeds in single frames. The median ignores such outliers,
the mean does not.

The playback rate is then simply ground speed divided by natural speed – limited to 0.6 to 2.2. Meshy's walk
animations almost walk on the spot; keeping up fully would mean seven times the pace, and that would look like
fidgeting.

```js
export function strideRate(natural, ground, fallback = 1) {
  if (!natural || !(ground > 0)) return fallback;
  return Math.min(STRIDE_RATE_MAX, Math.max(STRIDE_RATE_MIN, ground / natural));
}
```

### Fixed work spots

Until now several serfs working on the same construction site often stood exactly on top of each other. Now each gets
its own tile next to the site, the tree or the campfire. Because this affects the game state, the spot lives in the
simulation and goes into the state hash. In the next milestone it becomes a circle (see [article 16](blog/polish-2/)).

## What did not work {#problems}

- **404 in the build:** whoever loaded a file directly with `fetch('../models/x.glb')` got an error in the build, but not
  in the dev server – there are no hashes there. Hence the rule above and a helper `hashed()` for E2E tests that accepts
  both name forms.
- **Enlarged heroes and captains** looked wrong; only measuring the rest pose made everyone the same height.
- **An E2E test for the attack warning** failed because the enemy AI sent the test character away. It is now placed
  directly before the click.

## Try it yourself {#tips}

- Measure before optimising: a load report per scenario immediately shows where the megabytes are.
- Content hash in the file name plus CacheFirst in the service worker: load once, never ask again.
- Resolve all file paths through a single function – then the build can change the names.
- Load details only when they can be seen.
- Use the median for measurements with outliers.
- Keep the raw files of the asset pipeline out of Git early, otherwise the repository grows with every run.
