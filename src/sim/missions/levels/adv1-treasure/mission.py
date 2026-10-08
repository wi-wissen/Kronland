@on_start
def intro():
    objective("goal", lambda: hero.is_at(place("treasure")),
              de="Bring Nelia zum Schatz",
              en="Bring Nelia to the treasure")
    say("nelia", de="Da hinten glänzt etwas! Zehn Schritte geradeaus, schätze ich.",
                 en="Something is glittering over there! Ten steps straight ahead, I guess.")
    wait(40)
    if not hero.is_at(place("treasure")):
        message(de="Tipp: Statt zehnmal hero.step() zu schreiben, geht auch: for i in range(10):",
                en="Tip: instead of writing hero.step() ten times you can use: for i in range(10):")

@on_objective("goal")
def found(id, status):
    say("nelia", de="Gold! Und ich musste nicht einmal suchen.",
                 en="Gold! And I did not even have to search.")
    victory()
