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
    de: 'Der Winter naht, das Dorf braucht Holz. Vor Bertram steht eine Reihe Bäume. hero.ahead() verrät, was vor ihm ist ("tree", "free", "water" …), hero.chop() fällt den Baum vor ihm. Schreibe ein Programm, das die ganze Reihe fällt – auch wenn du nicht weißt, wie lang sie ist. Zähle mit einer Variablen, wie viele Bäume es waren, und gib die Zahl mit print() aus.',
    en: 'Winter is coming and the village needs wood. A row of trees stands in front of Bertram. hero.ahead() tells what is in front of him ("tree", "free", "water" …), hero.chop() fells the tree in front of him. Write a program that fells the whole row – even if you do not know how long it is. Count the trees with a variable and print the number.',
  },
  victoryText: { de: 'Genug Holz für den ganzen Winter!', en: 'Enough wood for the whole winter!' },
  learn: { de: ['while mit Bedingung', 'Rückgabewerte', 'Zähler-Variable'], en: ['while with a condition', 'return values', 'counter variable'] },
  world: { base: 'flat', width: 26, height: 12, fog: false, starts: [{ x: 3, y: 6 }], places: { grove: { x: 13, y: 6, r: 10 } } },
  players: [{ kind: 'human', hero: 'bertram', hq: false }],
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
# Die Reihe ist jedes Mal anders lang (7 bis 12 Bäume)
length = random.randint(7, 12)
for i in range(length):
    add_tree(5 + i, 6)
# Hecke ringsum, damit niemand ausweicht
for x in range(1, world.width - 1):
    add_tree(x, 4)
    add_tree(x, 8)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`def row_left():
    return len([t for t in trees_near(place("grove"), 12) if t.y == 6])

@on_start
def intro():
    camera.jump_to(hero)
    objective("chop", "goal", lambda: row_left() == 0)
    say("bertram", "intro")
    wait(60)
    if row_left() > 0:
        message("hint")

@on_objective("chop")
def done(id, status):
    say("bertram", "win")
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
