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
    de: 'Bertram steht am Anfang eines Waldwegs. Am Ende glänzt etwas Goldenes. Schreibe ein Programm, das ihn Schritt für Schritt dorthin bringt. hero.step() lässt ihn einen Schritt in Blickrichtung gehen.',
    en: 'Bertram stands at the start of a forest path. Something golden glitters at the end. Write a program that brings him there step by step. hero.step() makes him take one step forward.',
  },
  victoryText: { de: 'Bertram hat den Schatz gefunden!', en: 'Bertram found the treasure!' },
  learn: { de: ['Anweisungen', 'for-Schleife', 'range()'], en: ['statements', 'for loop', 'range()'] },
  world: { base: 'flat', width: 24, height: 13, fog: false, starts: [{ x: 4, y: 6 }], places: { treasure: { x: 14, y: 6, r: 0 } } },
  players: [{ kind: 'human', hero: 'bertram', hq: false }],
  texts: {
    intro: { de: 'Da hinten glänzt etwas! Zehn Schritte geradeaus, schätze ich.', en: 'Something is glittering over there! Ten steps straight ahead, I guess.' },
    goal: { de: 'Bring Bertram zum Schatz', en: 'Bring Bertram to the treasure' },
    hint: { de: 'Tipp: Statt zehnmal hero.step() zu schreiben, geht auch: for i in range(10):', en: 'Tip: instead of writing hero.step() ten times you can use: for i in range(10):' },
    win: { de: 'Gold! Und ich musste nicht einmal suchen.', en: 'Gold! And I did not even have to search.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Ein Waldweg von Westen nach Osten
for x in range(1, world.width - 1):
    add_tree(x, 4)
    add_tree(x, 8)
for y in range(5, 8):
    add_tree(2, y)
    add_tree(20, y)
add_pile("gold", 15, 6, 200)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    camera.jump_to(hero)
    objective("goal", "goal", lambda: hero.is_at(place("treasure")))
    say("bertram", "intro")
    wait(40)
    if not hero.is_at(place("treasure")):
        message("hint")

@on_objective("goal")
def found(id, status):
    say("bertram", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`# Bring Bertram zum Schatz!
hero.step()
hero.step()
`,
    },
  ],
};
