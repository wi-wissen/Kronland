# I.M „Heimweg durchs Unterholz“ (Meisterstück der Reihe I): drei Etappen, dreimal Unterholz.
# Kein Zettel – das Programm schreibt man selbst. place("exit") zeigt in jeder Etappe auf den Ausgang des Abschnitts.
# Drei Welten (world.py): jede Etappe zählt erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat (all_worlds=True).

STAGES = ["edge", "thicket", "home"]
ENDED = ("done", "error", "stopped")


def at_exit():
    return nelia.is_at(place("exit"))


def move_to_section(n):
    program.stop()
    make_place("exit", place("exit" + str(n)).x, place("exit" + str(n)).y, 0)
    nelia.teleport(place("start" + str(n)))
    nelia.turn_to("east")
    camera.fly_to(place("view" + str(n)), seconds=1)


# Warten, bis „Prüfen“ die Etappe in allen Welten gelöst hat; nach jedem Lauf ein Tipp oder die Bitte um „Prüfen“
def until_exit(goal, de, en, seen):
    while objective_status(goal) != "done":
        wait_until(lambda: objective_status(goal) == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status(goal) == "done":
            break
        if at_exit():
            say("nelia", de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Welten?",
                         en="It worked here! Now press “Check” – does it work in the other worlds too?")
        else:
            say("nelia", de=de, en=en)
    program.stop()


def edge():
    move_to_section(1)
    seen = program.runs
    objective("edge", at_exit, all_worlds=True,
              de="Bring Nelia durchs Unterholz zum Ausgang: geh, solange vorn frei ist, sonst dreh dich nach rechts – bis sie bei place(\"exit\") steht. In jeder Welt ist es anders gewachsen (Prüfen).",
              en="Bring Nelia through the undergrowth to the exit: walk while the way ahead is free, otherwise turn right – until she stands at place(\"exit\"). It grew differently in every world (Check).")
    until_exit("edge", "Hier komme ich nicht weiter. Was tun, wenn vor mir ein Baum steht? if nelia.can_step(): … else: …",
               "I cannot go on from here. What to do when a tree is in front of me? if nelia.can_step(): … else: …", seen)
    say("nelia", de="Draußen! Aber dahinten wird das Dickicht noch dichter.", en="Out! But further on the thicket gets even denser.")


def thicket():
    move_to_section(2)
    say("nelia", de="Hier gibt es Abzweigungen und Sackgassen. Wenn ich immer mit der rechten Hand an den Bäumen bleibe, komme ich überall wieder heraus.",
                 en="There are forks and dead ends here. If I always keep my right hand on the trees, I will get out anywhere.")
    seen = program.runs
    objective("thicket", at_exit, all_worlds=True,
              de="Halte dich mit der rechten Hand an den Bäumen: Ist rechts frei (nelia.right() == \"free\"), dreh nach rechts und geh. Sonst geradeaus, und wenn auch das nicht geht, dreh nach links – in allen Welten (Prüfen).",
              en="Keep your right hand on the trees: if the right is free (nelia.right() == \"free\"), turn right and walk. Otherwise go straight on, and if that does not work either, turn left – in every world (Check).")
    until_exit("thicket", "Ich drehe mich im Kreis oder stecke fest. Erst rechts schauen, dann geradeaus, sonst links drehen – in dieser Reihenfolge.",
               "I am going round in circles or stuck. First look right, then straight ahead, otherwise turn left – in this order.", seen)
    say("nelia", de="Geschafft! Die rechte Hand hat mich geführt.", en="Made it! My right hand led the way.")


def home():
    move_to_section(3)
    seen = program.runs
    objective("home", at_exit, all_worlds=True,
              de="Das letzte Stück Unterholz ist anders gewachsen. Dasselbe Programm muss auch hier zum Ausgang finden – in allen Welten (Prüfen).",
              en="The last stretch of undergrowth has grown differently. The same program has to find the exit here too – in every world (Check).")
    until_exit("home", "Hier hilft mir dein Programm nicht hinaus. Ein gutes Programm passt für jedes Unterholz – prüf die Reihenfolge rechts, geradeaus, links.",
               "Your program does not get me out here. A good program fits any undergrowth – check the order right, straight on, left.", seen)


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): direkt dorthin
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("view1"))
    if world.stage is None:
        say("nelia", de="Lindgrund liegt hinter dem Wald. Einen Weg gibt es nicht, nur Unterholz – und keine Magd, die mir einen Zettel schreibt.",
                     en="Lindgrund lies beyond the forest. There is no path, only undergrowth – and no maid to write me a note.")
    if first == 0:
        edge()
    if first <= 1:
        thicket()
    home()
    npc("stranger", look="hero.orrin", at=place("square"), de="Fremder", en="Stranger")
    say("stranger", de="Da kommt ja jemand aus dem Wald. Ich habe auf dich gewartet, Mädchen.",
                    en="Someone is coming out of the forest. I have been waiting for you, girl.")
    say("nelia", de="Auf mich? Wer bist du?", en="For me? Who are you?")
    victory()
