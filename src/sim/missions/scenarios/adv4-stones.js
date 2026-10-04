// Coding adventure 4: own functions (def) and randomness – collecting stones.

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv4',
  kind: 'adventure',
  order: 4,
  title: { de: 'Steine am Wegesrand', en: 'Stones by the Wayside' },
  summary: { de: 'Schreibe eine eigene Funktion, die links und rechts nach Steinen schaut.', en: 'Write your own function that looks left and right for stones.' },
  briefing: {
    de: 'Auf dem Weg nach Osten liegen links und rechts Steinhaufen – jedes Mal an anderen Stellen. Bertram soll alle einsammeln. hero.take() hebt den Haufen vor ihm auf. Schreibe eine Funktion check_side(), die Bertram zur Seite dreht, nachschaut, aufhebt und zurückdreht. Dann brauchst du in der Schleife nur noch zwei Zeilen.',
    en: 'On the way east there are piles of stone to the left and right – in different places every time. Bertram should collect them all. hero.take() picks up the pile in front of him. Write a function check_side() that turns Bertram sideways, looks, picks up and turns back. Then the loop only needs two lines.',
  },
  victoryText: { de: 'Alle Steine eingesammelt!', en: 'All stones collected!' },
  learn: { de: ['Funktionen (def)', 'Parameter', 'Wiederverwendung'], en: ['functions (def)', 'parameters', 'reuse'] },
  world: { base: 'flat', width: 28, height: 11, fog: false, starts: [{ x: 3, y: 5 }], places: { road: { x: 14, y: 5, r: 13 }, end: { x: 24, y: 5, r: 0 } } },
  players: [{ kind: 'human', hero: 'bertram', hq: false }],
  texts: {
    intro: { de: 'Links und rechts liegen Steine. Ich schaue bei jedem Schritt nach beiden Seiten.', en: 'There are stones to the left and right. I will look both ways at every step.' },
    goal: { de: 'Sammle alle Steinhaufen ein', en: 'Collect all piles of stone' },
    hint: { de: 'Tipp: def check_side(): hero.turn_left() … if hero.ahead() == "pile": hero.take() … hero.turn_right()', en: 'Tip: def check_side(): hero.turn_left() … if hero.ahead() == "pile": hero.take() … hero.turn_right()' },
    win: { de: 'Die Steine reichen für eine neue Mauer.', en: 'The stones are enough for a new wall.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`import random
# Stones left (y = 4) and right (y = 6) of the path, randomly distributed
for x in range(5, 24):
    if random.random() < 0.35:
        add_pile("stone", x, 4, 100)
    if random.random() < 0.35:
        add_pile("stone", x, 6, 100)
for x in range(1, world.width - 1):
    add_tree(x, 3)
    add_tree(x, 7)
add_tree(25, 5)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    camera.jump_to(hero)
    objective("stones", "goal", lambda: len(piles_near(place("road"), 14)) == 0)
    say("bertram", "intro")
    wait(80)
    if len(piles_near(place("road"), 14)) > 0:
        message("hint")

@on_objective("stones")
def done(id, status):
    say("bertram", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`def check_side():
    # turn, look, pick up, turn back
    pass

while hero.can_step():
    hero.step()
`,
    },
  ],
};
