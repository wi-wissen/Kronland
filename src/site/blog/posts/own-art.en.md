---
title: Own art instead of KayKit
date: 2026-10-05T22:54:41+02:00
teaser: The biggest branch: buildings in three levels, 24 professions, soldiers, heroes, trees – all own models from image AI and Meshy, until the credits ran out.
milestone: true
---

## What was built {#what}

The work ran from the evening of 4 October to the evening of 5 October and touched more than 2,000 files.
Afterwards Kronland has its own art: every building in its upgrade levels, 24 professions (male and female each),
soldiers, riders, heroes, bandits, trees with winter versions, bridge, ruins, campfire, portraits and a cannon. Of the
KayKit pack only scaffolding, construction stages, rubble and rocks remain. Plus a small fix for the top bar.

## How {#how}

- **Concept:** buildings from the game’s icons plus a house template the owner had made in ChatGPT. After comparing the
  GPT image model, Gemini and Seedream, Seedream 5.0 Flash ($0.02 per image) became the default for buildings.
- **All upgrade levels in one image** (the owner’s idea) – same construction, same scale; uniform terracotta roofs; one
  more storey and finer material per level. Later also a back view so Meshy doesn’t invent the rear.
- **3D:** Meshy 7.1 from one or two views, post-processing with own scripts, in-game shots per zoom level (`ingame.mjs`).
- The cannon was made in a separate session and joined afterwards.

## What didn’t work {#problems}

- **Tools in the hand looked “miserable”** (the owner’s verdict): generated animations know nothing about tools. With
  the weapon in the concept, Meshy fused the sword with the leg; in A-pose it dropped held items altogether. Fix for
  soldiers: the weapon is part of the model, held away from the body, the concept’s pose kept, the blade bound rigidly to the hand bone by a script.
- **The Meshy credits ran out:** the first run managed 36 building levels, 12 characters and the horse, the rest
  aborted. Since then every step is recorded in a job file and resumed instead of paid for again.
- **Animation files:** Meshy delivers the whole model with texture for every clip – 1,470 MB, losslessly cut to 16 MB.
- **Image models:** German building names appeared as lettering, numbers like “1.5 × width” were ignored, pits became
  cut-out cubes of earth (“flat like a rug” helped). The merchant with scales lost his head in the rig twice – he now carries no scales.

## Try it yourself {#tips}

- Style comes from reference images, not words – and never pass your own intermediate results on as style references, flaws are inherited.
- Generate things that belong together in one image (all levels of a building).
- Record prompt, model, cost and job ID per file (for us under `assets-src/`) and keep a budget log.
