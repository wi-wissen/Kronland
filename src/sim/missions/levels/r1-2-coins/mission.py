# I.2 „Taler für die Mägde“: vier Etappen in vier Abschnitten der Karte (Zählschleife), in drei Welten (world.py).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).
# Eine Zählschleife hat eine feste Zahl: Jede Etappe gilt in der gespielten Welt (kein all_worlds) – wer die Welt
# wechselt, ändert die Zahl in range(). Erst I.4 (while) bringt Programme, die in jeder Welt passen.

STAGES = ["predict", "path", "slope", "fire"]
ENDED = ("done", "error", "stopped")
PURSE = {"normal": 5, "near": 5, "far": 3}[world.id]   # Taler im Beutel bei der Vorhersage
# Neun Taler auf achtzehn Kacheln – je Welt in Worten
WORDS = {"normal": ("Neun", "achtzehn", "Nine", "eighteen"), "near": ("Drei", "sechs", "Three", "six"),
         "far": ("Zehn", "zwanzig", "Ten", "twenty")}[world.id]
RING_WORDS = ("acht", "eight") if SIDE == 2 else ("zwölf", "twelve")

NOTE = "\n".join([
    "guess = 0",
    "for i in range(5):",
    "    nelia.step()",
    "    nelia.put()",
    "",
])

npc("maid", look="serf", at=(2, 5), de="Magd Hedda", en="Hedda the maid")


# Warten, bis ein Lauf nach dem seen-ten zu Ende ist; zählt auch einen Lauf, der gleich nach dem Wechsel der Welt begann
def next_run(seen):
    wait_until(lambda: program.runs > seen and program.status in ENDED)
    return program.runs


def move_to_section(start, view, purse):
    program.stop()
    nelia.teleport(place(start))
    nelia.turn_to("east")
    give(HUMAN, gold=-stock("gold") + purse)   # genau so viele Taler im Beutel
    camera.fly_to(place(view), seconds=1)


# Taler in einem Abschnitt (Reihen top … top + 7)
def coins_in(top):
    return [c for c in items("coin") if top <= c[1] < top + 8]


def predict():
    give(HUMAN, gold=-stock("gold") + PURSE)
    if PURSE < 5:
        say("maid", de=f"Mehr als {PURSE} Taler habe ich nicht für dich, Nelia.", en=f"I have no more than {PURSE} coins for you, Nelia.")
    seen = program.runs
    objective("predict",
              de="Wie viele Taler liegen am Ende im Schnee? Trag deine Vermutung bei guess ein, dann führe den Zettel aus.",
              en="How many coins lie in the snow at the end? Put your guess into guess, then run the note.")
    while True:
        seen = next_run(seen)
        guess = program.get("guess")
        laid = len(coins_in(0))
        # Randfälle: Baum im Weg oder leerer Beutel – der Zettel bricht ab, die gelegten Taler zählen trotzdem
        ended = program.status == "done" or (program.status == "error" and laid == LAID)
        if ended and laid == LAID and guess == laid:
            complete("predict")
            say("nelia", de=f"{laid} Taler – genau wie vermutet!", en=f"{laid} coins – just as you guessed!")
            return
        if ended:
            say("nelia", de=f"Im Schnee liegen {laid} Taler, vermutet hattest du {guess}. Zähl noch einmal mit – Ausführen bringt mich zurück an den Start.",
                         en=f"There are {laid} coins in the snow, you guessed {guess}. Count along once more – Run takes me back to the start.")


def path_ok():
    laid = sorted([c[0] for c in coins_in(10) if c[1] == 13])
    # Das Programm muss zu Ende sein: eine Schleife, die zu oft läuft, stößt an die Bäume
    if program.status != "done" or len(laid) != PATH // 2 or len(coins_in(10)) != PATH // 2 or not nelia.is_at(place("b_end")):
        return False
    for i in range(1, len(laid)):
        if laid[i] - laid[i - 1] < 2:
            return False
    return True


def path():
    move_to_section("b_start", "b_view", PATH // 2)
    say("maid", de=f"Bis zu den Bäumen sind es {PATH} Kacheln. Aber du hast nur noch {PATH // 2} Taler, Nelia!",
                en=f"It is {PATH} tiles to the trees. But you only have {PATH // 2} coins left, Nelia!")
    seen = program.runs
    objective("path",
              de=f"Ändere den Zettel: Nelia geht {PATH} Schritte bis zu den Bäumen und legt nur auf jede zweite Kachel einen Taler.",
              en=f"Change the note: Nelia walks {PATH} steps to the trees and puts a coin on every second tile only.")
    while True:
        seen = next_run(seen)
        if path_ok():
            complete("path")
            say("nelia", de=f"{WORDS[0]} Taler auf {WORDS[1]} Kacheln. Der Vorrat hat gereicht!", en=f"{WORDS[2]} coins on {WORDS[3]} tiles. The purse was enough!")
            return
        say("nelia", de=f"{len(coins_in(10))} Taler liegen, aber gesucht sind {PATH} Schritte bis zu den Bäumen und auf jeder zweiten Kachel ein Taler. Zwei Schritte, ein Taler – wie oft?",
                     en=f"{len(coins_in(10))} coins lie here, but the task is {PATH} steps to the trees and a coin on every second tile. Two steps, one coin – how many times?")


def top():
    return nelia.is_at(place("c_goal")) and program.status == "done"


def slope():
    move_to_section("c_start", "c_view", 0)
    say("nelia", de="Oben am Hang glänzt etwas! Durchs Dickicht geht es nur im Zickzack: ein Schritt nach Osten, einer nach Norden, immer wieder.",
                 en="Something glitters up the slope! Through the thicket there is only a zigzag: one step east, one north, again and again.")
    seen = program.runs
    # Oben angekommen und das Programm zu Ende – eine Schleife, die zu oft läuft, stößt oben an den Talerhaufen
    objective("slope", top,
              de="Bring Nelia im Zickzack den Hang hinauf: eine Schleife, in der mehrere Befehle stehen.",
              en="Bring Nelia up the slope in a zigzag: a loop with several commands inside.")
    while objective_status("slope") != "done":
        wait_until(lambda: objective_status("slope") == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status("slope") == "done" or top():
            continue
        if nelia.is_at(place("c_goal")):
            say("nelia", de="Oben bin ich – aber das Programm wollte noch weiter. Wie oft genau?",
                         en="I am at the top – but the program wanted to go on. How many times exactly?")
        else:
            say("nelia", de="Hier komme ich nicht weiter. Schritt, links drehen, Schritt, rechts drehen – wie oft?",
                         en="I cannot go on from here. Step, turn left, step, turn right – how many times?")
    program.stop()
    say("nelia", de="Ein Beutel mit Talern, im Schnee vergessen. Gerade genug für ein Zeichen am Feuer.",
                 en="A purse of coins, forgotten in the snow. Just enough for a sign at the fire.")


def ring_done():
    coins = items("coin")
    for tile in RING:
        if tile not in coins:
            return False
    return True


def fire():
    move_to_section("d_start", "d_view", len(RING))
    say("nelia", de=f"Am Lagerfeuer sollen sie mich finden. Ein Rechteck aus {RING_WORDS[0]} Talern rund um den Holzstoß – vier gleiche Seiten.",
                 en=f"They should find me at the campfire. A rectangle of {RING_WORDS[1]} coins around the woodpile – four equal sides.")
    objective("fire", ring_done,
              de=f"Leg ein Rechteck aus Talern um den Holzstoß: auf jede der {RING_WORDS[0]} Kacheln rundherum einen.",
              en=f"Lay a rectangle of coins around the woodpile: one on each of the {RING_WORDS[1]} tiles around it.")
    while not ring_done():
        runs = program.runs
        wait_until(lambda: ring_done() or (program.runs > runs and program.status in ENDED))
        if not ring_done() and SIDE == 2:
            say("nelia", de="Das Rechteck ist noch nicht zu. Jede Seite: Schritt, Taler, Schritt, Taler – dann links drehen.",
                         en="The rectangle is not closed yet. Each side: step, coin, step, coin – then turn left.")
        elif not ring_done():
            say("nelia", de=f"Das Rechteck ist noch nicht zu. Jede Seite: {SIDE}-mal Schritt und Taler – dann links drehen.",
                         en=f"The rectangle is not closed yet. Each side: {SIDE} times step and coin – then turn left.")
    program.stop()
    npc("maids", look="serf", at=(9, 34), de="Mägde", en="Maids")
    say("maid", de="Da glänzt es! Wir sind da, Nelia – ohne deine Taler hätten wir dich nie gefunden.",
                en="There it glitters! We are here, Nelia – without your coins we would never have found you.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): direkt dorthin
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("a_view"))
    if first == 0 and world.stage is None:
        say("maid", de="Wir kommen nach, Nelia. Leg uns Taler in den Schnee, dann finden wir deinen Weg. Hier, mein Zettel.",
                    en="We will follow you, Nelia. Put coins in the snow for us, then we will find your way. Here, my note.")
    if first == 0:
        note("maid", NOTE, de="Zettel der Magd", en="The maid's note")
        predict()
    if first <= 1:
        path()
    if first <= 2:
        slope()
    fire()
    victory()
