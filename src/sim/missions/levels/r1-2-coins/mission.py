# I.2 „Taler für die Mägde“: vier Etappen in vier Abschnitten der Karte (Zählschleife).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).

ENDED = ("done", "error", "stopped")
RING = [(4, 32), (5, 32), (6, 32), (6, 33), (6, 34), (5, 34), (4, 34), (4, 33)]

NOTE = "\n".join([
    "guess = 0",
    "for i in range(5):",
    "    nelia.step()",
    "    nelia.put()",
    "",
])

npc("maid", look="serf", at=(2, 5), de="Magd Hedda", en="Hedda the maid")


# Warten, bis der Spieler das Programm erneut gestartet hat und es zu Ende ist
def next_run():
    runs = program.runs
    wait_until(lambda: program.runs > runs and program.status in ENDED)


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
    objective("predict",
              de="Wie viele Taler liegen am Ende im Schnee? Trag deine Vermutung bei guess ein, dann führe den Zettel aus.",
              en="How many coins lie in the snow at the end? Put your guess into guess, then run the note.")
    while True:
        next_run()
        guess = program.get("guess")
        laid = len(coins_in(0))
        if program.status == "done" and laid > 0 and guess == laid:
            complete("predict")
            say("nelia", de=f"{laid} Taler – genau wie vermutet!", en=f"{laid} coins – just as you guessed!")
            return
        if program.status == "done":
            say("nelia", de=f"Im Schnee liegen {laid} Taler, vermutet hattest du {guess}. Zähl noch einmal mit – Ausführen bringt mich zurück an den Start.",
                         en=f"There are {laid} coins in the snow, you guessed {guess}. Count along once more – Run takes me back to the start.")


def path_ok():
    laid = sorted([c[0] for c in coins_in(10) if c[1] == 13])
    if len(laid) != 9 or len(coins_in(10)) != 9 or not nelia.is_at(place("b_end")):
        return False
    for i in range(1, len(laid)):
        if laid[i] - laid[i - 1] < 2:
            return False
    return True


def path():
    move_to_section("b_start", "b_view", 9)
    say("maid", de="Bis zu den Bäumen sind es 18 Kacheln. Aber du hast nur noch 9 Taler, Nelia!",
                en="It is 18 tiles to the trees. But you only have 9 coins left, Nelia!")
    objective("path",
              de="Ändere den Zettel: Nelia geht 18 Schritte bis zu den Bäumen und legt nur auf jede zweite Kachel einen Taler.",
              en="Change the note: Nelia walks 18 steps to the trees and puts a coin on every second tile only.")
    while True:
        next_run()
        if path_ok():
            complete("path")
            say("nelia", de="Neun Taler auf achtzehn Kacheln. Der Vorrat hat gereicht!", en="Nine coins on eighteen tiles. The purse was enough!")
            return
        say("nelia", de=f"{len(coins_in(10))} Taler liegen, aber gesucht sind 18 Schritte bis zu den Bäumen und auf jeder zweiten Kachel ein Taler. Zwei Schritte, ein Taler – wie oft?",
                     en=f"{len(coins_in(10))} coins lie here, but the task is 18 steps to the trees and a coin on every second tile. Two steps, one coin – how many times?")


def slope():
    move_to_section("c_start", "c_view", 0)
    say("nelia", de="Oben am Hang glänzt etwas! Durchs Dickicht geht es nur im Zickzack: ein Schritt nach Osten, einer nach Norden, immer wieder.",
                 en="Something glitters up the slope! Through the thicket there is only a zigzag: one step east, one north, again and again.")
    objective("slope", lambda: nelia.is_at(place("c_goal")),
              de="Bring Nelia im Zickzack den Hang hinauf: eine Schleife, in der mehrere Befehle stehen.",
              en="Bring Nelia up the slope in a zigzag: a loop with several commands inside.")
    while not nelia.is_at(place("c_goal")):
        runs = program.runs
        wait_until(lambda: nelia.is_at(place("c_goal")) or (program.runs > runs and program.status in ENDED))
        if not nelia.is_at(place("c_goal")):
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
    move_to_section("d_start", "d_view", 8)
    say("nelia", de="Am Lagerfeuer sollen sie mich finden. Ein Rechteck aus acht Talern rund um den Holzstoß – vier gleiche Seiten.",
                 en="They should find me at the campfire. A rectangle of eight coins around the woodpile – four equal sides.")
    objective("fire", ring_done,
              de="Leg ein Rechteck aus Talern um den Holzstoß: auf jede der acht Kacheln rundherum einen.",
              en="Lay a rectangle of coins around the woodpile: one on each of the eight tiles around it.")
    while not ring_done():
        runs = program.runs
        wait_until(lambda: ring_done() or (program.runs > runs and program.status in ENDED))
        if not ring_done():
            say("nelia", de="Das Rechteck ist noch nicht zu. Jede Seite: Schritt, Taler, Schritt, Taler – dann links drehen.",
                         en="The rectangle is not closed yet. Each side: step, coin, step, coin – then turn left.")
    program.stop()
    npc("maids", look="serf", at=(9, 34), de="Mägde", en="Maids")
    say("maid", de="Da glänzt es! Wir sind da, Nelia – ohne deine Taler hätten wir dich nie gefunden.",
                en="There it glitters! We are here, Nelia – without your coins we would never have found you.")


@on_start
def story():
    camera.jump_to(place("a_view"))
    say("maid", de="Wir kommen nach, Nelia. Leg uns Taler in den Schnee, dann finden wir deinen Weg. Hier, mein Zettel.",
                en="We will follow you, Nelia. Put coins in the snow for us, then we will find your way. Here, my note.")
    note("maid", NOTE, de="Zettel der Magd", en="The maid's note")
    predict()
    path()
    slope()
    fire()
    victory()
