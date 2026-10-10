# I.4 „Im Schneetreiben“: eine Reise über ein Schneefeld in drei Etappen (world.py), in drei Welten (drei Karten).
# Die Etappen sind aufeinanderfolgende Wegstücke: nach Osten bis zum Waldrand, am Waldrand nach Süden bis zum Taler,
# vom Taler der Spur bis zur Hütte. Das Programm des Spielers bleibt und wächst; nichts wird geladen oder versetzt,
# Nelia beginnt jede Etappe dort, wo die vorige endete (und wendet sich nur ins nächste Wegstück).
# Taler und Spur zählen erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat (all_worlds=True).

STAGES = ["predict", "coin", "hut"]
ENDED = ("done", "error", "stopped")

PROGRAM = "\n".join([
    "steps = 0",
    "while nelia.can_step():",
    "    nelia.step()",
    "    steps = steps + 1",
    "print(steps)",
    "",
])

npc("maid", look="serf", at=(1, 2), de="Magd Hedda", en="Hedda the maid")
npc("runaways", look="serf", at=(HUT[0] + 1, HUT[1]), de="Geflohene", en="Runaways")


# Etappe mit all_worlds=True: warten, bis „Prüfen“ sie in allen Welten gelöst hat; nach jedem Lauf ein Hinweis
def until_checked(goal, solved, de, en):
    while objective_status(goal) != "done":
        runs = program.runs
        wait_until(lambda: objective_status(goal) == "done" or (program.runs > runs and program.status in ENDED))
        if objective_status(goal) == "done":
            break
        if solved():
            say("nelia", de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Welten?",
                         en="It worked here! Now press “Check” – does it work in the other worlds too?")
        else:
            say("nelia", de=de, en=en)
    program.stop()


def predict():
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="Wie viele Schritte geht Nelia bis zum Waldrand? Führe das Programm aus und zähl mit.",
              en="How many steps does Nelia take to the forest edge? Run the program and count along.")
    wait_until(lambda: objective_status("predict") == "done")
    walked = nelia.x - place("start").x
    # Erst das nächste Unterziel, dann sprechen: ohne aktives Ziel gäbe es keinen Schnappschuss der Etappe
    say("nelia", de=f"{walked} Schritte bis zum Waldrand.", en=f"{walked} steps to the forest edge.", wait=False)


def coin():
    # Der Waldrand zieht sich nach Süden: Nelia wendet sich dorthin, das Programm läuft unverändert weiter
    objective("coin", lambda: len(items("coin")) == 0, all_worlds=True,
              de="Ändere das Programm: Nelia soll beim Taler stehen bleiben (nelia.here() == \"coin\") und ihn mit nelia.take() aufheben – in allen Welten (Prüfen).",
              en="Change the program: Nelia should stop on the coin (nelia.here() == \"coin\") and pick it up with nelia.take() – in every world (Check).")
    nelia.turn_to("south")
    say("nelia", de="Da glitzert ein Taler im Schnee! Das Programm läuft aber immer weiter am Wald entlang …",
                 en="A coin is glittering in the snow! But the program keeps walking along the forest …")
    until_checked("coin", lambda: len(items("coin")) == 0,
                  "Der Taler liegt noch im Schnee. Lauf, solange unter mir kein Taler liegt: while nelia.here() != \"coin\":",
                  "The coin is still lying in the snow. Walk as long as there is no coin under me: while nelia.here() != \"coin\":")
    say("nelia", de="Hab ihn – in jeder Welt! Den bekommen die Geflohenen.", en="Got it – in every world! That one is for the runaways.", wait=False)
    # Hat „Prüfen“ die Etappe gelöst, ohne dass Nelia ihn hier aufhob: track() lässt sie zu Fuß hingehen
    return len(items("coin")) > 0


def track(walk_to_coin):
    # Die Spur beginnt neben dem Taler; Nelia blickt wie am Ende der vorigen Etappe nach Süden
    objective("hut", lambda: nelia.is_at(place("hut")), all_worlds=True,
              de="Folge der Spur durch alle Kurven bis zur Hütte: nelia.front(), nelia.left() und nelia.right() sagen \"track\", wo die Spur weitergeht. In jeder Welt biegt sie anders ab (Prüfen).",
              en="Follow the track through every bend to the hut: nelia.front(), nelia.left() and nelia.right() say \"track\" where it goes on. In every world it bends differently (Check).")
    # Das nächste Ziel steht schon; erst jetzt geht Nelia (falls nötig) zu Fuß zum Taler
    if walk_to_coin:
        nelia.move_to(place("coin"))
        nelia.take()
    nelia.turn_to("south")
    say("nelia", de="Spuren im Schnee – hier sind die Geflohenen entlang. Sie biegen mal links, mal rechts ab.",
                 en="Tracks in the snow – the runaways came this way. They turn left, then right.")
    until_checked("hut", lambda: nelia.is_at(place("hut")),
                  "Hier endet mein Weg, aber nicht die Spur. Schau vorn, links und rechts nach \"track\".",
                  "My way ends here, but the track does not. Look ahead, left and right for \"track\".")
    if not nelia.is_at(place("hut")):
        nelia.move_to(place("hut"))
    say("runaways", de="Nelia! Wir dachten schon, die Eintreiber hätten dich erwischt.",
                    en="Nelia! We thought the collectors had caught you.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): Nelia steht schon dort (world.py)
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("view"))
    if first == 0:
        if world.stage is None:
            say("maid", de="Nimm mein Programm, Nelia. Es bringt dich bis zum Waldrand – aber wie weit ist das?",
                        en="Take my program, Nelia. It takes you to the forest edge – but how far is that?")
        program.load(PROGRAM)
        predict()
    late = False
    if first <= 1:
        late = coin()
    track(late)
    victory()
