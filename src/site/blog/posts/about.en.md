---
title: What this is about – a game built by AI agents
date: 2026-10-06
teaser: Kronland was built in four days with Claude Code, image and 3D models. This blog tells in hindsight, milestone by milestone, how a game works and comes into being – written for everyone who has had computer science at school and now wants to look behind the scenes.
pinned: true
---

## The idea {#start}

Kronland is a city-building strategy game in the browser – and an experiment: how far can you get when AI agents
write almost all of the code, art, music and voices, while one person sets the direction, signs off results and
decides on taste? This blog tells the story **in hindsight** – written once the game stood – for anyone who wants to
try something similar: what we used, how a working step went, what went wrong and how it was solved.

The gameplay model is named openly: **“The Settlers – Heritage of Kings”** (Blue Byte, 2004). Mechanics such as
serfs, payday, motivation, captains with troops, heroes and weather are modelled on it; the numbers come from the
community documentation (dedk.de wiki) and are referenced in the game rules. Names, texts, heroes, graphics and
sounds are original – nothing has been taken from the original game.

Work began on **{{start}}**, the latest milestone so far was completed on **{{end}}**: {{days}} calendar days,
{{milestones}} milestones. All times in this blog are Central European Summer Time.

## Who this blog is for {#audience}

It is written above all for students in their final school years – and everyone else – who have met variables, loops,
arrays, objects and perhaps graphs or recursion in computer science lessons and now want to know: **how does a real
game actually work, and how is it made?** The articles explain the ideas from the ground up, with real excerpts from
the code, pseudocode, schematic diagrams and screenshots of the very first versions of the game. Technical terms are
linked to Wikipedia.

Some of the questions you will find answers to here:

- **How does a game run without a screen?** Why the game rules are a program of their own that you can run on the
  command line and test in seconds – [Simulation core](blog/simulation-core/#headless).
- **How do figures find their way?** Grid or polygons, breadth-first search, Dijkstra and A\* with a heuristic –
  [Simulation core](blog/simulation-core/#pathfinding).
- **How do you build a random map that is still fair?** Seeds, noise, flood fill –
  [Simulation core](blog/simulation-core/#mapgen) and [Terrain and graphics](blog/terrain-graphics/#noise).
- **How do numbers become a 3D image?** Scene graph, triangles, camera, shaders – [3D rendering](blog/rendering/#scene).
- **How does an AI opponent work?** Priorities, state machines and why it cannot cheat –
  [Military and AI opponents](blog/military-ai/#ai).
- **How do you test a game?** From Vitest and Playwright to fuzz tests with nonsense commands –
  [QA rounds](blog/qa-fog/#fuzz).

You do not need to program like a professional. If you know what a loop and an object are, you can follow the code
excerpts; the text around them explains what matters.

## The numbers {#numbers}

As of {{end}}, counted in the repository:

| What | Amount |
|---|---:|
| Calendar days from the start to the latest milestone | {{days}} |
| Milestones (one article each) | {{milestones}} |
| Program code in `src/` (JavaScript, Vue, CSS) | about 49,000 lines in 227 files |
| Tests: Vitest (84 files) and Playwright (33 specs) | about 17,500 lines; {{vitestCount}} Vitest tests, every Playwright spec on desktop and Pixel 7 |
| Tool scripts (`scripts/`: asset pipeline, measurements, bots) | about 7,000 lines |
| Documentation (`docs/`) | about 4,100 lines in 19 files |
| 3D files (buildings with upgrade levels, characters, nature; with levels of detail) | 348 GLB, of which 82 building and nature models without levels of detail and 94 character files |
| Sound | 12 music tracks, 430 voice files (DE/EN), 24 CC0 effects |
| Meshy credits according to the budget log | just under 9,700 credits (the log also counts rejected jobs, so it is rather too high) |

## How this blog works {#structure}

In hindsight the work falls into {{milestones}} milestones, and each milestone has its own article here – dated with
the moment it was completed. Each article tells what was built, explains the technology behind it, reports what didn’t work and
how it was solved, and ends with tips for trying it yourself. The first articles go into the basics in particular; if
you read them in order, you build up a picture of how the parts fit together step by step. The screenshots in the
articles show what the game really looked like at that point – taken with the code of exactly that milestone. The box at the top gives time span, working time, changed lines and new tests
(`docs/milestones.json`, overview in `docs/MEILENSTEINE.md`); two links lead to the code of the milestone and to the
whole project at that state. New articles are simply added at the end.

## Tools {#tools}

### Agents

- **Claude Code** with Claude Opus 5.5 writes code, tests and documentation. Each task runs in its own session on
  its own branch and is then taken over into `main`.
- **Several sessions and subagents in parallel.** From 4 October, five or more tasks often ran at the same time
  (developer mode, building on slopes, save slots, website and expansion were all started between 10:29 and 11:15).
  A session can hand sub-tasks to subagents, for example research in the code or this blog.
- **CLAUDE.md** in the repository records the fixed rules for every session: stack, deterministic simulation,
  two languages, phones, licences, tests before taking a change over.

### Game

- **Vite**, **Vue 3** (Options API) for interface and website, **Three.js** for the 3D world – plain JavaScript
  with JSDoc, no TypeScript.
- **Deterministic simulation** in `src/sim`: integers only (milli-tiles, integer square root), seeded randomness,
  a fixed 100 ms tick, commands as the only input, a state hash. Rendering and interface only read. This makes
  tests, saves, bots and, later, lockstep multiplayer possible.
- A small **Python subset with its own bytecode VM** for the coding adventures – deterministic as well.
- **PWA** with a service worker, every game file with a content hash in its name.

### Checking

- **Vitest** for simulation, AI, rendering logic, website and tools – including fuzz tests with nonsense commands
  and endurance runs with four AI opponents.
- **Playwright** for everything visible, always on desktop and phone (Pixel 7), headless with software rendering
  (SwiftShader). Results are documented with screenshots at 1440 × 900 and in phone format.
- **Bots:** AI against AI (`scripts/ai-match.js`) and a mission bot that has to win every campaign mission on several
  maps (`scripts/campaign-matrix.js`).

### Art and sound

- **Image models via OpenRouter** for concepts, icons, portraits, title art and ground textures:
  `openai/gpt-5.4-image-2` (character sheets, icon atlas), `google/gemini-3-pro-image` (edits),
  `bytedance-seed/seedream-5-0-flash` (buildings, trees, textures; $0.02 per image).
- **Meshy** (from version 7.1 with PBR) turns the concepts into 3D models, rigs and animations. Own scripts
  (`scripts/asset-gen/`) cut the views, post-process, build levels of detail and take in-game shots.
- **Lyria 3 Pro** composes the music, **Seed Audio** speaks the voices, **Gemini** pre-listens to both
  (vocals in an instrumental piece? do the spoken words match the text?).
- **CC0 sounds** from Kenney and Freesound for work and combat noises; the rest is synthesised in the game.
- Only free (CC0) or self-generated files; the origin of every file is in the credits, prompts and job IDs are kept
  under `assets-src/`.

## Ask an AI about the code {#ask-ai}

The entire code of Kronland is public: [github.com/wi-wissen/Kronland](https://github.com/wi-wissen/Kronland). About
49,000 lines are a lot to read – but you do not have to read them alone. Give the address of the repository to an AI
assistant that can read code (Claude, for example) and ask it your questions. An AI assistant can show you files,
explain processes step by step and translate technical terms – and you can keep asking until it clicks. A few questions
to get started:

- “Explain to me what happens in `src/sim/sim.js` during a single tick – step by step.”
- “How does a serf in Kronland find his way to a tree? Show me the places in the code.”
- “Why does the simulation use no floating point and no `Math.random`? What would go wrong otherwise?”
- “How does the AI opponent decide what to build next?”
- “How does the height map in `src/sim/map.js` become the 3D terrain I see in the browser?”
- “I want to add a new building. Which files do I have to touch?”
- “How can I let two AI opponents play against each other without graphics, and what does the output mean?”

One tip: don’t just collect answers – ask for the places in the code and look at them yourself. And if something
sounds contradictory, ask again – an AI is sometimes wrong too. Incidentally, that is exactly how this game was made: in
a conversation between a human and AI agents.

## How a milestone went {#process}

1. **Describe the task.** The person states a goal in a few sentences (“building on slopes like in the original”,
   “own music instead of synthesis”).
2. **Rules first.** New mechanics go into `docs/SPIELREGELN.md` and the data tables (`src/sim/data/`) first, then into
   the simulation – with Vitest tests before anything is drawn.
3. **Rendering and interface** read the new state; texts go straight into both dictionaries.
4. **Everything visible gets a Playwright spec** and screenshots on desktop and phone. The pictures are part of the
   sign-off.
5. **Assets** run as their own pipeline: concept → preview at game size → sign-off by the person → 3D/sound →
   post-processing → in-game shot. Check cheap things first, expensive ones (Meshy credits) after.
6. **Update the docs** (README, `docs/`), bring in the current `main`, `npm test`, `npm run build`, affected E2E
   specs – then take it over into `main`. Larger branches got a review first.

## What didn’t work {#lessons}

A lot – and that is the most interesting part. Tools floating in the hand, Meshy credits running out, a memory leak
on every game start, music with vocals despite the instruction, tests too slow under software rendering: the fixes
are in the article of the milestone where the problem came up. The detailed logs are in the repository:
`docs/ASSET-ERKENNTNISSE.md`, `docs/QA-BERICHT.md`, `docs/PERFORMANCE.md`, `docs/AUDIO.md`.

## Tips for trying it yourself {#tips}

- **Rules first, then graphics.** A deterministic simulation with tests carries everything else: bots, saves, fuzz
  tests and debugging via the state hash.
- **A CLAUDE.md with fixed rules** saves explanations in every session – keep it short and point to the docs.
- **Small, parallel tasks** with their own branch; bring in the current `main` first. Big branches (for us the own
  art with more than 2,000 files) need the most coordination.
- **Document every visible change with screenshots,** desktop and phone – pictures reveal bugs no test notices
  (top bar cut off at 130 %, menu unreachable in landscape).
- **Taste stays with the human:** characters, voices and music were signed off by the owner; AI checkers (Gemini as
  the “ear”) only filter out obvious mistakes.
- **Judge assets at game size,** not in close-up – in the game a character is only about 25 pixels tall.
- **Record the origin:** prompt, model, cost and job ID for every file. That keeps licences traceable and results
  repeatable.
- **Write down what you learn** (for us `docs/ASSET-ERKENNTNISSE.md`, `QA-BERICHT.md`, `PERFORMANCE.md`) so the next
  session doesn’t take the same detours.

## Inspiration and rights {#inspiration}

Kronland is a hobby project and not an official product. The game mechanics follow “The Settlers – Heritage of
Kings” (Blue Byte, 2004); names, texts, heroes, graphics, music and voices are original or free (CC0) works.
Who contributed what is listed in the [credits in the manual](manual/#licenses).
