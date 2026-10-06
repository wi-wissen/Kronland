---
title: Parallel branches: missions, game systems, sound, HUD
date: 2026-10-04T02:45:55+02:00
teaser: Five branches at once – missions, game systems, graphics, sound and a bilingual HUD – and a night in which it all comes together.
milestone: true
---

## What was built {#what}

On the evening of 3 October several branches run in parallel for the first time:

- **Missions:** a runtime with objectives, triggers and actions, tutorial, a campaign with five missions, hooks in the simulation.
- **Game systems:** building technologies, a marketplace with shared prices, weather tower and weather plant, captain experience, fire, repair and ruins.
- **Graphics:** levels of detail, GPU instancing for characters with animations baked into a bone texture, particle effects.
- **Sound:** 38 synthesised effects, generative music (lute, harp, flute via Karplus-Strong), ambience, a manifest for own files later.
- **Interface:** German and English, a new HUD in wood, parchment and brass, phone portrait and landscape with 44 px touch targets.

## How {#how}

- The branches cut the game along layers (simulation, rendering, sound, interface) – so they rarely touch the same files.
- Extension points instead of rewrites: missions hook in through three documented hooks, building panels via `registerBuildingSection()`, sound via small hooks in the engine.
- The simulation’s rejection reasons become language-neutral codes (`err.notEnoughResources`); the interface translates them.

## What didn’t work {#problems}

Merging was the hardest part: the UI branch was merged last and had to bring HUD, two languages, game systems,
graphics and sound together (done at 02:45). A recruiting test failed under software rendering because the
simulation tick came later under load – it now waits longer.

## Try it yourself {#tips}

- Plan parallel work along the architecture’s layers and agree on interfaces first.
- Merge the branch with the most cross-references (for us the interface) last.
- Put texts behind keys and dictionaries from the start – adding a second language later costs a whole branch.
