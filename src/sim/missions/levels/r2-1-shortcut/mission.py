# II.1 „Orrins Abkürzung“: drei Etappen in drei Abschnitten der Karte (Funktion ohne Parameter).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).
# Drei Welten (world.py): die Vorhersage gilt je Welt, die Hecke ist überall gleich, die Taler zählen erst, wenn
# „Prüfen“ das Programm in allen Welten bestanden hat (all_worlds=True).

STAGES = ["predict", "hedge", "coins"]
ENDED = ("done", "error", "stopped")
# So weit kommt Nelia mit dreimal around_ruin() im ersten Abschnitt – wo ein Baum den Umweg versperrt, weniger weit
AHEAD = {"normal": 6, "near": 1, "far": 5}[world.id]

NOTE = "\n".join([
    "guess = 0",
    "",
    "def around_ruin():",
    "    nelia.turn_right()",
    "    nelia.step()",
    "    nelia.turn_left()",
    "    nelia.step(2)",
    "    nelia.turn_left()",
    "    nelia.step()",
    "    nelia.turn_right()",
    "",
    "around_ruin()",
    "around_ruin()",
    "around_ruin()",
    "",
])

npc("trader", look="hero.orrin", at=(2, 5), speaker="orrin")


# Warten, bis ein Lauf nach dem seen-ten zu Ende ist; zählt auch einen Lauf, der gleich nach dem Wechsel der Welt begann
def next_run(seen):
    wait_until(lambda: program.runs > seen and program.status in ENDED)
    return program.runs


def move_to_section(start, view):
    program.stop()
    nelia.teleport(place(start))
    nelia.turn_to("east")
    camera.fly_to(place(view), seconds=1)


def predict():
    seen = program.runs
    objective("predict",
              de="around_ruin() wird dreimal aufgerufen: Wie viele Kacheln weiter östlich steht Nelia danach? Trag die Zahl bei guess ein, dann führe den Zettel aus.",
              en="around_ruin() is called three times: how many tiles further east does Nelia stand afterwards? Put the number into guess, then run the note.")
    while True:
        seen = next_run(seen)
        guess = program.get("guess")
        walked = nelia.x - place("a_start").x
        # Randfall: ein Baum versperrt einen Umweg – der Zettel bricht ab, wo Nelia steht, zählt trotzdem
        ended = program.status == "done" or (program.status == "error" and walked == AHEAD)
        if ended and walked == AHEAD and guess == walked:
            complete("predict")
            say("orrin", de=f"{walked} Kacheln, ohne ein einziges Mal anzustoßen. Drei Zeilen unten, die Arbeit steckt oben in der Funktion.",
                         en=f"{walked} tiles without bumping into anything once. Three lines below, the work is in the function above.")
            return
        if ended:
            say("nelia", de=f"Ich stehe {walked} Kacheln weiter östlich, vermutet hattest du {guess}. Geh die Funktion für jeden Aufruf einmal durch – Ausführen bringt mich zurück an den Start.",
                         en=f"I am standing {walked} tiles further east, you guessed {guess}. Walk through the function once for every call – Run takes me back to the start.")


def hedge():
    # Die Hecke steht in jeder Welt gleich: Hier geht es ums Ändern der Funktion, nicht um Randfälle
    move_to_section("b_start", "b_view")
    say("orrin", de="Hier ist im Süden eine Dornenhecke gewachsen. Meine Abkürzung muss diesmal links herum, nördlich an den Mauern vorbei.",
                 en="A thorn hedge has grown in the south here. This time my shortcut has to go round the left, north past the walls.")
    objective("hedge", lambda: nelia.is_at(place("b_goal")),
              de="Ändere around_ruin(): Nelia soll links herum um die Mauerreste gehen. Die drei Aufrufe unten bleiben gleich.",
              en="Change around_ruin(): Nelia should go round the left of the walls. The three calls below stay the same.")
    while not nelia.is_at(place("b_goal")):
        runs = program.runs
        wait_until(lambda: nelia.is_at(place("b_goal")) or (program.runs > runs and program.status in ENDED))
        if not nelia.is_at(place("b_goal")):
            say("nelia", de="Hier komme ich nicht weiter. In der Funktion links und rechts tauschen – dann gilt es für alle drei Aufrufe.",
                         en="I cannot go on from here. Swap left and right in the function – then it counts for all three calls.")
    program.stop()
    say("orrin", de="Eine Stelle geändert, und alle drei Umwege stimmen wieder. Dafür sind Funktionen da.",
                 en="One place changed, and all three detours are right again. That is what functions are for.")


def coins():
    move_to_section("c_start", "c_view")
    say("orrin", de="Meine Geldkatze hatte ein Loch. Links und rechts vom Weg liegen jetzt meine Taler.",
                 en="My purse had a hole. Now my coins lie left and right of the path.")
    total = len(items("coin"))
    seen = program.runs
    objective("coins", lambda: (total - len(items("coin")), total), all_worlds=True,
              de="Schreib eigene Befehle: turn_around() dreht Nelia um, fetch_left() und fetch_right() holen einen Taler neben dem Weg und kehren zurück. Damit sammelt sie bis zum Waldrand alle ein – in allen Welten (Prüfen).",
              en="Write your own commands: turn_around() turns Nelia round, fetch_left() and fetch_right() fetch a coin beside the path and return. With them she collects all of them up to the forest edge – in every world (Check).")
    # Warten, bis „Prüfen“ die Etappe in allen Welten gelöst hat; nach jedem Lauf ein Tipp
    while objective_status("coins") != "done":
        wait_until(lambda: objective_status("coins") == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status("coins") == "done":
            break
        if len(items("coin")) == 0:
            say("nelia", de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Welten?",
                         en="It worked here! Now press “Check” – does it work in the other worlds too?")
        else:
            say("nelia", de="Es liegen noch Taler neben dem Weg. Schau bei jedem Schritt mit nelia.left() und nelia.right() nach \"coin\".",
                         en="There are still coins beside the path. At every step look with nelia.left() and nelia.right() for \"coin\".")
    program.stop()
    say("orrin", de="Alle Taler wieder da! Mit dir als Partnerin, Mädchen, werden wir beide reich.",
                 en="All my coins are back! With you as a partner, girl, we will both get rich.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): direkt dorthin
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("a_view"))
    if first == 0 and world.stage is None:
        say("orrin", de="Ich bin Orrin, Händler. Um diese Ruine kenne ich eine Abkürzung – ich habe sie mir als Funktion aufgeschrieben.",
                     en="I am Orrin, a merchant. I know a shortcut round this ruin – I wrote it down as a function.")
    if first == 0:
        note("orrin", NOTE, de="Orrins Abkürzung", en="Orrin's shortcut")
        predict()
    if first <= 1:
        hedge()
    coins()
    victory()
