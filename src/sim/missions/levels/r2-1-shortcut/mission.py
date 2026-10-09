# II.1 „Orrins Abkürzung“: drei Etappen in drei Abschnitten der Karte (Funktion ohne Parameter).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).

ENDED = ("done", "error", "stopped")
AHEAD = 6          # so weit kommt Nelia mit dreimal around_ruin() im ersten Abschnitt

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


# Warten, bis der Spieler das Programm erneut gestartet hat und es zu Ende ist
def next_run():
    runs = program.runs
    wait_until(lambda: program.runs > runs and program.status in ENDED)


def move_to_section(start, view):
    program.stop()
    nelia.teleport(place(start))
    nelia.turn_to("east")
    camera.fly_to(place(view), seconds=1)


def predict():
    objective("predict",
              de="around_ruin() wird dreimal aufgerufen: Wie viele Kacheln weiter östlich steht Nelia danach? Trag die Zahl bei guess ein, dann führe den Zettel aus.",
              en="around_ruin() is called three times: how many tiles further east does Nelia stand afterwards? Put the number into guess, then run the note.")
    while True:
        next_run()
        guess = program.get("guess")
        walked = nelia.x - place("a_start").x
        if program.status == "done" and walked == AHEAD and guess == walked:
            complete("predict")
            say("orrin", de=f"{walked} Kacheln, ohne ein einziges Mal anzustoßen. Drei Zeilen unten, die Arbeit steckt oben in der Funktion.",
                         en=f"{walked} tiles without bumping into anything once. Three lines below, the work is in the function above.")
            return
        if program.status == "done":
            say("nelia", de=f"Ich stehe {walked} Kacheln weiter östlich, vermutet hattest du {guess}. Geh die Funktion für jeden Aufruf einmal durch – Ausführen bringt mich zurück an den Start.",
                         en=f"I am standing {walked} tiles further east, you guessed {guess}. Walk through the function once for every call – Run takes me back to the start.")


def hedge():
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
    objective("coins", lambda: (total - len(items("coin")), total),
              de="Schreib eigene Befehle: turn_around() dreht Nelia um, fetch_left() und fetch_right() holen einen Taler neben dem Weg und kehren zurück. Damit sammelt sie bis zum Waldrand alle ein.",
              en="Write your own commands: turn_around() turns Nelia round, fetch_left() and fetch_right() fetch a coin beside the path and return. With them she collects all of them up to the forest edge.")
    while len(items("coin")) > 0:
        runs = program.runs
        wait_until(lambda: len(items("coin")) == 0 or (program.runs > runs and program.status in ENDED))
        if len(items("coin")) > 0:
            say("nelia", de="Es liegen noch Taler neben dem Weg. Schau bei jedem Schritt mit nelia.left() und nelia.right() nach \"coin\".",
                         en="There are still coins beside the path. At every step look with nelia.left() and nelia.right() for \"coin\".")
    program.stop()
    say("orrin", de="Alle Taler wieder da! Mit dir als Partnerin, Mädchen, werden wir beide reich.",
                 en="All my coins are back! With you as a partner, girl, we will both get rich.")


@on_start
def story():
    camera.jump_to(place("a_view"))
    say("orrin", de="Ich bin Orrin, Händler. Um diese Ruine kenne ich eine Abkürzung – ich habe sie mir als Funktion aufgeschrieben.",
                 en="I am Orrin, a merchant. I know a shortcut round this ruin – I wrote it down as a function.")
    note("orrin", NOTE, de="Orrins Abkürzung", en="Orrin's shortcut")
    predict()
    hedge()
    coins()
    victory()
