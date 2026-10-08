# I.4 „Im Schneetreiben“: drei Etappen in drei Abschnitten der Karte.
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).

STEPS = 9          # so viele Schritte bis zum Waldrand im ersten Abschnitt
ENDED = ("done", "error", "stopped")

NOTE = "\n".join([
    "guess = 0",
    "steps = 0",
    "while nelia.can_step():",
    "    nelia.step()",
    "    steps = steps + 1",
    "print(steps)",
    "",
])

npc("maid", look="serf", at=(2, 5), de="Magd Hedda", en="Hedda the maid")
npc("runaways", look="serf", at=(17, 25), de="Geflohene", en="Runaways")


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
              de="Wie viele Schritte geht Nelia bis zum Waldrand? Trag deine Vermutung bei guess ein, dann führe den Zettel aus.",
              en="How many steps does Nelia take to the forest edge? Put your guess into guess, then run the note.")
    while True:
        next_run()
        guess = program.get("guess")
        walked = nelia.x - place("a_start").x
        if program.status == "done" and walked == STEPS and guess == walked:
            complete("predict")
            say("nelia", de=f"{walked} Schritte – genau wie vermutet!", en=f"{walked} steps – just as you guessed!")
            return
        if program.status == "done":
            say("nelia", de=f"Ich bin {walked} Schritte gegangen, vermutet hattest du {guess}. Zähl die Kacheln noch einmal – Ausführen bringt mich zurück an den Start.",
                         en=f"I walked {walked} steps, you guessed {guess}. Count the tiles again – Run takes me back to the start.")


def coin():
    move_to_section("b_start", "b_view")
    say("nelia", de="Da glitzert ein Taler im Schnee! Der Zettel läuft aber bis zum Wald …",
                 en="A coin is glittering in the snow! But the note walks all the way to the forest …")
    objective("coin", lambda: len(items("coin")) == 0,
              de="Ändere den Zettel: Nelia soll beim Taler stehen bleiben (nelia.here() == \"coin\") und ihn mit nelia.take() aufheben.",
              en="Change the note: Nelia should stop on the coin (nelia.here() == \"coin\") and pick it up with nelia.take().")
    while len(items("coin")) > 0:
        next_run()
        if len(items("coin")) > 0:
            say("nelia", de="Der Taler liegt noch im Schnee. Lauf, solange unter mir kein Taler liegt: while nelia.here() != \"coin\":",
                         en="The coin is still lying in the snow. Walk as long as there is no coin under me: while nelia.here() != \"coin\":")
    say("nelia", de="Hab ihn! Den bekommen die Geflohenen.", en="Got it! That one is for the runaways.")


def track():
    move_to_section("c_start", "c_view")
    say("nelia", de="Spuren im Schnee – hier sind die Geflohenen entlang. Sie biegen mal links, mal rechts ab.",
                 en="Tracks in the snow – the runaways came this way. They turn left, then right.")
    objective("hut", lambda: nelia.is_at(place("hut")),
              de="Folge der Spur durch alle Kurven bis zur Hütte: nelia.front(), nelia.left() und nelia.right() sagen \"track\", wo die Spur weitergeht.",
              en="Follow the track through every bend to the hut: nelia.front(), nelia.left() and nelia.right() say \"track\" where it goes on.")
    while not nelia.is_at(place("hut")):
        runs = program.runs
        wait_until(lambda: nelia.is_at(place("hut")) or (program.runs > runs and program.status in ENDED))
        if not nelia.is_at(place("hut")):
            say("nelia", de="Hier endet mein Weg, aber nicht die Spur. Schau vorn, links und rechts nach \"track\".",
                         en="My way ends here, but the track does not. Look ahead, left and right for \"track\".")
    program.stop()
    say("runaways", de="Nelia! Wir dachten schon, die Eintreiber hätten dich erwischt.",
                    en="Nelia! We thought the collectors had caught you.")


@on_start
def story():
    camera.jump_to(place("a_view"))
    say("maid", de="Nimm meinen Zettel, Nelia. Er bringt dich bis zum Waldrand – aber wie weit ist das?",
                en="Take my note, Nelia. It takes you to the forest edge – but how far is that?")
    note("maid", NOTE, de="Zettel der Magd", en="The maid's note")
    predict()
    coin()
    track()
    victory()
