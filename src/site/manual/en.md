## Getting started {#getting-started}

Kronland is a city-building strategy game: you found a settlement, supply your workers, research new
techniques and defend your castle against computer opponents. It runs in the browser – on a computer with
mouse and keyboard, on tablets and phones with touch.

1. Open [Play](play/). On first start the game loads its 3D models; depending on your connection this takes a few seconds.
2. If you are new, choose the **Tutorial** in the **main menu**. The merchant Orrin walks you through the basics step by step.
3. After that, try the **campaign** “Crown of Ice” or a **free game** against computer opponents on a random map.

You begin with a **castle**, {{startSerfs}} **serfs**, a hero and a small stock:

| Thalers | Clay | Wood | Stone | Iron | Sulfur |
|---:|---:|---:|---:|---:|---:|
| {{startGold}} | {{startClay}} | {{startWood}} | {{startStone}} | {{startIron}} | {{startSulfur}} |

> **The essence in one sentence:** serfs build and gather resources, workers come to your workshops on their
> own – make sure houses and farms keep them rested and fed.

![A settlement with castle, houses, farms and workshops](site/settlement.webp)

## Controls {#controls}

### Mouse and keyboard

| Action | Desktop |
|---|---|
| Select | Left-click, drag a box; [[Shift]] adds |
| Command (move, build, gather, attack) | Right-click |
| Attack-move | [[Ctrl]] + right-click or the “Attack” button |
| Pan camera | [[W]] [[A]] [[S]] [[D]] or arrow keys, drag with middle mouse button, screen edge |
| Rotate camera | [[Q]] / [[E]], [[Ins]] / [[Del]], drag with right mouse button |
| Zoom | Mouse wheel, [[PgUp]] / [[PgDn]] |
| Build | Build menu, click places the building, right-click cancels |
| Hero ability | [[X]] / [[C]] (hero selected) |
| Save control group | [[Shift]] + [[1]] … [[9]] |
| Select control group | [[1]] … [[9]], twice: camera follows |
| Idle serfs | [[.]] |
| Go to castle | [[H]] |
| Pause | [[Space]] |
| Menu, clear selection | [[Esc]] |

### Touch (tablet and phone)

| Action | Touch |
|---|---|
| Select | Tap |
| Command | With a selection, tap the ground, a tree, a building site or an enemy |
| Pan camera | Drag with one finger |
| Rotate camera | Twist with two fingers |
| Zoom | Pinch with two fingers |
| Build | “Build …”, pick a building, tap a spot, “Build here” |
| Idle serfs, castle, pause | Buttons along the bottom and top |
| Minimap | The “Map” button shows it, tap to jump there |

In the game, **Menu → Controls** shows the same overview. Set the **interface size** and **edge scrolling**
under **Settings**.

## The interface {#interface}

### Top bar

![Resources: available (large) and raw goods still to be processed (small)](site/hud-resources.webp)

![Population, motivation, weather and payday](site/hud-status.webp)

- **Resources:** thalers, clay, wood, stone, iron and sulfur – the number is what you can spend. Hover to see how
  much of it is raw material still waiting to be processed (see [Economy](#economy)). If something is missing
  for the building under the pointer in the build menu, that resource turns red.
- **Population:** used and available places. Village centres add more.
- **Motivation:** your workers’ average. Hover to see the maximum and thresholds.
- **Payday:** the round medallion in the middle fills up until the next tax income. The seconds only appear
  shortly before; on payday itself it lights up once. The hint shows expected taxes and wages.
- **Weather:** the ring shows how much of the season has passed; the exact time is in the hint.
- **Pause, speed and sound:** the speed button opens the choices 1×, 2× and 4×; the sound button mutes and sets
  music, effects and overall volume; the **menu** on the far right.

### Command bar, minimap and context panel

![Command bar with quick access, minimap and build menu](site/hud-commandbar.webp)

- **Quick access** as square buttons left of the minimap (names in the tooltip): *Castle* jumps to your castle, *Idle* selects serfs without work
  (the number on it says how many), *All* selects all serfs, *Troops* all soldiers and heroes.
- **Heroes and control groups** above the map: hero portraits are stacked; clicking one selects the hero and
  brings them into view. An unconscious hero turns grey, a ring fills up until they wake and the remaining time
  is shown below – while enemies are near it says “unconscious”.
  Shift+1 to 9 saves a selection as a group; the number key or the group plate selects it again, twice in a row
  brings it into view.
- **Minimap:** shows terrain, buildings and troops. Click or drag to move the camera.
- **Command panel:** appears as soon as you select something. With serfs it shows the **build menu** with all
  groups at a glance: *Housing*, *Raw materials*, *Refining*, *Military*, *Administration*. A red dot means
  “too expensive”, a lock “not yet researched” – the hint says what is missing.

![Minimap](site/hud-minimap.webp)

### Selecting buildings

![Castle selected: buy serfs, taxes, militia, upgrade](site/hud-building.webp)

When you select a building, the panel shows hit points, workers and all actions: **upgrade**, **overtime**,
**demolish**, research, recruiting or trading – depending on the building. Hover a button to see costs and
conditions. If something is locked, the reason is shown.

### Messages

Messages appear on the right: finished buildings, attacks, completed research, payday. Clicking a message
with a location jumps there.

**Attacks** are announced three ways: the alarm bell rings, those hit call for help (a serf for buildings,
otherwise the figure itself), and the spot pulses **red** on the minimap while fighting goes on there. On phones
the map button pulses instead.

## Building your settlement {#settlement}

### Serfs

Serfs are your all-rounders. You buy them at the **castle** for {{serfCost}} thalers. They

- **build** (up to {{maxBuilders}} per site – more helpers, faster construction),
- **fell trees** and **mine resource piles** (clay, stone, iron, sulfur),
- **repair** damaged buildings,
- **attack** just like chopping wood: select serfs and click or tap an **enemy** instead of a tree – they go at it
  with their bare fists.
- all take up pitchforks as militia with **“To arms!”** (castle) in an emergency.
- **flee** when attacked unarmed, and go back to their work afterwards.

After finishing a job they look for similar work nearby. Serfs need neither housing nor food and pay no taxes.

### Building

1. Select serfs (optional – then they start right away).
2. Pick a building in the build menu.
3. Click a free spot – slopes are fine too (see [building on slopes](#slope)). The preview turns green, yellow or red,
   and the panel shows whether it fits – and if not, why (too steep, occupied, unexplored …).

There are **no roads and no territory** – you build freely. Two exceptions:

- **village centres** only on the marked **settlement spots**,
- **mines** only on **shafts** of the matching resource.

Costs are deducted when you place the building. Demolishing refunds half.

### Upgrading

Almost every building has several **levels** (residence → medium → large residence). Upgrading costs resources, often a
technology, and takes a while; the building keeps working meanwhile. All levels, costs and requirements are
listed in the [compendium](compendium/#buildings).

### Population

How many serfs, workers and soldiers you can have depends on your **village centres**: {{popLevels}} places per
level. Places per troop unit: {{popByLine}}; heroes need none.

## Resources and economy {#economy}

| Resource | Source | Refining |
|---|---|---|
| Thalers | Taxes on payday | Bank |
| Wood | Serfs fell trees | Sawmill |
| Clay | Piles, clay pit | Brickworks |
| Stone | Piles, stone pit | Stonemason |
| Iron | Piles, iron pit | Smithy |
| Sulfur | Piles, sulfur pit | Alchemist |

- Resources go **straight** into your stock – no carriers or storehouses needed.
- Each resource has two accounts: **raw** and **refined**. Both can be spent; refined goods are used first.
- **Refiners** fetch raw goods themselves and turn them into **twice the amount**. A brickworks turns 100 clay into 200 bricks.
- **Resource piles** run out, **shafts** never do. Build mines early – miners work much faster than serfs.
- The **marketplace** (upgraded storehouse) trades resources in steps of {{marketStep}}. Selling a lot lowers the
  price – for every player.

## Workers, motivation and taxes {#workers}

### Workers

Workers arrive **on their own** from the village centre whenever a workshop, mine or university has a free
place and population allows. You don’t control them directly.

Their day: **work → eat → sleep → work again.** Every work cycle costs stamina. They eat at a **farm**
({{farmSeats}} seats per level) and sleep in a **residence** ({{residenceBeds}} beds per level). Without either they
warm themselves at a campfire – and then work only a fraction as fast.

> **Rule of thumb:** build a residence and a farm near every workshop.
> A stonemason with residence and farm produces about five times as much as one at the campfire.

### Motivation

Every worker has a motivation, starting at {{startMotivation}} %. It affects working speed.

- Rises with **low taxes**, **blessings** from the chapel and **ornamental buildings** (clock and wind wheel also raise the maximum).
- Falls with **high taxes** and **overtime**.
- Maximum {{baseMaxMotivation}} %, up to {{hardMaxMotivation}} % with ornaments.
- Below {{noNewSettlers}} % on average **no new settlers** arrive; a worker below {{leaveBelow}} % **leaves**.

### Payday and taxes

Every **{{paydaySec}} seconds** is payday: every worker pays taxes, every captain wants {{wage}} thalers in wages.
You set the tax rate at the **castle** once **Education** has been researched:

{{taxTable}}

### Overtime and blessings

- **Overtime** (button in the building) makes a workshop work faster but costs motivation.
- At the **chapel**, priests generate **faith**. With enough faith you bless a group of professions – their motivation rises noticeably.

## Research {#research}

At the **college** (later **university**), scholars research technologies in four lines: **Administration**, **Construction**,
**Alchemy** and **Military**, four levels each. Technologies unlock buildings, upgrades, troops and the tax rate.

- Level 2 of a line requires the **fortress** (upgraded castle), levels 3 and 4 the **university** (upgraded college).
- The more scholars work, the faster it goes.

There are also **building technologies**: the smithy improves armour and blades, the sawmill spears and arrows,
the alchemist cannons and weather technology, castle and village centre tracking, city guard, loom and
shoes. The full tree with costs and effects is in the [compendium](compendium/#techs).

![University selected: technologies of the four lines](site/hud-research.webp)

## Military and heroes {#military}

### Troops

You recruit units at the **barracks**, **archery range**, **riding school** and **cannon foundry**: a **captain** with
soldiers (or just the captain, filling up later). Troop types: swordsmen, spearmen, archers, light and heavy
cavalry, cannons.

- The captain is **invulnerable** as long as one of his soldiers is with him.
- Use **Refill** to buy missing soldiers – the captain must stand at the military building.
- **Upgrading** raises an entire troop type to the next level, existing troops included.
- Each troop type has strengths and weaknesses: spears against cavalry, swords against spears, cannons against buildings.
  The exact damage table is in the [compendium](compendium/#units).

![Troops selected: captains, hero and orders](site/hud-army.webp)

### Orders

| Order | Effect |
|---|---|
| Move (right-click / tap the ground) | troops walk there and ignore enemies on the way |
| Attack (right-click / tap an enemy) | attacks the target |
| Attack-move ([[Ctrl]] + right-click, “Attack” button) | walks there and attacks everything on the way |
| Hold | stays put, only fights within its own range |
| Defend | defends the area, does not chase enemies too far |

### Experience

Captains gain experience with every hit their troop lands and rise through five stars – from corporal to
general. Each star brings something: critical hits, more range, self-healing, more attack.

### Heroes

You start with one hero. Heroes don’t die: when they fall, they become **unconscious** and get back up after
{{reviveSec}} seconds without enemies nearby.

{{heroList}}

Trigger abilities with the buttons in the panel or [[1]] / [[2]]; afterwards they recharge.

### Towers and militia

**Towers** see far and, from the ballista tower on, shoot at enemies by themselves: watchtower → ballista tower → cannon tower. In an emergency,
**“To arms!”** at the castle calls all serfs to fight as militia.

![Captains with their troops and the hero in battle](site/combat.webp)

## Bridges and ornaments {#bridges}

### Bridges

Rivers divide the map – at some places you can build a **bridge**. The **Mathematics** technology (stonemason's
hut) unlocks it; the build menu then shows the possible bridge sites. Finished bridges are used by everyone,
including the enemy. If a bridge is destroyed, whoever is standing on it drowns.

### Fountain and monument

Two ornamental buildings raise your workers' **maximum motivation**: the **fountain** (from {{fountainTech}}) by
{{fountainMot}} percentage points, the **monument** (from {{statueTech}}) by {{statueMot}} percentage points. Several ornaments add up,
to the limit of {{hardMaxMotivation}} %.

## Weather {#weather}

On every map, **summer**, **rain** and **winter** alternate.

- **Rain:** ranged units hit less hard, everyone sees less far.
- **Winter:** rivers and lakes **freeze** and can be crossed – by the enemy too! Troops move more slowly.
  When it thaws, anyone still on the ice drowns.

The alchemist technology **Weather Forecasting** unlocks the **weather tower**, which announces the coming
weather. **Meteorology** unlocks the **weather power plant**: weather technicians charge energy, and with a full charge
you choose the weather yourself.

![Winter: snow on the roofs, rivers and lakes freeze](site/winter.webp)

## Fog of war {#fog}

With fog enabled, every spot on the map has one of three states:

| State | What you see |
|---|---|
| **unexplored** | black – nothing |
| **explored** | darkened: landscape, trees, resources; enemy buildings as you last saw them |
| **visible** | everything, enemy troops included |

All your figures and buildings provide sight; **towers**, the **castle** and the **weather tower** see especially
far. At the start, {{startReveal}} tiles around every castle are explored. You can only build on explored land.
Computer opponents don’t cheat: they only see what their figures see.

In a free game you can switch the fog off in the main menu.

![Fog of war: only explored land is visible](site/fog.webp)

## Building on slopes {#slope}

Kronland has hills, valleys and mountains – and you don’t have to build on flat ground only. While placing, the
**placement preview** shows in colour what will happen:

| Preview | Meaning |
|---|---|
| **green** | The ground is level – no earthworks needed. |
| **yellow** | Slope: the ground is **levelled** when the site is placed (“Site is fine – ground will be levelled”). |
| **red** | Too steep – more than **{{maxSlope}} cm** height difference under the building (“Ground too steep”). |

The footprint is levelled to its **mean height**; a narrow border around it is blended in. Neighbouring buildings,
trees, water, rock as well as settlement spots and shafts stay untouched. The pad remains even if the building is
demolished later. Cliffs and peaks can never be built on.

> **Tip:** Need a spot on a steep hillside? Try one tile further up or down – that is often enough for yellow.
> The exact formula with a worked example is in the [compendium](compendium/#slope).

![Placement preview on a slope: yellow – the ground will be levelled](site/slope.webp)

## Campaign and tutorial {#campaign}

The **tutorial** explains serfs, building, workers, research and combat in small steps. It waits until you
have done each step; “Next” and “Skip” help if you already know it.

The **campaign** “Crown of Ice” tells its story in {{campaignCount}} chapters:

{{campaignList}}

Every chapter begins with a **briefing** and has **main objectives** (must be met) and **side objectives**
(reward, glory). Objectives are always shown at the top left. Winning a chapter unlocks the next; progress and
best times are stored by your browser.
In many chapters you lead **several heroes** (Nelia, Orrin, later Taran). Figures with an **exclamation mark**
want to talk – send the right hero over. **Offers** lists tributes: paying buys a shard free or hires mercenaries,
for example. Two offers for the same thing are a choice – once you pay, the other one disappears. **Villages** can
be allied, neutral or hostile; deliveries win them back.
Click a foreign figure or building to see where it stands: a **red** dot means enemy, **gold** neutral, **green**
allied. Foreign buildings only show their level and hit points.

## Free game and settings {#free-play}

In a **free game** you choose:

- **Opponents:** 1 to 3 computer opponents,
- **Strength:** Easy, Normal or Hard,
- **Hero:** {{heroNames}},
- **Fog of war:** on or off,
- **Map:** a map number – each number always creates the same world; “Roll” picks a random one.

Whoever destroys all enemy castles wins.

**Special maps** in the main menu are ready-made single maps without victory or defeat: the **Showcase** (every
building and every figure once, without fog) and the **Bustle** (four full towns, more than a thousand figures,
two endless battles – to try how smoothly the game runs on your device). The objectives list takes you to each
place with “Show objective”.

**Settings** (main menu and game menu) contain language (German/English), graphics quality (Automatic, Low,
Medium, High), volumes for music and effects, interface size, edge scrolling and help texts.

> **For advanced players:** the game can be started directly via its address, e.g.
> `play/?seed=42&ai=hard&players=3&hero=orrin`, `&fog=off` without fog, `?mission=c1` for a campaign chapter
> or `?quality=low` for weak devices.

### Installing on your phone

Kronland can be installed as an app: choose **“Add to Home screen”** or **“Install app”** in your browser
menu. It then starts in full screen and can be played offline after the first load.

## Saving and loading {#saving}

Open the **menu** in the game ([[Esc]] or the button at the top right).

- **Save game** creates a save. You can keep **several saves**; each shows its name, date and play time. Older
  saves can be overwritten or deleted.
- **Load** lists your saves. In the main menu, **“Continue saved game”** resumes the most recent one.
- **Export** downloads a save as a **JSON file** – as a backup or to move it to another device.
- **Import** reads such a file back in.

The game also **saves automatically** at regular intervals into a slot of its own (“Autosave”). It shows up in the
list like a normal save and is overwritten every time – use a slot of your own for saves you want to keep.

Saves are kept in your browser’s storage. If you clear site data or play in a private window, they are gone –
export the ones that matter.

## Coding adventures {#coding}

In the **coding adventures** you don't steer your hero with the mouse but with a program written in **Python**.
They are meant for anyone who wants to learn programming – in class, too. No prior knowledge needed: every
adventure explains what is new.

Open **Coding Adventures** in the start menu. The adventures build on each other:

{{adventureList}}

There is also the script mission {{scriptMissions}}, a normal game whose story is written entirely in Python.

### The code panel

Your program is on the right – on a phone you open it with the golden **Code** coin. The buttons are at the top of the panel:

| Button | Effect |
|---|---|
| **Run** | starts the program; the hero carries it out in the world right away |
| **Stop** | ends the program |
| **Step** | runs exactly one statement, also into functions |
| **Over** | next line – function calls run through in one go |
| **Out** | continue until the current function has finished |
| **Continue** / **Pause** | run to the next breakpoint, or pause |

Clicking a **line number** sets a **breakpoint**. When the program pauses, the current line is highlighted green and
you see all variables and the call stack. On an error the line turns red; a box explains what went wrong and often
makes a suggestion (“Did you mean `turn_left`?”).

**Commands** lists every command with an explanation and an example you can insert with one tap. The most important:
`hero.step()`, `hero.turn_left()`, `hero.turn_right()`, `hero.ahead()`, `hero.chop()`, `hero.take()` and `print()`.

```
for i in range(10):
    hero.step()
```

On a phone a key bar helps with indentation, colon, brackets and quotes. Your code is remembered in the browser –
you can carry on at any time.

![Coding adventure: the program stops at a breakpoint (green line), the variables below](site/programming.webp)

### World editor

Under **Coding Adventures → World editor** you build your own maps: raise and lower terrain, place water, forest,
resources, start positions and named places. You write the story in Python as well – dialogues, camera flights,
objectives, attack waves. **Test play** starts your world right away; you can save it as a file and play or share
it again via **Open scenario file**.

> **For teachers:** Which parts of Python are available and every command are described in the
> [scripting documentation](https://github.com/wi-wissen/Kronland/blob/main/docs/SKRIPTE.md).

## Developer mode {#developer-mode}

How does a game work “under the hood”? **Developer mode** makes it visible – meant for the curious and explicitly
for **computer science lessons**. It doesn’t change the game; everything is read-only.

- **Switch on:** Menu → Settings → “Developer mode”, address `play/?dev=1` or key [[F3]] or [[Ctrl]] + [[Shift]] + [[D]].
- **Polygons:** wireframes of terrain, buildings and figures, coloured levels of detail, triangle counts per object.
- **Pathfinding:** tap a figure – its path and the **A\* search** step by step with open and closed list and f = g + h per tile.
- **Grids:** walkability, height map, buildability and slope, sight and fog per tile.
- **Figures:** the state of every figure (walking, working, eating, fighting …) and the simulation’s state hash.
- **Stats for nerds:** frames per second, frame time, draw calls, memory and more.

On phones the panel is a sheet at the bottom. Lesson ideas and all details are in the
[developer mode description](https://github.com/wi-wissen/Kronland/blob/main/docs/ENTWICKLERMODUS.md) (German).

![Developer mode: A* search of a figure with open and closed list](site/developer.webp)

## Tips {#tips}

1. **Buy serfs early.** More hands build faster and gather more wood.
2. **Residence and farm first, then workshops.** Without supplies workers barely work.
3. **Build the college early** and research **Education** and **Construction** – they unlock a lot.
4. **Mines instead of piles:** piles run dry eventually, shafts never.
5. **Refining pays off:** a brickworks doubles your clay.
6. **Watch your taxes:** “High” fills the treasury but costs motivation. Lower them before it drops below 70 %.
7. **Towers at the border** and barracks near the castle – the first attacks come sooner than you think.
8. **Mixed armies:** spears protect against cavalry, archers behind, swords in front.
9. **Plan for winter:** frozen rivers are gateways. Keep troops ready.
10. **Press [[.]]** to find idle serfs.

## FAQ {#faq}

**My workers are so slow – why?**
They lack a residence or farm nearby, or their motivation is low. Check motivation at the top and lower taxes if needed.

**No new workers arrive.**
Either the population limit is reached (build or upgrade a village centre), average motivation is below
{{noNewSettlers}} %, or there is no free workplace.

**Why can’t I build here?**
The spot is too steep (more than {{maxSlope}} cm height difference, red preview), occupied, unexplored or (for village centres and mines) not a settlement spot or shaft.
The panel shows the reason while placing.

**A building is locked.**
Hover over it or tap it: usually a technology is missing or the castle needs an upgrade.

**My building is on fire!**
Buildings below {{burnBelow}} % hit points burn and keep losing HP. Send serfs to repair it (right-click the building).

**My hero fell over.**
Heroes only become unconscious. After {{reviveSec}} seconds without enemies nearby they get back up.

**The game stutters.**
Choose a lower **graphics quality** in Settings or start with `?quality=low`.

**Does the game work offline?**
Yes, after the first load – especially when installed as an app.

**Where can I find exact numbers?**
In the [compendium](compendium/): all buildings, units, technologies and formulas.

## Credits and licences {#licenses}

The credits are maintained in German (original text):

{{credits}}
