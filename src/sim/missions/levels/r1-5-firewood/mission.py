# I.5 „Holz für die erste Nacht“: eine Reise in vier Etappen (Variablen) auf einem Weg durch den Winterwald, in drei Welten
# (world.py). Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).
# Nichts wird geladen oder versetzt: Wo eine Etappe endet, beginnt die nächste, und das Programm wächst mit.
# Christrosen, Bach und die sechs Taler zählen erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat
# (all_worlds=True); die Vorhersage gilt in der gespielten Welt. Zahlen und Orte (BROOK, JX, STAGES …) kommen aus world.py.

ENDED = ("done", "error", "stopped")

PROGRAM = "\n".join([
    "count = 0",
    "while nelia.front() == \"coin\":",
    "    nelia.step()",
    "    nelia.take()",
    "    count = count + 1",
    "nelia.say(f\"{count} Taler!\")",
    "",
])

npc("woodcutter", look="serf", at=(SX + 1, Y0 - 3), de="Holzfäller", en="Woodcutter")


# Warten, bis ein Lauf nach dem seen-ten zu Ende ist; zählt auch einen Lauf, der gleich nach dem Wechsel der Welt begann
def next_run(seen):
    wait_until(lambda: program.runs > seen and program.status in ENDED)
    return program.runs


# Etappe mit all_worlds=True: warten, bis „Prüfen“ sie in allen Welten gelöst hat; nach jedem Lauf ein Hinweis
def until_checked(goal, solved, hint):
    seen = program.runs
    while objective_status(goal) != "done":
        wait_until(lambda: objective_status(goal) == "done" or (program.runs > seen and program.status in ENDED))
        seen = program.runs
        if objective_status(goal) == "done":
            return
        if solved():
            say("nelia", de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Welten?",
                         en="It worked here! Now press “Check” – does it work in the other worlds too?", wait=False)
        else:
            hint()


# Gegenstände der gemischten Reihe (Taler und Christrosen bis zum Baum) und Taler der Nordreihe
def mixed_left(kind):
    return [c for c in items(kind) if c[1] == Y0 and MIX_FROM <= c[0] <= JX]


def row_left():
    return [c for c in items("coin") if c[0] == JX and c[1] < Y0]


def predict():
    seen = program.runs
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="Was sagt Nelia am Ende? Führe das Programm aus und hör zu.",
              en="What does Nelia say at the end? Run the program and listen.")
    wait_until(lambda: objective_status("predict") == "done")
    count = program.get("count")
    say("woodcutter", de=f"{count} Taler, {count} Scheite.", en=f"{count} coins, {count} logs.", wait=False)


def roses():
    coins = COINS
    flowers = FLOWERS

    def left():
        return len(mixed_left("coin")) + len(mixed_left("flower"))

    def solved():
        return program.status == "done" and left() == 0 and program.get("count") == coins and program.get("flowers") == flowers

    def hint():
        if left() > 0:
            say("nelia", de="Es liegt noch etwas im Schnee. Geh, solange vorn frei ist (nelia.can_step()), und schau bei jedem Schritt mit nelia.here(), was unter dir liegt.",
                         en="Something is still lying in the snow. Walk as long as the way is free (nelia.can_step()) and check with nelia.here() what lies under you at every step.", wait=False)
        elif program.status == "done":
            got_c = program.get("count")
            got_f = program.get("flowers")
            say("nelia", de=f"Alles aufgehoben, aber count ist {got_c} und flowers ist {got_f}. Zähl Taler und Christrosen getrennt.",
                         en=f"Everything picked up, but count is {got_c} and flowers is {got_f}. Count coins and Christmas roses separately.", wait=False)

    objective("roses", solved, all_worlds=True,
              de="Ändere das Programm: Nelia hebt bis zum Baum alles auf und zählt Taler in count und Christrosen in flowers – in allen Welten (Prüfen).",
              en="Change the program: Nelia picks up everything up to the tree and counts coins in count and Christmas roses in flowers – in every world (Check).")
    say("nelia", de="Christrosen zwischen den Talern! Die nehme ich mit für die Hütte – aber wie viele sind es?",
                 en="Christmas roses between the coins! I will take them along for the hut – but how many are there?", wait=False)
    until_checked("roses", solved, hint)
    say("nelia", de=f"{coins} Taler und {flowers} Christrosen. Zwei Zahlen, zwei Variablen.",
                 en=f"{coins} coins and {flowers} Christmas roses. Two numbers, two variables.", wait=False)


def brook():

    def solved():
        return program.status == "done" and program.get("steps") == BROOK and nelia.is_at(place("junction"))

    def hint():
        steps = program.get("steps")
        if program.status == "error" and nelia.is_at(place("junction")):
            say("nelia", de="Vor mir steht der Baum. Der Pfad zum Bach biegt nach Süden ab – erst nach rechts drehen.",
                         en="The tree is right in front of me. The path to the brook turns south – turn right first.", wait=False)
        elif program.status == "done" and nelia.is_at(place("junction")):
            say("nelia", de=f"Ich bin wieder an der Kreuzung, aber steps ist {steps}. Zähl jeden Schritt bis zum Bach mit.",
                         en=f"I am back at the crossing, but steps is {steps}. Count every step up to the brook.", wait=False)
        elif program.status == "done":
            say("nelia", de=f"steps ist {steps}, aber ich stehe nicht an der Kreuzung. Zähl, solange vorn kein \"ice\" ist, dann zweimal drehen und mit for genauso oft zurück.",
                         en=f"steps is {steps}, but I am not at the crossing. Count as long as there is no \"ice\" ahead, then turn twice and go back with for just as often.", wait=False)

    objective("brook", solved, all_worlds=True,
              de="Ändere das Programm: Nelia biegt nach Süden ab und geht bis ans Eis des Bachs (vorn ist \"ice\"), zählt die Schritte in steps, dreht um und geht genauso viele Schritte zurück zur Kreuzung – in allen Welten (Prüfen).",
              en="Change the program: Nelia turns south and walks up to the ice of the brook (ahead is \"ice\"), counts the steps in steps, turns around and walks just as many steps back to the crossing – in every world (Check).")
    say("woodcutter", de="Der Baum steht im Weg – hier biegt der Pfad nach Süden zum Bach ab. Wasser brauchst du auch, unter dem Eis. Wie weit ist es bis dorthin? Zähl die Schritte und komm genauso weit zurück.",
                      en="The tree blocks the way – here the path turns south to the brook. You need water too, under the ice. How far is it? Count the steps and come back just as far.", wait=False)
    until_checked("brook", solved, hint)
    say("nelia", de=f"{BROOK} Schritte hin, {BROOK} zurück. Den Weg finde ich auch im Dunkeln.",
                 en=f"{BROOK} steps there, {BROOK} back. I can find that way in the dark too.", wait=False)


def six():
    total = len(row_left())

    def taken():
        return total - len(row_left())

    def solved():
        return program.status == "done" and taken() == 6

    def hint():
        if program.status == "done":
            say("nelia", de=f"Ich habe {taken()} Taler aufgehoben, nicht 6. „while count < 6:“ hört rechtzeitig auf.",
                         en=f"I picked up {taken()} coins, not 6. “while count < 6:” stops in time.", wait=False)

    objective("six", solved, all_worlds=True,
              de="Nelia hebt genau 6 Taler auf: Sie geht weiter, solange count kleiner als 6 ist – in allen Welten (Prüfen).",
              en="Nelia picks up exactly 6 coins: she goes on as long as count is less than 6 – in every world (Check).")
    say("woodcutter", de="Sechs Scheite reichen für die Nacht. Nach Norden liegt noch eine Reihe Taler – nimm nicht mehr als sechs, die anderen gehören den Händlern.",
                      en="Six logs are enough for the night. More coins lie in a row to the north – do not take more than six, the others belong to the merchants.", wait=False)
    until_checked("six", solved, hint)
    say("woodcutter", de="Sechs Taler, sechs Scheite. Heute Nacht friert in der Hütte niemand.",
                      en="Six coins, six logs. Nobody will freeze in the hut tonight.", wait=False)


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): world.py hat sie schon vorbereitet
    camera.jump_to(place("view"))
    if first == 0 and world.stage is None:
        say("woodcutter", de="Brennholz? Ein Scheit für einen Taler. Die Händler haben auf dem Weg welche verloren – mein Lehrling sammelt sie so ein.",
                          en="Firewood? One log for one coin. The merchants lost some on the path – my apprentice collects them like this.", wait=False)
    if first == 0:
        program.load(PROGRAM)
        predict()
    if first <= 1:
        roses()
    if first <= 2:
        brook()
    six()
    victory()

# Die letzte Etappe beginnt nach Norden blickend (wie nach dem Rückweg vom Bach). Ganz am Ende, denn Drehen wartet kurz.
if first >= 3:
    nelia.turn_to("north")
