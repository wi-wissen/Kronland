@on_start
def intro():
    camera.fly_to(place("camp"), seconds=3)
    reveal(place("camp"), seconds=20)
    say("kunz", de="Hört ihr das? Das ist das Lager von Kunz dem Roten. Bald holen wir uns eure Vorräte!",
                en="Do you hear that? That is the camp of Kunz the Red. Soon we will take your supplies!")
    camera.fly_to(hq(), seconds=2)
    say("nelia", de="Wir brauchen eine Kaserne und mindestens drei Trupps. Dann räuchern wir das Lager aus.",
                 en="We need a barracks and at least three troops. Then we smoke out the camp.")
    objective("barracks", lambda: count("barracks") >= 1,
              de="Baue eine Kaserne",
              en="Build a barracks")
    objective("army", lambda: count("troop") >= 3,
              de="Stelle 3 Trupps auf",
              en="Raise 3 troops")
    objective("camp", lambda: len(buildings("banditCamp", BANDITS)) == 0, hidden=True,
              de="Zerstöre das Räuberlager",
              en="Destroy the bandit camp")

waves = 0

@every(150)
def raid():
    global waves
    if waves >= 3:
        return
    waves += 1
    say("kunz", de="Holt euch, was ihr tragen könnt!",
                en="Take everything you can carry!", seconds=4)
    attackers = spawn(BANDITS, "sword1", place("gate"), count=waves + 1, soldiers=3)
    attack(attackers, hq())

@on_objective("army", "done")
def ready(id, status):
    show_objective("camp")
    camera.fly_to(place("camp"), seconds=2)
    say("nelia", de="Die Truppen stehen bereit. Auf zum Lager!",
                 en="The troops are ready. To the camp!")

@on_objective("camp", "done")
def won(id, status):
    say("nelia", de="Kunz ist geflohen. Der Hof ist sicher.",
                 en="Kunz has fled. The farm is safe.")
    victory()

@on_destroyed("headquarters", HUMAN)
def lost(kind, owner):
    defeat("hq")
