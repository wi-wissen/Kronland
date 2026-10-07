---
title: Parallel branches: missions, game systems, sound, HUD
date: 2026-10-04T02:45:55+02:00
teaser: Five branches at once – missions, game systems, graphics, sound and a bilingual HUD – and one night in which it all comes together. How do you work in parallel without breaking each other’s work?
milestone: true
---

## What was built {#what}

On the evening of 3 October several branches run in parallel for the first time, each in its own agent session:

- **Missions:** a runtime with objectives, triggers and actions, a tutorial, a campaign with five missions.
- **Game systems:** building technologies, a marketplace with shared prices, weather tower and weather plant,
  experience for captains, fire, repair and ruins.
- **Graphics:** levels of detail, GPU instancing for figures with animations in a bone texture, particle effects.
- **Sound:** 38 synthesised effects, generative music (lute, harp, flute), ambient sounds.
- **Interface:** German and English, a new HUD in wood, parchment and brass, phone in portrait and landscape with touch
  targets of at least 44 pixels.

With 297 changed files and 142 new Vitest tests, it is the biggest step so far.

![The new HUD on the desktop (left, with minimap and info panel) and on a phone in portrait (right). The settlement on the left was again built by the same test script as in the previous articles.](blog/parallel-branches/hud.webp)

## Branches: parallel worlds in the repository {#branches}

[Git](https://en.wikipedia.org/wiki/Git) stores the history of a project as a sequence of commits. A **branch** is a
separate line in that history: you branch off the main branch `main`, work there without disturbing the others and
finally bring the changes back together (*merge*). That way five sessions can work on five branches at the same time.

![Five branches leave main in the evening and are merged back one after another during the night – the interface branch last (schematic).](blog/parallel-branches/branches-en.svg)

The risk: two branches change the same spot in a file differently. Merging then produces a **conflict**, and someone
has to decide which version wins – or combine both. The more branches touch the same files, the more painful it gets.

## Interfaces instead of rebuilding {#interfaces}

The most important preparation was therefore to split the work **along the architecture**. Simulation, rendering,
sound and interface are separate layers (see [Simulation core](blog/simulation-core/#commands)), so each branch mostly
got its own files. Where branches did have to touch each other, small documented **extension points** were added
instead of rebuilding existing code:

- Missions hook into the simulation through three hooks: when the map is set up, in every tick and on every command.
- New building panels register themselves with `registerBuildingSection(fn)` – the info panel simply calls every
  registered function.
- Sound listens to the events the simulation reports anyway (`buildingDone`, `shot`, `killed` …) and needs not a single
  line in the simulation.

That is the [open–closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle) in practice: open for
extension, closed for modification.

## Missions as data {#missions}

In Kronland a mission is a JavaScript file that mostly *describes* instead of programming: map, starting stock,
objectives, events. An excerpt from the second campaign mission, in which bandits attack in three waves:

```js src/sim/missions/campaign/c2-fire.js
objectives: [
  { id: 'barracks', type: 'build', building: 'barracks', primary: true, text: t('Baue eine Kaserne', 'Build a barracks') },
  { id: 'army', type: 'recruit', count: 3, primary: true, text: t('Hebe 3 Einheiten aus', 'Recruit 3 units') },
  { id: 'survive', type: 'survive', until: 540, primary: true, text: t('Überstehe die Angriffe', 'Survive the attacks') },
  { id: 'protectVc', type: 'protect', ref: 'village', primary: true, text: t('…', 'The village centre must survive') },
],
events: [
  {
    id: 'wave1',
    when: { type: 'time', at: 150 },                       // trigger: after 150 seconds
    do: [                                                  // actions
      say('kunz', 'Holt euch das Dorf, Jungs! …', 'Take the village, lads! …'),
      { type: 'spawn', owner: 'bandits', at: 'banditGate', units: [{ def: 'sword1', count: 2, soldiers: 2 }],
        order: 'attackMove', target: 'village' },
      { type: 'camera', at: 'banditGate' },
    ],
  },
  …
],
```

The pattern is called *trigger → actions* and is widespread in strategy games and their map editors. The mission
runtime checks all triggers and objectives in every tick. Because it runs inside the simulation, the same rules apply:
integers only, fixed order, no `Math.random` – and its state is saved with the game. Texts are bilingual right in the
object (`t('…', '…')`).

## Hundreds of figures on the graphics card {#graphics}

Until now every figure was its own group of meshes. With 300 figures that means thousands of draw calls per frame – too
many for a phone. So the graphics branch switched to **instancing**, as trees had used from the start (see
[3D rendering](blog/rendering/#instancing)). With figures it is harder, because they move: each one has its own pose.

![Drawing one by one or instanced: with instancing the graphics card gets the shape once and a table with a few numbers per figure.](blog/parallel-branches/instancing-en.svg)

The trick: on loading every animation is “baked”. For every frame (24 per second) and every bone of the skeleton, its
transform is computed as a 4 × 4 [matrix](https://en.wikipedia.org/wiki/Transformation_matrix) and written into a
texture – a *bone texture*. Per frame each figure then only gets a few numbers: its position, which animation frame is
due, its player colour. The graphics card looks up the matching bone matrices itself and deforms the model (*skinning*).
Hundreds of figures thus cost a handful of draw calls.

Then there are **levels of detail** (LOD): a figure that is only ten pixels tall on screen does not need 2,000
triangles. Depending on the distance to the camera a simpler model is drawn. So that figures do not keep flipping at a
threshold, there is [hysteresis](https://en.wikipedia.org/wiki/Hysteresis): to simplify you have to be a bit further
away than to switch back – like a thermostat.

## Music from formulas {#sound}

The sound branch had a special brief: no audio files at first, everything generated in the browser (with the
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)). For plucked strings – lute and harp –
it uses the [Karplus–Strong algorithm](https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis), one of
the most elegant algorithms in sound synthesis:

```pseudo
buffer = n random values             # n = sample rate / pitch, e.g. 44100 / 220 = 200
repeat for every output sample:
  output = buffer[i]
  buffer[i] = (buffer[i] + buffer[i+1]) / 2 · damping   # mean = low-pass filter
  i = (i + 1) mod n
```

A buffer full of noise is played through over and over and smoothed a little each time. The noise “settles” on the
period of the buffer length – you hear a tone with the frequency sample rate / n – and the high parts fade first, just
like on a real string. In `src/audio/karplus.js` this loop takes a good 40 lines. The music itself is made from scales
and chord progressions varied by a seeded random generator. (Composed music tracks later replaced the formula music;
some of the formula effects stayed.)

## Two languages from the start {#i18n}

The interface branch made the game bilingual. Since then all interface texts live in two dictionaries with flat keys,
and `t()` looks them up in the current language
([internationalisation](https://en.wikipedia.org/wiki/Internationalization_and_localization)):

```js src/i18n/de.js
'err.notEnoughResources': 'Nicht genug Rohstoffe',
```

```js src/i18n/en.js
'err.notEnoughResources': 'Not enough resources',
```

The boundary to the simulation is interesting: the simulation knows no language. If it rejects a command, it reports a
**code** such as `err.notEnoughResources`, and only the interface turns it into a sentence. That keeps the simulation
clean – and in multiplayer every player could use a different language.

## What did not work {#problems}

Merging was the hardest part. The interface branch was deliberately merged last because it touches everything the
others make visible: it had to bring together the new HUD, bilingualism, the new game systems, graphics and sound. It
was done at 02:45 at night. Along the way the simulation’s German rejection texts were replaced by codes – a change
across many files.

After the merge a recruiting test failed under software graphics: under load the simulation tick came later, and the
test looked too early. Since then it waits longer.

## Try it yourself {#tips}

- **Plan parallel work along the layers of the architecture** and define the interfaces first.
- **Merge the branch with the most cross-references last** (for us the interface).
- **Put texts behind keys and dictionaries from the start** – adding a second language later costs a whole branch.
- **Listen to Karplus–Strong:** the loop above fits into ten lines of JavaScript with the Web Audio API and makes a
  nice weekend experiment.
