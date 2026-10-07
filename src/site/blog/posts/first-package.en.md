---
title: Start menu, saving, PWA and CC0 models
date: 2026-10-03T12:48:26+02:00
teaser: With free KayKit models, a start menu, save games, a PWA and CI, Kronland is fully playable for the first time an hour after the first commit – and shows how to swap graphics without touching the rules.
milestone: true
---

## What was built {#what}

The step with the most files of the first day (116): free 3D models from two KayKit packs by Kay Lousberg, a start
menu, saving and loading, offline support as a Progressive Web App and a CI pipeline that runs all tests on every push.
Three minutes later the file extension of the models becomes configurable. Just under an hour after the first commit
Kronland can be played from start to finish for the first time: start a game, build, fight, save, continue later.

![The first start menu: number and strength of opponents, your own hero – and the “map” field. The number in it is the seed: whoever enters the same number gets the same world.](blog/first-package/start-menu.webp)

## Free models: glTF and CC0 {#assets}

Making your own 3D graphics takes a long time – in Kronland they only arrived two days later. To have something
presentable right away, the project uses ready-made models under the [CC0](https://en.wikipedia.org/wiki/Creative_Commons_license)
licence: the author waives all rights, and you may use the files without conditions. He is still credited – that is
simply good manners.

The models come in the [glTF](https://en.wikipedia.org/wiki/GlTF) format (more precisely `.glb`, the binary variant).
glTF is often called “the JPEG of 3D”: it holds triangle meshes, materials, textures, bones and animations in a form
the browser can load directly. A script prepares the raw files and compresses them with *meshopt* so the game loads
faster:

```bash scripts/build-assets.sh
opt() { npx gltf-transform optimize "$1" "$2" --compress meshopt … ; }
for c in blue red green yellow; do
  for b in castle tavern home_A home_B windmill blacksmith lumbermill mine barracks …; do
    opt "$HEX/buildings/$c/building_${b}_$c.gltf" "$OUT/buildings/${b}_$c.glb"
  done
done
```

Which model belongs to which building type is a mapping table in the renderer:

```js src/render/assets.js
export const BUILDING_ASSETS = {
  headquarters: ['castle'],
  villageCenter: ['tavern'],
  residence: ['home_A', 'home_B'],    // level 1, level 2
  farm: ['windmill'],
  smithy: ['blacksmith'],
  …
};
```

## Swap the graphics, keep the rules {#swap}

This is where the strict separation from the [first article](blog/simulation-core/#commands) pays off. The simulation
only knows types and levels: “residence, level 1, on tile (41, 37)”. *What* a residence looks like is decided by the
renderer alone. If a model is missing (or still loading), the home-made placeholders of boxes and cones step in.

You can make that visible: the same test script that built the settlement in the [Economy](blog/economy/#what) article
was run again against the new state. Same seed, same commands – so exactly the same game state, just drawn differently:

![The same game state twice: left with the home-made shapes of the previous milestone, right with the KayKit models. Every building stands on the same tile, every number in the top bar is the same.](blog/first-package/same-state.webp)

The renderer only learns from the simulation what exists by asking – it has no game state of its own. Software
engineering knows the pattern as [model–view–controller](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller):
the simulation is the model, Three.js and Vue are views, and the input turns clicks into commands.

## Saving means: state as text {#save}

How do you save a running game? Actually quite simply – if the simulation is built cleanly. You write its *entire*
state into a JavaScript object, turn it into text with `JSON.stringify` and store it in the browser (`localStorage`).
Loading goes the other way round.

```js src/sim/serialize.js
export function saveGame(sim, extra = {}) {
  return {
    version: SAVE_VERSION,
    seed: sim.seed,
    tick: sim.tick,
    nextId: sim.nextId,
    rng: sim.rng.getState(),      // the four numbers of the random generator!
    weather: sim.weather,
    pending: sim.pending,         // commands waiting for the next tick
    map: { width: sim.map.width, height: sim.map.height, heights: toB64(sim.map.heights), … },
    …
  };
}
```

Two details are instructive:

- **The random generator is saved too.** Without its state the loaded game would draw different “random” numbers than
  the original – and continue differently.
- **Large number arrays as Base64.** The height map is an `Int32Array` with more than 9,000 entries. As a JSON list it
  would be huge; as [Base64](https://en.wikipedia.org/wiki/Base64)-encoded bytes it is compact.

Whether saving is *really* complete is checked by a test that is only possible thanks to determinism: two AI players
play 4,000 ticks, the game is saved and loaded, then original and copy each run 3,000 more ticks. At the end the hashes
must be equal.

```js tests/sim/save.test.js
const json = JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) }));
const sim2 = loadGame(JSON.parse(json));
expect(sim2.hash()).toBe(sim.hash());                       // equal right away …
for (let i = 0; i < 3000; i++) { tick(sim, ais); tick(sim2, ais2); }
expect(sim2.hash()).toBe(sim.hash());                       // … and five minutes later
```

If someone later forgets to save a new field, this test fails. That is why the project rules say: new simulation state
belongs in `serialize.js` and in the hash.

## Offline like an app {#pwa}

A [Progressive Web App](https://en.wikipedia.org/wiki/Progressive_web_app) is a website that behaves like an installed
app: you can add it to the home screen, it starts full screen – and it runs without internet. That is made possible by
a **service worker**: a script that sits between the page and the network and can answer requests from its own cache.

Kronland has the service worker generated by the `vite-plugin-pwa` plugin. Code, pages and icons are stored up front on
the first visit; the large models only when they are needed:

```js vite.config.js
workbox: {
  globPatterns: ['**/*.{js,css,html,png}'],   // up front: code, pages, icons
  globIgnores: ['models/**'],                 // models not up front (too large)
  runtimeCaching: [
    { urlPattern: /\/models\/.*\.glb$/, handler: 'CacheFirst', … },  // remembered on first load
  ],
},
```

*CacheFirst* means: if the file is already in the cache, the network is not even asked. How to prevent players from
keeping old files forever kept the project busy again later (keyword: content hash in the file name).

## Tests on every push {#ci}

[Continuous integration](https://en.wikipedia.org/wiki/Continuous_integration) (CI) means: with every change that
lands in the repository, a server rebuilds the project and runs all tests. On GitHub this is called GitHub Actions and
is a small YAML file:

```text .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test                                  # Vitest
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e                          # Playwright
      - uses: actions/upload-artifact@v4               # on failure: images and logs
        if: failure()
```

For a project where AI agents write the code this is especially valuable: a session may have forgotten to run all the
tests – CI never forgets.

## What did not work {#problems}

Some web hosts do not serve `.glb` files (unknown file type, error 403 or a wrong MIME type). Solution: before the game
loads, `window.KRONLAND_MODEL_EXT` can set a different extension (e.g. `.json` for an embedded version).

The KayKit models themselves only stayed for two days: on 5 October own graphics, made with image models and Meshy,
replaced them almost completely. Scaffolding, construction stages, rubble and rocks remained. That this swap was
possible without a single change to the game rules is the best proof of separating simulation and rendering.

## Try it yourself {#tips}

- **Become playable early with CC0 packs, make your own graphics later.** The licence spares you every legal question;
  credit the authors anyway.
- **Test saving with “save, load, keep playing, compare”** – not just “it loads”.
- **Set up CI on day one.** Agents rely on green tests, and CI sees what a session forgot.
