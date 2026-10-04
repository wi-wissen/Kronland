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
    de: 'Auf dem Weg nach Osten liegen links und rechts Steinhaufen – jedes Mal an anderen Stellen. Nelia soll alle einsammeln. hero.take() hebt den Haufen vor ihr auf. Schreibe eine Funktion check_side(), die Nelia zur Seite dreht, nachschaut, aufhebt und zurückdreht. Dann brauchst du in der Schleife nur noch zwei Zeilen.',
    en: 'On the way east there are piles of stone to the left and right – in different places every time. Nelia should collect them all. hero.take() picks up the pile in front of her. Write a function check_side() that turns Nelia sideways, looks, picks up and turns back. Then the loop only needs two lines.',
  },
  victoryText: { de: 'Alle Steine eingesammelt!', en: 'All stones collected!' },
  learn: { de: ['Funktionen (def)', 'Parameter', 'Wiederverwendung'], en: ['functions (def)', 'parameters', 'reuse'] },
  world: { base: 'flat', width: 28, height: 11, fog: false, starts: [{ x: 3, y: 5 }], places: { road: { x: 14, y: 5, r: 13 }, end: { x: 24, y: 5, r: 0 } } },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
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
# Steine links (y = 4) und rechts (y = 6) des Wegs, zufällig verteilt; im Osten endet der Weg am Bach
for x in range(5, 24):
    if random.random() < 0.35:
        add_pile("stone", x, 4, 100)
    if random.random() < 0.35:
        add_pile("stone", x, 6, 100)
for y in range(world.height):
    world.set_water(25, y)
    world.set_water(26, y)
for x, y in [(2, 1), (3, 1), (11, 0), (12, 1), (19, 1), (2, 9), (8, 10), (15, 9), (16, 10), (22, 9)]:
    add_tree(x, y)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    objective("stones", "goal", lambda: len(piles_near(place("road"), 14)) == 0)
    say("nelia", "intro")
    wait(80)
    if len(piles_near(place("road"), 14)) > 0:
        message("hint")

@on_objective("stones")
def done(id, status):
    say("nelia", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`def check_side():
    # drehen, schauen, aufheben, zurückdrehen
    pass

while hero.can_step():
    hero.step()
`,
    },
  ],
};
