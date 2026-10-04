// Coding adventure 2: conditions (if/else) and the while loop – a path with corners.

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv2',
  kind: 'adventure',
  order: 2,
  title: { de: 'Der Weg zur Ruine', en: 'The Way to the Ruin' },
  summary: { de: 'Mit while und if findet Nelia selbst den Weg um Fluss, See und Mauern herum.', en: 'With while and if, Nelia finds her own way around river, lake and walls.' },
  briefing: {
    de: 'In der alten Ruine liegt ein Schatz. Der Weg dorthin führt am Fluss, am See und am Wäldchen entlang – und jedes Mal, wenn etwas im Weg ist, geht es rechts herum weiter. Statt jeden Schritt aufzuschreiben, kann Nelia selbst schauen: hero.can_step() ist True, wenn vor ihr frei ist, und hero.turn_right() dreht sie nach rechts. Eine while-Schleife wiederholt, bis sie am Ziel steht.',
    en: 'A treasure lies in the old ruin. The way there runs along the river, the lake and the grove – and every time something is in the way, it continues to the right. Instead of writing down every step, Nelia can look for herself: hero.can_step() is True when the way ahead is free, and hero.turn_right() turns her right. A while loop repeats until she reaches the goal.',
  },
  victoryText: { de: 'Nelia hat die Ruine erreicht.', en: 'Nelia reached the ruin.' },
  learn: { de: ['while-Schleife', 'if/else', 'Bedingungen'], en: ['while loop', 'if/else', 'conditions'] },
  world: { base: 'flat', width: 22, height: 16, fog: false, starts: [{ x: 3, y: 2 }], places: { goal: { x: 11, y: 7, r: 0 } } },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
  texts: {
    intro: { de: 'Geradeaus, bis etwas im Weg ist – dann rechts herum. So komme ich bestimmt in die Ruine.', en: 'Straight ahead until something is in the way – then turn right. That way I will surely get into the ruin.' },
    goal: { de: 'Erreiche das Innere der Ruine', en: 'Reach the inside of the ruin' },
    hint: { de: 'Tipp: while not hero.is_at(place("goal")):  →  darin if hero.can_step(): … else: …', en: 'Tip: while not hero.is_at(place("goal")):  →  inside: if hero.can_step(): … else: …' },
    win: { de: 'Geschafft! Und ich habe mir keinen einzigen Schritt merken müssen.', en: 'Made it! And I did not have to remember a single step.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Fluss im Osten, See im Süden, Wäldchen im Westen – und mittendrin eine alte Ruine
for y in range(world.height):
    world.set_water(17, y)
    world.set_water(18, y)
for x in range(0, 17):
    world.set_water(x, 13)
    world.set_water(x, 14)
for x in range(2, 6):
    for y in range(8, 13):
        add_tree(x, y)
# Mauerreste der Ruine: oben, rechts und unten, der Eingang liegt im Westen
for x in range(6, 14):
    add_pile("stone", x, 6, 60)
for y in range(7, 11):
    add_pile("stone", 13, y, 60)
for x in range(7, 13):
    add_pile("stone", x, 10, 60)
add_pile("gold", 12, 8, 150)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    objective("goal", "goal", lambda: hero.is_at(place("goal")))
    say("nelia", "intro")
    wait(60)
    if not hero.is_at(place("goal")):
        message("hint")

@on_objective("goal")
def arrived(id, status):
    say("nelia", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`# Ziel: place("goal"). Was tun, wenn vor Nelia ein Baum steht?
while not hero.is_at(place("goal")):
    hero.step()
`,
    },
  ],
};
