// Coding adventure 5: lists and objects – a village by program (buildings, serfs, commands).

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'adv5',
  kind: 'adventure',
  order: 5,
  title: { de: 'Ein Dorf per Programm', en: 'A Village by Program' },
  summary: { de: 'Baue mit Listen und Befehlen Wohnhaus und Bauernhof.', en: 'Use lists and commands to build a residence and a farm.' },
  briefing: {
    de: 'Ottilie möchte wissen, ob man ein Dorf auch mit einem Programm bauen kann. find_spot("residence", hq()) sucht einen Bauplatz, build(…) legt die Baustelle an. Bauen müssen aber Leibeigene: serfs(idle=True) liefert eine Liste der untätigen, und serf.work_on(baustelle) schickt einen zur Arbeit. Baue zwei Wohnhäuser und einen Bauernhof.',
    en: 'Ottilie wants to know whether a village can be built by a program. find_spot("residence", hq()) finds a building site, build(…) lays out the construction site. But serfs have to do the building: serfs(idle=True) returns a list of idle serfs, and serf.work_on(site) sends one to work. Build two residences and a farm.',
  },
  victoryText: { de: 'Das Dorf wächst – ganz ohne Mausklick.', en: 'The village grows – without a single mouse click.' },
  learn: { de: ['Listen', 'Objekte und Methoden', 'Rückgabewerte'], en: ['lists', 'objects and methods', 'return values'] },
  world: { base: 'flat', width: 40, height: 40, fog: false, starts: [{ x: 12, y: 12 }], places: {} },
  players: [{ kind: 'human', hero: 'bertram', hq: true, stock: { gold: 600, clay: 800, wood: 900, stone: 600, iron: 0, sulfur: 0 } }],
  texts: {
    intro: { de: 'Zwei Wohnhäuser und ein Bauernhof – aber diesmal mit einem Programm, bitte!', en: 'Two residences and a farm – but this time with a program, please!' },
    goal1: { de: 'Baue 2 Wohnhäuser', en: 'Build 2 residences' },
    goal2: { de: 'Baue einen Bauernhof', en: 'Build a farm' },
    win: { de: 'Wunderbar! Das schreibe ich in die Chronik.', en: 'Wonderful! I will write that in the chronicle.' },
  },
  sections: [
    {
      id: 'world', title: { de: 'Welt aufbauen', en: 'Build the world' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Ein Wäldchen und Steine in der Nähe der Burg
plant_trees((26, 12), 25, 5)
add_pile("stone", 20, 24, 400)
add_pile("clay", 24, 22, 400)
`,
    },
    {
      id: 'mission', title: { de: 'Mission', en: 'Mission' }, level: 'mission', visibility: 'hidden', editable: false,
      code: String.raw`@on_start
def intro():
    camera.jump_to(hq())
    objective("homes", "goal1", lambda: count("residence") >= 2)
    objective("farm", "goal2", lambda: count("farm") >= 1)
    say("ottilie", "intro")
    wait_until(lambda: count("residence") >= 2 and count("farm") >= 1)
    say("ottilie", "win")
    victory()
`,
    },
    {
      id: 'player', title: { de: 'Dein Programm', en: 'Your program' }, level: 'player', visibility: 'open', editable: true,
      code: String.raw`spot = find_spot("residence", hq())
print("Bauplatz:", spot)
site = build("residence", spot[0], spot[1])
helpers = serfs(idle=True)
print(len(helpers), "Leibeigene haben nichts zu tun")
`,
    },
  ],
};
