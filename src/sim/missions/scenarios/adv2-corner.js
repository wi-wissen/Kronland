// Coding adventure 2: conditions (if/else) and the while loop – a path with corners.

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv2',
  kind: 'adventure',
  order: 2,
  title: { de: 'Immer an der Wand lang', en: 'Follow the Wall' },
  summary: { de: 'Mit while und if findet Bertram selbst durch einen verschlungenen Waldweg.', en: 'With while and if, Bertram finds his own way along a winding forest path.' },
  briefing: {
    de: 'Der Pfad durch den Dunkelwald biegt immer wieder ab – zum Glück immer nach rechts. Statt jeden Schritt aufzuschreiben, kann Bertram selbst schauen: hero.can_step() ist True, wenn vor ihm frei ist, und hero.turn_right() dreht ihn nach rechts. Eine while-Schleife wiederholt, bis er am Ziel steht.',
    en: 'The path through the Dark Forest keeps turning – luckily always to the right. Instead of writing down every step, Bertram can look for himself: hero.can_step() is True when the way ahead is free, and hero.turn_right() turns him right. A while loop repeats until he reaches the goal.',
  },
  victoryText: { de: 'Bertram hat die Lichtung erreicht.', en: 'Bertram reached the clearing.' },
  learn: { de: ['while-Schleife', 'if/else', 'Bedingungen'], en: ['while loop', 'if/else', 'conditions'] },
  world: { base: 'flat', width: 20, height: 16, fog: false, starts: [{ x: 3, y: 2 }], places: { goal: { x: 11, y: 7, r: 0 } } },
  players: [{ kind: 'human', hero: 'bertram', hq: false }],
  texts: {
    intro: { de: 'Ein Weg mit lauter Kurven. Ich muss nur schauen, ob vor mir frei ist – sonst rechts herum.', en: 'A path full of bends. I just have to check whether the way ahead is free – otherwise turn right.' },
    goal: { de: 'Erreiche die Lichtung in der Mitte', en: 'Reach the clearing in the middle' },
    hint: { de: 'Tipp: while not hero.is_at(place("goal")):  →  darin if hero.can_step(): … else: …', en: 'Tip: while not hero.is_at(place("goal")):  →  inside: if hero.can_step(): … else: …' },
    win: { de: 'Geschafft! Und ich habe mir keinen einzigen Schritt merken müssen.', en: 'Made it! And I did not have to remember a single step.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Eine Spirale aus Wegstücken, alles andere ist Wald
free = {}
def path(x0, y0, x1, y1):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            free[(x, y)] = True

path(3, 2, 15, 2)    # nach Osten
path(15, 2, 15, 12)  # nach Süden
path(15, 12, 6, 12)  # nach Westen
path(6, 12, 6, 7)    # nach Norden
path(6, 7, 11, 7)    # nach Osten zur Lichtung
for x in range(1, world.width - 1):
    for y in range(1, world.height - 1):
        if (x, y) not in free:
            add_tree(x, y)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    camera.jump_to(hero)
    objective("goal", "goal", lambda: hero.is_at(place("goal")))
    say("bertram", "intro")
    wait(60)
    if not hero.is_at(place("goal")):
        message("hint")

@on_objective("goal")
def arrived(id, status):
    say("bertram", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`# Ziel: place("goal"). Was tun, wenn vor Bertram ein Baum steht?
while not hero.is_at(place("goal")):
    hero.step()
`,
    },
  ],
};
