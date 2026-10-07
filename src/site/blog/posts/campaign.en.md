---
title: Campaign “Crown of Ice” and a painted world
date: 2026-10-04T23:17:24+02:00
teaser: Six “Crown of Ice” missions with heroes, diplomacy and tributes – how a mission is built as data with conditions and actions, how an AI image becomes a seamless ground texture, and why half an expansion disappeared again.
milestone: true
---

## What this is about {#what}

On the evening of 4 October Kronland gets a story. Nelia, a serf's daughter, finds the shard of a broken crown under
an old root. The merchant Orrin immediately turns it into a legend: Nelia is the lost princess. The lie is never
resolved, but it carries the two of them through six missions, up to the final enemy Malvor, who keeps the land in
winter with an old weather engine.

For this the game needs new mechanics:

- **several heroes per player** with their own abilities (Nelia, Orrin, later Taran),
- **diplomacy** – players can be hostile, neutral or allied; villages without a castle are player slots of their own,
- **talking characters** with an exclamation mark that only a particular hero can address,
- **tributes**: offers you can pay for, often as a choice between “buy or fight”.

At the same time the world gets “painted”: six ground textures and the app icons come from an image model, and trees
get levels of detail based on their size on screen (like the characters, see [article 10](blog/characters-coding/)).

![Mission 1 “Lindgrund” on the evening of 4 October: deep winter, objectives at the top left, Orrin speaking below. Castle and houses are still the KayKit models, the ground texture is already painted. (The interface is German here.)](blog/campaign/c1-dialog.webp)

## Check the story against the mechanics first {#story}

The story came as a short brief from the project owner. Before a single mission was made, it was checked against the
original's mechanics in a concept note (`docs/KAMPAGNE.md`). Principle: only mechanics from the base game. If
something is missing, the story is adapted or the original's mechanic is rebuilt – never invented. A few examples from
the table:

| What the story wants | How the game does it |
|---|---|
| Food, grain, granaries | There is no food resource (as in the original): farms supply workers directly. Objectives say “bed and food for workers”. |
| Crown shards | Mission flags (`flag`), no inventory – as in the original. |
| Buy or fight | Tributes: two offers of the same group exclude each other. |
| Taran changes sides | He is removed from the enemy and placed anew with the player. |
| Thaw | Weather power plant; whoever stands on the ice during a thaw drowns. |

That sounds like bureaucracy, but it saves a lot of work: every new mechanic has to be built, tested, added to the
save format, translated and explained in the manual.

## A mission is a file full of data {#mission}

How do you control a mission? You could write code for each mission that checks every tick what is going on. Kronland
does it differently: a mission is essentially a **description** – a JavaScript object with players, objectives and
events. A shared runtime (`src/sim/missions/runtime.js`) works through that description. This is the head of
mission 1:

```js src/sim/missions/campaign/c1-lindgrund.js
export default {
  id: 'c1', seed: 1101, size: 96,
  title: t('Lindgrund', 'Lindgrund'),
  weatherCycle: [['winter', 18000], ['summer', 6000]],   // ticks: deep winter
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin'], serfs: 6, stock: { gold: 500, clay: 1400, … } },
    { kind: 'bandits', look: 'soldiers' },
    { kind: 'village', name: 'neighbors' },
  ],
  setup(ctx) { … },     // find places on the random map
  start: [ say('nelia', 'Der Speicher ist leer. …', 'The granary is empty. …'), … ],
  objectives: [ … ],
  npcs: { … },
  events: [ … ],
};
```

`t(de, en)` turns two texts into a bilingual object – a test checks that every mission file contains both languages.

### Places without fixed coordinates

The map of mission 1 is a random map with a fixed seed (1101). Instead of hard-coding coordinates, `setup` searches
for the important places starting from the manor: the “old root” lies 11 tiles towards the map centre, the
neighbouring village 20 tiles to the side, the collectors come from 28 tiles away. The search always runs in the same
order, so with the same seed the result is always the same – deterministic, like everything in the simulation.

```js
const root = site(ctx, api.toward(hq, mid, 11), { from: hq });
if (root) {
  api.plantTrees(sim, root, 6, 3);
  ctx.ref('oldRoot', { x: root.x, y: root.y, r: 2 });
}
```

### Objectives, events, actions

An **objective** has a type the runtime knows: `reach` (a character reaches a place), `build` (this many buildings of
a kind), `workers`, `destroy`, `flag` and a few more. When an objective is met, its actions run (`onDone`). An
**event** consists of a condition (`when`) and actions (`do`). Conditions can be combined with `any`, `all` and `not` –
which is nothing but Boolean logic with or, and and not:

```js
{ id: 'collect',
  when: { type: 'any', of: [
    { type: 'time', at: 240 },
    { type: 'all', of: [{ type: 'objective', id: 'root' }, { type: 'time', at: 150 }] },
  ] },
  do: [
    { type: 'spawn', owner: 'bandits', ref: 'collectors', at: 'collectorFrom',
      units: [{ def: 'spear1', count: 2, soldiers: 2 }], order: 'attackMove', target: 'humanHq' },
    say('collector', …, 'In the name of the governor! …'),
    say('orrin', …, 'Collectors! Nelia, those are only a few spearmen. …'),
    { type: 'reveal', id: 'collectors' },
    { type: 'camera', at: 'collectors' },
  ] },
```

![The event from mission 1 as a tree: the collectors arrive after 240 seconds – or already after 150 if Nelia has found the shard.](blog/campaign/events-en.svg)

In computer science this pattern is called [event-condition-action](https://en.wikipedia.org/wiki/Event_condition_action).
Databases use it for *triggers*, and the original game's missions work with such triggers too. The big advantage of
data over code: the runtime is tested once, and a new mission can do little wrong. Where an action needs to do more, a
function `(sim, m) => { … }` may stand in its place.

Because the runtime is part of the simulation, everything from [article 1](blog/simulation-core/) applies: it runs in
the fixed 100 ms tick, and its state (which objectives are met, which events have fired) belongs in the save game and
in the state hash.

### Tributes: paying is a command

A tribute is an offer in the mission panel. Two offers with the same `group` exclude each other:

```js src/sim/missions/campaign/c4-eisenhain.js
tributes: {
  mercs:    { group: 'help', cost: { gold: 1400 },
              text: t(…, 'Hire mercenaries: 4 battle-ready troops'),
              onPaid: [{ type: 'spawn', owner: 'human', at: 'humanHq', units: [ … ] }, …] },
  refugees: { group: 'help', cost: { gold: 400 },
              text: t(…, 'Take in runaway serfs: 8 serfs and supplies'), … },
},
```

What is interesting is how the “Pay” button works. The interface does not subtract any gold itself. It sends the
simulation a **command** `{ type: 'mission', action: 'tribute', id }`. The simulation checks whether the offer is still
open and the money suffices, and otherwise refuses with an error code (`err.notEnoughResources`). That is the ground
rule of the whole game: the only input of the simulation is commands. That is also why a match could be played over a
network by exchanging nothing but the commands.

![Mission 4 “Eisenhain”: two offers of the same group – mercenaries for 1,400 gold or runaway serfs for 400. Paying for one removes the other.](blog/campaign/c4-tribute.webp)

### Testing missions without a screen

How do you test six missions that take half an hour each? With a bot that plays them without graphics (introduced in
[article 8](blog/qa-fog/)). Because simulation and rendering are separate, the game runs in Node just as it does in the
browser, only much faster. `scripts/campaign-matrix.js` plays all missions on several seeds and reports where the bot
gets stuck or a mission is too easy. After the first version of mission 3 the result was clear: it was rebuilt, with a
valley reached either through a heavily guarded gate or a frozen gorge.

## Painted ground {#ground}

Until now the code painted the ground textures itself, with noise functions. Now they come from an image model. That
sounds simple – order a picture, done – but there is a catch: a ground texture is tiled, laid next to itself many
times like floor tiles. If the left and right edges do not match, you see a grid of seams across the whole map. Despite
the request “seamless tileable”, image models almost never deliver truly tileable images.

### The shifted-copy trick

The script `scripts/asset-gen/groundtex.mjs` makes every image tileable in two passes, first horizontally, then
vertically. In each pass:

1. Shift a copy of the image by half its width (what falls out on the right comes back in on the left). The copy is
   automatically seamless at its edge – there, two spots meet that were neighbours in the original. In exchange it now
   has a seam in the middle.
2. Blend original and copy: only the copy at the edge, only the original in the middle, a soft transition over 22 % of
   the width in between.

![One pass: the original (A|B) has a seam at the edge, the shifted copy (B|A) in the middle. The weight curve below takes only the good part of each.](blog/campaign/seamless-steps-en.svg)

```js scripts/asset-gen/groundtex.mjs
const smooth = (t) => t * t * (3 - 2 * t);           // soft S-curve
export function edgeWeight(i, n, band) {              // 0 at the edge, 1 in the middle
  const d = Math.min(i + 0.5, n - i - 0.5) / Math.max(1, band * n);
  return smooth(Math.max(0, Math.min(1, d)));
}
// per pixel: original a, copy b shifted by half the width, weight t
const m = t + (brightness(a) − brightness(b)) · 3 · t · (1 − t) · 4;  // the brighter one wins
out = a · m + b · (1 − m);
```

The S-curve `t² · (3 − 2t)` is called [smoothstep](https://en.wikipedia.org/wiki/Smoothstep) and appears all over
computer graphics wherever something should start and end gently. The brightness term prevents a “double exposure”
stripe: instead of laying two blades of grass half-transparently on top of each other, the brighter one wins in the
transition.

The script also measures whether it worked: `seamRatio` compares the colour jump across the tile boundary with the
typical jump between neighbouring pixels in the image. A value around 1 means nothing more happens at the seam than
anywhere else.

![Test with an arbitrary crop of the meadow texture, tiled 2 × 2 each. Left unprocessed: at the red marks you can see the seams (ratio 2.5). Right after makeSeamless: ratio 1.0, the seams are gone.](blog/campaign/seamless.webp)

Afterwards the mean colour is shifted towards the game's colour palette – image models like to paint too garishly. The
image's light-dark variation is kept. Several candidates were generated per ground type and compared on an overview
sheet, each tiled 2 × 2.

## What did not work {#problems}

- **Too much content:** the tavern, thief, scout and musketeers from the expansion ([article 9](blog/first-wave/)) did
  not fit the campaign. They were removed again; only bridges, wells and the monument stayed. That is why this
  milestone deletes almost 4,000 lines – nearly as many as it adds.
- **Mission 3** was rebuilt after the first version (valley, gate or gorge, thaw).
- **Ground textures** with single striking shapes – a big stone, a dark flower – repeat visibly, however seamless they
  are. Even images without a dark border work best.
- **Old heroes:** the previous heroes were too close to the original in looks and ability names and were replaced by
  our own.

## Try it yourself {#tips}

- Describe missions as data (conditions and actions) and write the runtime only once.
- Never let the interface change the game state itself – it sends commands, the simulation checks them.
- Tile texture candidates before choosing – you only see repetition in a group.
- Check the story against the mechanics first, then write missions.
- Deleting is cheap with agents, maintaining is not: what does not fit may go again.
