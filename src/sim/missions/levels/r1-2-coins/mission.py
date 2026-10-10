# I.2 „Taler für die Mägde“: eine Reise in vier Etappen (Zählschleife) durch eine offene Landschaft, in drei Welten (world.py).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen). Nichts wird
# geladen oder versetzt: Wo eine Etappe endet, beginnt die nächste, und das Programm wächst mit.
# Eine Zählschleife hat eine feste Zahl: Jede Etappe gilt in der gespielten Welt (kein all_worlds) – wer die Welt
# wechselt, ändert die Zahl in range(). Erst I.4 (while) bringt Programme, die in jeder Welt passen.
# Die Zahlen und der Startzustand jeder Etappe (STAGES, PE, XE, RING …) kommen aus world.py.

ENDED = ("done", "error", "stopped")
# Neun Taler auf achtzehn Kacheln – je Welt in Worten
WORDS = {"normal": ("Neun", "achtzehn", "Nine", "eighteen"), "near": ("Drei", "sechs", "Three", "six"),
         "far": ("Zehn", "zwanzig", "Ten", "twenty")}[world.id]
RING_WORDS = ("acht", "eight") if SIDE == 2 else ("zwölf", "twelve")

PROGRAM = "\n".join([
    "for i in range(5):",
    "    nelia.put()",
    "    nelia.step()",
    "",
])

npc("maid", look="serf", at=(SX + 1, Y0 - 2), de="Magd Hedda", en="Hedda the maid")


# Warten, bis ein Lauf nach dem seen-ten zu Ende ist; zählt auch einen Lauf, der gleich nach dem Wechsel der Welt begann
def next_run(seen):
    wait_until(lambda: program.runs > seen and program.status in ENDED)
    return program.runs


# Taler auf dem Weg: die der Magd (vor PE) oder die der Wegetappe (PE bis zum Ende des Wegs)
def coins_before():
    return [c for c in items("coin") if c[1] == Y0 and c[0] < PE]


def coins_on_path():
    return [c for c in items("coin") if c[1] == Y0 and PE <= c[0] <= XE]


def predict():
    seen = program.runs
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="Wie viele Taler liegen am Ende im Schnee? Führe das Programm aus und sieh nach.",
              en="How many coins lie in the snow at the end? Run the program and have a look.")
    if LAID < 5:
        say("maid", de=f"Mehr als {LAID} Taler habe ich nicht für dich, Nelia.", en=f"I have no more than {LAID} coins for you, Nelia.", wait=False)
    while objective_status("predict") != "done":
        wait_until(lambda: objective_status("predict") == "done" or (program.runs > seen and program.status == "error"))
        seen = program.runs
        # Randfall: leerer Beutel – das Programm bricht ab, die gelegten Taler zählen trotzdem
        if objective_status("predict") != "done" and len(coins_before()) == LAID:
            complete("predict")
    say("nelia", de=f"{len(coins_before())} Taler liegen im Schnee.", en=f"{len(coins_before())} coins lie in the snow.", wait=False)


def path_ok():
    laid = sorted([c[0] for c in coins_on_path()])
    # Das Programm muss zu Ende sein: eine Schleife, die zu oft läuft, stößt an die Bäume
    if program.status != "done" or len(laid) != PATH // 2 or not nelia.is_at(place("b_end")):
        return False
    for i in range(1, len(laid)):
        if laid[i] - laid[i - 1] < 2:
            return False
    return True


def path():
    give(HUMAN, gold=-stock("gold") + PATH // 2)    # die Magd gibt neun Taler mit
    seen = program.runs
    # Erst das Ziel (kein Fenster ohne aktive Etappe), dann sprechen
    objective("path",
              de=f"Ändere das Programm: Nelia geht {PATH} Schritte bis zu den Bäumen und legt nur auf jede zweite Kachel einen Taler.",
              en=f"Change the program: Nelia walks {PATH} steps to the trees and puts a coin on every second tile only.")
    say("maid", de=f"Bis zu den Bäumen sind es {PATH} Kacheln. Aber du hast nur noch {PATH // 2} Taler, Nelia!",
                en=f"It is {PATH} tiles to the trees. But you only have {PATH // 2} coins left, Nelia!", wait=False)
    while True:
        seen = next_run(seen)
        if path_ok():
            complete("path")
            say("nelia", de=f"{WORDS[0]} Taler auf {WORDS[1]} Kacheln. Der Vorrat hat gereicht!", en=f"{WORDS[2]} coins on {WORDS[3]} tiles. The purse was enough!", wait=False)
            return
        say("nelia", de=f"{len(coins_on_path())} Taler liegen, aber gesucht sind {PATH} Schritte bis zu den Bäumen und auf jeder zweiten Kachel ein Taler. Zwei Schritte, ein Taler – wie oft?",
                     en=f"{len(coins_on_path())} coins lie here, but the task is {PATH} steps to the trees and a coin on every second tile. Two steps, one coin – how many times?", wait=False)


def top():
    return nelia.is_at(place("c_goal")) and program.status == "done"


def slope():
    seen = program.runs
    # Oben angekommen und das Programm zu Ende – eine Schleife, die zu oft läuft, stößt oben an den Holzstoß
    objective("slope", top,
              de="Bring Nelia im Zickzack den Hang hinauf: eine Schleife, in der mehrere Befehle stehen.",
              en="Bring Nelia up the slope in a zigzag: a loop with several commands inside.")
    say("nelia", de="Hinter den Bäumen geht es bergauf, und oben glänzt etwas! Durchs Dickicht geht es nur im Zickzack: ein Schritt nach Osten, einer nach Norden, immer wieder.",
                 en="Behind the trees the land climbs, and something glitters at the top! Through the thicket there is only a zigzag: one step east, one north, again and again.", wait=False)
    while objective_status("slope") != "done":
        wait_until(lambda: objective_status("slope") == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status("slope") == "done" or top():
            continue
        if nelia.is_at(place("c_goal")):
            say("nelia", de="Oben bin ich – aber das Programm wollte noch weiter. Wie oft genau?",
                         en="I am at the top – but the program wanted to go on. How many times exactly?", wait=False)
        else:
            say("nelia", de="Hier komme ich nicht weiter. Schritt, links drehen, Schritt, rechts drehen – wie oft?",
                         en="I cannot go on from here. Step, turn left, step, turn right – how many times?", wait=False)
    program.stop()
    # Der Beutel am Ziel wird aufgehoben: genug Taler für ein Zeichen am Feuer
    remove(purse)
    give(HUMAN, gold=-stock("gold") + len(RING))
    say("nelia", de="Ein Beutel mit Talern, im Schnee vergessen. Gerade genug für ein Zeichen am Feuer.",
                 en="A purse of coins, forgotten in the snow. Just enough for a sign at the fire.", wait=False)


def ring_done():
    coins = items("coin")
    for tile in RING:
        if tile not in coins:
            return False
    return True


def fire():
    objective("fire", ring_done,
              de=f"Leg ein Rechteck aus Talern um den Holzstoß: auf jede der {RING_WORDS[0]} Kacheln rundherum einen.",
              en=f"Lay a rectangle of coins around the woodpile: one on each of the {RING_WORDS[1]} tiles around it.")
    say("nelia", de=f"Am Lagerfeuer sollen sie mich finden. Ein Rechteck aus {RING_WORDS[0]} Talern rund um den Holzstoß – vier gleiche Seiten.",
                 en=f"They should find me at the campfire. A rectangle of {RING_WORDS[1]} coins around the woodpile – four equal sides.", wait=False)
    while not ring_done():
        runs = program.runs
        wait_until(lambda: ring_done() or (program.runs > runs and program.status in ENDED))
        if not ring_done() and SIDE == 2:
            say("nelia", de="Das Rechteck ist noch nicht zu. Jede Seite: Schritt, Taler, Schritt, Taler – dann links drehen.",
                         en="The rectangle is not closed yet. Each side: step, coin, step, coin – then turn left.", wait=False)
        elif not ring_done():
            say("nelia", de=f"Das Rechteck ist noch nicht zu. Jede Seite: {SIDE}-mal Schritt und Taler – dann links drehen.",
                         en=f"The rectangle is not closed yet. Each side: {SIDE} times step and coin – then turn left.", wait=False)
    program.stop()
    npc("maids", look="serf", at=(XE - 1, Y0 - 1), de="Mägde", en="Maids")
    say("maid", de="Da glänzt es! Wir sind da, Nelia – ohne deine Taler hätten wir dich nie gefunden.",
                en="There it glitters! We are here, Nelia – without your coins we would never have found you.", wait=False)


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): world.py hat sie schon vorbereitet
    camera.jump_to(place("view"))
    if first == 0 and world.stage is None:
        say("maid", de="Wir kommen nach, Nelia. Leg uns Taler in den Schnee, dann finden wir deinen Weg. Hier, mein Programm.",
                    en="We will follow you, Nelia. Put coins in the snow for us, then we will find your way. Here, my program.", wait=False)
    if first == 0:
        program.load(PROGRAM)
        predict()
    if first <= 1:
        path()
    if first <= 2:
        slope()
    fire()
    victory()
