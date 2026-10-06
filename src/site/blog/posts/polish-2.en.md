---
title: Polish II: notices, circle spots, sound, blog
date: 2026-10-06T21:56:46+02:00
teaser: Nine tasks on the evening of 6 October: prioritised notices and persistent warnings, circle spots around fires, buildings and trees, female figures, alarm calls and battle music – and this blog.
milestone: true
---

## What was built {#what}

On the evening of 6 October nine branches run in parallel and are merged into `main` one after another:

- **Top bar**: faith is always shown, greyed out at 0 instead of leaving a gap.
- **Showcase**: the constant ringing when many workers move in is gone.
- **Selection**: a click on empty ground no longer selects a figure outside the view.
- **Links**: maps can be shared by link; the game menu shows the map and “Copy link”, the start menu offers
  “Continue”.
- **Female figures** are called “farmer” or “swordswoman” in their female form, show their own portrait and
  call out with the female voice.
- **Notices** have prioritised categories, identical notices are bundled (“×n”), and attacks, fires and an
  unconscious hero stay up as persistent warnings.
- **Alarm call and battle music**: hit soldiers call out too, and the battle music ends shortly after the last
  hit involving the player.
- **Circle spots**: resting, waiting and woodcutting figures stand on fixed points of a circle around their
  target instead of in tile centres.
- **Blog**: one article per milestone, with key figures and a link to the source code of that state.

## How {#how}

- **One source per question:** a figure's sex is stored only in the character manifest (`"sex": "m"|"f"`). Rendering,
  selection card and sound read it through the same pure functions (`figureSex`); the simulation is unchanged.
- **Deterministic circle spots:** directions come from a fixed integer table on a 5° grid (`src/sim/dirs.js`). The
  spot is stored in `e.slot`, is part of the state hash, and old save games are converted on load.
- **Notices as a model:** `src/game/notices.js` decides priority, per-category limits and bundling. The engine rebuilds
  persistent warnings from the game state every tick instead of storing them as events.
- **Checked clicks:** `pickFigure` is a pure function with tests. Only figures drawn in this frame, with their hit
  point inside the view, can be selected.
- **Merging in order:** each branch first receives the current `main`. Conflicts are resolved so that both sides keep
  their behaviour, then `npm test`, the build and the affected E2E specs run.

## What didn’t work {#problems}

- **Ringing:** in the showcase a little over one worker per second moved in, and each one played the harp chord. The
  0.4 s cooldown didn't help; only quiet times per event type (8 s for moving in) in the `NotifyGate` stopped it.
- **Phantom selection:** figures just behind the camera got huge screen coordinates and thus a huge pick radius. On
  “Crowd”, more than 80 % of clicks on empty grass selected a figure outside the view.
- **Silent troops:** usually a soldier is hit, not the captain. Soldiers had no speaking role, though, and the militia
  got lines without recordings. When merging with the female figures, the militia also had to call out with the serf
  voice of its own sex again.
- **Battle music too long:** it depended on slowly decaying “heat” and kept playing for half a minute after large
  battles. Other players' fights in view triggered it as well.
- **Slow tests:** under software rendering, E2E tests managed too few ticks; the campfire test now fast-forwards with
  `stepOnce`. Timeouts under load were re-run on their own before counting as failures.

## Try it yourself {#tips}

- Throttle sounds from mass events per event type, not per single case.
- Define properties such as a figure's sex in exactly one place and read them everywhere through the same function.
- Rebuild ongoing states such as “under attack” from the game state every time instead of carrying them around as
  notices.
- Merge parallel branches one by one and test after each step; that way it stays clear which merge broke something.
