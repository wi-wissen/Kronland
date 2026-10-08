total = len(items("coin"))

@on_start
def intro():
    objective("coins", lambda: (total - len(items("coin")), total),
              de="Sammle alle Taler am Wegesrand ein",
              en="Collect all thalers by the wayside")
    say("nelia", de="Links und rechts glänzt es. Ich schaue bei jedem Schritt nach beiden Seiten.",
                 en="Something glitters to the left and right. I will look both ways at every step.")
    wait(80)
    if items("coin"):
        message(de="Tipp: def fetch(turn): drehen, hin, aufheben, zurück – viermal gleich drehen bringt Nelia in die alte Richtung.",
                en="Tip: def fetch(turn): turn, go there, pick up, come back – turning the same way four times faces Nelia the old way again.")

@on_objective("coins")
def done(id, status):
    say("nelia", de="Alle eingesammelt! Damit bezahlen wir die neue Mauer.",
                 en="All collected! That pays for the new wall.")
    victory()
