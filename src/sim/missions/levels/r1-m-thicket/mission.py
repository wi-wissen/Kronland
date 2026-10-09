# I.M „Heimweg durchs Unterholz“ (Meisterstück der Reihe I): ein Wald, zwei Etappen als aufeinanderfolgende Wegstücke.
# Welten (world.py) = dieselbe Aufgabe in drei Wäldern. Etappe „path“: gewundener Pfad bis zur Lichtung (zählt in der
# gespielten Welt). Etappe „thicket“: Abzweigungen und Sackgassen bis zum Ausgang – zählt erst, wenn „Prüfen“ das
# Programm in allen Welten bestanden hat (all_worlds=True). Das Programm des Spielers wächst von Etappe zu Etappe,
# Nelia beginnt Etappe 2 dort, wo Etappe 1 endete.

STAGES = ["path", "thicket"]
ENDED = ("done", "error", "stopped")

npc("stranger", look="hero.orrin", at=place("square"), de="Fremder", en="Stranger")


def at_clearing():
    return nelia.is_at(place("clearing"))


def at_exit():
    return nelia.is_at(place("exit"))


# Warten, bis das Ziel erfüllt ist; nach jedem Lauf ein Tipp. Bei all_worlds die Bitte um „Prüfen“, sobald es hier klappt.
def until_done(goal, solved, check, de, en):
    seen = program.runs
    while objective_status(goal) != "done":
        wait_until(lambda: objective_status(goal) == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status(goal) == "done":
            break
        if solved() and check:
            say("nelia", de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Wäldern?",
                         en="It worked here! Now press “Check” – does it work in the other forests too?")
        elif not solved():
            say("nelia", de=de, en=en)
    program.stop()


def path():
    objective("path", at_clearing,
              de="Bring Nelia über den gewundenen Pfad zur Lichtung place(\"clearing\"): geh, solange vorn frei ist, sonst dreh dich nach rechts.",
              en="Bring Nelia along the winding path to the clearing place(\"clearing\"): walk while the way ahead is free, otherwise turn right.")
    until_done("path", at_clearing, False,
               "Hier komme ich nicht weiter. Was tun, wenn vor mir ein Baum steht? if nelia.can_step(): … else: …",
               "I cannot go on from here. What to do when a tree is in front of me? if nelia.can_step(): … else: …")
    say("nelia", de="Die Lichtung! Aber dahinten gabelt sich das Dickicht – und Sackgassen gibt es sicher auch.",
                 en="The clearing! But further on the thicket forks – and there are surely dead ends too.")


def thicket():
    say("nelia", de="Wenn ich immer mit der rechten Hand an den Bäumen bleibe, komme ich überall wieder heraus.",
                 en="If I always keep my right hand on the trees, I will get out anywhere.")
    objective("thicket", at_exit, all_worlds=True,
              de="Finde den Ausgang place(\"exit\") durch das verzweigte Dickicht: Halte dich mit der rechten Hand an den Bäumen. Ist rechts frei (nelia.right() == \"free\"), dreh nach rechts und geh. Sonst geradeaus, und wenn auch das nicht geht, dreh nach links – in allen Wäldern (Prüfen).",
              en="Find the exit place(\"exit\") through the forking thicket: keep your right hand on the trees. If the right is free (nelia.right() == \"free\"), turn right and walk. Otherwise go straight on, and if that does not work either, turn left – in every forest (Check).")
    until_done("thicket", at_exit, True,
               "Ich drehe mich im Kreis oder stecke fest. Erst rechts schauen, dann geradeaus, sonst links drehen – in dieser Reihenfolge.",
               "I am going round in circles or stuck. First look right, then straight ahead, otherwise turn left – in this order.")
    # Hat „Prüfen“ die Etappe gelöst, ohne dass Nelia hier ankam: sie geht zu Fuß hin
    if not at_exit():
        nelia.move_to(place("exit"))


@on_start
def story():
    # Umschalter und „Prüfen“ starten einen Wald bei einer Etappe (world.stage): Nelia steht schon dort (world.py)
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    if world.stage == "thicket":
        nelia.turn_to(CLEARING_FACE)
    camera.jump_to(place("view"))
    if world.stage is None:
        say("nelia", de="Lindgrund liegt hinter dem Wald. Einen Weg gibt es nicht, nur Unterholz – und keine Magd, die mir ein Programm schreibt.",
                     en="Lindgrund lies beyond the forest. There is no path, only undergrowth – and no maid to write me a program.")
    if first == 0:
        path()
    thicket()
    say("stranger", de="Da kommt ja jemand aus dem Wald. Ich habe auf dich gewartet, Mädchen.",
                    en="Someone is coming out of the forest. I have been waiting for you, girl.")
    say("nelia", de="Auf mich? Wer bist du?", en="For me? Who are you?")
    victory()
