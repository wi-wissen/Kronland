# I.M „Heimweg durchs Unterholz“ (Meisterstück der Reihe I): drei Etappen, dreimal Unterholz.
# Kein Zettel – das Programm schreibt man selbst. place("exit") zeigt in jeder Etappe auf den Ausgang des Abschnitts.

ENDED = ("done", "error", "stopped")


def at_exit():
    return nelia.is_at(place("exit"))


def move_to_section(n):
    program.stop()
    make_place("exit", place("exit" + str(n)).x, place("exit" + str(n)).y, 0)
    nelia.teleport(place("start" + str(n)))
    nelia.turn_to("east")
    camera.fly_to(place("view" + str(n)), seconds=1)


# Warten, bis Nelia am Ausgang steht; endet ein Lauf vorher, gibt sie einen Tipp
def until_exit(de, en):
    while not at_exit():
        runs = program.runs
        wait_until(lambda: at_exit() or (program.runs > runs and program.status in ENDED))
        if not at_exit():
            say("nelia", de=de, en=en)
    program.stop()


def edge():
    move_to_section(1)
    objective("edge", at_exit,
              de="Bring Nelia durchs Unterholz zum Ausgang: geh, solange vorn frei ist, sonst dreh dich nach rechts – bis sie bei place(\"exit\") steht.",
              en="Bring Nelia through the undergrowth to the exit: walk while the way ahead is free, otherwise turn right – until she stands at place(\"exit\").")
    until_exit("Hier komme ich nicht weiter. Was tun, wenn vor mir ein Baum steht? if nelia.can_step(): … else: …",
               "I cannot go on from here. What to do when a tree is in front of me? if nelia.can_step(): … else: …")
    say("nelia", de="Draußen! Aber dahinten wird das Dickicht noch dichter.", en="Out! But further on the thicket gets even denser.")


def thicket():
    move_to_section(2)
    say("nelia", de="Hier gibt es Abzweigungen und Sackgassen. Wenn ich immer mit der rechten Hand an den Bäumen bleibe, komme ich überall wieder heraus.",
                 en="There are forks and dead ends here. If I always keep my right hand on the trees, I will get out anywhere.")
    objective("thicket", at_exit,
              de="Halte dich mit der rechten Hand an den Bäumen: Ist rechts frei (nelia.right() == \"free\"), dreh nach rechts und geh. Sonst geradeaus, und wenn auch das nicht geht, dreh nach links.",
              en="Keep your right hand on the trees: if the right is free (nelia.right() == \"free\"), turn right and walk. Otherwise go straight on, and if that does not work either, turn left.")
    until_exit("Ich drehe mich im Kreis oder stecke fest. Erst rechts schauen, dann geradeaus, sonst links drehen – in dieser Reihenfolge.",
               "I am going round in circles or stuck. First look right, then straight ahead, otherwise turn left – in this order.")
    say("nelia", de="Geschafft! Die rechte Hand hat mich geführt.", en="Made it! My right hand led the way.")


def home():
    move_to_section(3)
    objective("home", at_exit,
              de="Das letzte Stück Unterholz ist anders gewachsen. Dasselbe Programm muss auch hier zum Ausgang finden.",
              en="The last stretch of undergrowth has grown differently. The same program has to find the exit here too.")
    until_exit("Hier hilft mir dein Programm nicht hinaus. Ein gutes Programm passt für jedes Unterholz – prüf die Reihenfolge rechts, geradeaus, links.",
               "Your program does not get me out here. A good program fits any undergrowth – check the order right, straight on, left.")


@on_start
def story():
    camera.jump_to(place("view1"))
    say("nelia", de="Lindgrund liegt hinter dem Wald. Einen Weg gibt es nicht, nur Unterholz – und keine Magd, die mir einen Zettel schreibt.",
                 en="Lindgrund lies beyond the forest. There is no path, only undergrowth – and no maid to write me a note.")
    edge()
    thicket()
    home()
    npc("stranger", look="hero.orrin", at=place("square"), de="Fremder", en="Stranger")
    say("stranger", de="Da kommt ja jemand aus dem Wald. Ich habe auf dich gewartet, Mädchen.",
                    en="Someone is coming out of the forest. I have been waiting for you, girl.")
    say("nelia", de="Auf mich? Wer bist du?", en="For me? Who are you?")
    victory()
