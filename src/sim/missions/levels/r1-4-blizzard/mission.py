# I.4 „Im Schneetreiben“ (Geschichte: Ilse ist erschöpft, Nelia sucht die Hütte der Geflohenen): eine Reise über ein Schneefeld in drei Etappen (world.py), in drei Welten (drei Karten).
# Die Etappen sind aufeinanderfolgende Wegstücke: nach Osten bis zum Waldrand, am Waldrand nach Süden bis zum Taler,
# vom Taler der Spur bis zur Hütte. Das Programm des Spielers bleibt und wächst; nichts wird geladen oder versetzt,
# Nelia beginnt jede Etappe dort, wo die vorige endete (und wendet sich nur ins nächste Wegstück).
# Taler und Spur zählen erst, wenn „Prüfen“ das Programm in allen Welten bestanden hat (all_worlds=True).

STAGES = ["predict", "coin", "hut"]
ENDED = ("done", "error", "stopped")

PROGRAM = "\n".join([
    "steps = 0",
    "while nelia.can_step():",
    "    nelia.step()",
    "    steps = steps + 1",
    "print(steps)",
    "",
])

npc("maid", look="serf", at=(1, 2), de="Magd Hedda", en="Hedda the maid")
npc("ilse", look="serf", at=(1, 3), de="Magd Ilse", en="Ilse the maid")
npc("runaways", look="serf", at=(HUT[0] + 1, HUT[1]), de="Geflohene", en="Runaways")


# Etappe mit all_worlds=True: warten, bis „Prüfen“ sie in allen Welten gelöst hat; nach jedem Lauf ein Hinweis
def until_checked(goal, solved, de, en):
    while objective_status(goal) != "done":
        runs = program.runs
        wait_until(lambda: objective_status(goal) == "done" or (program.runs > runs and program.status in ENDED))
        if objective_status(goal) == "done":
            break
        if solved():
            say(None, de="Hier hat es geklappt! Drück jetzt „Prüfen“ – klappt es auch in den anderen Welten?",
                         en="It worked here! Now press “Check” – does it work in the other worlds too?")
        else:
            say("nelia", de=de, en=en)
    program.stop()


def predict():
    # Das Programm einmal ausführen genügt (after_run) – Nachdenken, dann Ausführen
    objective("predict", after_run=True,
              de="Wie viele Schritte geht Nelia bis zum Waldrand? Führe das Programm aus und zähl mit.",
              en="How many steps does Nelia take to the forest edge? Run the program and count along.")
    wait_until(lambda: objective_status("predict") == "done")
    walked = nelia.x - place("start").x
    # Erst das nächste Unterziel, dann sprechen: ohne aktives Ziel gäbe es keinen Schnappschuss der Etappe
    say("nelia", de=f"{walked} Schritte bis zum Waldrand.", en=f"{walked} steps to the forest edge.", wait=False)


def coin():
    # Der Waldrand zieht sich nach Süden: Nelia wendet sich dorthin, das Programm läuft unverändert weiter
    objective("coin", lambda: len(items("coin")) == 0, all_worlds=True,
              de="Ändere das Programm: Nelia soll beim Taler stehen bleiben (nelia.here() == \"coin\") und ihn mit nelia.take() aufheben – in allen Welten (Prüfen).",
              en="Change the program: Nelia should stop on the coin (nelia.here() == \"coin\") and pick it up with nelia.take() – in every world (Check).")
    nelia.turn_to("south")
    say("nelia", de="Da glitzert etwas im Schnee: ein Taler! Hier war also jemand. Das Programm läuft aber einfach daran vorbei, immer weiter am Wald entlang …",
                 en="Something is glittering in the snow: a coin! So somebody has been here. But the program just walks past it, on and on along the forest …")
    until_checked("coin", lambda: len(items("coin")) == 0,
                  "Der Taler liegt noch im Schnee. Lauf, solange unter mir kein Taler liegt: while nelia.here() != \"coin\":",
                  "The coin is still lying in the snow. Walk as long as there is no coin under me: while nelia.here() != \"coin\":")
    say("nelia", de="Hab ihn! Und gleich daneben: Fußspuren.", en="Got it! And right next to it: footprints.", wait=False)
    # Hat „Prüfen“ die Etappe gelöst, ohne dass Nelia ihn hier aufhob: track() lässt sie zu Fuß hingehen
    return len(items("coin")) > 0


def track(walk_to_coin):
    # Die Spur beginnt neben dem Taler; Nelia blickt wie am Ende der vorigen Etappe nach Süden
    objective("hut", lambda: nelia.is_at(place("hut")), all_worlds=True,
              de="Folge der Spur durch alle Kurven bis zur Hütte: nelia.front(), nelia.left() und nelia.right() sagen \"track\", wo die Spur weitergeht. In jeder Welt biegt sie anders ab (Prüfen).",
              en="Follow the track through every bend to the hut: nelia.front(), nelia.left() and nelia.right() say \"track\" where it goes on. In every world it bends differently (Check).")
    # Das nächste Ziel steht schon; erst jetzt geht Nelia (falls nötig) zu Fuß zum Taler
    if walk_to_coin:
        nelia.move_to(place("coin"))
        nelia.take()
    nelia.turn_to("south")
    say("nelia", de="So viele Füße – das müssen die Geflohenen sein. Die Spur biegt mal links ab, mal rechts.",
                 en="So many feet – that must be the runaways. The track turns left, then right.")
    until_checked("hut", lambda: nelia.is_at(place("hut")),
                  "Hier endet mein Weg, aber nicht die Spur. Schau vorn, links und rechts nach \"track\".",
                  "My way ends here, but the track does not. Look ahead, left and right for \"track\".")
    if not nelia.is_at(place("hut")):
        nelia.move_to(place("hut"))
    say("runaways", de="Nelia? Die Tochter vom Holzfäller aus Lindgrund! Wir dachten, du schuftest noch im Kornlager.",
                    en="Nelia? The woodcutter's daughter from Lindgrund! We thought you were still slaving away in the granary.")
    say("nelia", de="Nicht mehr. Draußen im Schnee warten Hedda und Ilse – habt ihr Platz für drei?",
                 en="Not any more. Hedda and Ilse are waiting out in the snow – do you have room for three?")
    say("runaways", de="Platz schon. Nur kein Holz mehr für den Ofen.",
                    en="Room, yes. Just no wood left for the stove.")


@on_start
def story():
    # Umschalter und „Prüfen“ starten eine Welt bei einer Etappe (world.stage): Nelia steht schon dort (world.py)
    first = STAGES.index(world.stage) if world.stage in STAGES else 0
    camera.jump_to(place("view"))
    if first == 0:
        if world.stage is None:
            say("maid", de="Ilse kann nicht mehr, ich bleibe bei ihr. Hinter dem Wald soll eine Hütte sein, in der sich Geflohene verstecken – such sie, Nelia! Mein Programm bringt dich bis zum Waldrand. Aber wie weit ist das?",
                        en="Ilse cannot go on, I will stay with her. Beyond the forest there is said to be a hut where runaways are hiding – find it, Nelia! My program takes you to the forest edge. But how far is that?")
        program.load(PROGRAM)
        predict()
    late = False
    if first <= 1:
        late = coin()
    track(late)
    victory()
