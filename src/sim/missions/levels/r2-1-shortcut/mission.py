# II.1 „Orrins Abkürzung“: eine Straße nach Osten in drei Etappen (Funktion ohne Parameter), in drei Welten (world.py).
# Die Etappen sind aufeinanderfolgende Wegstücke derselben Karte: dreimal um die Mauern der Ruine (predict), dreimal um
# den zweiten Teil, wo eine Dornenhecke wächst (hedge), dann die Straße mit Orrins Talern (coins). Das Programm bleibt
# und wächst; nichts wird geladen oder versetzt, die Welt ändert sich nur an Ort und Stelle (die Hecke wächst).
# Die Taler zählen erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat (all_worlds=True).

STAGES = ["predict", "hedge", "coins"]
ENDED = ("done", "error", "stopped")
# So weit kommt Nelia mit dreimal around_ruin() am Anfang der Ruine (Kacheln östlich vom Start)
AHEAD = 6

PROGRAM = "\n".join([
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

npc("trader", look="hero.orrin", at=(2, 3), speaker="orrin")


def predict():
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="around_ruin() wird dreimal aufgerufen: Wie viele Kacheln weiter östlich steht Nelia danach? Führe das Programm aus und sieh nach.",
              en="around_ruin() is called three times: how many tiles further east does Nelia stand afterwards? Run the program and have a look.")
    wait_until(lambda: objective_status("predict") == "done")
    walked = nelia.x - place("start").x
    # Erst das nächste Unterziel, dann sprechen: ohne aktives Ziel gäbe es keinen Schnappschuss der Etappe
    say("orrin", de=f"{walked} Kacheln. Drei Zeilen unten, die Arbeit steckt oben in der Funktion.",
                 en=f"{walked} tiles. Three lines below, the work is in the function above.", wait=False)


def hedge(grow):
    # Zuerst die Änderung der Welt und das Ziel, dann die Worte (das Ziel macht den Schnappschuss der Etappe möglich)
    if grow:
        grow_hedge()
    objective("hedge", lambda: nelia.is_at(place("ruin_end")),
              de="Ändere around_ruin(): Nelia soll links herum um die Mauerreste gehen. Die drei Aufrufe unten bleiben gleich.",
              en="Change around_ruin(): Nelia should go round the left of the walls. The three calls below stay the same.")
    if grow:
        say("orrin", de="Weiter hinten steht der Rest der Ruine – aber seht nur, im Süden ist eine Dornenhecke gewachsen! Meine Abkürzung muss diesmal links herum, nördlich an den Mauern vorbei.",
                     en="The rest of the ruin stands further on – but look, a thorn hedge has grown in the south! This time my shortcut has to go round the left, north past the walls.", wait=False)
    else:
        say("orrin", de="Hier ist im Süden eine Dornenhecke gewachsen. Meine Abkürzung muss diesmal links herum, nördlich an den Mauern vorbei.",
                     en="A thorn hedge has grown in the south here. This time my shortcut has to go round the left, north past the walls.", wait=False)
    while not nelia.is_at(place("ruin_end")):
        runs = program.runs
        wait_until(lambda: nelia.is_at(place("ruin_end")) or (program.runs > runs and program.status in ENDED))
        if not nelia.is_at(place("ruin_end")):
            say("nelia", de="Hier komme ich nicht weiter. In der Funktion links und rechts tauschen – dann gilt es für alle drei Aufrufe.",
                         en="I cannot go on from here. Swap left and right in the function – then it counts for all three calls.")
    program.stop()
    say("orrin", de="Eine Stelle geändert, und alle drei Umwege stimmen wieder. Dafür sind Funktionen da.",
                 en="One place changed, and all three detours are right again. That is what functions are for.", wait=False)


def coins(fly):
    total = len(items("coin"))
    seen = program.runs
    objective("coins", lambda: (total - len(items("coin")), total), all_worlds=True,
              de="Schreib eigene Befehle: turn_around() dreht Nelia um, fetch_left() und fetch_right() holen einen Taler neben dem Weg und kehren zurück. Damit sammelt sie bis zum Waldrand alle ein – in allen Welten (Prüfen).",
              en="Write your own commands: turn_around() turns Nelia round, fetch_left() and fetch_right() fetch a coin beside the path and return. With them she collects all of them up to the forest edge – in every world (Check).")
    nelia.turn_to("east")
    if fly:
        camera.fly_to(place("view_road"), seconds=1.5)
    say("orrin", de="Meine Geldkatze hatte ein Loch. Links und rechts vom Weg liegen jetzt meine Taler.",
                 en="My purse had a hole. Now my coins lie left and right of the path.", wait=False)
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
    # Hat „Prüfen“ die Etappe gelöst, ohne dass Nelia hier alle einsammelte: Orrin holt die übrigen selbst
    if len(items("coin")) > 0:
        say("orrin", de="Dein Programm findet sie alle – die übrigen hole ich selbst.", en="Your program finds them all – I will fetch the rest myself.")
        for c in items("coin"):
            remove_item(c[0], c[1])
            give(HUMAN, gold=1)
    say("orrin", de="Alle Taler wieder da! Mit dir als Partnerin, Mädchen, werden wir beide reich.",
                 en="All my coins are back! With you as a partner, girl, we will both get rich.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): Nelia steht schon dort (world.py)
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("view_road") if first == 2 else place("view_ruin"))
    if first == 0:
        if world.stage is None:
            say("orrin", de="Ich bin Orrin, Händler. Um diese Ruine kenne ich eine Abkürzung – ich habe sie mir als Funktion aufgeschrieben.",
                         en="I am Orrin, a merchant. I know a shortcut round this ruin – I wrote it down as a function.")
        program.load(PROGRAM)
        predict()
    if first <= 1:
        hedge(first == 0)
    coins(first <= 1)
    victory()
