def row_left():
    return len([t for t in trees_near(place("grove"), 12) if t.y == 6])

@on_start
def intro():
    objective("chop", lambda: row_left() == 0,
              de="Fälle alle Bäume der Reihe",
              en="Fell all trees in the row")
    say("nelia", de="Wie viele Bäume das wohl sind? Ich fälle einfach, solange einer vor mir steht.",
                 en="I wonder how many trees there are. I will just keep chopping while one is in front of me.")
    wait(60)
    if row_left() > 0:
        message(de="Tipp: while hero.ahead() == \"tree\":  →  hero.chop() und hero.step()",
                en="Tip: while hero.ahead() == \"tree\":  →  hero.chop() and hero.step()")

@on_objective("chop")
def done(id, status):
    say("nelia", de="Das gibt einen warmen Winter.",
                 en="That makes for a warm winter.")
    victory()
