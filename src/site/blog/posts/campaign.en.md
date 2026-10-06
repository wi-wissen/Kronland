---
title: Campaign “Crown of Ice” and a painted world
date: 2026-10-04T23:17:24+02:00
teaser: Six “Crown of Ice” missions with new heroes, diplomacy and tributes – and the courage to cut half an expansion again.
milestone: true
---

## What was built {#what}

- **Campaign:** the serf’s daughter Nelia gathers the shards of a broken crown together with the merchant
  Orrin. New are several heroes per player, diplomacy, talking characters and tributes (buy or fight), six missions.
- **A painted world:** six seamless ground textures from an image model, favicon and app icons from the painted
  crown, trees with levels of detail by screen height, modernised learning adventures.

## How {#how}

- First a concept note matching the story against the mechanics of the original, then concept sheets of the heroes
  (`openai/gpt-5.4-image-2`), then the missions – and afterwards the bot’s mission matrix again.
- Ground textures: several candidates per kind, compared on an overview sheet tiled 2 × 2, then made seamless and
  shifted to the game’s colour palette (`scripts/asset-gen/ground.mjs`).

## What didn’t work {#problems}

- **Too much content:** tavern, thief, scout and musketeers from the expansion didn’t fit the campaign. They were
  removed again – only bridges, wells and monuments remained. That is why this milestone deletes over 4,000 lines.
- Mission 3 was rebuilt after the first attempt (valley, gate or gorge, thaw).
- Ground textures with single striking shapes repeat visibly; good ones are even images without a dark border.

## Try it yourself {#tips}

- Built quickly doesn’t mean it has to stay: cutting is cheap with agents, maintaining is not.
- Tile texture candidates before choosing – repetition only shows in context.
- Check the story against the mechanics first, then write missions.
