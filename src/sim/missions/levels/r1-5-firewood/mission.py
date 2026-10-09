# I.5 „Holz für die erste Nacht“: vier Etappen in vier Abschnitten der Karte (Variablen), in drei Welten (world.py).
# Jede Etappe ist ein Unterziel; Ausführen beginnt sie von vorn (Schnappschuss beim ersten Ausführen).
# Christrosen, Bach und die sechs Taler zählen erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat
# (all_worlds=True); die Vorhersage gilt in der gespielten Welt. BROOK (Schritte bis zum Bach) kommt aus world.py.

STAGES = ["predict", "roses", "brook", "six"]
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

npc("woodcutter", look="serf", at=(2, 5), de="Holzfäller", en="Woodcutter")


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
                         en="It worked here! Now press “Check” – does it work in the other worlds too?")
        else:
            hint()


def move_to_section(start, view):
    program.stop()
    nelia.teleport(place(start))
    nelia.turn_to("east")
    camera.fly_to(place(view), seconds=1)


# Gegenstände in einem Abschnitt (Reihen top … top + 7)
def items_in(top, kind):
    return [c for c in items(kind) if top <= c[1] < top + 8]


def predict():
    seen = program.runs
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="Was sagt Nelia am Ende? Führe das Programm aus und hör zu.",
              en="What does Nelia say at the end? Run the program and listen.")
    wait_until(lambda: objective_status("predict") == "done")
    count = program.get("count")
    say("woodcutter", de=f"{count} Taler, {count} Scheite.", en=f"{count} coins, {count} logs.")


def roses():
    move_to_section("b_start", "b_view")
    say("nelia", de="Christrosen zwischen den Talern! Die nehme ich mit für die Hütte – aber wie viele sind es?",
                 en="Christmas roses between the coins! I will take them along for the hut – but how many are there?")
    coins = len(items_in(10, "coin"))
    flowers = len(items_in(10, "flower"))

    def left():
        return len(items_in(10, "coin")) + len(items_in(10, "flower"))

    def solved():
        return program.status == "done" and left() == 0 and program.get("count") == coins and program.get("flowers") == flowers

    def hint():
        if left() > 0:
            say("nelia", de="Es liegt noch etwas im Schnee. Geh, solange vorn frei ist (nelia.can_step()), und schau bei jedem Schritt mit nelia.here(), was unter dir liegt.",
                         en="Something is still lying in the snow. Walk as long as the way is free (nelia.can_step()) and check with nelia.here() what lies under you at every step.")
        elif program.status == "done":
            got_c = program.get("count")
            got_f = program.get("flowers")
            say("nelia", de=f"Alles aufgehoben, aber count ist {got_c} und flowers ist {got_f}. Zähl Taler und Christrosen getrennt.",
                         en=f"Everything picked up, but count is {got_c} and flowers is {got_f}. Count coins and Christmas roses separately.")

    objective("roses", solved, all_worlds=True,
              de="Ändere das Programm: Nelia hebt bis zum Baum alles auf und zählt Taler in count und Christrosen in flowers – in allen Welten (Prüfen).",
              en="Change the program: Nelia picks up everything up to the tree and counts coins in count and Christmas roses in flowers – in every world (Check).")
    until_checked("roses", solved, hint)
    say("nelia", de=f"{coins} Taler und {flowers} Christrosen. Zwei Zahlen, zwei Variablen.",
                 en=f"{coins} coins and {flowers} Christmas roses. Two numbers, two variables.")


def brook():
    move_to_section("c_start", "c_view")
    say("woodcutter", de="Wasser brauchst du auch – unter dem Eis des Bachs. Wie weit ist es bis dorthin? Zähl die Schritte und komm genauso weit zurück.",
                      en="You need water too – under the ice of the brook. How far is it? Count the steps and come back just as far.")

    def solved():
        return program.status == "done" and program.get("steps") == BROOK and nelia.is_at(place("c_start"))

    def hint():
        steps = program.get("steps")
        if program.status == "done" and nelia.is_at(place("c_start")):
            say("nelia", de=f"Ich bin wieder am Start, aber steps ist {steps}. Zähl jeden Schritt bis zum Bach mit.",
                         en=f"I am back at the start, but steps is {steps}. Count every step up to the brook.")
        elif program.status == "done":
            say("nelia", de=f"steps ist {steps}, aber ich stehe nicht am Start. Zähl, solange vorn kein \"ice\" ist, dann zweimal drehen und mit for genauso oft zurück.",
                         en=f"steps is {steps}, but I am not at the start. Count as long as there is no \"ice\" ahead, then turn twice and go back with for just as often.")

    objective("brook", solved, all_worlds=True,
              de="Nelia geht bis ans Eis des Bachs (vorn ist \"ice\"), zählt die Schritte in steps, dreht um und geht genauso viele Schritte zurück zum Start – in allen Welten (Prüfen).",
              en="Nelia walks up to the ice of the brook (ahead is \"ice\"), counts the steps in steps, turns around and walks just as many steps back to the start – in every world (Check).")
    until_checked("brook", solved, hint)
    say("nelia", de=f"{BROOK} Schritte hin, {BROOK} zurück. Den Weg finde ich auch im Dunkeln.",
                 en=f"{BROOK} steps there, {BROOK} back. I can find that way in the dark too.")


def six():
    move_to_section("d_start", "d_view")
    say("woodcutter", de="Sechs Scheite reichen für die Nacht. Mehr Taler nimm nicht – die anderen gehören den Händlern.",
                      en="Six logs are enough for the night. Do not take more coins – the others belong to the merchants.")
    total = len(items_in(30, "coin"))

    def taken():
        return total - len(items_in(30, "coin"))

    def solved():
        return program.status == "done" and taken() == 6

    def hint():
        if program.status == "done":
            say("nelia", de=f"Ich habe {taken()} Taler aufgehoben, nicht 6. „while count < 6:“ hört rechtzeitig auf.",
                         en=f"I picked up {taken()} coins, not 6. “while count < 6:” stops in time.")

    objective("six", solved, all_worlds=True,
              de="Nelia hebt genau 6 Taler auf: Sie geht weiter, solange count kleiner als 6 ist – in allen Welten (Prüfen).",
              en="Nelia picks up exactly 6 coins: she goes on as long as count is less than 6 – in every world (Check).")
    until_checked("six", solved, hint)
    say("woodcutter", de="Sechs Taler, sechs Scheite. Heute Nacht friert in der Hütte niemand.",
                      en="Six coins, six logs. Nobody will freeze in the hut tonight.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): direkt dorthin
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("a_view"))
    if first == 0 and world.stage is None:
        say("woodcutter", de="Brennholz? Ein Scheit für einen Taler. Die Händler haben auf dem Weg welche verloren – mein Lehrling sammelt sie so ein.",
                          en="Firewood? One log for one coin. The merchants lost some on the path – my apprentice collects them like this.")
    if first == 0:
        program.load(PROGRAM)
        predict()
    if first <= 1:
        roses()
    if first <= 2:
        brook()
    six()
    victory()
