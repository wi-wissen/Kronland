// Coding adventure 1: instructions one after another and the first loop.
// Scenario format: docs/SKRIPTE.md (pure JSON; here as a JS module so that the Python code stays readable).

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv1',
  kind: 'adventure',
  order: 1,
  title: { de: 'Der Weg zum Schatz', en: 'The Path to the Treasure' },
  summary: { de: 'Anweisungen nacheinander ausführen – und die erste Schleife.', en: 'Run instructions one after another – and your first loop.' },
  briefing: {
    de: 'Nelia steht auf einer Wiese und schaut nach Osten. Dort glänzt etwas Goldenes. Schreibe ein Programm, das sie Schritt für Schritt hinbringt: hero.step() lässt sie eine Kachel in Blickrichtung gehen. Das Raster hilft beim Zählen.',
    en: 'Nelia stands in a meadow, looking east. Something golden glitters over there. Write a program that brings her there step by step: hero.step() makes her walk one tile in the direction she is facing. The grid helps you count.',
  },
  victoryText: { de: 'Nelia hat den Schatz gefunden!', en: 'Nelia found the treasure!' },
  learn: { de: ['Anweisungen', 'for-Schleife', 'range()'], en: ['statements', 'for loop', 'range()'] },
  world: { base: 'flat', width: 24, height: 13, fog: false, starts: [{ x: 4, y: 6 }], places: { treasure: { x: 14, y: 6, r: 0 } } },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
  texts: {
    intro: { de: 'Da hinten glänzt etwas! Zehn Schritte geradeaus, schätze ich.', en: 'Something is glittering over there! Ten steps straight ahead, I guess.' },
    goal: { de: 'Bring Nelia zum Schatz', en: 'Bring Nelia to the treasure' },
    hint: { de: 'Tipp: Statt zehnmal hero.step() zu schreiben, geht auch: for i in range(10):', en: 'Tip: instead of writing hero.step() ten times you can use: for i in range(10):' },
    win: { de: 'Gold! Und ich musste nicht einmal suchen.', en: 'Gold! And I did not even have to search.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Eine offene Wiese mit ein paar Baumgruppen am Rand
for x, y in [(1, 1), (2, 1), (1, 2), (8, 1), (9, 0), (16, 1), (17, 2), (18, 1),
             (2, 10), (3, 11), (9, 11), (10, 12), (17, 11), (18, 10), (21, 3), (22, 9)]:
    add_tree(x, y)
add_pile("gold", 15, 6, 200)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    objective("goal", "goal", lambda: hero.is_at(place("treasure")))
    say("nelia", "intro")
    wait(40)
    if not hero.is_at(place("treasure")):
        message("hint")

@on_objective("goal")
def found(id, status):
    say("nelia", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`# Bring Nelia zum Schatz!
hero.step()
hero.step()
`,
    },
  ],
};
