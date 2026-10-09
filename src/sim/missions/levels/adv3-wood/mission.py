total = len(items("coin"))

@on_start
def intro():
    objective("coins", lambda: (total - len(items("coin")), total),
              de="Sammle alle Taler der Reihe ein",
              en="Collect all thalers in the row")
    say("nelia", de="Wie viele Taler das wohl sind? Ich sammle einfach, solange vor mir einer liegt.",
                 en="I wonder how many thalers there are. I will just keep collecting while one lies in front of me.")
    wait(60)
    if items("coin"):
        message(de="Tipp: while nelia.front() == \"coin\":  →  nelia.step(), nelia.take() und mitzählen",
                en="Tip: while nelia.front() == \"coin\":  →  nelia.step(), nelia.take() and count along")

@on_objective("coins")
def done(id, status):
    say("nelia", de=f"{total} Taler – davon kaufen wir Brennholz für den ganzen Winter.",
                 en=f"{total} thalers – that buys firewood for the whole winter.")
    victory()
