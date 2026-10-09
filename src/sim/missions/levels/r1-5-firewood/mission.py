# I.5 „Holz für die erste Nacht“: vier Etappen in vier Abschnitten der Karte (Variablen).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).

ENDED = ("done", "error", "stopped")
BROOK = 9          # so viele Schritte bis zum Bach im dritten Abschnitt

NOTE = "\n".join([
    "guess = 0",
    "count = 0",
    "while nelia.front() == \"coin\":",
    "    nelia.step()",
    "    nelia.take()",
    "    count = count + 1",
    "nelia.say(f\"{count} Taler!\")",
    "",
])

npc("woodcutter", look="serf", at=(2, 5), de="Holzfäller", en="Woodcutter")


# Warten, bis der Spieler das Programm erneut gestartet hat und es zu Ende ist
def next_run():
    runs = program.runs
    wait_until(lambda: program.runs > runs and program.status in ENDED)


def move_to_section(start, view):
    program.stop()
    nelia.teleport(place(start))
    nelia.turn_to("east")
    camera.fly_to(place(view), seconds=1)


# Gegenstände in einem Abschnitt (Reihen top … top + 7)
def items_in(top, kind):
    return [c for c in items(kind) if top <= c[1] < top + 8]


def predict():
    objective("predict",
              de="Was sagt Nelia am Ende? Trag die Zahl bei guess ein, dann führe den Zettel aus.",
              en="What does Nelia say at the end? Put the number into guess, then run the note.")
    while True:
        next_run()
        guess = program.get("guess")
        count = program.get("count")
        if program.status == "done" and len(items_in(0, "coin")) == 0 and guess == count:
            complete("predict")
            say("woodcutter", de=f"{count} Taler, {count} Scheite. Gut gezählt!", en=f"{count} coins, {count} logs. Well counted!")
            return
        if program.status == "done":
            say("nelia", de=f"Ich habe {count} gesagt, vermutet hattest du {guess}. Zähl die Taler noch einmal – Ausführen bringt mich zurück an den Start.",
                         en=f"I said {count}, you guessed {guess}. Count the coins once more – Run takes me back to the start.")


def roses():
    move_to_section("b_start", "b_view")
    say("nelia", de="Christrosen zwischen den Talern! Die nehme ich mit für die Hütte – aber wie viele sind es?",
                 en="Christmas roses between the coins! I will take them along for the hut – but how many are there?")
    objective("roses",
              de="Ändere den Zettel: Nelia hebt bis zum Baum alles auf und zählt Taler in count und Christrosen in flowers.",
              en="Change the note: Nelia picks up everything up to the tree and counts coins in count and Christmas roses in flowers.")
    coins = len(items_in(10, "coin"))
    flowers = len(items_in(10, "flower"))
    while True:
        next_run()
        left = len(items_in(10, "coin")) + len(items_in(10, "flower"))
        got_c = program.get("count")
        got_f = program.get("flowers")
        if program.status == "done" and left == 0 and got_c == coins and got_f == flowers:
            complete("roses")
            say("nelia", de=f"{coins} Taler und {flowers} Christrosen. Zwei Zahlen, zwei Variablen.",
                         en=f"{coins} coins and {flowers} Christmas roses. Two numbers, two variables.")
            return
        if left > 0:
            say("nelia", de="Es liegt noch etwas im Schnee. Geh, solange vorn frei ist (nelia.can_step()), und schau bei jedem Schritt mit nelia.here(), was unter dir liegt.",
                         en="Something is still lying in the snow. Walk as long as the way is free (nelia.can_step()) and check with nelia.here() what lies under you at every step.")
        else:
            say("nelia", de=f"Alles aufgehoben, aber count ist {got_c} und flowers ist {got_f}. Zähl Taler und Christrosen getrennt.",
                         en=f"Everything picked up, but count is {got_c} and flowers is {got_f}. Count coins and Christmas roses separately.")


def brook():
    move_to_section("c_start", "c_view")
    say("woodcutter", de="Wasser brauchst du auch – unter dem Eis des Bachs. Wie weit ist es bis dorthin? Zähl die Schritte und komm genauso weit zurück.",
                      en="You need water too – under the ice of the brook. How far is it? Count the steps and come back just as far.")
    objective("brook",
              de="Nelia geht bis ans Eis des Bachs (vorn ist \"ice\"), zählt die Schritte in steps, dreht um und geht genauso viele Schritte zurück zum Start.",
              en="Nelia walks up to the ice of the brook (ahead is \"ice\"), counts the steps in steps, turns around and walks just as many steps back to the start.")
    while True:
        next_run()
        steps = program.get("steps")
        home = nelia.is_at(place("c_start"))
        if program.status == "done" and steps == BROOK and home:
            complete("brook")
            say("nelia", de=f"{steps} Schritte hin, {steps} zurück. Den Weg finde ich auch im Dunkeln.",
                         en=f"{steps} steps there, {steps} back. I can find that way in the dark too.")
            return
        if program.status == "done" and home:
            say("nelia", de=f"Ich bin wieder am Start, aber steps ist {steps}. Zähl jeden Schritt bis zum Bach mit.",
                         en=f"I am back at the start, but steps is {steps}. Count every step up to the brook.")
        elif program.status == "done":
            say("nelia", de=f"steps ist {steps}, aber ich stehe nicht am Start. Zähl, solange vorn kein \"ice\" ist, dann zweimal drehen und mit for genauso oft zurück.",
                         en=f"steps is {steps}, but I am not at the start. Count as long as there is no \"ice\" ahead, then turn twice and go back with for just as often.")


def six():
    move_to_section("d_start", "d_view")
    say("woodcutter", de="Sechs Scheite reichen für die Nacht. Mehr Taler nimm nicht – die anderen gehören den Händlern.",
                      en="Six logs are enough for the night. Do not take more coins – the others belong to the merchants.")
    objective("six",
              de="Nelia hebt genau 6 Taler auf: Sie geht weiter, solange count kleiner als 6 ist.",
              en="Nelia picks up exactly 6 coins: she goes on as long as count is less than 6.")
    total = len(items_in(30, "coin"))
    while True:
        next_run()
        taken = total - len(items_in(30, "coin"))
        if program.status == "done" and taken == 6:
            complete("six")
            say("woodcutter", de="Sechs Taler, sechs Scheite. Heute Nacht friert in der Hütte niemand.",
                              en="Six coins, six logs. Nobody will freeze in the hut tonight.")
            return
        if program.status == "done":
            say("nelia", de=f"Ich habe {taken} Taler aufgehoben, nicht 6. „while count < 6:“ hört rechtzeitig auf.",
                         en=f"I picked up {taken} coins, not 6. “while count < 6:” stops in time.")


@on_start
def story():
    camera.jump_to(place("a_view"))
    say("woodcutter", de="Brennholz? Ein Scheit für einen Taler. Die Händler haben auf dem Weg welche verloren – mein Lehrling sammelt sie so ein.",
                      en="Firewood? One log for one coin. The merchants lost some on the path – my apprentice collects them like this.")
    note("woodcutter", NOTE, de="Zettel des Holzfällers", en="The woodcutter's note")
    predict()
    roses()
    brook()
    six()
    victory()
