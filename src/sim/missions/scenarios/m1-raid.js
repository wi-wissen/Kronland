// Script mission: shows how missions are built with Python – camera pan, dialogues, waves, goals.
// It is played like a normal mission (code stays invisible).

export default {
  format: 'kronland-scenario',
  version: 1,
  id: 'm1',
  kind: 'mission',
  order: 1,
  title: { de: 'Der Überfall', en: 'The Raid' },
  summary: { de: 'Eine Beispielmission, ganz in Python geschrieben: Räuber bedrohen den Hof.', en: 'An example mission written entirely in Python: bandits threaten the farm.' },
  briefing: {
    de: 'Räuberhauptmann Kunz hat sein Lager im Wald aufgeschlagen und will den Hof plündern. Baue eine Kaserne, hebe Truppen aus und halte die Angriffe auf. Dann zerstöre das Lager. (Diese Mission ist ein Beispiel für Missionsskripte – im Welteneditor kannst du ihren Code ansehen.)',
    en: 'Bandit captain Kunz has set up camp in the woods and wants to plunder the farm. Build a barracks, recruit troops and hold off the raids. Then destroy the camp. (This mission is an example of mission scripts – you can view its code in the world editor.)',
  },
  victoryText: { de: 'Das Räuberlager ist zerstört.', en: 'The bandit camp is destroyed.' },
  defeatText: { de: 'Der Hof ist verloren.', en: 'The farm is lost.' },
  world: { base: 'generate', seed: 2202, size: 96, fog: true },
  players: [
    { kind: 'human', hero: 'bertram', serfs: 8, techs: ['conscription', 'construction'], stock: { gold: 1300, clay: 1800, wood: 2200, stone: 1200, iron: 600, sulfur: 0 } },
    { kind: 'bandits' },
  ],
  texts: {
    threat: { de: 'Hört ihr das? Das ist das Lager von Kunz dem Roten. Bald holen wir uns eure Vorräte!', en: 'Do you hear that? That is the camp of Kunz the Red. Soon we will take your supplies!' },
    plan: { de: 'Wir brauchen eine Kaserne und mindestens drei Trupps. Dann räuchern wir das Lager aus.', en: 'We need a barracks and at least three troops. Then we smoke out the camp.' },
    wave: { de: 'Holt euch, was ihr tragen könnt!', en: 'Take everything you can carry!' },
    attack: { de: 'Die Truppen stehen bereit. Auf zum Lager!', en: 'The troops are ready. To the camp!' },
    win: { de: 'Kunz ist geflohen. Der Hof ist sicher.', en: 'Kunz has fled. The farm is safe.' },
    goal_barracks: { de: 'Baue eine Kaserne', en: 'Build a barracks' },
    goal_army: { de: 'Stelle 3 Trupps auf', en: 'Raise 3 troops' },
    goal_camp: { de: 'Zerstöre das Räuberlager', en: 'Destroy the bandit camp' },
  },
  sections: [
    {
      id: 'setup', title: { de: 'Aufbau', en: 'Setup' }, level: 'mission', visibility: 'collapsed', editable: false,
      code: String.raw`# Lager zwischen Burg und Kartenmitte, Sammelpunkt der Angreifer davor
spot = find_open(toward(hq(), map_center(), 30), max_r=12)
make_place("camp", spot.x, spot.y, 6)
clear_area(place("camp"), 4)
place_building(BANDITS, "banditCamp", place("camp"))
guards = spawn(BANDITS, "spear1", place("camp"), count=2, soldiers=3)
gate = toward(place("camp"), hq(), 8)
make_place("gate", gate.x, gate.y, 3)
`,
    },
    {
      id: 'story', title: { de: 'Ablauf', en: 'Story' }, level: 'mission', visibility: 'open', editable: false,
      code: String.raw`@on_start
def intro():
    camera.fly_to(place("camp"), seconds=3)
    reveal(place("camp"), seconds=20)
    say("kunz", "threat")
    camera.fly_to(hq(), seconds=2)
    say("bertram", "plan")
    objective("barracks", "goal_barracks", lambda: count("barracks") >= 1)
    objective("army", "goal_army", lambda: count("troop") >= 3)
    objective("camp", "goal_camp", lambda: len(buildings("banditCamp", BANDITS)) == 0, hidden=True)

waves = 0

@every(150)
def raid():
    global waves
    if waves >= 3:
        return
    waves += 1
    say("kunz", "wave", seconds=4)
    attackers = spawn(BANDITS, "sword1", place("gate"), count=waves + 1, soldiers=3)
    attack(attackers, hq())

@on_objective("army")
def ready(id, status):
    show_objective("camp")
    camera.fly_to(place("camp"), seconds=2)
    say("bertram", "attack")

@on_objective("camp")
def won(id, status):
    say("bertram", "win")
    victory()

@on_destroyed("headquarters", HUMAN)
def lost(kind, owner):
    defeat("hq")
`,
    },
  ],
};
