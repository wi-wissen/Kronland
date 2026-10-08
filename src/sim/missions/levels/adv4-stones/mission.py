@on_start
def intro():
    objective("stones", lambda: len(piles_near(place("road"), 14)) == 0,
              de="Sammle alle Steinhaufen ein",
              en="Collect all piles of stone")
    say("nelia", de="Links und rechts liegen Steine. Ich schaue bei jedem Schritt nach beiden Seiten.",
                 en="There are stones to the left and right. I will look both ways at every step.")
    wait(80)
    if len(piles_near(place("road"), 14)) > 0:
        message(de="Tipp: def check_side(): hero.turn_left() … if hero.ahead() == \"pile\": hero.take() … hero.turn_right()",
                en="Tip: def check_side(): hero.turn_left() … if hero.ahead() == \"pile\": hero.take() … hero.turn_right()")

@on_objective("stones")
def done(id, status):
    say("nelia", de="Die Steine reichen für eine neue Mauer.",
                 en="The stones are enough for a new wall.")
    victory()
