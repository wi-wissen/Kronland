---
title: Military and AI opponents
date: 2026-10-03T12:35:21+02:00
teaser: Combat, towers, heroes and weather – and an AI opponent that plays through the same commands as the human.
milestone: true
---

## What was built {#what}

Two steps in four minutes: first the military (combat, towers, heroes, militia, weather, victory and defeat), then
an AI opponent that builds, researches, raises an army, attacks and defends.

## How {#how}

- The AI is a player like any other: it reads the state and sends commands into the simulation. Everything stays
  deterministic, and AI matches can run in Node without graphics (`scripts/ai-match.js`).
- Weather is part of the rules: in winter rivers freeze and become paths.

## What didn’t work {#problems}

The AI was too trusting at first. The next morning the QA round found that it kept sending serfs and troops to
unreachable targets – up to 1,724 futile path searches in 150 seconds, stutters of over a second. The fix came from the
simulation: region numbers show at once whether a target can be reached, and the AI only plans reachable building
sites and targets (afterwards: zero failed attempts in the same matches).

## Try it yourself {#tips}

- Let the AI play through the public command interface, never with special privileges – then it is fair, too.
- AI against AI without graphics is the best endurance test for simulation and performance.
