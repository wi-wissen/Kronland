// Coding adventure 3: loops with condition, return values (hero.ahead()), variables for counting.

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv3',
  kind: 'adventure',
  order: 3,
  title: { de: 'Holz für den Winter', en: 'Wood for the Winter' },
  summary: { de: 'Fälle eine Baumreihe – egal wie lang sie ist.', en: 'Fell a row of trees – no matter how long it is.' },
  briefing: {
    de: 'Der Winter naht, das Dorf braucht Holz. Vor Nelia steht eine Reihe Bäume. hero.ahead() verrät, was vor ihr ist ("tree", "free", "water" …), hero.chop() fällt den Baum vor ihr. Schreibe ein Programm, das die ganze Reihe fällt – auch wenn du nicht weißt, wie lang sie ist. Zähle mit einer Variablen, wie viele Bäume es waren, und gib die Zahl mit print() aus.',
    en: 'Winter is coming and the village needs wood. A row of trees stands in front of Nelia. hero.ahead() tells what is in front of her ("tree", "free", "water" …), hero.chop() fells the tree in front of her. Write a program that fells the whole row – even if you do not know how long it is. Count the trees with a variable and print the number.',
  },
  victoryText: { de: 'Genug Holz für den ganzen Winter!', en: 'Enough wood for the whole winter!' },
  learn: { de: ['while mit Bedingung', 'Rückgabewerte', 'Zähler-Variable'], en: ['while with a condition', 'return values', 'counter variable'] },
  world: { base: 'flat', width: 26, height: 12, fog: false, starts: [{ x: 3, y: 6 }], places: { grove: { x: 13, y: 6, r: 10 } } },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
  texts: {
    intro: { de: 'Wie viele Bäume das wohl sind? Ich fälle einfach, solange einer vor mir steht.', en: 'I wonder how many trees there are. I will just keep chopping while one is in front of me.' },
    goal: { de: 'Fälle alle Bäume der Reihe', en: 'Fell all trees in the row' },
    hint: { de: 'Tipp: while hero.ahead() == "tree":  →  hero.chop() und hero.step()', en: 'Tip: while hero.ahead() == "tree":  →  hero.chop() and hero.step()' },
    win: { de: 'Das gibt einen warmen Winter.', en: 'That makes for a warm winter.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`import random
# Eine Baumreihe am Feldrand – jedes Mal anders lang (7 bis 12 Bäume)
length = random.randint(7, 12)
for i in range(length):
    add_tree(5 + i, 6)
# Etwas Wald weiter weg, damit die Wiese nicht so leer ist
for x, y in [(2, 1), (3, 1), (9, 1), (10, 2), (20, 1), (21, 2), (2, 10), (12, 10), (13, 11), (22, 10)]:
    add_tree(x, y)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`def row_left():
    return len([t for t in trees_near(place("grove"), 12) if t.y == 6])

@on_start
def intro():
    objective("chop", "goal", lambda: row_left() == 0)
    say("nelia", "intro")
    wait(60)
    if row_left() > 0:
        message("hint")

@on_objective("chop")
def done(id, status):
    say("nelia", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`count = 0
hero.step()
hero.chop()
count = count + 1
print("Gefällt:", count)
`,
    },
  ],
};
